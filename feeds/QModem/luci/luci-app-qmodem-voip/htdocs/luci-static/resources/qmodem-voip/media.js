'use strict';

function mediaError(code, message) {
	const error = new Error(message || code);
	error.code = code;
	return error;
}

function createMediaClient(dependencies) {
	const deps = dependencies || {};
	let socket = null;
	let audioContext = null;
	let audioSource = null;
	let audioNode = null;
	let audioStream = null;
	let token = null;

	function close() {
		if (socket) {
			socket.onopen = null;
			socket.onmessage = null;
			socket.onerror = null;
			socket.onclose = null;
			socket.close();
		}
		if (audioSource)
			audioSource.disconnect();
		if (audioStream)
			audioStream.getTracks().forEach((track) => track.stop());
		if (audioNode)
			audioNode.disconnect();
		if (audioContext && audioContext.state !== 'closed')
			audioContext.close();
		socket = null;
		audioSource = null;
		audioStream = null;
		audioNode = null;
		audioContext = null;
		token = null;
	}

	async function connect(options) {
		if (options.media !== 'ready')
			throw mediaError('not_ready', 'not_ready');
		if (!options.url || !String(options.url).startsWith('wss:'))
			throw mediaError('not_ready', 'media endpoint not supplied');
		close();

		const response = await deps.issueToken({
			session_id: options.sessionId,
			call_revision: options.callRevision,
			https_origin: options.httpsOrigin
		});
		if (!response || response.status === 'error' || !response.token)
			throw mediaError(response?.error || 'not_ready', response?.message || 'not_ready');

		const WebSocketCtor = deps.webSocketFactory || globalThis.WebSocket;
		if (!WebSocketCtor)
			throw mediaError('unsupported', 'WebSocket is unavailable');
		token = response.token;
		const endpoint = new URL(options.url, globalThis.location?.href);
		endpoint.searchParams.set('token', token);
		endpoint.searchParams.set('session_id', options.sessionId);
		socket = new WebSocketCtor(endpoint.toString());
		socket.binaryType = 'arraybuffer';
		socket.onopen = () => {
			token = null;
		};
		socket.onmessage = (event) => {
			if (audioNode && event.data instanceof ArrayBuffer)
				audioNode.port.postMessage({ type: 'pcm', frame: event.data }, [ event.data ]);
		};
		return socket;
	}

	async function attachAudio(stream, workletUrl, AudioContextCtor) {
		const Context = AudioContextCtor || globalThis.AudioContext;
		if (!Context || !stream)
			throw mediaError('unsupported', 'browser audio is unavailable');
		audioContext = new Context({ sampleRate: 48000 });
		if (audioContext.sampleRate !== 48000)
			throw mediaError('unsupported', '48 kHz audio is unavailable');
		await audioContext.audioWorklet.addModule(workletUrl);
		audioStream = stream;
		audioNode = new globalThis.AudioWorkletNode(audioContext, 'qmodem-voip-audio', {
			numberOfInputs: 1,
			numberOfOutputs: 1,
			outputChannelCount: [ 1 ]
		});
		audioSource = audioContext.createMediaStreamSource(stream);
		audioSource.connect(audioNode);
		audioNode.connect(audioContext.destination);
		audioNode.port.onmessage = (event) => {
			if (socket && socket.readyState === 1 && event.data?.type === 'pcm')
				socket.send(event.data.frame);
		};
		await audioContext.resume();
	}

	function setMuted(value) {
		if (audioNode)
			audioNode.port.postMessage({ type: 'mute', muted: value === true });
	}

	return Object.freeze({ connect, attachAudio, setMuted, close });
}

const api = Object.freeze({ createMediaClient });

if (typeof module !== 'undefined' && module.exports)
	module.exports = api;

return api;
