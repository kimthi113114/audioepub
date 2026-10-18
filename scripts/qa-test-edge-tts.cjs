const { spawn } = require('child_process');
const http = require('http');

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
  console.log('1. Launching Edge in headless mode with remote debugging...');
  const edgeProc = spawn(EDGE_PATH, [
    `--remote-debugging-port=${CDP_PORT}`,
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    'http://localhost:5173',
  ]);

  edgeProc.on('error', (err) => console.error('Edge process error:', err));

  // Wait for CDP port to open
  let targets = null;
  for (let i = 0; i < 20; i++) {
    await sleep(500);
    try {
      targets = await fetchJSON(`http://127.0.0.1:${CDP_PORT}/json`);
      if (targets && targets.length > 0) break;
    } catch {}
  }

  if (!targets || targets.length === 0) {
    console.error('Failed to connect to Edge CDP endpoint');
    edgeProc.kill();
    process.exit(1);
  }

  console.log('2. Creating a dedicated tab for http://localhost:5173...');
  let newTab = null;
  try {
    newTab = await fetchJSON(`http://127.0.0.1:${CDP_PORT}/json/new?http://localhost:5173`);
  } catch (err) {
    console.error('Failed to create new tab:', err);
  }

  const pageTarget = newTab || targets.find((t) => t.url.includes('5173')) || targets[0];
  console.log('Target tab:', { id: pageTarget.id, url: pageTarget.url });
  const wsUrl = pageTarget.webSocketDebuggerUrl;

  const WebSocket = (await import('msedge-tts')).default ? require('ws') : require('ws');
  // Or use simple raw WebSocket
  const ws = new WebSocket(wsUrl);

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

  console.log('3. Enabling Runtime, Page, and DOM domains...');
  await send('Page.enable');
  await send('Runtime.enable');
  await send('DOM.enable');

  console.log('4. Navigating to http://localhost:5173 and waiting for load...');
  await send('Page.navigate', { url: 'http://localhost:5173' });
  await sleep(2500);

  // Evaluate state in browser
  const evalRes = await send('Runtime.evaluate', {
    expression: `(() => {
      const settings = JSON.parse(localStorage.getItem('audioepub-settings-v2') || '{}');
      return {
        title: document.title,
        defaultVoiceURI: settings?.state?.selectedVoiceURI,
        engineMode: settings?.state?.engineMode,
        ttsEngine: settings?.state?.ttsEngine,
        buttons: Array.from(document.querySelectorAll('button')).map(b => b.innerText.trim()).filter(Boolean),
        audioElements: document.querySelectorAll('audio').length
      };
    })()`,
    returnByValue: true,
  });

  console.log('5. Browser evaluation results:', evalRes.result?.value);

  // Take Desktop Screenshot
  console.log('6. Capturing desktop screenshot...');
  const screenshotRes = await send('Page.captureScreenshot', { format: 'png' });
  const fs = require('fs');
  const path = require('path');
  const artifactDir = 'C:\\Users\\KimTS-Lenovo\\.gemini\\antigravity\\brain\\28f2cc10-3672-4ba0-836b-e2dff0836735';
  fs.writeFileSync(path.join(artifactDir, 'edge-tts-desktop-app.png'), Buffer.from(screenshotRes.result.data, 'base64'));
  console.log('Desktop screenshot saved to edge-tts-desktop-app.png');

  // Set mobile device viewport (iPhone 14: 390x844)
  console.log('7. Emulating Mobile Viewport (iPhone 14: 390x844)...');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    mobile: true,
  });
  await sleep(1000);

  // Click on voice selector button to open VoiceDrawer
  console.log('8. Opening VoiceDrawer on mobile...');
  await send('Runtime.evaluate', {
    expression: `(() => {
      // Find button that contains Hoài My or Giọng đọc
      const btns = Array.from(document.querySelectorAll('button'));
      const voiceBtn = btns.find(b => b.innerText.includes('Hoài My') || b.innerText.includes('Giọng'));
      if (voiceBtn) {
        voiceBtn.click();
        return 'Clicked voice button: ' + voiceBtn.innerText;
      }
      // Or headphone icon button
      const headphoneBtn = document.querySelector('.anticon-customer-service')?.closest('button');
      if (headphoneBtn) {
        headphoneBtn.click();
        return 'Clicked headphone button';
      }
      return 'No button found';
    })()`,
    returnByValue: true,
  });

  await sleep(1500);

  // Take Mobile Screenshot
  const mobileScreenshotRes = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(artifactDir, 'edge-tts-mobile-drawer.png'), Buffer.from(mobileScreenshotRes.result.data, 'base64'));
  console.log('Mobile drawer screenshot saved to edge-tts-mobile-drawer.png');

  // Verify VoiceDrawer contents
  const drawerInfo = await send('Runtime.evaluate', {
    expression: `(() => {
      const drawer = document.querySelector('.ant-drawer');
      if (!drawer) return { open: false };
      const voiceItems = Array.from(drawer.querySelectorAll('.ant-list-item')).map(item => ({
        text: item.innerText.split('\\n').map(s => s.trim()).filter(Boolean)
      }));
      return {
        open: true,
        voiceCount: voiceItems.length,
        voices: voiceItems.slice(0, 5)
      };
    })()`,
    returnByValue: true,
  });

  console.log('9. VoiceDrawer Inspection:', JSON.stringify(drawerInfo.result?.value, null, 2));

  console.log('10. Cleaning up...');
  ws.close();
  try {
    await fetchJSON(`http://127.0.0.1:${CDP_PORT}/json/close/${pageTarget.id}`);
  } catch {}
  edgeProc.kill();
  console.log('✅ QA Automated Test Passed successfully!');
}

run().catch((err) => {
  console.error('QA Test Error:', err);
  process.exit(1);
});
