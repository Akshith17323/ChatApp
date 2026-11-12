import assert from 'node:assert/strict';
import test, { afterEach, beforeEach } from 'node:test';
import { apiFetch, setApiConfig } from '../src/api/config.ts';

const CONFIG = { baseUrl: 'https://chat.test', username: 'tester', password: 'secret' };

beforeEach(() => setApiConfig(CONFIG));
afterEach(() => setApiConfig({ ...CONFIG, username: '', password: '' }));

test('keeps message endpoints, JSON payloads, and the backend Basic auth format unchanged', async (t) => {
  const payload = { conversation_id: 'chat-1', content: 'Hello' };
  const fetch = t.mock.method(globalThis, 'fetch', async () =>
    new Response(JSON.stringify({ id: 'message-1' }), {
      status: 201, headers: { 'Content-Type': 'application/json' },
    })
  );
  assert.deepEqual(await apiFetch('/message', {
    method: 'POST', body: JSON.stringify(payload),
  }), { id: 'message-1' });
  assert.equal(fetch.mock.callCount(), 1);
  const [url, options] = fetch.mock.calls[0].arguments;
  assert.equal(url, 'https://chat.test/message');
  assert.equal(options.headers.Authorization, 'Basic tester:secret');
  assert.equal(options.headers['Content-Type'], 'application/json');
  assert.equal(options.body, JSON.stringify(payload));
});

test('times out a stalled connection without retrying the request', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const fetch = t.mock.method(globalThis, 'fetch', (_url, { signal }) =>
    new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
    })
  );
  const rejected = assert.rejects(apiFetch('/message', { timeoutMs: 50 }), /Connection timed out/);
  t.mock.timers.tick(50);
  await rejected;
  assert.equal(fetch.mock.callCount(), 1);
});

test('keeps the timeout active when response headers arrive but the body stalls', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let bodyStarted;
  const readingBody = new Promise((resolve) => { bodyStarted = resolve; });
  t.mock.method(globalThis, 'fetch', async (_url, { signal }) => ({
    ok: true,
    status: 201,
    headers: new Headers({ 'Content-Type': 'application/json' }),
    json: () => {
      bodyStarted();
      return new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
      });
    },
  }));
  const rejected = assert.rejects(apiFetch('/message', { timeoutMs: 50 }), /Connection timed out/);
  await readingBody;
  t.mock.timers.tick(50);
  await rejected;
});

test('clears the timeout after the complete response has been read', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let requestSignal;
  t.mock.method(globalThis, 'fetch', async (_url, { signal }) => {
    requestSignal = signal;
    return new Response('{}', { headers: { 'Content-Type': 'application/json' } });
  });
  await apiFetch('/message', { timeoutMs: 50 });
  t.mock.timers.tick(50);
  assert.equal(requestSignal.aborted, false);
});

test('preserves HTTP rejection status for safe retry decisions', async (t) => {
  t.mock.method(globalThis, 'fetch', async () =>
    new Response(JSON.stringify({ message: ['Invalid conversation', 'Invalid content'] }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    })
  );
  await assert.rejects(apiFetch('/message'), (error) =>
    error.status === 400 && error.message === 'Invalid conversation, Invalid content'
  );
});
