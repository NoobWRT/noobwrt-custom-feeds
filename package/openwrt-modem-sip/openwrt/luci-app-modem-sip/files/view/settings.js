'use strict';
'require view';
'require rpc';
'require ui';
'require dom';

var callSettings = rpc.declare({ object: 'modem-sip', method: 'settings' });
var callSetSettings = rpc.declare({ object: 'modem-sip', method: 'set_settings', params: [ 'port', 'rtp_from', 'rtp_to', 'hd' ] });

var errorText = {
	busy: _('A call is in progress. Try again when the line is idle.'),
	port: _('Ports must be numbers from 1024 to 65535.'),
	range: _('The audio ports need a range of 10 to 1000 ports.'),
	overlap: _('The SIP port cannot be inside the audio port range.')
};

return view.extend({
	load: function() {
		return L.resolveDefault(callSettings(), {});
	},

	say: function(text, bad) {
		dom.content(this.msg, E('p', { 'style': bad ? 'color: #c33' : '' }, text));
		window.clearTimeout(this.msgTimer);
		this.msgTimer = window.setTimeout(L.bind(function() { dom.content(this.msg, ''); }, this), 4000);
	},

	save: function() {
		var v = this.set;

		return callSetSettings(+v.port.value, +v.from.value, +v.to.value, v.hd.checked).then(L.bind(function(r) {
			if (!r || !r.result) {
				this.say(errorText[r && r.error] || _('Could not save the settings.'), true);
				return;
			}
			this.say(_('Settings saved.'));
		}, this));
	},

	render: function(c) {
		var num = function(v) {
			return E('input', { 'type': 'number', 'class': 'cbi-input-text', 'min': 1024, 'max': 65535, 'value': v, 'style': 'width: 8em' });
		}, row = function(label, field, help) {
			return E('div', { 'class': 'cbi-value' }, [
				E('label', { 'class': 'cbi-value-title' }, label),
				E('div', { 'class': 'cbi-value-field' }, [ field, help ? E('div', { 'class': 'cbi-value-description' }, help) : '' ])
			]);
		};

		c = c || {};
		this.msg = E('div');
		this.set = { port: num(c.port), from: num(c.rtp_from), to: num(c.rtp_to), hd: E('input', { 'type': 'checkbox' }) };
		this.set.hd.checked = !!c.hd;

		return E([], [
			E('h2', _('Modem SIP')),
			E('div', { 'class': 'cbi-section' }, [
				row(_('SIP port'), this.set.port, _('Phones connect to this port. If you change it, set the new port in each phone\'s app.')),
				row(_('Audio ports'), E('span', {}, [ this.set.from, ' to ', this.set.to ])),
				row(_('HD sound'), this.set.hd, c.phone_hd ? _('Uses Opus or G.722 with apps that support them.') : _('HD calling is off on the phone port, so calls use normal sound.')),
				this.msg,
				E('div', { 'class': 'right' }, E('button', { 'class': 'btn cbi-button-save', 'click': ui.createHandlerFn(this, 'save') }, _('Save')))
			])
		]);
	},

	handleSaveApply: null,
	handleSave: null,
	handleReset: null
});
