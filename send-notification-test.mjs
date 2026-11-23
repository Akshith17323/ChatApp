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
  console.log(`Setting up notification test from "${SENDER_USER}"...`);

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

  console.log(`\n⏳ Counting down 5 seconds to give you time to leave the chat room...`);
  for (let s = 5; s > 0; s--) {
    console.log(`   ${s}...`);
    await sleep(1000);
  }

  console.log(`\n🔔 Sending notification test message NOW!`);
  const messageText = "🔔 Notification Test: You received a new message from Alex!";

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

  await sleep(1000);
  socket.disconnect();
  console.log(`✓ Message dispatched! Notification should now appear on your phone.`);
}

run().catch(console.error);
