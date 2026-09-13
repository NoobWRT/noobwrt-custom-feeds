'use strict';

const OBJECT = 'qmodem_voip';
const EVENT_TOPIC = 'qmodem_voip.call';
const METHODS = Object.freeze({
	status: 'status',
	capabilities: 'capabilities',
	enable: 'enable',
	disable: 'disable',
	originate: 'originate',
	answer: 'answer',
	reject: 'reject',
	hangup: 'hangup',
	setSipCredentials: 'set_sip_credentials',
	issueMediaToken: 'issue_media_token'
});

const PARAMS = Object.freeze({
	status: [],
	capabilities: [],
	enable: [],
	disable: [],
	originate: [ 'endpoint', 'number' ],
	answer: [ 'endpoint' ],
	reject: [ 'endpoint' ],
	hangup: [ 'endpoint' ],
	setSipCredentials: [ 'username', 'password' ],
	issueMediaToken: [ 'session_id', 'call_revision', 'https_origin' ]
});

const SNAPSHOT_FIELDS = Object.freeze([
	'state', 'enabled', 'origin', 'endpoint', 'answer_owner',
	'number_present', 'caller_id_withheld', 'revision', 'restart_epoch',
	'sequence', 'drop_count', 'reconcile_pending'
]);

const ERROR_CODES = Object.freeze([
	'invalid_endpoint', 'invalid_number', 'busy', 'invalid_state',
	'at_failed', 'unsupported', 'restore_failed', 'invalid_credentials',
	'activation_failed'
]);

const api = Object.freeze({ OBJECT, EVENT_TOPIC, METHODS, PARAMS, SNAPSHOT_FIELDS, ERROR_CODES });

if (typeof module !== 'undefined' && module.exports)
	module.exports = api;

return api;
