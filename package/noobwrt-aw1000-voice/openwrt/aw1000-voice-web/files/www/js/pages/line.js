// SPDX-License-Identifier: GPL-2.0-only
// Line health: what fxsd reports about the SLIC, the modem audio and itself.
import * as api from '../api.js';
import { h, clear, card, pageHeader, button, badge, busy, toast, kv } from '../ui.js';

const v = (mv, unit = 'V') => mv == null ? '' : (mv / 1000).toFixed(1) + ' ' + unit;

function check(ok, good, bad) {
	return ok ? badge(good, 'ok') : badge(bad, 'bad');
}

export default async function line(ctx) {
	const root = h('div');
	const logBox = h('pre', { class: 'log mono' }, 'Loading…');

	const loadLog = async () => {
		const r = await api.maybe('aw1000-voice', 'log', {}, { lines: [] });
		logBox.textContent = (r.lines || []).join('\n') || 'Nothing logged yet.';
		logBox.scrollTop = logBox.scrollHeight;
	};

	const draw = () => {
		const s = ctx.status || {};
		const loop = s.iloop != null ? (s.iloop / 1000).toFixed(1) + ' mA' : '';

		clear(root,
			pageHeader('Line health', 'Readings from the phone chip and the modem, and the tests that help when a phone does not ring or a call has no sound.',
				button('Refresh', { icon: 'refresh', onclick: async e => { await busy(e.currentTarget, async () => { await ctx.refresh(); await loadLog(); }); draw(); } })),
			s.modemmute ? h('div', { class: 'alert alert-warn' },
				h('p', 'The last call connected but got no sound from the modem, so neither side could hear the other. Check on the modem:'),
				h('pre', { class: 'mono' }, 'AT+QAUDCFG="pcmidx"   should be 1\nAT+QDAI?              should be x,1,...\nAT+QPCMV?             should be 0'),
				h('p', 'Restarting the phone service sets these again. On a board wired differently, the PCM slots can be set with modem_slots and qdai_slot in /etc/config/fxs.')) : null,
			h('div', { class: 'grid grid-2' },
				card('Checks', kv([
					[ 'Phone service', check(s.running, 'Running', 'Not running') ],
					[ 'Phone driver', check(s.module, 'Loaded', 'Not loaded') ],
					[ 'SLIC patch', check(s.patch, 'Present', 'Missing') ],
					[ 'Router clock', check(s.clock_ok, 'Set', 'Not set yet') ],
					[ 'Modem audio', s.modemmute ? badge('No sound on the last call', 'bad') : badge('OK', 'ok') ],
					[ 'Phone port', s.enabled === false ? badge('Off') : badge('On', 'ok') ],
					// The guard file exists while fxsd runs; it only means trouble when fxsd is down.
					[ 'Start guard', s.guard && !s.running ? badge('Stopped after a failed start', 'warn') : badge('Clear', 'ok') ]
				])),
				card('Line', kv([
					[ 'State', s.state || '' ],
					[ 'Handset', s.offhook ? 'Off hook' : 'On hook' ],
					[ 'Battery', v(s.vbat) ],
					[ 'Line voltage', v(s.vline) ],
					[ 'Loop current', loop ],
					[ 'HD calling', s.hd ? 'On' : 'Off' ],
					[ 'SIP calling', s.sipon ? (s.siptitle || 'On') : 'Off' ]
				]),
					h('p', { class: 'muted small', style: { marginTop: '10px' } },
						'On hook the line sits near 48 V with almost no current. Off hook the voltage drops and the current rises to about 20 mA. A short or a missing phone shows otherwise.'))),
			h('div', { style: { marginTop: '18px' } }, card('Tests',
				h('div', { class: 'row-actions' },
					button('Ring for 5 seconds', { icon: 'ring', disabled: s.state !== 'idle', onclick: e => busy(e.currentTarget, () => api.call('fxs', 'ring', { seconds: 5 }), 'Ringing') }),
					button('Ring test (no caller ID)', { disabled: !s.running, onclick: async e => {
						const r = await busy(e.currentTarget, () => api.call('fxs', 'ring_test', {}));
						r.result ? toast('Test ring sent') : toast('The phone service did not take it', 'error');
					} }),
					button('Restart phone service', { icon: 'refresh', onclick: async e => {
						await busy(e.currentTarget, () => api.call('aw1000-voice', 'restart', { name: 'fxsd' }), 'Phone service restarted');
						setTimeout(async () => { await ctx.refresh(); draw(); }, 4000);
					} }),
					ctx.info.msipd_installed ? button('Restart SIP server', { onclick: e => busy(e.currentTarget, () => api.call('aw1000-voice', 'restart', { name: 'msipd' }), 'SIP server restarted') }) : null,
					s.guard && !s.running ? button('Clear start guard', { onclick: async e => {
						await busy(e.currentTarget, () => api.call('fxs', 'clear_guard', {}), 'Restarting the phone service');
						setTimeout(async () => { await ctx.refresh(); draw(); }, 4000);
					} }) : null))),
			h('div', { style: { marginTop: '18px' } }, card('Phone log', { actions: [ button('Reload', { small: true, icon: 'refresh', onclick: e => busy(e.currentTarget, loadLog) }) ] }, logBox)));
	};

	draw();
	loadLog();
	document.addEventListener('phone-status', e => { if (e.detail.changed && document.body.contains(root)) draw(); });
	return root;
}
