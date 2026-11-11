// SPDX-License-Identifier: GPL-2.0
// Copyright (C) 2026 perz3us
#include <stdio.h>
#include <string.h>
#include <strings.h>
#include "call.h"

static const char *names[] = { "off", "idle", "dialing", "alerting", "ringing", "active", "ending" };

const char *call_state_name(enum cstate st)
{
	return st <= C_ENDING ? names[st] : "off";
}

void call_reset(struct call *c)
{
	c->st = C_IDLE;
	strcpy(c->origin, "none");
	strcpy(c->answered_by, "none");
	c->number[0] = 0;
}

void call_dial(struct call *c, const char *who, const char *number)
{
	call_reset(c);
	c->st = C_DIALING;
	snprintf(c->origin, sizeof(c->origin), "%s", who);
	snprintf(c->number, sizeof(c->number), "%s", number);
}

void call_from_clcc(struct call *c, const struct clcc_call *v, int n)
{
	const struct clcc_call *pick = NULL;
	int i;

	for (i = 0; i < n; i++)
		if (!pick || (pick->stat == CLCC_HELD && v[i].stat != CLCC_HELD))
			pick = &v[i];
	if (!pick) {
		call_reset(c);
		return;
	}
	if (c->st == C_ENDING)
		return;
	if (pick->number[0])
		snprintf(c->number, sizeof(c->number), "%s", pick->number);
	switch (pick->stat) {
	case CLCC_INCOMING:
	case CLCC_WAITING:
		c->st = C_RINGING;
		if (!strcmp(c->origin, "none"))
			strcpy(c->origin, "network");
		break;
	case CLCC_DIALING:
		c->st = C_DIALING;
		break;
	case CLCC_ALERTING:
		c->st = C_ALERTING;
		break;
	default:
		c->st = C_ACTIVE;
		if (!strcmp(c->answered_by, "none") && strcmp(c->origin, "network") && strcmp(c->origin, "none"))
			snprintf(c->answered_by, sizeof(c->answered_by), "%s", c->origin);
		break;
	}
}

int codec_kind(int pt, const char *name)
{
	if (!strcasecmp(name, "opus"))
		return C_OPUS;
	if (!strcasecmp(name, "G722") || (!name[0] && pt == 9))
		return C_G722;
	if (!strcasecmp(name, "PCMA") || (!name[0] && pt == 8))
		return C_PCMA;
	if (!strcasecmp(name, "PCMU") || (!name[0] && pt == 0))
		return C_PCMU;
	return C_NONE;
}

static int rank(int kind, int hd)
{
	switch (kind) {
	case C_OPUS: return hd ? 0 : -1;
	case C_G722: return hd ? 1 : -1;
	case C_PCMA: return 2;
	case C_PCMU: return 3;
	}
	return -1;
}

int sdp_pick(const int *pt, const char **names, int n, int hd, int first)
{
	int i, r, best = -1, best_r = 99;

	for (i = 0; i < n; i++) {
		r = rank(codec_kind(pt[i], names[i]), hd);
		if (r < 0)
			continue;
		if (first)
			return pt[i];
		if (r < best_r) {
			best_r = r;
			best = pt[i];
		}
	}
	return best;
}
