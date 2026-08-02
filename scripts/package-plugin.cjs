const { createHash } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const distDir = path.join(root, 'dist');
const artifactsDir = path.join(root, 'artifacts');

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));
const fail = (message) => {
  throw new Error(`[package-plugin] ${message}`);
};

if (!fs.existsSync(path.join(distDir, 'plugin.json')) || !fs.existsSync(path.join(distDir, 'module.js'))) {
  fail('dist/plugin.json and dist/module.js are required. Run npm run build first.');
}

const plugin = readJson(path.join(distDir, 'plugin.json'));
const packageJson = readJson(path.join(root, 'package.json'));
if (!plugin.id || !plugin.info?.version) {
  fail('dist/plugin.json must contain id and info.version.');
}
if (plugin.info.version !== packageJson.version) {
  fail(`plugin version ${plugin.info.version} does not match package version ${packageJson.version}.`);
}

const pluginDir = path.join(artifactsDir, plugin.id);
const archiveName = `${plugin.id}-${plugin.info.version}.zip`;
const archivePath = path.join(artifactsDir, archiveName);
const normalizedTime = new Date(
  Number.isFinite(Number(process.env.SOURCE_DATE_EPOCH))
    ? Number(process.env.SOURCE_DATE_EPOCH) * 1000
    : Date.UTC(1980, 0, 1)
);

fs.mkdirSync(artifactsDir, { recursive: true });
fs.rmSync(pluginDir, { recursive: true, force: true });
fs.rmSync(archivePath, { force: true });
fs.cpSync(distDir, pluginDir, { recursive: true });

const normalizeTimes = (target) => {
  const entries = fs
    .readdirSync(target, { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name));
  for (const entry of entries) {
    const entryPath = path.join(target, entry.name);
    if (entry.isDirectory()) {
      normalizeTimes(entryPath);
    }
    fs.utimesSync(entryPath, normalizedTime, normalizedTime);
  }
};
normalizeTimes(pluginDir);
fs.utimesSync(pluginDir, normalizedTime, normalizedTime);

const zip = spawnSync('zip', ['-X', '-q', '-r', archiveName, plugin.id], {
  cwd: artifactsDir,
  encoding: 'utf8',
});
if (zip.status !== 0) {
  fail(zip.stderr.trim() || 'zip command failed.');
}

const checksum = createHash('sha256').update(fs.readFileSync(archivePath)).digest('hex');
fs.writeFileSync(path.join(artifactsDir, 'checksums.txt'), `${checksum}  ${archiveName}\n`);
fs.writeFileSync(
  path.join(artifactsDir, 'package-metadata.json'),
  `${JSON.stringify(
    {
      pluginId: plugin.id,
      version: plugin.info.version,
      archive: archiveName,
      sha256: checksum,
      signed: fs.existsSync(path.join(pluginDir, 'MANIFEST.txt')),
    },
    null,
    2
  )}\n`
);

console.log(`Packaged ${path.relative(root, archivePath)}`);
console.log(`SHA256 ${checksum}`);
