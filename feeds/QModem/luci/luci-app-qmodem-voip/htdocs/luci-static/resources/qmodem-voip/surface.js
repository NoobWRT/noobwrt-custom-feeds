'use strict';

function node(tag, attrs, children) {
	return E(tag, attrs || {}, children || []);
}

function field(label, control, help) {
	return node('label', { class: 'qvoip-field' }, [
		node('span', { class: 'qvoip-field__label' }, [ label ]), control,
		help ? node('span', { class: 'qvoip-help' }, [ help ]) : null
	]);
}

function button(label, className, handler, type) {
	const result = node('button', { type: type || 'button', class: `qvoip-button ${className || ''}` }, [ label ]);
	if (handler)
		result.addEventListener('click', handler);
	return result;
}

function build(context) {
	context.refs = {};
	context.refs.support = node('span', { class: 'qvoip-badge' });
	context.refs.capability = node('p', { class: 'qvoip-copy' });
	context.refs.enable = node('input', { type: 'checkbox', class: 'qvoip-switch' });
	context.refs.enableLabel = node('span', {}, [ _('Disabled') ]);
	context.refs.enable.addEventListener('change', () => context.run(context.refs.enable.checked ? 'enable' : 'disable', {}));
	context.refs.sipStatus = node('p', { class: 'qvoip-status-line' });
	context.refs.sipForm = node('form', { class: 'qvoip-form' });
	context.refs.sipUser = node('input', { type: 'text', autocomplete: 'username', required: true });
	context.refs.sipPassword = node('input', { type: 'password', autocomplete: 'new-password', required: true });
	context.refs.sipForm.addEventListener('submit', (event) => context.saveCredentials(event));
	context.refs.callStatus = node('span', { class: 'qvoip-state' });
	context.refs.callDetail = node('p', { class: 'qvoip-copy', id: 'qvoip-call-detail' });
	context.refs.dial = node('input', { type: 'tel', inputmode: 'tel', maxlength: 63, autocomplete: 'off', spellcheck: 'false', required: true });
	context.refs.dialForm = node('form', { class: 'qvoip-dial-form' });
	context.refs.dial.setAttribute('aria-describedby', 'qvoip-call-detail');
	context.refs.dialForm.addEventListener('submit', (event) => context.originate(event));
	context.refs.dialForm.appendChild(field(_('Destination'), context.refs.dial, _('Use digits and the modem-supported call control characters.')));
	context.refs.dialForm.appendChild(button(_('Call'), 'qvoip-button--primary', null, 'submit'));
	context.refs.dialForm.querySelector('button').setAttribute('aria-describedby', 'qvoip-call-detail');
	context.refs.timer = node('time', { class: 'qvoip-timer' }, [ '00:00' ]); context.refs.actions = node('div', { class: 'qvoip-actions' });
	context.refs.mute = button(_('Mute'), 'qvoip-button--secondary', () => context.toggleMute());
	context.refs.hangup = button(_('Hang up'), 'qvoip-button--danger', () => context.terminate('hangup'));
	context.refs.actions.append(context.refs.mute, context.refs.hangup);
	context.refs.mute.setAttribute('aria-describedby', 'qvoip-call-detail');
	context.refs.hangup.setAttribute('aria-describedby', 'qvoip-call-detail');
	context.refs.mediaStatus = node('p', { class: 'qvoip-copy' }); context.refs.mediaAction = button(_('Start browser audio'), 'qvoip-button--secondary', () => context.startMedia());
	context.refs.permission = node('p', { class: 'qvoip-help', id: 'qvoip-media-help' });
	context.refs.mediaAction.setAttribute('aria-describedby', 'qvoip-media-help');
	context.refs.live = node('p', { class: 'qvoip-live', 'aria-live': 'polite' });
	context.refs.error = node('p', { class: 'qvoip-error', role: 'alert', hidden: true });
	context.refs.overlay = node('section', { class: 'qvoip-incoming', role: 'alertdialog', 'aria-labelledby': 'qvoip-incoming-title', hidden: true });
	context.refs.overlay.append(
		node('h3', { id: 'qvoip-incoming-title' }, [ _('Incoming call') ]),
		node('p', { class: 'qvoip-copy' }, [ _('Caller ID is withheld.') ]),
		button(_('Answer'), 'qvoip-button--primary', () => context.answer()),
		button(_('Reject'), 'qvoip-button--danger', () => context.terminate('reject'))
	);

	const sipPanel = node('section', { class: 'qvoip-panel' }, [
		node('div', { class: 'qvoip-panel__heading' }, [ node('h3', {}, [ _('SIP account') ]) ]),
		context.refs.sipStatus, context.refs.sipForm
	]);
	context.refs.sipForm.append(
		field(_('Username'), context.refs.sipUser),
		field(_('Password'), context.refs.sipPassword, _('Write-only. The password is cleared after each attempt.')),
		button(_('Rotate credentials'), 'qvoip-button--primary', null, 'submit')
	);

	const statusPanel = node('section', { class: 'qvoip-panel qvoip-status-panel' }, [
		node('div', { class: 'qvoip-panel__heading' }, [ node('h3', {}, [ _('Capability and service') ]), context.refs.support ]),
		context.refs.capability,
		field(_('Experimental call service'), node('span', { class: 'qvoip-switch-row' }, [ context.refs.enable, context.refs.enableLabel ]), _('Support comes from qmodem_voip.capabilities.'))
	]);

	const keypad = node('div', { class: 'qvoip-keypad', 'aria-describedby': 'qvoip-keypad-help' }, [
		...['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'].map((value) => {
			const key = button(value, 'qvoip-key', null);
			key.disabled = true;
			key.setAttribute('aria-describedby', 'qvoip-keypad-help');
			return key;
		})
	]);
	keypad.querySelectorAll('button').forEach((key) => key.setAttribute('aria-label', _('Send DTMF %s').format(key.textContent)));

	const callPanel = node('section', { class: 'qvoip-panel qvoip-call-panel' }, [
		node('div', { class: 'qvoip-panel__heading' }, [ node('h3', {}, [ _('Call workspace') ]), context.refs.callStatus, context.refs.timer ]),
		context.refs.callDetail, context.refs.dialForm, context.refs.actions, context.refs.overlay,
		node('h4', {}, [ _('Keypad') ]),
		node('p', { id: 'qvoip-keypad-help', class: 'qvoip-help' }, [ _('DTMF is reserved for a future media contract.') ]), keypad
	]);
	const mediaPanel = node('aside', { class: 'qvoip-panel qvoip-media-panel' }, [
		node('h3', {}, [ _('Audio and media') ]), context.refs.mediaStatus, context.refs.mediaAction, context.refs.permission
	]);

	context.root = node('div', { class: 'qvoip-page', 'data-event-topic': context.rpc.eventTopic }, [ node('div', { class: 'qvoip-shell' }, [
		node('header', { class: 'qvoip-header' }, [ node('div', {}, [ node('h2', {}, [ _('Experimental QModem voice') ]), node('p', { class: 'qvoip-copy' }, [ _('Unsupported hardware fails closed. This page controls one modem call.') ]) ]), node('span', { class: 'qvoip-header__flag' }, [ _('EXPERIMENTAL') ]) ]),
		node('div', { class: 'qvoip-settings-grid' }, [ statusPanel, sipPanel ]),
		node('div', { class: 'qvoip-workspace-grid' }, [ callPanel, mediaPanel ]),
		context.refs.error, context.refs.live
	]) ]);
	return context.root;
}

const api = Object.freeze({ build });

if (typeof module !== 'undefined' && module.exports)
	module.exports = api;

return api;
