// SPDX-License-Identifier: GPL-2.0-only
// Dashboard: everything that needs attention on one compact screen.
import * as api from '../api.js';
import { h, clear, icon, card, pageHeader, button, stat, kv, badge, busy, fmtTime, fmtAgo, fmtDuration, empty } from '../ui.js';
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

		// ---- line state -------------------------------------------------
		let tone = 'ok', title = STATE_TEXT[s.state] || 'Unknown', sub = 'Ready for calls.';
		if (s.enabled === false) { tone = 'bad'; title = 'Phone port off'; sub = 'The RJ11 phone does not ring. SIP phones still work.'; }
		else if (!s.running) { tone = 'bad'; title = 'Not running'; sub = 'See Line health.'; }
		else if (s.state === 'ringing') { tone = 'ring'; sub = 'From ' + (nameOf(s.peer) || s.peer || 'unknown'); }
		else if (s.state === 'talking') { tone = ''; sub = 'With ' + (nameOf(s.peer) || s.peer || 'unknown') + (s.duration ? ' · ' + fmtDuration(s.duration) : ''); }
		else if (s.state && s.state !== 'idle') { tone = ''; sub = 'The handset is off the hook.'; }

		const problems = [];
		if (s.running === false && s.enabled !== false) problems.push('fxsd is not running.');
		if (s.module === false) problems.push('The phone driver is not loaded.');
		if (s.patch === false) problems.push('The SLIC patch file is missing.');
		if (s.clock_ok === false) problems.push('The router clock is not set yet.');
		if (s.running && s.modemmute) problems.push('The last call had no sound from the modem.');

		const quietOn = quiet.on || s.dnd || s.silent;
		const setQuiet = async (btn, minutes) => {
			await busy(btn, () => api.call('fxs', 'quiet_set', { minutes }), minutes ? 'Quiet is on' : 'Quiet is off');
			quiet = await api.maybe('fxs', 'quiet_status', {}, {});
			await ctx.refresh();
			draw();
		};

		// ---- recent calls and messages ----------------------------------
		const recentCalls = calls.slice(0, 6);
		const threads = new Map();
		for (const m of (sms.messages || []).slice().sort((a, b) => b.time - a.time)) {
			const k = /[0-9]{5,}/.test(m.number) ? digits(m.number) : m.number;
			if (!threads.has(k)) threads.set(k, { last: m, unread: 0, name: m.name || nameOf(m.number) });
			if (m.unread) threads.get(k).unread++;
		}
		const recentSms = [ ...threads.values() ].slice(0, 6);

		clear(root,
			pageHeader('Dashboard', (info.hostname || 'Router') + ' · ' + new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' }),
				ctx.missed ? button('Mark missed seen', { small: true, icon: 'check', onclick: async e => { await busy(e.currentTarget, () => ctx.markSeen(), 'Marked as seen'); draw(); } }) : null,
				button('Refresh', { small: true, icon: 'refresh', onclick: async e => { await busy(e.currentTarget, async () => { await load(); await ctx.refresh(); }); draw(); } })),

			h('div', { class: 'stats' },
				stat('Missed calls', ctx.missed, ctx.missed ? 'bad' : '', () => ctx.go('calls'), 'missed', ctx.missed ? 'not seen yet' : 'nothing new'),
				stat('Calls today', todays.length, 'accent', () => ctx.go('calls'), 'calls',
					todays.length ? todays.filter(c => c.dir === 'in').length + ' in · ' + todays.filter(c => c.dir === 'out').length + ' out' : 'quiet day'),
				stat('Messages', ctx.smsUnread, ctx.smsUnread ? 'info' : '', () => ctx.go('messages'), 'sms', ctx.smsUnread ? 'unread SMS' : (sms.messages || []).length + ' on the SIM'),
				stat('SIP phones', online + '/' + phones.length, online ? 'ok' : '', () => ctx.go('sip'), 'sip',
					sip.enabled ? (sip.connected ? 'service connected' : 'service on') : 'service off'),
				stat('Phone line', title, tone === 'bad' ? 'bad' : tone === 'ring' ? 'warn' : 'ok', () => ctx.go('line'), 'pulse',
					s.vbat != null ? (s.vbat / 1000).toFixed(1) + ' V · HD ' + (s.hd ? 'on' : 'off') : '')),

			problems.length ? h('div', { class: 'alert alert-warn' }, problems.join(' '), ' ', h('a', { href: '#/line' }, 'Open line health')) : null,

			h('div', { class: 'grid grid-3' },
				card('Line', { actions: [ button(s.enabled === false ? 'Turn on' : 'Turn off', {
					small: true, kind: s.enabled === false ? 'primary' : '',
					onclick: async e => {
						await busy(e.currentTarget, () => api.call('fxs', 'set_enabled', { enabled: s.enabled === false }), 'Phone port ' + (s.enabled === false ? 'on' : 'off'));
						await ctx.refresh(); draw();
					}
				}) ] },
					h('div', { class: 'hero hero-' + tone },
						h('div', { class: 'hero-icon' }, icon(s.state === 'ringing' ? 'ring' : 'calls')),
						h('div', { class: 'hero-text' }, h('strong', title), h('span', { class: 'muted small' }, sub))),
					h('div', { style: { marginTop: '12px' } }, kv([
						[ 'My number', s.own || '' ],
						[ 'HD calling', s.hd ? badge('On', 'ok') : badge('Off') ],
						[ 'Recording', s.recmode && s.recmode !== 'off' ? badge(s.recactive ? 'Recording now' : REC[s.recmode] || s.recmode, s.recactive ? 'bad' : 'accent') : badge('Off') ]
					])),
					s.guard && !s.running ? h('div', { class: 'form-actions' }, button('Clear start guard', { small: true, onclick: async e => {
						await busy(e.currentTarget, () => api.call('fxs', 'clear_guard', {}), 'Restarting the phone service');
						await ctx.refresh(); draw();
					} })) : null),

				card('Do not disturb', { actions: [ button('Windows', { small: true, onclick: () => ctx.go('quiet') }) ] },
					h('div', { class: 'hero hero-' + (quietOn ? 'ring' : 'ok') },
						h('div', { class: 'hero-icon' }, icon('moon')),
						h('div', { class: 'hero-text' },
							h('strong', quiet.on ? 'Quiet' : s.dnd ? 'Quiet window' : 'Off'),
							h('span', { class: 'muted small' }, quiet.on && quiet.until > 0 ? 'Until ' + fmtTime(quiet.until) : quiet.on ? 'Until you turn it off' :
								quiet.quiet_calls ? quiet.quiet_calls + ' call(s) silenced' : 'The phone rings as normal.'))),
					h('div', { class: 'quick', style: { marginTop: '12px' } },
						quiet.on ? button('Turn quiet off', { kind: 'primary', small: true, onclick: e => setQuiet(e.currentTarget, 0) }) : [
							button('1 hour', { small: true, icon: 'moon', onclick: e => setQuiet(e.currentTarget, 60) }),
							button('2 hours', { small: true, onclick: e => setQuiet(e.currentTarget, 120) }),
							button('Until off', { small: true, onclick: e => setQuiet(e.currentTarget, -1) })
						])),

				card('SIP phones', { actions: [ button('Manage', { small: true, onclick: () => ctx.go('sip') }) ] },
					phones.length ? h('ul', { class: 'mini-list' }, phones.slice(0, 5).map(p => h('li',
						h('span', { class: 'dot-inline' + (p.online ? ' on' : '') }),
						h('div', { class: 'grow' }, h('div', { class: 'title' }, p.name), h('div', { class: 'sub' }, p.online ? 'Online' : 'Offline'))))) :
						empty(msip ? 'No SIP phones yet.' : 'Modem SIP is not installed.', 'sip'))),

			h('div', { class: 'grid grid-2', style: { marginTop: '14px' } },
				card('Recent calls', { actions: [ button('All calls', { small: true, onclick: () => ctx.go('calls') }) ] },
					recentCalls.length ? h('ul', { class: 'mini-list' }, recentCalls.map(c => {
						const bad = c.status === 'missed' || c.status === 'blocked' || c.status === 'failed';
						const name = nameOf(c.number), d = duration(c);
						return h('li', { class: isMissed(c) && c.start > seen ? 'unseen' : '' },
							h('div', { class: 'call-dir ' + (bad ? 'bad' : c.dir) }, icon(c.status === 'missed' ? 'missed' : c.status === 'blocked' ? 'block' : c.dir === 'in' ? 'in' : 'out')),
							h('div', { class: 'grow' },
								h('div', { class: 'title' }, name || c.number || 'Unknown'),
								h('div', { class: 'sub' }, statusOf(c) + (d ? ' · ' + fmtDuration(d) : ''))),
							h('span', { class: 'when', title: fmtTime(c.start) }, fmtAgo(c.start)));
					})) : empty('No calls yet.')),

				card('Recent messages', { actions: [ button('Messages', { small: true, onclick: () => ctx.go('messages') }) ] },
					recentSms.length ? h('ul', { class: 'mini-list' }, recentSms.map(t => h('li', { class: t.unread ? 'unseen' : '', style: { cursor: 'pointer' }, onclick: () => ctx.go('messages') },
						h('div', { class: 'avatar' }, (t.name || t.last.number || '?').replace(/^\+/, '').slice(0, 1).toUpperCase()),
						h('div', { class: 'grow' },
							h('div', { class: 'title' }, t.name || t.last.number, t.unread ? ' ' : '', t.unread ? badge(t.unread + ' new', 'info') : null),
							h('div', { class: 'sub' }, (t.last.direction === 'out' ? 'You: ' : '') + t.last.text)),
						h('span', { class: 'when' }, fmtAgo(t.last.time))))) :
						empty(sms.modem === false ? 'The modem is not available.' : 'No messages.', 'sms'))));
	};

	await load();
	draw();
	document.addEventListener('phone-status', e => { if (e.detail.changed && document.body.contains(root)) draw(); });
	return root;
}
