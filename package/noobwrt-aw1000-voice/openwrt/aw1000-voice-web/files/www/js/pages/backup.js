// SPDX-License-Identifier: GPL-2.0-only
import * as api from '../api.js';
import { h, card, pageHeader, button, busy, toast, confirm } from '../ui.js';

export default async function backup(ctx) {
	const file = h('input', { type: 'file', accept: '.json,application/json' });

	const save = async btn => {
		const b = await busy(btn, () => api.call('fxs', 'backup', {}));
		const blob = new Blob([ JSON.stringify(b, null, 1) ], { type: 'application/json' });
		const d = new Date(), pad = n => String(n).padStart(2, '0');
		const a = h('a', { href: URL.createObjectURL(blob), download: 'phone-backup-' + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + '.json' });
		document.body.appendChild(a);
		a.click();
		a.remove();
		toast('Backup saved');
	};

	const restore = async btn => {
		const f = file.files[0];
		if (!f) { toast('Pick a backup file first', 'error'); return; }
		let data;
		try {
			data = JSON.parse(await f.text());
		} catch (e) {
			toast('That is not a phone backup file', 'error');
			return;
		}
		if (data.format !== 'fxs-backup') { toast('That is not a phone backup file', 'error'); return; }
		if (!await confirm('Restore backup', 'Replace all phone settings and the call history with this backup? The phone service restarts.', 'Restore', 'primary')) return;
		await busy(btn, async () => {
			await api.call('file', 'write', { path: '/tmp/fxs-restore.json', data: JSON.stringify(data) });
			const r = await api.call('fxs', 'restore', {});
			if (!r.result)
				throw new Error(r.error === 'busy' ? 'A call is in progress. Try again after it.' : 'The backup could not be restored (' + (r.error || '?') + ').');
		}, 'Backup restored');
		await ctx.refresh();
	};

	return h('div',
		pageHeader('Backup', 'Every phone setting, the phonebook, rules and the call history in one file. SIP phone logins are not included.'),
		h('div', { class: 'grid grid-2' },
			card('Save a backup', h('p', { class: 'muted' }, 'Downloads a file you can restore on this or another router.'),
				h('div', { class: 'form-actions' }, button('Download backup', { kind: 'primary', icon: 'backup', onclick: e => save(e.currentTarget) }))),
			card('Restore', h('p', { class: 'muted' }, 'Pick a backup made on this page or in the old LuCI phone page.'),
				file,
				h('div', { class: 'form-actions' }, button('Restore', { kind: 'danger', onclick: e => restore(e.currentTarget) })))));
}
