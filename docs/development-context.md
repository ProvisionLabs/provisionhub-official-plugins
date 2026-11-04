# Official plugins development context

Checked November 3, 2026. Repository manifests, registry and CI remain the source
of truth. Declarative NestJS and Next.js versions are both 1.1.0. Distribution IDs
are `official/nestjs` and `official/nextjs`; manifest IDs remain `official-nestjs`
and `official-nextjs`, and technology IDs remain `nestjs` and `nextjs`.

Plugin Registry v1 is implemented jointly with the core. `registry.json` is public
static metadata. Packages contain the existing manifest and declared source files
only; no runtime plugin process or script is introduced. The experimental
`keycloak-go` gRPC module is excluded from declarative distribution.

Both packages have been published under versioned GitHub Release tags
`official-nestjs-v1.1.0` and `official-nextjs-v1.1.0`. The manually dispatched
workflow ran validation before publishing; neither tag nor artifact was replaced.
Use [distribution](distribution.md) for the pinned Go 1.26.1 packaging process,
checksum validation, historical release retention and future release steps.

CI checks manifests/inputs, reproducible package bytes, index consistency,
SHA-256 sidecars and published release immutability. It pins a validated core
revision and tests installing both current definitions over mock HTTPS,
restarting offline, generating four named components and removing one package
without losing the other. No GitHub credentials are needed by tests.

Live Windows validation also fetched the public index and both public assets
without application authentication, verified managed health, generated 40 files
with registry access blocked, checked same-version update behavior, removed
packages and verified continued local discovery. A newer compatible version is
covered by mocked core tests; no second official release exists. The previous
Node/npm generator tests remain available and unchanged; they were not rerun as
part of this distribution milestone, and no new Node runtime validation is claimed.

The core stores files and SQLite installation metadata in application data,
supports CLI/TUI management and explicit session versions, and retains local
directories/environment overrides. Updates preserve prior installations and
ambiguity requires selection; portable project plugin locks are recommended next.
Community publishing, extra registry configuration and marketplace services are
outside this milestone. Future sources can reuse the core registry interface.
