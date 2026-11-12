// SPDX-License-Identifier: GPL-2.0-only
// Every fxsd option in /etc/config/fxs main, grouped in tabs, plus MQTT.
import * as api from '../api.js';
import { h, clear, card, pageHeader, button, badge, busy } from '../ui.js';
import { sectionForm, V } from '../forms.js';

const LED = [ [ 'on', 'Solid' ], [ 'slow', 'Slow blink' ], [ 'fast', 'Fast blink' ], [ 'blip', 'Short flash every 2 seconds' ], [ 'off', 'Off' ] ];
const num = (name, label, min, max, placeholder, help, extra = {}) => ({ name, label, type: 'number', min, max, placeholder, help, ...extra });

function tabsFor(main) {
	const otherCodes = (self) => [ '*86', main.code_dnd_on || '*78', main.code_dnd_off || '*79', ...(self === 'code_redial' ? [ main.code_callback || '*69' ] : [ main.code_redial || '*66' ]) ];
	const code = (name, label, ph, help) => ({ name, label, type: 'text', placeholder: ph, help: help + ' A * and 1 to 6 digits. A speed dial with the same code goes first.',
		validate: v => { const r = V.starCode(v); if (r !== true) return r; return !v || !otherCodes(name).includes(v) || 'The phone already uses this code'; } });

	return [
		{ id: 'general', title: 'General', fields: [
			{ name: 'own_number', label: 'My number', type: 'text', placeholder: '0771234567', validate: V.phone,
				help: 'Shown on the dashboard. Most prepaid SIMs do not store their own number.' },
			{ name: 'volume', label: 'Earpiece volume', type: 'select', default: '5', options: [ '0', '1', '2', '3', '4', '5' ].map(v => [ v, v ]),
				help: 'Modem output volume (AT+CLVL).' },
			num('tx_gain', 'Microphone gain (dB)', -20, 6, '-6', 'Your voice to the other side. Lower it if they hear distortion.'),
			num('rx_gain', 'Earpiece gain (dB)', -20, 6, '0', 'Extra level of the other side in the handset.'),
			{ name: 'ringback', label: 'Ringback tone', type: 'toggle', default: '1', help: 'Play a ringing tone while the other phone rings.' },
			{ name: 'hd', label: 'HD calling', type: 'toggle', default: '0',
				help: 'Wideband (16 kHz) audio when the network supports it, on the RJ11 phone and on the SIP phones (Opus, G.722). Changing this restarts the modem, so mobile data drops for about 30 seconds.' }
		] },
		{ id: 'callerid', title: 'Caller ID', fields: [
			{ name: 'callerid', label: 'Caller ID', type: 'select', default: 'bellcore', options: [
				[ 'bellcore', 'FSK (Bellcore)' ], [ 'etsi', 'FSK (ETSI)' ], [ 'dtmf', 'DTMF' ], [ 'off', 'Off' ] ],
				help: 'Sends the caller\'s number to phones with a display. If yours shows nothing, try another format or timing.' },
			{ name: 'callerid_timing', label: 'Timing', type: 'select', default: 'after', depends: { callerid: [ 'bellcore', 'etsi', 'dtmf' ] }, options: [
				[ 'after', 'After the first ring' ], [ 'before', 'Before the first ring' ], [ 'rpas', 'Short ring, then caller ID (RP-AS, FSK only)' ] ] },
			{ name: 'callerid_format', label: 'Number', type: 'select', default: 'received', depends: { callerid: [ 'bellcore', 'etsi', 'dtmf' ] }, options: [
				[ 'received', 'As received, without the +' ], [ 'local', 'Local' ] ],
				help: 'Local shows numbers from your own country the way you dial them.' },
			{ name: 'callerid_country', label: 'Country code', type: 'text', placeholder: 'auto', datalist: [ 'auto' ], depends: { callerid_format: 'local' },
				validate: v => !v || v === 'auto' || /^[0-9]{1,4}$/.test(v) || 'Enter a country code like 94' },
			{ name: 'callerid_prefix', label: 'Local prefix', type: 'text', placeholder: 'auto', datalist: [ 'auto', 'none', '0' ], depends: { callerid_format: 'local' },
				validate: v => !v || v === 'auto' || v === 'none' || /^[0-9]{1,3}$/.test(v) || 'Enter digits, auto or none' }
		] },
		{ id: 'ring', title: 'Ringing', fields: [
			{ name: 'ring_pattern', label: 'Ring pattern', type: 'select', default: 'standard', options: [
				[ 'standard', 'Standard (2 s ring, 4 s pause)' ], [ 'short', 'Short (1 s ring, 4 s pause)' ], [ 'double', 'Double ring (UK and Australia)' ], [ 'custom', 'Custom' ] ] },
			num('ring_on', 'Ring time (ms)', 200, 8000, '2000', null, { depends: { ring_pattern: 'custom' } }),
			num('ring_off', 'Pause time (ms)', 200, 8000, '4000', null, { depends: { ring_pattern: 'custom' } })
		] },
		{ id: 'calling', title: 'Calling', fields: [
			{ name: 'call_waiting', label: 'Call waiting', type: 'toggle', default: '1', help: 'A tone during a call when a second call comes in. Press FLASH to switch.' },
			num('dial_wait', 'Dial wait (seconds)', 2, 15, '4', 'The call starts this long after the last digit. # starts it right away.'),
			code('code_redial', 'Redial code', '*66', 'Calls the last number you dialed.'),
			code('code_callback', 'Call back code', '*69', 'Calls the last person who called you.'),
			{ name: 'missed_tone', label: 'Missed call tone', type: 'toggle', default: '0', help: 'After a missed call the dial tone stutters the next time you lift the handset.' },
			{ name: 'hotline_enabled', label: 'Call when handset is lifted', type: 'toggle', default: '0',
				help: 'Lifting the handset calls one number by itself, for an older person, a gate or a counter.' },
			{ name: 'hotline', label: 'Number to call', type: 'text', placeholder: '0771234567', depends: { hotline_enabled: '1' }, validate: V.phoneRequired },
			num('hotline_delay', 'Wait before calling (seconds)', 0, 10, '5', 'With 0 no other number can be dialed, not even an emergency number.', { depends: { hotline_enabled: '1' } })
		] },
		{ id: 'history', title: 'Call history', fields: [
			{ name: 'history_autodelete', label: 'Delete old calls', type: 'toggle', default: '0' },
			num('history_days', 'Keep calls for (days)', 1, 3650, '30', null, { depends: { history_autodelete: '1' } })
		] },
		{ id: 'led', title: 'LED', fields: [
			{ name: 'led', label: 'LED', type: 'text', placeholder: 'green:phone', help: 'Leave empty to not use an LED.' },
			{ name: 'led_ready', label: 'Line ready', type: 'select', default: 'on', options: LED },
			{ name: 'led_ringing', label: 'Incoming call', type: 'select', default: 'fast', options: LED },
			{ name: 'led_offhook', label: 'Handset off hook', type: 'select', default: 'slow', options: LED },
			{ name: 'led_quiet', label: 'Quiet or do not disturb', type: 'select', default: 'blip', options: LED }
		] },
		{ id: 'mqtt', title: 'MQTT', fields: [
			{ name: 'mqtt', label: 'Send events', type: 'toggle', default: '0', help: 'Publish ring, call and hang-up events, for Home Assistant and similar.' },
			{ name: 'mqtt_host', label: 'Broker address', type: 'text', placeholder: '192.168.1.10', validate: V.host, depends: { mqtt: '1' } },
			num('mqtt_port', 'Port', 1, 65535, '1883', null, { depends: { mqtt: '1' } }),
			{ name: 'mqtt_user', label: 'User name', type: 'text', depends: { mqtt: '1' } },
			{ name: 'mqtt_password', label: 'Password', type: 'password', depends: { mqtt: '1' } },
			{ name: 'mqtt_topic', label: 'Topic', type: 'text', placeholder: 'phone', depends: { mqtt: '1' } },
			{ name: 'mqtt_numbers', label: 'Include phone numbers', type: 'toggle', default: '0', depends: { mqtt: '1' } }
		] },
		{ id: 'advanced', title: 'Advanced', fields: [
			num('flash_min', 'Shortest flash (ms)', 20, 500, '80', 'A shorter hook break is ignored.'),
			num('flash_max', 'Longest flash (ms)', 300, 3000, '700', 'A longer hook break hangs up. At least 100 ms above the shortest flash.',
				{ validate: (v, all) => !v || +v >= (+all.flash_min || 80) + 100 || 'Must be at least 100 ms above the shortest flash' }),
			num('modem_rx_gain', 'Modem receive gain', 0, 65535, '8192', 'AT+QRXGAIN value, 8192 is unity.'),
			{ name: 'channel', label: 'SLIC channel', type: 'select', default: '1', options: [ [ '1', '1' ], [ '0', '0' ] ], help: 'Only channel 1 is wired on the AW1000.' },
			{ name: 'at_port', label: 'Modem AT port', type: 'text', placeholder: 'auto', datalist: [ 'auto' ],
				help: 'auto finds the AT port by itself, also when the names change after a modem restart.' },
			{ name: 'patch', label: 'SLIC patch file', type: 'text', placeholder: '/etc/fxs/si3226x_patch.bin' }
		] }
	];
}

export default async function settings(ctx) {
	const root = h('div');
	const body = h('div');
	const tabBar = h('div', { class: 'tabs', role: 'tablist' });
	let active = 'general';
	let main = (await api.uci.get('fxs')).main || {};
	const mqtt = await api.maybe('fxs', 'mqtt_status', {}, {});

	const draw = () => {
		const tabs = tabsFor(main);
		clear(tabBar, tabs.map(t => h('button', { type: 'button', role: 'tab', class: t.id === active ? 'active' : '', 'aria-selected': t.id === active ? 'true' : 'false',
			onclick: () => { active = t.id; draw(); } }, t.title)));
		const tab = tabs.find(t => t.id === active);
		clear(body,
			active === 'mqtt' && !mqtt.client ? h('div', { class: 'alert alert-warn' }, 'Install mosquitto-client to send MQTT events.') : null,
			active === 'mqtt' && mqtt.last_error ? h('div', { class: 'alert alert-error' }, 'Last error: ' + mqtt.last_error) : null,
			sectionForm({ config: 'fxs', section: 'main', values: main, fields: tab.fields, onsaved: async () => {
				main = (await api.uci.get('fxs')).main || {};
				// One HD switch for both: msipd uses HD only when fxs and modem_sip agree.
				if (active === 'general' && ctx.info.msipd_installed) {
					await api.uci.set('modem_sip', 'main', { hd: main.hd === '1' ? '1' : '0' }).catch(() => {});
					await api.uci.commit('modem_sip').catch(() => {});
				}
				await ctx.refresh();
			} }));
	};

	draw();
	clear(root,
		pageHeader('Settings', 'Settings of the RJ11 phone port. Saving applies them right away.',
			button('Restart phone service', { icon: 'refresh', onclick: e => busy(e.currentTarget, () => api.call('aw1000-voice', 'restart', { name: 'fxsd' }), 'Phone service restarted') })),
		card(null, tabBar, body),
		h('div', { style: { marginTop: '18px' } }, card('Management interface',
			h('p', { class: 'muted' }, 'This page is served on port ' + (ctx.info.port || 7766) + '. To move it, set aw1000_voice.web.port on the router, then run the setup script again:'),
			h('pre', { class: 'mono', style: { whiteSpace: 'pre-wrap', background: 'var(--surface-2)', padding: '10px', borderRadius: 'var(--radius-sm)' } },
				'uci set aw1000_voice.web.port=7766\nuci commit aw1000_voice\n/usr/libexec/aw1000-voice-web-setup'))));
	return root;
}
