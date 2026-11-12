// SPDX-License-Identifier: GPL-2.0-only
// Copyright (C) 2026 perz3us (call log format and parser, from luci-app-fxs)
//
// /etc/fxs/calls.log is one event per line: "<unix time> <event> <number or text>".
// parse() folds the events into calls, newest first.

export const STATUS_TEXT = {
	answered: 'Answered',
	missed: 'Missed',
	elsewhere: 'Answered on SIP',
	blocked: 'Blocked',
	barred: 'Not allowed',
	failed: 'Failed',
	cancelled: 'Not answered',
	active: 'In progress'
};

export function statusOf(c) {
	if (c.via && c.status === 'elsewhere')
		return 'Answered on ' + c.via;
	if (c.via && c.sip && c.status !== 'active')
		return 'Called from ' + c.via;
	return STATUS_TEXT[c.status] || c.status;
}

export function reasonText(r, repeatMin = 3) {
	const p = (r || '').split(' '), how = p.shift(), why = p.join(' ');
	let name = why.replace(/^(quiet|holiday):/, '');

	if (how === 'rang')
		return why === 'important' ? 'Rang, important contact' :
			why === 'allowed' ? 'Rang, on the Always ring list' :
			why === 'repeat' ? 'Rang, called again within ' + repeatMin + ' minutes' : '';
	if (why === 'never')
		return 'Not rung, contact set to Never ring';
	if (why === 'quick')
		return how === 'busy' ? 'Turned away, quiet was on' : 'Silenced, quiet was on';
	if (!name)
		name = /^holiday:/.test(why) ? 'a holiday' : 'a window';
	if (how === 'busy')
		return 'Turned away by ' + name;
	if (how === 'once')
		return 'One ring only, ' + name;
	return 'Silenced by ' + name;
}

export function parse(text, live) {
	const calls = [], open = {};
	let reason = null;

	const close = (c, t, status) => {
		c.end = t;
		c.status = status || (c.connected ? 'answered' : (c.dir === 'in' ? 'missed' : 'cancelled'));
		delete open[c.number];
	};
	const closeAll = t => Object.keys(open).forEach(k => close(open[k], t));
	const start = (t, num, dir) => {
		const c = { start: t, number: num, dir, connected: null, end: null, status: null, lines: [] };
		if (open[num])
			close(open[num], null);
		calls.push(c);
		open[num] = c;
		return c;
	};

	for (const line of (text || '').split('\n')) {
		const m = line.match(/^(\d+) (\S+) ?(.*)$/);
		if (!m)
			continue;
		const t = +m[1], ev = m[2], num = m[3].trim();
		let c = open[num], target = c;

		switch (ev) {
		case 'dial':
			closeAll(null);
			target = start(t, num, 'out');
			break;
		case 'incoming':
			closeAll(null);
			target = start(t, num, 'in');
			break;
		case 'waiting':
			target = start(t, num, 'in');
			break;
		case 'sipout':
			closeAll(null);
			target = start(t, num, 'out');
			target.connected = t;
			target.sip = true;
			break;
		case 'via':
			if (calls.length)
				calls[calls.length - 1].via = num;
			continue;
		case 'reason':
			reason = { text: num, line };
			continue;
		case 'blocked':
			target = { start: t, number: num, dir: 'in', connected: null, end: t, status: 'blocked', lines: [] };
			calls.push(target);
			break;
		case 'barred':
			target = { start: t, number: num, dir: 'out', connected: null, end: t, status: 'barred', lines: [] };
			calls.push(target);
			break;
		case 'connected':
		case 'answered':
		case 'switched':
		case 'retrieved':
			if (!c)
				c = target = start(t, num, ev === 'connected' ? 'out' : 'in');
			if (!c.connected)
				c.connected = t;
			break;
		case 'failed':
		case 'missed':
		case 'elsewhere':
			if (c)
				close(c, t, ev);
			break;
		case 'hangup':
			if (c)
				close(c, t);
			break;
		case 'ended':
			if (c)
				close(c, t);
			closeAll(t);
			break;
		case 'recorded':
			target = calls.length ? calls[calls.length - 1] : null;
			if (target)
				target.rec = num;
			break;
		}

		if (target && reason && (ev === 'incoming' || ev === 'waiting')) {
			target.reason = reason.text;
			target.lines.push(reason.line);
		}
		if (ev === 'incoming' || ev === 'waiting')
			reason = null;
		if (target)
			target.lines.push(line);
	}

	for (const k of Object.keys(open)) {
		if (live)
			open[k].status = 'active';
		else
			close(open[k], null);
	}
	return calls.reverse();
}

export function duration(c) {
	if (!c.connected || !c.end || c.end < c.connected)
		return null;
	return c.end - c.connected;
}

export const isMissed = c => c.dir === 'in' && c.status === 'missed';

// Last 9 digits, so 0771234567 and +94771234567 match.
export const digits = n => (n || '').replace(/[^0-9]/g, '').slice(-9);

// Names from the phonebook, speed dial and blocked lists.
export function nameBook(fxs) {
	const map = {};
	for (const s of Object.values(fxs || {})) {
		if (![ 'contact', 'speed', 'block' ].includes(s['.type']) || !s.number || !s.name)
			continue;
		const d = digits(s.number);
		if (d && (!map[d] || s['.type'] === 'contact'))
			map[d] = s.name;
	}
	return n => map[digits(n)] || '';
}
