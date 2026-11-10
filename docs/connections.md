# Official HTTP connections

The 1.3.0 local source plugins require core compatibility 0.3.0. They are not
published by this milestone. GitHub Releases and the public registry listed
only immutable 1.1.0 packages during investigation; 1.2.0 was unavailable through
official managed discovery. Use `--plugins ./plugins` or local managed lifecycle
fixtures. Do not replace existing release artifacts.

## Contract and configuration

NestJS declares provider `http-api`, type `http`. Its `port` metadata binds to
the selected instance's resolved component option; `protocol` is literal http.
Next.js declares consumer `server-api`, requiring compatible protocol/port
metadata and connection-specific `serverHost`. No technology pair exists in Go;
another conforming HTTP provider can satisfy the same contract.

`serverHost` is mandatory, with no localhost/container-name default. It accepts
ASCII DNS names or IPv4/IPv6 addresses, and rejects schemes, port suffixes,
paths, credentials, whitespace, and scoped addresses. `|host` safely renders a
URI host, adding IPv6 brackets. The port is an integer constrained to 1-65535.
Validation is syntactic and performs no DNS lookup or reachability probe.

A selected connection contributes two existing template operations under its
consumer component: `.env.local` and `.env.example`. They contain identical
private API_ORIGIN configuration and comments describing the target. An
unconnected frontend retains its original ten files. There are no general
conditional templates, patches to base files, or arbitrary commands.

See the core [contract and plugin authoring guide](https://github.com/ProvisionLabs/provisionhub/blob/main/docs/component-connections.md)
and [ADR-0013](https://github.com/ProvisionLabs/provisionhub/blob/main/docs/adr/0013-component-connections.md)
for capability schemas, metadata binding, fixed template scopes, matching,
ambiguity/cardinality, dependencies, and safety.

## Shared and distinct targets

Preview two independent frontends sharing one backend:

```sh
provisionhub project plan --name commerce --path ../commerce --plugins ./plugins \
  --component api-a:backend:nestjs --component api-b:backend:nestjs \
  --component web:frontend:nextjs --component admin:frontend:nextjs \
  --set api-a.port=4101 --set api-b.port=4102 \
  --connect web:api-a:http --connect admin:api-a:http \
  --connection-set web:api-a:http.serverHost=127.0.0.1 \
  --connection-set admin:api-a:http.serverHost=127.0.0.1
```

Both API_ORIGIN values use port 4101. For an independent target, replace the
admin declaration/setting with:

```text
--connect admin:api-b:http
--connection-set admin:api-b:http.serverHost=127.0.0.1
```

Admin then uses port 4102, while web retains 4101. This is explicit same-host
loopback for a local demonstration. For other environments, choose a host
reachable from each Next.js server. Repeat all flags with `project apply`,
reviewing before literal approval or explicit `--yes`.

TUI Components opens Connections with `c`. `a`/`e`/`d` add, edit, or remove.
The selector offers compatible named source/target pairs; Enter configures
their scalar options using the existing form. Esc preserves the current draft
when returning to selection; changing targets starts settings afresh. Review
shows endpoints, metadata, and integration files. Repeated technologies do
not pick an instance implicitly. Each source slot supports one target; multiple
frontends may share a provider. No connection is required for unconnected generation.

## Generation, build, and runtime boundaries

ProvisionHub writes initial application configuration once. It does not start
services, install npm dependencies, establish networking, configure firewalls,
or synchronize later address changes. No project YAML/lock or saved registration
is produced. Files are never overwritten and changed reviews require new approval.

Next.js loads `.env.local` for server environment configuration. A pre-existing
API_ORIGIN environment value takes precedence. Environment can be consumed
during builds/static generation as well as dynamic server execution. Static
results can stay in build output; use a dynamic server path for runtime reads.
Restart the server after changing its environment file.

API_ORIGIN is not a NEXT_PUBLIC variable. A browser's network perspective is
different from the Next.js server's: internal hostnames and loopback addresses
are not automatically browser-reachable. Public values may be embedded into
client output at build time. This integration does not create client-side
configuration, CORS policy, TLS termination, a reverse proxy, or an HTTP client.

The NestJS default bind address is 127.0.0.1. Cross-host access requires an
explicit suitable HOST and network policy outside generation. A bind address
such as 0.0.0.0 is not a portable destination. The backend's configured port is
the generation-time default; if runtime PORT or deployment addresses change,
update API_ORIGIN. Plain HTTP is the supported direct capability in these
examples. Server/database/container/deployment orchestration is out of scope.

## Reproducible validation

Build the sibling core, set PROVISIONHUB_BIN to its absolute executable path,
and run the offline tests from this repository:

```sh
node --test tests/configuration.test.mjs tests/connections.test.mjs
```

They check unconnected baseline bytes, 44 connected files, shared and distinct
targets, typed host/port metadata, deterministic plans/files, required values,
invalid declarations, no writes before approval, conflicts, unsafe paths,
and blocked persistence. Unit/offline generation tests need no live network.
CI runs natively on Windows, Linux, and macOS with a pinned compatible core.
Managed lifecycle tests install over local HTTPS fixtures, restart offline,
verify connected output and integration-template tampering, and check that
saved-project rows remain empty.

For actual runtime validation, explicitly allow npm registry access and run:

```sh
node --test tests/connections-runtime.test.mjs
```

This creates fresh shared and distinct-target projects, installs dependencies,
builds all eight generated apps across both scenarios, lints the four Next.js
apps, and starts two NestJS plus two Next.js servers per scenario on reserved
local ports. A dynamic Next.js route, added only to temporary test fixtures,
reads the generated API_ORIGIN and performs a real HTTP request. Response
bodies and origin headers distinguish the selected backend instances. The test
does not infer connectivity from compilation, and the plugin ships no probe
route or extra application feature. Servers stop before temporary cleanup.

This runtime test passed on Windows during implementation: 11 tests including
eight builds, with real HTTP success for both scenarios. Native CI's offline
checks do not claim runtime connectivity on other operating systems.
