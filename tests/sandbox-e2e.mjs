import { spawn } from 'node:child_process';
import { io } from 'socket.io-client';
import assert from 'node:assert/strict';

const PORT = 3005;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const DB_URL = process.env.DATABASE_URL || 'postgresql://chatadmin:chatpass123@localhost:5432/chatapp?schema=public';

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function basicAuth(username, password) {
  return 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64');
}

async function waitForServer(url, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url + '/docs');
      if (res.status === 200) return true;
    } catch {
      // ignore
    }
    await sleep(250);
  }
  throw new Error(`Server did not respond within ${timeoutMs}ms`);
}

async function run() {
  console.log('--- 1. Starting NestJS Backend in Sandbox (Port ' + PORT + ') ---');
  const serverProc = spawn('node', ['dist/main'], {
    cwd: './backend',
    env: {
      ...process.env,
      PORT: String(PORT),
      DATABASE_URL: DB_URL,
      BOT_MODE: 'false',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  serverProc.stdout.on('data', (d) => {
    const msg = d.toString().trim();
    if (msg.includes('Application running') || msg.includes('Swagger')) {
      console.log('  [Backend stdout]:', msg);
    }
  });

  serverProc.stderr.on('data', (d) => {
    console.error('  [Backend stderr]:', d.toString().trim());
  });

  try {
    await waitForServer(BASE_URL);
    console.log('✓ Backend is UP and Swagger /docs is accessible.');

    const aliceCreds = { user: `alice_${Date.now()}`, pass: 'super-secure-alice-password-123' };
    const bobCreds = { user: `bob_${Date.now()}`, pass: 'super-secure-bob-password-456' };

    console.log('\n--- 2. Testing User Auto-Registration and Profile ---');
    // Register Alice
    const resAlice = await fetch(`${BASE_URL}/user/profile`, {
      headers: { Authorization: basicAuth(aliceCreds.user, aliceCreds.pass) },
    });
    assert.equal(resAlice.status, 200, 'Alice profile fetch / registration failed');
    const aliceData = await resAlice.json();
    console.log(`✓ Alice created: ID=${aliceData.id}, Name=${aliceData.name}`);

    // Register Bob
    const resBob = await fetch(`${BASE_URL}/user/profile`, {
      headers: { Authorization: basicAuth(bobCreds.user, bobCreds.pass) },
    });
    assert.equal(resBob.status, 200, 'Bob profile fetch / registration failed');
    const bobData = await resBob.json();
    console.log(`✓ Bob created: ID=${bobData.id}, Name=${bobData.name}`);

    console.log('\n--- 3. Testing WebSocket Real-Time Connection for Alice & Bob ---');
    const aliceSocket = io(BASE_URL, {
      auth: { username: aliceCreds.user, password: aliceCreds.pass },
      transports: ['websocket'],
    });
    const bobSocket = io(BASE_URL, {
      auth: { username: bobCreds.user, password: bobCreds.pass },
      transports: ['websocket'],
    });

    await Promise.all([
      new Promise((resolve, reject) => {
        aliceSocket.on('connect', resolve);
        aliceSocket.on('connect_error', reject);
      }),
      new Promise((resolve, reject) => {
        bobSocket.on('connect', resolve);
        bobSocket.on('connect_error', reject);
      }),
    ]);
    console.log('✓ Both Alice & Bob connected to Socket.IO gateway with authentication.');

    console.log('\n--- 4. Testing Conversation (DM) Creation ---');
    const convRes = await fetch(`${BASE_URL}/conversation`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: basicAuth(aliceCreds.user, aliceCreds.pass),
      },
      body: JSON.stringify({
        type: 'DM',
        participants_ids: [bobData.id],
      }),
    });
    assert.equal(convRes.status, 201, 'Conversation creation failed');
    const conv = await convRes.json();
    console.log(`✓ DM Conversation created between Alice and Bob: ID=${conv.id}`);

    // Join room on WebSockets with ack
    const aliceJoin = await aliceSocket.emitWithAck('room:join', { conversationId: conv.id });
    const bobJoin = await bobSocket.emitWithAck('room:join', { conversationId: conv.id });
    assert.equal(aliceJoin.success, true);
    assert.equal(bobJoin.success, true);
    console.log('✓ Both Alice & Bob joined the conversation room conv:' + conv.id);

    console.log('\n--- 5. Testing Typing Indicators via WebSockets ---');
    const typingPromise = new Promise((resolve) => {
      bobSocket.on('typing:update', (data) => {
        if (data.userId === aliceData.id) resolve(data);
      });
    });
    aliceSocket.emit('typing:start', { conversationId: conv.id });
    const typingEvt = await typingPromise;
    console.log(`✓ Bob received typing:update from Alice: conversation=${typingEvt.conversationId}, isTyping=${typingEvt.isTyping}`);
    aliceSocket.emit('typing:stop', { conversationId: conv.id });

    console.log('\n--- 6. Testing Message Sending and Real-Time Event Dispatch ---');
    const msgPromise = new Promise((resolve) => {
      bobSocket.on('message:new', (msg) => {
        resolve(msg);
      });
    });

    const sendRes = await fetch(`${BASE_URL}/message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: basicAuth(aliceCreds.user, aliceCreds.pass),
      },
      body: JSON.stringify({
        conversation_id: conv.id,
        content: 'Hello Bob! This is an end-to-end sandbox message.',
      }),
    });
    assert.equal(sendRes.status, 201, 'Sending message failed');
    const sentMsg = await sendRes.json();
    console.log(`✓ Message POST succeeded: ID=${sentMsg.id}, text="${sentMsg.content}"`);

    const receivedViaSocket = await msgPromise;
    assert.equal(receivedViaSocket.message?.id, sentMsg.id, 'Received message ID mismatch');
    console.log(`✓ Bob received message:new via WebSocket in real-time.`);

    console.log('\n--- 7. Testing Message Retrieval and Pagination ---');
    const getMsgsRes = await fetch(`${BASE_URL}/message?conversation_id=${conv.id}`, {
      headers: { Authorization: basicAuth(bobCreds.user, bobCreds.pass) },
    });
    assert.equal(getMsgsRes.status, 200, 'Fetching messages failed');
    const history = await getMsgsRes.json();
    assert.equal(history.data.length, 1, 'Expected 1 message in history');
    console.log(`✓ Message history fetched: ${history.data.length} message(s) returned.`);

    console.log('\n--- 8. Testing File Upload and Download Access Control ---');
    // 1x1 PNG Base64
    const validPngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const uploadRes = await fetch(`${BASE_URL}/file`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: basicAuth(aliceCreds.user, aliceCreds.pass),
      },
      body: JSON.stringify({
        file_name: 'dot.png',
        data: validPngBase64,
      }),
    });
    assert.equal(uploadRes.status, 201, 'File upload failed');
    const uploadedFile = await uploadRes.json();
    console.log(`✓ File uploaded by Alice: ID=${uploadedFile.id}, filename=${uploadedFile.name}, kind=${uploadedFile.kind}`);

    // Alice attaches file to a message in this conversation so Bob gets access
    const attachMsgRes = await fetch(`${BASE_URL}/message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: basicAuth(aliceCreds.user, aliceCreds.pass),
      },
      body: JSON.stringify({
        conversation_id: conv.id,
        content: 'Check out this dot!',
        file_id: uploadedFile.id,
      }),
    });
    assert.equal(attachMsgRes.status, 201, 'Attaching file to message failed');
    console.log(`✓ File attached to message in conversation.`);

    // Bob downloads the file shared in the conversation
    const downloadRes = await fetch(`${BASE_URL}/file/${uploadedFile.id}`, {
      headers: { Authorization: basicAuth(bobCreds.user, bobCreds.pass) },
    });
    assert.equal(downloadRes.status, 200, 'Bob failed to download shared file');
    const downloadedData = await downloadRes.json();
    assert.equal(downloadedData.data, validPngBase64, 'Downloaded file content mismatch');
    console.log(`✓ File downloaded and verified by Bob: ${downloadedData.name} (${downloadedData.size} bytes)`);

    console.log('\n--- 9. Testing Message Deletion and Real-Time Event ---');
    const deletePromise = new Promise((resolve) => {
      bobSocket.on('message:deleted', (data) => {
        resolve(data);
      });
    });

    const delRes = await fetch(`${BASE_URL}/message/${sentMsg.id}`, {
      method: 'DELETE',
      headers: { Authorization: basicAuth(aliceCreds.user, aliceCreds.pass) },
    });
    assert.equal(delRes.status, 200, 'Message deletion failed');
    const delData = await delRes.json();
    assert.equal(delData.success, true, 'Delete response confirmation failed');

    const deletedEvt = await deletePromise;
    assert.equal(deletedEvt.messageId, sentMsg.id, 'Delete event ID mismatch');
    console.log(`✓ Bob received message:deleted via WebSocket in real-time.`);

    aliceSocket.disconnect();
    bobSocket.disconnect();
    console.log('\n=========================================');
    console.log('🎉 ALL SANDBOX END-TO-END TESTS PASSED! 🎉');
    console.log('=========================================');
  } finally {
    serverProc.kill('SIGTERM');
  }
}

run().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
