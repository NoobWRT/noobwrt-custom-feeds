'use strict';
'require view';
'require rpc';
'require poll';

// SPDX-License-Identifier: GPL-2.0-only
// Services > Phone: a short status and the way into the phone management
// interface, which runs on its own port (aw1000_voice.web.port, default 7766).

var callInfo = rpc.declare({ object: 'aw1000-voice', method: 'info' });
var callStatus = rpc.declare({ object: 'fxs', method: 'status' });

var STATE = {
	idle: _('Ready'), dialtone: _('Dial tone'), digits: _('Dialing'), calling: _('Calling'),
	talking: _('In call'), ringing: _('Ringing'), busy: _('Busy tone'), stopped: _('Stopped')
};

function stateText(s) {
	if (!s || s.enabled === false)
		return _('Phone port off');
	if (!s.running)
		return _('Phone service not running');
	return (STATE[s.state] || s.state || _('Unknown')) + (s.peer && (s.state == 'talking' || s.state == 'ringing') ? ' · ' + s.peer : '');
}

function url(info) {
	return window.location.protocol.replace('https:', 'http:') + '//' + window.location.hostname + ':' + ((info && info.port) || 7766) + '/';
}

return view.extend({
	load: function() {
		return Promise.all([
			L.resolveDefault(callInfo(), {}),
			L.resolveDefault(callStatus(), {})
		]);
	},

	render: function(data) {
		var info = data[0] || {}, status = data[1] || {};
		var line = E('strong', {}, stateText(status));
		var link = url(info);

		poll.add(function() {
			return L.resolveDefault(callStatus(), {}).then(function(s) { line.textContent = stateText(s); });
		}, 5);

		return E('div', { 'class': 'cbi-map' }, [
			E('h2', {}, _('Phone')),
			E('div', { 'class': 'cbi-map-descr' },
				_('The RJ11 phone port and SIP phones are managed in their own interface: missed calls, call history, recordings, phonebook, do not disturb and every setting.')),
			E('div', { 'class': 'cbi-section' }, [
				E('div', { 'class': 'table' }, [
					E('div', { 'class': 'tr' }, [ E('div', { 'class': 'td left', 'style': 'width:33%' }, _('Line')), E('div', { 'class': 'td left' }, line) ]),
					E('div', { 'class': 'tr' }, [ E('div', { 'class': 'td left' }, _('Interface')), E('div', { 'class': 'td left' },
						E('a', { 'href': link, 'target': '_blank', 'rel': 'noopener' }, link)) ]),
					E('div', { 'class': 'tr' }, [ E('div', { 'class': 'td left' }, _('Versions')), E('div', { 'class': 'td left' },
						'web ' + ((info.versions || {}).web || '?') + ' · fxsd ' + ((info.versions || {}).fxsd || '?') + ' · msipd ' + ((info.versions || {}).msipd || '-')) ])
				]),
				E('div', { 'style': 'margin-top: 1.5em' }, [
					E('a', { 'class': 'btn cbi-button cbi-button-action important', 'href': link, 'target': '_blank', 'rel': 'noopener' },
						_('Open management interface'))
				]),
				E('p', { 'style': 'margin-top: 1em; opacity: .75' },
					_('Sign in there with the same user name and password as LuCI.'))
			])
		]);
	},

	handleSave: null,
	handleSaveApply: null,
	handleReset: null
});
