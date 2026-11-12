#!/usr/bin/env node
// SPDX-License-Identifier: GPL-2.0-only
// Take the README screenshots from the demo server (mock_server.py), with real
// phone-width emulation through the Chrome DevTools protocol.
//
//   node scripts/screenshots/shoot.mjs [path-to-chrome]
//
// Needs Node 22+ (built-in WebSocket) and Python 3. Writes docs/img/*.png.
// Every number and name in the shots is made up.

import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = join(ROOT, 'docs', 'img');
const CHROME = process.argv[2] || process.env.CHROME || 'google-chrome';
const PORT = 8766, DEBUG = 9333;
const sleep = ms => new Promise(r => setTimeout(r, ms));

const SHOTS = [
	{ name: 'desktop-dashboard', page: 'dashboard', w: 1440, h: 900, scale: 1 },
	{ name: 'desktop-calls', page: 'calls', w: 1440, h: 900, scale: 1 },
	{ name: 'desktop-sip', page: 'sip', w: 1440, h: 900, scale: 1 },
	{ name: 'desktop-settings', page: 'settings', w: 1440, h: 900, scale: 1 },
	{ name: 'desktop-dark-dashboard', page: 'dashboard', w: 1440, h: 900, scale: 1, theme: 'dark' },
	{ name: 'mobile-dashboard', page: 'dashboard', w: 390, h: 844, scale: 2, mobile: true },
	{ name: 'mobile-calls', page: 'calls', w: 390, h: 844, scale: 2, mobile: true },
	{ name: 'mobile-alerts', page: 'alerts', w: 390, h: 844, scale: 2, mobile: true, theme: 'dark' }
];

mkdirSync(OUT, { recursive: true });
const server = spawn(process.platform === 'win32' ? 'python' : 'python3',
	[ join(ROOT, 'scripts', 'screenshots', 'mock_server.py'), String(PORT) ], { stdio: 'ignore' });
const chrome = spawn(CHROME, [ '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run',
	'--remote-debugging-port=' + DEBUG, '--user-data-dir=' + mkdtempSync(join(tmpdir(), 'shots-')), 'about:blank' ], { stdio: 'ignore' });

const cleanup = () => { try { chrome.kill(); } catch (e) {} try { server.kill(); } catch (e) {} };
process.on('exit', cleanup);

async function target() {
	for (let i = 0; i < 50; i++) {
		try {
			const list = await (await fetch(`http://127.0.0.1:${DEBUG}/json/list`)).json();
			const page = list.find(t => t.type === 'page');
			if (page) return page.webSocketDebuggerUrl;
		} catch (e) { /* not up yet */ }
		await sleep(200);
	}
	throw new Error('Chrome did not start');
}

const ws = new WebSocket(await target());
await new Promise(r => ws.addEventListener('open', r, { once: true }));
let id = 0;
const pending = new Map();
ws.addEventListener('message', ev => {
	const m = JSON.parse(ev.data);
	if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
});
const send = (method, params = {}) => new Promise((resolve, reject) => {
	const n = ++id;
	pending.set(n, m => (m.error ? reject(new Error(method + ': ' + m.error.message)) : resolve(m.result)));
	ws.send(JSON.stringify({ id: n, method, params }));
});

await send('Page.enable');
await sleep(800);
for (const s of SHOTS) {
	await send('Emulation.setDeviceMetricsOverride', { width: s.w, height: s.h, deviceScaleFactor: s.scale, mobile: !!s.mobile });
	await send('Emulation.setEmulatedMedia', { features: [ { name: 'prefers-color-scheme', value: s.theme || 'light' } ] });
	const url = `http://127.0.0.1:${PORT}/${s.theme ? '?theme=' + s.theme : '?theme=light'}#/${s.page}`;
	await send('Page.navigate', { url: 'about:blank' });
	await sleep(200);
	await send('Page.navigate', { url });
	await sleep(2500);
	const shot = await send('Page.captureScreenshot', { format: 'png' });
	writeFileSync(join(OUT, s.name + '.png'), Buffer.from(shot.data, 'base64'));
	console.log('docs/img/' + s.name + '.png');
}
ws.close();
cleanup();
process.exit(0);
