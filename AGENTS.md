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

Run `npm test`, `npm run test:integration`, `npm run build`, and the CI package
consumer test with both checkouts provisioned. Missing tools or checkouts fail;
never report skipped gates as green. Generated files are read-only; regenerate
rather than edit. Never delete unowned files to make a build pass.
