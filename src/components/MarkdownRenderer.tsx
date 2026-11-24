import { Check, Copy } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MarkdownRendererProps {
  content: string;
}

function CodeBlock({
  className,
  children,
}: {
  className?: string;
  children?: ReactNode;
}) {
  const [copied, setCopied] = useState(false);
  const raw = String(children ?? '').replace(/\n$/, '');
  const match = /language-([\w-]+)/.exec(className || '');
  const language = match?.[1] || 'text';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(raw);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard fallback not needed
    }
  };

  return (
    <div className="my-3 overflow-hidden rounded-lg border border-white/12 bg-[#070709]">
      <div className="flex items-center justify-between border-b border-white/10 bg-[#120B0D] px-3 py-1.5">
        <span className="font-hawkins-mono text-[11px] tracking-wider text-zinc-400 uppercase">
          {language}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          aria-label={`Copy ${language} code`}
          className="font-hawkins-mono inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-[11px] text-zinc-300 transition-colors hover:bg-white/10 hover:text-white"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3 text-emerald-400" />
              Copied
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" />
              Copy
            </>
          )}
        </button>
      </div>
      <pre className="overflow-x-auto p-3.5 text-[13px] leading-relaxed text-zinc-200">
        <code className="font-hawkins-mono">{raw}</code>
      </pre>
    </div>
  );
}

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return (
    <div className="hawkins-prose space-y-3 text-[15px] leading-7 text-zinc-200">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="font-hawkins-display mt-4 mb-2 border-b border-white/10 pb-1.5 text-xl font-bold text-[#F7ECEC]">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="font-hawkins-display mt-4 mb-2 text-lg font-bold text-[#F5D6D8]">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="mt-3 mb-1.5 text-base font-semibold text-white">{children}</h3>
          ),
          p: ({ children }) => <p className="leading-7 text-zinc-200">{children}</p>,
          ul: ({ children }) => (
            <ul className="my-2 list-disc space-y-1.5 pl-5 text-zinc-200">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="my-2 list-decimal space-y-1.5 pl-5 text-zinc-200">{children}</ol>
          ),
          li: ({ children }) => <li className="leading-7">{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className="my-3 rounded-lg border border-[#E50914]/25 bg-[#1B090C]/65 px-4 py-2.5 text-sm text-zinc-300 italic">
              {children}
            </blockquote>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#FF5C66] underline decoration-[#E50914]/45 underline-offset-4 transition-colors hover:text-[#FF8A91]"
            >
              {children}
            </a>
          ),
          table: ({ children }) => (
            <div className="my-3 overflow-x-auto rounded-lg border border-white/12">
              <table className="w-full border-collapse text-left text-sm">{children}</table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-[#180C0F] text-xs tracking-wider text-zinc-300 uppercase">
              {children}
            </thead>
          ),
          th: ({ children }) => (
            <th className="border-b border-white/10 px-3 py-2 font-medium">{children}</th>
          ),
          td: ({ children }) => (
            <td className="border-b border-white/6 px-3 py-2 text-zinc-300">{children}</td>
          ),
          code: ({ className, children }) => {
            const isBlock = Boolean(className) || String(children ?? '').includes('\n');
            if (!isBlock) {
              return (
                <code className="font-hawkins-mono rounded border border-white/10 bg-[#191114] px-1.5 py-0.5 text-[13px] text-[#FF8A91]">
                  {children}
                </code>
              );
            }
            return <CodeBlock className={className}>{children}</CodeBlock>;
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
