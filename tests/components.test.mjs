import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const repository = fileURLToPath(new URL('../', import.meta.url));
const binary = process.env.PROVISIONHUB_BIN;
assert.ok(binary && path.isAbsolute(binary), 'Set PROVISIONHUB_BIN to an absolute ProvisionHub binary path');
const plugins = path.join(repository, 'plugins');

function cli(args, success = true) {
  const result = spawnSync(binary, args, { encoding: 'utf8', timeout: 30_000 });
  assert.ifError(result.error);
  if (success) assert.equal(result.status, 0, result.stderr || result.stdout);
  else assert.notEqual(result.status, 0, `command unexpectedly succeeded: ${args.join(' ')}`);
  return result;
}

function npm(args, cwd) {
  const command = process.platform === 'win32' ? process.env.ComSpec || 'cmd.exe' : 'npm';
  const commandArgs = process.platform === 'win32' ? ['/d', '/s', '/c', `npm ${args.join(' ')}`] : args;
  const result = spawnSync(command, commandArgs, { cwd, encoding: 'utf8', timeout: 240_000 });
  assert.ifError(result.error);
  assert.equal(result.status, 0, `${cwd}: ${result.stderr || result.stdout}`);
}

test('four named NestJS and Next.js components generate and build independently', { timeout: 1_200_000 }, async (t) => {
  const base = await mkdtemp(path.join(tmpdir(), 'provisionhub-components-'));
  t.after(() => rm(base, { recursive: true, force: true }));
  const source = path.join(base, 'source.yaml');
  await writeFile(source, `apiVersion: provisionhub.dev/v1alpha1
kind: Project
metadata:
  name: multi-service-demo
spec:
  components:
    - name: web
      type: frontend
      technology: nextjs
    - name: billing
      type: backend
      technology: nestjs
    - name: admin
      type: frontend
      technology: nextjs
    - name: api
      type: backend
      technology: nestjs
  connections:
    - from: web
      to: api
      type: http
`);
  const destination = path.join(base, 'multi-service-demo');
  cli(['project', 'init', '--from', source, '--path', destination]);
  const file = path.join(destination, 'provisionhub.yaml');
  const args = ['project', 'plan', '--file', file, '--plugins', plugins, '--output', 'json'];
  const raw = cli(args).stdout;
  assert.equal(raw, cli(args).stdout, 'plan must be deterministic');
  const plan = JSON.parse(raw);
  assert.equal(plan.executable, true, JSON.stringify(plan.diagnostics));
  assert.deepEqual(plan.components.map(({ id }) => id), [
    'component/admin', 'component/api', 'component/billing', 'component/web',
  ]);
  assert.deepEqual(plan.connections, [{ from: 'web', to: 'api', type: 'http' }]);
  const files = plan.operations.filter(({ type }) => type === 'generate_file');
  assert.equal(files.length, 40);
  assert.equal(new Set(files.map(({ id }) => id)).size, 40);
  assert.equal(new Set(files.map(({ targetPaths }) => targetPaths[0])).size, 40);
  for (const { componentId, targetPaths, dependencies } of files) {
    const name = componentId.split('/')[1];
    assert.ok(['admin', 'api', 'billing', 'web'].includes(name));
    assert.ok(targetPaths[0].startsWith(`${name}/`));
    assert.ok(dependencies.includes(componentId));
  }
  assert.deepEqual(await readdir(destination), ['provisionhub.yaml'], 'planning wrote output');
  const apply = ['project', 'apply', '--file', file, '--plugins', plugins];
  assert.match(cli(apply, false).stderr, /requires a terminal/);
  assert.deepEqual(await readdir(destination), ['provisionhub.yaml'], 'unapproved generation wrote output');
  cli([...apply, '--yes']);
  assert.deepEqual((await readdir(destination)).sort(), ['admin', 'api', 'billing', 'provisionhub.yaml', 'web']);
  for (const name of ['admin', 'api', 'billing', 'web']) {
    const folder = path.join(destination, name);
    const pkg = JSON.parse(await readFile(path.join(folder, 'package.json'), 'utf8'));
    assert.equal(pkg.name, name);
    const appFile = name === 'admin' || name === 'web' ? 'src/app/page.tsx' : 'src/app.service.ts';
    assert.match(await readFile(path.join(folder, appFile), 'utf8'), new RegExp(name));
    npm(['install', '--no-audit', '--no-fund'], folder);
    npm(['run', 'build'], folder);
    t.diagnostic(`built ${name}`);
  }
  assert.match(cli([...apply, '--yes'], false).stderr, /refusing overwrite/);
});
