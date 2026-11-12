// SPDX-License-Identifier: GPL-2.0-only
// Network services through the modem: call forwarding and USSD codes.
import * as api from '../api.js';
import { h, clear, card, pageHeader, button, badge, busy, toast } from '../ui.js';

const REASONS = [
	[ 'always', 'All calls' ],
	[ 'busy', 'When busy' ],
	[ 'noanswer', 'When not answered' ],
	[ 'unreachable', 'When unreachable' ]
];

const ERR = {
	stopped: 'The phone service is not running.', timeout: 'The network did not answer in time.',
	number: 'Enter a number with at least 3 digits.', seconds: 'The wait must be 5 to 30 seconds.',
	code: 'Enter a code like *123#.', reply: 'Bad reply from the modem.', busy: 'The line is busy.'
};
const errText = r => ERR[r.error] || r.error || 'Failed';

function forwardRow(reason, title) {
	const state = h('span', { class: 'muted small' }, 'Not checked');
	const number = h('input', { type: 'text', placeholder: 'Forward to, like 0771234567' });
	const secs = reason === 'noanswer' ? h('input', { type: 'number', min: 5, max: 30, placeholder: '20', style: { maxWidth: '110px' } }) : null;

	const check = async btn => {
		const r = await busy(btn, () => api.call('fxs', 'forward_get', { reason }));
		if (!r.ok) { clear(state, badge(errText(r), 'bad')); return; }
		if (r.text === 'off' || !r.text) { clear(state, badge('Off')); return; }
		const p = r.text.split(',');
		clear(state, badge('On, to ' + p[1] + (+p[2] > 0 ? ' after ' + +p[2] + ' s' : ''), 'ok'));
		if (p[1] && !number.value) number.value = p[1];
		if (secs && +p[2] > 0 && !secs.value) secs.value = +p[2];
	};
	const set = async (btn, on) => {
		const args = { reason, number: on ? number.value.trim() : '', seconds: on && secs ? secs.value.trim() : '' };
		if (on && !/^\+?[0-9]{3,21}$/.test(args.number)) { toast(ERR.number, 'error'); return; }
		const r = await busy(btn, () => api.call('fxs', 'forward_set', args));
		if (!r.ok) { toast(errText(r), 'error'); return; }
		toast(on ? 'Forwarding is on' : 'Forwarding is off');
		check(null);
	};

	return h('div', { class: 'field' },
		h('div', h('div', { class: 'field-label' }, title), state),
		h('div', { class: 'field-control' },
			h('div', { class: 'list-add' }, number, secs),
			h('div', { class: 'row-actions', style: { marginTop: '8px' } },
				button('Check', { small: true, onclick: e => check(e.currentTarget) }),
				button('Turn on', { small: true, kind: 'primary', onclick: e => set(e.currentTarget, true) }),
				button('Turn off', { small: true, onclick: e => set(e.currentTarget, false) }))));
}

export default async function services(ctx) {
	const out = h('pre', { class: 'mono', style: { whiteSpace: 'pre-wrap', margin: '12px 0 0', minHeight: '60px', padding: '12px', background: 'var(--surface-2)', borderRadius: 'var(--radius-sm)' } }, 'Replies show here.');
	const code = h('input', { type: 'text', placeholder: '*123#' });
	const reply = h('input', { type: 'text', placeholder: 'Menu choice, like 1', hidden: true });
	const replyBtn = button('Send choice', { small: true, onclick: e => send(e.currentTarget, true) });
	const endBtn = button('End session', { small: true, onclick: async e => {
		await busy(e.currentTarget, () => api.call('fxs', 'ussd_end', {}));
		more(false);
		out.textContent += '\n— session ended —';
	} });
	const more = on => { reply.hidden = !on; replyBtn.hidden = !on; endBtn.hidden = !on; };
	more(false);

	const send = async (btn, isReply) => {
		const args = isReply ? { reply: reply.value.trim() } : { code: code.value.trim() };
		if (!isReply && !/^[*#][0-9*#]*#$/.test(args.code)) { toast(ERR.code, 'error'); return; }
		out.textContent = isReply ? out.textContent + '\n> ' + args.reply : 'Sending ' + args.code + '…';
		const r = await busy(btn, () => api.call('fxs', 'ussd', args));
		if (!r.ok) { out.textContent += '\n' + errText(r); more(false); return; }
		out.textContent = (isReply ? out.textContent + '\n' : '') + (r.text || 'Done.').split('|').join('\n');
		reply.value = '';
		more(!!r.more);
	};

	return h('div',
		pageHeader('Phone services', 'Settings kept by the mobile network for your SIM. They work for the RJ11 phone and the SIP phones alike.'),
		h('div', { class: 'stack' },
			card('Call forwarding', h('p', { class: 'muted' }, 'Check reads the current setting from the network.'),
				REASONS.map(([r, t]) => forwardRow(r, t))),
			card('USSD codes', h('p', { class: 'muted' }, 'Balance checks, data packs and carrier menus, like *123#.'),
				h('div', { class: 'list-add' }, code, button('Send', { kind: 'primary', onclick: e => send(e.currentTarget, false) })),
				h('div', { class: 'list-add', style: { marginTop: '8px' } }, reply, replyBtn, endBtn),
				out)));
}
