# Modemdata reporting integration

`modemdata-reporting.patch` is applied to a fresh `obsy/modemdata` checkout by
`sync/sync-modemdata.sh`, before copying the backend into the feed. The checked-in
package and patch must be kept in sync. Upstream conflicts fail the sync rather
than silently reverting these fixes. Check-only upstream queries do not apply
patches or write package files.

The patch:

- Routes the base status query and Quectel 2c7c:0800 family queries through a
  per-port lock matching QModem. If the AT daemon is available, use
  `tom_modem -u`; never retry a failed daemon read with direct serial access.
  Standalone installations retain direct `tom_modem` / `sms_tool` support.
- Adds a Quectel identity collector using complete AT transactions, replacing
  the generic `gcom` reader for this VID/PID. It does not cache SIM identifiers
  or retain stale values after failures.
- Detects NSA from valid QCAINFO NR measurements or QENG NSA measurements even
  when registration AcT is 7. Rejects placeholder NR rows; uses the extended
  QENG band only when QCAINFO has no valid NR band. LTE/CA/SA stay distinct.
- Adds the `flock` package dependency and bumps the backend package release.

## Verification

Run from the repository root:

```sh
python3 scripts/tests/test-modemdata-transport.py
python3 scripts/tests/test-modemdata-nsa.py
bash -n scripts/sync/sync-modemdata.sh
```

The 15 transport tests cover daemon/direct routing, failure without unsafe
fallback, identity response filtering, and concurrent collectors. The 57 parser
cases source the actual handler under BusyBox ash with synthetic AT fixtures.
These do not establish cellular payload throughput or network attach success.

Live AW1000/RG500Q-EA verification on 2026-11-06 used isolated `/tmp` copies of
the collector, with the existing AT daemon and modem settings unchanged:

| Collector | Complete vendor/product/revision/IMEI/IMSI/ICCID |
|---|---|
| Original generic gcom with shared flock added | 0 / 5 |
| New daemon-backed Quectel identity reader | 5 / 5 |
| Full patched md_serial_ecm backend | 5 / 5 |

All five full-backend reads returned registration 1 and NSA B3/B1/n78. No SIM,
modem identifiers, credentials or private raw captures are included here.
No browser masking behavior or reporter-specific B7/n78 attach failure is
claimed fixed. No full firmware image build was performed for this patch.

To refresh the patch after editing the package (include new files in the diff):

```sh
git diff --relative=feeds/modemdata -- feeds/modemdata/modemdata > scripts/patches/modemdata-reporting.patch
```

Generate this against the unmodified upstream package, not an already-patched
commit. Test `bash scripts/sync/sync-modemdata.sh` in a disposable checkout twice;
the second run should produce no further package diff.
