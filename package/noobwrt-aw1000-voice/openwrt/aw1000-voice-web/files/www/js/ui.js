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

// ---- icons (inline SVG paths, 24x24) ---------------------------------------

const ICONS = {
	dashboard: 'M3 13h8V3H3zm0 8h8v-6H3zm10 0h8V11h-8zm0-18v6h8V3z',
	calls: 'M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1z',
	missed: 'M19.6 7.4 12 15l-5-5h3V8H4v6h2v-3l6 6 9-9zM2 18h20v2H2z',
	rec: 'M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V22h2v-3.08A7 7 0 0 0 19 12z',
	book: 'M18 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2zm-6 4a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5zm5 10H7v-.75C7 13.6 10.33 13 12 13s5 .6 5 2.25z',
	block: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM4 12a8 8 0 0 1 12.9-6.3L5.7 16.9A7.9 7.9 0 0 1 4 12zm8 8a7.9 7.9 0 0 1-4.9-1.7L18.3 7.1A8 8 0 0 1 12 20z',
	moon: 'M12 3a9 9 0 1 0 9 9 7 7 0 0 1-9-9z',
	alarm: 'M22 5.7 17.4 1.8l-1.3 1.5 4.6 3.9zM7.9 3.3 6.6 1.8 2 5.7l1.3 1.5zM12 4a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm0 16a7 7 0 1 1 0-14 7 7 0 0 1 0 14zm.5-12H11v6l4.75 2.85.75-1.23-4-2.37z',
	services: 'M19.4 13a7.5 7.5 0 0 0 0-2l2.1-1.6a.5.5 0 0 0 .1-.6l-2-3.5a.5.5 0 0 0-.6-.2l-2.5 1a7.3 7.3 0 0 0-1.7-1l-.4-2.6a.5.5 0 0 0-.5-.4h-4a.5.5 0 0 0-.5.4l-.4 2.6a7.3 7.3 0 0 0-1.7 1l-2.5-1a.5.5 0 0 0-.6.2l-2 3.5a.5.5 0 0 0 .1.6L4.6 11a7.5 7.5 0 0 0 0 2l-2.1 1.6a.5.5 0 0 0-.1.6l2 3.5a.5.5 0 0 0 .6.2l2.5-1a7.3 7.3 0 0 0 1.7 1l.4 2.6a.5.5 0 0 0 .5.4h4a.5.5 0 0 0 .5-.4l.4-2.6a7.3 7.3 0 0 0 1.7-1l2.5 1a.5.5 0 0 0 .6-.2l2-3.5a.5.5 0 0 0-.1-.6zM12 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z',
	sip: 'M17 1H7a2 2 0 0 0-2 2v18a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3a2 2 0 0 0-2-2zm0 18H7V5h10z',
	settings: 'M3 17v2h6v-2zM3 5v2h10V5zm10 16v-2h8v-2h-8v-2h-2v6zM7 9v2H3v2h4v2h2V9zm14 4v-2H11v2zm-6-4h2V7h4V5h-4V3h-2z',
	backup: 'M19.35 10.04A7.49 7.49 0 0 0 12 4a7.5 7.5 0 0 0-6.65 4.04A6 6 0 0 0 6 20h13a5 5 0 0 0 .35-9.96zM14 13v4h-4v-4H7l5-5 5 5z',
	logout: 'M10.1 15.6 11.5 17l5-5-5-5-1.4 1.4 2.6 2.6H3v2h9.7zM19 3H5a2 2 0 0 0-2 2v4h2V5h14v14H5v-4H3v4a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2z',
	theme: 'M12 3a9 9 0 1 0 0 18V3z',
	menu: 'M3 18h18v-2H3zm0-5h18v-2H3zm0-7v2h18V6z',
	in: 'M20 5.4 18.6 4 7 15.6V9H5v10h10v-2H8.4z',
	out: 'M9 5v2h6.6L4 18.6 5.4 20 17 8.4V15h2V5z',
	add: 'M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6z',
	edit: 'M3 17.25V21h3.75L17.8 9.94l-3.75-3.75zM20.7 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75z',
	trash: 'M6 19a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7H6zM19 4h-3.5l-1-1h-5l-1 1H5v2h14z',
	play: 'M8 5v14l11-7z',
	pin: 'M16 9V4h1V2H7v2h1v5a3 3 0 0 1-3 3v2h5.97v7l1 1 1-1v-7H19v-2a3 3 0 0 1-3-3z',
	refresh: 'M17.65 6.35A7.95 7.95 0 0 0 12 4a8 8 0 1 0 7.73 10h-2.08A6 6 0 1 1 12 6c1.66 0 3.14.69 4.22 1.78L13 11h7V4z',
	qr: 'M3 11h8V3H3zm2-6h4v4H5zM3 21h8v-8H3zm2-6h4v4H5zm8-12v8h8V3zm6 6h-4V5h4zm0 10h2v2h-2zm-6-6h2v2h-2zm2 2h2v2h-2zm-2 2h2v2h-2zm2 2h2v2h-2zm2-2h2v2h-2zm0-4h2v2h-2zm2 2h2v2h-2z',
	key: 'M12.65 10A6 6 0 1 0 7 18a6 6 0 0 0 5.65-4H17v4h4v-4h2v-4zM7 14a2 2 0 1 1 0-4 2 2 0 0 1 0 4z',
	ring: 'M12 22a2 2 0 0 0 2-2h-4a2 2 0 0 0 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4a1.5 1.5 0 0 0-3 0v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1z',
	check: 'M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z',
	pulse: 'M3 13h4l2.5-6 4 12 3-8 1.5 2H21v-2h-1.8l-2.7-4-3 8-4-12L6 11H3z',
	close: 'M19 6.41 17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z'
};

export function icon(name, cls = '') {
	const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
	const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');

	svg.setAttribute('viewBox', '0 0 24 24');
	svg.setAttribute('aria-hidden', 'true');
	svg.setAttribute('class', 'icon ' + cls);
	path.setAttribute('d', ICONS[name] || ICONS.dashboard);
	svg.appendChild(path);
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

export function stat(label, value, kind = '', onclick) {
	return h(onclick ? 'button' : 'div', { class: 'stat' + (kind ? ' stat-' + kind : ''), type: onclick ? 'button' : null, onclick },
		h('div', { class: 'stat-value' }, value), h('div', { class: 'stat-label' }, label));
}

export function kv(rows) {
	return h('dl', { class: 'kv' }, rows.filter(Boolean).map(([k, v]) => [ h('dt', k), h('dd', v === '' || v == null ? '—' : v) ]));
}

export function loading() {
	return h('div', { class: 'loading' }, h('span', { class: 'spinner' }), 'Loading…');
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
