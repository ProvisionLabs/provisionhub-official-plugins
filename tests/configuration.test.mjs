import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { cli, flags, plugins, snapshot } from './helpers.mjs';

export const components = ['api:backend:nestjs', 'billing:backend:nestjs', 'web:frontend:nextjs', 'admin:frontend:nextjs'];
export const settings = ['api.greeting=Welcome', 'api.port=4001', 'admin.welcomeMessage=Administration', 'admin.showCredits=false'];

test('four configured components are deterministic, isolated, approved and metadata-free', async t => {
  const base = await mkdtemp(path.join(tmpdir(), 'provisionhub-configuration-'));
  t.after(() => rm(base, { recursive: true, force: true }));
  const blocked = path.join(base, 'blocked-data'); await writeFile(blocked, 'keep');
  const env = { PROVISIONHUB_DATA_DIR: blocked };
  const destination = path.join(base, 'generated café');
  const input = flags(destination, components, settings);
  const before = await snapshot(base);
  const raw = cli(['project', 'plan', ...input, '--output', 'json'], true, env).stdout;
  assert.equal(raw, cli(['project', 'plan', ...input, '--output', 'json'], true, env).stdout);
  const reordered = flags(destination, [...components].reverse(), [...settings].reverse());
  assert.equal(raw, cli(['project', 'plan', ...reordered, '--output', 'json'], true, env).stdout);
  const plan = JSON.parse(raw); assert.equal(plan.executable, true);
  assert.deepEqual(plan.components.map(c => c.id), ['component/admin', 'component/api', 'component/billing', 'component/web']);
  assert.deepEqual(plan.components.find(c => c.name === 'api').configuration, { greeting: 'Welcome', port: 4001 });
  assert.deepEqual(plan.components.find(c => c.name === 'billing').configuration, { greeting: 'Hello', port: 3000 });
  const files = plan.operations.filter(op => op.type === 'generate_file'); assert.equal(files.length, 40);
  assert.equal(new Set(files.map(f => f.id)).size, 40);
  assert.ok(files.every(f => f.renderedDigest && f.targetPaths[0].startsWith(`${f.componentId.split('/')[1]}/`)));
  assert.deepEqual(await snapshot(base), before, 'planning wrote files');
  assert.match(cli(['project', 'apply', ...input], false, env).stderr, /requires a terminal/);
  assert.deepEqual(await snapshot(base), before, 'unapproved apply wrote files');
  cli(['project', 'apply', ...input, '--yes'], true, env);
  assert.deepEqual((await readdir(destination)).sort(), ['admin', 'api', 'billing', 'web']);
  const expected = {
    'api/src/main.ts': 'process.env.PORT ?? 4001', 'billing/src/main.ts': 'process.env.PORT ?? 3000',
    'api/README.md': 'http://127.0.0.1:4001/', 'billing/README.md': 'http://127.0.0.1:3000/',
    'api/src/app.service.ts': '"Welcome" +', 'billing/src/app.service.ts': '"Hello" +',
    'admin/src/app/page.tsx': 'false &&', 'web/src/app/page.tsx': 'true &&',
  };
  for (const [file, value] of Object.entries(expected)) assert.ok((await readFile(path.join(destination, file), 'utf8')).includes(value), file);
  assert.ok((await readFile(path.join(destination, 'admin/src/app/page.tsx'), 'utf8')).includes('Administration'));
  assert.ok((await readFile(path.join(destination, 'web/src/app/page.tsx'), 'utf8')).includes('Welcome to your new Next.js application.'));
  for (const name of ['api', 'billing', 'web', 'admin']) assert.equal(JSON.parse(await readFile(path.join(destination, name, 'package.json'), 'utf8')).name, name);
  assert.equal(Object.keys(await snapshot(destination)).length, 40, 'unexpected metadata or application lockfile');
  const second = path.join(base, 'second'); cli(['project', 'apply', ...flags(second, components, settings), '--yes'], true, env);
  assert.deepEqual(await snapshot(destination), await snapshot(second));
  const generated = await snapshot(destination);
  assert.match(cli(['project', 'apply', ...input, '--yes'], false, env).stderr, /refusing overwrite/);
  assert.deepEqual(await snapshot(destination), generated);
  for (const setting of ['absent.port=3', 'api.port=0', 'api.port=3.5', 'admin.showCredits=yes', 'web.unknown=true']) {
    cli(['project', 'plan', ...flags(path.join(base, 'invalid'), components, [setting])], false, env);
  }
  cli(['project', 'plan', ...input, '--set', 'api.port=5000'], false, env);
  assert.equal(await readFile(blocked, 'utf8'), 'keep', 'local generation touched persistence');
});

test('conflicts, linked outputs and malicious paths cannot publish files', async t => {
  const base = await mkdtemp(path.join(tmpdir(), 'provisionhub-safety-'));
  t.after(() => rm(base, { recursive: true, force: true }));
  const destination = path.join(base, 'conflict'); await mkdir(path.join(destination, 'api/src'), { recursive: true });
  await writeFile(path.join(destination, 'api/src/main.ts'), 'preserve me');
  const before = await snapshot(destination);
  cli(['project', 'apply', ...flags(destination, components), '--yes'], false);
  assert.deepEqual(await snapshot(destination), before);
  const outside = path.join(base, 'outside'); await mkdir(outside);
  const linked = path.join(base, 'linked'); await mkdir(linked);
  try {
    await symlink(outside, path.join(linked, 'api'), process.platform === 'win32' ? 'junction' : 'dir');
    cli(['project', 'apply', ...flags(linked, components), '--yes'], false);
    assert.deepEqual(await readdir(outside), []);
  } catch (e) { if (!['EPERM', 'ENOTSUP'].includes(e.code)) throw e; t.diagnostic(`symlink unavailable: ${e.code}`); }
  const invalid = path.join(base, 'invalid-plugins'); await cp(plugins, invalid, { recursive: true });
  const filename = path.join(invalid, 'nestjs/plugin.yaml'); const manifest = await readFile(filename, 'utf8');
  for (const unsafe of ['../escape.json', '/escape.json', 'C:/escape.json']) {
    await writeFile(filename, manifest.replace('destination: backend/package.json', `destination: ${unsafe}`));
    cli(['project', 'plan', ...flags(path.join(base, 'unsafe'), components), '--plugins', invalid], false);
  }
  await writeFile(filename, manifest.replace('source: templates/package.json.tmpl', 'source: ../escape'));
  cli(['project', 'plan', ...flags(path.join(base, 'unsafe'), components), '--plugins', invalid], false);
});
