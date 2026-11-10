import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { cli, flags, npm, serve } from './helpers.mjs';

test('default NestJS application builds and serves its original greeting', { timeout: 360_000 }, async t => {
  const base = await mkdtemp(path.join(tmpdir(), 'provisionhub-nestjs-'));
  t.after(() => rm(base, { recursive: true, force: true }));
  cli(['project', 'apply', ...flags(base, ['api:backend:nestjs']), '--yes']);
  const app = path.join(base, 'api');
  npm(['install', '--no-audit', '--no-fund'], app); npm(['run', 'build'], app);
  await serve(app, 'nest', 'Hello from api!');
});
