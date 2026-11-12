// SPDX-License-Identifier: GPL-2.0-only
// Push alerts for call events (missed calls first) through ntfy, Telegram or a webhook.
import * as api from '../api.js';
import { h, clear, card, pageHeader, button, badge, busy, toast, confirm, kv } from '../ui.js';
import { fieldset } from '../forms.js';

const EVENTS = [
	[ 'missed', 'Missed calls' ],
	[ 'blocked', 'Blocked calls' ],
	[ 'incoming', 'Every incoming call' ],
	[ 'elsewhere', 'Calls answered on a SIP phone' ],
	[ 'recorded', 'New recordings' ]
];

export default async function alerts(ctx) {
	const root = h('div');

	const load = async () => {
		const [ cfg, st ] = await Promise.all([
			api.uci.get('aw1000_voice').catch(() => ({})),
			api.maybe('aw1000-voice', 'notify_status', {}, {})
		]);
		draw(cfg.notify || {}, st);
	};

	const draw = (n, st) => {
		const events = new Set(Array.isArray(n.events) ? n.events : String(n.events || 'missed').split(/\s+/));
		const evBox = h('div', { class: 'chips' }, EVENTS.map(([v, l]) => h('label', { class: 'chip' },
			h('input', { type: 'checkbox', value: v, checked: events.has(v) }), h('span', l))));

		const fs = fieldset([
			{ name: 'enabled', label: 'Send alerts', type: 'toggle', default: n.enabled || '0' },
			{ name: 'service', label: 'Send through', type: 'select', default: n.service || 'ntfy', options: [
				[ 'ntfy', 'ntfy (free push app)' ], [ 'telegram', 'Telegram bot' ], [ 'webhook', 'Webhook (JSON POST)' ] ] },
			{ name: 'ntfy_url', label: 'ntfy topic URL', type: 'text', default: n.ntfy_url || '', placeholder: 'https://ntfy.sh/my-phone-alerts', depends: { service: 'ntfy' },
				help: 'Install the ntfy app, subscribe to a hard-to-guess topic name and put its URL here.',
				validate: (v, all) => all.enabled !== '1' || /^https?:\/\/\S+\/\S+$/.test(v) || 'Enter the full topic URL' },
			{ name: 'ntfy_token', label: 'Access token', type: 'password', default: n.ntfy_token || '', depends: { service: 'ntfy' },
				help: 'Only for a protected topic or your own ntfy server.' },
			{ name: 'telegram_token', label: 'Bot token', type: 'password', default: n.telegram_token || '', depends: { service: 'telegram' },
				help: 'From @BotFather. Send your bot a message once so it may write to you.',
				validate: (v, all) => all.enabled !== '1' || /^[0-9]+:[A-Za-z0-9_-]{20,}$/.test(v) || 'Enter the bot token' },
			{ name: 'telegram_chat', label: 'Chat ID', type: 'text', default: n.telegram_chat || '', depends: { service: 'telegram' },
				help: 'Your user or group ID, for example from @userinfobot.',
				validate: (v, all) => all.enabled !== '1' || /^-?[0-9]+$|^@\w+$/.test(v) || 'Enter the chat ID' },
			{ name: 'webhook_url', label: 'Webhook URL', type: 'text', default: n.webhook_url || '', depends: { service: 'webhook' },
				help: 'Receives a JSON POST: event, number, name, title, text, host, time. Works with Home Assistant webhooks.',
				validate: (v, all) => all.enabled !== '1' || /^https?:\/\/\S+$/.test(v) || 'Enter the full URL' }
		]);

		const save = async () => {
			if (!fs.validate()) return false;
			const v = fs.values();
			const ev = [ ...evBox.querySelectorAll('input:checked') ].map(i => i.value);
			await api.uci.save('aw1000_voice', 'notify', { ...v, events: ev });
			await api.uci.commit('aw1000_voice');
			return true;
		};

		const hookNote = st.hook === 'managed' ? badge('Ready', 'ok') :
			st.hook === 'custom' ? badge('Your own hook is in place', 'warn') : badge('Hook missing', 'bad');

		clear(root,
			pageHeader('Alerts', 'A message on your phone for a missed call, with the caller\'s name from the phonebook. The interface itself never rings.'),
			h('div', { class: 'stack' },
				card('Alerts', fs.el,
					h('div', { class: 'field' }, h('div', { class: 'field-label' }, 'Send for'), h('div', { class: 'field-control' }, evBox)),
					st.last_error ? h('div', { class: 'alert alert-error' }, 'Last alert failed: ' + st.last_error) : null,
					h('div', { class: 'form-actions' },
						button('Send a test', { icon: 'ring', onclick: async e => {
							const btn = e.currentTarget;
							if (!await busy(btn, save)) return;
							const r = await busy(btn, () => api.call('aw1000-voice', 'notify_test', {}));
							r.result ? toast('Test sent, check your phone') : toast('Test failed: ' + (r.error || '?'), 'error', 8000);
							await load();
						} }),
						button('Save', { kind: 'primary', icon: 'check', onclick: async e => {
							if (await busy(e.currentTarget, save)) { toast('Saved'); await load(); }
						} }))),
				card('How it works', kv([
					[ 'Call event hook', hookNote ],
					[ 'Sender', st.curl ? 'curl' : 'wget' ]
				]),
					h('p', { class: 'muted', style: { marginTop: '12px' } },
						'fxsd runs /etc/fxs/hook.sh on every call event. This interface installs a small hook there that hands the event to /usr/libexec/aw1000-voice-notify.'),
					st.hook === 'custom' ? h('div', { class: 'alert alert-warn' },
						'/etc/fxs/hook.sh is your own script, so alerts from this page are not sent. Call /usr/libexec/aw1000-voice-notify "$1" "$2" from it, or replace it here (yours is kept as hook.sh.custom.*).',
						h('div', { class: 'form-actions' }, button('Replace with the alerts hook', { small: true, onclick: async ev => {
							if (!await confirm('Replace hook', 'Move your /etc/fxs/hook.sh aside and install the alerts hook?', 'Replace', 'primary')) return;
							await busy(ev.currentTarget, () => api.call('aw1000-voice', 'hook_install', {}), 'Alerts hook installed');
							await load();
						} }))) : null,
					st.hook === 'missing' ? h('div', { class: 'form-actions' }, button('Install the hook', { small: true, onclick: async ev => {
						await busy(ev.currentTarget, () => api.call('aw1000-voice', 'hook_install', {}), 'Alerts hook installed');
						await load();
					} })) : null)));
	};

	clear(root, h('div', { class: 'loading' }, h('span', { class: 'spinner' }), 'Loading…'));
	await load();
	return root;
}
