// SPDX-License-Identifier: GPL-2.0-only
// JSON-RPC client for the router's ubus (rpcd), with the router's own login.

const NULL_SID = '00000000000000000000000000000000';
const KEY = 'aw1kv.session';

const UBUS_ERRORS = {
	1: 'Invalid command', 2: 'Invalid argument', 3: 'Method not found',
	4: 'Not found', 5: 'No data', 6: 'Permission denied', 7: 'Timeout',
	8: 'Not supported', 9: 'Unknown error', 10: 'Connection failed'
};

let sid = load();
let rid = 1;
let onAuthLost = null;

function load() {
	try { return localStorage.getItem(KEY) || sessionStorage.getItem(KEY) || NULL_SID; }
	catch (e) { return NULL_SID; }
}

function store(value, remember) {
	try {
		localStorage.removeItem(KEY);
		sessionStorage.removeItem(KEY);
		if (value)
			(remember ? localStorage : sessionStorage).setItem(KEY, value);
	} catch (e) { /* private mode: the session lives in memory only */ }
}

export class ApiError extends Error {
	constructor(code, message) {
		super(message);
		this.code = code;
	}
}

async function rpc(method, params) {
	let res;

	try {
		res = await fetch('/ubus', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ jsonrpc: '2.0', id: rid++, method, params })
		});
	} catch (e) {
		throw new ApiError(-1, 'The router did not answer');
	}
	const body = await res.json().catch(() => null);
	if (!body)
		throw new ApiError(-1, 'Bad reply from the router (HTTP ' + res.status + ')');
	if (body.error) {
		// uhttpd answers -32002 when the session has no grant for the object,
		// which is what an expired session or an rpcd reload leaves behind.
		if (body.error.code === -32002 && method === 'call' && params[0] !== NULL_SID) {
			if (onAuthLost)
				onAuthLost();
			throw new ApiError(6, 'Your session ended. Sign in again.');
		}
		throw new ApiError(body.error.code, body.error.message);
	}
	return body.result;
}

export function setAuthLostHandler(fn) {
	onAuthLost = fn;
}

export function loggedIn() {
	return sid !== NULL_SID;
}

export async function call(object, method, args = {}) {
	const res = await rpc('call', [ sid, object, method, args ]);
	const code = Array.isArray(res) ? res[0] : 9;

	if (code !== 0) {
		if (code === 6 && onAuthLost)
			onAuthLost();
		throw new ApiError(code, UBUS_ERRORS[code] || ('ubus error ' + code));
	}
	return res[1] || {};
}

// Calls that may legitimately fail (a method missing on older firmware).
export function maybe(object, method, args, fallback = {}) {
	return call(object, method, args).catch(() => fallback);
}

export async function login(username, password, remember) {
	const res = await rpc('call', [ NULL_SID, 'session', 'login', { username, password, timeout: 3600 * 12 } ]);

	if (!Array.isArray(res) || res[0] !== 0 || !res[1] || !res[1].ubus_rpc_session)
		throw new ApiError(6, 'Wrong user name or password');
	sid = res[1].ubus_rpc_session;
	store(sid, remember);
}

export async function logout() {
	try { await call('session', 'destroy', {}); } catch (e) { /* already gone */ }
	sid = NULL_SID;
	store(null);
}

export function sessionId() {
	return sid;
}

// ---- UCI ---------------------------------------------------------------

export const uci = {
	async get(config) {
		const r = await call('uci', 'get', { config });
		return r.values || {};
	},

	async sections(config, type) {
		const all = await this.get(config);
		return Object.values(all)
			.filter(s => !type || s['.type'] === type)
			.sort((a, b) => (a['.index'] || 0) - (b['.index'] || 0));
	},

	set(config, section, values) {
		return call('uci', 'set', { config, section, values });
	},

	async add(config, type, values) {
		const r = await call('uci', 'add', { config, type, values });
		return r.section;
	},

	remove(config, section) {
		return call('uci', 'delete', { config, section });
	},

	unset(config, section, options) {
		return call('uci', 'delete', { config, section, options });
	},

	commit(config) {
		return call('uci', 'commit', { config });
	},

	revert(config) {
		return call('uci', 'revert', { config }).catch(() => {});
	},

	// Write option values: empty strings and empty lists remove the option.
	async save(config, section, values) {
		const set = {}, del = [];

		for (const [k, v] of Object.entries(values)) {
			if (v === '' || v === null || v === undefined || (Array.isArray(v) && !v.length))
				del.push(k);
			else
				set[k] = v;
		}
		if (Object.keys(set).length)
			await this.set(config, section, set);
		if (del.length)
			await this.unset(config, section, del).catch(() => {});
	}
};

// ---- cgi-io --------------------------------------------------------------

export async function download(path, filename) {
	const form = new URLSearchParams({ sessionid: sid, path, filename, mimetype: 'audio/wav' });
	const res = await fetch('/cgi-bin/cgi-download', { method: 'POST', body: form });

	if (!res.ok)
		throw new ApiError(res.status, 'Download failed (HTTP ' + res.status + ')');
	return res.blob();
}

export async function upload(path, file) {
	const form = new FormData();

	form.append('sessionid', sid);
	form.append('filename', path);
	form.append('filedata', file);
	const res = await fetch('/cgi-bin/cgi-upload', { method: 'POST', body: form });
	if (!res.ok)
		throw new ApiError(res.status, 'Upload failed (HTTP ' + res.status + ')');
	return res.json().catch(() => ({}));
}
