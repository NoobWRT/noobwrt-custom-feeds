'use strict';
'require rpc';
'require qmodem-voip.contract as contract';

const calls = {};

Object.keys(contract.METHODS).forEach((name) => {
	calls[name] = rpc.declare({
		object: contract.OBJECT,
		method: contract.METHODS[name],
		params: contract.PARAMS[name],
		expect: {}
	});
});

const api = Object.assign({}, calls, { eventTopic: contract.EVENT_TOPIC });

return Object.freeze(api);
