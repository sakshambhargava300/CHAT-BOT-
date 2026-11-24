import test from 'node:test';
import assert from 'node:assert/strict';
import {
  accumulateTokenUsage,
  computeEffectiveAmbientGain,
  createConversationTitle,
  createInitialResearchStages,
  estimateTokenCount,
  getActiveAlphabetIndices,
  isSamplingSupported,
  parseSseLine,
  sanitizeLabSettings,
  sanitizeSvgMarkup,
} from './labLogic';

test('isSamplingSupported enforces Gemini 4 vs 3.1 Flash Lite compatibility', () => {
  assert.equal(isSamplingSupported('gemini-4-hydrogen'), false);
  assert.equal(isSamplingSupported('gemini-3.1-flash-lite'), true);
});

test('sanitizeLabSettings clamps out-of-range tokens, sampling, and ambient volume', () => {
  const sanitized = sanitizeLabSettings({
    model: 'gemini-3.1-flash-lite',
    maxOutputTokens: 999999,
    temperature: 4.5,
    topP: 0,
    topK: 200,
    ambientVolume: 5,
    ambientSoundMuted: true,
  });

  assert.equal(sanitized.maxOutputTokens, 32768);
  assert.equal(sanitized.temperature, 2);
  assert.equal(sanitized.topP, 0.05);
  assert.equal(sanitized.topK, 64);
  assert.equal(sanitized.ambientVolume, 1);
  assert.equal(sanitized.ambientSoundMuted, true);
});

test('computeEffectiveAmbientGain returns 0 when muted and scales gently when unmuted', () => {
  assert.equal(computeEffectiveAmbientGain(true, 0.8), 0);
  assert.equal(computeEffectiveAmbientGain(false, 0.5), 0.16);
  assert.equal(computeEffectiveAmbientGain(false, 2), 0.32);
});

test('estimateTokenCount and accumulateTokenUsage track usage accurately', () => {
  assert.equal(estimateTokenCount(''), 0);
  assert.equal(estimateTokenCount('Hawkins Lab'), 3);

  const stats = accumulateTokenUsage(
    { promptTokens: 100, completionTokens: 50, totalTokens: 150, requestCount: 1 },
    { promptTokens: 40, completionTokens: 60 }
  );
  assert.equal(stats.promptTokens, 140);
  assert.equal(stats.completionTokens, 110);
  assert.equal(stats.totalTokens, 250);
  assert.equal(stats.requestCount, 2);
});

test('createConversationTitle normalizes whitespace and truncates cleanly', () => {
  assert.equal(createConversationTitle('   '), 'Untitled Transmission');
  assert.equal(createConversationTitle('  What   is the Upside Down? '), 'What is the Upside Down?');
  const longTitle = createConversationTitle(
    'Analyze the electromagnetic anomalies recorded near Hawkins National Laboratory sector four'
  );
  assert.ok(longTitle.endsWith('...'));
  assert.ok(longTitle.length <= 46);
});

test('createInitialResearchStages returns 4 sequential pending stages', () => {
  const stages = createInitialResearchStages();
  assert.equal(stages.length, 4);
  assert.deepEqual(
    stages.map((s) => s.id),
    ['calibrating', 'collecting', 'analyzing', 'synthesizing']
  );
  assert.ok(stages.every((s) => s.status === 'pending'));
});

test('getActiveAlphabetIndices maps trailing A-Z characters to 0-25 indices', () => {
  const indices = getActiveAlphabetIndices('RUN!');
  assert.deepEqual(indices, [13, 20, 17]);
});

test('parseSseLine parses event and data lines safely', () => {
  assert.deepEqual(parseSseLine('event: stage'), { event: 'stage' });
  assert.deepEqual(parseSseLine('data: {"ok":true}'), { data: '{"ok":true}' });
  assert.equal(parseSseLine('   '), null);
});

test('sanitizeSvgMarkup strips script tags and event handlers', () => {
  const dirty = '<svg viewBox="0 0 10 10" onload="alert(1)"><script>evil()</script><rect width="10" height="10"/></svg>';
  const clean = sanitizeSvgMarkup(dirty);
  assert.ok(!clean.includes('<script'));
  assert.ok(!clean.includes('onload'));
  assert.ok(clean.includes('<rect'));
});
