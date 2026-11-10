import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { cli, flags, npm } from './helpers.mjs';

async function reservePort() {
  const server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  return { port: server.address().port, release: async () => {
    if (server.listening) await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  } };
}

async function startServer(cwd, kind, reservation) {
  await reservation.release();
  const port = reservation.port;
  const args = kind === 'next' ? ['node_modules/next/dist/bin/next', 'start', '-p', String(port), '-H', '127.0.0.1'] : ['dist/main.js'];
  const env = { ...process.env, HOST: '127.0.0.1', NEXT_TELEMETRY_DISABLED: '1' };
  // Prove the backend uses its generated fallback port, and Next.js reads the
  // generated private .env.local rather than inherited test-process values.
  delete env.PORT; delete env.API_ORIGIN;
  const child = spawn(process.execPath, args, { cwd, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let logs = ''; let failure;
  child.stdout.on('data', chunk => { logs = (logs + chunk).slice(-32_768); });
  child.stderr.on('data', chunk => { logs = (logs + chunk).slice(-32_768); });
  child.on('error', error => { failure = error; });
  const stop = async () => {
    if (child.pid && child.exitCode === null && child.signalCode === null) {
      const exited = new Promise(resolve => child.once('exit', resolve)); child.kill(); await exited;
    }
  };
  const origin = `http://127.0.0.1:${port}`;
  try {
    for (let i = 0; i < 100; i++) {
      assert.ifError(failure); assert.equal(child.exitCode, null, logs);
      try {
        const response = await fetch(origin, { signal: AbortSignal.timeout(1000) });
        await response.text(); if (response.ok) return { origin, stop };
      } catch { /* Startup may not have opened the socket yet. */ }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.fail(`Server did not start: ${logs}`);
  } catch (error) { await stop(); throw error; }
}

// This route is a runtime test fixture, never part of the official plugin output.
// It proves that Next.js server code reads the generated environment and sends
// a real HTTP request to the selected backend, without shipping an HTTP client.
const probeRoute = `export const dynamic = 'force-dynamic';
export async function GET() {
  const origin = process.env.API_ORIGIN;
  if (!origin) return new Response('Missing API_ORIGIN', { status: 500 });
  const response = await fetch(new URL('/', origin), { cache: 'no-store', signal: AbortSignal.timeout(5000) });
  return new Response(await response.text(), { status: response.status, headers: { 'x-provisionhub-origin': origin } });
}
`;

test('generated Next.js servers reach shared and explicitly distinct NestJS instances over HTTP', { timeout: 1_200_000 }, async t => {
  for (const scenario of ['shared', 'distinct']) await t.test(scenario, { timeout: 600_000 }, async t => {
    const base = await mkdtemp(path.join(tmpdir(), `provisionhub-http-${scenario}-`));
    t.after(() => rm(base, { recursive: true, force: true }));
    const reservations = []; const running = [];
    try {
      for (let i = 0; i < 4; i++) reservations.push(await reservePort());
      const [apiA, apiB, webPort, adminPort] = reservations;
      const target = scenario === 'shared' ? 'api-a' : 'api-b';
      const components = ['api-a:backend:nestjs', 'api-b:backend:nestjs', 'web:frontend:nextjs', 'admin:frontend:nextjs'];
      const settings = [`api-a.port=${apiA.port}`, `api-b.port=${apiB.port}`, 'api-a.greeting=First', 'api-b.greeting=Second'];
      const declarations = ['web:api-a:http', `admin:${target}:http`];
      const connectionSettings = ['web:api-a:http.serverHost=127.0.0.1', `admin:${target}:http.serverHost=127.0.0.1`];
      cli(['project', 'apply', ...flags(base, components, settings, declarations, connectionSettings), '--yes']);
      for (const name of ['web', 'admin']) {
        const route = path.join(base, name, 'src/app/connection-check'); await mkdir(route, { recursive: true });
        await writeFile(path.join(route, 'route.ts'), probeRoute);
        const env = await readFile(path.join(base, name, '.env.local'), 'utf8');
        assert.ok(!/^NEXT_PUBLIC_/m.test(env));
      }
      for (const name of ['api-a', 'api-b', 'web', 'admin']) await t.test(`build ${name}`, () => {
        const app = path.join(base, name); npm(['install', '--no-audit', '--no-fund'], app);
        if (name === 'web' || name === 'admin') npm(['run', 'lint'], app);
        npm(['run', 'build'], app);
      });
      running.push(await startServer(path.join(base, 'api-a'), 'nest', apiA));
      running.push(await startServer(path.join(base, 'api-b'), 'nest', apiB));
      const web = await startServer(path.join(base, 'web'), 'next', webPort); running.push(web);
      const admin = await startServer(path.join(base, 'admin'), 'next', adminPort); running.push(admin);
      for (const [server, expectedName, expectedPort, greeting] of [
        [web, 'api-a', apiA.port, 'First'], [admin, target, target === 'api-a' ? apiA.port : apiB.port, target === 'api-a' ? 'First' : 'Second'],
      ]) {
        const response = await fetch(`${server.origin}/connection-check`, { signal: AbortSignal.timeout(10_000) });
        assert.equal(response.status, 200);
        assert.equal(response.headers.get('x-provisionhub-origin'), `http://127.0.0.1:${expectedPort}`);
        assert.equal(await response.text(), `${greeting} from ${expectedName}!`);
      }
      t.diagnostic(`real HTTP requests passed for ${scenario} targets`);
    } finally {
      for (const server of running.reverse()) await server.stop();
      for (const reservation of reservations) await reservation.release();
    }
  });
});
