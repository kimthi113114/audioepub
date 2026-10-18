const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const CDP_PORT = 9222;

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
      res.on('error', reject);
    });
  });
}

async function run() {
  const edgeProc = spawn(EDGE_PATH, [
    `--remote-debugging-port=${CDP_PORT}`,
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    'http://localhost:5173',
  ]);

  let targets = null;
  for (let i = 0; i < 20; i++) {
    await sleep(400);
    try {
      targets = await fetchJSON(`http://127.0.0.1:${CDP_PORT}/json`);
      if (targets && targets.length > 0) break;
    } catch {}
  }

  const pageTarget = targets.find((t) => t.url.includes('5173')) || targets[0];
  const WebSocket = require('ws');
  const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);

  let idSeq = 1;
  const pending = new Map();

  ws.on('message', (msg) => {
    const res = JSON.parse(msg.toString());
    if (res.id && pending.has(res.id)) {
      pending.get(res.id)(res);
      pending.delete(res.id);
    }
  });

  const send = (method, params = {}) => {
    const id = idSeq++;
    return new Promise((resolve) => {
      pending.set(id, resolve);
      ws.send(JSON.stringify({ id, method, params }));
    });
  };

  await new Promise((r) => ws.on('open', r));

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1280,
    height: 800,
    deviceScaleFactor: 1,
    mobile: false,
  });

  await send('Page.navigate', { url: 'http://localhost:5173' });
  await sleep(1500);

  // Click on headphone button to open VoiceModal
  await send('Runtime.evaluate', {
    expression: `(() => {
      const headphoneBtn = document.querySelector('.anticon-customer-service')?.closest('button');
      if (headphoneBtn) {
        headphoneBtn.click();
        return 'Clicked headphone button';
      }
      return 'No button';
    })()`,
  });

  await sleep(1000);

  const screenshotRes = await send('Page.captureScreenshot', { format: 'png' });
  const artifactDir = 'C:\\Users\\KimTS-Lenovo\\.gemini\\antigravity\\brain\\28f2cc10-3672-4ba0-836b-e2dff0836735';
  fs.writeFileSync(path.join(artifactDir, 'edge-tts-desktop-modal.png'), Buffer.from(screenshotRes.result.data, 'base64'));
  console.log('Desktop modal screenshot saved to edge-tts-desktop-modal.png');

  ws.close();
  edgeProc.kill();
}

run().catch(console.error);
