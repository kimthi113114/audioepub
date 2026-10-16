// Script to ensure @mintplex-labs/piper-tts-web supports speakerId for multi-speaker models
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const targetFile = path.resolve(__dirname, '../node_modules/@mintplex-labs/piper-tts-web/dist/piper-tts-web.js');

if (fs.existsSync(targetFile)) {
  let content = fs.readFileSync(targetFile, 'utf8');
  let changed = false;

  // 1. Dynamic speakerId in predictChunk_fn
  if (content.includes('const speakerId = 0;')) {
    content = content.replace('const speakerId = 0;', 'const speakerId = (this && this.speakerId !== undefined) ? this.speakerId : 0;');
    changed = true;
  }

  // 2. speakerId in constructor
  if (content.includes('voiceId,\n    progress,\n    logger,\n    wasmPaths\n  }) {') || content.includes('voiceId,\r\n    progress,\r\n    logger,\r\n    wasmPaths\r\n  }) {')) {
    content = content.replace(
      /constructor\(\{[\s\S]*?wasmPaths[\s\S]*?\}\)/,
      `constructor(options = {}) {\n    const {\n      voiceId,\n      progress,\n      logger,\n      wasmPaths,\n      speakerId\n    } = options`
    );
    changed = true;
  }

  if (changed) {
    fs.writeFileSync(targetFile, content, 'utf8');
    console.log('[patch-piper] Successfully patched @mintplex-labs/piper-tts-web for multi-speaker support.');
  } else {
    console.log('[patch-piper] @mintplex-labs/piper-tts-web already patched.');
  }
}
