const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const sourcePlugin = JSON.parse(fs.readFileSync(path.join(root, 'src/plugin.json'), 'utf8'));
const defaultArchive = path.join(root, 'artifacts', `${sourcePlugin.id}-${packageJson.version}.zip`);
const archivePath = path.resolve(root, process.argv[2] ?? defaultArchive);
const fail = (message) => {
  throw new Error(`[verify-plugin-package] ${message}`);
};
const unzip = (args) => {
  const result = spawnSync('unzip', args, { encoding: 'utf8' });
  if (result.status !== 0) {
    fail(result.stderr.trim() || `unzip ${args.join(' ')} failed.`);
  }
  return result.stdout;
};

if (!fs.existsSync(archivePath)) {
  fail(`archive does not exist: ${archivePath}`);
}

const entries = unzip(['-Z1', archivePath])
  .split(/\r?\n/)
  .map((entry) => entry.trim())
  .filter(Boolean);
if (entries.length === 0) {
  fail('archive is empty.');
}
if (entries.some((entry) => entry.startsWith('/') || entry.split('/').includes('..'))) {
  fail('archive contains an unsafe absolute or parent path.');
}

const rootDirectory = `${sourcePlugin.id}/`;
if (entries.some((entry) => !entry.startsWith(rootDirectory))) {
  fail(`every archive entry must be nested under ${rootDirectory}`);
}

const requiredFiles = ['plugin.json', 'module.js', 'README.md', 'CHANGELOG.md', 'LICENSE'];
for (const requiredFile of requiredFiles) {
  if (!entries.includes(`${rootDirectory}${requiredFile}`)) {
    fail(`archive is missing ${rootDirectory}${requiredFile}.`);
  }
}

const packagedPlugin = JSON.parse(unzip(['-p', archivePath, `${rootDirectory}plugin.json`]));
if (packagedPlugin.id !== sourcePlugin.id) {
  fail(`packaged plugin id ${packagedPlugin.id} does not match ${sourcePlugin.id}.`);
}
if (packagedPlugin.info?.version !== packageJson.version) {
  fail(`packaged version ${packagedPlugin.info?.version} does not match ${packageJson.version}.`);
}

const signed = entries.includes(`${rootDirectory}MANIFEST.txt`);
if (process.env.REQUIRE_SIGNED === '1' && !signed) {
  fail('MANIFEST.txt is required for this package.');
}

console.log(`Verified ${path.relative(root, archivePath)}`);
console.log(`Plugin ${packagedPlugin.id}@${packagedPlugin.info.version}`);
console.log(`Signature manifest: ${signed ? 'present' : 'not present (development package)'}`);
