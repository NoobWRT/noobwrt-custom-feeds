// SPDX-License-Identifier: GPL-2.0-only
// Dashboard
import * as api from '../api.js';
import { h, clear, icon, card, button, stat, kv, badge, busy, fmtTime, fmtAgo, fmtDuration, empty } from '../ui.js';
import { statusOf, isMissed, duration, nameBook, digits } from '../calllog.js';
import { STATE_TEXT } from '../app.js';

const REC = { every: 'All calls', all: 'All but the never list', chosen: 'Chosen numbers' };

export default async function dashboard(ctx) {
	const root = h('div');
	let fxs, quiet, sip, msip, sms;

	const load = async () => {
		[ fxs, quiet, sip, msip, sms ] = await Promise.all([
			api.uci.get('fxs').catch(() => ({})),
			api.maybe('fxs', 'quiet_status', {}, {}),
			api.maybe('fxs', 'sip_services', {}, {}),
			api.maybe('modem-sip', 'status', {}, null),
			api.maybe('aw1000-voice', 'sms_list', {}, { messages: [], unread: 0 })
		]);
	};

	const draw = () => {
		const s = ctx.status || {}, info = ctx.info || {};
		const nameOf = nameBook(fxs);
		const calls = ctx.calls || [];
		const today = new Date(); today.setHours(0, 0, 0, 0);
		const todays = calls.filter(c => c.start >= today.getTime() / 1000);
		const phones = msip?.phones || [];
		const online = phones.filter(p => p.online).length;
		const seen = info.missed_seen || 0;

		// ---- line status ------------------------------------------------
		let tone = 'ok', title = STATE_TEXT[s.state] || 'Unknown', sub = 'Ready for calls.';
		if (s.enabled === false) { tone = 'bad'; title = 'Phone port off'; sub = 'The RJ11 phone does not ring. SIP phones still work.'; }
		else if (!s.running) { tone = 'bad'; title = 'Not running'; sub = 'See Line health for details.'; }
		else if (s.state === 'ringing') { tone = 'ring'; sub = 'From ' + (nameOf(s.peer) || s.peer || 'Unknown'); }
		else if (s.state === 'talking') { tone = ''; sub = 'With ' + (nameOf(s.peer) || s.peer || 'Unknown') + (s.duration ? ' · ' + fmtDuration(s.duration) : ''); }
		else if (s.state && s.state !== 'idle') { tone = ''; sub = 'Handset off hook.'; }

		const problems = [];
		if (s.running === false && s.enabled !== false) problems.push('fxsd is not running.');
		if (s.module === false) problems.push('Phone driver not loaded.');
		if (s.patch === false) problems.push('SLIC patch file missing.');
		if (s.clock_ok === false) problems.push('Router clock not set.');
		if (s.running && s.modemmute) problems.push('Last call had no modem sound.');

		const quietOn = quiet.on || s.dnd || s.silent;
		const setQuiet = async (btn, minutes) => {
			await busy(btn, () => api.call('fxs', 'quiet_set', { minutes }), minutes ? 'Quiet enabled' : 'Quiet disabled');
			quiet = await api.maybe('fxs', 'quiet_status', {}, {});
			await ctx.refresh();
			draw();
		};

		// ---- recent items -----------------------------------------------
		const recentCalls = calls.slice(0, 7);
		const threads = new Map();
		for (const m of (sms.messages || []).slice().sort((a, b) => b.time - a.time)) {
			const k = /[0-9]{5,}/.test(m.number) ? digits(m.number) : m.number;
			if (!threads.has(k)) threads.set(k, { last: m, unread: 0, name: m.name || nameOf(m.number) });
			if (m.unread) threads.get(k).unread++;
		}
		const recentSms = [ ...threads.values() ].slice(0, 5);

		clear(root,
			h('div', { class: 'dashboard-head' },
				h('div', { class: 'dashboard-meta' },
					h('span', { class: 'dashboard-title' }, info.hostname || 'Router'),
					h('span', { class: 'dashboard-dot' }, '·'),
					h('span', { class: 'dashboard-date' }, new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' }))),
				ctx.missed ? button('Mark seen (' + ctx.missed + ')', { small: true, icon: 'check', onclick: async e => { await busy(e.currentTarget, () => ctx.markSeen(), 'Marked as seen'); draw(); } }) : null),

			// Top KPI Metric Strip 
			h('div', { class: 'stats' },
				stat('Missed calls', ctx.missed, ctx.missed ? 'bad' : '', () => ctx.go('calls'), 'missed', ctx.missed ? 'not seen yet' : 'none'),
				stat('Calls today', todays.length, '', () => ctx.go('calls'), 'calls',
					todays.length ? todays.filter(c => c.dir === 'in').length + ' in · ' + todays.filter(c => c.dir === 'out').length + ' out' : 'quiet day'),
				stat('Messages', ctx.smsUnread, ctx.smsUnread ? 'bad' : '', () => ctx.go('messages'), 'sms', ctx.smsUnread ? 'unread SMS' : (sms.messages || []).length + ' total'),
				stat('SIP endpoints', online + '/' + phones.length, '', () => ctx.go('sip'), 'sip',
					sip.enabled ? (sip.connected ? 'service active' : 'service on') : 'service off')),

			problems.length ? h('div', { class: 'alert alert-warn' }, problems.join(' '), ' ', h('a', { href: '#/line' }, 'Open line health')) : null,

			// Main 2-Column Asymmetric Hub
			h('div', { class: 'grid grid-2' },
				// Left Pane: Core Telephony & Recent Calls
				h('div', { class: 'stack' },
					card('Phone line', { actions: [ button(s.enabled === false ? 'Turn on' : 'Turn off', {
						small: true, kind: s.enabled === false ? 'primary' : '',
						onclick: async e => {
							await busy(e.currentTarget, () => api.call('fxs', 'set_enabled', { enabled: s.enabled === false }), 'Port ' + (s.enabled === false ? 'on' : 'off'));
							await ctx.refresh(); draw();
						}
					}) ] },
						h('div', { class: 'hero hero-' + tone },
							h('div', { class: 'hero-icon' }, icon(s.state === 'ringing' ? 'ring' : 'calls')),
							h('div', { class: 'hero-text' }, h('strong', title), h('span', { class: 'muted small' }, sub))),
						h('div', { style: { marginTop: '12px' } }, kv([
							[ 'Number', s.own || '—' ],
							[ 'Line voltage', s.vline != null ? (s.vline / 1000).toFixed(1) + ' V' : '—' ],
							[ 'HD voice', s.hd ? badge('Enabled', 'ok') : badge('Disabled') ],
							[ 'Recording', s.recmode && s.recmode !== 'off' ? badge(s.recactive ? 'Recording' : REC[s.recmode] || s.recmode, s.recactive ? 'bad' : 'accent') : badge('Off') ]
						])),
						s.guard && !s.running ? h('div', { class: 'form-actions' }, button('Clear start guard', { small: true, onclick: async e => {
							await busy(e.currentTarget, () => api.call('fxs', 'clear_guard', {}), 'Restarting');
							await ctx.refresh(); draw();
						} })) : null),

					card('Recent calls', { actions: [ button('All calls', { small: true, onclick: () => ctx.go('calls') }) ] },
						recentCalls.length ? h('ul', { class: 'mini-list' }, recentCalls.map(c => {
							const bad = c.status === 'missed' || c.status === 'blocked' || c.status === 'failed';
							const name = nameOf(c.number), d = duration(c);
							return h('li', { class: isMissed(c) && c.start > seen ? 'unseen' : '' },
								h('div', { class: 'call-dir ' + (bad ? 'bad' : c.dir) }, icon(c.status === 'missed' ? 'missed' : c.status === 'blocked' ? 'block' : c.dir === 'in' ? 'in' : 'out')),
								h('div', { class: 'grow' },
									h('div', { class: 'title' }, name || c.number || 'Unknown number'),
									h('div', { class: 'sub' }, statusOf(c) + (d ? ' · ' + fmtDuration(d) : ''))),
								h('span', { class: 'when', title: fmtTime(c.start) }, fmtAgo(c.start)));
						})) : empty('No calls yet.'))),

				// Right Pane: Messages, Do Not Disturb, and SIP Endpoints
				h('div', { class: 'stack' },
					card('Recent messages', { actions: [ button('Inbox', { small: true, onclick: () => ctx.go('messages') }) ] },
						recentSms.length ? h('ul', { class: 'mini-list' }, recentSms.map(t => h('li', { class: t.unread ? 'unseen' : '', style: { cursor: 'pointer' }, onclick: () => ctx.go('messages') },
							h('div', { class: 'avatar' }, (t.name || t.last.number || '?').replace(/^\+/, '').slice(0, 1).toUpperCase()),
							h('div', { class: 'grow' },
								h('div', { class: 'title' }, t.name || t.last.number, t.unread ? ' ' : '', t.unread ? badge(t.unread + ' new', 'bad') : null),
								h('div', { class: 'sub' }, (t.last.direction === 'out' ? 'You: ' : '') + t.last.text)),
							h('span', { class: 'when' }, t.last.time ? fmtAgo(t.last.time) : '')))) :
							empty(sms.modem === false ? 'Modem unavailable.' : 'No messages.', 'sms')),

					card('Do not disturb', { actions: [ button('Windows', { small: true, onclick: () => ctx.go('quiet') }) ] },
						h('div', { class: 'hero hero-' + (quietOn ? 'ring' : 'ok') },
							h('div', { class: 'hero-icon' }, icon('moon')),
							h('div', { class: 'hero-text' },
								h('strong', quiet.on ? 'Quiet active' : s.dnd ? 'Quiet window' : 'Normal mode'),
								h('span', { class: 'muted small' }, quiet.on && quiet.until > 0 ? 'Until ' + fmtTime(quiet.until) : quiet.on ? 'Until turned off' :
									quiet.quiet_calls ? quiet.quiet_calls + ' call(s) silenced' : 'Phone rings as normal.'))),
						quietOn ? h('div', { style: { marginTop: '8px' } }, badge('Quiet active', 'warn')) : null,
						h('div', { class: 'quick', style: { marginTop: '10px' } },
							quiet.on ? button('Turn off', { kind: 'primary', small: true, onclick: e => setQuiet(e.currentTarget, 0) }) : [
								button('1 hour', { small: true, icon: 'moon', onclick: e => setQuiet(e.currentTarget, 60) }),
								button('2 hours', { small: true, onclick: e => setQuiet(e.currentTarget, 120) }),
								button('Until off', { small: true, onclick: e => setQuiet(e.currentTarget, -1) })
							])),

					card('SIP endpoints', { actions: [ button('Manage', { small: true, onclick: () => ctx.go('sip') }) ] },
						phones.length ? h('ul', { class: 'mini-list' }, phones.slice(0, 5).map(p => h('li',
							h('span', { class: 'dot-inline' + (p.online ? ' on' : '') }),
							h('div', { class: 'grow' }, h('div', { class: 'title' }, p.name), h('div', { class: 'sub' }, p.online ? 'Online' : 'Offline'))))) :
							empty(msip ? 'No SIP endpoints registered.' : 'Modem SIP not installed.', 'sip')))));
	};

	await load();
	draw();
	root.refresh = async () => { await load(); draw(); };
	document.addEventListener('phone-status', e => { if (e.detail.changed && document.body.contains(root)) draw(); });
	return root;
}
