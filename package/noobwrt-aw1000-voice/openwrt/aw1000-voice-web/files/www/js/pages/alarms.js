// SPDX-License-Identifier: GPL-2.0-only
import { h, card, pageHeader } from '../ui.js';
import { gridEditor, daysText, V } from '../forms.js';

export default async function alarms(ctx) {
	const s = ctx.status || {};

	return h('div',
		pageHeader('Alarm calls', 'The phone rings at the set time, like a wake-up call. Lift the handset to stop it.'),
		s.clock_ok === false ? h('div', { class: 'alert alert-warn' }, 'The router clock is not set yet, so alarms wait until it is.') : null,
		card('Alarms', gridEditor({
			config: 'fxs', type: 'alarm', title: 'Alarm', addLabel: 'Add alarm',
			emptyText: 'No alarms.',
			defaults: { enabled: '1', time: '07:00', days: [ 'mon', 'tue', 'wed', 'thu', 'fri' ], seconds: '60' },
			fields: [
				{ name: 'enabled', label: 'On', type: 'toggle', default: '1' },
				{ name: 'name', label: 'Name', type: 'text', placeholder: 'Wake up' },
				{ name: 'time', label: 'Time', type: 'time', validate: V.time },
				{ name: 'days', label: 'Days', type: 'days', help: 'No days means it rings once, on the next time it comes up.' },
				{ name: 'seconds', label: 'Ring for (seconds)', type: 'number', min: 10, max: 120, placeholder: '60' }
			],
			columns: [
				{ label: 'Time', render: s => h('strong', s.time || '—') },
				{ label: 'Name', render: s => s.name || '—' },
				{ label: 'Days', render: s => s.days && s.days.length ? daysText(s.days) : 'Once' },
				{ label: 'Rings', render: s => (s.seconds || 60) + ' s' }
			]
		})));
}
