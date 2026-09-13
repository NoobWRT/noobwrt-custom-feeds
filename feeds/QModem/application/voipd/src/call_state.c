#include "call_state.h"

#include <ctype.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

static int endpoint_is_source(enum qmodem_voip_endpoint endpoint)
{
	return endpoint == QMODEM_VOIP_ENDPOINT_BROWSER ||
	       endpoint == QMODEM_VOIP_ENDPOINT_LAN_SIP;
}

static int valid_number(const char *number)
{
	size_t i;
	if (!number || !number[0] || strlen(number) >= QMODEM_VOIP_NUMBER_SIZE)
		return 0;
	for (i = 0; number[i]; i++) {
		if (!(isdigit((unsigned char)number[i]) || number[i] == '+' ||
		      number[i] == '*' || number[i] == '#' || number[i] == ',' ||
		      number[i] == 'p'))
			return 0;
	}
	return 1;
}

static void issue(qmodem_voip_command_fn command, void *opaque,
			  const char *value)
{
	if (command)
		command(value, opaque);
}

static void notify(qmodem_voip_event_fn event,
			   const struct qmodem_voip_call *call,
			   const char *name, void *opaque)
{
	qmodem_voip_call_touch((struct qmodem_voip_call *)call);
	if (event)
		event(call, name, opaque);
}

void qmodem_voip_call_touch(struct qmodem_voip_call *call)
{
	call->revision++;
}

void qmodem_voip_call_init(struct qmodem_voip_call *call)
{
	memset(call, 0, sizeof(*call));
	call->state = QMODEM_VOIP_DISABLED;
	call->origin = QMODEM_VOIP_ENDPOINT_NONE;
	call->endpoint = QMODEM_VOIP_ENDPOINT_NONE;
}

void qmodem_voip_call_set_enabled(struct qmodem_voip_call *call, int enabled)
{
	call->enabled = enabled != 0;
	if (!call->enabled) {
		call->state = QMODEM_VOIP_DISABLED;
		call->origin = QMODEM_VOIP_ENDPOINT_NONE;
		call->endpoint = QMODEM_VOIP_ENDPOINT_NONE;
		call->number[0] = '\0';
		call->answer_owner = QMODEM_VOIP_ENDPOINT_NONE;
		call->reconcile_pending = 0;
	} else if (call->state == QMODEM_VOIP_DISABLED) {
		call->state = QMODEM_VOIP_IDLE;
	}
	qmodem_voip_call_touch(call);
}

int qmodem_voip_endpoint_parse(const char *value,
				       enum qmodem_voip_endpoint *endpoint)
{
	if (!value || !endpoint)
		return -1;
	if (strcmp(value, "browser") == 0)
		*endpoint = QMODEM_VOIP_ENDPOINT_BROWSER;
	else if (strcmp(value, "lan_sip") == 0)
		*endpoint = QMODEM_VOIP_ENDPOINT_LAN_SIP;
	else if (strcmp(value, "cellular") == 0)
		*endpoint = QMODEM_VOIP_ENDPOINT_CELLULAR;
	else if (strcmp(value, "external_sip") == 0)
		*endpoint = QMODEM_VOIP_ENDPOINT_EXTERNAL_SIP;
	else
		return -1;
	return 0;
}

const char *qmodem_voip_state_name(enum qmodem_voip_state state)
{
	static const char *const names[] = {
		[QMODEM_VOIP_DISABLED] = "disabled",
		[QMODEM_VOIP_IDLE] = "idle",
		[QMODEM_VOIP_OUTGOING_SETUP] = "outgoing_setup",
		[QMODEM_VOIP_INCOMING_RINGING] = "incoming_ringing",
		[QMODEM_VOIP_EARLY_MEDIA] = "early_media",
		[QMODEM_VOIP_ACTIVE] = "active",
		[QMODEM_VOIP_TERMINATING] = "terminating",
		[QMODEM_VOIP_RECOVERING] = "recovering",
		[QMODEM_VOIP_FAULT] = "fault"
	};
	if ((unsigned)state >= sizeof(names) / sizeof(names[0]) || !names[state])
		return "fault";
	return names[state];
}

const char *qmodem_voip_endpoint_name(enum qmodem_voip_endpoint endpoint)
{
	switch (endpoint) {
	case QMODEM_VOIP_ENDPOINT_BROWSER: return "browser";
	case QMODEM_VOIP_ENDPOINT_LAN_SIP: return "lan_sip";
	case QMODEM_VOIP_ENDPOINT_CELLULAR: return "cellular";
	case QMODEM_VOIP_ENDPOINT_EXTERNAL_SIP: return "external_sip";
	default: return "none";
	}
}

int qmodem_voip_originate(struct qmodem_voip_call *call,
				  enum qmodem_voip_endpoint origin,
				  const char *number,
				  qmodem_voip_command_fn command, void *opaque)
{
	char at_command[QMODEM_VOIP_NUMBER_SIZE + 8];
	if (!call->enabled || !endpoint_is_source(origin) || !valid_number(number))
		return -1;
	if (call->state != QMODEM_VOIP_IDLE)
		return -3;
	if (snprintf(at_command, sizeof(at_command), "ATD%s;", number) < 0)
		return -1;
	call->origin = origin;
	call->endpoint = QMODEM_VOIP_ENDPOINT_CELLULAR;
	strncpy(call->number, number, sizeof(call->number) - 1);
	call->number[sizeof(call->number) - 1] = '\0';
	call->caller_id_withheld = 0;
	call->answer_owner = QMODEM_VOIP_ENDPOINT_NONE;
	call->reconcile_voice_misses = 0;
	call->state = QMODEM_VOIP_OUTGOING_SETUP;
	qmodem_voip_call_touch(call);
	issue(command, opaque, at_command);
	return 0;
}

int qmodem_voip_answer(struct qmodem_voip_call *call,
			       enum qmodem_voip_endpoint endpoint,
			       qmodem_voip_command_fn command, void *opaque)
{
	if (!call->enabled || !endpoint_is_source(endpoint))
		return -1;
	if (call->answer_owner != QMODEM_VOIP_ENDPOINT_NONE)
		return -3;
	if (call->state != QMODEM_VOIP_INCOMING_RINGING &&
	    call->state != QMODEM_VOIP_EARLY_MEDIA)
		return -2;
	call->answer_owner = endpoint;
	call->state = QMODEM_VOIP_ACTIVE;
	qmodem_voip_call_touch(call);
	issue(command, opaque, "ATA");
	return 0;
}

static int terminate(struct qmodem_voip_call *call,
			     enum qmodem_voip_endpoint endpoint,
			     qmodem_voip_command_fn command, void *opaque)
{
	if (!call->enabled || !endpoint_is_source(endpoint))
		return -1;
	if (call->state == QMODEM_VOIP_IDLE ||
	    call->state == QMODEM_VOIP_DISABLED)
		return 0;
	if (call->state == QMODEM_VOIP_TERMINATING)
		return 0;
	call->state = QMODEM_VOIP_TERMINATING;
	qmodem_voip_call_touch(call);
	issue(command, opaque, "AT+CHUP");
	return 0;
}

int qmodem_voip_reject(struct qmodem_voip_call *call,
			       enum qmodem_voip_endpoint endpoint,
			       qmodem_voip_command_fn command, void *opaque)
{
	if (call->state == QMODEM_VOIP_INCOMING_RINGING ||
	    call->state == QMODEM_VOIP_EARLY_MEDIA)
		return terminate(call, endpoint, command, opaque);
	return call->state == QMODEM_VOIP_IDLE ||
	       call->state == QMODEM_VOIP_TERMINATING ? 0 : -2;
}

int qmodem_voip_hangup(struct qmodem_voip_call *call,
			       enum qmodem_voip_endpoint endpoint,
			       qmodem_voip_command_fn command, void *opaque)
{
	return terminate(call, endpoint, command, opaque);
}

int qmodem_voip_start_recovery(struct qmodem_voip_call *call,
				       qmodem_voip_command_fn command, void *opaque)
{
	if (!call->enabled)
		return -1;
	call->state = QMODEM_VOIP_RECOVERING;
	call->reconcile_pending = 1;
	call->reconcile_command_id = 0;
	call->reconcile_saw_data = 0;
	qmodem_voip_call_touch(call);
	issue(command, opaque, "AT+CLCC");
	return 0;
}

int qmodem_voip_poll_active(struct qmodem_voip_call *call,
			    qmodem_voip_command_fn command, void *opaque)
{
	if (!call || !call->enabled ||
	    (call->state != QMODEM_VOIP_OUTGOING_SETUP &&
	     call->state != QMODEM_VOIP_EARLY_MEDIA &&
	     call->state != QMODEM_VOIP_ACTIVE &&
	     call->state != QMODEM_VOIP_TERMINATING) ||
	    call->reconcile_pending)
		return -1;
	call->reconcile_pending = 1;
	call->reconcile_command_id = 0;
	issue(command, opaque, "AT+CLCC");
	return 0;
}

static int has_prefix(const char *line, const char *prefix)
{
	return strncmp(line, prefix, strlen(prefix)) == 0;
}

static int clip_number(struct qmodem_voip_call *call, const char *line)
{
	const char *first = strchr(line, '"');
	const char *last;
	size_t length;
	if (!first)
		return 0;
	last = strchr(first + 1, '"');
	if (!last)
		return 0;
	length = (size_t)(last - first - 1);
	if (length == 0) {
		call->caller_id_withheld = 1;
		call->number[0] = '\0';
		return 1;
	}
	if (length >= sizeof(call->number))
		return 0;
	memcpy(call->number, first + 1, length);
	call->number[length] = '\0';
	call->caller_id_withheld = 0;
	return 1;
}

static int clcc_status(const char *line, int *status, int *mode,
			       int *empty_number)
{
	const char *p = strchr(line, ':');
	char *end;
	long value;
	const char *quote;
	if (!p)
		return 0;
	p++;
	(void)strtol(p, &end, 10);
	if (end == p || *end != ',')
		return 0;
	p = end + 1;
	(void)strtol(p, &end, 10);
	if (end == p || *end != ',')
		return 0;
	p = end + 1;
	value = strtol(p, &end, 10);
	if (end == p || *end != ',')
		return 0;
	*status = (int)value;
	p = end + 1;
	*mode = (int)strtol(p, &end, 10);
	if (end == p || *end != ',')
		return 0;
	quote = strchr(end + 1, '"');
	*empty_number = quote && quote[1] == '"';
	return 1;
}

static void clear_call(struct qmodem_voip_call *call)
{
	call->state = call->enabled ? QMODEM_VOIP_IDLE : QMODEM_VOIP_DISABLED;
	call->origin = QMODEM_VOIP_ENDPOINT_NONE;
	call->endpoint = QMODEM_VOIP_ENDPOINT_NONE;
	call->number[0] = '\0';
	call->caller_id_withheld = 0;
	call->answer_owner = QMODEM_VOIP_ENDPOINT_NONE;
	call->reconcile_voice_misses = 0;
	qmodem_voip_call_touch(call);
}

int qmodem_voip_line(struct qmodem_voip_call *call, uint64_t epoch,
			    uint64_t sequence, const char *raw,
			    enum qmodem_voip_correlation correlation,
			    uint64_t command_id, uint64_t drop_count,
			    qmodem_voip_command_fn command,
			    qmodem_voip_event_fn event, void *opaque)
{
	int status;
	int mode;
	int empty_number;
	int correlated_reconcile = 0;
	int gap;
	if (!call->enabled || !raw)
		return -1;
	if (call->restart_epoch != 0 && epoch < call->restart_epoch)
		return 1;
	if (call->restart_epoch != 0 && epoch == call->restart_epoch &&
	    sequence <= call->sequence)
		return 1;
	gap = call->restart_epoch != 0 &&
	      (epoch != call->restart_epoch || sequence > call->sequence + 1);
	if (gap) {
		call->state = QMODEM_VOIP_RECOVERING;
		call->reconcile_pending = 1;
		call->reconcile_command_id = 0;
		issue(command, opaque, "AT+CLCC");
		notify(event, call, "event_gap", opaque);
	}
	call->restart_epoch = epoch;
	call->sequence = sequence;
	call->drop_count = drop_count;
	if (has_prefix(raw, "+CLIP:")) {
		(void)clip_number(call, raw);
		notify(event, call, "caller_id", opaque);
		return 0;
	}
	if (call->reconcile_pending && strcmp(raw, "OK") == 0 &&
	    correlation == QMODEM_VOIP_CORR_TERMINAL && command_id != 0 &&
	    (call->reconcile_command_id == 0 || command_id == call->reconcile_command_id)) {
		if ((call->state == QMODEM_VOIP_OUTGOING_SETUP ||
		     call->state == QMODEM_VOIP_EARLY_MEDIA ||
		     call->state == QMODEM_VOIP_ACTIVE) &&
		    ++call->reconcile_voice_misses < 2U) {
			call->reconcile_pending = 0;
			call->reconcile_command_id = 0;
			call->reconcile_saw_data = 0;
			notify(event, call, "reconcile_inconclusive", opaque);
			return 0;
		}
		if ((call->state != QMODEM_VOIP_OUTGOING_SETUP &&
		     call->state != QMODEM_VOIP_EARLY_MEDIA &&
		     call->state != QMODEM_VOIP_ACTIVE) ||
		    call->reconcile_voice_misses >= 2U)
			clear_call(call);
		call->reconcile_pending = 0;
		call->reconcile_command_id = 0;
		call->reconcile_saw_data = 0;
		notify(event, call, call->state == QMODEM_VOIP_ACTIVE ?
			"reconcile_inconclusive" : "reconcile_idle", opaque);
		return 0;
	}
	if (has_prefix(raw, "+CLCC:")) {
		if (!clcc_status(raw, &status, &mode, &empty_number))
			return 0;
		if (mode == 1) {
			if (call->reconcile_pending && command_id != 0 &&
			    correlation == QMODEM_VOIP_CORR_RESPONSE) {
				call->reconcile_saw_data = 1;
				if (call->reconcile_command_id == 0)
					call->reconcile_command_id = command_id;
			}
			return 0;
		}
		if (call->reconcile_pending && command_id != 0 &&
		    (correlation == QMODEM_VOIP_CORR_RESPONSE ||
		     correlation == QMODEM_VOIP_CORR_TERMINAL)) {
			correlated_reconcile = 1;
			if (call->reconcile_command_id == 0)
				call->reconcile_command_id = command_id;
			if (command_id == call->reconcile_command_id && empty_number) {
				notify(event, call, "phantom_clcc_quarantined", opaque);
				return 0;
			}
		}
		if (call->reconcile_pending && !correlated_reconcile)
			return 0;
		if (call->state == QMODEM_VOIP_TERMINATING) {
			call->reconcile_pending = 0;
			call->reconcile_command_id = 0;
			call->reconcile_voice_misses = 0;
			issue(command, opaque, "AT+CHUP");
			notify(event, call, "release_pending", opaque);
			return 0;
		}
		call->reconcile_pending = 0;
		call->reconcile_voice_misses = 0;
		switch (status) {
		case 0: call->state = QMODEM_VOIP_ACTIVE; break;
		case 1: case 2: call->state = QMODEM_VOIP_OUTGOING_SETUP; break;
		case 3: call->state = QMODEM_VOIP_EARLY_MEDIA; break;
		case 4: case 5: call->state = QMODEM_VOIP_INCOMING_RINGING; break;
		default: break;
		}
		notify(event, call, "call_state", opaque);
		return 0;
	}
	if (has_prefix(raw, "RING")) {
		if (call->state == QMODEM_VOIP_IDLE) {
			call->origin = QMODEM_VOIP_ENDPOINT_CELLULAR;
			call->endpoint = QMODEM_VOIP_ENDPOINT_CELLULAR;
			call->state = QMODEM_VOIP_INCOMING_RINGING;
			call->answer_owner = QMODEM_VOIP_ENDPOINT_NONE;
		}
		notify(event, call, "ring", opaque);
		return 0;
	}
	if (strcmp(raw, "NO CARRIER") == 0 || strcmp(raw, "BUSY") == 0 ||
	    strcmp(raw, "NO DIALTONE") == 0 || has_prefix(raw, "+CEND:")) {
		clear_call(call);
		notify(event, call, "release", opaque);
		return 0;
	}
	return 0;
}
