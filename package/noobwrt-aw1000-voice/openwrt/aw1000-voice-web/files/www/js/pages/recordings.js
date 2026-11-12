// SPDX-License-Identifier: GPL-2.0-only
import * as api from '../api.js';
import { h, clear, card, pageHeader, button, iconButton, badge, busy, toast, confirm, fmtSize, empty, kv } from '../ui.js';
import { sectionForm, gridEditor, V } from '../forms.js';

function fileTime(name) {
	const m = name.match(/^(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})-(\d+)\.wav$/);
	return m ? { when: m[1] + '-' + m[2] + '-' + m[3] + ' ' + m[4] + ':' + m[5], number: m[7] } : { when: name, number: '' };
}

export default async function recordings(ctx) {
	const root = h('div');
	const filesCard = h('div');
	let st = {};

	const drawFiles = () => {
		const files = (st.files || []).slice().sort((a, b) => b.name.localeCompare(a.name));
		clear(filesCard,
			h('div', { class: 'grid grid-3', style: { marginBottom: '14px' } },
				kv([ [ 'Recording now', st.active ? badge('Yes', 'bad') : 'No' ] ]),
				kv([ [ 'Router space', st.flash_free_mb != null ? st.flash_free_mb + ' MB free' : '' ] ]),
				kv([ [ 'USB stick', st.usb_present ? (st.usb_free_mb + ' MB free') : 'Not plugged in' ] ])),
			st.full ? h('div', { class: 'alert alert-warn' }, 'The recording space is full. Old recordings are removed unless you keep them.') : null,
			files.length ? h('div', { class: 'table-wrap' }, h('table', { class: 'table' },
				h('thead', h('tr', h('th', 'When'), h('th', 'Number'), h('th', 'Size'), h('th', 'Where'), h('th', 'Keep'), h('th', { class: 'col-actions' }, ''))),
				h('tbody', files.map(f => {
					const t = fileTime(f.name);
					const player = h('div');
					return [
						h('tr',
							h('td', { 'data-label': 'When' }, t.when),
							h('td', { 'data-label': 'Number' }, t.number),
							h('td', { 'data-label': 'Size' }, fmtSize(f.size)),
							h('td', { 'data-label': 'Where' }, f.usb ? badge('USB', 'info') : badge('Router')),
							h('td', { 'data-label': 'Keep' }, h('label', { class: 'switch switch-sm' },
								h('input', { type: 'checkbox', checked: !!f.keep, onchange: async e => {
									await busy(e.target, () => api.call('fxs', 'rec_keep', { name: f.name, keep: e.target.checked }), e.target.checked ? 'Kept' : 'No longer kept');
								} }), h('span', { class: 'slider' }))),
							h('td', { class: 'col-actions' },
								iconButton('play', 'Play', async e => {
									await busy(e.currentTarget, async () => {
										const url = URL.createObjectURL(await api.download(f.path, f.name));
										clear(player, h('audio', { controls: true, autoplay: true, src: url, style: { width: '100%' } }),
											h('a', { class: 'btn btn-sm', href: url, download: f.name }, 'Save file'));
									});
								}),
								iconButton('trash', 'Delete', async () => {
									if (!await confirm('Delete recording', 'Delete ' + f.name + '?')) return;
									await api.call('fxs', 'rec_delete', { name: f.name });
									toast('Deleted');
									await load();
								}, 'danger'))),
						h('tr', { class: 'player-row' }, h('td', { colspan: 6, style: { padding: player.childNodes.length ? '0 10px 10px' : '0', border: 0 } }, player))
					];
				})))) : empty('No recordings yet.', 'rec'));
	};

	const load = async () => {
		st = await api.maybe('fxs', 'rec_status', {}, {});
		drawFiles();
	};

	const fxs = await api.uci.get('fxs');
	const main = fxs.main || {};

	clear(root,
		pageHeader('Recordings', 'Calls recorded by the phone port. Recording a call may need an announcement where you live.',
			button('Refresh', { icon: 'refresh', onclick: e => busy(e.currentTarget, load) })),
		h('div', { class: 'stack' },
			card('Recorded calls', filesCard),
			card('Recording settings', sectionForm({
				config: 'fxs', section: 'main', values: main, onsaved: () => ctx.refresh(),
				fields: [
					{ name: 'rec_mode', label: 'Record', type: 'select', default: 'off', options: [
						[ 'off', 'Off' ], [ 'every', 'All calls' ], [ 'all', 'All calls except Never record' ], [ 'chosen', 'Only chosen numbers (Always record)' ] ] },
					{ name: 'rec_format', label: 'Sound', type: 'select', default: 'stereo', options: [
						[ 'stereo', 'Each side separate, about 2 MB a minute' ], [ 'mono', 'Both sides mixed, about 1 MB a minute' ] ] },
					{ name: 'rec_flash_mb', label: 'Space on the router (MB)', type: 'number', min: 1, max: 1000, placeholder: '50' },
					{ name: 'rec_usb_mb', label: 'Space on a USB stick (MB)', type: 'number', min: 10, max: 1000000, placeholder: '1000',
						help: 'Recordings go to a USB stick when one is plugged in, otherwise to the router.' }
				]
			})),
			card('Always and never lists', h('p', { class: 'muted' }, 'Numbers that are always or never recorded, used by the Record setting above.'),
				gridEditor({
					config: 'fxs', type: 'recnum', title: 'Number', emptyText: 'No numbers on the lists.',
					defaults: { enabled: '1', rule: 'always' },
					fields: [
						{ name: 'enabled', label: 'On', type: 'toggle', default: '1' },
						{ name: 'name', label: 'Name', type: 'text' },
						{ name: 'number', label: 'Number', type: 'text', validate: V.phoneRequired, placeholder: '0771234567' },
						{ name: 'rule', label: 'List', type: 'select', options: [ [ 'always', 'Always record' ], [ 'never', 'Never record' ] ] }
					],
					columns: [
						{ label: 'Name', render: s => s.name || '—' },
						{ label: 'Number', render: s => s.number },
						{ label: 'List', render: s => s.rule === 'never' ? badge('Never') : badge('Always', 'accent') }
					]
				}))));

	await load();
	return root;
}
