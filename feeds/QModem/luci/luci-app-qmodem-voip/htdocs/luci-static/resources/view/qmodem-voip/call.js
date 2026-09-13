'use strict';
'require view';
'require poll';
'require dom';
'require ui';
'require rpc as luciRpc';
'require qmodem-voip.rpc as rpc';
'require qmodem-voip.reducer as reducer';
'require qmodem-voip.media as media';
'require qmodem-voip.surface as surface';

const POLL_SECONDS = 3, WORKLET_URL = L.resource('qmodem-voip/audio-worklet.js');
const STATE_LABELS = {
	disabled: _('Disabled'), idle: _('Ready'), outgoing_setup: _('Outgoing'), incoming_ringing: _('Incoming call'), early_media: _('Early media'), active: _('Active'), terminating: _('Ending call'), recovering: _('Recovering'), fault: _('Fault')
};

document.head.appendChild(E('link', { rel: 'stylesheet', type: 'text/css', href: L.resource('qmodem-voip/qmodem-voip.css') }));

return view.extend({
	load() {
		this.state = reducer.initialState();
		this.rpc = rpc;
		this.media = media.createMediaClient({ issueToken: rpc.issueMediaToken });
		return Promise.all([
			L.resolveDefault(rpc.capabilities(), {}),
			L.resolveDefault(rpc.status(), {})
		]).then((results) => {
			this.dispatch({ type: 'CAPABILITIES', value: results[0] });
			this.dispatch({ type: 'SNAPSHOT', value: results[1] });
			return results;
		});
	},

	dispatch(action) {
		this.state = reducer.reduce(this.state, action);
		if (this.root)
			this.updateView();
	},

	async refresh() {
		const snapshot = await L.resolveDefault(rpc.status(), null);
		if (snapshot)
			this.dispatch({ type: 'SNAPSHOT', value: snapshot });
		return snapshot;
	},

	showError(error) {
		this.dispatch({ type: 'ERROR', value: error });
		if (error)
			ui.addNotification(_('Call operation failed'), E('p', {}, [ reducer.errorMessage(error) ]), 'error');
	},

	async run(action, payload, after) {
		this.dispatch({ type: 'CLEAR_ERROR' });
		try {
			const response = await rpc[action](payload);
			if (response?.status === 'error') {
				if (action === 'setSipCredentials')
					this.dispatch({ type: 'CREDENTIAL_RESULT', value: response });
				if (action === 'issueMediaToken')
					this.dispatch({ type: 'MEDIA_RESULT', value: response });
				this.showError(response);
				return;
			}
			if (response && action === 'setSipCredentials')
				this.dispatch({ type: 'CREDENTIAL_RESULT', value: response });
			else if (response && action === 'issueMediaToken')
				this.dispatch({ type: 'MEDIA_RESULT', value: response });
			else if (response)
				this.dispatch({ type: 'SNAPSHOT', value: response });
			if (after)
				after(response);
		}
		catch (error) {
			this.showError({ error: error.code || 'unknown', message: error.message });
		}
	},

	async saveCredentials(event) {
		event.preventDefault();
		const password = this.refs.sipPassword.value;
		if (!this.refs.sipUser.value.trim() || !password)
			return;
		await this.run('setSipCredentials', { username: this.refs.sipUser.value.trim(), password }, () => { this.refs.sipPassword.value = ''; });
		this.refs.sipPassword.value = '';
	},

	async originate(event) {
		event.preventDefault();
		const number = this.refs.dial.value.trim();
		this.refs.dial.value = '';
		if (!number)
			return;
		await this.run('originate', { endpoint: 'browser', number });
	},

	answer() {
		return this.run('answer', { endpoint: 'browser' });
	},

	terminate(action) {
		this.refs.dial.value = '';
		return this.run(action, { endpoint: 'browser' });
	},

	toggleMute() {
		this.muted = !this.muted;
		this.media.setMuted(this.muted);
		this.refs.mute.setAttribute('aria-pressed', this.muted ? 'true' : 'false');
		this.refs.mute.textContent = this.muted ? _('Unmute') : _('Mute');
	},

	async startMedia() {
		if (this.state.mediaStatus !== 'ready')
			return;
		let stream = null;
		try {
			stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, sampleRate: 48000 } });
			this.dispatch({ type: 'MEDIA_PERMISSION', value: 'granted' });
			await this.media.connect({ media: 'ready', url: this.state.capabilities?.media_url, sessionId: luciRpc.getSessionID(), callRevision: this.state.snapshot?.revision, httpsOrigin: location.origin });
			await this.media.attachAudio(stream, WORKLET_URL);
		}
		catch (error) {
			if (stream)
				stream.getTracks().forEach((track) => track.stop());
			this.media.close();
			this.dispatch({ type: 'MEDIA_PERMISSION', value: error.name === 'NotAllowedError' ? 'denied' : 'error' });
			this.dispatch({ type: 'MEDIA_RESULT', value: { status: 'error', error: error.code || 'unsupported', message: error.message } });
			this.showError({ error: error.code || 'unsupported', message: error.message });
		}
	},

	handleEvent(event) {
		if (event?.event)
			this.dispatch({ type: 'EVENT', value: event });
	},

	updateTimer() {
		if (!this.timerStartedAt || !this.refs.timer)
			return;
		const seconds = Math.max(0, Math.floor((Date.now() - this.timerStartedAt) / 1000));
		this.refs.timer.textContent = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
	},

	updateView() {
		const model = reducer.viewModel(this.state);
		const snapshot = this.state.snapshot || { state: 'disabled', enabled: false };
		const statusText = STATE_LABELS[model.state] || _('Unknown state');
		this.refs.support.textContent = model.supported ? _('Supported') : _('Unsupported');
		this.refs.support.className = `qvoip-badge qvoip-badge--${model.supported ? 'success' : 'warning'}`;
		this.refs.capability.textContent = model.supported ? _('RM520N-GL passed the safety probe.') : _('The read-only hardware probe did not pass. Call controls stay unavailable.');
		this.refs.enable.checked = model.enabled;
		this.refs.enable.disabled = !model.supported || !model.stable;
		this.refs.enableLabel.textContent = model.enabled ? _('Enabled') : _('Disabled');
		this.refs.sipStatus.textContent = this.state.credentialStatus === 'not_ready' ? _('SIP credential rotation is not ready in this backend.') : (model.registration === 'configured' ? _('Credentials configured. Registration is not reported by v1 status.') : _('SIP account is not configured. Registration is not reported by v1 status.'));
		this.refs.callStatus.textContent = statusText;
		this.refs.callStatus.className = `qvoip-state qvoip-state--${model.state}`;
		this.refs.callDetail.textContent = model.disabledReason || (snapshot.caller_id_withheld ? _('Caller ID withheld.') : (snapshot.number_present ? _('Destination accepted by the modem.') : _('No active call.')));
		this.refs.dial.disabled = !model.canOriginate;
		this.refs.dialForm.querySelector('button').disabled = !model.canOriginate;
		this.refs.hangup.disabled = !model.canHangup;
		this.refs.mute.disabled = !model.canMute;
		this.refs.mediaStatus.textContent = this.state.mediaStatus === 'ready' ? _('Media capability is ready; browser attachment is opt-in.') : _('Media backend is not ready. Browser audio remains inactive.');
		this.refs.mediaAction.disabled = this.state.mediaStatus !== 'ready' || !this.state.capabilities?.media_url;
		this.refs.permission.textContent = this.state.mediaPermission === 'denied' ? _('Microphone permission was denied. Allow it in the browser and try again.') : _('No microphone permission has been requested.');
		this.refs.error.textContent = model.errorText;
		this.refs.error.hidden = !model.errorText;
		this.refs.overlay.hidden = !model.canAnswer;
		if (model.callTimerVisible && !this.timerStartedAt)
			this.timerStartedAt = Date.now();
		if (!model.callTimerVisible)
			this.timerStartedAt = null;
		this.updateTimer();
		this.refs.live.textContent = this.state.lastStatusKey !== this.lastRenderedStatus ? statusText : '';
		this.lastRenderedStatus = this.state.lastStatusKey;
		if ([ 'idle', 'disabled' ].indexOf(model.state) !== -1)
			this.refs.dial.value = '';
	},

	render() {
		surface.build(this);
		this.updateView();
		this.timerInterval = setInterval(() => this.updateTimer(), 1000);
		this.pollFn = () => this.refresh();
		poll.add(this.pollFn, POLL_SECONDS);
		return this.root;
	},

	remove() {
		if (this.pollFn)
			poll.remove(this.pollFn);
		this.media.close();
		if (this.timerInterval)
			clearInterval(this.timerInterval);
	}
});
