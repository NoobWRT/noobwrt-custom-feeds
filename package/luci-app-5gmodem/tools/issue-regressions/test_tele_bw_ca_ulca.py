#!/usr/bin/env python3
# A field report compared the exported metrics of an MBIM DW5821e and an AT FM350-GL:
# - the primary carrier width was only inside the "pband" text, so exporters had no number;
# - the DW5821e gives no state for secondary carriers, so "ca" and "nca" said no aggregation
#   while the page showed 5CA;
# - its secondary-cell SNR read -20.0 dB (the firmware's "not measured");
# - FM350 neighbour rows had RSRQ +5..+20 dB from indexes outside the LTE scale.
# The same report: uplink aggregation on the DW5821e was undone by the modem reboot that
# followed the button, and nothing put it back after a restart.
import re
import unittest

from test_runtime_audit import ROOT, SHARE, shell


def one_liner(name, filename):
    src = (SHARE / filename).read_text()
    m = re.search(r'^' + re.escape(name) + r'\(\) \{.*\}$', src, re.M)
    if not m:
        raise ValueError(name)
    return m[0]


class TeleBandwidthAndCa(unittest.TestCase):
    def test_width_is_a_number(self):
        f = one_liner('_bw', 'telemetry.sh')
        cases = {'B7 (2600 MHz) @20.0 MHz': '20.0', 'B1 (2100 MHz) @15 MHz': '15',
                 '20 MHz': '20', 'n78 @100 MHz': '100', '-': '', 'B3 (1800 MHz)': ''}
        for text, want in cases.items():
            r = shell(f + f'\n_bw "{text}"')
            self.assertEqual(r.stdout.strip(), want, text)

    def test_unknown_carrier_state_counts(self):
        f = one_liner('_sc_on', 'telemetry.sh')
        for state, want in (('activated', 0), ('', 0), ('-', 0), ('deactivated', 1), ('configured', 1)):
            r = shell(f + f'\n_sc_on "{state}"')
            self.assertEqual(r.returncode, want, state)

    def test_cell_file_carries_pband_and_widths(self):
        tele = (SHARE / 'telemetry.sh').read_text()
        self.assertIn('_str pband "$_pbs"', tele)
        self.assertIn('_num bw "$_pbw"', tele)
        self.assertIn('_num "s${_i}bw"     "$(_bw "$_sb")"', tele)
        self.assertIn('_sc_on "$_ss" && _nca=$((_nca + 1))', tele)
        doc = (ROOT.parent / 'docs/telemetry.md').read_text()
        self.assertIn('`pband`', doc)
        self.assertIn('`s1bw`', doc)


class ModemParsers(unittest.TestCase):
    def test_dw5821e_scell_snr_floor_dropped(self):
        src = (SHARE / 'modem/usb/413c81d7').read_text()
        self.assertIn('case "$_SC_N" in -20|-20.0) _SC_N="" ;; esac', src)

    def test_fm350_neighbour_rsrq_bounded(self):
        src = (SHARE / 'modem/usb/0e8d7127').read_text()
        start = src.index("NEIGHBORS=$(echo \"$O\" | awk -F, '") + len("NEIGHBORS=$(echo \"$O\" | awk -F, '")
        prog = src[start:src.index("\n')", start)]
        rows = '\n'.join([
            '1,4,250,99,79E,7A85A09,1301,481,103,20,,,74,9',
            '2,4,,,FFFF,00FFFFFFF,1301,263,,,75,80',
            '2,4,,,FFFF,00FFFFFFF,1301,183,,,74,30',
        ])
        r = shell("awk -F, '" + prog.replace("'", "'\\''") + "' <<'EOF'\n" + rows + '\nEOF\n')
        self.assertEqual(r.stderr, '')
        self.assertIn('"pci":"481","rsrp":"-67","rsrq":"-15.5"', r.stdout)
        self.assertIn('"pci":"263","rsrp":"-66","rsrq":""', r.stdout)
        self.assertIn('"pci":"183","rsrp":"-67","rsrq":"-5.0"', r.stdout)


class UplinkCaKept(unittest.TestCase):
    def test_choice_saved_restored_and_no_reboot(self):
        bands = (SHARE / 'bands.sh').read_text()
        self.assertIn('on) _bands_set_bg ulca setulca on ;;', bands)
        self.assertNotIn('_bands_set_bg after setulca', bands)
        self.assertIn('ulca)      "$@" && { _persist_ulca 1; _cfun_cycle;', bands)
        self.assertIn('forget) _persist_ulca 0; _bands_flush ;;', bands)
        self.assertIn('save_ulca")" = 1 ] && [ "$(getulca 2>/dev/null)" = off ]', bands)
        self.assertIn('json_add_int ulca_saved 1', bands)
        hook = (ROOT / 'root/etc/hotplug.d/iface/31-5gmodem-bands').read_text()
        self.assertIn('$(uci -q get "$SEC.save_ulca")', hook)
        ui = (ROOT / 'htdocs/luci-static/resources/view/modem5g/bandsui.js').read_text()
        self.assertIn('renderUlca(j.ulca, j.ulca_saved)', ui)
        self.assertIn("[ 'setulca', 'forget' ]", ui)

    def test_restorebands_puts_ulca_back(self):
        bands = (SHARE / 'bands.sh').read_text()
        start = bands.index('\t"restorebands")\n') + len('\t"restorebands")\n')
        body = bands[start:bands.index('\n\t\t;;\n', start)]
        stub = r'''
D=$(mktemp -d)
uci() { case "$*" in *save_ulca*) echo 1 ;; esac; }
active_modem() { echo 1-1; }
getbands() { :; }; getbands5gnsa() { :; }; getbands5gsa() { :; }
getulca() { echo off; }
setulca() { echo setulca >> "$D/ev"; }
logger() { :; }
_bands_live() { return 0; }
_cfun_cycle() { echo cfun >> "$D/ev"; }
_reconnect_iface() { echo reconnect >> "$D/ev"; }
set -- restorebands
'''
        r = shell(stub + body + '\ncat "$D/ev"; rm -rf "$D"')
        self.assertEqual(r.stdout, 'setulca\ncfun\nreconnect\n')


class Fm350UplinkCarriers(unittest.TestCase):
    # +GTCAINFO SCC rows carry <ul_configured> second (AT manual 11.1.16); 1 = the upload runs there too
    def run_parser(self, scc):
        out = '\\r\\n'.join(['+GTCAINFO:', 'PCC:103,481,1301,100,2,1,1,1,-67'] + scc + ['OK'])
        src = (
            f"sms_tool() {{ case \"$*\" in *GTCAINFO*) printf '{out}' ;; *) echo OK ;; esac; }}\n"
            "band4g() { echo \"B$1\"; }; band5g() { echo \"n$1\"; }; at_static() { :; }\n"
            f"DEVICE=/dev/null; . {SHARE}/modem/usb/0e8d7127 >/dev/null 2>&1\n"
            'echo "ULCC=$ULCC"\n')
        return shell(src).stdout.strip()

    def test_upload_carriers_listed(self):
        self.assertEqual(self.run_parser(['SCC1:2,1,101,82,525,75,75,2,1,2,1,-70',
                                          'SCC2:2,0,108,94,3648,25,255,2,1,1,1,-80']), 'ULCC=B3+B1')

    def test_no_second_upload_carrier_leaves_it_empty(self):
        self.assertEqual(self.run_parser(['SCC1:2,0,101,82,525,75,255,2,1,2,1,-70']), 'ULCC=')

    def test_wired_to_snapshot_page_and_telemetry(self):
        self.assertIn('"ulcc":"${_J_ULCC}",', (SHARE / '5gmodem.sh').read_text())
        self.assertIn('_str ul_ca "$_ul"', (SHARE / 'telemetry.sh').read_text())
        ui = (ROOT / 'htdocs/luci-static/resources/view/modem5g/5gdetail.js').read_text()
        self.assertIn("' · UL ' + ul", ui)


if __name__ == '__main__':
    unittest.main()
