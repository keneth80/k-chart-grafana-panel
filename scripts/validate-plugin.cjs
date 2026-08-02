const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const root = path.resolve(__dirname, '..');
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const plugin = JSON.parse(fs.readFileSync(path.join(root, 'src/plugin.json'), 'utf8'));
const cliArguments = process.argv.slice(2);
const useDocker = cliArguments.includes('--docker');
const archiveArgument = cliArguments.find((argument) => argument !== '--docker');
const archivePath = path.resolve(
  root,
  archiveArgument ?? path.join('artifacts', `${plugin.id}-${packageJson.version}.zip`)
);

if (!fs.existsSync(archivePath)) {
  throw new Error(`[validate-plugin] archive does not exist: ${archivePath}`);
}

const strictArguments = process.env.PLUGIN_VALIDATOR_STRICT === '1' ? ['-strict'] : [];
const command = useDocker ? 'docker' : 'npx';
const args = useDocker
  ? [
      'run',
      '--pull=always',
      '--rm',
      '--platform',
      process.env.PLUGIN_VALIDATOR_PLATFORM ?? 'linux/amd64',
      '-v',
      `${archivePath}:/archive.zip:ro`,
      '-v',
      `${root}:/source_code:ro`,
      'grafana/plugin-validator-cli',
      '-sourceCodeUri',
      'file:///source_code',
      ...strictArguments,
      '/archive.zip',
    ]
  : [
      '-y',
      '@grafana/plugin-validator@latest',
      '-sourceCodeUri',
      pathToFileURL(root).href,
      ...strictArguments,
      archivePath,
    ];

const result = spawnSync(command, args, { cwd: root, stdio: 'inherit' });
if (result.error) {
  throw result.error;
}
process.exitCode = result.status ?? 1;
