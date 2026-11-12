// SPDX-License-Identifier: GPL-2.0
// Copyright (C) 2026 perz3us
#include <assert.h>
#include <stdio.h>
#include <string.h>
#include "../src/call.h"

static struct clcc_call mk(int dir, int stat, const char *num)
{
	struct clcc_call c = { .id = 1, .dir = dir, .stat = stat };

	snprintf(c.number, sizeof(c.number), "%s", num);
	return c;
}

static void incoming_rings(void)
{
	struct call c;
	struct clcc_call v = mk(1, CLCC_INCOMING, "+94771234567");

	call_reset(&c);
	call_from_clcc(&c, &v, 1);
	assert(c.st == C_RINGING && !strcmp(c.origin, "network") && !strcmp(c.number, "+94771234567"));
	assert(!strcmp(c.answered_by, "none"));
	assert(!strcmp(call_state_name(c.st), "ringing"));
}

static void outgoing_flow(void)
{
	struct call c;
	struct clcc_call v = mk(0, CLCC_DIALING, "0771234567");

	call_reset(&c);
	call_dial(&c, "Laptop", "0771234567");
	assert(c.st == C_DIALING && !strcmp(c.origin, "Laptop"));
	call_from_clcc(&c, &v, 1);
	assert(c.st == C_DIALING);
	v.stat = CLCC_ALERTING;
	call_from_clcc(&c, &v, 1);
	assert(c.st == C_ALERTING);
	v.stat = CLCC_ACTIVE;
	call_from_clcc(&c, &v, 1);
	assert(c.st == C_ACTIVE && !strcmp(c.origin, "Laptop") && !strcmp(c.answered_by, "Laptop"));
}

static void none_is_idle(void)
{
	struct call c;
	struct clcc_call v = mk(1, CLCC_ACTIVE, "0771234567");

	call_reset(&c);
	call_from_clcc(&c, &v, 1);
	call_from_clcc(&c, NULL, 0);
	assert(c.st == C_IDLE && !strcmp(c.origin, "none") && !c.number[0]);
}

static void ending_waits_for_modem(void)
{
	struct call c;
	struct clcc_call v = mk(1, CLCC_ACTIVE, "0771234567");

	call_reset(&c);
	call_from_clcc(&c, &v, 1);
	c.st = C_ENDING;
	call_from_clcc(&c, &v, 1);
	assert(c.st == C_ENDING);
	call_from_clcc(&c, NULL, 0);
	assert(c.st == C_IDLE);
}

static void codecs(void)
{
	int g722_only[] = { 9 }, all[] = { 0, 8, 9, 101 }, ulaw_alaw[] = { 0, 8 };
	const char *n1[] = { "G722" }, *n4[] = { "PCMU", "PCMA", "G722", "telephone-event" }, *n2[] = { "PCMU", "PCMA" };

	assert(sdp_pick(g722_only, n1, 1, 0, 0) == -1);
	assert(sdp_pick(g722_only, n1, 1, 1, 0) == 9);
	assert(sdp_pick(all, n4, 4, 1, 0) == 9);
	assert(sdp_pick(all, n4, 4, 0, 0) == 8);
	assert(sdp_pick(ulaw_alaw, n2, 2, 1, 0) == 8);

	int linphone[] = { 96, 97, 98, 0, 8, 18, 101, 99, 100 }, nameless_g722[] = { 9, 0 };
	const char *ln[] = { "opus", "speex", "speex", "", "", "", "telephone-event", "", "" }, *ng[] = { "", "" };

	assert(sdp_pick(linphone, ln, 9, 0, 0) == 8);
	assert(sdp_pick(linphone, ln, 9, 1, 0) == 96);
	assert(sdp_pick(nameless_g722, ng, 2, 1, 0) == 9);
	assert(sdp_pick(nameless_g722, ng, 2, 0, 0) == 0);

	int answer[] = { 0, 9, 8 };
	const char *na[] = { "", "G722", "" };

	assert(sdp_pick(answer, na, 3, 1, 1) == 0);
	assert(sdp_pick(nameless_g722, ng, 2, 0, 1) == 0);
	assert(sdp_pick(linphone, ln, 9, 1, 1) == 96);
	assert(sdp_pick(linphone, ln, 9, 0, 1) == 0);

	assert(codec_kind(96, "opus") == C_OPUS && codec_kind(111, "OPUS") == C_OPUS);
	assert(codec_kind(9, "") == C_G722 && codec_kind(9, "G722") == C_G722);
	assert(codec_kind(8, "") == C_PCMA && codec_kind(0, "") == C_PCMU);
	assert(codec_kind(97, "speex") == C_NONE && codec_kind(18, "") == C_NONE);
}

int main(void)
{
	incoming_rings();
	outgoing_flow();
	none_is_idle();
	ending_waits_for_modem();
	codecs();
	puts("test_call ok");
	return 0;
}
