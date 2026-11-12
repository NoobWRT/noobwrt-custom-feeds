// SPDX-License-Identifier: GPL-2.0-only
// SIP phones and apps on the LAN that call through the modem (msipd).
import * as api from '../api.js';
import { h, clear, card, pageHeader, button, iconButton, badge, busy, toast, confirm, modal, kv, empty } from '../ui.js';
import { fieldset } from '../forms.js';

let qrLib = null;

// LuCI's uqr.js is a LuCI module; give it the one thing it needs, L.Class.extend.
async function qrSvg(text) {
	if (!qrLib) {
		const src = await (await fetch('lib/uqr.js')).text();
		qrLib = new Function('L', src)({ Class: { extend: o => o } });
	}
	return qrLib.renderSVG(text, { pixelSize: 4, whiteColor: '#fff', blackColor: '#000' });
}

const nameOk = n => /^[A-Za-z0-9 _-]{1,23}$/.test(n || '');
const ERR = {
	name: 'Use 1 to 23 letters, digits, spaces, _ or -.', failed: 'The router could not do that.',
	password: 'Use 8 to 31 characters: letters, digits and _.!@#%+=:,-', port: 'Ports must be 1024 to 65535.',
	range: 'The audio range must hold 10 to 1000 ports.', overlap: 'The SIP port must be outside the audio range.',
	busy: 'A call is in progress. Try again after it.', 'not-installed': 'That SIP service is not installed.', interface: 'Pick a VPN interface.'
};
const check = r => { if (r && r.result === false) throw new Error(ERR[r.error] || r.error || 'Failed'); return r; };

export default async function sip(ctx) {
	const root = h('div');

	const load = async () => {
		const [ services, msip, settings, vpn ] = await Promise.all([
			api.maybe('fxs', 'sip_services', {}, {}),
			api.maybe('modem-sip', 'status', {}, null),
			api.maybe('modem-sip', 'settings', {}, null),
			api.maybe('fxs', 'sip_vpn_status', {}, {})
		]);
		draw(services, msip, settings, vpn);
	};

	const showLogin = async (name) => {
		const r = check(await api.call('modem-sip', 'phone_login', { name }));
		const body = h('div');
		modal({ title: 'Login for ' + name, body, wide: true, actions: [ { label: 'Close', kind: 'primary' } ] });

		const qrBox = h('div', h('div', { class: 'loading' }, h('span', { class: 'spinner' }), 'Making the QR code…'));
		clear(body,
			h('div', { class: 'grid grid-2' },
				h('div', qrBox),
				h('div',
					h('p', { class: 'muted' }, 'In Linphone, scan the QR code. In other apps type these, with UDP:'),
					kv([
						[ 'Server', r.server ], [ 'Port', r.port ], [ 'User name', h('span', { class: 'mono' }, r.user) ],
						[ 'Password', h('span', { class: 'mono' }, r.password) ], [ 'Transport', 'UDP' ]
					]))));
		try {
			const q = await api.call('fxs', 'sip_qr', { phone: name });
			if (!q.url) {
				clear(qrBox, h('div', { class: 'alert alert-warn' }, (q.needs || []).join(' ') || 'A QR code is not available.'));
				return;
			}
			const svg = await qrSvg(q.url);
			clear(qrBox, h('div', { class: 'qr', html: svg }),
				h('p', { class: 'muted small', style: { textAlign: 'center' } },
					q.expires ? 'The code works for ' + Math.round((q.expires - Date.now() / 1000) / 60) + ' minutes and only on your network.' : 'Only works on your network.'),
				q.note ? h('p', { class: 'muted small' }, q.note) : null);
		} catch (e) {
			clear(qrBox, h('div', { class: 'alert alert-warn' }, 'QR code failed: ' + e.message));
		}
	};

	const addPhone = () => {
		const fs = fieldset([ { name: 'name', label: 'Phone name', type: 'text', placeholder: 'Pixel', help: 'Each phone or app gets its own login.',
			validate: v => nameOk(v) || ERR.name } ]);
		modal({ title: 'Add a SIP phone', body: fs.el, actions: [ { label: 'Cancel' }, { label: 'Add phone', kind: 'primary', onclick: async () => {
			if (!fs.validate()) return false;
			const name = fs.values().name;
			check(await api.call('modem-sip', 'phone_add', { name }));
			toast('Added ' + name);
			await load();
			showLogin(name).catch(e => toast(e.message, 'error'));
		} } ] });
	};

	const renamePhone = p => {
		const fs = fieldset([ { name: 'new', label: 'New name', type: 'text', default: p.name, validate: v => nameOk(v) || ERR.name } ]);
		modal({ title: 'Rename ' + p.name, body: fs.el, actions: [ { label: 'Cancel' }, { label: 'Rename', kind: 'primary', onclick: async () => {
			if (!fs.validate()) return false;
			check(await api.call('modem-sip', 'phone_rename', { name: p.name, new: fs.values().new }));
			toast('Renamed');
			await load();
		} } ] });
	};

	const newPassword = p => {
		const fs = fieldset([ { name: 'password', label: 'New password', type: 'text', help: 'Leave empty to make a random one. The phone has to log in again.',
			validate: v => !v || /^[A-Za-z0-9_.!@#%+=:,-]{8,31}$/.test(v) || ERR.password } ]);
		modal({ title: 'New password for ' + p.name, body: fs.el, actions: [ { label: 'Cancel' }, { label: 'Change', kind: 'primary', onclick: async () => {
			if (!fs.validate()) return false;
			check(await api.call('modem-sip', 'phone_password', { name: p.name, password: fs.values().password }));
			toast('Password changed');
			showLogin(p.name).catch(e => toast(e.message, 'error'));
		} } ] });
	};

	const draw = (services, msip, settings, vpn) => {
		const svc = (services.services || []).find(s => s.name === 'modem-sip');
		const onHere = services.enabled && services.current === 'modem-sip';
		const other = services.enabled && services.current !== 'modem-sip' ? (services.services || []).find(s => s.name === services.current) : null;

		const toggle = button(onHere ? 'Turn off' : 'Turn on', { kind: onHere ? '' : 'primary', onclick: async e => {
			if (!onHere && other && !await confirm('Switch SIP service', 'The phone port uses ' + (other.title || other.name) + ' now. Switch it to Modem SIP?', 'Switch', 'primary')) return;
			await busy(e.currentTarget, async () => check(await api.call('fxs', 'set_sip', { enabled: !onHere, name: 'modem-sip' })), onHere ? 'SIP phones are off' : 'SIP phones are on');
			await ctx.refresh();
			await load();
		} });

		const phones = msip?.phones || [];
		const settingsForm = settings ? fieldset([
			{ name: 'port', label: 'SIP port', type: 'number', min: 1024, max: 65535, default: String(settings.port) },
			{ name: 'rtp_from', label: 'Audio ports from', type: 'number', min: 1024, max: 65535, default: String(settings.rtp_from) },
			{ name: 'rtp_to', label: 'Audio ports to', type: 'number', min: 1024, max: 65535, default: String(settings.rtp_to) },
			{ name: 'hd', label: 'HD calls (Opus, G.722)', type: 'toggle', default: settings.hd ? '1' : '0',
				help: settings.phone_hd ? 'Used when the network carries HD calling.' : 'HD calling is off on the phone port, so SIP calls use narrowband too.' }
		]) : null;

		const vpnForm = fieldset([
			{ name: 'enabled', label: 'Allow phones over VPN', type: 'toggle', default: vpn.enabled ? '1' : '0',
				help: 'Phones outside the home reach the SIP server through a VPN on the router.' },
			{ name: 'interface', label: 'VPN interface', type: 'select', default: vpn.interface || '',
				options: [ [ '', 'Pick one' ], ...(vpn.vpns || []).map(v => [ v, v ]) ], depends: { enabled: '1' } }
		]);

		clear(root,
			pageHeader('SIP phones', 'Phones and apps on your network log in to the router, and calls on the SIM ring all of them together with the RJ11 phone.'),
			h('div', { class: 'stack' },
				card('SIP service', { actions: [ toggle ] },
					kv([
						[ 'Status', onHere ? (services.connected ? badge('On, connected', 'ok') : badge('On', 'accent')) : other ? badge('Using ' + (other.title || other.name), 'warn') : badge('Off') ],
						[ 'Server (msipd)', msip ? (msip.running ? badge('Running', 'ok') : badge('Stopped', 'bad')) : 'Not installed' ],
						[ 'Address', ctx.info.lan && settings ? ctx.info.lan + ':' + settings.port + ' (UDP)' : '' ]
					]),
					svc && svc.setup && svc.setup.length ? h('div', { class: 'alert alert-info', style: { marginTop: '12px' } }, svc.setup.map(l => h('div', l))) : null),

				msip ? card('Phones', { actions: [ button('Add phone', { kind: 'primary', icon: 'add', small: true, onclick: addPhone }) ] },
					phones.length ? h('div', { class: 'table-wrap' }, h('table', { class: 'table' },
						h('thead', h('tr', h('th', 'Phone'), h('th', 'User name'), h('th', 'Status'), h('th', { class: 'col-actions' }, ''))),
						h('tbody', phones.map(p => h('tr',
							h('td', h('strong', p.name)),
							h('td', h('span', { class: 'mono' }, p.user)),
							h('td', p.online ? badge('Online', 'ok') : badge('Offline')),
							h('td', { class: 'col-actions' },
								iconButton('qr', 'Login and QR code', e => busy(e.currentTarget, () => showLogin(p.name))),
								iconButton('key', 'New password', () => newPassword(p)),
								iconButton('edit', 'Rename', () => renamePhone(p)),
								iconButton('trash', 'Remove', async () => {
									if (!await confirm('Remove phone', 'Remove ' + p.name + '? It can no longer log in.', 'Remove')) return;
									check(await api.call('modem-sip', 'phone_remove', { name: p.name }));
									toast('Removed');
									await load();
								}, 'danger'))))))) :
						empty('No SIP phones yet. Add one and scan its QR code in Linphone.', 'sip')) :
					card('Phones', h('div', { class: 'alert alert-warn' }, 'The modem-sip package is not installed, so SIP phones cannot log in.')),

				h('div', { class: 'grid grid-2' },
					settingsForm ? card('Server settings', settingsForm.el, h('div', { class: 'form-actions' },
						button('Save', { kind: 'primary', icon: 'check', onclick: async e => {
							if (!settingsForm.validate()) return;
							const v = settingsForm.values();
							await busy(e.currentTarget, async () => check(await api.call('modem-sip', 'set_settings', {
								port: +v.port, rtp_from: +v.rtp_from, rtp_to: +v.rtp_to, hd: v.hd === '1' })), 'Saved');
							await load();
						} }))) : null,
					card('Away from home', vpnForm.el,
						vpn.active ? h('div', { class: 'alert alert-ok' }, 'Phones can reach the SIP server over the VPN.') : null,
						vpn.needs && vpn.needs.length ? h('div', { class: 'alert alert-warn' }, vpn.needs.join(' ')) : null,
						h('div', { class: 'form-actions' }, button('Save', { kind: 'primary', icon: 'check', onclick: async e => {
							if (!vpnForm.validate()) return;
							const v = vpnForm.values();
							await busy(e.currentTarget, async () => check(await api.call('fxs', 'set_sip_vpn', { enabled: v.enabled === '1', interface: v.interface || '' })), 'Saved');
							await load();
						} }))))));
	};

	clear(root, h('div', { class: 'loading' }, h('span', { class: 'spinner' }), 'Loading…'));
	await load();
	return root;
}
