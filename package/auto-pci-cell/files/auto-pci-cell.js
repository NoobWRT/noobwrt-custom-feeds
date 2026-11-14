'use strict';
'require view';
'require form';
'require poll';
'require rpc';
'require ui';
'require uci';

var callStatus = rpc.declare({ object: 'auto-pci-cell', method: 'status', expect: {} });
var callPorts = rpc.declare({ object: 'auto-pci-cell', method: 'ports', expect: { ports: [] } });
var callTest = rpc.declare({ object: 'auto-pci-cell', method: 'test_port', params: [ 'port' ], expect: {} });
var callClear = rpc.declare({ object: 'auto-pci-cell', method: 'clear_history', expect: {} });

var REPO = 'https://github.com/Perz3us/PCI-Cell-Lock';

var CSS = '\
.apc { --apc-ok:#16a34a; --apc-warn:#d97706; --apc-bad:#dc2626; --apc-info:#2563eb; --apc-line:rgba(127,127,127,.28); --apc-soft:rgba(127,127,127,.08); margin-bottom:1.5em; }\
.apc-head { display:flex; flex-wrap:wrap; align-items:center; gap:.75em; margin-bottom:1em; }\
.apc-head h2 { margin:0; padding:0; border:0; font-size:1.4em; }\
.apc-time { margin-left:auto; opacity:.65; font-size:.85em; }\
.apc-pill { display:inline-block; padding:.2em .7em; border-radius:999px; font-size:.82em; font-weight:600; color:#fff; background:#6b7280; white-space:nowrap; }\
.apc-pill.ok { background:var(--apc-ok); } .apc-pill.warn { background:var(--apc-warn); } .apc-pill.bad { background:var(--apc-bad); } .apc-pill.info { background:var(--apc-info); }\
.apc-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:.75em; margin-bottom:1em; }\
.apc-card { border:1px solid var(--apc-line); border-radius:10px; background:var(--apc-soft); padding:.9em 1em; min-width:0; }\
.apc-card h4 { margin:0 0 .5em; padding:0; border:0; background:none; font-size:.78em; font-weight:600; text-transform:uppercase; letter-spacing:.05em; opacity:.7; }\
.apc-big { font-size:1.45em; font-weight:700; line-height:1.25; font-variant-numeric:tabular-nums; }\
.apc-sub { margin-top:.3em; font-size:.88em; opacity:.8; font-variant-numeric:tabular-nums; }\
.apc-scroll { overflow-x:auto; border:1px solid var(--apc-line); border-radius:10px; margin-bottom:1em; }\
.apc table { width:100%; border-collapse:collapse; margin:0; }\
.apc th, .apc td { padding:.5em .75em; text-align:left; border-top:1px solid var(--apc-line); white-space:nowrap; }\
.apc tr:first-child th { border-top:0; }\
.apc th { font-size:.78em; text-transform:uppercase; letter-spacing:.04em; opacity:.7; }\
.apc tr.now td { font-weight:600; background:rgba(37,99,235,.1); }\
.apc-title { display:flex; align-items:center; justify-content:space-between; font-size:1em; font-weight:600; margin:1em 0 .5em; }\
.apc-foot { text-align:center; font-size:.85em; opacity:.7; margin:1.5em 0 .5em; }\
.apc-move { padding:0 .6em !important; min-width:0 !important; }\
.apc-empty { padding:.9em 1em; opacity:.7; }\
.apc-warn { border:1px solid var(--apc-warn); border-radius:10px; padding:.7em 1em; margin:0 0 1em; }\
.apc-note { font-size:.9em; opacity:.8; margin:0 0 1em; }\
';

var PHONE_CSS = '@keyframes apc-amber-pulse{0%,100%{opacity:1;transform:scale(1);box-shadow:0 0 0 0 rgba(234,179,8,0.55)}50%{opacity:0.35;transform:scale(0.86);box-shadow:0 0 0 4px rgba(234,179,8,0)}}@keyframes apc-rj11-rock{0%,100%{transform:rotate(0deg)}15%{transform:rotate(-3.4deg)}30%{transform:rotate(3.4deg)}45%{transform:rotate(-2.8deg)}60%{transform:rotate(2.8deg)}75%{transform:rotate(-1.5deg)}}@keyframes apc-rj11-wave-in{0%,100%{opacity:0.18}35%,65%{opacity:1}}@keyframes apc-rj11-wave-out{0%,20%,100%{opacity:0.1}55%,80%{opacity:0.95}}@keyframes apc-rj11-key-blink{0%,100%{fill:#8e96a0;r:3.3px}50%{fill:#eab308;r:4.1px}}.apc-rj11-widget{flex:0 0 auto;display:flex;flex-direction:column;align-items:center;justify-content:center;min-width:118px;user-select:none}.apc-rj11-svg{width:90px;height:62px;overflow:visible;display:block}.apc-rj11-phone{transform-origin:90px 85px}.apc-rj11-base{fill:#393e46;stroke:#8e96a0;stroke-width:2.6;stroke-linejoin:round}.apc-rj11-plunger{fill:#8e96a0;transition:transform 0.22s ease}.apc-rj11-key{fill:#8e96a0;transition:fill 0.15s ease}.apc-rj11-cord{fill:none;stroke:#8e96a0;stroke-width:2.6;stroke-dasharray:4 4.5;stroke-linecap:round}.apc-rj11-handset{transform-origin:90px 34px;transition:transform 0.24s cubic-bezier(0.34,1.56,0.64,1)}.apc-rj11-handset-path{fill:#57606a;stroke:#9ca3af;stroke-width:2.6;stroke-linejoin:round;transition:fill 0.2s ease,stroke 0.2s ease}.apc-rj11-wave{fill:none;stroke:#c58e11;stroke-width:3;stroke-linecap:round;opacity:0;transition:opacity 0.18s ease}.apc-rj11-widget.st-dialtone .apc-rj11-handset,.apc-rj11-widget.st-dialing .apc-rj11-handset,.apc-rj11-widget.st-calling .apc-rj11-handset,.apc-rj11-widget.st-connected .apc-rj11-handset{transform:translate(-3px,-11px) rotate(-11deg)}.apc-rj11-widget.st-dialtone .apc-rj11-handset-path,.apc-rj11-widget.st-dialing .apc-rj11-handset-path,.apc-rj11-widget.st-calling .apc-rj11-handset-path,.apc-rj11-widget.st-connected .apc-rj11-handset-path{fill:#c58e11;stroke:#cbd5e1}.apc-rj11-widget.st-dialtone .apc-rj11-plunger,.apc-rj11-widget.st-dialing .apc-rj11-plunger,.apc-rj11-widget.st-calling .apc-rj11-plunger,.apc-rj11-widget.st-connected .apc-rj11-plunger{transform:translateY(-2.5px)}.apc-rj11-widget.st-dialing .apc-rj11-key.k1{animation:apc-rj11-key-blink 1.2s infinite 0.0s}.apc-rj11-widget.st-dialing .apc-rj11-key.k5{animation:apc-rj11-key-blink 1.2s infinite 0.25s}.apc-rj11-widget.st-dialing .apc-rj11-key.k9{animation:apc-rj11-key-blink 1.2s infinite 0.5s}.apc-rj11-widget.st-dialing .apc-rj11-key.k3{animation:apc-rj11-key-blink 1.2s infinite 0.75s}.apc-rj11-widget.st-dialing .apc-rj11-key.k7{animation:apc-rj11-key-blink 1.2s infinite 1.0s}.apc-rj11-widget.st-ringing .apc-rj11-phone{animation:apc-rj11-rock 0.55s infinite ease-in-out}.apc-rj11-widget.st-ringing .apc-rj11-wave.w-inner{animation:apc-rj11-wave-in 0.9s infinite ease-in-out}.apc-rj11-widget.st-ringing .apc-rj11-wave.w-outer{animation:apc-rj11-wave-out 0.9s infinite ease-in-out}.apc-rj11-pill{margin-top:4px;display:inline-flex;align-items:center;gap:5px;padding:2px 9px;border-radius:999px;background:rgba(127,127,127,0.12);border:1px solid rgba(127,127,127,0.24);font-size:0.74em;font-weight:600;line-height:1.32;white-space:nowrap}.apc-rj11-dot{width:6.5px;height:6.5px;border-radius:50%;background:#22c55e;flex-shrink:0}.apc-rj11-widget.st-off .apc-rj11-dot{background:#6b7280}.apc-rj11-widget.st-dialtone .apc-rj11-dot,.apc-rj11-widget.st-dialing .apc-rj11-dot,.apc-rj11-widget.st-calling .apc-rj11-dot,.apc-rj11-widget.st-ringing .apc-rj11-dot,.apc-rj11-widget.st-connected .apc-rj11-dot{background:#eab308;animation:apc-amber-pulse 1.15s infinite ease-in-out}.apc-rj11-peer{margin-top:2px;font-size:0.73em;font-weight:600;font-variant-numeric:tabular-nums;font-family:monospace;opacity:0.86;line-height:1.2;max-width:124px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
	'.apc-card-phone { display:flex; align-items:center; justify-content:space-between; gap:12px; }' +
	'.apc-card-phone > div:first-child { min-width:0; }';

var CORD_ONHOOK = 'M 42 50 C 20 66, 20 94, 37 108';
var CORD_OFFHOOK = 'M 38 36 C 17 58, 19 92, 37 108';

var PHONE_LOOK = [
	[ /ring|incoming/, 'st-ringing', _('Ringing') ],
	[ /calling|outgoing|alerting|ringback|progress/, 'st-calling', _('Calling') ],
	[ /dial(ing)?$|digits|dtmf/, 'st-dialing', _('Dialing') ],
	[ /connected|in_?call|talking|answered|sipcall/, 'st-connected', _('In call') ],
	[ /hold|held/, 'st-dialtone', _('On hold') ],
	[ /^idle$/, 'st-idle', _('Idle (on hook)') ],
	[ /^(none|unknown|)$/, 'st-off', _('No phone') ],
	[ /./, 'st-dialtone', _('Off hook') ]
];

function phoneBadge(phone) {
	var p = String(phone || '').toLowerCase(), i, look, keys = [], k = 1, cord, svg;

	for (i = 0; i < PHONE_LOOK.length; i++)
		if (PHONE_LOOK[i][0].test(p)) { look = PHONE_LOOK[i]; break; }

	[ 68, 79, 90, 101 ].forEach(function(y) {
		[ 76, 90, 104 ].forEach(function(x) {
			keys.push('<circle class="apc-rj11-key k' + (k++) + '" cx="' + x + '" cy="' + y + '" r="3.3"/>');
		});
	});
	cord = /st-(dialtone|dialing|calling|connected)/.test(look[1]) ? CORD_OFFHOOK : CORD_ONHOOK;

	svg = E('div', {});
	svg.innerHTML = '<svg class="apc-rj11-svg" viewBox="0 0 180 124" aria-hidden="true">' +
		'<path class="apc-rj11-wave w-inner" d="M 25 46 A 20 20 0 0 1 28 19"/>' +
		'<path class="apc-rj11-wave w-outer" d="M 17 50 A 28 28 0 0 1 21 12"/>' +
		'<path class="apc-rj11-wave w-inner" d="M 155 46 A 20 20 0 0 0 152 19"/>' +
		'<path class="apc-rj11-wave w-outer" d="M 163 50 A 28 28 0 0 0 159 12"/>' +
		'<g class="apc-rj11-phone">' +
		'<path class="apc-rj11-cord" d="' + cord + '"/>' +
		'<rect class="apc-rj11-plunger" x="48" y="45" width="11" height="7" rx="2"/>' +
		'<rect class="apc-rj11-plunger" x="121" y="45" width="11" height="7" rx="2"/>' +
		'<path class="apc-rj11-base" d="M 57 50 L 123 50 C 133 50, 139 55, 141 64 L 150 107 C 151 113, 147 117, 140 117 L 40 117 C 33 117, 29 113, 30 107 L 39 64 C 41 55, 47 50, 57 50 Z"/>' +
		keys.join('') +
		'<g class="apc-rj11-handset">' +
		'<path class="apc-rj11-handset-path" d="M 34 34 C 34 22, 43 18, 58 18 L 122 18 C 137 18, 146 22, 146 34 L 146 43 C 146 47, 142 49, 135 49 L 119 49 C 113 49, 111 46, 111 40 L 111 33 L 69 33 L 69 40 C 69 46, 67 49, 61 49 L 45 49 C 38 49, 34 47, 34 43 Z"/>' +
		'</g>' +
		'</g>' +
		'</svg>';

	return E('div', { 'class': 'apc-rj11-widget ' + look[1] }, [
		svg.firstChild,
		E('div', { 'class': 'apc-rj11-pill' }, [ E('span', { 'class': 'apc-rj11-dot' }), E('span', {}, look[2]) ])
	]);
}

var PORT_NAMES = { mm: 'ModemManager', '5gmodem': _('5G Modem app') };

var STATES = {
	starting: [ _('Starting'), '' ],
	off: [ _('Off'), '' ],
	no_cells: [ _('No cells set'), 'warn' ],
	no_list: [ _('No list active'), 'warn' ],
	other_lock: [ _('Paused, firmware PCI lock is on'), 'warn' ],
	list_change: [ _('Changing list'), 'warn' ],
	no_modem: [ _('Modem not found'), 'bad' ],
	no_answer: [ _('Modem not answering'), 'bad' ],
	locked: [ _('Locked'), 'ok' ],
	switching: [ _('Switching'), 'warn' ],
	signal_lost: [ _('Signal lost'), 'warn' ],
	wrong_cell: [ _('On another cell'), 'warn' ],
	recovery: [ _('Lock open, all cells lost'), 'bad' ]
};

var CELL_STATES = {
	active: [ _('Active'), 'ok' ],
	available: [ _('Available'), 'info' ],
	unavailable: [ _('Unavailable'), 'warn' ],
	unknown: [ _('Unknown'), '' ]
};

var REASONS = {
	cell_lost: _('Cell lost'),
	higher_returned: _('Better cell returned'),
	probe: _('Tried better cell'),
	all_cells_lost: _('All cells lost'),
	cell_returned: _('Cell returned'),
	lock_lost: _('Lock was changed')
};

var PROTECT = {
	phone: _('Phone in use'),
	sip: _('SIP call'),
	call: _('SIM call'),
	sms: _('SMS'),
	unknown: _('Cannot read call state')
};

function pill(label, kind) {
	return E('span', { 'class': 'apc-pill ' + (kind || '') }, label);
}

function card(title, big, sub) {
	return E('div', { 'class': 'apc-card' }, [
		E('h4', {}, title),
		E('div', { 'class': 'apc-big' }, big),
		E('div', { 'class': 'apc-sub' }, sub || ' ')
	]);
}

function table(heads, rows, id) {
	return E('div', { 'class': 'apc-scroll', 'id': id || null }, E('table', {}, [
		E('tr', {}, heads.map(function(h) { return E('th', {}, h); }))
	].concat(rows)));
}

function renderHead(s) {
	var st = !s.running ? [ _('Service stopped'), 'bad' ] : (STATES[s.state] || [ s.state || '-', '' ]);
	var on = s.enabled == '1';

	return E('div', { 'class': 'apc-head' }, [
		E('h2', {}, _('Auto Pci Cell')),
		pill(on ? _('ON') : _('OFF'), on ? 'ok' : ''),
		pill(st[0], st[1]),
		E('span', { 'class': 'apc-time' }, s.updated ? _('Updated') + ' ' + new Date(s.updated * 1000).toLocaleTimeString() : '')
	]);
}

function renderCards(s) {
	var isLte = s.serving == 'lte';
	var prio = +s.priority;
	var cell = isLte ? s.pci + ' / ' + s.earfcn : (s.serving == 'other' ? _('Not on 4G') : (s.serving == 'none' ? _('No service') : '-'));
	var protect = PROTECT[s.protect];
	var pending = +s.pending;
	var phone = s.phone == 'none' || !s.phone ? _('Not installed or off') : s.phone;

	return E('div', { 'class': 'apc-grid' }, [
		card(_('Current cell (PCI / EARFCN)'), cell, isLte ? (s.list && s.list != 'main' && s.list != 'none' ? (s.list_name || _('Timed list')) + ', ' : '') + (prio > 0 ? _('Priority') + ' ' + prio : _('Not on the list')) + (s.band ? ', ' + _('band') + ' ' + s.band : '') : ''),
		card(_('Signal'), isLte && s.rsrp ? s.rsrp + ' dBm' : '-', isLte ? 'RSRQ ' + s.rsrq + ' dB, SINR ' + s.sinr + ' dB, RSSI ' + s.rssi + ' dBm' : ''),
		E('div', { 'class': 'apc-card apc-card-phone' }, [
			E('div', {}, [
				E('h4', {}, _('Switching')),
				E('div', { 'class': 'apc-big' }, protect ? _('Paused') : _('Allowed')),
				E('div', { 'class': 'apc-sub' }, protect ? protect : (pending > 0 ? _('Waiting to go to priority') + ' ' + pending : _('Phone') + ': ' + phone))
			]),
			phoneBadge(s.phone)
		]),
		card(_('AT port'), PORT_NAMES[s.port] || s.port || '-', (s.port_mode == 'manual' ? _('Manual') : _('Auto')) + (PORT_NAMES[s.port] ? '' : ', at-daemon ' + (s.atd ? _('running') : _('not running'))))
	]);
}

function renderCells(s) {
	var rows = (s.cells || []).map(function(c, i) {
		var st = CELL_STATES[c.state] || [ c.state, '' ];

		return E('tr', { 'class': c.state == 'active' ? 'now' : '' }, [
			E('td', {}, String(i + 1)), E('td', {}, c.pci), E('td', {}, c.earfcn), E('td', {}, pill(st[0], st[1]))
		]);
	});

	if (!rows.length)
		return E('div', { 'class': 'apc-scroll' }, E('div', { 'class': 'apc-empty' }, _('No cells yet. Add them below.')));
	return table([ _('Priority'), 'PCI', 'EARFCN', _('Status') ], rows);
}

function renderHistory(s) {
	var rows = (s.history || []).slice().reverse().map(function(h) {
		return E('tr', {}, [
			E('td', {}, new Date(h.time * 1000).toLocaleString()),
			E('td', {}, h.from),
			E('td', {}, h.to),
			E('td', {}, REASONS[h.reason] || h.reason),
			E('td', {}, h.secs + ' s'),
			E('td', {}, pill(h.result == 'ok' ? _('Done') : _('Failed'), h.result == 'ok' ? 'ok' : 'warn'))
		]);
	});

	if (!rows.length)
		return E('div', { 'class': 'apc-scroll', 'id': 'apc-hist' }, E('div', { 'class': 'apc-empty' }, _('No switches since the last restart.')));
	return table([ _('Time'), _('From'), _('To'), _('Reason'), _('Took'), _('Result') ], rows, 'apc-hist');
}

function clearHistory(ev) {
	ev.target.disabled = true;
	return callClear().then(function() {
		var t = document.getElementById('apc-hist');
		if (t)
			t.replaceWith(renderHistory({}));
	}).catch(function(e) {
		ui.addNotification(null, E('p', {}, _('Could not clear the list') + ': ' + e.message), 'warning');
	}).finally(function() {
		ev.target.disabled = false;
	});
}

function renderAll(s) {
	return [
		renderHead(s),
		E('p', { 'class': 'apc-warn', 'style': s.state == 'other_lock' ? '' : 'display:none' }, _('The firmware has its own PCI lock turned on. Auto Pci Cell changes nothing until that lock is turned off, because the two would fight.')),
		renderCards(s),
		E('div', { 'class': 'apc-title' }, _('Cells')),
		renderCells(s),
		E('div', { 'class': 'apc-title' }, [
			E('span', {}, _('Recent switches')),
			(s.history || []).length ? E('button', { 'class': 'btn cbi-button', 'click': clearHistory }, _('Clear')) : ''
		]),
		renderHistory(s)
	];
}

return view.extend({
	load: function() {
		return Promise.all([
			L.resolveDefault(callStatus(), {}),
			L.resolveDefault(callPorts(), []),
			uci.load('auto-pci-cell')
		]);
	},

	render: function(data) {
		var box = E('div', { 'class': 'apc' }, renderAll(data[0]));
		var ports = data[1];
		var m, s, o;

		m = new form.Map('auto-pci-cell', null,
			_('Keeps the modem on your best 4G cell. Only 4G locks are changed, never 5G locks, bands or network mode. Every switch drops the internet for a short time.'));

		s = m.section(form.NamedSection, 'main', 'settings', _('Settings'));
		s.tab('general', _('General'));
		s.tab('timing', _('Timing'));

		o = s.taboption('general', form.Flag, 'enabled', _('Turn on'),
			_('When off, the app changes nothing and only shows status.'));
		o.rmempty = false;

		o = s.taboption('general', form.ListValue, 'off_action', _('When turned off'));
		o.value('restore', _('Put back the lock from before the app started'));
		o.value('keep', _('Keep the current lock'));
		o.value('clear', _('Remove the 4G lock'));

		o = s.taboption('general', form.ListValue, 'at_port_mode', _('AT port'));
		o.value('auto', _('Automatic'));
		o.value('manual', _('Manual'));

		o = s.taboption('general', form.ListValue, 'manual_at_port', _('Manual port'));
		ports.forEach(function(p) { o.value(p, PORT_NAMES[p] || p); });
		if (!ports.length)
			o.value('/dev/ttyUSB2');
		o.depends('at_port_mode', 'manual');

		o = s.taboption('general', form.Button, '_test', _('Test the port'),
			_('Only reads from the modem. It does not change the lock.'));
		o.inputtitle = _('Test');
		o.onclick = function(ev, sid) {
			var mode = this.section.getUIElement(sid, 'at_port_mode');
			var man = this.section.getUIElement(sid, 'manual_at_port');
			var port = (mode && mode.getValue() == 'manual' && man) ? man.getValue() : (box.dataset.port || '/dev/ttyUSB2');

			return callTest(port).then(function(r) {
				if (r.ok)
					ui.addNotification(null, E('p', {}, port + ': ' + _('works') + (r.model ? ', ' + r.model : '') + (r.lock ? ', ' + _('4G lock') + ' ' + r.lock : '')), 'info');
				else
					ui.addNotification(null, E('p', {}, port + ': ' + (r.error || _('no answer'))), 'warning');
			});
		};

		function num(tab, name, title, desc, lo, hi, def) {
			var v = s.taboption(tab, form.Value, name, title, desc);

			v.datatype = 'range(' + lo + ',' + hi + ')';
			v.placeholder = String(def);
			v.rmempty = true;
			return v;
		}

		num('timing', 'interval', _('Check every (s)'), null, 1, 60, 3);
		num('timing', 'lost_secs', _('Signal gone for (s) before moving'), null, 3, 300, 10);
		o = s.taboption('timing', form.Value, 'min_rsrp', _('Treat as lost below RSRP (dBm)'));
		o.datatype = 'range(-140,-44)';
		o.placeholder = '-125';
		num('timing', 'verify_timeout', _('Wait for a new cell (s)'), null, 5, 120, 20);
		num('timing', 'retry_delay', _('Wait before retrying a failed cell (s)'), _('Doubles after each failure, up to 15 minutes.'), 10, 900, 60);
		num('timing', 'neighbour_interval', _('Read neighbour list every (s)'), null, 5, 600, 15);
		o = s.taboption('timing', form.Flag, 'probe', _('Try better cells'),
			_('Locks a better cell to see if it works, on top of watching the neighbour list. Each failed try drops the internet until the modem is back on the current cell.'));
		o.default = '1';
		num('timing', 'probe_interval', _('Try a better cell every (s)'), null, 60, 3600, 300).depends('probe', '1');
		num('timing', 'probe_timeout', _('Time allowed for each try (s)'), null, 5, 120, 12).depends('probe', '1');
		o = s.taboption('timing', form.Flag, 'probe_schedule', _('Only try at set times'),
			_('Outside these times the app does not try better cells, so the internet is not interrupted. Moving away from a lost cell and moving back through the neighbour list still work at any time.'));
		o.depends('probe', '1');
		o = s.taboption('timing', form.Value, 'probe_from', _('Start trying at'));
		o.placeholder = '01:00';
		o.depends('probe_schedule', '1');
		o.validate = hhmm;
		o = s.taboption('timing', form.Value, 'probe_to', _('Stop trying at'));
		o.placeholder = '06:00';
		o.depends('probe_schedule', '1');
		o.validate = hhmm;
		num('timing', 'call_grace', _('Wait after a call ends (s)'), null, 0, 120, 5);
		num('timing', 'sms_hold', _('Wait after a new SMS (s)'), null, 0, 120, 20);

		s = m.section(form.NamedSection, 'main', 'settings', _('Main list switch'));
		o = s.option(form.Flag, 'main_list', _('Use the main priority list'),
			_('Used whenever no timed list covers the current time. When off and no timed list is active, the app leaves the lock as it is.'));
		o.default = '1';
		o.rmempty = false;

		s = m.section(form.GridSection, 'cell', _('Main priority list'),
			_('Top row is the first choice. Use the arrows or drag rows to change the order. Up to 5 cells. The lock is removed only when every cell on the list has failed.'));
		s.anonymous = true;
		s.addremove = true;
		s.sortable = true;
		s.nodescriptions = true;
		s.renderRowActions = function(section_id) {
			var td = form.GridSection.prototype.renderRowActions.call(this, section_id);
			var div = td.querySelector('div') || td;
			var list = this.cfgsections(), i = list.indexOf(section_id), self = this;
			var move = function(d) {
				return function() {
					uci.move('auto-pci-cell', section_id, list[i + d], d > 0);
					return self.map.save(null, true);
				};
			};

			div.insertBefore(E('button', { 'class': 'btn cbi-button apc-move', 'title': _('Move up'), 'disabled': i == 0 ? '' : null, 'click': ui.createHandlerFn(this, move(-1)) }, '\u25b2'), div.firstChild);
			div.insertBefore(E('button', { 'class': 'btn cbi-button apc-move', 'title': _('Move down'), 'disabled': i == list.length - 1 ? '' : null, 'click': ui.createHandlerFn(this, move(1)) }, '\u25bc'), div.children[1]);
			return td;
		};
		s.handleAdd = function(ev) {
			if (this.cfgsections().length >= 5) {
				ui.addNotification(null, E('p', {}, _('The list can hold 5 cells.')), 'warning');
				return Promise.resolve();
			}
			return form.GridSection.prototype.handleAdd.apply(this, arguments);
		};

		o = s.option(form.Flag, 'enabled', _('Use'));
		o.default = '1';
		o.editable = true;
		o.rmempty = false;

		function pair(section_id, name, value) {
			var sec = this.section, list = sec.cfgsections(), i, a, b;
			var pci = name == 'pci' ? value : sec.formvalue(section_id, 'pci');
			var ear = name == 'earfcn' ? value : sec.formvalue(section_id, 'earfcn');

			for (i = 0; i < list.length; i++) {
				if (list[i] == section_id)
					continue;
				a = sec.formvalue(list[i], 'pci') || uci.get('auto-pci-cell', list[i], 'pci');
				b = sec.formvalue(list[i], 'earfcn') || uci.get('auto-pci-cell', list[i], 'earfcn');
				if (a == pci && b == ear)
					return _('This cell is already on the list');
			}
			return true;
		}

		o = s.option(form.Value, 'pci', 'PCI');
		o.datatype = 'range(0,503)';
		o.rmempty = false;
		o.modalonly = false;
		o.editable = true;
		o.validate = function(id, v) { return pair.call(this, id, 'pci', v); };

		o = s.option(form.Value, 'earfcn', 'EARFCN');
		o.datatype = 'range(0,262143)';
		o.rmempty = false;
		o.modalonly = false;
		o.editable = true;
		o.validate = function(id, v) { return pair.call(this, id, 'earfcn', v); };

		s = m.section(form.TypedSection, 'schedule', _('Timed priority lists'),
			_('Each list applies between its start and end time, using the router clock. If two overlap, the higher one wins. Outside these times the main list is used. Going to a new list waits for calls and SMS to finish.'));
		s.anonymous = true;
		s.addremove = true;

		o = s.option(form.Flag, 'enabled', _('Use this list'));
		o.default = '1';
		o.rmempty = false;
		o = s.option(form.Value, 'name', _('Name'));
		o.placeholder = _('Night');
		o.datatype = 'maxlength(24)';
		function hhmm(id, v) {
			return /^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(v || '') ? true : _('Use 24 hour time, like 18:30');
		}
		o = s.option(form.Value, 'from', _('Start time'));
		o.placeholder = '18:00';
		o.rmempty = false;
		o.validate = hhmm;
		o = s.option(form.Value, 'to', _('End time'));
		o.placeholder = '08:00';
		o.rmempty = false;
		o.validate = hhmm;
		o = s.option(form.DynamicList, 'cell', _('Cells, first choice on top'),
			_('Write each as PCI,EARFCN, like 175,400. Up to 5.'));
		o.placeholder = '175,400';
		o.validate = function(id, v) {
			var r = /^([0-9]{1,3}),([0-9]{1,6})$/.exec(v || '');
			if (!v)
				return true;
			if (!r || +r[1] > 503 || +r[2] > 262143)
				return _('Write it as PCI,EARFCN, like 175,400');
			return true;
		};

		poll.add(function() {
			return L.resolveDefault(callStatus(), {}).then(function(st) {
				box.dataset.port = st.port || '';
				while (box.firstChild)
					box.removeChild(box.firstChild);
				renderAll(st).forEach(function(n) { box.appendChild(n); });
			});
		}, 5);

		box.dataset.port = data[0].port || '';

		return m.render().then(function(node) {
			return E('div', {}, [ E('style', {}, CSS + PHONE_CSS), box, node,
				E('div', { 'class': 'apc-foot' }, E('a', { 'href': REPO, 'target': '_blank', 'rel': 'noopener' }, 'PCI Cell Lock on GitHub')) ]);
		});
	}
});
