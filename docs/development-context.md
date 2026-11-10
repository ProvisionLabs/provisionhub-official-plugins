# Official plugins development context

Checked November 10, 2026. Manifests, registry, tests, and CI are authoritative.
Source versions are 1.3.0 (unreleased), requiring core compatibility 0.3.0.
Distribution IDs remain official/nestjs and official/nextjs; YAML and technology
IDs are unchanged. Only immutable 1.1.0 packages were published/registered during
investigation. The earlier 1.2.0 sources were not available through official
managed discovery. No release publication is authorized by this milestone.

Both generators retain declarative scalar component configuration. NestJS has
greeting and port; Next.js has welcomeMessage and showCredits. Defaults and
framework dependency versions remain unchanged. Unconnected generation still
produces the same ten files per component.

The Component Connection Engine adds plugin-defined capabilities. NestJS
provides http-api/type http with port bound to resolved instance configuration
and literal protocol http. Next.js consumes compatible metadata through its
server-api slot. Its required serverHost is explicit and validated as DNS/IP;
no universal localhost/container host is assumed. A connection generates private
API_ORIGIN in .env.local and .env.example. Multiple frontends can share a
backend or choose distinct named instances. No framework pairing logic is in Go.

The core reuses scalar validation/defaults, literal escaping, deterministic
planning, approval freshness, and existing safe execution. Integration inputs
are packaged and integrity-checked even when no connection is selected. Slots
have one target; duplicate/ambiguous/unsupported declarations, invalid options,
and generation cycles are rejected. There is no general conditional template
language, arbitrary plugin execution, HTTP client, extra page, CORS/proxy setup,
container discovery, project persistence, or deployment orchestration.

API_ORIGIN belongs to Next.js server code. Build/static rendering can consume
environment too; dynamic execution is needed for runtime reads. Browser
addresses/NEXT_PUBLIC build-time embedding are separate choices. Generation
does not establish networking. Later HOST/PORT/deployment changes require
updating application configuration. See [connections](connections.md).

CI pins a compatible core and validates packages, retained public registry
history, checksums, offline CLI generation, and managed offline lifecycle
natively on Windows/Linux/macOS. Artifacts are separated by OS; any future
authorized publication uses the Linux package artifact. The public registry
and existing release assets are unchanged. The keycloak-go experiment remains
excluded from declarative packages. See [distribution](distribution.md).

Local validation passed offline CLI tests for unchanged base files, 44-file
connected projects, shared/distinct targets, deterministic plans/files,
approval, safety, required host validation, and blocked persistence. The managed
lifecycle passed local HTTPS installation, offline restart, instance-specific
ports, integration-template tamper detection, removal isolation, and zero
saved-project registrations. Core tests require no live network or credentials.

The separate runtime test passed on Windows for two fresh projects: eight real
npm installations/builds and four Next.js lints, followed by real Next.js-to-
NestJS HTTP requests for shared and distinct targets. Eleven tests passed.
Dynamic probe routes exist only in temporary fixtures, not plugin output.
Servers stop before cleanup. Native offline CI does not imply runtime validation
on Linux/macOS. Commands and assumptions are in [the connection guide](connections.md).

Recommended next milestone: plugin contract conformance and release validation.
Publishing the compatible source packages requires separate explicit authorization;
database/authentication/deployment integration remains outside this milestone.
