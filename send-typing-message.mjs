import { io } from 'socket.io-client';

const BASE_URL = 'http://localhost:3000';
const AKSHITH_ID = '9b075ac8-5fd3-4ed7-82a5-eb7627a01e8b';
const SENDER_USER = 'Alex';
const SENDER_PASS = 'secure-password-alex-12345';

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function basicAuth(username, password) {
  return 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64');
}

async function run() {
  const convRes = await fetch(`${BASE_URL}/conversation`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: basicAuth(SENDER_USER, SENDER_PASS),
    },
    body: JSON.stringify({
      type: 'DM',
      participants_ids: [AKSHITH_ID],
    }),
  });
  const conv = await convRes.json();

  const socket = io(BASE_URL, {
    auth: { username: SENDER_USER, password: SENDER_PASS },
    transports: ['websocket'],
  });

  await new Promise((resolve, reject) => {
    socket.on('connected', resolve);
    socket.on('connect_error', reject);
  });

  await socket.emitWithAck('room:join', { conversationId: conv.id });

  console.log(`\n💬 TYPING ACTIVATED for 5 seconds... Look at your phone!`);
  socket.emit('typing:start', { conversationId: conv.id });

  for (let s = 5; s > 0; s--) {
    console.log(`   ...typing (${s}s remaining)...`);
    await sleep(1000);
  }

  console.log(`\n📨 SENDING MESSAGE...`);
  const messageText = "Round 3! 🚀 Typing dots animation verified. Everything is in sync!";

  await fetch(`${BASE_URL}/message`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: basicAuth(SENDER_USER, SENDER_PASS),
    },
    body: JSON.stringify({
      conversation_id: conv.id,
      content: messageText,
    }),
  });

  socket.emit('typing:stop', { conversationId: conv.id });
  await sleep(500);

  socket.disconnect();
  console.log(`✓ Delivered!`);
}

run().catch(console.error);
