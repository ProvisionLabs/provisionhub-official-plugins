import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { cli, flags, npm, serve } from './helpers.mjs';

test('default Next.js application lints, builds and serves its original starter', { timeout: 480_000 }, async t => {
  const base = await mkdtemp(path.join(tmpdir(), 'provisionhub-nextjs-'));
  t.after(() => rm(base, { recursive: true, force: true }));
  cli(['project', 'apply', ...flags(base, ['web:frontend:nextjs']), '--yes']);
  const app = path.join(base, 'web');
  npm(['install', '--no-audit', '--no-fund'], app); npm(['run', 'lint'], app); npm(['run', 'build'], app);
  await serve(app, 'next', 'Welcome to your new Next.js application.');
});
