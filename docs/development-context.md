# Official plugins development context

Checked November 10, 2026. Repository manifests, registry and CI remain the source
of truth. Declarative NestJS and Next.js source versions are both 1.2.0 (unreleased); published packages remain 1.1.0. Distribution IDs
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
covered by mocked core tests; no second official release exists. Node/npm integration tests have been migrated to the current one-time CLI; see the configuration validation notes below.

The core stores files and SQLite installation metadata in application data,
supports CLI/TUI management and explicit session versions, and retains local
directories/environment overrides. Updates preserve prior installations and
ambiguity requires selection; project state remains in memory and project locks are retired.
Community publishing, extra registry configuration and marketplace services are
outside this milestone. Future sources can reuse the core registry interface.


The Declarative Project Configuration Engine is implemented in core compatibility
0.2.0. Source plugins add optional `configuration.properties`: NestJS has
`greeting` (Hello, string length 1?120) and `port` (3000, integer 1?65535);
Next.js has `welcomeMessage` (existing starter message, string length 1?240)
and `showCredits` (true, boolean). Each changes generated source; no dependency
versions or package manager options were added. Templates use escaped JSON
literals for strings and validated boolean/integer literals. Defaults preserve
runtime behavior. No conditional generation or executable plugin hooks exist.

CLI settings are per named component (`--set api.port=4001`); TUI fields, labels,
descriptions and defaults come from the same schema and resolver. Planning
resolves configuration and renders in memory, exposing values and rendered
hashes in a deterministic review plan. Apply requires approval and checks fresh
inputs. No project YAML, plugin lockfile, or saved-project registration is written.

Local validation generated two NestJS and two Next.js applications with distinct
settings, checked deterministic output and isolation, approval, conflicts,
symlinks, unsafe paths, and blocked persistence. All four generated applications
completed real npm installations and builds on Windows. Core managed package
lifecycle tests also installed the configured packages, restarted offline, and
verified isolated configured files and removal. Unit tests need no live network.
Default NestJS and Next.js HTTP checks and Next.js lint also passed after correcting Windows test cleanup ordering. Runtime checks are separate from CI's offline generation checks.

The public registry is unchanged until a separate 1.2.0 release; older cores
continue to receive 1.1.0. Use local discovery for source configuration examples.
See [distribution](distribution.md), [usage](../README.md), and the core
[configuration contract](https://github.com/ProvisionLabs/provisionhub/blob/main/docs/plugin-configuration.md).
Next work: publish the compatible plugin packages, then design the Component
Connection Engine separately from this milestone.
