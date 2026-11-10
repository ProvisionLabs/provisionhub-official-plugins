import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { cli, flags, snapshot } from './helpers.mjs';

const components = ['api-a:backend:nestjs', 'api-b:backend:nestjs', 'web:frontend:nextjs', 'admin:frontend:nextjs'];
const componentSettings = ['api-a.port=4101', 'api-b.port=4102'];

test('HTTP connections select named instances, preserve defaults and create only declared integration files', async t => {
  const base = await mkdtemp(path.join(tmpdir(), 'provisionhub-connections-'));
  t.after(() => rm(base, { recursive: true, force: true }));
  const blocked = path.join(base, 'blocked-data'); await writeFile(blocked, 'keep');
  const env = { PROVISIONHUB_DATA_DIR: blocked };
  const unconnected = path.join(base, 'unconnected');
  cli(['project', 'apply', ...flags(unconnected, components, componentSettings), '--yes'], true, env);
  const originalFiles = await snapshot(unconnected); assert.equal(Object.keys(originalFiles).length, 40);
  for (const scenario of ['shared', 'distinct']) {
    const target = scenario === 'shared' ? 'api-a' : 'api-b';
    const destination = path.join(base, scenario);
    const declarations = ['web:api-a:http', `admin:${target}:http`];
    const settings = ['web:api-a:http.serverHost=127.0.0.1', `admin:${target}:http.serverHost=api.example.test`];
    const input = flags(destination, components, componentSettings, declarations, settings);
    const before = await snapshot(base);
    const raw = cli(['project', 'plan', ...input, '--output', 'json'], true, env).stdout;
    assert.equal(raw, cli(['project', 'plan', ...flags(destination, [...components].reverse(), [...componentSettings].reverse(), [...declarations].reverse(), [...settings].reverse()), '--output', 'json'], true, env).stdout);
    const plan = JSON.parse(raw); assert.equal(plan.executable, true);
    assert.equal(plan.connections.length, 2);
    assert.equal(plan.connections.find(c => c.from === 'web').metadata.port, 4101);
    assert.equal(plan.connections.find(c => c.from === 'admin').metadata.port, target === 'api-a' ? 4101 : 4102);
    assert.equal(plan.operations.filter(op => op.type === 'connect_components').length, 2);
    assert.equal(plan.operations.filter(op => op.type === 'generate_file').length, 44);
    assert.deepEqual(await snapshot(base), before, 'planning wrote files');
    assert.notEqual(cli(['project', 'apply', ...input], false, env).status, 0);
    assert.deepEqual(await snapshot(base), before, 'unapproved generation wrote files');
    cli(['project', 'apply', ...input, '--yes'], true, env);
    assert.deepEqual((await readdir(destination)).sort(), ['admin', 'api-a', 'api-b', 'web']);
    assert.match(await readFile(path.join(destination, 'web/.env.local'), 'utf8'), /^API_ORIGIN=http:\/\/127\.0\.0\.1:4101$/m);
    const admin = await readFile(path.join(destination, 'admin/.env.local'), 'utf8');
    assert.ok(admin.includes(`admin -> ${target}`)); assert.ok(admin.includes(`API_ORIGIN=http://api.example.test:${target === 'api-a' ? 4101 : 4102}`));
    assert.ok(!/^NEXT_PUBLIC_/m.test(admin));
    for (const name of ['web', 'admin']) assert.equal(await readFile(path.join(destination, name, '.env.local'), 'utf8'), await readFile(path.join(destination, name, '.env.example'), 'utf8'));
    const generated = await snapshot(destination);
    assert.equal(Object.keys(generated).length, 44, 'unexpected project metadata or lockfile');
    for (const [name, digest] of Object.entries(originalFiles)) assert.equal(generated[name], digest, `connections altered base file ${name}`);
    assert.match(cli(['project', 'apply', ...input, '--yes'], false, env).stderr, /refusing overwrite/);
    assert.deepEqual(await snapshot(destination), generated);
    const second = path.join(base, `${scenario}-repeat`); cli(['project', 'apply', ...flags(second, components, componentSettings, declarations, settings), '--yes'], true, env);
    assert.deepEqual(await snapshot(second), generated);
  }
  for (const [declarations, settings] of [
    [['web:api-a:http'], []],
    [['web:missing:http'], []],
    [['web:web:http'], []],
    [['api-a:web:http'], []],
    [['web:api-a:unknown'], []],
    [['web:api-a:http', 'web:api-a:http'], []],
    [['web:api-a:http'], ['web:api-a:http.serverHost=http://localhost']],
    [['web:api-a:http'], ['web:api-a:http.serverHost=localhost:4101']],
  ]) cli(['project', 'plan', ...flags(path.join(base, 'invalid'), components, componentSettings, declarations, settings)], false, env);
  assert.equal(await readFile(blocked, 'utf8'), 'keep');
});
