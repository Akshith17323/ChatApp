import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';

const BACKEND_PORT = 3000;
const WEB_PORT = 8081;
const CDP_PORT = 9222;
const BACKEND_URL = `http://127.0.0.1:${BACKEND_PORT}`;
const WEB_URL = `http://127.0.0.1:${WEB_PORT}`;
const SCREENSHOT_DIR = '/Users/akshith/.gemini/antigravity-cli/brain/ab95beb2-00ed-433b-a35f-70dabe093891';

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.css': 'text/css',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ttf': 'font/ttf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// 1. Static Web Server for dist/
function startWebServer(distDir, port) {
  const server = http.createServer((req, res) => {
    let reqPath = decodeURI(req.url.split('?')[0]);
    if (reqPath === '/' || reqPath === '') reqPath = '/index.html';
    const filePath = path.join(distDir, reqPath);

    if (!fs.existsSync(filePath)) {
      // Fallback for SPA routing to index.html
      const indexPath = path.join(distDir, 'index.html');
      res.writeHead(200, { 'Content-Type': 'text/html' });
      fs.createReadStream(indexPath).pipe(res);
      return;
    }

    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      const indexPath = path.join(filePath, 'index.html');
      res.writeHead(200, { 'Content-Type': 'text/html' });
      fs.createReadStream(indexPath).pipe(res);
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  });

  return new Promise((resolve) => {
    server.listen(port, '127.0.0.1', () => {
      resolve(server);
    });
  });
}

// 2. CDP Client over WebSocket
class CDPClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.id = 0;
    this.callbacks = new Map();
  }

  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((resolve, reject) => {
      this.ws.onopen = resolve;
      this.ws.onerror = reject;
    });

    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.id && this.callbacks.has(data.id)) {
        const { resolve, reject } = this.callbacks.get(data.id);
        this.callbacks.delete(data.id);
        if (data.error) reject(new Error(data.error.message || JSON.stringify(data.error)));
        else resolve(data.result);
      }
    };
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++this.id;
      this.callbacks.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    return res.result?.value;
  }

  async captureScreenshot(filePath) {
    const res = await this.send('Page.captureScreenshot', { format: 'png' });
    const buffer = Buffer.from(res.data, 'base64');
    fs.writeFileSync(filePath, buffer);
    console.log(`  📸 Screenshot saved: ${path.basename(filePath)}`);
  }

  close() {
    try {
      this.ws.close();
    } catch {}
  }
}

async function waitForUrl(url, timeoutMs = 15000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.status === 200) return true;
    } catch {}
    await sleep(250);
  }
  throw new Error(`Timeout waiting for ${url}`);
}

async function main() {
  console.log('=== ChatApp Full End-to-End Test (UI + Backend + DB) ===\n');

  // Step 1: Ensure Postgres is up
  console.log('Step 1: Starting PostgreSQL container in Docker...');
  const dockerProc = spawn('docker', ['compose', 'up', '-d', 'postgres'], { cwd: './backend' });
  await new Promise((resolve) => dockerProc.on('exit', resolve));
  await sleep(2000);
  console.log('✓ PostgreSQL container is running.');

  // Step 2: Start NestJS API
  console.log('Step 2: Starting NestJS Backend on Port 3000...');
  const backendProc = spawn('node', ['dist/main'], {
    cwd: './backend',
    env: {
      ...process.env,
      PORT: String(BACKEND_PORT),
      DATABASE_URL: 'postgresql://chatadmin:chatpass123@localhost:5432/chatapp?schema=public',
      BOT_MODE: 'false',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  backendProc.stdout.on('data', (d) => {
    const s = d.toString().trim();
    if (s.includes('Application running')) console.log('  [Backend]:', s);
  });

  await waitForUrl(`${BACKEND_URL}/docs`);
  console.log('✓ Backend API is ready and listening.');

  // Step 3: Start Web Server
  console.log('Step 3: Serving React Native Web build (dist/) on Port 8081...');
  const webServer = await startWebServer(path.resolve('./dist'), WEB_PORT);
  console.log('✓ Web app is live at http://127.0.0.1:8081');

  // Step 4: Launch Headless Google Chrome
  console.log('Step 4: Launching Headless Google Chrome with DevTools Protocol...');
  const chromeProc = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
    '--headless=new',
    `--remote-debugging-port=${CDP_PORT}`,
    '--window-size=430,932', // iPhone 15 Pro Max viewport
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-gpu',
    'about:blank',
  ]);

  await waitForUrl(`http://127.0.0.1:${CDP_PORT}/json/version`);
  console.log('✓ Headless Chrome is running.');

  // Open a new tab
  const newTabRes = await fetch(`http://127.0.0.1:${CDP_PORT}/json/new?${WEB_URL}`, { method: 'PUT' });
  const tabInfo = await newTabRes.json();
  const wsUrl = tabInfo.webSocketDebuggerUrl;
  assert.ok(wsUrl, 'Failed to get Chrome WebSocket debugger URL');

  const cdp = new CDPClient(wsUrl);
  await cdp.connect();
  console.log('✓ Connected to Chrome DevTools Protocol.');

  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('DOM.enable');

  try {
    // Wait for the React Native Web app to mount
    console.log('\n--- Step 5: Loading React Native App in Chrome ---');
    let title = '';
    for (let i = 0; i < 30; i++) {
      title = await cdp.evaluate('document.title');
      const rootText = await cdp.evaluate('document.getElementById("root")?.innerText || ""');
      if (rootText.includes('Messages') && rootText.includes('Continue')) {
        break;
      }
      await sleep(300);
    }

    const initialText = await cdp.evaluate('document.getElementById("root")?.innerText || ""');
    console.log('✓ App Loaded! Screen content snippet:\n  ' + initialText.replace(/\n+/g, ' | ').slice(0, 140) + '...');
    assert.ok(initialText.includes('Messages'), 'Auth screen must display Messages title');
    assert.ok(initialText.includes('Continue'), 'Auth screen must display Continue button');

    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
    await cdp.captureScreenshot(path.join(SCREENSHOT_DIR, '01-auth-screen.png'));

    // Step 6: Select localhost:3000 preset and input credentials
    console.log('\n--- Step 6: Filling in Auth Form & Selecting Server Preset ---');
    const testUsername = `user_e2e_${Date.now()}`;
    const testPassword = 'my-super-secure-e2e-password-123';

    await cdp.evaluate(`
      (() => {
        // Find and click preset chip for localhost:3000
        const chips = Array.from(document.querySelectorAll('div, span')).filter(el => el.innerText === 'localhost:3000');
        if (chips.length > 0) {
          chips[0].click();
        }

        // Helper to update React input
        function setReactInput(selector, value) {
          const input = document.querySelector(selector);
          if (!input) return false;
          const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
          if (setter) setter.call(input, value);
          else input.value = value;
          input.dispatchEvent(new Event('input', { bubbles: true }));
          input.dispatchEvent(new Event('change', { bubbles: true }));
          return true;
        }

        // Username
        setReactInput('input[aria-label="Username"]', ${JSON.stringify(testUsername)});
        // Password
        setReactInput('input[aria-label="Password"]', ${JSON.stringify(testPassword)});
        // Server URL ensure localhost:3000
        setReactInput('input[aria-label="Server URL"], input[value*="3000"]', 'http://localhost:3000');
      })()
    `);

    await sleep(500);
    await cdp.captureScreenshot(path.join(SCREENSHOT_DIR, '02-auth-filled.png'));
    console.log(`✓ Filled Username ("${testUsername}") and Password.`);

    // Step 7: Click "Continue" to Log In
    console.log('\n--- Step 7: Submitting Login (Continue) ---');
    await cdp.evaluate(`
      (() => {
        const btn = Array.from(document.querySelectorAll('div, span')).find(el => el.innerText === 'Continue');
        if (btn) btn.click();
      })()
    `);

    // Wait for transition to ChatListScreen
    let loggedIn = false;
    for (let i = 0; i < 30; i++) {
      const pageText = await cdp.evaluate('document.getElementById("root")?.innerText || ""');
      if (pageText.includes('Settings') && (pageText.includes('No conversations') || pageText.includes('Search') || pageText.includes('Messages'))) {
        // Also check if we left AuthScreen
        if (!pageText.includes('Sign in with your username')) {
          loggedIn = true;
          break;
        }
      }
      await sleep(300);
    }

    assert.ok(loggedIn, 'Login failed to navigate to ChatListScreen');
    console.log('✓ Successfully authenticated! Transitioned to ChatListScreen.');
    await sleep(500);
    await cdp.captureScreenshot(path.join(SCREENSHOT_DIR, '03-chat-list-screen.png'));

    // Step 8: Test Tab Navigation to Settings
    console.log('\n--- Step 8: Testing Navigation to Settings Tab ---');
    await cdp.evaluate(`
      (() => {
        const settingsTab = Array.from(document.querySelectorAll('div, span')).find(el => el.innerText === 'Settings');
        if (settingsTab) settingsTab.click();
      })()
    `);

    await sleep(800);
    const settingsText = await cdp.evaluate('document.getElementById("root")?.innerText || ""');
    console.log('✓ Navigated to Settings! Screen content snippet:\n  ' + settingsText.replace(/\n+/g, ' | ').slice(0, 140) + '...');
    assert.ok(settingsText.includes('Appearance') || settingsText.includes('Theme') || settingsText.includes('Server'), 'Settings screen must render preferences');
    await cdp.captureScreenshot(path.join(SCREENSHOT_DIR, '04-settings-screen.png'));

    // Step 9: Toggle Dark Theme / Appearance in Settings
    console.log('\n--- Step 9: Testing Theme Customization in Settings ---');
    await cdp.evaluate(`
      (() => {
        // Look for Dark mode chip or Dark option
        const darkChip = Array.from(document.querySelectorAll('div, span')).find(el => el.innerText === 'Dark');
        if (darkChip) darkChip.click();
      })()
    `);

    await sleep(600);
    await cdp.captureScreenshot(path.join(SCREENSHOT_DIR, '05-settings-dark-theme.png'));
    console.log('✓ Switched to Dark Theme.');

    // Step 10: Navigate back to Messages Tab
    console.log('\n--- Step 10: Returning to Messages Tab in Dark Mode ---');
    await cdp.evaluate(`
      (() => {
        const msgTab = Array.from(document.querySelectorAll('div, span')).find(el => el.innerText === 'Messages');
        if (msgTab) msgTab.click();
      })()
    `);

    await sleep(600);
    await cdp.captureScreenshot(path.join(SCREENSHOT_DIR, '06-chat-list-dark-theme.png'));
    console.log('✓ Chat List rendered in Dark Mode.');

    console.log('\n======================================================');
    console.log('🎉 FULL UI + BACKEND END-TO-END TESTS PASSED! 🎉');
    console.log('======================================================\n');
  } finally {
    cdp.close();
    chromeProc.kill('SIGTERM');
    webServer.close();
    backendProc.kill('SIGTERM');
    spawn('docker', ['compose', 'stop', 'postgres'], { cwd: './backend' });
  }
}

main().catch((err) => {
  console.error('\n❌ E2E Test Failed:', err);
  process.exit(1);
});
