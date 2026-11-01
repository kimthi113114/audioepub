// Builds a static copy of the app that can be hosted on GitHub Pages (or any static host):
// relative asset paths, no 136 MB onnx runtime folder (only needed by the optional Piper voice).
// dist-static/ may hold the git repo that is published, so its .git folder is kept.
import { cpSync, rmSync, writeFileSync, existsSync, readdirSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';

execSync('npm run build', { stdio: 'inherit' });
mkdirSync('dist-static', { recursive: true });
for (const name of readdirSync('dist-static')) {
  if (name !== '.git') rmSync(`dist-static/${name}`, { recursive: true, force: true });
}
cpSync('dist', 'dist-static', { recursive: true });
if (existsSync('dist-static/onnx')) rmSync('dist-static/onnx', { recursive: true, force: true });
writeFileSync('dist-static/.nojekyll', '');
console.log('Static site ready in dist-static/');
