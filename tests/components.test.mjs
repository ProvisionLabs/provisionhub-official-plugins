import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { cli, flags, npm } from './helpers.mjs';

test('two NestJS and two Next.js applications with different configurations build', { timeout: 1_200_000 }, async t => {
  const base = await mkdtemp(path.join(tmpdir(), 'provisionhub-components-'));
  t.after(() => rm(base, { recursive: true, force: true }));
  const components = ['api:backend:nestjs', 'billing:backend:nestjs', 'web:frontend:nextjs', 'admin:frontend:nextjs'];
  const settings = ['api.greeting=Welcome', 'api.port=4001', 'admin.welcomeMessage=Administration', 'admin.showCredits=false'];
  cli(['project', 'apply', ...flags(base, components, settings), '--yes']);
  for (const name of ['api', 'billing', 'web', 'admin']) {
    await t.test(`build ${name}`, () => {
      const app = path.join(base, name); npm(['install', '--no-audit', '--no-fund'], app); npm(['run', 'build'], app);
    });
  }
});
