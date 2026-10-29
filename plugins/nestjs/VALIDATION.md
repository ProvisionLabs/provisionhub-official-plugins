# NestJS 1.0.0 validation

Validated locally on October 28, 2026 using Windows, Go `1.27.0`, Node.js
`24.22.1`, npm `12.2.1`, and ProvisionHub core commit `10a3dda`.
The plugin uses the existing `provisionhub.dev/plugin/v1alpha1` schema.
No core runtime implementation or existing Keycloak files were changed.

## Passed checks

- Built the actual core CLI with `go build -o <temporary-executable> ./cmd/provisionhub`.
- Core `go test ./...` and `go vet ./...` completed successfully.
- `PROVISIONHUB_BIN=<absolute-executable> node --test tests/nestjs.test.mjs`
  passed with one integration test, no failures, and no skips.
- Discovery matched `official-nestjs` to the built-in `nestjs` backend ID.
- Repeated JSON plans were identical, with `status: planned`, `executable: true`,
  one supported backend capability, ten supported file operations, and no diagnostics.
- Planning and unapproved non-interactive apply preserved all existing files.
- Explicit `--yes` approval generated exactly the ten declared files plus the
  previously saved project manifest. A destination containing spaces and Unicode
  worked. Project-name substitution produced package name `sample-api`.
- Repeated apply refused overwrites. A pre-existing `backend/src/main.ts`
  stopped the whole plan without publishing other files or changing the conflict.
- Traversal in source/output paths and absolute output paths were rejected by
  the real loader. An output-directory junction was rejected without writing
  into the junction target.
- A NestJS + Next.js selection remained non-executable and could not be applied.
- Explicit integration-only `npm install --no-audit --no-fund` and
  `npm run build` succeeded in the generated temporary backend.
- The automated test started `node dist/main.js` on an available loopback port
  and received HTTP 200 with `Hello from sample-api!`.
- A separate manual CLI generation in a system temporary directory passed
  `npm install`, `npm run build`, and `npm run start`; an HTTP request returned
  the same status and greeting. The application process was stopped afterward.
- Git whitespace checks passed in both repositories.

## Limits

Three core tests involving ordinary Windows symlinks reported skips because the
required privilege is unavailable. Their other checks are not a substitute for
full symlink coverage. The separate integration test's Windows directory-junction
containment check passed. Linux/macOS execution, remote CI, and interactive TUI
operation were not run here. Core TUI model tests passed as part of `go test ./...`.

All generation and npm validation ran outside both repositories. The automated
test removes its temporary directory and stops its child application. No
dependencies are installed by ProvisionHub itself. No lockfile is distributed
with the plugin; npm resolves transitive versions during installation. The
executor's existing multi-file atomicity and cleanup limitations still apply.

See the [repeatable test command](../../README.md) and
[plugin usage](README.md). No commits or remote publishing were performed.
