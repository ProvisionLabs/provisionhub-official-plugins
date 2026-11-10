import assert from 'node:assert/strict';
import { spawnSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { createServer } from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const binary = process.env.PROVISIONHUB_BIN;
assert.ok(binary && path.isAbsolute(binary), 'Set PROVISIONHUB_BIN to an absolute built ProvisionHub binary path');
export const plugins = fileURLToPath(new URL('../plugins', import.meta.url));

export function cli(args, success = true, env = {}) {
  const result = spawnSync(binary, args, { encoding: 'utf8', timeout: 30_000, env: { ...process.env, ...env } });
  assert.ifError(result.error);
  if (success) assert.equal(result.status, 0, result.stderr || result.stdout);
  else assert.notEqual(result.status, 0, 'command unexpectedly succeeded');
  return result;
}

export function flags(destination, components, settings = [], connections = [], connectionSettings = []) {
  return ['--name', 'demo', '--path', destination, '--plugins', plugins,
    ...components.flatMap(c => ['--component', c]), ...settings.flatMap(s => ['--set', s]),
    ...connections.flatMap(c => ['--connect', c]), ...connectionSettings.flatMap(s => ['--connection-set', s])];
}

export async function snapshot(directory) {
  const files = {};
  for (const entry of await readdir(directory, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const filename = path.join(entry.parentPath, entry.name);
    files[path.relative(directory, filename)] = createHash('sha256').update(await readFile(filename)).digest('hex');
  }
  return files;
}

export function npm(args, cwd) {
  const command = process.platform === 'win32' ? process.env.ComSpec || 'cmd.exe' : 'npm';
  // Only fixed test commands enter cmd.exe; paths travel through cwd.
  const commandArgs = process.platform === 'win32' ? ['/d', '/s', '/c', `npm ${args.join(' ')}`] : args;
  const result = spawnSync(command, commandArgs, { cwd, encoding: 'utf8', timeout: 240_000,
    env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' } });
  assert.ifError(result.error);
  assert.equal(result.status, 0, `${cwd}: ${result.stderr || result.stdout}`);
}

export async function serve(cwd, command, expected) {
  const reservation = createServer();
  await new Promise(resolve => reservation.listen(0, '127.0.0.1', resolve));
  const port = reservation.address().port;
  await new Promise((resolve, reject) => reservation.close(e => e ? reject(e) : resolve()));
  const args = command === 'next' ? ['node_modules/next/dist/bin/next', 'start', '-p', String(port), '-H', '127.0.0.1'] : ['dist/main.js'];
  const app = spawn(process.execPath, args, { cwd, env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', NEXT_TELEMETRY_DISABLED: '1' }, stdio: ['ignore', 'pipe', 'pipe'] });
  const stop = async () => {
    if (app.exitCode === null && app.signalCode === null) {
      const exited = new Promise(resolve => app.once('exit', resolve)); app.kill(); await exited;
    }
  };
  try {
    let logs = '';
    app.stdout.on('data', chunk => { logs += chunk; }); app.stderr.on('data', chunk => { logs += chunk; });
    let response;
    for (let i = 0; i < 100; i++) {
      assert.equal(app.exitCode, null, logs);
      try { response = await fetch(`http://127.0.0.1:${port}/`, { signal: AbortSignal.timeout(1000) }); break; }
      catch { await new Promise(resolve => setTimeout(resolve, 100)); }
    }
    assert.ok(response, logs); assert.equal(response.status, 200);
    assert.ok((await response.text()).includes(expected), 'unexpected HTTP response');
  } finally { await stop(); }
}
