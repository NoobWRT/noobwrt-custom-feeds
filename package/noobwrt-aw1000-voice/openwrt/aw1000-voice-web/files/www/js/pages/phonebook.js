// SPDX-License-Identifier: GPL-2.0-only
import { h, card, pageHeader, badge } from '../ui.js';
import { gridEditor, V } from '../forms.js';

const RING = [ [ 'default', 'Default' ], [ 'standard', 'Standard' ], [ 'short', 'Short' ], [ 'double', 'Double' ] ];
const PRIORITY = [ [ 'normal', 'Normal' ], [ 'important', 'Important, rings through quiet' ], [ 'never', 'Never ring' ] ];

export default async function phonebook(ctx) {
	return h('div',
		pageHeader('Phonebook', 'Names shown in the call history and sent as caller ID name, with a ring and a do not disturb rule per contact.'),
		h('div', { class: 'stack' },
			card('Contacts', gridEditor({
				config: 'fxs', type: 'contact', title: 'Contact', addLabel: 'Add contact', toggle: null,
				emptyText: 'No contacts yet.',
				defaults: { ring: 'default', priority: 'normal' },
				fields: [
					{ name: 'name', label: 'Name', type: 'text', validate: V.required },
					{ name: 'number', label: 'Number', type: 'text', validate: V.phoneRequired, placeholder: '0771234567' },
					{ name: 'ring', label: 'Ring', type: 'select', options: RING },
					{ name: 'priority', label: 'Do not disturb', type: 'select', options: PRIORITY }
				],
				columns: [
					{ label: 'Name', render: s => h('strong', s.name || '—') },
					{ label: 'Number', render: s => s.number },
					{ label: 'Ring', render: s => (RING.find(r => r[0] === (s.ring || 'default')) || RING[0])[1] },
					{ label: 'Do not disturb', render: s => s.priority === 'important' ? badge('Important', 'accent') : s.priority === 'never' ? badge('Never rings', 'bad') : badge('Normal') }
				]
			})),
			card('Speed dial', h('p', { class: 'muted' }, 'Dial the code on the phone, like 1 then #, to call the number.'),
				gridEditor({
					config: 'fxs', type: 'speed', title: 'Speed dial', addLabel: 'Add speed dial', toggle: null,
					emptyText: 'No speed dials yet.',
					fields: [
						{ name: 'name', label: 'Name', type: 'text' },
						{ name: 'code', label: 'Code', type: 'text', placeholder: '1', help: 'Up to 3 digits.',
							validate: v => /^[0-9]{1,3}$/.test(v || '') || 'Enter 1 to 3 digits' },
						{ name: 'number', label: 'Number', type: 'text', validate: V.phoneRequired, placeholder: '0771234567' }
					],
					columns: [
						{ label: 'Code', render: s => h('span', { class: 'badge badge-accent mono' }, s.code) },
						{ label: 'Name', render: s => s.name || '—' },
						{ label: 'Number', render: s => s.number }
					]
				}))));
}
