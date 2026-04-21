/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs');
const path = require('path');
const src = path.join(__dirname, 'node_modules', 'lightningcss-win32-x64-msvc', 'lightningcss.win32-x64-msvc.node');
const dst = path.join(__dirname, 'node_modules', 'lightningcss', 'lightningcss.win32-x64-msvc.node');
try {
  if (!fs.existsSync(src)) {
    console.error('source missing:', src);
    process.exit(2);
  }
  fs.copyFileSync(src, dst);
  console.log('copied', src, '->', dst);
} catch (e) {
  console.error('copy failed', e && e.stack || e);
  process.exit(1);
}
