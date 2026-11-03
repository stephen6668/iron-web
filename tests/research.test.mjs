import test from 'node:test';
import assert from 'node:assert/strict';
import { createWebResearch } from '../server/research.mjs';

const answer = (overrides = {}) => ({ candidates: [{
  content: { parts: [{ text: 'A concise answer based on the cited source.' }] },
  groundingMetadata: {
    groundingChunks: [{ web: { uri: 'https://example.com/article', title: 'A source' } }],
    webSearchQueries: ['example research'],
  },
  ...overrides,
}] });
const jsonResponse = body => new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } });

test('research uses the fixed native Gemini endpoint and returns real grounded sources', async () => {
  let calls = 0;
  const research = createWebResearch({ apiKey: 'secret-key', fetchImpl: async (url, init) => {
    calls++;
    assert.equal(url, 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent');
    assert.equal(init.method, 'POST');
    assert.equal(init.redirect, 'error');
    assert.equal(init.headers['x-goog-api-key'], 'secret-key');
    assert.ok(init.signal instanceof AbortSignal);
    const body = JSON.parse(init.body);
    assert.deepEqual(body.contents, [{ role: 'user', parts: [{ text: 'What is the evidence?' }] }]);
    assert.deepEqual(body.tools, [{ google_search: {} }]);
    assert.deepEqual(body.generationConfig, { temperature: 0.2, maxOutputTokens: 3000 });
    assert.match(body.systemInstruction.parts[0].text, /uncertainty/i);
    assert.match(body.systemInstruction.parts[0].text, /read-only/i);
    assert.match(body.systemInstruction.parts[0].text, /Answer in German/);
    return jsonResponse(answer());
  } });
  assert.deepEqual(await research('  What is the evidence?  '), {
    ok: true,
    summary: 'A concise answer based on the cited source.',
    sources: [{ title: 'A source', url: 'https://example.com/article' }],
    queries: ['example research'],
    grounded: true,
  });
  assert.equal(calls, 1);
});

test('missing key and invalid model configuration return 503 without network requests', async () => {
  let calls = 0;
  const fetchImpl = async () => { calls++; throw Error('must not fetch'); };
  for (const configuration of [
    { apiKey: '' },
    { apiKey: '   ' },
    { apiKey: 'secret', model: '../../elsewhere' },
    { apiKey: 'secret', model: 'https://attacker.test' },
  ]) {
    const result = await createWebResearch({ ...configuration, fetchImpl })('a valid question');
    assert.equal(result.ok, false);
    assert.equal(result.status, 503);
    assert.equal(result.grounded, false);
  }
  assert.equal(calls, 0);
});

test('invalid research queries return 400 without network requests', async () => {
  let calls = 0;
  const research = createWebResearch({ apiKey: 'secret', fetchImpl: async () => { calls++; } });
  for (const query of ['', '   ', null, {}, 42, 'a'.repeat(2001)]) {
    const result = await research(query);
    assert.equal(result.ok, false);
    assert.equal(result.status, 400);
  }
  assert.equal(calls, 0);
});

test('network and provider errors are sanitized and never expose secrets', async () => {
  for (const fetchImpl of [
    async () => { throw Error('request failed with secret-key and private-provider-detail'); },
    async () => new Response('secret-key private-provider-detail', { status: 401 }),
    async () => new Response('{"error":"secret-key private-provider-detail"}'),
  ]) {
    const result = await createWebResearch({ apiKey: 'secret-key', fetchImpl })('research question');
    assert.equal(result.ok, false);
    assert.equal(result.status, 502);
    assert.equal(result.grounded, false);
    assert.doesNotMatch(JSON.stringify(result), /secret-key|private-provider-detail/);
  }
});

test('text without actual grounding cannot be reported as verified research', async () => {
  for (const document of [
    answer({ groundingMetadata: undefined }),
    answer({ groundingMetadata: { webSearchQueries: ['a search query'] } }),
    answer({ groundingMetadata: { groundingChunks: [{ retrievedContext: { uri: 'https://example.com/article', title: 'Not web grounding' } }] } }),
    answer({ content: { parts: [{ text: '   ' }] } }),
    answer({ content: { parts: [{ text: 'Hidden reasoning', thought: true }] } }),
  ]) {
    const result = await createWebResearch({ apiKey: 'secret', fetchImpl: async () => jsonResponse(document) })('question');
    assert.equal(result.status, 502);
    assert.equal(result.grounded, false);
    assert.match(result.error, /nicht verifiziert/i);
    assert.equal(result.summary, undefined);
    assert.equal(result.sources, undefined);
  }
});

test('grounding requires HTTPS links without credentials and nonempty titles', async () => {
  const invalid = [
    { uri: 'http://example.com/article', title: 'HTTP' },
    { uri: 'javascript:alert(1)', title: 'Script' },
    { uri: 'https://user:password@example.com/article', title: 'Credentials' },
    { uri: 'https://example.com:8443/article', title: 'Other port' },
    { uri: 'https://example.com/\narticle', title: 'Control character' },
    { uri: 'https://example.com/article', title: '   ' },
  ];
  const result = await createWebResearch({ apiKey: 'secret', fetchImpl: async () => jsonResponse(answer({
    groundingMetadata: { groundingChunks: invalid.map(web => ({ web })) },
  })) })('question');
  assert.equal(result.status, 502);
  assert.equal(result.grounded, false);

  const mixed = await createWebResearch({ apiKey: 'secret', fetchImpl: async () => jsonResponse(answer({
    groundingMetadata: { groundingChunks: [
      ...invalid.map(web => ({ web })),
      { web: { uri: 'https://example.com/valid', title: ' Valid ' } },
      { web: { uri: 'https://example.com/valid', title: 'Duplicate' } },
    ] },
  })) })('question');
  assert.deepEqual(mixed.sources, [{ title: 'Valid', url: 'https://example.com/valid' }]);
  assert.equal(mixed.queries, undefined);
});

test('summary and grounding must belong to the same candidate', async () => {
  const document = { candidates: [
    { content: { parts: [{ text: 'Unsupported answer' }] } },
    { content: { parts: [] }, groundingMetadata: answer().candidates[0].groundingMetadata },
  ] };
  const result = await createWebResearch({ apiKey: 'secret', fetchImpl: async () => jsonResponse(document) })('question');
  assert.equal(result.status, 502);
  assert.equal(result.grounded, false);
});

test('both declared and streamed oversized responses fail at 512 KiB', async () => {
  let cancelled = false;
  for (const fetchImpl of [
    async () => new Response('{}', { headers: { 'content-length': String(512 * 1024 + 1) } }),
    async () => new Response(new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array(300 * 1024));
        controller.enqueue(new Uint8Array(300 * 1024));
      },
      cancel() { cancelled = true; },
    })),
  ]) {
    const result = await createWebResearch({ apiKey: 'secret', fetchImpl })('question');
    assert.equal(result.ok, false);
    assert.equal(result.status, 502);
    assert.match(result.error, /Größenbegrenzung/i);
  }
  assert.equal(cancelled, true);
});

test('the timeout bounds fetch and response streaming and aborts the request', async () => {
  for (const mode of ['fetch', 'body']) {
    let signal;
    let cancelled = false;
    const research = createWebResearch({ apiKey: 'secret', fetchImpl: async (_url, init) => {
      signal = init.signal;
      if (mode === 'fetch') return new Promise(() => {});
      return new Response(new ReadableStream({ cancel() { cancelled = true; } }));
    } });
    const result = await research('question', { timeoutMs: 10 });
    assert.equal(result.status, 502);
    assert.equal(result.grounded, false);
    assert.match(result.error, /Zeitlimit/i);
    assert.equal(signal.aborted, true);
    if (mode === 'body') assert.equal(cancelled, true);
  }
});


test('quota exhaustion and provider overload remain explicit without automatic retry',async()=>{
 for(const [status,pattern] of [[429,/Kontingent|kontingent/],[503,/ausgelastet/]]){
  let calls=0;const research=createWebResearch({apiKey:'test-key',fetchImpl:async()=>{calls++;return new Response('{}',{status});}});
  const result=await research('Aktuelle Quellen bitte');assert.equal(result.ok,false);assert.equal(result.status,status);assert.match(result.error,pattern);assert.equal(result.grounded,false);assert.equal(calls,1);
 }
});
