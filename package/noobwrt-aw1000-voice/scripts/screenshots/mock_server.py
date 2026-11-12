#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-2.0-only
"""Serve the management interface with made-up demo data, for screenshots.

    python3 scripts/screenshots/mock_server.py [port]

Then open http://127.0.0.1:8766/ . /ubus answers every call the pages make
with fictional numbers and names, so no real call history is ever shown.
The page is signed in automatically. Nothing here is installed on a router.
"""
import json
import sys
import time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

WWW = Path(__file__).resolve().parents[2] / 'openwrt' / 'aw1000-voice-web' / 'files' / 'www'
NOW = int(time.time())
DAY = 86400


def ago(seconds):
    return NOW - seconds


CALLS = [
    (ago(60 * 25), 'incoming', '0712345678'), (ago(60 * 25 - 4), 'reason', 'rang important'),
    (ago(60 * 25 - 2), 'answered', '0712345678'), (ago(60 * 25 - 2 + 312), 'hangup', ''),
    (ago(60 * 70), 'incoming', '0779876543'), (ago(60 * 70 - 31), 'missed', '0779876543'),
    (ago(60 * 95), 'sipout', '0112223344'), (ago(60 * 95), 'via', 'Pixel 9'), (ago(60 * 95 - 184), 'hangup', ''),
    (ago(60 * 160), 'blocked', '0705550100'),
    (ago(60 * 200), 'dial', '0768881122'), (ago(60 * 200 - 9), 'connected', '0768881122'),
    (ago(60 * 200 - 9 + 1260), 'hangup', ''),
    (ago(DAY + 3600), 'incoming', '0723334455'), (ago(DAY + 3600 - 5), 'reason', 'silent quiet:Night'),
    (ago(DAY + 3600 - 30), 'missed', '0723334455'),
    (ago(DAY + 7000), 'incoming', '0712345678'), (ago(DAY + 7000 - 6), 'elsewhere', '0712345678'),
    (ago(DAY + 7000 - 6), 'via', 'Living room'),
    (ago(2 * DAY), 'dial', '0114445566'), (ago(2 * DAY - 12), 'connected', '0114445566'),
    (ago(2 * DAY - 12 + 95), 'recorded', '20261110-101500-0114445566.wav'), (ago(2 * DAY - 12 + 95), 'hangup', ''),
    (ago(3 * DAY), 'incoming', '0771239876'), (ago(3 * DAY - 3), 'answered', '0771239876'),
    (ago(3 * DAY - 3 + 640), 'hangup', ''),
]
CALL_LOG = '\n'.join(f'{t} {e} {n}'.rstrip() for t, e, n in sorted(CALLS, key=lambda c: c[0]))

FXS = {
    'main': {'.type': 'fxs', '.name': 'main', 'enabled': '1', 'own_number': '0771234567', 'volume': '5', 'tx_gain': '-6',
             'rx_gain': '0', 'ringback': '1', 'hd': '1', 'callerid': 'bellcore', 'callerid_timing': 'after',
             'ring_pattern': 'standard', 'call_waiting': '1', 'rec_mode': 'every', 'rec_format': 'stereo',
             'rec_flash_mb': '50', 'rec_usb_mb': '1000', 'dnd_repeat': '3', 'dnd_allow': ['0712345678'],
             'out_mode': 'off', 'led': 'green:phone', 'led_ready': 'on', 'led_ringing': 'fast', 'led_offhook': 'slow'},
    'c1': {'.type': 'contact', '.name': 'c1', '.index': 1, 'name': 'Amma', 'number': '0712345678', 'ring': 'default', 'priority': 'important'},
    'c2': {'.type': 'contact', '.name': 'c2', '.index': 2, 'name': 'Office', 'number': '0112223344', 'ring': 'short', 'priority': 'normal'},
    'c3': {'.type': 'contact', '.name': 'c3', '.index': 3, 'name': 'Nimal', 'number': '0768881122', 'ring': 'default', 'priority': 'normal'},
    'c4': {'.type': 'contact', '.name': 'c4', '.index': 4, 'name': 'Bank', 'number': '0114445566', 'ring': 'default', 'priority': 'never'},
    's1': {'.type': 'speed', '.name': 's1', '.index': 5, 'name': 'Amma', 'code': '1', 'number': '0712345678'},
    's2': {'.type': 'speed', '.name': 's2', '.index': 6, 'name': 'Office', 'code': '2', 'number': '0112223344'},
    'b1': {'.type': 'block', '.name': 'b1', '.index': 7, 'name': 'Sales calls', 'number': '0705550100'},
    'q1': {'.type': 'quiet', '.name': 'q1', '.index': 8, 'enabled': '1', 'name': 'Night', 'days': ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'],
           'from': '22:00', 'to': '07:00', 'mode': 'repeat', 'action': 'silent'},
    'q2': {'.type': 'quiet', '.name': 'q2', '.index': 9, 'enabled': '1', 'name': 'Work focus', 'days': ['mon', 'tue', 'wed', 'thu', 'fri'],
           'from': '09:00', 'to': '12:00', 'mode': 'allowed', 'action': 'once'},
    'a1': {'.type': 'alarm', '.name': 'a1', '.index': 10, 'enabled': '1', 'name': 'Wake up', 'time': '06:30', 'days': ['mon', 'tue', 'wed', 'thu', 'fri'], 'seconds': '60'},
}

REPLIES = {
    ('aw1000-voice', 'info'): {'port': 7766, 'lan': '192.168.1.1', 'hostname': 'NoobWRT', 'now': NOW, 'missed_seen': ago(2 * DAY),
                               'versions': {'web': '0.3.0-r1', 'fxsd': '0.8.1-r2', 'driver': '6.12.94.0.4.0-r1', 'msipd': '0.2.0-r1'},
                               'msipd_installed': True, 'msipd_running': True},
    ('aw1000-voice', 'notify_status'): {'hook': 'managed', 'curl': True},
    ('aw1000-voice', 'log'): {'lines': [
        'Thu Nov 12 11:53:49 2026 daemon.info fxsd[2847]: SLIC up, VBAT 58482 mV',
        'Thu Nov 12 11:53:50 2026 daemon.info fxsd[2847]: ready on channel 1, modem AT port /dev/ttyUSB2, SIP calling on',
        'Thu Nov 12 11:53:50 2026 daemon.info fxsd[2847]: SIP calling on, calls go through modem-sip',
        'Thu Nov 12 11:53:52 2026 daemon.info msipd[2790]: Pixel 9 logged in from 192.168.1.42',
        'Thu Nov 12 12:30:11 2026 daemon.info fxsd[2847]: incoming call, ringing with caller ID',
        'Thu Nov 12 12:30:15 2026 daemon.info fxsd[2847]: answered, audio 16 kHz']},
    ('fxs', 'status'): {'state': 'idle', 'peer': '', 'own': '0771234567', 'offhook': False, 'hd': True, 'sip': 2, 'sipcall': False,
                        'dnd': False, 'silent': False, 'vbat': 58482, 'vline': 48210, 'iloop': 0, 'running': True, 'module': True,
                        'guard': False, 'patch': True, 'enabled': True, 'clock_ok': True, 'sipon': True, 'siptitle': 'Modem SIP',
                        'recmode': 'every', 'recactive': False, 'modemmute': False},
    ('fxs', 'history'): {'log': CALL_LOG},
    ('fxs', 'quiet_status'): {'on': False, 'until': 0, 'now': NOW, 'scheduled': False, 'quiet_calls': 1},
    ('fxs', 'sip_services'): {'enabled': True, 'current': 'modem-sip', 'connected': True,
                              'services': [{'name': 'modem-sip', 'title': 'Modem SIP', 'status': 'running', 'setup': []}]},
    ('fxs', 'rec_status'): {'active': 0, 'flash_free_mb': 493, 'usb_present': True, 'usb_free_mb': 28940, 'files': [
        {'name': '20261110-101500-0114445566.wav', 'path': '/mnt/sda1/phone-recordings/20261110-101500-0114445566.wav', 'size': 3145728, 'keep': True, 'usb': True},
        {'name': '20261109-183022-0771239876.wav', 'path': '/root/phone-recordings/20261109-183022-0771239876.wav', 'size': 1258291, 'keep': False, 'usb': False}]},
    ('fxs', 'sip_vpn_status'): {'enabled': True, 'interface': 'wg0', 'active': True, 'down': False, 'lan': '192.168.1.1', 'needs': [], 'vpns': ['wg0', 'tailscale0']},
    ('fxs', 'mqtt_status'): {'client': True},
    ('modem-sip', 'status'): {'phone_port': True, 'running': True, 'phones': [
        {'name': 'Pixel 9', 'user': 'p4f21c8', 'online': True},
        {'name': 'Living room', 'user': 'p91ab07', 'online': True},
        {'name': 'Laptop', 'user': 'p2c7e19', 'online': False}]},
    ('modem-sip', 'settings'): {'port': 5060, 'rtp_from': 10000, 'rtp_to': 10100, 'hd': True, 'phone_hd': True},
    ('aw1000-voice', 'sms_list'): {'modem': True, 'unread': 2, 'read_at': ago(DAY), 'messages': [
        {'index': 0, 'time': ago(3 * DAY), 'number': 'Dialog', 'name': '', 'text': 'Your data balance is 18.4 GB, valid until 30/11.', 'state': 'received', 'direction': 'in'},
        {'index': 1, 'time': ago(60 * 140), 'number': '+94712345678', 'name': 'Amma', 'text': 'Are you coming for lunch on Sunday?', 'state': 'received', 'direction': 'in'},
        {'index': 2, 'time': ago(60 * 132), 'number': '+94712345678', 'name': 'Amma', 'text': 'Yes, around 12. Shall I bring anything?', 'state': 'sent', 'direction': 'out'},
        {'index': 3, 'time': ago(60 * 40), 'number': '+94712345678', 'name': 'Amma', 'text': 'Just bring the kids 😊', 'state': 'received', 'direction': 'in', 'unread': True},
        {'index': 4, 'time': ago(60 * 12), 'number': '+94768881122', 'name': 'Nimal', 'text': 'Meeting moved to 4pm, see you there.', 'state': 'received', 'direction': 'in', 'unread': True}]},
}


def uci_get(config):
    if config == 'fxs':
        return FXS
    if config == 'modem_sip':
        return {'main': {'.type': 'main', '.name': 'main', 'port': '5060', 'rtp_from': '10000', 'rtp_to': '10100', 'hd': '1'}}
    if config == 'aw1000_voice':
        return {'web': {'.type': 'web', '.name': 'web', 'port': '7766', 'listen': 'lan'},
                'notify': {'.type': 'notify', '.name': 'notify', 'enabled': '1', 'service': 'ntfy',
                           'events': ['missed', 'sms', 'blocked'], 'ntfy_url': 'https://ntfy.sh/my-phone-alerts'},
                'sms': {'.type': 'sms', '.name': 'sms', 'enabled': '1', 'sip': '1', 'interval': '10'}}
    return {}


class Handler(SimpleHTTPRequestHandler):
    extensions_map = {**SimpleHTTPRequestHandler.extensions_map, '.js': 'text/javascript', '.css': 'text/css',
                      '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.png': 'image/png'}

    def __init__(self, *a, **kw):
        super().__init__(*a, directory=str(WWW), **kw)

    def log_message(self, *a):
        pass

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def do_GET(self):
        if self.path.split('?')[0] in ('/', '/index.html'):
            html = (WWW / 'index.html').read_text().replace('@VERSION@', 'demo')
            html = html.replace('<head>', "<head><script>localStorage.setItem('aw1kv.session','demo0000000000000000000000000000')</script>", 1)
            body = html.encode()
            self.send_response(200)
            self.send_header('Content-Type', 'text/html; charset=utf-8')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        if self.path.startswith('/lib/uqr.js'):
            self.send_error(404)
            return
        super().do_GET()

    def do_POST(self):
        length = int(self.headers.get('Content-Length') or 0)
        req = json.loads(self.rfile.read(length) or b'{}')
        params = req.get('params') or []
        result = [0, {}]
        if req.get('method') == 'call' and len(params) >= 3:
            obj, method = params[1], params[2]
            args = params[3] if len(params) > 3 else {}
            if (obj, method) == ('session', 'login'):
                result = [0, {'ubus_rpc_session': 'demo0000000000000000000000000000'}]
            elif obj == 'uci' and method == 'get':
                result = [0, {'values': uci_get(args.get('config'))}]
            elif (obj, method) in REPLIES:
                result = [0, REPLIES[(obj, method)]]
            else:
                result = [0, {'result': True}]
        body = json.dumps({'jsonrpc': '2.0', 'id': req.get('id'), 'result': result}).encode()
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)


if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8766
    print(f'demo interface on http://127.0.0.1:{port}/', flush=True)
    ThreadingHTTPServer(('127.0.0.1', port), Handler).serve_forever()
