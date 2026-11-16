// SPDX-License-Identifier: GPL-2.0-only
// Small DOM helpers: element builder, icons, toasts, dialogs, formatting.

export function h(tag, attrs, ...children) {
	const el = document.createElement(tag);

	if (attrs && (typeof attrs !== 'object' || attrs instanceof Node || Array.isArray(attrs))) {
		children.unshift(attrs);
		attrs = null;
	}
	for (const [k, v] of Object.entries(attrs || {})) {
		if (v === null || v === undefined || v === false)
			continue;
		if (k === 'class')
			el.className = v;
		else if (k === 'style' && typeof v === 'object')
			Object.assign(el.style, v);
		else if (k.startsWith('on') && typeof v === 'function')
			el.addEventListener(k.slice(2).toLowerCase(), v);
		else if (k === 'html')
			el.innerHTML = v;
		else if (v === true)
			el.setAttribute(k, '');
		else
			el.setAttribute(k, v);
	}
	append(el, children);
	return el;
}

function append(el, children) {
	for (const c of children.flat(Infinity)) {
		if (c === null || c === undefined || c === false || c === '')
			continue;
		el.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
	}
}

export function clear(el, ...children) {
	el.replaceChildren();
	append(el, children);
	return el;
}

// ---- icons-------------------------------

const ICONS = {
	dashboard: '<rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/>',
	sidebar: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/>',
	calls: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>',
	missed: '<line x1="22" x2="16" y1="2" y2="8"/><line x1="16" x2="22" y1="2" y2="8"/><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>',
	rec: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/>',
	book: '<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/><path d="M6 6h10"/><path d="M6 10h10"/>',
	block: '<circle cx="12" cy="12" r="10"/><path d="m4.9 4.9 14.2 14.2"/>',
	moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
	alarm: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2"/><path d="m5 3-2 2"/><path d="m19 3 2 2"/>',
	services: '<rect width="20" height="8" x="2" y="2" rx="2"/><rect width="20" height="8" x="2" y="14" rx="2"/><line x1="6" x2="6.01" y1="6" y2="6"/><line x1="6" x2="6.01" y1="18" y2="18"/>',
	sip: '<rect width="14" height="20" x="5" y="2" rx="2"/><line x1="12" x2="12.01" y1="18" y2="18"/>',
	settings: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
	backup: '<path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/><path d="M12 12v9"/><path d="m16 16-4-4-4 4"/>',
	logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/>',
	theme: '<circle cx="12" cy="12" r="9"/><path d="M12 3v18c4.97 0 9-4.03 9-9s-4.03-9-9-9Z" fill="currentColor"/>',
	sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>',
	menu: '<line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/>',
	in: '<polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/>',
	out: '<polyline points="8 7 3 12 8 17"/><line x1="3" x2="15" y1="12" y2="12"/>',
	add: '<path d="M5 12h14"/><path d="M12 5v14"/>',
	edit: '<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/>',
	trash: '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>',
	play: '<polygon points="6 3 20 12 6 21 6 3" fill="currentColor"/>',
	pin: '<line x1="12" x2="12" y1="17" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"/>',
	refresh: '<path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/>',
	qr: '<rect width="5" height="5" x="3" y="3" rx="1"/><rect width="5" height="5" x="16" y="3" rx="1"/><rect width="5" height="5" x="3" y="16" rx="1"/><path d="M21 16h-3a2 2 0 0 0-2 2v3"/><path d="M21 21v.01"/><path d="M12 7v3a2 2 0 0 1-2 2H7"/><path d="M3 12h.01"/><path d="M12 3h.01"/><path d="M12 16v.01"/><path d="M16 12h1"/><path d="M21 12v.01"/><path d="M12 21v-1"/>',
	key: '<circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6"/><path d="m15.5 7.5 3 3L22 7l-3-3"/>',
	ring: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
	check: '<polyline points="20 6 9 17 4 12"/>',
	info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
	sms: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/><line x1="9" x2="9.01" y1="10" y2="10"/><line x1="12" x2="12.01" y1="10" y2="10"/><line x1="15" x2="15.01" y1="10" y2="10"/>',
	pulse: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
	close: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>'
};

export function icon(name, cls = '') {
	const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
	svg.setAttribute('viewBox', '0 0 24 24');
	svg.setAttribute('width', '24');
	svg.setAttribute('height', '24');
	svg.setAttribute('fill', 'none');
	svg.setAttribute('stroke', 'currentColor');
	svg.setAttribute('stroke-width', '2');
	svg.setAttribute('stroke-linecap', 'round');
	svg.setAttribute('stroke-linejoin', 'round');
	svg.setAttribute('aria-hidden', 'true');
	svg.setAttribute('class', 'icon ' + cls);
	svg.innerHTML = ICONS[name] || ICONS.dashboard;
	return svg;
}

// ---- feedback ------------------------------------------------------------

export function toast(message, kind = 'ok', ms = 3500) {
	let host = document.getElementById('toasts');

	if (!host)
		document.body.appendChild(host = h('div', { id: 'toasts', 'aria-live': 'polite' }));
	const t = h('div', { class: 'toast toast-' + kind, role: kind === 'error' ? 'alert' : 'status' }, message);
	host.appendChild(t);
	setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 300); }, ms);
}

export function modal({ title, body, actions = [], wide = false, onClose }) {
	const close = () => { back.remove(); document.removeEventListener('keydown', esc); onClose && onClose(); };
	const esc = e => { if (e.key === 'Escape') close(); };
	const foot = h('div', { class: 'modal-foot' }, actions.map(a => h('button', {
		class: 'btn ' + (a.kind ? 'btn-' + a.kind : ''),
		type: 'button',
		onclick: async ev => {
			const btn = ev.currentTarget;
			btn.disabled = true;
			try {
				if ((await a.onclick?.()) !== false)
					close();
			} catch (e) {
				toast(e.message || String(e), 'error');
			} finally {
				btn.disabled = false;
			}
		}
	}, a.label)));
	const box = h('div', { class: 'modal' + (wide ? ' modal-wide' : ''), role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
		h('div', { class: 'modal-head' }, h('h3', title),
			h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Close', onclick: close }, icon('close'))),
		h('div', { class: 'modal-body' }, body),
		actions.length ? foot : null);
	const back = h('div', { class: 'modal-back', onclick: e => { if (e.target === back) close(); } }, box);

	document.addEventListener('keydown', esc);
	document.body.appendChild(back);
	box.querySelector('input, select, textarea')?.focus();
	return { close, box };
}

export function confirm(title, text, label = 'Delete', kind = 'danger') {
	return new Promise(resolve => {
		let done = false;
		modal({
			title,
			body: h('p', text),
			actions: [
				{ label: 'Cancel', onclick: () => { done = true; resolve(false); } },
				{ label, kind, onclick: () => { done = true; resolve(true); } }
			],
			onClose: () => { if (!done) resolve(false); }
		});
	});
}

// Run an async action with a busy button and a toast on failure.
export async function busy(btn, fn, okMessage) {
	if (btn) btn.disabled = true;
	try {
		const r = await fn();
		if (okMessage)
			toast(okMessage);
		return r;
	} catch (e) {
		toast(e.message || String(e), 'error', 6000);
		throw e;
	} finally {
		if (btn) btn.disabled = false;
	}
}

// ---- building blocks -----------------------------------------------------

export function card(title, ...body) {
	let actions = null;

	if (body.length && body[0] && body[0].actions) {
		actions = body.shift().actions;
	}
	return h('section', { class: 'card' },
		title || actions ? h('div', { class: 'card-head' }, title ? h('h2', title) : h('span'), actions ? h('div', { class: 'card-actions' }, actions) : null) : null,
		h('div', { class: 'card-body' }, body));
}

export function pageHeader(title, subtitle, ...actions) {
	return h('header', { class: 'page-head' },
		h('div', h('h1', title), subtitle ? h('p', { class: 'muted' }, subtitle) : null),
		actions.length ? h('div', { class: 'page-actions' }, actions) : null);
}

export function button(label, opts = {}) {
	return h('button', {
		class: 'btn' + (opts.kind ? ' btn-' + opts.kind : '') + (opts.small ? ' btn-sm' : ''),
		type: opts.type || 'button',
		title: opts.title,
		onclick: opts.onclick,
		disabled: opts.disabled
	}, opts.icon ? icon(opts.icon) : null, label ? h('span', label) : null);
}

export function iconButton(name, title, onclick, kind = '') {
	return h('button', { class: 'icon-btn ' + kind, type: 'button', title, 'aria-label': title, onclick }, icon(name));
}

export function badge(text, kind = '') {
	return h('span', { class: 'badge' + (kind ? ' badge-' + kind : '') }, text);
}

export function empty(text, iconName = 'calls') {
	return h('div', { class: 'empty' }, icon(iconName), h('p', text));
}

// A KPI tile. iconName and sub (a small second line) are optional.
export function stat(label, value, kind = '', onclick, iconName, sub) {
	return h(onclick ? 'button' : 'div', { class: 'stat' + (kind ? ' stat-' + kind : '') + (iconName ? ' stat-icon' : ''), type: onclick ? 'button' : null, onclick },
		iconName ? h('div', { class: 'stat-badge' }, icon(iconName)) : null,
		h('div', { class: 'stat-text' },
			h('div', { class: 'stat-value' }, value),
			h('div', { class: 'stat-label' }, label),
			sub ? h('div', { class: 'stat-sub' }, sub) : null));
}

export function kv(rows) {
	return h('dl', { class: 'kv' }, rows.filter(Boolean).map(([k, v]) => [ h('dt', k), h('dd', v === '' || v == null ? '—' : v) ]));
}

export function loading(text = 'Loading…') {
	return h('div', { class: 'loading' }, h('span', { class: 'spinner' }), h('span', text));
}

// ---- formatting ------------------------------------------------------------

const pad = n => (n < 10 ? '0' : '') + n;

export function fmtTime(t, withDate = true) {
	if (!t) return '—';
	const d = new Date(t * 1000), now = new Date();
	const time = pad(d.getHours()) + ':' + pad(d.getMinutes());

	if (!withDate)
		return time;
	if (d.toDateString() === now.toDateString())
		return 'Today ' + time;
	const y = new Date(now); y.setDate(now.getDate() - 1);
	if (d.toDateString() === y.toDateString())
		return 'Yesterday ' + time;
	return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + time;
}

export function fmtAgo(t, now = Date.now() / 1000) {
	const s = Math.max(0, Math.round(now - t));
	if (s < 60) return 'just now';
	if (s < 3600) return Math.floor(s / 60) + ' min ago';
	if (s < 86400) return Math.floor(s / 3600) + ' h ago';
	return Math.floor(s / 86400) + ' d ago';
}

export function fmtDuration(s) {
	if (s == null || s < 0) return '—';
	const hh = Math.floor(s / 3600), mm = Math.floor(s / 60) % 60, ss = s % 60;
	return (hh ? hh + ':' + pad(mm) : mm) + ':' + pad(ss);
}

export function fmtSize(bytes) {
	if (bytes < 1024) return bytes + ' B';
	if (bytes < 1048576) return (bytes / 1024).toFixed(0) + ' KB';
	return (bytes / 1048576).toFixed(1) + ' MB';
}
