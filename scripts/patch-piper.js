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

  // 3. Patch ONNX_BASE to local /onnx/ to eliminate 404 from cdnjs
  if (content.includes('const ONNX_BASE = "https://cdnjs.cloudflare.com/ajax/libs/onnxruntime-web/1.18.0/";')) {
    content = content.replace('const ONNX_BASE = "https://cdnjs.cloudflare.com/ajax/libs/onnxruntime-web/1.18.0/";', 'const ONNX_BASE = "/onnx/";');
    changed = true;
  }

  // 4. Safely clamp out-of-bounds phoneme IDs to prevent Gather node crash (idx >= num_symbols)
  if (content.includes('input: new (__privateGet(this, _ort)).Tensor("int64", phonemeIds, [1, phonemeIds.length])')) {
    content = content.replace(
      'input: new (__privateGet(this, _ort)).Tensor("int64", phonemeIds, [1, phonemeIds.length])',
      `input: new (__privateGet(this, _ort)).Tensor("int64", phonemeIds.map(id => (id >= 0 && id < ((__privateGet(this, _modelConfig) && __privateGet(this, _modelConfig).num_symbols) || 130)) ? id : 0), [1, phonemeIds.length])`
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
