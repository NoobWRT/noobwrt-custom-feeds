'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
global._ = (value) => value;
const contract = require('../htdocs/luci-static/resources/qmodem-voip/contract.js');
const reducer = require('../htdocs/luci-static/resources/qmodem-voip/reducer.js');

assert.deepEqual(Object.values(contract.METHODS), [ 'status', 'capabilities', 'enable', 'disable', 'originate', 'answer', 'reject', 'hangup', 'set_sip_credentials', 'issue_media_token' ]);
assert.deepEqual(contract.PARAMS.status, []);
assert.deepEqual(contract.PARAMS.capabilities, []);
assert.deepEqual(contract.PARAMS.enable, []);
assert.deepEqual(contract.PARAMS.disable, []);
assert.deepEqual(contract.PARAMS.originate, [ 'endpoint', 'number' ]);
assert.deepEqual(contract.PARAMS.answer, [ 'endpoint' ]);
assert.deepEqual(contract.PARAMS.reject, [ 'endpoint' ]);
assert.deepEqual(contract.PARAMS.hangup, [ 'endpoint' ]);
assert.deepEqual(contract.PARAMS.setSipCredentials, [ 'username', 'password' ]);
assert.deepEqual(contract.PARAMS.issueMediaToken, [ 'session_id', 'call_revision', 'https_origin' ]);
assert.deepEqual(contract.ERROR_CODES.slice(-2), [ 'invalid_credentials', 'activation_failed' ]);
assert.equal(contract.OBJECT, 'qmodem_voip');
assert.equal(contract.EVENT_TOPIC, 'qmodem_voip.call');

const supported = { status: 'experimental', supported: true, support_state: 'supported', media: 'not_ready' };
const unsupported = { status: 'experimental', supported: false, support_state: 'unsupported', media: 'not_ready' };

function snapshot(state, revision, overrides) {
	return Object.assign({ state, enabled: true, origin: 'none', endpoint: 'none', answer_owner: 'none', number_present: false, caller_id_withheld: false, revision, restart_epoch: 1, sequence: revision, drop_count: 0, reconcile_pending: false }, overrides || {});
}

function model(capabilities, current) {
	let state = reducer.initialState();
	state = reducer.reduce(state, { type: 'CAPABILITIES', value: capabilities });
	state = reducer.reduce(state, { type: 'SNAPSHOT', value: current });
	return state;
}

assert.equal(reducer.viewModel(model(unsupported, snapshot('disabled', 0, { enabled: false }))).supported, false);
assert.equal(reducer.viewModel(model(supported, snapshot('disabled', 0, { enabled: false }))).state, 'disabled');
assert.equal(reducer.viewModel(model(supported, snapshot('idle', 1))).canOriginate, true);
assert.equal(reducer.viewModel(model(supported, snapshot('outgoing_setup', 2, { origin: 'browser', endpoint: 'cellular', number_present: true }))).canHangup, true);
assert.equal(reducer.viewModel(model(supported, snapshot('incoming_ringing', 3, { caller_id_withheld: true }))).canAnswer, true);
assert.equal(reducer.viewModel(model(supported, snapshot('active', 4, { answer_owner: 'browser' }))).canMute, true);
assert.equal(reducer.viewModel(model(supported, snapshot('recovering', 5, { reconcile_pending: true }))).canHangup, false);
assert.equal(reducer.viewModel(model(supported, snapshot('fault', 6))).canOriginate, false);

let state = model(supported, snapshot('idle', 1));
state = reducer.reduce(state, { type: 'EVENT', value: snapshot('active', 3, { event: 'event_gap', restart_epoch: 2, reconcile_pending: true }) });
assert.equal(state.requiresResnapshot, true);
assert.equal(reducer.viewModel(state).canMute, false);
state = reducer.reduce(state, { type: 'SNAPSHOT', value: snapshot('idle', 4, { restart_epoch: 2, sequence: 2 }) });
assert.equal(state.requiresResnapshot, false);
state = reducer.reduce(state, { type: 'ERROR', value: { status: 'error', error: 'busy', message: 'another endpoint answered' } });
assert.match(reducer.viewModel(state).errorText, /Another endpoint/);
state = reducer.reduce(state, { type: 'CREDENTIAL_RESULT', value: { status: 'error', error: 'unsupported', message: 'not_ready' } });
assert.equal(state.credentialStatus, 'not_ready');
assert.match(reducer.errorMessage({ error: 'invalid_credentials' }), /credentials were rejected/);
assert.match(reducer.errorMessage({ error: 'activation_failed' }), /could not be activated/);

const resourceDir = path.resolve(__dirname, '../htdocs/luci-static/resources');
const resources = [];
function collect(directory) {
	for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
		const fullPath = path.join(directory, entry.name);
		if (entry.isDirectory()) collect(fullPath);
		else if (entry.name.endsWith('.js')) resources.push(fs.readFileSync(fullPath, 'utf8'));
	}
}
collect(resourceDir);
assert.equal(resources.some((source) => /external[_]sip|localStorage|sessionStorage|console\.log|password.*console|token.*console/i.test(source)), false);

const surfaceSource = fs.readFileSync(path.resolve(__dirname, '../htdocs/luci-static/resources/qmodem-voip/surface.js'), 'utf8');
assert.match(surfaceSource, /type: type \|\| 'button'/);
assert.match(surfaceSource, /Rotate credentials'[\s\S]+null, 'submit'/);
assert.match(surfaceSource, /dialForm\.addEventListener\('submit', \(event\) => context\.originate\(event\)\)/);
assert.match(surfaceSource, /button\(_\('Call'\), 'qvoip-button--primary', null, 'submit'\)/);
assert.doesNotMatch(surfaceSource, /button\(_\('Call'\)[^\n]+context\.originate/);
assert.match(surfaceSource, /key\.disabled = true/);
assert.match(surfaceSource, /key\.setAttribute\('aria-describedby', 'qvoip-keypad-help'\)/);
assert.match(surfaceSource, /context\.refs\.callDetail, context\.refs\.dialForm, context\.refs\.actions, context\.refs\.overlay/);
assert.match(surfaceSource, /context\.refs\.enableLabel/);
assert.match(surfaceSource, /context\.refs\.enableLabel = node\('span', \{\}, \[ _\('Disabled'\) \]\)/);

const viewSource = fs.readFileSync(path.resolve(__dirname, '../htdocs/luci-static/resources/view/qmodem-voip/call.js'), 'utf8');
assert.match(viewSource, /'require rpc as luciRpc';/);
assert.match(viewSource, /luciRpc\.getSessionID\(\)/);
assert.doesNotMatch(viewSource, /crypto\.randomUUID\(\)/);
assert.match(viewSource, /this\.refs\.enableLabel\.textContent = model\.enabled \? _\('Enabled'\) : _\('Disabled'\)/);
const cssSource = fs.readFileSync(path.resolve(__dirname, '../htdocs/luci-static/resources/qmodem-voip/qmodem-voip.css'), 'utf8');
assert.match(cssSource, /\.qvoip-form \{ align-items: flex-start; \}/);
assert.match(cssSource, /\.qvoip-dial-form, \.qvoip-actions \{ align-items: end; \}/);
assert.match(cssSource, /\.qvoip-form > \.qvoip-button \{ align-self: end; \}/);

console.log('PASS: qmodem voip reducer contract');
