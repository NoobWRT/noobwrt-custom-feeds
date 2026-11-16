// SPDX-License-Identifier: GPL-2.0-only
import * as api from '../api.js';
import { h, clear, icon, card, pageHeader, button, badge, busy, fmtTime } from '../ui.js';
import { gridEditor, sectionForm, daysText, V } from '../forms.js';

const WHO = [
	[ 'repeat', 'Important contacts, the Always ring list and repeat callers' ],
	[ 'allowed', 'Important contacts and the Always ring list' ],
	[ 'all', 'Important contacts only' ]
];
const ACT = [ [ 'silent', 'Stay silent' ], [ 'once', 'One short ring' ], [ 'busy', 'Caller hears busy' ] ];
const label = (list, v) => (list.find(x => x[0] === v) || [ v, v || '—' ])[1];

export default async function quiet(ctx) {
	const fxs = await api.uci.get('fxs');
	const main = fxs.main || {};
	const now = h('div');
	let qs = await api.maybe('fxs', 'quiet_status', {}, {});

	const set = async (btn, minutes) => {
		await busy(btn, () => api.call('fxs', 'quiet_set', { minutes }), minutes ? 'Quiet is on' : 'Quiet is off');
		qs = await api.maybe('fxs', 'quiet_status', {}, {});
		await ctx.refresh();
		drawNow();
	};
	const drawNow = () => {
		const quietOn = qs.on || qs.scheduled;
		clear(now,
			h('div', { class: 'hero hero-' + (quietOn ? 'ring' : 'ok') },
				h('div', { class: 'hero-icon' }, icon('moon')),
				h('div', { class: 'hero-text' },
					h('strong', qs.on ? 'Quiet active (manual)' : qs.scheduled ? 'Scheduled quiet active' : 'Normal mode'),
					h('span', { class: 'muted small' },
						qs.on && qs.until > 0 ? 'Quiet is active until ' + fmtTime(qs.until) + '.' :
						qs.on ? 'Quiet is active until turned off.' :
						qs.scheduled ? 'A scheduled quiet window is currently active.' :
						'Phone rings as normal.')),
				qs.quiet_calls ? badge(qs.quiet_calls + ' call(s) silenced', 'warn') : null),

			h('div', { class: 'quick', style: { marginTop: '14px' } },
				qs.on ? button('Turn quiet off', { kind: 'primary', onclick: e => set(e.currentTarget, 0) }) : [
					button('1 hour', { icon: 'moon', onclick: e => set(e.currentTarget, 60) }),
					button('2 hours', { onclick: e => set(e.currentTarget, 120) }),
					button('8 hours', { onclick: e => set(e.currentTarget, 480) }),
					button('Until turned off', { onclick: e => set(e.currentTarget, -1) })
				],
				qs.quiet_calls ? button('Mark silenced calls as seen', { onclick: async e => {
					await busy(e.currentTarget, () => api.call('fxs', 'quiet_seen', {}));
					qs = await api.maybe('fxs', 'quiet_status', {}, {});
					drawNow();
				} }) : null));
	};
	drawNow();

	const who = { name: 'mode', label: 'Who can ring', type: 'select', options: WHO };
	const act = { name: 'action', label: 'Other calls', type: 'select', options: ACT };

	return h('div',
		pageHeader('Do not disturb', 'The RJ11 phone does not ring during these windows. Calls still show in the history with the reason. Emergency numbers always ring.'),
		h('div', { class: 'stack' },
			card('Quiet now', now),
			card('Rules', sectionForm({
				config: 'fxs', section: 'main', values: main,
				fields: [
					{ name: 'dnd_allow', label: 'Always ring for', type: 'list', placeholder: '0771234567', validateItem: V.phone,
						help: 'These numbers ring when a window allows them, and when you turn do not disturb on from the phone.' },
					{ name: 'dnd_repeat', label: 'Repeat call within (minutes)', type: 'number', min: 0, max: 60, placeholder: '3',
						help: 'The same number calling again within this time rings. 0 turns it off.' },
					{ name: 'code_dnd_on', label: 'On code', type: 'text', placeholder: '*78', validate: V.starCode,
						help: 'Dial this on the phone to turn do not disturb on until you turn it off.' },
					{ name: 'code_dnd_off', label: 'Off code', type: 'text', placeholder: '*79', validate: V.starCode,
						help: 'Dial this on the phone to go back to the windows below.' }
				]
			})),
			card('Weekly windows', gridEditor({
				config: 'fxs', type: 'quiet', title: 'Window', addLabel: 'Add window', max: 32,
				emptyText: 'No quiet windows.',
				defaults: { enabled: '1', days: [ 'mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun' ], from: '22:00', to: '07:00', mode: 'repeat', action: 'silent' },
				fields: [
					{ name: 'enabled', label: 'On', type: 'toggle', default: '1' },
					{ name: 'name', label: 'Name', type: 'text', placeholder: 'Night' },
					{ name: 'days', label: 'Days', type: 'days', validate: v => (v && v.length) || 'Pick at least one day' },
					{ name: 'from', label: 'From', type: 'time', validate: V.time, help: 'Use the same time in both for the whole day.' },
					{ name: 'to', label: 'Until', type: 'time', validate: V.time },
					who, act
				],
				columns: [
					{ label: 'Name', render: s => s.name || '—' },
					{ label: 'Days', render: s => daysText(s.days) },
					{ label: 'Time', render: s => (s.from || '?') + ' – ' + (s.to || '?') },
					{ label: 'Rings', render: s => label(WHO, s.mode || 'repeat').split(',')[0] },
					{ label: 'Others', render: s => label(ACT, s.action || 'silent') }
				]
			})),
			card('Holidays', h('p', { class: 'muted' }, 'A holiday replaces the weekly windows for those days. Leave both times empty or 00:00 for the whole day.'),
				gridEditor({
					config: 'fxs', type: 'holiday', title: 'Holiday', addLabel: 'Add holiday', max: 32,
					emptyText: 'No holidays.',
					defaults: { enabled: '1', mode: 'allowed', action: 'silent' },
					fields: [
						{ name: 'enabled', label: 'On', type: 'toggle', default: '1' },
						{ name: 'name', label: 'Name', type: 'text', placeholder: 'New Year' },
						{ name: 'from_date', label: 'First day', type: 'date', validate: V.date },
						{ name: 'to_date', label: 'Last day', type: 'date', validate: V.optDate },
						{ name: 'from', label: 'From', type: 'time', validate: V.optTime },
						{ name: 'to', label: 'Until', type: 'time', validate: V.optTime },
						who, act
					],
					columns: [
						{ label: 'Name', render: s => s.name || '—' },
						{ label: 'Dates', render: s => s.from_date + (s.to_date && s.to_date !== s.from_date ? ' – ' + s.to_date : '') },
						{ label: 'Time', render: s => s.from || s.to ? (s.from || '00:00') + ' – ' + (s.to || '00:00') : 'All day' },
						{ label: 'Status', render: s => {
							const last = (s.to_date || s.from_date || '').replace(/-/g, '');
							const d = new Date(), today = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
							return last && +last < today ? badge('Over') : badge('Upcoming', 'accent');
						} }
					]
				}))));
}
