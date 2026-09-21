import { setTimeout as sleep } from 'node:timers/promises';

export const ENDPOINT = 'https://api.openai.com/v1/chat/completions';
export const MODEL = 'gpt-5.6-luna';

// A guard for the pinned translator's global-fetch path, NOT a security sandbox.
// Keep the queue at the actual HTTP boundary so glossary retries and preflight
// requests cannot bypass pacing. No payload, header, or API key is logged here.
const denied = (message) => Object.assign(new Error(`i18n guard: ${message}`), {
  // The upstream pipeline treats 403 as non-retryable and cancels pending work.
  status: 403,
});

export function retryAfterMs(value, wallNow = Date.now()) {
  if (!value?.trim()) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return seconds >= 0 ? seconds * 1000 : undefined;
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, date - wallNow) : undefined;
}

export function createGuardedFetch(fetchImpl, {
  intervalMs = 8000,
  maxRequests = 60,
  now = () => performance.now(),
  wallNow = () => Date.now(),
  wait = (ms, signal) => sleep(ms, undefined, { signal }),
  onRequest = () => {},
} = {}) {
  if (typeof fetchImpl !== 'function' || !Number.isFinite(intervalMs) || intervalMs <= 0 ||
      !Number.isSafeInteger(maxRequests) || maxRequests <= 0) {
    throw new TypeError('Invalid translation fetch guard configuration');
  }
  let queue = Promise.resolve();
  let nextStart = 0;
  let attempts = 0;
  let stopped;

  return (input, init) => {
    const task = queue.then(async () => {
      if (stopped) throw stopped;
      const request = new Request(input, init);
      const signal = request.signal;
      signal.throwIfAborted();
      if (request.url !== ENDPOINT || request.method !== 'POST') {
        throw denied('only POST to the configured OpenAI chat endpoint is allowed');
      }
      let payload;
      try { payload = JSON.parse(await request.clone().text()); }
      catch { throw denied('request body must be JSON'); }
      if (payload?.model !== MODEL) throw denied('unexpected model');
      if (payload.service_tier !== undefined && payload.service_tier !== 'default') {
        throw denied('only the Standard service tier is allowed');
      }
      if (attempts >= maxRequests) {
        stopped = denied('per-run request cap reached; inspect results before a new run');
        throw stopped;
      }
      // Waiting is abortable. A cancelled request consumes neither a slot nor
      // request budget; a failed network/HTTP attempt DOES consume both.
      while (now() < nextStart) await wait(nextStart - now(), signal);
      signal.throwIfAborted();
      attempts += 1;
      nextStart = now() + intervalMs;
      onRequest(attempts, maxRequests);
      const headers = new Headers(request.headers);
      headers.delete('content-length');
      const response = await fetchImpl(request.url, {
        method: 'POST', headers, signal, redirect: 'error',
        body: JSON.stringify({ ...payload, service_tier: 'default' }),
      });
      if (response.status === 429) {
        const delay = retryAfterMs(response.headers.get('retry-after'), wallNow()) ?? 60000;
        nextStart = Math.max(nextStart, now() + delay);
      }
      if (response.status === 401 || response.status === 403) {
        stopped = denied('authentication or permission failure; no further requests sent');
      }
      return response;
    });
    // One failed request must not poison the pacing queue. Upstream owns retries.
    queue = task.then(() => undefined, () => undefined);
    return task;
  };
}

// Imported into the translator process BEFORE its CLI modules are evaluated.
// Unit tests leave this flag unset and inject a fake fetch and clock instead.
if (process.env.README_I18N_FETCH_GUARD === '1') {
  const configuredMax = process.env.README_I18N_MAX_REQUESTS;
  const maxRequests = configuredMax === undefined ? 60 : Number(configuredMax);
  globalThis.fetch = createGuardedFetch(globalThis.fetch.bind(globalThis), {
    maxRequests,
    onRequest: (n, cap) => console.error(`[i18n-guard] request ${n}/${cap}`),
  });
}
