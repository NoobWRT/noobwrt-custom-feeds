# Modemdata source synchronization

The backend reporting patch and its tests are maintained in
[nooblk-98/luci-app-modemdata](https://github.com/nooblk-98/luci-app-modemdata/tree/main/patches/modemdata),
not as a second feed-local copy.

`scripts/sync/sync-modemdata.sh` stages fresh LuCI source, obtains its companion
patch, stages fresh `obsy/modemdata`, applies that patch, and then copies both
sources into the feed. Missing patches or conflicts abort before copying files.

The imported patch lives at
`feeds/modemdata/patches/modemdata/0001-quectel-reporting.patch`.
Make future backend fixes in the source repository, then run:

```sh
bash scripts/sync/sync-modemdata.sh
```

Check-only mode (`SYNC_CHECK_OUTPUT`) only queries upstream revisions.
For testing pending source PRs, use `MODEMDATA_LUCI_BRANCH=<branch>`;
production defaults to `main`, and the backend uses its default branch.

CI runs source-owned AT/parser tests against the imported backend and
feed-specific sync tests. No full firmware build or router flash is performed.
