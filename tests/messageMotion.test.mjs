import assert from 'node:assert/strict';
import test from 'node:test';
import { getMessageKey, rememberLocalMessageKeys, shouldAnimateMessage, updateMessageMotion } from '../src/utils/messageMotion.ts';

test('only new messages animate, not initial history or already-seen rows', () => {
  const keys = new Map();
  const seen = new Set();
  const history = { id: 'old' };
  assert.equal(shouldAnimateMessage(history, seen, keys, false), false);
  seen.add(getMessageKey(history, keys));
  assert.equal(shouldAnimateMessage(history, seen, keys, true), false);

  const incoming = { id: 'new' };
  assert.equal(shouldAnimateMessage(incoming, seen, keys, true), true);
  seen.add(getMessageKey(incoming, keys));
  assert.equal(shouldAnimateMessage(incoming, seen, keys, true), false);

  const earlier = { id: 'earlier' };
  seen.add(getMessageKey(earlier, keys));
  assert.equal(shouldAnimateMessage(earlier, seen, keys, true), false);
});

test('optimistic messages retain their row key after confirmation and polling', () => {
  const local = { id: 'local-1', clientId: 'local-1' };
  const seen = new Set();
  let keys = rememberLocalMessageKeys([local], new Map());
  assert.equal(shouldAnimateMessage(local, seen, keys, false), true);
  seen.add(getMessageKey(local, keys));

  keys = rememberLocalMessageKeys([{ ...local, id: 'server-1' }], keys);
  const polled = { id: 'server-1' };
  assert.equal(getMessageKey(polled, keys), 'local-1');
  assert.equal(shouldAnimateMessage(polled, seen, keys, true), false);

  keys = rememberLocalMessageKeys([], keys);
  assert.equal(getMessageKey(polled, keys), 'local-1');
  assert.equal(shouldAnimateMessage(local, seen, keys, true), false);
  assert.equal(getMessageKey({ id: 'other' }, keys), 'other');
});

test('key snapshots do not mutate previous renders or cross conversation boundaries', () => {
  const previous = new Map([['server-1', 'local-1']]);
  const next = rememberLocalMessageKeys([{ id: 'server-2', clientId: 'local-2' }], previous);
  assert.equal(previous.has('server-2'), false);
  assert.equal(next.get('server-1'), 'local-1');
  assert.equal(next.get('server-2'), 'local-2');
  assert.equal(getMessageKey({ id: 'server-1' }, new Map()), 'server-1');
});

test('motion snapshots suppress history and pagination while allowing sends during initial loading', () => {
  let state = updateMessageMotion(null, [], [], [], false);
  const local = { id: 'local-1', clientId: 'local-1' };
  state = updateMessageMotion(state, [local], [local], [], false);
  assert.deepEqual([...state.enteringKeys], ['local-1']);

  const history = { id: 'history' };
  state = updateMessageMotion(state, [history, local], [local], [], true);
  assert.equal(state.enteringKeys.size, 0);
  const incoming = { id: 'incoming' };
  state = updateMessageMotion(state, [history, local, incoming], [local], [], true);
  assert.deepEqual([...state.enteringKeys], ['incoming']);

  const earlier = { id: 'earlier' };
  state = updateMessageMotion(state, [earlier, history, local, incoming], [local], [earlier], true);
  assert.equal(state.enteringKeys.size, 0);
  const reopened = updateMessageMotion(null, [earlier, history, local, incoming], [local], [earlier], true);
  assert.equal(reopened.enteringKeys.size, 0);
});

test('motion snapshots preserve optimistic identity without changing previous snapshots', () => {
  const local = { id: 'local-1', clientId: 'local-1' };
  const initial = updateMessageMotion(null, [], [], [], true);
  const sending = updateMessageMotion(initial, [local], [local], [], true);
  assert.equal(initial.seenKeys.size, 0);
  assert.deepEqual([...sending.enteringKeys], ['local-1']);

  const server = { id: 'server-1' };
  const confirmed = updateMessageMotion(sending, [server], [{ ...local, ...server }], [], true);
  assert.equal(getMessageKey(server, confirmed.localKeys), local.clientId);
  assert.equal(confirmed.enteringKeys.size, 0);
  assert.equal(sending.localKeys.has(server.id), false);
  const polled = updateMessageMotion(confirmed, [server], [], [], true);
  assert.equal(getMessageKey(server, polled.localKeys), local.clientId);
  assert.equal(polled.enteringKeys.size, 0);
});
