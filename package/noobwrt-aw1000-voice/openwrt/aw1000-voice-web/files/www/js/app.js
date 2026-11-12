// SPDX-License-Identifier: GPL-2.0-only
// App shell: login, navigation, routing and the live line status.

import * as api from './api.js';
import { h, clear, icon, toast, badge, loading } from './ui.js';
import { parse, isMissed } from './calllog.js';

const PAGES = [
	{ group: 'Overview', items: [
		{ id: 'dashboard', title: 'Dashboard', icon: 'dashboard' },
		{ id: 'calls', title: 'Calls', icon: 'calls', badge: 'missed' },
		{ id: 'recordings', title: 'Recordings', icon: 'rec' }
	] },
	{ group: 'People', items: [
		{ id: 'phonebook', title: 'Phonebook', icon: 'book' },
		{ id: 'blocking', title: 'Blocking', icon: 'block' }
	] },
	{ group: 'Line', items: [
		{ id: 'quiet', title: 'Do not disturb', icon: 'moon' },
		{ id: 'alarms', title: 'Alarm calls', icon: 'alarm' },
		{ id: 'services', title: 'Phone services', icon: 'services' },
		{ id: 'sip', title: 'SIP phones', icon: 'sip' },
		{ id: 'line', title: 'Line health', icon: 'pulse' }
	] },
	{ group: 'System', items: [
		{ id: 'alerts', title: 'Alerts', icon: 'ring' },
		{ id: 'settings', title: 'Settings', icon: 'settings' },
		{ id: 'backup', title: 'Backup', icon: 'backup' }
	] }
];

const ALL = PAGES.flatMap(g => g.items);

export const STATE_TEXT = {
	idle: 'Ready', dialtone: 'Dial tone', digits: 'Dialing', calling: 'Calling',
	talking: 'In call', ringing: 'Ringing', busy: 'Busy tone', stopped: 'Stopped'
};

// Shared state handed to every page.
const ctx = {
	status: {},
	info: {},
	calls: [],
	missed: 0,
	async refresh() {
		const [ status, info, hist ] = await Promise.all([
			api.maybe('fxs', 'status', {}, {}),
			api.maybe('aw1000-voice', 'info', {}, {}),
			api.maybe('fxs', 'history', {}, { log: '' })
		]);
		this.status = status;
		this.info = info;
		this.calls = parse(hist.log, status.state && status.state !== 'idle' && status.state !== 'stopped');
		this.missed = this.calls.filter(c => isMissed(c) && c.start > (info.missed_seen || 0)).length;
		drawStatus();
	},
	async markSeen() {
		const r = await api.call('aw1000-voice', 'missed_seen', {});
		this.info.missed_seen = r.missed_seen;
		this.missed = 0;
		drawStatus();
	},
	go(id) { location.hash = '#/' + id; }
};

let current = null;
let pollTimer = null;
let lastState = null;

// ---- theme ---------------------------------------------------------------

function applyTheme(t) {
	document.documentElement.dataset.theme = t;
	try { localStorage.setItem('aw1kv.theme', t); } catch (e) {}
}

function initTheme() {
	let t = new URLSearchParams(location.search).get('theme');
	if (t !== 'light' && t !== 'dark')
		try { t = localStorage.getItem('aw1kv.theme'); } catch (e) {}
	if (t) document.documentElement.dataset.theme = t;
}

function toggleTheme() {
	const cur = document.documentElement.dataset.theme ||
		(matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
	applyTheme(cur === 'dark' ? 'light' : 'dark');
}

// ---- login -----------------------------------------------------------------

function loginView(message) {
	const user = h('input', { type: 'text', value: 'root', autocomplete: 'username', required: true });
	const pass = h('input', { type: 'password', autocomplete: 'current-password', placeholder: 'Router password' });
	const remember = h('input', { type: 'checkbox' });
	const err = h('div', { class: 'alert alert-error', hidden: !message }, message || '');
	const submit = h('button', { class: 'btn btn-primary btn-block', type: 'submit' }, 'Sign in');

	const form = h('form', { class: 'login-card', onsubmit: async e => {
		e.preventDefault();
		submit.disabled = true;
		err.hidden = true;
		try {
			await api.login(user.value.trim(), pass.value, remember.checked);
			start();
		} catch (ex) {
			err.textContent = ex.message;
			err.hidden = false;
			pass.select();
		} finally {
			submit.disabled = false;
		}
	} },
		h('div', { class: 'brand brand-lg' }, h('img', { src: 'favicon.svg', alt: '' }), h('div', h('strong', 'Phone'), h('span', 'AW1000 voice'))),
		h('p', { class: 'muted' }, 'Sign in with your router login.'),
		err,
		h('label', { class: 'field-label' }, 'User name'), user,
		h('label', { class: 'field-label' }, 'Password'), pass,
		h('label', { class: 'check' }, remember, h('span', 'Keep me signed in on this device')),
		submit);

	clear(document.getElementById('app'), h('div', { class: 'login' }, form));
	(user.value ? pass : user).focus();
}

// ---- layout ----------------------------------------------------------------

function navLink(p) {
	return h('a', { href: '#/' + p.id, class: 'nav-link', 'data-page': p.id, onclick: () => document.body.classList.remove('nav-open') },
		icon(p.icon), h('span', p.title), p.badge ? h('span', { class: 'nav-badge', 'data-badge': p.badge, hidden: true }) : null);
}

function shell() {
	const app = document.getElementById('app');

	clear(app,
		h('aside', { class: 'sidebar' },
			h('a', { class: 'brand', href: '#/dashboard' }, h('img', { src: 'favicon.svg', alt: '' }), h('div', h('strong', 'Phone'), h('span', 'AW1000 voice'))),
			h('nav', PAGES.map(g => h('div', { class: 'nav-group' }, h('div', { class: 'nav-title' }, g.group), g.items.map(navLink)))),
			h('div', { class: 'sidebar-foot' },
				h('button', { class: 'nav-link', type: 'button', onclick: toggleTheme }, icon('theme'), h('span', 'Light / dark')),
				h('button', { class: 'nav-link', type: 'button', onclick: async () => { await api.logout(); loginView(); } }, icon('logout'), h('span', 'Sign out')),
				h('div', { class: 'version muted small', id: 'version' }))),
		h('div', { class: 'scrim', onclick: () => document.body.classList.remove('nav-open') }),
		h('div', { class: 'main' },
			h('div', { class: 'topbar' },
				h('button', { class: 'icon-btn menu-btn', type: 'button', 'aria-label': 'Menu', onclick: () => document.body.classList.toggle('nav-open') }, icon('menu')),
				h('div', { class: 'topbar-title', id: 'topbar-title' }),
				h('div', { class: 'line-pill', id: 'line-pill' })),
			h('main', { class: 'content', id: 'content' })));
}

function drawStatus() {
	const s = ctx.status || {};
	const pill = document.getElementById('line-pill');
	if (!pill) return;

	let kind = 'off', text = 'Phone port off';
	if (s.enabled === false || s.enabled === 0) {
		kind = 'off'; text = 'Phone port off';
	} else if (!s.running) {
		kind = 'bad'; text = 'Not running';
	} else {
		kind = s.state === 'ringing' ? 'ring' : s.state === 'talking' ? 'call' : s.state === 'idle' ? 'ok' : 'busy';
		text = STATE_TEXT[s.state] || s.state || 'Unknown';
		if (s.state === 'talking' && s.peer) text += ' · ' + s.peer;
		if (s.state === 'ringing' && s.peer) text += ' · ' + s.peer;
	}
	clear(pill, h('span', { class: 'dot dot-' + kind }), h('span', text), s.dnd || s.silent ? badge('Quiet', 'muted') : null);

	for (const b of document.querySelectorAll('[data-badge="missed"]')) {
		b.textContent = ctx.missed > 99 ? '99+' : ctx.missed;
		b.hidden = !ctx.missed;
	}
	const v = document.getElementById('version');
	if (v && ctx.info.versions)
		v.textContent = 'web ' + (ctx.info.versions.web || '?') + ' · fxsd ' + (ctx.info.versions.fxsd || '?');
	document.title = (ctx.missed ? '(' + ctx.missed + ') ' : '') + 'Phone · ' + (ctx.info.hostname || 'AW1000');
}

// ---- routing ---------------------------------------------------------------

async function route() {
	const id = (location.hash.match(/^#\/([a-z]+)/) || [])[1] || 'dashboard';
	const page = ALL.find(p => p.id === id) || ALL[0];
	const content = document.getElementById('content');
	if (!content) return;

	for (const a of document.querySelectorAll('.nav-link[data-page]'))
		a.classList.toggle('active', a.dataset.page === page.id);
	document.getElementById('topbar-title').textContent = page.title;

	const token = current = {};
	clear(content, loading());
	try {
		const mod = await import('./pages/' + page.id + '.js');
		const node = await mod.default(ctx);
		if (current === token)
			clear(content, node);
	} catch (e) {
		if (current === token)
			clear(content, h('div', { class: 'alert alert-error' }, 'This page could not load: ' + (e.message || e)));
		console.error(e);
	}
	content.focus({ preventScroll: true });
	window.scrollTo(0, 0);
}

async function poll() {
	clearTimeout(pollTimer);
	try {
		const s = await api.call('fxs', 'status', {});
		const changed = s.state !== lastState;
		ctx.status = s;
		lastState = s.state;
		if (changed)
			await ctx.refresh();
		else
			drawStatus();
		document.dispatchEvent(new CustomEvent('phone-status', { detail: { status: s, changed } }));
	} catch (e) {
		if (e.code === 6) return;
	}
	pollTimer = setTimeout(poll, document.hidden ? 15000 : 4000);
}

async function start() {
	shell();
	try {
		await ctx.refresh();
	} catch (e) { /* drawn per page */ }
	if (!ctx.info.port && !ctx.status.state) {
		// No session access at all: the session expired or rpcd lacks the ACL.
		try {
			await api.call('aw1000-voice', 'info', {});
		} catch (e) {
			if (e.code === 6) { loginView('Your session ended. Sign in again.'); return; }
		}
	}
	lastState = ctx.status.state;
	route();
	poll();
}

api.setAuthLostHandler(() => {
	clearTimeout(pollTimer);
	loginView('Your session ended. Sign in again.');
});

window.addEventListener('hashchange', () => { if (api.loggedIn()) route(); });
document.addEventListener('visibilitychange', () => { if (!document.hidden && api.loggedIn()) poll(); });

initTheme();
if (api.loggedIn())
	start();
else
	loginView();

export { ctx };
