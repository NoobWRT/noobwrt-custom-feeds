// SPDX-License-Identifier: GPL-2.0-only
import * as api from '../api.js';
import { h, clear, icon, card, pageHeader, button, iconButton, badge, busy, toast, confirm, modal, fmtTime, fmtDuration, empty, stat } from '../ui.js';
import { statusOf, reasonText, isMissed, duration, nameBook, digits } from '../calllog.js';
import { fieldset, V } from '../forms.js';

const PAGE = 40;

const csvCell = v => {
	const s = String(v ?? '');
	return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};

export default async function calls(ctx) {
	let [ fxs, rec ] = await Promise.all([
		api.uci.get('fxs').catch(() => ({})),
		api.maybe('fxs', 'rec_status', {}, {})
	]);
	await ctx.refresh();

	let nameOf = nameBook(fxs);
	const known = type => new Set(Object.values(fxs).filter(s => s['.type'] === type && s.number).map(s => digits(s.number)));
	let contacts = known('contact'), blocked = known('block');

	const reloadBook = async () => {
		fxs = await api.uci.get('fxs').catch(() => ({}));
		nameOf = nameBook(fxs);
		contacts = known('contact');
		blocked = known('block');
		drawList();
	};

	const addContact = number => {
		const fs = fieldset([
			{ name: 'name', label: 'Name', type: 'text', validate: V.required },
			{ name: 'number', label: 'Number', type: 'text', default: number, validate: V.phoneRequired },
			{ name: 'priority', label: 'Do not disturb', type: 'select', default: 'normal', options: [
				[ 'normal', 'Normal' ], [ 'important', 'Important, rings through quiet' ], [ 'never', 'Never ring' ] ] }
		]);
		modal({ title: 'Add to phonebook', body: fs.el, actions: [ { label: 'Cancel' }, { label: 'Add', kind: 'primary', onclick: async () => {
			if (!fs.validate()) return false;
			await api.uci.add('fxs', 'contact', { ...fs.values(), ring: 'default' });
			await api.uci.commit('fxs');
			toast('Added to the phonebook');
			await reloadBook();
		} } ] });
	};

	const blockNumber = async number => {
		if (!await confirm('Block number', 'Calls from ' + number + ' will not ring and show as Blocked.', 'Block')) return;
		await api.uci.add('fxs', 'block', { name: nameOf(number) || '', number });
		await api.uci.commit('fxs');
		toast('Blocked');
		await reloadBook();
	};

	const exportCsv = () => {
		const rows = [ [ 'start', 'direction', 'number', 'name', 'status', 'duration_s', 'via', 'reason', 'recording' ] ];
		for (const c of ctx.calls.filter(matches))
			rows.push([ new Date(c.start * 1000).toISOString(), c.dir, c.number, nameOf(c.number), statusOf(c), duration(c) ?? '', c.via || '', c.reason ? reasonText(c.reason, repeatMin) : '', c.rec || '' ]);
		const blob = new Blob([ '﻿' + rows.map(r => r.map(csvCell).join(',')).join('\r\n') ], { type: 'text/csv' });
		const a = h('a', { href: URL.createObjectURL(blob), download: 'calls-' + new Date().toISOString().slice(0, 10) + '.csv' });
		document.body.appendChild(a);
		a.click();
		a.remove();
	};

	const repeatMin = +(fxs.main?.dnd_repeat || 3);
	const recFiles = {};
	for (const f of rec.files || []) recFiles[f.name] = f;

	let filter = 'all', query = '', page = 0;
	const selected = new Set();
	const root = h('div');
	const list = h('div');
	const search = h('input', { type: 'search', placeholder: 'Search number or name', oninput: () => { query = search.value.trim().toLowerCase(); page = 0; drawList(); } });

	const matches = c => {
		if (filter === 'missed' && !isMissed(c)) return false;
		if (filter === 'in' && (c.dir !== 'in' || c.status === 'blocked')) return false;
		if (filter === 'out' && c.dir !== 'out') return false;
		if (filter === 'blocked' && c.status !== 'blocked') return false;
		if (filter === 'sip' && !c.via) return false;
		if (query) {
			const hay = ((c.number || '') + ' ' + nameOf(c.number) + ' ' + (c.via || '')).toLowerCase();
			if (!hay.includes(query)) return false;
		}
		return true;
	};

	const playRec = async (btn, f, slot) => {
		await busy(btn, async () => {
			const blob = await api.download(f.path, f.name);
			const url = URL.createObjectURL(blob);
			clear(slot, h('audio', { controls: true, autoplay: true, src: url }),
				h('a', { class: 'btn btn-sm', href: url, download: f.name }, 'Save'));
		});
	};

	const drawList = () => {
		const all = ctx.calls.filter(matches);
		const pages = Math.max(1, Math.ceil(all.length / PAGE));
		page = Math.min(page, pages - 1);
		const shown = all.slice(page * PAGE, page * PAGE + PAGE);
		const seen = ctx.info.missed_seen || 0;

		clear(list,
			shown.length ? h('ul', { class: 'calls' }, shown.map(c => {
				const bad = c.status === 'missed' || c.status === 'blocked' || c.status === 'failed' || c.status === 'barred';
				const name = nameOf(c.number);
				const d = duration(c);
				const why = c.reason ? reasonText(c.reason, repeatMin) : '';
				const f = c.rec && recFiles[c.rec];
				const recSlot = h('div', { class: 'row-actions' });
				const key = c.lines.join('\n');
				if (f) recSlot.appendChild(button('Play', { small: true, icon: 'play', onclick: e => playRec(e.currentTarget, f, recSlot) }));

				return h('li', { class: 'call' + (isMissed(c) && c.start > seen ? ' unseen' : '') },
					h('input', { type: 'checkbox', class: 'call-check', 'aria-label': 'Select call', checked: selected.has(key), onchange: e => { e.target.checked ? selected.add(key) : selected.delete(key); drawBar(); } }),
					h('div', { class: 'call-dir ' + (bad ? 'bad' : c.dir) }, icon(c.status === 'missed' ? 'missed' : c.status === 'blocked' ? 'block' : c.dir === 'in' ? 'in' : 'out')),
					h('div', { class: 'call-main' },
						h('div', { class: 'call-who' }, name || c.number || 'Unknown number', name ? h('span', { class: 'num' }, c.number) : null),
						h('div', { class: 'call-meta' }, [ statusOf(c), d ? fmtDuration(d) : null, why || null ].filter(Boolean).join(' · ')),
						f ? recSlot : null),
					h('div', { class: 'call-side' },
						h('span', { class: 'small' }, fmtTime(c.start)),
						c.status === 'active' ? badge('Now', 'accent') : null,
						c.number && /[0-9]{3}/.test(c.number) ? h('div', { class: 'row-actions' },
							contacts.has(digits(c.number)) ? null : iconButton('book', 'Add to phonebook', () => addContact(c.number)),
							blocked.has(digits(c.number)) ? badge('Blocked', 'bad') : iconButton('block', 'Block this number', () => blockNumber(c.number), 'danger')) : null));
			})) : empty(ctx.calls.length ? 'No calls match.' : 'No calls yet.'),
			pages > 1 ? h('div', { class: 'pager' },
				button('Newer', { small: true, disabled: page === 0, onclick: () => { page--; drawList(); } }),
				h('span', { class: 'muted small' }, 'Page ' + (page + 1) + ' of ' + pages),
				button('Older', { small: true, disabled: page >= pages - 1, onclick: () => { page++; drawList(); } })) : null);
		drawBar();
	};

	const bar = h('div', { class: 'row-actions' });
	const drawBar = () => clear(bar,
		selected.size ? button('Delete ' + selected.size + ' selected', { small: true, kind: 'danger', icon: 'trash', onclick: async e => {
			if (!await confirm('Delete calls', 'Delete ' + selected.size + ' call(s) from the history?')) return;
			const lines = [ ...selected ].flatMap(k => k.split('\n'));
			await busy(e.currentTarget, () => api.call('fxs', 'delete_calls', { lines }), 'Deleted');
			selected.clear();
			await ctx.refresh();
			drawAll();
		} }) : null);

	const seg = h('div', { class: 'segmented' });
	const drawSeg = () => clear(seg, [ [ 'all', 'All' ], [ 'missed', 'Missed' ], [ 'in', 'Incoming' ], [ 'out', 'Outgoing' ], [ 'blocked', 'Blocked' ], [ 'sip', 'SIP' ] ]
		.map(([v, l]) => h('button', { type: 'button', class: filter === v ? 'active' : '', onclick: () => { filter = v; page = 0; drawSeg(); drawList(); } }, l)));

	const drawAll = () => {
		const cs = ctx.calls;
		clear(root,
			pageHeader('Calls', 'Calls made and received on the phone port and the SIP phones.',
				ctx.missed ? button('Mark missed as seen', { icon: 'check', onclick: async e => { await busy(e.currentTarget, () => ctx.markSeen(), 'Marked as seen'); drawAll(); } }) : null,
				button('Export CSV', { icon: 'backup', onclick: exportCsv, title: 'The calls shown by the current filter and search' }),
				button('Clear history', { kind: 'danger', icon: 'trash', onclick: async e => {
					if (!await confirm('Clear call history', 'Delete every call in the history? This cannot be undone.', 'Clear')) return;
					await busy(e.currentTarget, () => api.call('fxs', 'clear_history', {}), 'History cleared');
					await ctx.refresh(); drawAll();
				} })),
			h('div', { class: 'stats' },
				stat('Missed, not seen', ctx.missed, ctx.missed ? 'bad' : '', () => { filter = 'missed'; drawSeg(); drawList(); }),
				stat('Incoming', cs.filter(c => c.dir === 'in' && c.status !== 'blocked').length, 'ok', () => { filter = 'in'; drawSeg(); drawList(); }),
				stat('Outgoing', cs.filter(c => c.dir === 'out').length, 'accent', () => { filter = 'out'; drawSeg(); drawList(); }),
				stat('Blocked', cs.filter(c => c.status === 'blocked').length, '', () => { filter = 'blocked'; drawSeg(); drawList(); })),
			card(null, h('div', { class: 'toolbar' }, seg, search, bar), list));
		drawSeg();
		drawList();
	};

	drawAll();
	document.addEventListener('phone-status', e => { if (e.detail.changed && document.body.contains(root)) drawList(); });
	return root;
}
