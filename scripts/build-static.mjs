// Builds a static copy of the app that can be hosted on GitHub Pages (or any static host):
// relative asset paths, no 136 MB onnx runtime folder (only needed by the optional Piper voice).
import { cpSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';

execSync('npm run build', { stdio: 'inherit' });
rmSync('dist-static', { recursive: true, force: true });
cpSync('dist', 'dist-static', { recursive: true });
if (existsSync('dist-static/onnx')) rmSync('dist-static/onnx', { recursive: true, force: true });
writeFileSync('dist-static/.nojekyll', '');
console.log('Static site ready in dist-static/');
