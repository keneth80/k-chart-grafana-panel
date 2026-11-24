const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const versionPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const tagPattern = /^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

const verifyReleaseTag = (tag, packageVersion) => {
  if (!versionPattern.test(packageVersion)) {
    throw new Error(`package.json version must use X.Y.Z format, received ${packageVersion}.`);
  }
  if (!tagPattern.test(tag)) {
    throw new Error(`release tag must use vX.Y.Z format, received ${tag || '<empty>'}.`);
  }

  const expectedTag = `v${packageVersion}`;
  if (tag !== expectedTag) {
    throw new Error(`release tag ${tag} does not match package.json version ${packageVersion}.`);
  }

  return expectedTag;
};

if (require.main === module) {
  const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const releaseTag = process.argv[2] ?? process.env.GITHUB_REF_NAME ?? '';

  try {
    const verifiedTag = verifyReleaseTag(releaseTag, packageJson.version);
    console.log(`Verified release tag ${verifiedTag}`);
  } catch (error) {
    console.error(`[verify-release-tag] ${error.message}`);
    process.exitCode = 1;
  }
}

module.exports = { verifyReleaseTag };
