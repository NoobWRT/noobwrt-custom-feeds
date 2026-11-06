#!/usr/bin/env python3
"""Exercise the actual sync wrapper with local sources, without network."""
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

WRAPPER = Path(__file__).resolve().parents[1] / 'sync/sync-modemdata.sh'

class SyncTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.work = self.root / 'work'
        sync = self.work / 'scripts/sync'
        sync.mkdir(parents=True)
        shutil.copy2(WRAPPER, sync / WRAPPER.name)
        self.front = self.root / 'frontend'
        self.patch = self.front / 'patches/modemdata/0001-quectel-reporting.patch'
        self.patch.parent.mkdir(parents=True)
        self.patch.write_text('diff --git a/modemdata/Makefile b/modemdata/Makefile\n'
                              '--- a/modemdata/Makefile\n+++ b/modemdata/Makefile\n'
                              '@@ -1 +1 @@\n-old backend\n+patched backend\n')
        (self.front / 'source-marker').write_text('frontend source\n')
        self.back = self.root / 'backend'
        (self.back / 'modemdata').mkdir(parents=True)
        (self.back / 'modemdata/Makefile').write_text('old backend\n')
        (sync / 'sync-repo.sh').write_text('''#!/bin/bash
set -euo pipefail
printf '%s|%s|%s\\n' "$SYNC_REPO_URL" "$SYNC_BRANCH" "$SYNC_DEST_DIR" >> "$CALL_LOG"
if [ -n "${SYNC_CHECK_OUTPUT:-}" ]; then
    echo "$SYNC_REPO_URL $SYNC_BRANCH $SYNC_DEST_DIR" >> "$SYNC_CHECK_OUTPUT"
    exit 0
fi
case "$SYNC_REPO_URL" in
  *luci-app-modemdata.git) source_dir="$FRONTEND_FIXTURE" ;;
  *obsy/modemdata.git) source_dir="$BACKEND_FIXTURE" ;;
  *) exit 99 ;;
esac
mkdir -p "$SYNC_DEST_DIR"
cp -a "$source_dir/." "$SYNC_DEST_DIR/"
''')
        self.feed = self.work / 'feeds/modemdata'
        self.feed.mkdir(parents=True)
        (self.feed / 'existing').write_text('keep\n')
        self.env = dict(os.environ, FRONTEND_FIXTURE=str(self.front),
                        BACKEND_FIXTURE=str(self.back), CALL_LOG=str(self.root / 'calls'))
        for key in ('SYNC_CHECK_OUTPUT', 'MODEMDATA_LUCI_BRANCH', 'GIT_DIR', 'GIT_WORK_TREE'):
            self.env.pop(key, None)

    def run_sync(self):
        return subprocess.run(['bash', 'scripts/sync/sync-modemdata.sh'], cwd=self.work,
                              env=self.env, capture_output=True, text=True)

    def snapshot(self):
        return {str(p.relative_to(self.feed)): p.read_bytes()
                for p in self.feed.rglob('*') if p.is_file()}

    def calls(self):
        return [line.split('|') for line in (self.root / 'calls').read_text().splitlines()]

    def test_source_patch_applied_before_import(self):
        result = self.run_sync()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual((self.feed / 'modemdata/Makefile').read_text(), 'patched backend\n')
        self.assertTrue((self.feed / 'source-marker').exists())
        self.assertEqual([c[1] for c in self.calls()], ['main', ''])

    def test_repeat_sync_is_idempotent(self):
        self.assertEqual(self.run_sync().returncode, 0)
        before = self.snapshot()
        self.assertEqual(self.run_sync().returncode, 0)
        self.assertEqual(self.snapshot(), before)

    def test_stale_patch_cannot_mask_missing_source(self):
        stale = self.feed / 'patches/modemdata/0001-quectel-reporting.patch'
        stale.parent.mkdir(parents=True)
        shutil.copy2(self.patch, stale)
        self.patch.unlink()
        before = self.snapshot()
        self.assertNotEqual(self.run_sync().returncode, 0)
        self.assertEqual(self.snapshot(), before)

    def test_backend_conflict_preserves_feed(self):
        (self.back / 'modemdata/Makefile').write_text('conflicting source\n')
        before = self.snapshot()
        self.assertNotEqual(self.run_sync().returncode, 0)
        self.assertEqual(self.snapshot(), before)

    def test_check_only_preserves_feed_and_fingerprint_destination(self):
        self.env['SYNC_CHECK_OUTPUT'] = str(self.root / 'upstreams')
        before = self.snapshot()
        self.assertEqual(self.run_sync().returncode, 0)
        self.assertEqual(self.snapshot(), before)
        self.assertEqual([c[2] for c in self.calls()], ['feeds/modemdata'] * 2)
        self.assertEqual(len((self.root / 'upstreams').read_text().splitlines()), 2)

    def test_source_branch_override_never_leaks_to_backend(self):
        self.env['MODEMDATA_LUCI_BRANCH'] = 'fix/source-test'
        self.assertEqual(self.run_sync().returncode, 0)
        self.assertEqual([c[1] for c in self.calls()], ['fix/source-test', ''])

if __name__ == '__main__':
    unittest.main(verbosity=2)
