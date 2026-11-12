import assert from 'node:assert/strict';
import test from 'node:test';
import { createMessageOutbox, mergeChatMessages } from '../src/utils/messageOutbox.ts';

const TIME = '2026-11-12T12:00:00.000Z';
const PAYLOAD = { conversation_id: 'chat-1', content: 'Hello' };
const FILE = {
  id: 'file-1', name: 'photo.jpg', mimeType: 'image/jpeg', size: 10,
  kind: 'IMAGE', uploadedBy: 'me', createdAt: TIME, downloadUrl: '/file/file-1/download',
};
const PHOTO = {
  attachment: { file_name: 'photo.jpg', mime_type: 'image/jpeg', data: 'data:image/jpeg;base64,aGVsbG8=' },
  localImageUri: 'file:///photo.jpg',
};

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

function serverMessage(payload = PAYLOAD, id = 'server-1') {
  return {
    id, senderId: 'me', conversationId: payload.conversation_id,
    content: payload.content, fileId: payload.file_id, createdAt: TIME,
    status: { me: { delivered: true, read: true }, other: { delivered: false, read: false } },
  };
}

function fixture(overrides = {}) {
  const calls = { send: [], upload: [], confirmed: [] };
  const store = createMessageOutbox({
    senderId: 'me',
    now: () => TIME,
    sendMessage: async (payload) => {
      calls.send.push(payload);
      return overrides.sendMessage ? overrides.sendMessage(payload) : serverMessage(payload);
    },
    uploadFile: async (payload) => {
      calls.upload.push(payload);
      return overrides.uploadFile ? overrides.uploadFile(payload) : FILE;
    },
    onSent: (message, payload) => {
      calls.confirmed.push(message);
      overrides.onSent?.(message, payload);
    },
    isCurrent: overrides.isCurrent,
  });
  return { store, calls };
}

function waitForStatus(store, clientId, status) {
  const matches = () => store.getSnapshot().some((message) =>
    message.clientId === clientId && message.localStatus === status
  );
  if (matches()) return Promise.resolve();
  return new Promise((resolve) => {
    const unsubscribe = store.subscribe(() => {
      if (matches()) {
        unsubscribe();
        resolve();
      }
    });
  });
}

test('retains a sending bubble immediately and blocks rapid duplicate submissions', { timeout: 2000 }, async () => {
  const request = deferred();
  const { store, calls } = fixture({ sendMessage: () => request.promise });
  const id = store.enqueue({ ...PAYLOAD, content: '  Hello  ' });
  assert.equal(store.getSnapshot()[0].localStatus, 'sending');
  assert.equal(store.getSnapshot()[0].content, 'Hello');
  assert.equal(store.isSending('chat-1'), true);
  assert.equal(store.enqueue(PAYLOAD), null);
  assert.equal(store.retry(id), false);
  assert.equal(store.discard(id), false);
  assert.deepEqual(calls.send, [PAYLOAD]);
  request.resolve(serverMessage());
  await waitForStatus(store, id, 'sent');
  assert.equal(store.isSending('chat-1'), false);
});

test('keeps a confirmed message visible before refetch, then reconciles by server ID', { timeout: 2000 }, async () => {
  const { store } = fixture();
  const id = store.enqueue(PAYLOAD);
  await waitForStatus(store, id, 'sent');
  assert.equal(mergeChatMessages([], store.getSnapshot())[0].id, 'server-1');
  const server = serverMessage();
  assert.equal(mergeChatMessages([server], store.getSnapshot()).length, 1);
  store.acknowledge([server]);
  assert.deepEqual(store.getSnapshot(), []);
  assert.deepEqual(mergeChatMessages([server], store.getSnapshot()), [server]);
});

test('preserves failed text without automatic retries and retries the same local entry once', { timeout: 2000 }, async () => {
  const first = deferred();
  const second = deferred();
  let attempt = 0;
  const { store, calls } = fixture({ sendMessage: () => (++attempt === 1 ? first.promise : second.promise) });
  const id = store.enqueue(PAYLOAD);
  first.reject(new Error('Connection timed out'));
  await waitForStatus(store, id, 'failed');
  assert.equal(calls.send.length, 1);
  assert.equal(store.getSnapshot()[0].content, 'Hello');
  assert.equal(store.getSnapshot()[0].deliveryUncertain, true);
  store.acknowledge([]);
  assert.equal(store.getSnapshot().length, 1);
  assert.equal(store.retry(id), true);
  assert.equal(store.retry(id), false);
  assert.equal(store.getSnapshot().length, 1);
  assert.deepEqual(calls.send, [PAYLOAD, PAYLOAD]);
  second.resolve(serverMessage());
  await waitForStatus(store, id, 'sent');
  assert.equal(store.getSnapshot()[0].error, undefined);
});

test('does not send empty messages or create entries without a signed-in sender', () => {
  const { store, calls } = fixture();
  assert.equal(store.enqueue({ ...PAYLOAD, content: ' \n ' }), null);
  assert.equal(store.enqueue({ ...PAYLOAD, conversation_id: '' }), null);
  assert.deepEqual(calls.send, []);
  const anonymous = createMessageOutbox({ senderId: '', sendMessage: async () => serverMessage(), uploadFile: async () => FILE });
  assert.equal(anonymous.enqueue(PAYLOAD), null);
});

test('retains a failed photo upload and caption, then retries upload and sending', { timeout: 2000 }, async () => {
  let attempt = 0;
  const { store, calls } = fixture({
    uploadFile: async () => {
      if (++attempt === 1) throw new Error('Upload timed out');
      return FILE;
    },
  });
  const id = store.enqueue(PAYLOAD, PHOTO);
  assert.equal(store.getSnapshot()[0].localStatus, 'uploading');
  await waitForStatus(store, id, 'failed');
  assert.equal(store.getSnapshot()[0].localImageUri, PHOTO.localImageUri);
  assert.deepEqual(store.getSnapshot()[0].attachment, PHOTO.attachment);
  assert.equal(store.getSnapshot()[0].content, 'Hello');
  assert.equal(store.getSnapshot()[0].deliveryUncertain, false);
  assert.equal(calls.send.length, 0);
  assert.equal(store.retry(id), true);
  await waitForStatus(store, id, 'sent');
  assert.equal(calls.upload.length, 2);
  assert.deepEqual(calls.send, [{ ...PAYLOAD, file_id: FILE.id }]);
  assert.equal(store.getSnapshot()[0].attachment, undefined);
});

test('reuses the uploaded photo ID when only the message POST fails', { timeout: 2000 }, async () => {
  let attempt = 0;
  const { store, calls } = fixture({
    sendMessage: async (payload) => {
      if (++attempt === 1) throw Object.assign(new Error('Temporarily unavailable'), { status: 503 });
      return serverMessage(payload);
    },
  });
  const id = store.enqueue({ conversation_id: 'chat-1' }, PHOTO);
  await waitForStatus(store, id, 'failed');
  assert.equal(store.getSnapshot()[0].payload.file_id, FILE.id);
  assert.equal(store.getSnapshot()[0].attachment, undefined);
  assert.equal(store.retry(id), true);
  await waitForStatus(store, id, 'sent');
  assert.equal(calls.upload.length, 1);
  assert.equal(calls.send.length, 2);
  assert.equal(calls.send[1].file_id, FILE.id);
  assert.equal(calls.send[1].clientId, undefined);
  assert.equal(calls.send[1].localImageUri, undefined);
});

test('does not issue a message POST after sign-out while a photo is uploading', { timeout: 2000 }, async () => {
  const upload = deferred();
  const { store, calls } = fixture({ uploadFile: () => upload.promise });
  store.enqueue(PAYLOAD, PHOTO);
  store.setActive(false);
  upload.resolve(FILE);
  await upload.promise;
  await Promise.resolve();
  assert.equal(calls.send.length, 0);
  assert.equal(calls.confirmed.length, 0);
  assert.equal(store.enqueue(PAYLOAD), null);
});

test('ignores a late send response after switching accounts or servers', { timeout: 2000 }, async () => {
  const request = deferred();
  let current = true;
  const { store, calls } = fixture({ sendMessage: () => request.promise, isCurrent: () => current });
  store.enqueue(PAYLOAD);
  current = false;
  request.resolve(serverMessage());
  await request.promise;
  await Promise.resolve();
  assert.equal(calls.confirmed.length, 0);
  assert.equal(store.getSnapshot()[0].localStatus, 'sending');
  assert.equal(store.enqueue({ ...PAYLOAD, conversation_id: 'chat-2' }), null);
});

test('allows sends in separate conversations without mixing their payloads', { timeout: 2000 }, async () => {
  const first = deferred();
  const second = deferred();
  const { store, calls } = fixture({ sendMessage: (payload) =>
    payload.conversation_id === 'chat-1' ? first.promise : second.promise
  });
  const id1 = store.enqueue(PAYLOAD);
  const otherPayload = { conversation_id: 'chat-2', content: 'Another chat' };
  const id2 = store.enqueue(otherPayload);
  assert.notEqual(id1, id2);
  assert.deepEqual(calls.send, [PAYLOAD, otherPayload]);
  first.resolve(serverMessage());
  second.resolve(serverMessage(otherPayload, 'server-2'));
  await Promise.all([waitForStatus(store, id1, 'sent'), waitForStatus(store, id2, 'sent')]);
  assert.equal(store.getSnapshot().length, 2);
});

test('cache refresh failures do not mark a successfully sent message as failed', { timeout: 2000 }, async () => {
  const { store } = fixture({ onSent: () => { throw new Error('Cache unavailable'); } });
  const id = store.enqueue(PAYLOAD);
  await waitForStatus(store, id, 'sent');
  assert.equal(store.getSnapshot()[0].error, undefined);
  assert.equal(store.retry(id), false);
});

test('distinguishes a rejected request from uncertain delivery', { timeout: 2000 }, async () => {
  const { store } = fixture({ sendMessage: async () => {
    throw Object.assign(new Error('Invalid content'), { status: 400 });
  } });
  const id = store.enqueue(PAYLOAD);
  await waitForStatus(store, id, 'failed');
  assert.equal(store.getSnapshot()[0].deliveryUncertain, false);
  assert.equal(store.discard(id), true);
  assert.deepEqual(store.getSnapshot(), []);
});

test('failed messages survive unsubscribing and returning to the same session', { timeout: 2000 }, async () => {
  const request = deferred();
  const { store } = fixture({ sendMessage: () => request.promise });
  const unsubscribe = store.subscribe(() => {});
  const id = store.enqueue(PAYLOAD);
  unsubscribe();
  request.reject(new Error('Offline'));
  await waitForStatus(store, id, 'failed');
  assert.equal(mergeChatMessages([], store.getSnapshot())[0].content, 'Hello');
});
