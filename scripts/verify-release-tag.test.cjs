const assert = require('node:assert/strict');
const test = require('node:test');

const { verifyReleaseTag } = require('./verify-release-tag.cjs');

test('accepts an exact vX.Y.Z package version match', () => {
  assert.equal(verifyReleaseTag('v1.2.3', '1.2.3'), 'v1.2.3');
});

test('rejects a tag that does not match the package version', () => {
  assert.throws(
    () => verifyReleaseTag('v1.2.4', '1.2.3'),
    /release tag v1\.2\.4 does not match package\.json version 1\.2\.3\./
  );
});

for (const tag of ['1.2.3', 'v1.2', 'v01.2.3', 'v1.2.3-beta.1']) {
  test(`rejects malformed release tag ${tag}`, () => {
    assert.throws(() => verifyReleaseTag(tag, '1.2.3'), /release tag must use vX\.Y\.Z format/);
  });
}

test('rejects a package version outside strict X.Y.Z format', () => {
  assert.throws(
    () => verifyReleaseTag('v1.2.3-beta.1', '1.2.3-beta.1'),
    /package\.json version must use X\.Y\.Z format/
  );
});
