'use strict';

const assert = require('node:assert/strict');
const media = require('../htdocs/luci-static/resources/qmodem-voip/media.js');

const issueRequests = [];
const sockets = [];

class FakeWebSocket {
	constructor(url) {
		this.url = url;
		this.readyState = 0;
		this.sent = [];
		sockets.push(this);
	}

	send(frame) {
		this.sent.push(frame);
	}

	close() {
		this.readyState = 3;
	}
}

global.location = { href: 'https://router.example/cgi-bin/luci/admin/voip', origin: 'https://router.example' };

const client = media.createMediaClient({
	issueToken: async (request) => {
		issueRequests.push(request);
		return { token: '0123456789abcdefghijkl', call_revision: 42 };
	},
	webSocketFactory: FakeWebSocket
});

(async () => {
	const socket = await client.connect({
		media: 'ready',
		url: 'wss://router.example:9443/media',
		sessionId: '0123456789abcdef0123456789abcdef',
		callRevision: 42,
		httpsOrigin: 'https://router.example'
	});

	assert.deepEqual(issueRequests, [ {
		session_id: '0123456789abcdef0123456789abcdef',
		call_revision: 42,
		https_origin: 'https://router.example'
	} ]);
	assert.equal(sockets.length, 1);
	const endpoint = new URL(socket.url);
	assert.equal(endpoint.pathname, '/media');
	assert.equal(endpoint.searchParams.get('token'), '0123456789abcdefghijkl');
	assert.equal(endpoint.searchParams.get('session_id'), '0123456789abcdef0123456789abcdef');

	socket.readyState = 1;
	socket.onopen();
	assert.deepEqual(socket.sent, [], 'the authenticated token is URL-only; startup must not send a text frame');

	client.close();
	console.log('PASS: authenticated browser media handshake contract');
})().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
