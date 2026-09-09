# Exact source bytes before TJSV admission (DEN-3958)

A commit pin plus `git diff HEAD` is not byte-level source verification. Git's
assume-unchanged and skip-worktree index flags, normalization filters, replacement
objects, and staged-only changes can make that comparison omit relevant state.
The regression suite demonstrates these cases using disposable Git repositories.

The shared build now calls `scripts/checkout.mjs` before importing the pinned
source admission module or invoking TJSV, and again before packaging results.
The verifier reads the immutable Git tree, opens each regular tracked file without
following a file symlink, computes its raw Git blob identity, and compares it with
the pinned object. It checks executable modes on POSIX, source parent directories,
standalone checkout identity, staged and ordinary changes, and untracked paths.
Ambient Git selectors are excluded from local verification commands and Git
replacement objects are disabled. The check never clears index flags or repairs
sources. Unknown tree modes, unsupported layouts and size-limit violations stop.

The compiler-backed integration tests conceal changes to the source admission
module, authored JSON Schema and TJSV executable. Every attempt must fail before
the changed code executes, invalidate an earlier owned output package, preserve
rejected source bytes, and recover only after the test restores original bytes.
The positive build still executes the real upstream TJSV compiler/parity CLI and
verify-ir; the checkout verifier is not a substitute schema engine.

Both independently authored authorities remain unchanged and neither gains
precedence. The older PR #2 rejection fixtures remain historical evidence rather
than the admission state of today's manifest-pinned source. Registry publication,
frozen Zed resolution and deployment are not enabled by these changes.

Scope: canonical standalone SHA-1 checkouts, byte-preserved files, no tracked
symlinks or submodules, at most 20,000 files, 64 MiB per file and 256 MiB total.
Ignored dependency/build artifacts remain permitted. This verifies tracked sources,
not node_modules, the local Git/OS/toolchain trust base, or process isolation against
an arbitrary concurrent malicious writer. Use isolated CI runners for those bounds.
CRLF working copies are rejected when their pinned source bytes are LF, even if
Git normalization would call them clean; this is intentional for source digests.

References: https://git-scm.com/docs/git-update-index and
https://git-scm.com/docs/git-ls-tree .
