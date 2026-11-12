// SPDX-License-Identifier: GPL-2.0-only
import * as api from '../api.js';
import { h, card, pageHeader, badge } from '../ui.js';
import { gridEditor, sectionForm, V } from '../forms.js';

export default async function blocking(ctx) {
	const fxs = await api.uci.get('fxs');
	const main = fxs.main || {};

	return h('div',
		pageHeader('Blocking', 'Calls from blocked numbers never ring and show as Blocked in the history. Outgoing rules limit what the phone may dial.'),
		h('div', { class: 'stack' },
			card('Incoming', sectionForm({
				config: 'fxs', section: 'main', values: main,
				fields: [ { name: 'block_private', label: 'Block hidden numbers', type: 'toggle', default: '0',
					help: 'Calls without caller ID do not ring.' } ]
			})),
			card('Blocked numbers', gridEditor({
				config: 'fxs', type: 'block', title: 'Blocked number', addLabel: 'Block a number', toggle: null,
				emptyText: 'No blocked numbers.',
				fields: [
					{ name: 'name', label: 'Name', type: 'text' },
					{ name: 'number', label: 'Number', type: 'text', validate: V.prefix, placeholder: '0771234567',
						help: 'A full number, or the start of one to block a whole range.' }
				],
				columns: [
					{ label: 'Name', render: s => s.name || '—' },
					{ label: 'Number', render: s => h('span', { class: 'mono' }, s.number) }
				]
			})),
			card('Outgoing calls', sectionForm({
				config: 'fxs', section: 'main', values: main,
				fields: [ { name: 'out_mode', label: 'Rule', type: 'select', default: 'off', options: [
					[ 'off', 'Off, any number can be dialed' ],
					[ 'block', 'Block the numbers below' ],
					[ 'allow', 'Only allow the numbers below' ] ],
					help: 'Emergency numbers can always be dialed.' } ]
			}), h('div', { style: { marginTop: '14px' } }, gridEditor({
				config: 'fxs', type: 'outgoing', title: 'Rule', addLabel: 'Add number', toggle: null,
				emptyText: 'No numbers on the outgoing list.',
				fields: [
					{ name: 'name', label: 'Name', type: 'text', placeholder: 'International' },
					{ name: 'prefix', label: 'Number or prefix', type: 'text', validate: V.prefix, placeholder: '00' }
				],
				columns: [
					{ label: 'Name', render: s => s.name || '—' },
					{ label: 'Number or prefix', render: s => h('span', { class: 'mono' }, s.prefix) },
					{ label: 'Applies', render: () => main.out_mode === 'allow' ? badge('Allowed', 'ok') : main.out_mode === 'block' ? badge('Blocked', 'bad') : badge('Rule off') }
				]
			})))));
}
