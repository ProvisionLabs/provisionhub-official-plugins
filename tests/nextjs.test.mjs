import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cp, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const repository = fileURLToPath(new URL('../', import.meta.url));
const binary = process.env.PROVISIONHUB_BIN;
assert.ok(binary && path.isAbsolute(binary), 'Set PROVISIONHUB_BIN to an absolute ProvisionHub executable path');
const plugins = path.join(repository, 'plugins');
const frontendFiles = [
  '.gitignore', 'README.md', 'eslint.config.mjs', 'next.config.ts', 'package.json',
  'postcss.config.mjs', 'src/app/globals.css', 'src/app/layout.tsx',
  'src/app/page.tsx', 'tsconfig.json',
].map((name) => `frontend/${name}`).sort();
const backendFiles = [
  '.gitignore', 'README.md', 'nest-cli.json', 'package.json',
  'src/app.controller.ts', 'src/app.module.ts', 'src/app.service.ts',
  'src/main.ts', 'tsconfig.build.json', 'tsconfig.json',
].map((name) => `backend/${name}`).sort();

function cli(args, success = true) {
  const result = spawnSync(binary, args, { encoding: 'utf8', timeout: 30_000 });
  assert.ifError(result.error);
  if (success) assert.equal(result.status, 0, result.stderr || result.stdout);
  else assert.notEqual(result.status, 0, `command unexpectedly succeeded: ${args.join(' ')}`);
  return result;
}

async function snapshot(directory) {
  const files = {};
  for (const entry of await readdir(directory, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const filename = path.join(entry.parentPath, entry.name);
    files[path.relative(directory, filename)] = createHash('sha256').update(await readFile(filename)).digest('hex');
  }
  return files;
}

function npm(args, cwd, timeout = 180_000) {
  const command = process.platform === 'win32' ? process.env.ComSpec || 'cmd.exe' : 'npm';
  const commandArgs = process.platform === 'win32' ? ['/d', '/s', '/c', `npm ${args.join(' ')}`] : args;
  const result = spawnSync(command, commandArgs, { cwd, encoding: 'utf8', timeout });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr || result.stdout);
}

test('official Next.js plugin plans and generates alongside NestJS, then builds and serves', { timeout: 360_000 }, async (t) => {
  const base = await mkdtemp(path.join(tmpdir(), 'provisionhub-nextjs-'));
  let app;
  t.after(async () => {
    if (app && app.exitCode === null && app.signalCode === null) {
      const exited = new Promise((resolve) => app.once('exit', resolve));
      app.kill();
      await exited;
    }
    await rm(base, { recursive: true, force: true });
  });
  const destination = path.join(base, 'sample web café');
  const file = path.join(destination, 'provisionhub.yaml');
  cli(['project', 'init', '--name', 'sample-web', '--path', destination, '--backend', 'nestjs', '--frontend', 'nextjs']);
  const before = await snapshot(base);
  const planArgs = ['project', 'plan', '--file', file, '--plugins', plugins, '--output', 'json'];
  const rawPlan = cli(planArgs).stdout;
  const plan = JSON.parse(rawPlan);
  assert.equal(rawPlan, cli(planArgs).stdout, 'plan must be deterministic');
  assert.equal(plan.status, 'planned');
  assert.equal(plan.executable, true);
  assert.deepEqual(plan.technologies.map(({ id }) => id), ['nestjs', 'nextjs']);
  assert.deepEqual(plan.diagnostics, []);
  assert.ok(plan.operations.every(({ status }) => status === 'supported'));
  const operations = plan.operations.filter(({ type }) => type === 'generate_file');
  assert.equal(operations.length, 20);
  const targets = operations.flatMap(({ targetPaths }) => targetPaths).sort();
  assert.deepEqual(targets, [...backendFiles, ...frontendFiles].sort());
  assert.equal(new Set(targets.map((target) => target.toLowerCase())).size, targets.length);
  for (const operation of operations) {
    const frontend = operation.technology === 'nextjs';
    assert.equal(operation.pluginId, frontend ? 'official-nextjs' : 'official-nestjs');
    assert.ok(operation.dependencies.includes(frontend ? 'frontend:nextjs' : 'backend:nestjs'));
    assert.ok(operation.sourceDigest);
  }
  assert.deepEqual(await snapshot(base), before, 'planning wrote files');

  const applyArgs = ['project', 'apply', '--file', file, '--plugins', plugins];
  assert.match(cli(applyArgs, false).stderr, /requires a terminal/);
  assert.deepEqual(await snapshot(base), before, 'unapproved apply wrote files');
  cli([...applyArgs, '--yes']);
  const generated = await snapshot(base);
  assert.equal(Object.keys(generated).length, 21, 'only manifest and twenty declared files should exist');
  assert.deepEqual(await readdir(base), [path.basename(destination)]);
  for (const target of targets) {
    const content = await readFile(path.join(destination, target), 'utf8');
    assert.ok(!content.includes('{{projectName}}'), `${target} contains an unresolved variable`);
  }
  const frontend = path.join(destination, 'frontend');
  const backend = path.join(destination, 'backend');
  assert.equal(JSON.parse(await readFile(path.join(frontend, 'package.json'), 'utf8')).name, 'sample-web');
  assert.equal(JSON.parse(await readFile(path.join(backend, 'package.json'), 'utf8')).name, 'sample-web');
  assert.match(await readFile(path.join(frontend, 'src/app/page.tsx'), 'utf8'), /sample-web/);
  assert.match(cli([...applyArgs, '--yes'], false).stderr, /refusing overwrite/);
  assert.deepEqual(await snapshot(base), generated, 'repeat apply changed existing files');

  const conflict = path.join(base, 'conflict');
  cli(['project', 'init', '--name', 'conflict', '--path', conflict, '--backend', 'nestjs', '--frontend', 'nextjs']);
  await mkdir(path.join(conflict, 'frontend'), { recursive: true });
  await writeFile(path.join(conflict, 'frontend', 'package.json'), 'preserve me');
  const conflictBefore = await snapshot(conflict);
  cli(['project', 'apply', '--file', path.join(conflict, 'provisionhub.yaml'), '--plugins', plugins, '--yes'], false);
  assert.deepEqual(await snapshot(conflict), conflictBefore, 'conflict published partial files');

  const linked = path.join(base, 'linked');
  const outside = path.join(base, 'outside');
  cli(['project', 'init', '--name', 'linked', '--path', linked, '--backend', 'nestjs', '--frontend', 'nextjs']);
  await mkdir(outside);
  try {
    await symlink(outside, path.join(linked, 'frontend'), process.platform === 'win32' ? 'junction' : 'dir');
    cli(['project', 'apply', '--file', path.join(linked, 'provisionhub.yaml'), '--plugins', plugins, '--yes'], false);
    assert.deepEqual(await readdir(outside), [], 'generation escaped through linked output parent');
  } catch (error) {
    if (error.code !== 'EPERM' && error.code !== 'ENOTSUP') throw error;
    t.diagnostic(`Output-link check unavailable: ${error.code}`);
  }

  const invalid = path.join(base, 'invalid-plugins');
  await cp(path.join(plugins, 'nextjs'), path.join(invalid, 'nextjs'), { recursive: true });
  await cp(path.join(plugins, 'nestjs'), path.join(invalid, 'nestjs'), { recursive: true });
  const definitionPath = path.join(invalid, 'nextjs', 'plugin.yaml');
  const definition = await readFile(definitionPath, 'utf8');
  for (const unsafe of ['../escape', '/escape', 'C:/escape']) {
    await writeFile(definitionPath, definition.replace('destination: frontend/package.json', `destination: ${unsafe}`));
    cli(['project', 'plan', '--file', file, '--plugins', invalid], false);
  }
  await writeFile(definitionPath, definition.replace('source: templates/package.json.tmpl', 'source: ../escape'));
  cli(['project', 'plan', '--file', file, '--plugins', invalid], false);
  await writeFile(definitionPath, definition.replace('destination: frontend/package.json', 'destination: backend/package.json'));
  assert.match(cli(['project', 'plan', '--file', file, '--plugins', invalid], false).stderr, /conflicts with operation/);

  // ProvisionHub has only generated files. npm runs here as an explicit integration check.
  npm(['install', '--no-audit', '--no-fund'], frontend);
  npm(['run', 'lint'], frontend);
  npm(['run', 'build'], frontend);
  const reservation = createServer();
  await new Promise((resolve) => reservation.listen(0, '127.0.0.1', resolve));
  const port = reservation.address().port;
  await new Promise((resolve, reject) => reservation.close((error) => error ? reject(error) : resolve()));
  app = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-p', String(port), '-H', '127.0.0.1'], {
    cwd: frontend, stdio: ['ignore', 'pipe', 'pipe'],
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
  assert.match(await response.text(), /sample-web/);
});
