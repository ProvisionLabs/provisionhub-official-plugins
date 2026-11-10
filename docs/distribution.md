# Official declarative plugin distribution

The public static index is [registry.json](../registry.json). It uses schema v1
from ProvisionHub's `internal/registry`. Package identity is `official/nestjs` or
`official/nextjs`; the existing YAML IDs `official-nestjs` and `official-nextjs`
remain unchanged. Technology IDs are separate. Stable semantic plugin versions
are independent of framework versions. `minimumCoreVersion` is the inclusive
lower bound for the core's compatibility version (currently 0.3.0).

From a sibling core checkout, build into a new output directory:

```sh
cd ../provisionhub
GOTOOLCHAIN=go1.26.1 go run ./cmd/pluginpack ../provisionhub-official-plugins/plugins ../provisionhub-official-plugins/dist ../provisionhub-official-plugins/registry.json
```

The tool validates manifests and every declared input, then writes deterministic
USTAR gzip packages, SHA-256 sidecars, and an index. Only `plugin.yaml` and declared
source files are included. Files are ordered, modes and timestamps fixed, and
LF checkouts enforced by `.gitattributes`. Use the pinned Go 1.26.1 release
toolchain: gzip encoders can change between Go versions. On PowerShell, set
`$env:GOTOOLCHAIN = 'go1.26.1'` before running the tool. Packages are OS independent data;
installation executes no scripts, generators, npm or downloaded binaries.

The distribution workflow checks generated registry metadata against this
repository, rebuilds to verify determinism, and preserves published release
metadata. To release, a maintainer manually dispatches the workflow on main with
an exact registry tag such as `official-nestjs-v1.1.0`. The workflow requires
contents-write permission and refuses existing tags/releases. It uploads a
versioned tar.gz and checksum through GitHub Releases. Never delete, retag or
replace a published artifact. Adding an index entry alone does not publish its
asset: until dispatch succeeds, a new download URL may return 404. Both official
1.1.0 package workflows have now completed successfully and public installation
was validated. Future releases require the same validated manual dispatch and
repository contents-write permission; no external publishing server is needed.

The index itself can evolve on main; release artifacts must stay immutable.
Retain historical version entries when adding releases. No branch archive is
used as an immutable package. No GitHub login is needed to read the public index
or public release assets.

When intentionally adding a version, build once without the optional previous
index, merge the new version into registry.json while retaining prior entries,
then build with the previous-index argument. The tool refuses changing a known
release's checksum, URL, compatibility or package identity. Historical versions
remain downloadable from their original releases, not rebuilt from current
templates. CI additionally installs both current plugins into temporary storage,
restarts offline, generates four named components and checks removal isolation.

Checksums detect byte changes, not publisher identity. Trust relies on HTTPS,
the official repository, release owners, and local file security. There are no
signatures, community publishing, trust scores or marketplace backend in v1.
The core supports local templates independently of this registry and remains
usable offline after installation. Project-specific state and locks are retired; installed versions must never be chosen arbitrarily when ambiguous.

## Configured source packages

The 1.3.0 source definitions add declarative connections and require core
compatibility 0.3.0. The earlier 1.2.0 configuration sources were not published at investigation time. They are unreleased: `registry.json` continues to contain
only the published immutable 1.1.0 assets. CI packages the current source into
`dist/`, retains published history in the candidate `dist/registry.json`, and
checks that every public entry is unchanged. Repeated package builds must be
byte-identical. A pinned 0.3.0-capable core validates configured managed offline
generation and real CLI generation without npm or network access.

Use the local plugins directory for 1.3.0 before release. To publish later,
review and promote the candidate registry entries with their exact checksums
and `minimumCoreVersion: 0.3.0`, then dispatch publication for each new tag.
The publication check deliberately requires the tag to exist in the public
index and its validated package to be present. No release/tag or historical
asset is changed as part of the connection milestone.

Connection-owned templates are declared package inputs and participate in
managed content checksums, even when no connection is generated. The managed
lifecycle checks connected output, an offline restart, selected target ports,
integration-template tampering, and zero saved-project registrations. Native
validation now runs on Windows, Linux, and macOS. Each job uploads a separate
artifact; future manual publication consumes the canonical Linux artifact.
Runtime npm/build/HTTP tests remain an explicit separate command, not a release
or planning action. No releases are published by this milestone.
