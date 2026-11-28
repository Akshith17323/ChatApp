import assert from 'node:assert/strict';
import test from 'node:test';

// Test DM perspective title resolution
test('DM title perspective resolves the other participant name regardless of stored item.name', () => {
  const userMap = new Map([
    ['user-alice', 'Alice Smith'],
    ['user-bob', 'Bob Jones'],
  ]);

  function getConversationTitle(item, currentUserId) {
    if (item.type === 'DM') {
      const otherId = item.participants_ids?.find((id) => id !== currentUserId);
      if (otherId && userMap.has(otherId)) {
        return userMap.get(otherId);
      }
      if (otherId) return `User (${otherId.slice(-4)})`;
    }

    if (item.name) return item.name;

    return item.type === 'DM' ? 'Direct Message' : 'Group Conversation';
  }

  // Conversation was created by Alice, so backend stored item.name as '[DM] Bob Jones'
  const dmItem = {
    id: 'conv-1',
    type: 'DM',
    name: '[DM] Bob Jones',
    participants_ids: ['user-alice', 'user-bob'],
  };

  // Alice sees Bob
  assert.equal(getConversationTitle(dmItem, 'user-alice'), 'Bob Jones');

  // Bob sees Alice (NOT '[DM] Bob Jones')
  assert.equal(getConversationTitle(dmItem, 'user-bob'), 'Alice Smith');

  // Group chats still use item.name
  const groupItem = {
    id: 'conv-2',
    type: 'GROUP',
    name: 'Engineering Team',
    participants_ids: ['user-alice', 'user-bob'],
  };
  assert.equal(getConversationTitle(groupItem, 'user-alice'), 'Engineering Team');
  assert.equal(getConversationTitle(groupItem, 'user-bob'), 'Engineering Team');
});

// Test Message Chronological Merging and Deduplication
test('combines older paginated messages and polling messages chronologically without duplicates', () => {
  const olderBatch = [
    { id: 'm1', content: 'Message 1', createdAt: '2026-11-22T10:00:00.000Z' },
    { id: 'm2', content: 'Message 2', createdAt: '2026-11-22T10:01:00.000Z' },
  ];

  const pollingBatch = [
    { id: 'm2', content: 'Message 2 (updated)', createdAt: '2026-11-22T10:01:00.000Z' },
    { id: 'm3', content: 'Message 3', createdAt: '2026-11-22T10:02:00.000Z' },
  ];

  const rawList = [...olderBatch, ...pollingBatch];
  const map = new Map();
  for (const m of rawList) {
    map.set(m.id, m);
  }
  const merged = Array.from(map.values()).sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  assert.equal(merged.length, 3);
  assert.deepEqual(merged.map((m) => m.id), ['m1', 'm2', 'm3']);
});

// Test Non-image file handling
test('getMessageImageUri returns null for non-image files and documents', () => {
  const baseUrl = 'https://chat.example.com';
  function getMessageImageUri(item) {
    if (item.file?.kind === 'FILE' || item.type === 'FILE') return null;
    if (item.file?.mimeType && !item.file.mimeType.startsWith('image/')) return null;
    if (item.localImageUri) return item.localImageUri;
    if (item.imageInfo) return item.imageInfo;
    if (item.fileId) return `${baseUrl}/file/${item.fileId}/download`;
    if (item.file?.downloadUrl) return `${baseUrl}${item.file.downloadUrl}`;
    return null;
  }

  // PDF Document
  const pdfMessage = {
    id: 'msg-doc',
    fileId: 'file-doc-1',
    file: {
      kind: 'FILE',
      mimeType: 'application/pdf',
      downloadUrl: '/file/file-doc-1/download',
      name: 'report.pdf',
    },
  };
  assert.equal(getMessageImageUri(pdfMessage), null);

  // Image File
  const imageMessage = {
    id: 'msg-img',
    fileId: 'file-img-1',
    file: {
      kind: 'IMAGE',
      mimeType: 'image/png',
      downloadUrl: '/file/file-img-1/download',
      name: 'screenshot.png',
    },
  };
  assert.equal(getMessageImageUri(imageMessage), 'https://chat.example.com/file/file-img-1/download');
});

// Test Real-Time Presence & Typing State
test('presence and typing state track socket updates correctly', () => {
  // Presence tracking
  const onlineUsers = new Set(['user-1']);
  function handlePresenceUpdate(data) {
    if (data.isOnline) {
      onlineUsers.add(data.userId);
    } else {
      onlineUsers.delete(data.userId);
    }
  }

  handlePresenceUpdate({ userId: 'user-2', isOnline: true });
  assert.equal(onlineUsers.has('user-2'), true);

  handlePresenceUpdate({ userId: 'user-1', isOnline: false });
  assert.equal(onlineUsers.has('user-1'), false);
  assert.equal(onlineUsers.has('user-2'), true);

  // Typing tracking
  let typingState = {};
  function handleTypingUpdate(data) {
    if (data.isTyping) {
      typingState = { ...typingState, [data.conversationId]: { userId: data.userId, userName: data.userName } };
    } else {
      const copy = { ...typingState };
      delete copy[data.conversationId];
      typingState = copy;
    }
  }

  handleTypingUpdate({ conversationId: 'conv-1', userId: 'user-2', userName: 'Bob', isTyping: true });
  assert.deepEqual(typingState['conv-1'], { userId: 'user-2', userName: 'Bob' });

  handleTypingUpdate({ conversationId: 'conv-1', userId: 'user-2', userName: 'Bob', isTyping: false });
  assert.equal(typingState['conv-1'], undefined);
});

// Test Real-time message deletion
test('real-time message deletion filters out message by ID', () => {
  const currentMessages = [
    { id: 'm1', content: 'First message' },
    { id: 'm2', content: 'Second message' },
    { id: 'm3', content: 'Third message' },
  ];

  function handleMessageDeleted(messages, deletedId) {
    return messages.filter((m) => m.id !== deletedId);
  }

  const updated = handleMessageDeleted(currentMessages, 'm2');
  assert.equal(updated.length, 2);
  assert.deepEqual(updated.map((m) => m.id), ['m1', 'm3']);
});
