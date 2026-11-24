import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const DIST_DIR = path.resolve(__dirname, 'dist');
const DIST_INDEX = path.join(DIST_DIR, 'index.html');
const RUNNING_UNDER_TSX =
  process.execArgv.some((arg) => arg.includes('tsx')) ||
  process.argv.some((arg) => arg.includes('tsx')) ||
  process.env.npm_lifecycle_event === 'dev';
const IS_PROD =
  process.env.NODE_ENV === 'production' ||
  process.env.npm_lifecycle_event === 'start' ||
  Boolean(process.env.K_SERVICE || process.env.K_REVISION) ||
  (!RUNNING_UNDER_TSX && fs.existsSync(DIST_INDEX));

type AllowedModel = 'gemini-4-hydrogen' | 'gemini-3.1-flash-lite';

interface IncomingAttachment {
  name: string;
  mimeType: string;
  dataBase64: string;
  textPreview?: string;
}

interface IncomingMessage {
  role: 'user' | 'assistant';
  content: string;
  attachments?: IncomingAttachment[];
}

interface IncomingConfig {
  model?: AllowedModel;
  thinkingLevel?: 'LOW' | 'MEDIUM' | 'HIGH' | 'XHIGH';
  maxOutputTokens?: number;
  temperature?: number;
  topP?: number;
  topK?: number;
  streaming?: boolean;
  webSearch?: boolean;
  systemInstruction?: string;
}

interface ExtractedSource {
  title: string;
  url: string;
  snippet?: string;
}

function isApiKeyConfigured(): boolean {
  const key = process.env.GEMINI_API_KEY?.trim() ?? '';
  return Boolean(key && key !== 'MY_GEMINI_API_KEY');
}

function createAiClient(apiVersion?: string): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new Error(
      'GEMINI_API_KEY is not configured on the server. Add it in Settings > Secrets.'
    );
  }
  return new GoogleGenAI({
    apiKey,
    ...(apiVersion ? { apiVersion } : {}),
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function resolveModel(model?: string): AllowedModel {
  if (model === 'gemini-3.1-flash-lite') return 'gemini-3.1-flash-lite';
  return 'gemini-4-hydrogen';
}

function mapThinkingLevel(level?: string): ThinkingLevel {
  switch (level) {
    case 'LOW':
      return ThinkingLevel.LOW;
    case 'MEDIUM':
      return ThinkingLevel.MEDIUM;
    case 'XHIGH':
      return ThinkingLevel.XHIGH;
    case 'HIGH':
    default:
      return ThinkingLevel.HIGH;
  }
}

function buildModelConfig(model: AllowedModel, cfg: IncomingConfig): Record<string, unknown> {
  const config: Record<string, unknown> = {};

  if (cfg.systemInstruction?.trim()) {
    config.systemInstruction = cfg.systemInstruction.trim();
  }

  if (model === 'gemini-4-hydrogen') {
    config.thinkingConfig = {
      thinkingLevel: mapThinkingLevel(cfg.thinkingLevel),
    };
  } else {
    // Sampling parameters are supported on gemini-3.1-flash-lite
    if (typeof cfg.temperature === 'number') {
      config.temperature = Math.min(2, Math.max(0, cfg.temperature));
    }
    if (typeof cfg.topP === 'number') {
      config.topP = Math.min(1, Math.max(0.05, cfg.topP));
    }
    if (typeof cfg.topK === 'number') {
      config.topK = Math.min(64, Math.max(1, Math.round(cfg.topK)));
    }
    if (typeof cfg.maxOutputTokens === 'number' && cfg.maxOutputTokens >= 256) {
      config.maxOutputTokens = Math.min(32768, Math.round(cfg.maxOutputTokens));
    }
  }

  if (cfg.webSearch) {
    config.tools = [{ googleSearch: {} }];
  }

  return config;
}

function buildPartsFromMessage(msg: IncomingMessage): Array<Record<string, unknown>> {
  const parts: Array<Record<string, unknown>> = [];

  if (msg.attachments?.length) {
    for (const att of msg.attachments) {
      const isTextLike =
        att.mimeType.startsWith('text/') ||
        att.mimeType === 'application/json' ||
        att.name.endsWith('.md') ||
        att.name.endsWith('.ts') ||
        att.name.endsWith('.tsx') ||
        att.name.endsWith('.js') ||
        att.name.endsWith('.py') ||
        att.name.endsWith('.csv');

      if (isTextLike && att.textPreview) {
        parts.push({
          text: `[Attached File: ${att.name} (${att.mimeType})]\n\`\`\`\n${att.textPreview.slice(0, 48000)}\n\`\`\``,
        });
      } else if (att.dataBase64) {
        parts.push({
          inlineData: {
            mimeType: att.mimeType || 'application/octet-stream',
            data: att.dataBase64,
          },
        });
      }
    }
  }

  if (msg.content?.trim()) {
    parts.push({ text: msg.content });
  } else if (parts.length === 0) {
    parts.push({ text: 'Please analyze the attached file.' });
  }

  return parts;
}

function extractGroundingSources(response: unknown): ExtractedSource[] {
  const res = response as {
    candidates?: Array<{
      groundingMetadata?: {
        groundingChunks?: Array<{
          web?: { uri?: string; title?: string };
        }>;
      };
    }>;
  };
  const chunks = res?.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
  const seen = new Set<string>();
  const sources: ExtractedSource[] = [];

  for (const chunk of chunks) {
    const uri = chunk?.web?.uri;
    if (!uri || seen.has(uri)) continue;
    seen.add(uri);
    sources.push({
      title: chunk?.web?.title || uri,
      url: uri,
    });
  }
  return sources;
}

function extractUsage(response: unknown): {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
} | null {
  const res = response as {
    usageMetadata?: {
      promptTokenCount?: number;
      candidatesTokenCount?: number;
      totalTokenCount?: number;
    };
  };
  const meta = res?.usageMetadata;
  if (!meta) return null;
  const promptTokens = meta.promptTokenCount ?? 0;
  const completionTokens = meta.candidatesTokenCount ?? 0;
  const totalTokens = meta.totalTokenCount ?? promptTokens + completionTokens;
  return { promptTokens, completionTokens, totalTokens };
}

function isTransientError(err: unknown): boolean {
  const raw = err instanceof Error ? err.message : String(err);
  return (
    raw.includes('503') ||
    raw.includes('UNAVAILABLE') ||
    raw.includes('429') ||
    raw.includes('RESOURCE_EXHAUSTED') ||
    raw.includes('ECONNRESET') ||
    raw.includes('ETIMEDOUT') ||
    raw.includes('MODEL_TIMEOUT') ||
    raw.includes('500')
  );
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('MODEL_TIMEOUT: upstream call exceeded deadline')), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 1): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt < maxRetries && isTransientError(err)) {
        const delayMs = 450 * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

async function withModelFailover<T>(
  preferredModel: AllowedModel,
  run: (model: AllowedModel) => Promise<T>
): Promise<{ result: T; modelUsed: AllowedModel }> {
  try {
    const result = await withRetry(() => withTimeout(run(preferredModel), 15000), 1);
    return { result, modelUsed: preferredModel };
  } catch (err) {
    if (preferredModel !== 'gemini-3.1-flash-lite' && isTransientError(err)) {
      const fallbackResult = await withRetry(
        () => withTimeout(run('gemini-3.1-flash-lite'), 25000),
        1
      );
      return { result: fallbackResult, modelUsed: 'gemini-3.1-flash-lite' };
    }
    throw err;
  }
}

function formatErrorResponse(err: unknown): { status: number; message: string } {
  const raw = err instanceof Error ? err.message : String(err);

  // Extract nested JSON error message if present from SDK
  let cleanMessage = raw;
  let extractedCode: number | undefined;
  try {
    if (raw.trim().startsWith('{')) {
      const parsed = JSON.parse(raw) as { error?: { code?: number; message?: string } };
      if (parsed?.error?.message) {
        cleanMessage = parsed.error.message;
        extractedCode = parsed.error.code;
      }
    }
  } catch {
    // Keep raw string
  }

  if (cleanMessage.includes('GEMINI_API_KEY is not configured')) {
    return { status: 503, message: cleanMessage };
  }
  if (extractedCode === 403 || raw.includes('403') || raw.includes('PERMISSION_DENIED')) {
    return {
      status: 403,
      message: 'API permission denied. Verify GEMINI_API_KEY in Settings > Secrets.',
    };
  }
  if (extractedCode === 429 || raw.includes('429') || raw.includes('RESOURCE_EXHAUSTED')) {
    return {
      status: 429,
      message:
        'Rate limit or quota reached. Wait briefly or check your Gemini API quota in Settings > Secrets.',
    };
  }
  if (extractedCode === 503 || raw.includes('503') || raw.includes('UNAVAILABLE')) {
    return {
      status: 503,
      message: `${cleanMessage} Try switching to Gemini 3.1 Flash Lite or click Regenerate.`,
    };
  }
  if (extractedCode === 400 || raw.includes('400') || raw.includes('INVALID_ARGUMENT')) {
    return { status: 400, message: `Invalid request parameter: ${cleanMessage}` };
  }
  return { status: 500, message: cleanMessage || 'Internal Hawkins Laboratory server error.' };
}

function writeSseEvent(res: Response, event: string, payload: unknown): void {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function sanitizeSvgServer(svg: string): string {
  const trimmed = svg.trim();
  if (!trimmed.toLowerCase().includes('<svg')) return '';
  return trimmed
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/\son[a-z]+\s*=\s*(['"])[\s\S]*?\1/gi, '')
    .replace(/javascript:/gi, '');
}

async function startServer(): Promise<void> {
  const app = express();
  app.use(express.json({ limit: '25mb' }));
  app.use(express.urlencoded({ extended: true, limit: '25mb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    res.json({
      ok: true,
      apiKeyConfigured: isApiKeyConfigured(),
      provider: 'Google Gemini (Hawkins Lab Proxy)',
      endpoint: '/api/chat',
      checkedAt: Date.now(),
    });
  });

  app.post('/api/chat', async (req: Request, res: Response) => {
    const body = req.body as {
      messages?: IncomingMessage[];
      config?: IncomingConfig;
    };

    const messages = body?.messages ?? [];
    if (!Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: 'At least one message is required.' });
      return;
    }

    const cfg = body?.config ?? {};
    const requestedModel = resolveModel(cfg.model);
    const shouldStream = cfg.streaming !== false;

    const contents = messages.map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: buildPartsFromMessage(m),
    }));

    try {
      const ai = createAiClient();

      if (!shouldStream) {
        const { result: response, modelUsed } = await withModelFailover(
          requestedModel,
          (activeModel) =>
            ai.models.generateContent({
              model: activeModel,
              contents,
              config: buildModelConfig(activeModel, cfg),
            })
        );
        const sources = extractGroundingSources(response);
        const usage = extractUsage(response);
        res.json({
          text: response.text ?? '',
          sources,
          usage,
          model: modelUsed,
        });
        return;
      }

      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-transform');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      res.flushHeaders();
      res.write(': stream-open\n\n');

      let closed = false;
      const keepAliveTimer = setInterval(() => {
        if (!closed && !res.writableEnded) {
          res.write(': keep-alive\n\n');
        }
      }, 4000);
      res.on('close', () => {
        closed = true;
        clearInterval(keepAliveTimer);
      });

      const runChatStream = async (activeModel: AllowedModel) => {
        const stream = await withTimeout(
          ai.models.generateContentStream({
            model: activeModel,
            contents,
            config: buildModelConfig(activeModel, cfg),
          }),
          18000
        );

        const collectedSources = new Map<string, ExtractedSource>();
        let finalUsage: {
          promptTokens: number;
          completionTokens: number;
          totalTokens: number;
        } | null = null;
        let emittedDelta = false;

        try {
          for await (const chunk of stream) {
            if (closed) break;
            const delta = chunk.text ?? '';
            if (delta) {
              emittedDelta = true;
              writeSseEvent(res, 'delta', { text: delta });
            }
            for (const src of extractGroundingSources(chunk)) {
              if (!collectedSources.has(src.url)) {
                collectedSources.set(src.url, src);
              }
            }
            const chunkUsage = extractUsage(chunk);
            if (chunkUsage) {
              finalUsage = chunkUsage;
            }
          }
          if (!emittedDelta && !closed) {
            throw new Error('503 UNAVAILABLE empty chat stream');
          }
        } catch (streamErr) {
          if (!emittedDelta && activeModel !== 'gemini-3.1-flash-lite' && isTransientError(streamErr)) {
            throw streamErr;
          }
          throw streamErr;
        }

        return { collectedSources, finalUsage, activeModel };
      };

      let streamOutcome;
      try {
        try {
          streamOutcome = await runChatStream(requestedModel);
        } catch (primaryErr) {
          if (requestedModel !== 'gemini-3.1-flash-lite' && isTransientError(primaryErr) && !closed) {
            streamOutcome = await runChatStream('gemini-3.1-flash-lite');
          } else {
            throw primaryErr;
          }
        }

        if (!closed) {
          writeSseEvent(res, 'done', {
            sources: Array.from(streamOutcome.collectedSources.values()),
            usage: streamOutcome.finalUsage,
            model: streamOutcome.activeModel,
          });
          res.end();
        }
      } finally {
        clearInterval(keepAliveTimer);
      }
    } catch (err) {
      const formatted = formatErrorResponse(err);
      const message =
        cfg.webSearch && formatted.status === 429
          ? 'Google Search grounding quota reached on the active API key. Disable Web Search to retry directly, or check your Gemini API quota in Settings > Secrets.'
          : formatted.message;
      if (res.headersSent) {
        if (!res.writableEnded) {
          writeSseEvent(res, 'error', { message });
          res.end();
        }
      } else {
        res.status(formatted.status).json({ error: message });
      }
    }
  });

  app.post('/api/research', async (req: Request, res: Response) => {
    const body = req.body as {
      query?: string;
      depth?: 'standard' | 'exhaustive';
    };
    const query = body?.query?.trim() ?? '';
    const depth = body?.depth === 'exhaustive' ? 'exhaustive' : 'standard';

    if (!query) {
      res.status(400).json({ error: 'Research query is required.' });
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();
    res.write(': stream-open\n\n');

    let closed = false;
    const researchKeepAlive = setInterval(() => {
      if (!closed && !res.writableEnded) {
        res.write(': keep-alive\n\n');
      }
    }, 4000);
    res.on('close', () => {
      closed = true;
      clearInterval(researchKeepAlive);
    });

    try {
      const ai = createAiClient();

      // Stage 1: Gate Calibration (Decompose query into search vectors)
      writeSseEvent(res, 'stage', {
        id: 'calibrating',
        status: 'active',
        detail: 'Decomposing research topic into targeted search vectors...',
      });

      const subQueryCount = depth === 'exhaustive' ? 4 : 2;
      const { result: planResp, modelUsed: researchModel } = await withModelFailover(
        'gemini-4-hydrogen',
        (activeModel) =>
          ai.models.generateContent({
            model: activeModel,
            contents: `Break down the following research topic into ${subQueryCount} concise, distinct web search queries to gather factual, primary-source evidence:\n\nTopic: "${query}"`,
            config: {
              ...(activeModel === 'gemini-4-hydrogen'
                ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
                : {}),
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  subQueries: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: 'Concise search queries for web grounding',
                  },
                },
              },
            },
          })
      );

      let subQueries: string[] = [query];
      try {
        const parsed = JSON.parse((planResp.text ?? '{}').trim()) as { subQueries?: string[] };
        if (Array.isArray(parsed.subQueries) && parsed.subQueries.length > 0) {
          subQueries = parsed.subQueries.slice(0, subQueryCount);
        }
      } catch {
        subQueries = [query];
      }

      if (closed) return;
      writeSseEvent(res, 'subqueries', { subQueries });
      writeSseEvent(res, 'stage', {
        id: 'calibrating',
        status: 'done',
        detail: `Calibrated ${subQueries.length} search vectors`,
      });

      // Stage 2: Source Collection via real Google Search grounding
      writeSseEvent(res, 'stage', {
        id: 'collecting',
        status: 'active',
        detail: 'Executing live Google Search sweeps...',
      });

      const sourceMap = new Map<string, ExtractedSource>();
      const findingsPerQuery: Array<{ subQuery: string; summary: string }> = [];
      let groundingQuotaLimited = false;

      for (const sq of subQueries) {
        if (closed) return;
        let searchResp;
        try {
          const groundedOutcome = await withModelFailover(researchModel, (activeModel) =>
            ai.models.generateContent({
              model: activeModel,
              contents: `Research and summarize key verified facts, dates, metrics, and primary evidence for: ${sq}`,
              config: {
                ...(activeModel === 'gemini-4-hydrogen'
                  ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
                  : {}),
                tools: [{ googleSearch: {} }],
              },
            })
          );
          searchResp = groundedOutcome.result;
        } catch (searchErr) {
          const formattedSearch = formatErrorResponse(searchErr);
          if (formattedSearch.status === 429 || formattedSearch.status === 403) {
            groundingQuotaLimited = true;
            const ungroundedOutcome = await withModelFailover(researchModel, (activeModel) =>
              ai.models.generateContent({
                model: activeModel,
                contents: `Provide a thorough, factual intelligence brief summarizing established facts, key dates, and technical evidence for: ${sq}. Note clearly if live web verification is unavailable.`,
                config:
                  activeModel === 'gemini-4-hydrogen'
                    ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
                    : {},
              })
            );
            searchResp = ungroundedOutcome.result;
          } else {
            throw searchErr;
          }
        }

        const foundSources = extractGroundingSources(searchResp);
        for (const src of foundSources) {
          if (!sourceMap.has(src.url)) {
            const enriched: ExtractedSource = {
              ...src,
              snippet: `Retrieved via search vector: "${sq}"`,
            };
            sourceMap.set(src.url, enriched);
            writeSseEvent(res, 'source', enriched);
          }
        }
        findingsPerQuery.push({
          subQuery: sq,
          summary: (searchResp.text ?? '').slice(0, 3500),
        });
      }

      if (closed) return;
      const collectedSources = Array.from(sourceMap.values());
      writeSseEvent(res, 'stage', {
        id: 'collecting',
        status: 'done',
        detail: groundingQuotaLimited
          ? 'Google Search quota reached — compiled model-knowledge brief (0 external links)'
          : `Collected ${collectedSources.length} grounded web sources`,
      });

      // Stage 3: Cross-Reference Analysis
      writeSseEvent(res, 'stage', {
        id: 'analyzing',
        status: 'active',
        detail: 'Cross-referencing evidence and isolating verified claims...',
      });

      const sourceIndexText = collectedSources
        .map((s, idx) => `[${idx + 1}] ${s.title} (${s.url})`)
        .join('\n');

      const findingsText = findingsPerQuery
        .map((f, i) => `### Vector ${i + 1}: ${f.subQuery}\n${f.summary}`)
        .join('\n\n');

      const analysisNotes = groundingQuotaLimited
        ? [
            `Evaluated ${findingsPerQuery.length} research vectors using Hawkins Lab model synthesis.`,
            'Notice: Google Search grounding quota was reached on the active API key; live external URLs are unavailable.',
            'Dossier explicitly marks empirical limitations under Verification & Limitations.',
          ]
        : [
            `Evaluated ${findingsPerQuery.length} search vectors with live Google Search grounding.`,
            `Cataloged ${collectedSources.length} unique external citations for verification.`,
            'Ready for structured intelligence report synthesis.',
          ];
      writeSseEvent(res, 'analysis', { notes: analysisNotes });
      writeSseEvent(res, 'stage', {
        id: 'analyzing',
        status: 'done',
        detail: 'Cross-reference verification complete',
      });

      // Stage 4: Report Synthesis (streaming)
      writeSseEvent(res, 'stage', {
        id: 'synthesizing',
        status: 'active',
        detail: 'Generating classified Hawkins Lab dossier...',
      });

      const citationRule =
        collectedSources.length > 0
          ? 'Use ONLY the gathered findings and cite sources inline using numbered brackets like [1], [2] matching the numbered Verified Sources list below.'
          : 'Live web citations were unavailable on the active API quota for this sweep. Do NOT invent numbered brackets like [1] or fabricated URLs; clearly note empirical limitations under Verification & Limitations.';

      const synthesisPrompt = `You are the Lead Intelligence Analyst at Hawkins National Laboratory.
Write a clear, authoritative, deeply structured Markdown research report answering:
"${query}"

${citationRule}

## Verified Sources Index
${sourceIndexText || 'No external URLs returned; rely strictly on verified facts from the research pass without bracketed citations.'}

## Gathered Findings
${findingsText}

Requirements:
- Start with an **Executive Summary** section.
- Include **Key Findings**, **Detailed Analysis**, **Data & Evidence Comparison** (Markdown table if relevant), and **Verification & Limitations**.`;

      const runReportStream = async (activeModel: AllowedModel) => {
        const reportStream = await ai.models.generateContentStream({
          model: activeModel,
          contents: synthesisPrompt,
          config:
            activeModel === 'gemini-4-hydrogen'
              ? { thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM } }
              : {},
        });

        let usageOut: {
          promptTokens: number;
          completionTokens: number;
          totalTokens: number;
        } | null = null;
        let emittedDelta = false;

        for await (const chunk of reportStream) {
          if (closed) break;
          const delta = chunk.text ?? '';
          if (delta) {
            emittedDelta = true;
            writeSseEvent(res, 'report_delta', { text: delta });
          }
          const chunkUsage = extractUsage(chunk);
          if (chunkUsage) {
            usageOut = chunkUsage;
          }
        }
        if (!emittedDelta && !closed) {
          throw new Error('503 UNAVAILABLE empty synthesis stream');
        }
        return usageOut;
      };

      let finalUsage: {
        promptTokens: number;
        completionTokens: number;
        totalTokens: number;
      } | null = null;
      try {
        finalUsage = await runReportStream(researchModel);
      } catch (reportErr) {
        if (researchModel !== 'gemini-3.1-flash-lite' && isTransientError(reportErr) && !closed) {
          finalUsage = await runReportStream('gemini-3.1-flash-lite');
        } else {
          throw reportErr;
        }
      }

      if (!closed) {
        writeSseEvent(res, 'stage', {
          id: 'synthesizing',
          status: 'done',
          detail: 'Dossier synthesis complete',
        });
        writeSseEvent(res, 'done', {
          sources: collectedSources,
          usage: finalUsage,
        });
        res.end();
      }
    } catch (err) {
      const formatted = formatErrorResponse(err);
      if (!res.writableEnded) {
        writeSseEvent(res, 'error', { message: formatted.message });
        res.end();
      }
    } finally {
      clearInterval(researchKeepAlive);
    }
  });

  app.post('/api/generate-visual', async (req: Request, res: Response) => {
    const body = req.body as {
      prompt?: string;
      aspectRatio?: '16:9' | '1:1' | '3:4';
      style?: string;
    };

    const prompt = body?.prompt?.trim() ?? '';
    const aspectRatio =
      body?.aspectRatio === '1:1' || body?.aspectRatio === '3:4' ? body.aspectRatio : '16:9';
    const style = body?.style?.trim() || 'Upside Down Atmospheric';

    if (!prompt) {
      res.status(400).json({ error: 'Visual prompt is required.' });
      return;
    }

    const viewBox =
      aspectRatio === '1:1'
        ? '0 0 800 800'
        : aspectRatio === '3:4'
          ? '0 0 720 960'
          : '0 0 1280 720';

    try {
      const ai = createAiClient();
      const generateSvgAttempt = async (activeModel: AllowedModel) => {
        const resp = await ai.models.generateContent({
          model: activeModel,
          contents: `Design a richly layered, atmospheric, high-contrast vector SVG artwork for the following visual prompt.
Prompt: "${prompt}"
Style Direction: "${style}"
Required viewBox: "${viewBox}"

Visual guidelines:
- Use rich SVG gradients (<linearGradient>, <radialGradient>), layered silhouettes, geometric lighting, atmospheric particles/glows (<filter> with feGaussianBlur), and crisp composition fitting the exact viewBox "${viewBox}".
- Palette inspiration: deep black (#080808), dark burgundy (#240A0D), blood red (#E50914), warm incandescent amber, and cold slate blue accents.
- Output valid standalone <svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">...</svg> markup with NO <script> tags and NO external image URLs.`,
          config: {
            ...(activeModel === 'gemini-4-hydrogen'
              ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
              : {}),
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              required: ['title', 'description', 'svgMarkup'],
              properties: {
                title: { type: Type.STRING, description: 'Short evocative artwork title' },
                description: { type: Type.STRING, description: 'One-sentence visual description' },
                palette: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: '3 to 5 hex color codes used in the artwork',
                },
                svgMarkup: {
                  type: Type.STRING,
                  description: 'Complete valid <svg>...</svg> markup matching the requested viewBox',
                },
              },
            },
          },
        });

        const rawText = (resp.text ?? '').trim();
        let parsed: {
          title?: string;
          description?: string;
          palette?: string[];
          svgMarkup?: string;
        } = {};
        try {
          const stripped = rawText.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
          parsed = JSON.parse(stripped) as typeof parsed;
        } catch {
          const svgMatch = rawText.match(/<svg[\s\S]*?<\/svg>/i);
          if (svgMatch) {
            parsed = { svgMarkup: svgMatch[0] };
          }
        }

        let cleanSvg = sanitizeSvgServer(parsed.svgMarkup ?? '');
        if (!cleanSvg) {
          const fallbackMatch = rawText.match(/<svg[\s\S]*?<\/svg>/i);
          if (fallbackMatch) {
            cleanSvg = sanitizeSvgServer(fallbackMatch[0]);
          }
        }
        return { resp, parsed, cleanSvg };
      };

      let outcome = await withModelFailover('gemini-4-hydrogen', (m) => generateSvgAttempt(m));
      if (!outcome.result.cleanSvg) {
        const retryResult = await withRetry(() => generateSvgAttempt('gemini-3.1-flash-lite'), 1);
        outcome = { result: retryResult, modelUsed: 'gemini-3.1-flash-lite' };
      }

      if (!outcome.result.cleanSvg) {
        res.status(502).json({ error: 'Model did not return valid SVG artwork.' });
        return;
      }

      const { resp: response, parsed, cleanSvg } = outcome.result;
      res.json({
        title: parsed.title || 'Hawkins Visual Synthesis',
        description: parsed.description || prompt,
        palette: Array.isArray(parsed.palette) ? parsed.palette.slice(0, 6) : ['#080808', '#E50914'],
        svgMarkup: cleanSvg,
        usage: extractUsage(response),
      });
    } catch (err) {
      const formatted = formatErrorResponse(err);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  app.post('/api/transcribe', async (req: Request, res: Response) => {
    const body = req.body as {
      dataBase64?: string;
      mimeType?: string;
    };

    if (!body?.dataBase64) {
      res.status(400).json({ error: 'Audio payload is required.' });
      return;
    }

    try {
      const ai = createAiClient();
      const response = await ai.models.generateContent({
        model: 'gemini-3.5-transcribe',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: body.mimeType || 'audio/webm',
                data: body.dataBase64,
              },
            },
            { text: 'Transcribe this audio accurately into plain text.' },
          ],
        },
      });

      res.json({ text: (response.text ?? '').trim() });
    } catch (err) {
      const formatted = formatErrorResponse(err);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  app.post('/api/tts', async (req: Request, res: Response) => {
    const body = req.body as {
      text?: string;
      voiceName?: string;
    };
    const rawText = (body?.text ?? '').replace(/[#*`>_]/g, ' ').replace(/\s+/g, ' ').trim();
    if (!rawText) {
      res.status(400).json({ error: 'Text is required for voice synthesis.' });
      return;
    }

    const clipped = rawText.slice(0, 1800);
    const allowedVoices = new Set(['Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr']);
    const voiceName = body?.voiceName && allowedVoices.has(body.voiceName) ? body.voiceName : 'Charon';

    try {
      const ai = createAiClient('v1beta');
      const response = await withRetry(() =>
        ai.models.generateContent({
          model: 'gemini-3.8-flash-lite-tts',
          contents: [
            {
              role: 'user',
              parts: [
                {
                  text: clipped,
                  speechMetadata: {
                    style: 'Calm, crisp, authoritative 1980s laboratory narrator',
                  },
                },
              ],
            },
          ],
          config: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName },
              },
            },
          },
        })
      );

      const audioBase64 = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!audioBase64) {
        res.status(502).json({ error: 'No audio returned from TTS model.' });
        return;
      }

      res.json({
        audioBase64,
        mimeType: 'audio/wav',
      });
    } catch (err) {
      const formatted = formatErrorResponse(err);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  app.all('/api/*', (_req: Request, res: Response) => {
    res.status(404).json({ error: 'Unknown Hawkins API endpoint.' });
  });

  if (!IS_PROD) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(DIST_DIR));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(DIST_INDEX);
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(
      `STRANGER THINGS AI server (${IS_PROD ? 'production' : 'development'}) listening on http://0.0.0.0:${PORT}`
    );
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
