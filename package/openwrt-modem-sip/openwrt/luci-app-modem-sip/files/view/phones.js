'use strict';
'require view';
'require rpc';
'require poll';
'require ui';
'require dom';
'require uqr';

var callStatus = rpc.declare({ object: 'modem-sip', method: 'status' });
var callAdd = rpc.declare({ object: 'modem-sip', method: 'phone_add', params: [ 'name' ] });
var callRemove = rpc.declare({ object: 'modem-sip', method: 'phone_remove', params: [ 'name' ] });
var callLogin = rpc.declare({ object: 'modem-sip', method: 'phone_login', params: [ 'name' ] });
var callPassword = rpc.declare({ object: 'modem-sip', method: 'phone_password', params: [ 'name', 'password' ] });
var callRename = rpc.declare({ object: 'modem-sip', method: 'phone_rename', params: [ 'name', 'new' ] });
var callServices = rpc.declare({ object: 'fxs', method: 'sip_services' });
var callSet = rpc.declare({ object: 'fxs', method: 'set_sip', params: [ 'enabled', 'name' ] });
var callQr = rpc.declare({ object: 'fxs', method: 'sip_qr', params: [ 'phone' ] });

var ME = 'modem-sip';

var errorText = {
	busy: _('The phone is in use. Try again when it is idle.'),
	'not-installed': _('Modem SIP is not set up on the phone port. Reinstall modem-sip.'),
	password: _('Use 8 to 31 letters, digits or - _ . ! @ # % + = : ,')
};

function plain(s) {
	return document.createTextNode(s == null ? '' : String(s));
}

function note(box, text) {
	dom.content(box, E('p', { 'style': 'color: #c33' }, text));
}

function cell(a, b) {
	return E('tr', { 'class': 'tr' }, [ E('td', { 'class': 'td left' }, a), E('td', { 'class': 'td left' }, b) ]);
}

function isOn(svc) {
	return !!(svc && svc.enabled && svc.current == ME);
}

function otherService(svc) {
	var s;

	if (!svc || !svc.current || svc.current == ME)
		return null;
	s = (svc.services || []).filter(function(x) { return x.name == svc.current; })[0];
	return s && s.status != 'not-installed' ? s : null;
}

return view.extend({
	load: function() {
		return Promise.all([ L.resolveDefault(callStatus(), {}), L.resolveDefault(callServices(), null) ]);
	},

	say: function(text, bad) {
		dom.content(this.msg, E('p', { 'style': bad ? 'color: #c33' : '' }, plain(text)));
		window.clearTimeout(this.msgTimer);
		this.msgTimer = window.setTimeout(L.bind(function() { dom.content(this.msg, ''); }, this), 4000);
	},

	redraw: function() {
		return this.load().then(L.bind(function(data) {
			dom.content(this.root, this.body(data));
		}, this));
	},

	turnOn: function() {
		var other = otherService(this.svc);

		if (other && !confirm(_('The phone port uses %s for SIP now. Switch it to Modem SIP?').format(other.title || other.name)))
			return;
		return callSet(true, ME).then(L.bind(function(r) {
			if (!r || !r.result) {
				this.say(errorText[r && r.error] || _('Could not turn on Modem SIP.'), true);
				return;
			}
			return this.redraw();
		}, this));
	},

	turnOff: function() {
		if (!confirm(_('Turn off Modem SIP? SIP phones stop ringing and cannot make calls. The RJ11 phone keeps working.')))
			return;
		return callSet(false, ME).then(L.bind(function(r) {
			if (!r || !r.result) {
				this.say(errorText[r && r.error] || _('Could not turn off Modem SIP.'), true);
				return;
			}
			return this.redraw();
		}, this));
	},

	qrImage: function(url) {
		var svg = new DOMParser().parseFromString(uqr.renderSVG(url), 'image/svg+xml').documentElement,
		    size = svg.getAttribute('width');

		svg.setAttribute('viewBox', '0 0 ' + size + ' ' + size);
		svg.setAttribute('shape-rendering', 'crispEdges');
		svg.setAttribute('width', '100%');
		svg.setAttribute('height', '100%');
		return svg;
	},

	closeQr: function() {
		window.clearInterval(this.qrTimer);
		ui.hideModal();
	},

	showQr: function(phone) {
		var wasOnline = ((this.lastPhones || []).filter(function(x) { return x.name == phone; })[0] || {}).online;

		return callQr(phone).then(L.bind(function(r) {
			var end, frame, clock, again, tick;

			window.clearInterval(this.qrTimer);
			if (!r || !r.url) {
				this.say((r && r.needs && r.needs[0]) || _('Could not make the code.'), true);
				return;
			}
			end = Date.now() + (r.expires || 300) * 1000;
			frame = E('div', { 'style': 'box-sizing: border-box; background: #fff; padding: 12px; width: min(280px, 70vw) !important; height: min(280px, 70vw); max-width: 280px; flex: 0 0 auto; border-radius: 10px; line-height: 0; transition: opacity .3s' }, this.qrImage(r.url));
			clock = E('div', { 'style': 'text-align: center; font-size: 1.15em; margin: 12px 0 4px' });
			again = E('button', { 'class': 'btn cbi-button-action', 'style': 'display: none', 'click': ui.createHandlerFn(this, function() {
				this.closeQr();
				return this.showQr(phone);
			}) }, _('New code'));
			tick = L.bind(function() {
				var s = Math.max(0, Math.round((end - Date.now()) / 1000));

				if (s > 0) {
					dom.content(clock, _('Works for %d:%02d').format(Math.floor(s / 60), s % 60));
					if (s % 3 == 0)
						callStatus().then(L.bind(function(st) {
							var p = ((st && st.phones) || []).filter(function(x) { return x.name == phone; })[0];

							if (p && p.online && !wasOnline) {
								this.closeQr();
								this.say(_('%s is connected.').format(phone));
								this.refreshPhones();
							}
						}, this));
					return;
				}
				window.clearInterval(this.qrTimer);
				frame.style.opacity = '.15';
				dom.content(clock, _('This code has run out.'));
				again.style.display = '';
			}, this);
			tick();
			this.qrTimer = window.setInterval(tick, 1000);

			ui.showModal(_('Scan with Linphone on %s').format(phone), [
				E('p', { 'style': 'text-align: center' }, plain(_('In Linphone, open the assistant and choose to scan a QR code or fetch a remote configuration. The phone must be on this router\'s Wi-Fi.'))),
				E('div', { 'style': 'display: flex; justify-content: center' }, frame),
				clock,
				E('p', { 'style': 'text-align: center; opacity: .8' }, plain(_('Anyone who scans this code before it runs out gets this phone\'s password. To type the login into an app instead, use Login.'))),
				r.note ? E('p', { 'style': 'text-align: center; opacity: .8' }, plain(r.note)) : '',
				E('div', { 'class': 'right' }, [
					again,
					' ',
					E('button', { 'class': 'btn', 'click': L.bind(this.closeQr, this) }, _('Close'))
				])
			]);
		}, this));
	},

	showLogin: function(name, changed) {
		if (typeof changed != 'boolean')
			changed = false;
		return callLogin(name).then(L.bind(function(r) {
			var pw, btn, shown = changed, hidden = '••••••••';

			if (!r || !r.result) {
				this.say(_('Could not read the login.'), true);
				return;
			}
			pw = E('code', {}, shown ? r.password : hidden);
			btn = E('button', { 'class': 'btn', 'click': function() {
				shown = !shown;
				dom.content(pw, shown ? r.password : hidden);
				dom.content(btn, shown ? _('Hide') : _('Show password'));
			} }, shown ? _('Hide') : _('Show password'));
			ui.showModal(_('Login for %s').format(name), [
				E('p', {}, changed
					? _('The password is changed. Enter the new one in the app on %s, or scan its QR code again.').format(name)
					: _('Enter these in any SIP app, like Linphone, Zoiper or MicroSIP. Use UDP.')),
				E('table', { 'class': 'table' }, [
					cell(_('Server (domain)'), E('code', {}, r.port != 5060 ? r.server + ':' + r.port : r.server)),
					cell(_('User name'), E('code', {}, r.user)),
					cell(_('Password'), [ pw, ' ', btn ])
				]),
				E('div', { 'class': 'right' }, E('button', { 'class': 'btn', 'click': ui.hideModal }, _('Close')))
			]);
		}, this));
	},

	changePassword: function(name) {
		var box = E('input', { 'type': 'text', 'class': 'cbi-input-text', 'maxlength': 31, 'placeholder': _('Leave empty for a random one') }),
		    msg = E('div');

		ui.showModal(_('New password for %s').format(name), [
			E('p', {}, _('%s is signed out until the new password is entered in its app.').format(name)),
			E('p', {}, box),
			msg,
			E('div', { 'class': 'right' }, [
				E('button', { 'class': 'btn', 'click': ui.hideModal }, _('Cancel')), ' ',
				E('button', { 'class': 'btn cbi-button-save', 'click': ui.createHandlerFn(this, function() {
					var pass = box.value.trim();

					if (pass && !/^[A-Za-z0-9_.!@#%+=:,-]{8,31}$/.test(pass)) {
						note(msg, errorText.password);
						return;
					}
					return callPassword(name, pass).then(L.bind(function(r) {
						if (!r || !r.result) {
							note(msg, errorText[r && r.error] || _('Could not change the password.'));
							return;
						}
						ui.hideModal();
						return this.showLogin(name, true);
					}, this));
				}) }, _('Change password'))
			])
		]);
	},

	renamePhone: function(name) {
		var box = E('input', { 'type': 'text', 'class': 'cbi-input-text', 'maxlength': 23, 'value': name }),
		    msg = E('div');

		ui.showModal(_('Rename %s').format(name), [
			E('p', {}, _('The call history shows this name, as in Answered on Pixel.')),
			E('p', {}, box),
			msg,
			E('div', { 'class': 'right' }, [
				E('button', { 'class': 'btn', 'click': ui.hideModal }, _('Cancel')), ' ',
				E('button', { 'class': 'btn cbi-button-save', 'click': ui.createHandlerFn(this, function() {
					var nw = box.value.trim();

					if (!/^[A-Za-z0-9 _-]{1,23}$/.test(nw)) {
						note(msg, _('Use 1 to 23 letters, digits, spaces, - or _.'));
						return;
					}
					return callRename(name, nw).then(L.bind(function(r) {
						if (!r || !r.result) {
							note(msg, _('Could not rename the phone. The name may already be in use.'));
							return;
						}
						ui.hideModal();
						return this.refreshPhones();
					}, this));
				}) }, _('Rename'))
			])
		]);
	},

	phoneRows: function(list) {
		this.lastPhones = list;
		if (!list.length)
			return [ E('tr', { 'class': 'tr placeholder' }, E('td', { 'class': 'td', 'colspan': 3 }, E('em', _('No phones yet. Add one below.')))) ];
		return list.map(L.bind(function(ph) {
			return E('tr', { 'class': 'tr' }, [
				E('td', { 'class': 'td left' }, [
					E('span', { 'style': 'display: inline-block; width: 9px; height: 9px; border-radius: 50%; margin-right: 8px; background: ' + (ph.online ? '#3a3' : '#999') }),
					plain(ph.name)
				]),
				E('td', { 'class': 'td left' }, ph.online ? _('Online') : _('Offline')),
				E('td', { 'class': 'td right' }, [
					E('button', { 'class': 'btn cbi-button-action', 'click': ui.createHandlerFn(this, 'showQr', ph.name) }, _('QR code')),
					' ',
					E('button', { 'class': 'btn', 'click': ui.createHandlerFn(this, 'showLogin', ph.name) }, _('Login')),
					' ',
					E('button', { 'class': 'btn', 'click': ui.createHandlerFn(this, 'changePassword', ph.name) }, _('Password')),
					' ',
					E('button', { 'class': 'btn', 'click': ui.createHandlerFn(this, 'renamePhone', ph.name) }, _('Rename')),
					' ',
					E('button', { 'class': 'btn cbi-button-remove', 'click': ui.createHandlerFn(this, 'removePhone', ph.name) }, _('Remove'))
				])
			]);
		}, this));
	},

	refreshPhones: function() {
		return callStatus().then(L.bind(function(st) {
			if (this.table && st)
				dom.content(this.table, [ this.table.firstChild ].concat(this.phoneRows(st.phones || [])));
		}, this));
	},

	addPhone: function() {
		var name = this.nameBox.value.trim();

		if (!/^[A-Za-z0-9 _-]{1,23}$/.test(name)) {
			this.say(_('Use 1 to 23 letters, digits, spaces, - or _.'), true);
			return;
		}
		return callAdd(name).then(L.bind(function(r) {
			if (!r || !r.result) {
				this.say(r && r.error == 'failed' ? _('Could not add the phone. The name may already be in use.') : _('Could not add the phone.'), true);
				return;
			}
			this.nameBox.value = '';
			this.say(_('%s added. Show its QR code or login to set it up.').format(name));
			return this.refreshPhones();
		}, this));
	},

	removePhone: function(name) {
		if (!confirm(_('Remove %s? It will not be able to make or answer calls any more.').format(name)))
			return;
		return callRemove(name).then(L.bind(function(r) {
			this.say(r && r.result ? _('%s removed.').format(name) : _('Could not remove the phone.'), !(r && r.result));
			return this.refreshPhones();
		}, this));
	},

	body: function(data) {
		var st = data[0] || {}, svc = data[1];

		this.svc = svc;
		this.table = null;
		if (!st.phone_port || !svc)
			return E('div', { 'class': 'cbi-section' }, [
				E('p', {}, E('strong', _('Needs the phone port'))),
				E('p', {}, _('Modem SIP carries calls through the RJ11 phone port service (fxsd). Install luci-app-fxs first.'))
			]);

		if (!isOn(svc))
			return E('div', { 'class': 'cbi-section' }, [
				E('p', {}, E('strong', _('Turned off'))),
				E('button', { 'class': 'btn cbi-button-apply', 'click': ui.createHandlerFn(this, 'turnOn') }, _('Turn on'))
			]);

		this.nameBox = E('input', { 'type': 'text', 'class': 'cbi-input-text', 'maxlength': 23, 'placeholder': _('Name, like Pixel') });
		this.table = E('table', { 'class': 'table' }, [
			E('tr', { 'class': 'tr table-titles' }, [
				E('th', { 'class': 'th left' }, _('Phone')),
				E('th', { 'class': 'th left' }, _('Status')),
				E('th', { 'class': 'th' })
			])
		].concat(this.phoneRows(st.phones || [])));

		return E([], [
			E('div', { 'class': 'cbi-section' }, [
				E('p', {}, [
					E('strong', st.running ? _('Turned on') : _('Turned on, but msipd is not running')),
					' ',
					E('button', { 'class': 'btn cbi-button-reset', 'click': ui.createHandlerFn(this, 'turnOff') }, _('Turn off'))
				])
			]),
			E('div', { 'class': 'cbi-section' }, [
				E('h3', _('Phones')),
				E('div', { 'class': 'cbi-map-descr' }, _('Each phone or app gets its own login. Calls ring all of them and the RJ11 phone at once, and the call history shows which one answered.')),
				this.table,
				E('p', { 'style': 'margin-top: 10px' }, [
					this.nameBox, ' ',
					E('button', { 'class': 'btn cbi-button-add', 'click': ui.createHandlerFn(this, 'addPhone') }, _('Add phone'))
				])
			])
		]);
	},

	render: function(data) {
		this.msg = E('div');
		this.root = E('div', {}, this.body(data));
		poll.add(L.bind(function() {
			if (this.table)
				return this.refreshPhones();
		}, this), 5);

		return E([], [
			E('h2', _('Modem SIP')),
			E('div', { 'class': 'cbi-map-descr' }, _('Lets SIP phones and apps on your network make and answer calls through the SIM, next to the RJ11 phone.')),
			this.msg,
			this.root
		]);
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
