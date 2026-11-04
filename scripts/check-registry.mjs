import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

const index = JSON.parse(readFileSync('registry.json', 'utf8'));
const built = JSON.parse(readFileSync('dist/registry.json', 'utf8'));
assert.deepEqual(index, built, 'registry must match validated package identities, versions and checksums');
for (const p of built.plugins) for (const v of p.versions) {
  const filename = `${p.manifestId}-v${v.version}.tar.gz`;
  if (!existsSync(`dist/${filename}`)) continue; // Historical immutable release; source is no longer the current plugin tree.
  const digest = createHash('sha256').update(readFileSync(`dist/${filename}`)).digest('hex');
  assert.equal(digest, v.sha256, `artifact checksum mismatch for ${filename}`);
  assert.equal(readFileSync(`dist/${filename}.sha256`, 'utf8'), `${digest}  ${filename}\n`);
}
const releases = new Map(index.plugins.flatMap(p => p.versions.map(v => [`${p.manifestId}-v${v.version}`, { ...v, id: p.id }])));
if (process.argv[2]) {
  assert(releases.has(process.argv[2]), 'tag must identify an exact registry release');
  assert(existsSync(`dist/${process.argv[2]}.tar.gz`), 'requested tag must have a validated current package');
}

// Published entries must survive future index changes byte-for-byte as metadata.
const tags = execFileSync('git', ['tag', '--list', 'official-*-v*'], { encoding: 'utf8' }).trim().split('\n').filter(Boolean);
for (const tag of tags) {
  const previous = JSON.parse(execFileSync('git', ['show', `${tag}:registry.json`], { encoding: 'utf8' }));
  for (const p of previous.plugins) for (const v of p.versions) {
    if (`${p.manifestId}-v${v.version}` !== tag) continue;
    assert.deepEqual(releases.get(tag), { ...v, id: p.id }, `published release ${tag} must remain immutable`);
  }
}
console.log(`Validated ${releases.size} official plugin releases`);
