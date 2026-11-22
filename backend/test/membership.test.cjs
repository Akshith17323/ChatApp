const assert = require('node:assert/strict');
const { test } = require('node:test');
const { MessageService } = require('../dist/message/message.service');
const { ConversationService } = require('../dist/conversation/conversation.service');
const { FileService } = require('../dist/file/file.service');

const ALICE = '64b8f9e2c4a3b12d4e5f6789';
const BOB = '64b8f9e2c4a3b12d4e5f6790';
const CHARLIE = '64b8f9e2c4a3b12d4e5f6792';
const EVE = '64b8f9e2c4a3b12d4e5f6791';
const CHAT = '64b8f9e2c4a3b12d4e5f0001';
const OTHER_CHAT = '64b8f9e2c4a3b12d4e5f0002';
const CURSOR = '64b8f9e2c4a3b12d4e5f1234';
const FILE_ID = '64b8f9e2c4a3b12d4e5f9001';

const hasStatus = (status) => (error) => error.getStatus?.() === status;

function makeMessageService(overrides = {}) {
  const conversation = { id: CHAT, type: 'DM', participants_ids: [ALICE, BOB] };
  const service = new MessageService({
    conversation: {
      findUnique: async ({ where }) => (where.id === CHAT ? conversation : null),
    },
    message: {
      findUnique: async ({ where }) => {
        if (where.id === CURSOR) {
          return { id: CURSOR, conversationId: CHAT, content: 'Old msg' };
        }
        if (where.id === 'wrong-conv-cursor') {
          return { id: 'wrong-conv-cursor', conversationId: OTHER_CHAT, content: 'Foreign msg' };
        }
        return null;
      },
      findMany: async () => [
        { id: 'msg-1', content: 'Hello', senderId: ALICE, conversationId: CHAT, status: {}, fileId: null },
      ],
      create: async ({ data }) => ({
        id: 'msg-new',
        ...data,
      }),
    },
    user: {
      findMany: async () => [{ id: ALICE, name: 'Alice' }, { id: BOB, name: 'Bob' }],
      findUnique: async ({ where }) => ({ id: where.id, name: where.id === ALICE ? 'Alice' : 'Other' }),
    },
    file: {
      findMany: async () => [],
      findUnique: async ({ where }) => {
        if (where.id === FILE_ID) {
          return { id: FILE_ID, uploadedBy: ALICE };
        }
        if (where.id === 'eve-file') {
          return { id: 'eve-file', uploadedBy: EVE };
        }
        return null;
      },
    },
    ...overrides,
  });
  service.logger = { log: () => {} };
  return service;
}

test('outsiders cannot fetch messages in a conversation (403 Forbidden)', async () => {
  const service = makeMessageService();
  await assert.rejects(service.getMessages(CHAT, EVE), hasStatus(403));
});

test('members can fetch messages in a conversation (200 OK)', async () => {
  const service = makeMessageService();
  const result = await service.getMessages(CHAT, ALICE);
  assert.equal(result.count, 1);
  assert.equal(result.data[0].content, 'Hello');
});

test('fetching messages from a non-existent conversation returns 404', async () => {
  const service = makeMessageService();
  await assert.rejects(service.getMessages('non-existent-conv', ALICE), hasStatus(404));
});

test('outsiders cannot send messages to a conversation (403 Forbidden)', async () => {
  const service = makeMessageService();
  await assert.rejects(
    service.createMessage({ conversation_id: CHAT, content: 'Intrusion' }, EVE),
    hasStatus(403),
  );
});

test('members can send messages to a conversation (201 Created)', async () => {
  const service = makeMessageService();
  const sent = await service.createMessage({ conversation_id: CHAT, content: 'Hi Bob' }, ALICE);
  assert.equal(sent.content, 'Hi Bob');
  assert.equal(sent.senderId, ALICE);
  assert.equal(sent.status[BOB].read, false);
  assert.equal(sent.status[ALICE].read, true);
});

test('history rejects a cursor belonging to another conversation (404 Not Found)', async () => {
  const service = makeMessageService();
  await assert.rejects(service.getMessages(CHAT, ALICE, 'wrong-conv-cursor'), hasStatus(404));
});

test('history accepts a valid cursor in the same conversation', async () => {
  const service = makeMessageService();
  const result = await service.getMessages(CHAT, ALICE, CURSOR);
  assert.equal(result.count, 1);
});

test('cannot attach someone else file to a message (403 Forbidden)', async () => {
  const service = makeMessageService();
  await assert.rejects(
    service.createMessage({ conversation_id: CHAT, file_id: 'eve-file' }, ALICE),
    hasStatus(403),
  );
});

test('cannot attach a non-existent file to a message (404 Not Found)', async () => {
  const service = makeMessageService();
  await assert.rejects(
    service.createMessage({ conversation_id: CHAT, file_id: 'missing-file' }, ALICE),
    hasStatus(404),
  );
});

test('creating DM with only the caller throws 400 Bad Request', async () => {
  const service = new ConversationService({});
  await assert.rejects(
    service.createConversation({ type: 'DM', participants_ids: [ALICE] }, ALICE),
    hasStatus(400),
  );
});

test('creating DM with more than one recipient throws 400 Bad Request', async () => {
  const service = new ConversationService({});
  await assert.rejects(
    service.createConversation({ type: 'DM', participants_ids: [BOB, CHARLIE] }, ALICE),
    hasStatus(400),
  );
});

test('creating DM with non-existent recipient throws 404 Not Found', async () => {
  const service = new ConversationService({
    user: {
      findMany: async () => [], // recipient not found
    },
  });
  await assert.rejects(
    service.createConversation({ type: 'DM', participants_ids: ['missing-user'] }, ALICE),
    hasStatus(404),
  );
});

test('creating a valid DM generates a two-participant conversation', async () => {
  let createdRecord = null;
  const service = new ConversationService({
    user: {
      findMany: async () => [{ id: BOB, name: 'Bob' }],
      updateMany: async () => {},
    },
    conversation: {
      findFirst: async () => null,
      create: async ({ data }) => {
        createdRecord = data;
        return { id: CHAT, ...data };
      },
    },
  });

  const created = await service.createConversation({ type: 'DM', participants_ids: [BOB] }, ALICE);
  assert.equal(created.type, 'DM');
  assert.deepEqual(createdRecord.participants_ids, [ALICE, BOB]);
  assert.equal(createdRecord.createdBy, ALICE);
  assert.equal(createdRecord.name, '[DM] Bob');
});

test('reusing an existing DM queries only the exact two-person pair', async () => {
  let queryWhere = null;
  const service = new ConversationService({
    user: {
      findMany: async () => [{ id: BOB, name: 'Bob' }],
      updateMany: async () => {},
    },
    conversation: {
      findFirst: async (q) => {
        queryWhere = q.where;
        return { id: CHAT, type: 'DM', participants_ids: [ALICE, BOB] };
      },
      create: async () => assert.fail('Should not create duplicate conversation'),
    },
  });

  const existing = await service.createConversation({ type: 'DM', participants_ids: [BOB] }, ALICE);
  assert.equal(existing.id, CHAT);
  assert.deepEqual(queryWhere, {
    type: 'DM',
    OR: [
      { participants_ids: { equals: [ALICE, BOB] } },
      { participants_ids: { equals: [BOB, ALICE] } },
    ],
  });
});

test('creating a valid group conversation requires at least one other participant', async () => {
  let createdRecord = null;
  const service = new ConversationService({
    user: {
      findMany: async () => [{ id: BOB, name: 'Bob' }, { id: CHARLIE, name: 'Charlie' }],
      updateMany: async () => {},
    },
    conversation: {
      create: async ({ data }) => {
        createdRecord = data;
        return { id: 'group-1', ...data };
      },
    },
  });

  const created = await service.createConversation(
    { type: 'GROUP', name: 'Project Alpha', participants_ids: [BOB, CHARLIE] },
    ALICE,
  );
  assert.equal(created.type, 'GROUP');
  assert.equal(createdRecord.name, 'Project Alpha');
  assert.deepEqual(createdRecord.participants_ids, [ALICE, BOB, CHARLIE]);
});

test('file access control: non-participant cannot download file (403 Forbidden)', async () => {
  const service = new FileService({
    file: {
      findUnique: async () => ({ id: FILE_ID, uploadedBy: ALICE, data: Buffer.from('data') }),
    },
    message: {
      findMany: async () => [{ conversationId: CHAT }],
    },
    conversation: {
      count: async () => 0, // Eve is not in any conversation where this file was sent
    },
  });

  await assert.rejects(service.getForDownload(FILE_ID, EVE), hasStatus(403));
});

test('file access control: uploader CAN download their own file (200 OK)', async () => {
  const service = new FileService({
    file: {
      findUnique: async () => ({ id: FILE_ID, uploadedBy: ALICE, data: Buffer.from('data') }),
    },
  });

  const file = await service.getForDownload(FILE_ID, ALICE);
  assert.equal(file.id, FILE_ID);
});

test('file access control: conversation participant CAN download shared file (200 OK)', async () => {
  const service = new FileService({
    file: {
      findUnique: async () => ({ id: FILE_ID, uploadedBy: ALICE, data: Buffer.from('data') }),
    },
    message: {
      findMany: async () => [{ conversationId: CHAT }],
    },
    conversation: {
      count: async () => 1, // Bob is a participant in CHAT
    },
  });

  const file = await service.getForDownload(FILE_ID, BOB);
  assert.equal(file.id, FILE_ID);
});
