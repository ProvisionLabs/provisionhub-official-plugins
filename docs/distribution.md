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
go run ./cmd/pluginpack ../provisionhub-official-plugins/plugins ../provisionhub-official-plugins/dist
```

The tool validates manifests and every declared input, then writes deterministic
USTAR gzip packages, SHA-256 sidecars, and an index. Only `plugin.yaml` and declared
source files are included. Files are ordered, modes and timestamps fixed, and
LF checkouts enforced by `.gitattributes`. Packages are OS independent data;
installation executes no scripts, generators, npm or downloaded binaries.

The distribution workflow checks generated registry metadata against this
repository, rebuilds to verify determinism, and preserves published release
metadata. To release, a maintainer manually dispatches the workflow on main with
an exact registry tag such as `official-nestjs-v1.1.0`. The workflow requires
contents-write permission and refuses existing tags/releases. It uploads a
versioned tar.gz and checksum through GitHub Releases. Never delete, retag or
replace a published artifact. No release has been published merely by adding
the index: until dispatch succeeds, listed download URLs may return 404.

The index itself can evolve on main; release artifacts must stay immutable.
Retain historical version entries when adding releases. No branch archive is
used as an immutable package. No GitHub login is needed to read the public index
or public release assets.

Checksums detect byte changes, not publisher identity. Trust relies on HTTPS,
the official repository, release owners, and local file security. There are no
signatures, community publishing, trust scores or marketplace backend in v1.
The core supports local templates independently of this registry and remains
usable offline after installation. Project-specific version locking is future
work; installed versions must never be chosen arbitrarily when ambiguous.
