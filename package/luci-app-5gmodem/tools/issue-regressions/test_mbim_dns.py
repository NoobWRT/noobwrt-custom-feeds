#!/usr/bin/env python3
# A field report on OpenWrt 25.12.6: an MBIM modem connected, probes by IP passed, but nothing
# resolved. mbim.sh of that release (umbim commit 152b86e6ab) hands the network's DNS servers to
# <iface>_4/_6 only with dhcp=1, and dhcp defaults to auto, so resolv.conf.auto stayed empty.
# The app must put the servers the modem reported back, only in that state, and say so in the
# diagnostic report.
import tempfile
import unittest
from pathlib import Path

from test_runtime_audit import ROOT, SHARE, function, shell

STUBS = r'''
uci() {
	case "$*" in
		*network.tmodem.proto) echo mbim ;;
		*network.tmodem.peerdns) [ "$MODE" = peer0 ] && echo 0 ;;
		*.at_port) echo /dev/null ;;
	esac
}
sec_for_iface() { echo m_test; }
ubus() {
	case "$2" in
		network.interface.tmodem)
			if [ "$MODE" = fixed ]; then echo '"up": true DNS 1.2.3.4'; else echo '"up": true'; fi ;;
		network.interface.tmodem_4) echo '"up": true ADDR 10.0.0.56' ;;
		*) return 1 ;;
	esac
}
jsonfilter() {
	read -r _l
	case "$2" in
		*dns-server*) case "$_l" in *DNS*) echo "${_l##* }" ;; esac ;;
		*ipv4-address*) case "$_l" in *ADDR*) echo "${_l##* }" ;; esac ;;
	esac
}
logread() {
	[ "$MODE" = nolog ] && return 0
	cat <<'L'
netifd: tmodem (100): mbim[100] Setting up wwan0
netifd: tmodem (100):   ipv4dnsserver: 9.9.9.9
netifd: tmodem (200): mbim[200] Setting up wwan0
netifd: tmodem (200):   ipv4gateway: 10.0.0.57
netifd: tmodem (200):   ipv4dnsserver: 10.0.53.1
netifd: tmodem (200):   ipv4dnsserver: 10.0.53.2
netifd: other (300):   ipv4dnsserver: 6.6.6.6
L
}
at_query() {
	printf '%s\n' '+CGCONTRDP: 2,5,"x","100.64.1.1.255.255.255.0","100.64.1.2","8.8.4.4",""' \
		'+CGCONTRDP: 1,5,"internet","10.0.0.56.255.255.255.240","10.0.0.57","10.0.53.1","10.0.53.2"' OK
}
killall() { echo HUP >> "$D/events"; }
logger() { echo LOG >> "$D/events"; }
mkdir() { :; }
'''


class MbimDns(unittest.TestCase):
    def run_fix(self, mode, calls=2):
        with tempfile.TemporaryDirectory() as d:
            resolv = Path(d) / 'resolv.auto'
            resolv.write_text('# Interface lan\n')
            code = (function('mbim_lost_dns', 'lib.sh') + '\n' + function('_mbim_dns_fix_l', 'lib.sh'))
            code = code.replace('/tmp/resolv.conf.d/resolv.conf.auto', str(resolv))
            code = code.replace('/tmp/5gmodem/', d + '/')
            src = f'D={d}; MODE={mode}\n' + STUBS + code + '\n' + \
                '\n'.join(['_mbim_dns_fix_l tmodem; echo "rc=$?"'] * calls)
            r = shell(src)
            self.assertEqual(r.stderr, '')
            events = (Path(d) / 'events').read_text() if (Path(d) / 'events').exists() else ''
            return r.stdout, resolv.read_text(), events

    def test_servers_of_the_last_session_are_restored_once(self):
        out, resolv, events = self.run_fix('buggy')
        self.assertEqual(out, 'rc=0\nrc=0\n')
        self.assertEqual(resolv, '# Interface lan\n# Interface tmodem_4\n'
                                 'nameserver 10.0.53.1\nnameserver 10.0.53.2\n')
        self.assertEqual(events, 'HUP\nLOG\n')

    def test_at_context_of_this_link_when_the_log_is_gone(self):
        _, resolv, _ = self.run_fix('nolog', 1)
        self.assertIn('nameserver 10.0.53.1\nnameserver 10.0.53.2\n', resolv)
        self.assertNotIn('8.8.4.4', resolv)

    def test_left_alone_with_dns_or_peerdns_off(self):
        for mode in ('fixed', 'peer0'):
            out, resolv, events = self.run_fix(mode, 1)
            self.assertEqual(out, 'rc=1\n', mode)
            self.assertEqual(resolv, '# Interface lan\n', mode)
            self.assertEqual(events, '', mode)

    def test_wired_into_watchdog_hotplug_and_report(self):
        lib = (SHARE / 'lib.sh').read_text()
        self.assertIn('( flock 8 || exit 1; _mbim_dns_fix_l "$1" ) 8>/tmp/5gmodem/mbimdns.lock', lib)
        health = (SHARE / 'health.sh').read_text()
        self.assertIn('\t\tmbim_dns_fix "$_e_if"\n', health)
        self.assertIn('_df_if="${2%_[46]}"', health)
        hook = (ROOT / 'root/etc/hotplug.d/iface/60-5gmodem-health').read_text()
        self.assertIn('health.sh dnsfix "$INTERFACE"', hook)
        collect = (SHARE / 'collect.sh').read_text()
        self.assertIn('_dv_lost=$(mbim_lost_dns "$_dv_i")', collect)
        self.assertIn('_sv_lost=$(mbim_lost_dns "$_sv_if")', collect)
        self.assertIn('grep -v "protection is active"', collect)


if __name__ == '__main__':
    unittest.main()
