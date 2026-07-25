const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const bundlePath = path.resolve(__dirname, '..', 'dist', 'module.js');

if (!fs.existsSync(bundlePath)) {
  console.error('dist/module.js was not found. Run `npm run build` first.');
  process.exitCode = 1;
  return;
}

const bundle = fs.readFileSync(bundlePath);
const baselineBytes = 597_858;
const savedBytes = baselineBytes - bundle.byteLength;
const savedPercent = (savedBytes / baselineBytes) * 100;

console.log(`module.js raw:  ${bundle.byteLength.toLocaleString()} bytes`);
console.log(`module.js gzip: ${zlib.gzipSync(bundle).byteLength.toLocaleString()} bytes`);
console.log(
  `change from root-import baseline: ${savedBytes.toLocaleString()} bytes (${savedPercent.toFixed(1)}%) smaller`
);
