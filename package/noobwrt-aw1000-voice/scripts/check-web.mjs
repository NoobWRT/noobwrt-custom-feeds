#!/usr/bin/env node
// SPDX-License-Identifier: GPL-2.0-only
// Checks for the management interface, run by CI and before a release:
//   - every JS module parses,
//   - every module is in the index.html import map (else browsers may serve a
//     stale copy after an update) and every map entry exists,
//   - every page in the navigation has a module,
//   - the JSON files (ACLs, menu, manifest) parse.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const WEB = join(ROOT, 'openwrt', 'aw1000-voice-web', 'files');
const WWW = join(WEB, 'www');
let failed = 0;
const fail = msg => { console.error('FAIL ' + msg); failed++; };

const walk = dir => readdirSync(dir).flatMap(n => {
	const p = join(dir, n);
	return statSync(p).isDirectory() ? walk(p) : [ p ];
});

const modules = walk(join(WWW, 'js')).filter(p => p.endsWith('.js'));
for (const m of modules) {
	const r = spawnSync(process.execPath, [ '--check', '--input-type=module' ], { input: readFileSync(m) });
	if (r.status !== 0) fail(relative(ROOT, m) + ': ' + r.stderr.toString().trim().split('\n').slice(0, 4).join(' '));
}

const html = readFileSync(join(WWW, 'index.html'), 'utf8');
const mapText = (html.match(/<script type="importmap">([\s\S]*?)<\/script>/) || [])[1];
let map = {};
try { map = JSON.parse(mapText).imports; } catch (e) { fail('index.html import map does not parse: ' + e.message); }
for (const m of modules) {
	const url = '/' + relative(WWW, m).replace(/\\/g, '/');
	if (!map[url]) fail('module missing from the import map: ' + url);
	else if (map[url] !== url + '?v=@VERSION@') fail('import map entry not versioned: ' + url);
}
for (const url of Object.keys(map))
	if (!modules.some(m => '/' + relative(WWW, m).replace(/\\/g, '/') === url)) fail('import map entry without a file: ' + url);

const app = readFileSync(join(WWW, 'js', 'app.js'), 'utf8');
for (const [, id] of app.matchAll(/\{ id: '([a-z]+)', title: /g))
	if (!modules.some(m => m.endsWith(join('pages', id + '.js')))) fail('navigation page without a module: ' + id);

for (const f of [ join(WEB, 'acl.json'), join(WWW, 'manifest.webmanifest'),
	join(ROOT, 'openwrt', 'luci-app-aw1000-voice', 'files', 'acl.json'),
	join(ROOT, 'openwrt', 'luci-app-aw1000-voice', 'files', 'menu.json') ]) {
	try { JSON.parse(readFileSync(f, 'utf8')); } catch (e) { fail(relative(ROOT, f) + ': ' + e.message); }
}

console.log(failed ? failed + ' problem(s)' : 'web checks passed (' + modules.length + ' modules)');
process.exit(failed ? 1 : 0);
