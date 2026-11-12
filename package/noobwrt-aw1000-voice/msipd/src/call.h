/* SPDX-License-Identifier: GPL-2.0 */
/* Copyright (C) 2026 perz3us */
#ifndef CALL_H
#define CALL_H

#include "clcc.h"

enum cstate { C_OFF, C_IDLE, C_DIALING, C_ALERTING, C_RINGING, C_ACTIVE, C_ENDING };

struct call {
	enum cstate st;
	char origin[24];
	char answered_by[24];
	char number[CLCC_NUM_MAX];
};

const char *call_state_name(enum cstate st);
void call_reset(struct call *c);
void call_dial(struct call *c, const char *who, const char *number);
void call_from_clcc(struct call *c, const struct clcc_call *v, int n);
enum codec { C_NONE, C_OPUS, C_G722, C_PCMA, C_PCMU };

int codec_kind(int pt, const char *name);
int sdp_pick(const int *pt, const char **names, int n, int hd, int first);
const char *media_codec(void);

#endif
