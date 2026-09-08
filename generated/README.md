# Derived interface exports — DO NOT EDIT

`npm run build` re-runs exact-revision TJSV admission and assembles public source
snapshots in `generated/public`. These files are read-only and ignored by Git.
`main.tsp` and `schema.json` retain the admitted independently authored source
bytes; neither is generated from the other, and neither is a new authority here.

`provenance.json` binds source/toolchain pins, source digests and output digests.
It is unsigned build evidence, not authorization or proof of universal parity.
The upstream canonical receipt/IR are verified live on every build; `npm pack`
uses the same prepack gate. Hash-only inspection is explicitly binding-only.

A build invalidates previous owned output before checking prerequisites. A new
complete package is staged then renamed into place; compiler failure cannot
reuse a previous owned pass. Unowned directories, extra files, symlinks and
another process's lock cause a refusal without destructive cleanup. After a
crash, inspect `.build-lock` and any `.stage-*` directory manually; the build
never steals a lock or assumes unknown files are disposable.
