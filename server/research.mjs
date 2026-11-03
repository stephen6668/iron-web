const MAX_RESPONSE_BYTES = 512 * 1024;
const MODEL_NAME = /^[a-zA-Z0-9._-]+$/;
const SYSTEM_INSTRUCTION = 'Research the user question with Google Search and provide a concise, factual answer with sources. Answer in German unless the user explicitly asks for another language. Keep claims within the evidence found, distinguish facts from estimates, and clearly state uncertainty or missing evidence. Never invent facts, citations, or verification. This is a read-only research task: do not create, change, or delete records, send messages, execute commands, or perform other writes.';

class ResearchError extends Error {
  constructor(reason) {
    super(reason);
    this.reason = reason;
  }
}

function failure(status, error) {
  return { ok: false, status, error, grounded: false };
}

function sourceURL(value) {
  if (typeof value !== 'string' || value.length > 4096 || /[\u0000-\u0020\u007f]/u.test(value)) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || !url.hostname || url.username || url.password || (url.port && url.port !== '443')) return null;
    return url.href;
  } catch {
    return null;
  }
}

function groundedResult(document) {
  if (!Array.isArray(document?.candidates)) return null;
  for (const candidate of document.candidates) {
    const parts = candidate?.content?.parts;
    const summary = Array.isArray(parts) ? parts.filter(part => typeof part?.text === 'string' && !part.thought).map(part => part.text).join('\n').trim() : '';
    if (!summary) continue;
    const metadata = candidate?.groundingMetadata;
    const chunks = metadata?.groundingChunks;
    if (!Array.isArray(chunks)) continue;
    const seen = new Set();
    const sources = [];
    for (const chunk of chunks) {
      const url = sourceURL(chunk?.web?.uri);
      const title = typeof chunk?.web?.title === 'string' ? chunk.web.title.trim().slice(0, 500) : '';
      if (!url || !title || seen.has(url)) continue;
      seen.add(url);
      sources.push({ title, url });
    }
    if (!sources.length) continue;
    const queries = Array.isArray(metadata.webSearchQueries)
      ? [...new Set(metadata.webSearchQueries.filter(query => typeof query === 'string' && query.trim() && query.length <= 2000).map(query => query.trim()))]
      : [];
    return { ok: true, summary, sources, ...(queries.length ? { queries } : {}), grounded: true };
  }
  return null;
}

function cancelBody(body) {
  try { Promise.resolve(body?.cancel?.()).catch(() => {}); } catch { /* Cancellation must not replace the safe error. */ }
}

async function readBounded(response, signal) {
  if (Number(response.headers?.get?.('content-length')) > MAX_RESPONSE_BYTES) {
    cancelBody(response.body);
    throw new ResearchError('oversized');
  }
  if (!response.body?.getReader) throw new ResearchError('invalid');
  const reader = response.body.getReader();
  const cancel = () => cancelBody(reader);
  signal.addEventListener('abort', cancel, { once: true });
  const chunks = [];
  let bytes = 0;
  try {
    while (true) {
      if (signal.aborted) throw new ResearchError('timeout');
      const { value, done } = await reader.read();
      if (signal.aborted) throw new ResearchError('timeout');
      if (done) break;
      if (!(value instanceof Uint8Array)) throw new ResearchError('invalid');
      bytes += value.byteLength;
      if (bytes > MAX_RESPONSE_BYTES) throw new ResearchError('oversized');
      chunks.push(value);
    }
    return Buffer.concat(chunks, bytes).toString('utf8');
  } catch (error) {
    cancel();
    throw error;
  } finally {
    signal.removeEventListener('abort', cancel);
    reader.releaseLock();
  }
}

/** Google Search grounded, read-only web research through the native Gemini API. */
export function createWebResearch({ apiKey, model = 'gemini-3.5-flash', fetchImpl = fetch } = {}) {
  const key = typeof apiKey === 'string' ? apiKey.trim() : '';
  const validModel = typeof model === 'string' && MODEL_NAME.test(model);
  const endpoint = validModel ? `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent` : null;

  return async function research(query, { timeoutMs = 35000 } = {}) {
    if (typeof query !== 'string' || !query.trim() || query.length > 2000) {
      return failure(400, 'Die Recherchefrage muss zwischen 1 und 2000 Zeichen enthalten.');
    }
    if (!key || !endpoint || typeof fetchImpl !== 'function') {
      return failure(503, 'Die Webrecherche ist noch nicht eingerichtet.');
    }
    const controller = new AbortController();
    const duration = Number.isFinite(timeoutMs) && timeoutMs > 0 ? Math.min(timeoutMs, 120000) : 35000;
    let timer;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new ResearchError('timeout'));
      }, duration);
    });
    try {
      const request = async () => {
        const response = await fetchImpl(endpoint, {
          method: 'POST',
          redirect: 'error',
          signal: controller.signal,
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
            contents: [{ role: 'user', parts: [{ text: query.trim() }] }],
            tools: [{ google_search: {} }],
            generationConfig: { temperature: 0.2, maxOutputTokens: 3000 },
          }),
        });
        if (!response?.ok) {
          cancelBody(response?.body);
          throw new ResearchError(response.status===429?'quota':response.status===503?'overloaded':'provider');
        }
        return JSON.parse(await readBounded(response, controller.signal));
      };
      const document = await Promise.race([request(), timeout]);
      return groundedResult(document) || failure(502, 'Webrecherche nicht verifiziert: Es wurde keine brauchbare Antwort mit belegten Webquellen zurückgegeben.');
    } catch (error) {
      if(error instanceof ResearchError&&error.reason==='quota')return failure(429,'Google hat das verfügbare Recherchekontingent ausgeschöpft. Kontingent und Abrechnung im Gemini-Konto prüfen; keine Recherche ausgeführt.');
      if(error instanceof ResearchError&&error.reason==='overloaded')return failure(503,'Google ist momentan ausgelastet. Es liegt kein verifiziertes Rechercheergebnis vor.');
      if (error instanceof ResearchError && error.reason === 'timeout') {
        return failure(502, 'Zeitlimit der Webrecherche überschritten; es liegt kein verifiziertes Rechercheergebnis vor.');
      }
      if (error instanceof ResearchError && error.reason === 'oversized') {
        return failure(502, 'Die Antwort der Webrecherche überschreitet die Größenbegrenzung; es liegt kein verifiziertes Rechercheergebnis vor.');
      }
      return failure(502, 'Die Webrecherche ist derzeit nicht verfügbar; es liegt kein verifiziertes Rechercheergebnis vor.');
    } finally {
      clearTimeout(timer);
    }
  };
}
