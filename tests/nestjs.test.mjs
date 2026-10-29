import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, readdir, rm, writeFile, cp, mkdir, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const repository = fileURLToPath(new URL('../', import.meta.url));
const binary = process.env.PROVISIONHUB_BIN;
assert.ok(binary && path.isAbsolute(binary), 'Set PROVISIONHUB_BIN to an absolute built ProvisionHub executable path');
const pluginDirectory = path.join(repository, 'plugins');
const expectedFiles = [
  '.gitignore', 'README.md', 'nest-cli.json', 'package.json',
  'src/app.controller.ts', 'src/app.module.ts', 'src/app.service.ts',
  'src/main.ts', 'tsconfig.build.json', 'tsconfig.json',
].map((file) => `backend/${file}`).sort();

function run(args, { cwd, success = true } = {}) {
  const result = spawnSync(binary, args, { cwd, encoding: 'utf8', timeout: 30_000 });
  assert.ifError(result.error);
  if (success) assert.equal(result.status, 0, result.stderr || result.stdout);
  else assert.notEqual(result.status, 0, 'command unexpectedly succeeded');
  return result;
}

async function snapshot(directory) {
  const files = {};
  for (const entry of await readdir(directory, { recursive: true, withFileTypes: true })) {
    if (entry.isFile()) {
      const filename = path.join(entry.parentPath, entry.name);
      files[path.relative(directory, filename)] = createHash('sha256').update(await readFile(filename)).digest('hex');
    }
  }
  return files;
}

test('official NestJS discovery, approval, safe generation, build and HTTP endpoint', { timeout: 240_000 }, async (t) => {
  const base = await mkdtemp(path.join(tmpdir(), 'provisionhub-nestjs-'));
  let app;
  t.after(async () => {
    if (app && app.exitCode === null && app.signalCode === null) {
      const exited = new Promise((resolve) => app.once('exit', resolve));
      app.kill();
      await exited;
    }
    await rm(base, { recursive: true, force: true });
  });
  const destination = path.join(base, 'sample api café');
  const file = path.join(destination, 'provisionhub.yaml');
  run(['project', 'init', '--name', 'sample-api', '--path', destination, '--backend', 'nestjs']);
  const before = await snapshot(base);
  const planArgs = ['project', 'plan', '--file', file, '--plugins', pluginDirectory, '--output', 'json'];
  const rawPlan = run(planArgs).stdout;
  const plan = JSON.parse(rawPlan);
  assert.equal(rawPlan, run(planArgs).stdout, 'plan must be deterministic');
  assert.equal(plan.status, 'planned');
  assert.equal(plan.executable, true);
  assert.deepEqual(plan.technologies.map(({ id }) => id), ['nestjs']);
  assert.equal(plan.diagnostics.length, 0);
  assert.ok(plan.operations.every(({ status }) => status === 'supported'));
  const operations = plan.operations.filter(({ type }) => type === 'generate_file');
  assert.deepEqual(operations.flatMap(({ targetPaths }) => targetPaths).sort(), expectedFiles);
  assert.ok(operations.every(({ pluginId, dependencies }) => pluginId === 'official-nestjs' && dependencies.includes('backend:nestjs')));
  assert.deepEqual(await snapshot(base), before, 'planning wrote files');

  const applyArgs = ['project', 'apply', '--file', file, '--plugins', pluginDirectory];
  assert.match(run(applyArgs, { success: false }).stderr, /requires a terminal/);
  assert.deepEqual(await snapshot(base), before, 'unapproved generation wrote files');
  run([...applyArgs, '--yes']);
  const generated = await snapshot(base);
  assert.equal(Object.keys(generated).length, 11, 'only manifest and ten declared files should exist');
  assert.deepEqual(await readdir(base), [path.basename(destination)], 'unexpected files outside destination');
  for (const target of expectedFiles) {
    const content = await readFile(path.join(destination, target), 'utf8');
    assert.ok(!content.includes('{{projectName}}'), `${target} has an unresolved variable`);
  }
  const backend = path.join(destination, 'backend');
  assert.equal(JSON.parse(await readFile(path.join(backend, 'package.json'), 'utf8')).name, 'sample-api');
  assert.match(run([...applyArgs, '--yes'], { success: false }).stderr, /refusing overwrite/);
  assert.deepEqual(await snapshot(base), generated, 'repeated apply changed existing files');

  // A conflict must stop the entire plan, even when other outputs do not exist.
  const conflict = path.join(base, 'conflict');
  run(['project', 'init', '--name', 'conflict', '--path', conflict, '--backend', 'nestjs']);
  await mkdir(path.join(conflict, 'backend', 'src'), { recursive: true });
  await writeFile(path.join(conflict, 'backend', 'src', 'main.ts'), 'preserve me');
  const conflictBefore = await snapshot(conflict);
  run(['project', 'apply', '--file', path.join(conflict, 'provisionhub.yaml'), '--plugins', pluginDirectory, '--yes'], { success: false });
  assert.deepEqual(await snapshot(conflict), conflictBefore, 'conflict published partial files');

  const linked = path.join(base, 'linked-output');
  const outside = path.join(base, 'outside');
  run(['project', 'init', '--name', 'linked', '--path', linked, '--backend', 'nestjs']);
  await mkdir(outside);
  try {
    await symlink(outside, path.join(linked, 'backend'), process.platform === 'win32' ? 'junction' : 'dir');
    run(['project', 'apply', '--file', path.join(linked, 'provisionhub.yaml'), '--plugins', pluginDirectory, '--yes'], { success: false });
    assert.deepEqual(await readdir(outside), [], 'generation escaped through linked output parent');
  } catch (error) {
    if (error.code !== 'EPERM' && error.code !== 'ENOTSUP') throw error;
    t.diagnostic(`Output-link check unavailable: ${error.code}`);
  }

  const mixed = path.join(base, 'mixed');
  run(['project', 'init', '--name', 'mixed', '--path', mixed, '--backend', 'nestjs', '--frontend', 'nextjs']);
  const mixedFile = path.join(mixed, 'provisionhub.yaml');
  const mixedPlan = JSON.parse(run(['project', 'plan', '--file', mixedFile, '--plugins', pluginDirectory, '--output', 'json']).stdout);
  assert.equal(mixedPlan.executable, false, 'unsupported frontend must prevent execution');
  run(['project', 'apply', '--file', mixedFile, '--plugins', pluginDirectory, '--yes'], { success: false });
  assert.deepEqual(await readdir(mixed), ['provisionhub.yaml']);

  // Exercise the real loader with malicious variants without editing the plugin.
  const invalidPlugins = path.join(base, 'invalid-plugins');
  await cp(path.join(pluginDirectory, 'nestjs'), path.join(invalidPlugins, 'nestjs'), { recursive: true });
  const definitionPath = path.join(invalidPlugins, 'nestjs', 'plugin.yaml');
  const definition = await readFile(definitionPath, 'utf8');
  for (const unsafe of ['../escape.json', '/escape.json', 'C:/escape.json']) {
    await writeFile(definitionPath, definition.replace('destination: backend/package.json', `destination: ${unsafe}`));
    run(['project', 'plan', '--file', file, '--plugins', invalidPlugins], { success: false });
  }
  await writeFile(definitionPath, definition.replace('source: templates/package.json.tmpl', 'source: ../escape.json'));
  run(['project', 'plan', '--file', file, '--plugins', invalidPlugins], { success: false });

  // Generation above never invoked npm. These are explicit integration checks.
  for (const args of [['install', '--no-audit', '--no-fund'], ['run', 'build']]) {
    // On Windows npm is a .cmd file. Only these fixed commands enter cmd.exe.
    const result = spawnSync(process.platform === 'win32' ? process.env.ComSpec || 'cmd.exe' : 'npm',
      process.platform === 'win32' ? ['/d', '/s', '/c', `npm ${args.join(' ')}`] : args, {
      cwd: backend, encoding: 'utf8', timeout: 120_000,
    });
    assert.ifError(result.error);
    assert.equal(result.status, 0, result.stderr || result.stdout);
  }
  // Reserve a port briefly, then pass it to the child.
  const { createServer } = await import('node:net');
  const reservation = createServer();
  await new Promise((resolve) => reservation.listen(0, '127.0.0.1', resolve));
  const port = reservation.address().port;
  await new Promise((resolve, reject) => reservation.close((error) => error ? reject(error) : resolve()));
  app = spawn(process.execPath, ['dist/main.js'], {
    cwd: backend, env: { ...process.env, PORT: String(port), HOST: '127.0.0.1' }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  let logs = '';
  app.stdout.on('data', (chunk) => { logs += chunk; });
  app.stderr.on('data', (chunk) => { logs += chunk; });
  let response;
  for (let attempt = 0; attempt < 100; attempt++) {
    assert.equal(app.exitCode, null, logs);
    try {
      response = await fetch(`http://127.0.0.1:${port}/`, { signal: AbortSignal.timeout(1000) });
      break;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  assert.ok(response, `application did not start: ${logs}`);
  assert.equal(response.status, 200);
  assert.equal(await response.text(), 'Hello from sample-api!');
});
