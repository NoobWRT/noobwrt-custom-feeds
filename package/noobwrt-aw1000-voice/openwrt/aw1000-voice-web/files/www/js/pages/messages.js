// SPDX-License-Identifier: GPL-2.0-only
// SMS inbox: conversations by number, reply, new message, delete, settings.
import * as api from '../api.js';
import { h, clear, icon, card, pageHeader, button, iconButton, badge, busy, toast, confirm, modal, fmtTime, fmtAgo, empty } from '../ui.js';
import { fieldset, V } from '../forms.js';
import { digits } from '../calllog.js';

// GSM-7 basic set; anything else makes the SMS use UCS-2 (70 characters a part).
const GSM = '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà^{}\\[~]|€';

function segments(text) {
	const gsm = [ ...text ].every(c => GSM.includes(c));
	const len = gsm ? [ ...text ].reduce((n, c) => n + ('^{}\\[~]|€'.includes(c) ? 2 : 1), 0) : [ ...text ].length;
	const one = gsm ? 160 : 70, many = gsm ? 153 : 67;
	const parts = len <= one ? 1 : Math.ceil(len / many);
	return { len, parts, gsm };
}

// Senders like "Airtel" or "700" cannot be answered with an SMS.
const canReply = n => /^\+?[0-9]{5,20}$/.test(n || '');
const keyOf = n => (/[0-9]{5,}/.test(n || '') ? digits(n) : (n || '?').toLowerCase());

const ERR = {
	number: 'Enter a phone number.', empty: 'Write a message first.', long: 'The message is too long.',
	indexes: 'Nothing to delete.', delete: 'The modem did not delete it.'
};

export default async function messages(ctx) {
	const root = h('div');
	let data = { messages: [] }, current = null, cfg = {};

	const threads = () => {
		const map = new Map();
		for (const m of data.messages) {
			const k = keyOf(m.number);
			if (!map.has(k)) map.set(k, { key: k, number: m.number, name: m.name, list: [] });
			const t = map.get(k);
			t.list.push(m);
			if (m.name) t.name = m.name;
			if (canReply(m.number) && !canReply(t.number)) t.number = m.number;
		}
		for (const t of map.values()) {
			t.list.sort((a, b) => a.time - b.time);
			t.last = t.list[t.list.length - 1];
			t.unread = t.list.filter(m => m.unread).length;
		}
		return [ ...map.values() ].sort((a, b) => b.last.time - a.last.time);
	};

	const load = async () => {
		const [ d, c ] = await Promise.all([
			api.call('aw1000-voice', 'sms_list', {}).catch(() => ({ modem: false, messages: [] })),
			api.uci.get('aw1000_voice').catch(() => ({}))
		]);
		data = d;
		cfg = c.sms || {};
		ctx.smsUnread = d.unread || 0;
		ctx.redraw?.();
	};

	const markRead = async () => {
		if (!data.messages.some(m => m.unread)) return;
		await api.call('aw1000-voice', 'sms_read', {}).catch(() => {});
		data.messages.forEach(m => { m.unread = false; });
		ctx.smsUnread = 0;
		ctx.redraw?.();
	};

	const send = async (number, text) => {
		const r = await api.call('aw1000-voice', 'sms_send', { number, text });
		if (!r.result) throw new Error(ERR[r.error] || r.error || 'The SMS was not sent');
		toast('SMS sent');
		await load();
	};

	const compose = (number = '') => {
		const counter = h('div', { class: 'muted small' });
		const fs = fieldset([
			{ name: 'number', label: 'To', type: 'text', default: number, placeholder: '0771234567', validate: V.phoneRequired },
			{ name: 'text', label: 'Message', type: 'text', validate: v => !!v || 'Write a message' }
		]);
		const ta = h('textarea', { rows: 5, placeholder: 'Message', oninput: () => count() });
		const count = () => {
			const s = segments(ta.value);
			counter.textContent = s.len + ' characters · ' + s.parts + ' SMS' + (s.gsm ? '' : ' (Unicode)');
		};
		// swap the single-line text field for a textarea
		const textRow = fs.el.querySelectorAll('.field')[1];
		textRow.querySelector('.field-control').replaceChildren(ta, counter);
		count();
		modal({ title: 'New message', body: fs.el, actions: [ { label: 'Cancel' }, { label: 'Send', kind: 'primary', onclick: async () => {
			const n = fs.values().number;
			if (V.phoneRequired(n) !== true) { toast('Enter a phone number', 'error'); return false; }
			if (!ta.value.trim()) { toast('Write a message first', 'error'); return false; }
			await send(n, ta.value);
			current = keyOf(n);
			draw();
		} } ] });
	};

	const thread = t => {
		const ta = h('textarea', { rows: 2, placeholder: canReply(t.number) ? 'Write a reply' : 'This sender cannot get replies', disabled: !canReply(t.number) });
		const counter = h('span', { class: 'muted small' });
		const sendBtn = button('Send', { kind: 'primary', icon: 'out', disabled: !canReply(t.number), onclick: async e => {
			if (!ta.value.trim()) return;
			await busy(e.currentTarget, () => send(t.number, ta.value));
			ta.value = '';
			draw();
		} });
		ta.addEventListener('input', () => {
			const s = segments(ta.value);
			counter.textContent = ta.value ? s.parts + ' SMS · ' + s.len : '';
		});
		ta.addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) sendBtn.click(); });

		const bubbles = h('div', { class: 'bubbles' }, t.list.map(m => h('div', { class: 'bubble ' + m.direction + (m.unread ? ' unread' : '') },
			h('div', { class: 'bubble-text' }, m.text),
			h('div', { class: 'bubble-meta' },
				fmtTime(m.time),
				m.direction === 'out' ? ' · ' + (m.state === 'sent' ? 'Sent' : m.state) : '',
				h('button', { class: 'bubble-del', type: 'button', title: 'Delete', 'aria-label': 'Delete message', onclick: async () => {
					if (!await confirm('Delete message', 'Delete this message from the modem?')) return;
					const r = await api.call('aw1000-voice', 'sms_delete', { indexes: [ m.index ] });
					if (!r.result) { toast(ERR[r.error] || 'Not deleted', 'error'); return; }
					await load(); draw();
				} }, icon('trash'))))));

		const view = h('div', { class: 'chat' },
			h('div', { class: 'chat-head' },
				iconButton('in', 'Back', () => { current = null; draw(); }, 'chat-back'),
				h('div', { class: 'chat-who' }, h('strong', t.name || t.number), t.name ? h('span', { class: 'muted small' }, t.number) : null),
				iconButton('trash', 'Delete conversation', async () => {
					if (!await confirm('Delete conversation', 'Delete all ' + t.list.length + ' messages with ' + (t.name || t.number) + ' from the modem?')) return;
					const r = await api.call('aw1000-voice', 'sms_delete', { indexes: t.list.map(m => m.index) });
					if (!r.result) { toast(ERR[r.error] || 'Not deleted', 'error'); return; }
					current = null;
					await load(); draw();
				}, 'danger')),
			bubbles,
			h('div', { class: 'chat-compose' }, ta, h('div', { class: 'chat-send' }, counter, sendBtn)));
		requestAnimationFrame(() => { bubbles.scrollTop = bubbles.scrollHeight; });
		return view;
	};

	const draw = () => {
		const ts = threads();
		const open = ts.find(t => t.key === current);
		if (open && open.unread) markRead();

		const list = ts.length ? h('ul', { class: 'threads' }, ts.map(t => h('li', {
			class: 'thread' + (t.key === current ? ' active' : '') + (t.unread ? ' unread' : ''),
			tabindex: 0, role: 'button',
			onclick: () => { current = t.key; draw(); },
			onkeydown: e => { if (e.key === 'Enter') { current = t.key; draw(); } }
		},
			h('div', { class: 'avatar' }, (t.name || t.number || '?').replace(/^\+/, '').slice(0, 1).toUpperCase()),
			h('div', { class: 'thread-main' },
				h('div', { class: 'thread-top' }, h('strong', t.name || t.number), h('span', { class: 'muted small' }, fmtAgo(t.last.time))),
				h('div', { class: 'thread-last' }, (t.last.direction === 'out' ? 'You: ' : '') + t.last.text)),
			t.unread ? h('span', { class: 'nav-badge' }, t.unread) : null))) : empty(data.modem === false ? 'The modem is not available, so no SMS can be read.' : 'No messages.', 'sms');

		const settings = fieldset([
			{ name: 'enabled', label: 'Watch for new SMS', type: 'toggle', default: cfg.enabled ?? '1',
				help: 'Checks the modem every few seconds for alerts and SIP phones.' },
			{ name: 'sip', label: 'Send SMS to SIP phones', type: 'toggle', default: cfg.sip ?? '1',
				help: 'Each new SMS arrives in the chat of every SIP phone and app (Linphone), from the sender\'s number. A reply there goes out as an SMS.' },
			{ name: 'interval', label: 'Check every (seconds)', type: 'number', min: 5, max: 300, default: cfg.interval || '10' }
		]);

		clear(root,
			pageHeader('Messages', 'SMS on the modem SIM. New messages also reach the SIP phones\' chat and your alerts.',
				data.unread ? button('Mark all read', { icon: 'check', onclick: async e => { await busy(e.currentTarget, markRead); draw(); } }) : null,
				button('Refresh', { icon: 'refresh', onclick: async e => { await busy(e.currentTarget, load); draw(); } }),
				button('New message', { kind: 'primary', icon: 'add', onclick: () => compose() })),
			h('div', { class: 'messenger' + (open ? ' has-open' : '') },
				h('div', { class: 'card thread-list' }, list),
				h('div', { class: 'card thread-view' }, open ? thread(open) : empty('Pick a conversation.', 'sms'))),
			h('div', { style: { marginTop: '18px' } }, card('SMS settings', settings.el, h('div', { class: 'form-actions' },
				button('Save', { kind: 'primary', icon: 'check', onclick: async e => {
					if (!settings.validate()) return;
					await busy(e.currentTarget, async () => {
						await api.uci.save('aw1000_voice', 'sms', settings.values());
						await api.uci.commit('aw1000_voice');
					}, 'Saved');
				} })))));
	};

	clear(root, h('div', { class: 'loading' }, h('span', { class: 'spinner' }), 'Loading…'));
	await load();
	draw();
	const timer = setInterval(async () => {
		if (!document.body.contains(root)) { clearInterval(timer); return; }
		const before = data.messages.length;
		await load();
		if (data.messages.length !== before) draw();
	}, 30000);
	return root;
}
