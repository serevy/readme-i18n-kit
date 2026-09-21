import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { createGuardedFetch, retryAfterMs, ENDPOINT, MODEL } from './translation-fetch-guard.mjs';

const init = (extra = {}) => ({ method: 'POST', body: JSON.stringify({ model: MODEL, messages: [] }), ...extra });
const ok = () => new Response('{}', { status: 200 });
function fixture(respond = ok, extra = {}) {
  let time = 0;
  const calls = [];
  const guarded = createGuardedFetch(async (url, options) => {
    calls.push({ at: time, url, options });
    return respond(calls.length, options);
  }, { now: () => time, wallNow: () => time,
    wait: async (ms, signal) => { signal?.throwIfAborted(); time += ms; }, ...extra });
  return { guarded, calls };
}

test('concurrent callers start at least eight seconds apart', async () => {
  const { guarded, calls } = fixture();
  await Promise.all(Array.from({ length: 12 }, () => guarded(ENDPOINT, init())));
  assert.deepEqual(calls.map(c => c.at), Array.from({ length: 12 }, (_, n) => n * 8000));
  for (const c of calls) assert.ok(calls.filter(x => x.at >= c.at && x.at < c.at + 60000).length <= 8);
});
test('a caller retry after 500 shares the same gate', async () => {
  const { guarded, calls } = fixture(n => n === 1 ? new Response('{}', { status: 500 }) : ok());
  assert.equal((await guarded(ENDPOINT, init())).status, 500);
  await guarded(ENDPOINT, init());
  assert.deepEqual(calls.map(c => c.at), [0, 8000]);
});
test('glossary retranslation and preflight share the same gate', async () => {
  const { guarded, calls } = fixture();
  for (let i = 0; i < 3; i++) await guarded(ENDPOINT, init());
  assert.deepEqual(calls.map(c => c.at), [0, 8000, 16000]);
});
test('network failures also consume a request slot', async () => {
  const { guarded, calls } = fixture(n => { if (n === 1) throw new Error('offline'); return ok(); });
  await assert.rejects(guarded(ENDPOINT, init()), /offline/);
  await guarded(ENDPOINT, init());
  assert.deepEqual(calls.map(c => c.at), [0, 8000]);
});
test('429 cooldown applies to already queued requests', async () => {
  const { guarded, calls } = fixture(n => n === 1 ? new Response('{}', {
    status: 429, headers: { 'retry-after': '65' },
  }) : ok());
  await Promise.all([guarded(ENDPOINT, init()), guarded(ENDPOINT, init())]);
  assert.deepEqual(calls.map(c => c.at), [0, 65000]);
});
test('429 without Retry-After waits sixty seconds', async () => {
  const { guarded, calls } = fixture(n => n === 1 ? new Response('{}', { status: 429 }) : ok());
  await guarded(ENDPOINT, init()); await guarded(ENDPOINT, init());
  assert.deepEqual(calls.map(c => c.at), [0, 60000]);
});
test('Retry-After supports seconds, dates, and invalid values', () => {
  assert.equal(retryAfterMs('2.5', 0), 2500);
  assert.equal(retryAfterMs('Thu, 01 Jan 1970 00:02:00 GMT', 0), 120000);
  assert.equal(retryAfterMs('invalid', 0), undefined);
  assert.equal(retryAfterMs(null, 0), undefined);
  assert.equal(retryAfterMs('-1', 0), undefined);
});
test('reject relay, alternate protocol, query and non-POST before sending', async () => {
  const { guarded, calls } = fixture();
  for (const url of ['https://relay.invalid/v1/chat/completions', ENDPOINT.replace('https:', 'http:'), ENDPOINT + '?x=1']) {
    await assert.rejects(guarded(url, init()), /only POST/);
  }
  await assert.rejects(guarded(ENDPOINT, { method: 'GET' }), /only POST/);
  assert.equal(calls.length, 0);
});
test('reject unexpected model or paid tier before sending', async () => {
  const { guarded, calls } = fixture();
  await assert.rejects(guarded(ENDPOINT, init({ body: JSON.stringify({ model: 'other' }) })), /unexpected model/);
  await assert.rejects(guarded(ENDPOINT, init({ body: JSON.stringify({ model: MODEL, service_tier: 'priority' }) })), /Standard/);
  assert.equal(calls.length, 0);
});
test('force Standard and reject HTTP redirect following', async () => {
  const { guarded, calls } = fixture();
  await guarded(ENDPOINT, init({ redirect: 'follow' }));
  assert.equal(calls[0].options.redirect, 'error');
  assert.equal(JSON.parse(calls[0].options.body).service_tier, 'default');
});
test('request cap stops all later attempts without sending', async () => {
  const { guarded, calls } = fixture(ok, { maxRequests: 2 });
  await guarded(ENDPOINT, init()); await guarded(ENDPOINT, init());
  for (let i = 0; i < 2; i++) await assert.rejects(guarded(ENDPOINT, init()), /request cap/);
  assert.equal(calls.length, 2);
});
test('authentication failure stops a queued call', async () => {
  const { guarded, calls } = fixture(() => new Response('{}', { status: 401 }));
  const results = await Promise.allSettled([guarded(ENDPOINT, init()), guarded(ENDPOINT, init())]);
  assert.equal(results[0].value.status, 401);
  assert.equal(results[1].status, 'rejected');
  assert.equal(calls.length, 1);
});
test('cancelled queued request is not sent', async () => {
  const { guarded, calls } = fixture();
  const cancel = new AbortController();
  const pending = guarded(ENDPOINT, init({ signal: cancel.signal }));
  cancel.abort();
  await assert.rejects(pending, { name: 'AbortError' });
  assert.equal(calls.length, 0);
  await guarded(ENDPOINT, init());
  assert.equal(calls[0].at, 0);
});
test('invalid configuration fails immediately', () => {
  assert.throws(() => createGuardedFetch(ok, { intervalMs: 0 }), TypeError);
  assert.throws(() => createGuardedFetch(ok, { maxRequests: 0 }), TypeError);
});

test('preload installs the guard before application code (fake transport)', () => {
  const moduleUrl = new URL('./translation-fetch-guard.mjs', import.meta.url).href;
  const script = `globalThis.fetch = async (_url, opts) => {
    if (JSON.parse(opts.body).service_tier !== 'default') throw new Error('missing tier');
    return new Response('{}');
  };
  await import(${JSON.stringify(moduleUrl)});
  await fetch(${JSON.stringify(ENDPOINT)}, ${JSON.stringify(init())});`;
  const run = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
    env: { README_I18N_FETCH_GUARD: '1' }, encoding: 'utf8',
  });
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stderr, /request 1\/60/);
});
test('preload accepts an explicit per-run request cap', () => {
  const moduleUrl = new URL('./translation-fetch-guard.mjs', import.meta.url).href;
  const script = `globalThis.fetch = async () => new Response('{}');
  await import(${JSON.stringify(moduleUrl)});
  await fetch(${JSON.stringify(ENDPOINT)}, ${JSON.stringify(init())});`;
  const run = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
    env: { README_I18N_FETCH_GUARD: '1', README_I18N_MAX_REQUESTS: '80' }, encoding: 'utf8',
  });
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stderr, /request 1\/80/);
});

test('abort while pacing cancels before the transport is called', async () => {
  const cancel = new AbortController();
  const { guarded, calls } = fixture(ok, { wait: async (_ms, signal) => {
    cancel.abort(); signal.throwIfAborted();
  } });
  await guarded(ENDPOINT, init());
  await assert.rejects(guarded(ENDPOINT, init({ signal: cancel.signal })), { name: 'AbortError' });
  assert.equal(calls.length, 1);
});
