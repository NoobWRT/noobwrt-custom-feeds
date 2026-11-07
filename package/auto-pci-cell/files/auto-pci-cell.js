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
.apc-title { font-size:1em; font-weight:600; margin:1em 0 .5em; }\
.apc-empty { padding:.9em 1em; opacity:.7; }\
.apc-warn { border:1px solid var(--apc-warn); border-radius:10px; padding:.7em 1em; margin:0 0 1em; }\
.apc-note { font-size:.9em; opacity:.8; margin:0 0 1em; }\
';

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

function table(heads, rows) {
	return E('div', { 'class': 'apc-scroll' }, E('table', {}, [
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
		card(_('Switching'), protect ? _('Paused') : _('Allowed'), protect ? protect : (pending > 0 ? _('Waiting to go to priority') + ' ' + pending : _('Phone') + ': ' + phone)),
		card(_('AT port'), s.port || '-', (s.port_mode == 'manual' ? _('Manual') : _('Auto')) + ', at-daemon ' + (s.atd ? _('running') : _('not running')))
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
		return E('div', { 'class': 'apc-scroll' }, E('div', { 'class': 'apc-empty' }, _('No switches since the last restart.')));
	return table([ _('Time'), _('From'), _('To'), _('Reason'), _('Took'), _('Result') ], rows);
}

function renderAll(s) {
	return [
		renderHead(s),
		E('p', { 'class': 'apc-warn', 'style': s.state == 'other_lock' ? '' : 'display:none' }, _('The firmware has its own PCI lock turned on. Auto Pci Cell changes nothing until that lock is turned off, because the two would fight.')),
		renderCards(s),
		E('div', { 'class': 'apc-title' }, _('Cells')),
		renderCells(s),
		E('div', { 'class': 'apc-title' }, _('Recent switches')),
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
		ports.forEach(function(p) { o.value(p); });
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
			_('Top row is the first choice. Drag rows to change the order. Up to 5 cells. The lock is removed only when every cell on the list has failed.'));
		s.anonymous = true;
		s.addremove = true;
		s.sortable = true;
		s.nodescriptions = true;
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
			return E('div', {}, [ E('style', {}, CSS), box, node ]);
		});
	}
});
