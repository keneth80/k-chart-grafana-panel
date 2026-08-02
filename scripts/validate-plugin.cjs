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
// CI validates the exact public commit. Local Docker keeps the repository layout but hides installed dependencies.
const githubSourceUri =
  process.env.GITHUB_REPOSITORY && process.env.GITHUB_SHA
    ? `${process.env.GITHUB_SERVER_URL ?? 'https://github.com'}/${process.env.GITHUB_REPOSITORY}/tree/${process.env.GITHUB_SHA}`
    : undefined;
const sourceCodeUri = githubSourceUri ?? (useDocker ? 'file:///source_code' : pathToFileURL(root).href);
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
      ...(githubSourceUri
        ? []
        : [
            '-v',
            `${root}:/source_code:ro`,
            '--tmpfs',
            '/source_code/node_modules',
          ]),
      'grafana/plugin-validator-cli',
      '-sourceCodeUri',
      sourceCodeUri,
      ...strictArguments,
      '/archive.zip',
    ]
  : [
      '-y',
      '@grafana/plugin-validator@latest',
      '-sourceCodeUri',
      sourceCodeUri,
      ...strictArguments,
      archivePath,
    ];

const result = spawnSync(command, args, { cwd: root, stdio: 'inherit' });
if (result.error) {
  throw result.error;
}
process.exitCode = result.status ?? 1;
