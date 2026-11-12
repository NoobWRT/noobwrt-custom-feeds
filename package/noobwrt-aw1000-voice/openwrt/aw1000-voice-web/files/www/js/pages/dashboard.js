// SPDX-License-Identifier: GPL-2.0-only
import * as api from '../api.js';
import { h, clear, icon, card, pageHeader, button, stat, kv, badge, busy, toast, fmtTime, fmtAgo, fmtDuration, empty } from '../ui.js';
import { statusOf, isMissed, duration, nameBook } from '../calllog.js';
import { STATE_TEXT } from '../app.js';

export default async function dashboard(ctx) {
	const root = h('div');
	const [ fxs, quiet, sip ] = await Promise.all([
		api.uci.get('fxs').catch(() => ({})),
		api.maybe('fxs', 'quiet_status', {}, {}),
		api.maybe('fxs', 'sip_services', {}, {})
	]);
	const nameOf = nameBook(fxs);

	const draw = () => {
		const s = ctx.status || {}, info = ctx.info || {};
		const calls = ctx.calls || [];
		const today = new Date(); today.setHours(0, 0, 0, 0);
		const t0 = today.getTime() / 1000;
		const todays = calls.filter(c => c.start >= t0);
		const missed = calls.filter(isMissed);
		const recent = calls.slice(0, 8);

		let tone = 'ok', title = STATE_TEXT[s.state] || 'Unknown', sub = 'The phone line is ready.';
		if (s.enabled === false) { tone = 'bad'; title = 'Phone port is off'; sub = 'Turn it on to use the RJ11 phone.'; }
		else if (!s.running) { tone = 'bad'; title = 'Phone service is not running'; sub = s.guard ? 'It stopped after a failed start. Clear the start guard to try again.' : 'Check the problems below.'; }
		else if (s.state === 'ringing') { tone = 'ring'; sub = 'Incoming call' + (s.peer ? ' from ' + (nameOf(s.peer) || s.peer) : ''); }
		else if (s.state === 'talking') { tone = ''; sub = 'With ' + (nameOf(s.peer) || s.peer || 'unknown') + (s.duration ? ' · ' + fmtDuration(s.duration) : ''); }
		else if (s.state && s.state !== 'idle') { tone = ''; sub = 'The handset is off the hook.'; }

		const problems = [];
		if (s.running === false && s.enabled !== false) problems.push('fxsd is not running.');
		if (s.module === false) problems.push('The phone driver (aw1000_fxs) is not loaded.');
		if (s.patch === false) problems.push('The SLIC patch file is missing.');
		if (s.clock_ok === false) problems.push('The router clock is not set yet, so do not disturb and alarms wait.');
		if (s.running && s.modemmute) problems.push('The last call had no sound from the modem. See Line health.');

		const enableBtn = button(s.enabled === false ? 'Turn on' : 'Turn off', {
			kind: s.enabled === false ? 'primary' : '', small: true,
			onclick: async e => {
				await busy(e.currentTarget, () => api.call('fxs', 'set_enabled', { enabled: s.enabled === false }), 'Phone port ' + (s.enabled === false ? 'on' : 'off'));
				await ctx.refresh(); draw();
			}
		});

		const quietOn = quiet.on || s.dnd || s.silent;
		const setQuiet = async (btn, minutes) => {
			await busy(btn, () => api.call('fxs', 'quiet_set', { minutes }), minutes ? 'Quiet is on' : 'Quiet is off');
			Object.assign(quiet, await api.maybe('fxs', 'quiet_status', {}, {}));
			await ctx.refresh(); draw();
		};

		clear(root,
			pageHeader('Dashboard', info.hostname ? 'Phone port on ' + info.hostname : null,
				button('Refresh', { icon: 'refresh', onclick: async e => { await busy(e.currentTarget, () => ctx.refresh()); draw(); } })),

			h('div', { class: 'stats' },
				stat('Missed, not seen', ctx.missed, ctx.missed ? 'bad' : '', () => ctx.go('calls')),
				stat('Calls today', todays.length, 'accent', () => ctx.go('calls')),
				stat('Missed in history', missed.length, '', () => ctx.go('calls')),
				stat('SIP phones', sip.enabled ? (sip.connected ? 'Online' : 'On') : 'Off', sip.connected ? 'ok' : '', () => ctx.go('sip'))),

			h('div', { class: 'grid grid-2' },
				card('Line', { actions: [ enableBtn ] },
					h('div', { class: 'hero hero-' + tone },
						h('div', { class: 'hero-icon' }, icon(s.state === 'ringing' ? 'ring' : 'calls')),
						h('div', { class: 'hero-text' }, h('strong', title), h('span', { class: 'muted' }, sub))),
					problems.length ? h('div', { class: 'alert alert-warn', style: { marginTop: '14px' } }, problems.map(p => h('div', p)),
						h('a', { href: '#/line' }, 'Open line health')) : null,
					s.guard && !s.running ? h('div', { class: 'form-actions' }, button('Clear start guard', { onclick: async e => {
						await busy(e.currentTarget, () => api.call('fxs', 'clear_guard', {}), 'Restarting the phone service');
						await ctx.refresh(); draw();
					} })) : null,
					h('div', { style: { marginTop: '14px' } }, kv([
						[ 'My number', s.own || '' ],
						[ 'HD calling', s.hd ? badge('On', 'ok') : badge('Off') ],
						[ 'Recording', s.recmode && s.recmode !== 'off' ? badge(s.recactive ? 'Recording now' :
							({ every: 'All calls', all: 'All but the never list', chosen: 'Chosen numbers' })[s.recmode] || s.recmode, s.recactive ? 'bad' : 'accent') : badge('Off') ],
						[ 'Line', s.vbat != null ? (s.vbat / 1000).toFixed(1) + ' V battery' + (s.iloop != null ? ', ' + (s.iloop / 1000).toFixed(1) + ' mA loop' : '') : '' ]
					])),
					h('div', { class: 'form-actions' },
						button('Ring the phone', { icon: 'ring', small: true, disabled: s.state !== 'idle', onclick: e => busy(e.currentTarget, () => api.call('fxs', 'ring', { seconds: 8 }), 'Ringing for 8 seconds') }))),

				card('Do not disturb',
					h('div', { class: 'hero hero-' + (quietOn ? 'ring' : 'ok') },
						h('div', { class: 'hero-icon' }, icon('moon')),
						h('div', { class: 'hero-text' },
							h('strong', quiet.on ? 'Quiet is on' : s.dnd ? 'A quiet window is active' : 'Off'),
							h('span', { class: 'muted' }, quiet.on && quiet.until > 0 ? 'Until ' + fmtTime(quiet.until) : quiet.on ? 'Until you turn it off' :
								quiet.quiet_calls ? quiet.quiet_calls + ' call(s) were silenced' : 'The phone rings as normal.'))),
					h('div', { class: 'form-actions' },
						quiet.on ? button('Turn quiet off', { kind: 'primary', small: true, onclick: e => setQuiet(e.currentTarget, 0) }) : [
							button('Quiet 1 hour', { small: true, onclick: e => setQuiet(e.currentTarget, 60) }),
							button('Quiet 2 hours', { small: true, onclick: e => setQuiet(e.currentTarget, 120) }),
							button('Until I turn it off', { small: true, onclick: e => setQuiet(e.currentTarget, -1) })
						],
						button('Windows', { small: true, onclick: () => ctx.go('quiet') })))),

			h('div', { style: { marginTop: '18px' } },
				card('Recent calls', { actions: [
					ctx.missed ? button('Mark missed as seen', { small: true, icon: 'check', onclick: async e => { await busy(e.currentTarget, () => ctx.markSeen(), 'Marked as seen'); draw(); } }) : null,
					button('All calls', { small: true, onclick: () => ctx.go('calls') })
				] },
					recent.length ? h('ul', { class: 'calls' }, recent.map(c => {
						const bad = c.status === 'missed' || c.status === 'blocked' || c.status === 'failed';
						const name = nameOf(c.number);
						const d = duration(c);
						return h('li', { class: 'call' + (isMissed(c) && c.start > (info.missed_seen || 0) ? ' unseen' : ''), style: { gridTemplateColumns: '40px 1fr auto' } },
							h('div', { class: 'call-dir ' + (bad ? 'bad' : c.dir) }, icon(c.status === 'missed' ? 'missed' : c.status === 'blocked' ? 'block' : c.dir === 'in' ? 'in' : 'out')),
							h('div', { class: 'call-main' },
								h('div', { class: 'call-who' }, name || c.number || 'Unknown', name ? h('span', { class: 'num' }, c.number) : null),
								h('div', { class: 'call-meta' }, statusOf(c) + (d ? ' · ' + fmtDuration(d) : ''))),
							h('div', { class: 'call-side' }, h('span', { class: 'muted small', title: fmtTime(c.start) }, fmtAgo(c.start))));
					})) : empty('No calls yet.'))),

			h('div', { class: 'grid grid-2', style: { marginTop: '18px' } },
				card('Management interface', kv([
					[ 'Address', info.lan ? 'http://' + info.lan + ':' + info.port + '/' : '' ],
					[ 'Port', info.port ],
					[ 'SIP service', sip.enabled ? (sip.current || '') : 'Off' ]
				])),
				card('Versions', kv([
					[ 'Web interface', info.versions?.web ],
					[ 'Phone service (fxsd)', info.versions?.fxsd ],
					[ 'Phone driver', info.versions?.driver ],
					[ 'SIP server (msipd)', info.versions?.msipd || (info.msipd_installed ? '' : 'not installed') ]
				]))));
	};

	draw();
	const onStatus = e => { if (e.detail.changed && document.body.contains(root)) draw(); };
	document.addEventListener('phone-status', onStatus);
	return root;
}
