#!/usr/bin/env python3
# A band list written through ModemManager while the watchdog was reconnecting the modem was
# accepted by mmcli but never reached the modem, which stayed on the old bands without service.
# mmsetbands reads the list back, writes once more when it did not move, and reports a failure
# when it still did not; a list the modem trimmed (an unsupported band dropped) is a success.
import os
import tempfile
import unittest
from pathlib import Path

from test_runtime_audit import SHARE, shell

MMCLI = r'''#!/bin/sh
case "$*" in
	*--set-current-bands=*)
		echo set >> "$D/calls"
		n=$(grep -c set "$D/calls")
		[ "$MODE" = late ] && [ "$n" -lt 2 ] && { echo "successfully set current bands"; exit 0; }
		[ "$MODE" = stuck ] && { echo "successfully set current bands"; exit 0; }
		if [ "$MODE" = trimmed ]; then printf 'eutran-1\neutran-3\n' > "$D/cur"; else printf '%s\n' "${1#--set-current-bands=}" "${2#--set-current-bands=}" "${3#--set-current-bands=}" | tr '|' '\n' | grep . > "$D/cur"; fi
		echo "successfully set current bands" ;;
	*-K*)
		i=0; while read -r b; do i=$((i + 1)); echo "modem.generic.current-bands.value[$i] : $b"; done < "$D/cur" ;;
esac
'''


class MmSetBandsVerify(unittest.TestCase):
    def run_set(self, mode, bands='eutran-1|eutran-3|eutran-7'):
        with tempfile.TemporaryDirectory() as d:
            d = Path(d)
            (d / 'bin').mkdir()
            for name, body in (('mmcli', MMCLI), ('logger', '#!/bin/sh\n'), ('sleep', '#!/bin/sh\n')):
                (d / 'bin' / name).write_text(body)
                (d / 'bin' / name).chmod(0o755)
            (d / 'cur').write_text('eutran-7\n')
            env = dict(os.environ, PATH=f'{d}/bin:' + os.environ['PATH'], D=str(d), MODE=mode)
            src = (SHARE / 'bands.sh').read_text()
            start = src.index('if [ "$1" = "mmsetbands" ]; then')
            end = src.index('\nfi\n', start) + 4
            block = src[start:end].replace('/dev/cdc-wdm*', f'{d}/none*')
            r = shell(f'set -- mmsetbands "{bands}" 0\nsleep() {{ :; }}\n' + block, env)
            calls = (d / 'calls').read_text().count('set') if (d / 'calls').exists() else 0
            return r.returncode, calls, r.stdout

    def test_applied_first_time(self):
        self.assertEqual(self.run_set('ok')[:2], (0, 1))

    def test_second_write_when_the_first_did_not_move_the_list(self):
        self.assertEqual(self.run_set('late')[:2], (0, 2))

    def test_failure_reported_when_the_list_never_moves(self):
        rc, calls, out = self.run_set('stuck')
        self.assertEqual((rc, calls), (3, 2))
        self.assertIn('kept its previous bands', out)

    def test_trimmed_list_is_a_success(self):
        self.assertEqual(self.run_set('trimmed', 'eutran-1|eutran-3|eutran-99')[:2], (0, 1))


if __name__ == '__main__':
    unittest.main()
