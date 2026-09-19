# Shared interfaces engineering contract

Parent: https://github.com/ORESoftware/my-ai/blob/main/AGENTS.md
Read its `original-agents.md` before nontrivial Git operations. Preserve history
and unrelated work; feature branches and PRs only. Never force-push, reset,
rebase, stash, or create worktrees without the owner's specific authorization.

This repo is a shared interface source package, not a business-logic library or
an authorization server. Source definitions stay in the explicitly pinned
compatibility authority until a separately reviewed migration moves them.
TypeSpec and independently authored JSON Schema are peers. Generated witnesses,
receipts and public source snapshots are not editable authorities.

Do not copy the TJSV validator or invent a second CLI parser. The small Node
scripts are build/test tasks and accept no command-line flags. Public options
remain in TJSV's `.cli-flags.toml` and are parsed through flags-2-env.

Keep public and server scopes separate. A declared runtime export is a data
visibility policy, not proof of a compiled native SDK. Require real compiler
admission, exact pins, complete declarations, recorded positive/negative cases,
package-content checks and external consumption before merging.

## Literal route and page paths

Routing repositories may contain literal filesystem names with characters such
as `[`, `]`, `(`, `)`, `{`, and `}`. Treat those characters as ordinary path
bytes unless the routing grammar explicitly assigns them meaning. Never let a
shell expand, glob, brace-expand, or reinterpret such a path.

- Prefer APIs that accept a path argument directly instead of constructing a
  shell command string.
- When a shell is unavoidable, quote the complete path as one argument, for
  example `git add -- 'src/pages/users/[id]/page.rs'`.
- Use `--` before pathspecs for Git commands when a path could be mistaken for
  an option.
- Do not rename or normalize bracket/brace/parenthesis segments merely to make a
  tool invocation easier. Preserve the authored wire/path identity.
- In generated manifests and diagnostics, serialize the literal repository path
  and a separately derived canonical URL/RPC path; never reuse one as the other.

Run `npm test`, `npm run test:integration`, `npm run build`, and the CI package
consumer test with both checkouts provisioned. Missing tools or checkouts fail;
never report skipped gates as green. Generated files are read-only; regenerate
rather than edit. Never delete unowned files to make a build pass.
