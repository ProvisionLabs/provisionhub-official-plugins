# Official declarative plugin distribution

The public static index is [registry.json](../registry.json). It uses schema v1
from ProvisionHub's `internal/registry`. Package identity is `official/nestjs` or
`official/nextjs`; the existing YAML IDs `official-nestjs` and `official-nextjs`
remain unchanged. Technology IDs are separate. Stable semantic plugin versions
are independent of framework versions. `minimumCoreVersion` is the inclusive
lower bound for the core's compatibility version (currently 0.1.0).

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
usable offline after installation. Project-specific version locking is future
work; installed versions must never be chosen arbitrarily when ambiguous.
