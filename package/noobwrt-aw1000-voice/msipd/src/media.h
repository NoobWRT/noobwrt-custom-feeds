/* SPDX-License-Identifier: GPL-2.0 */
/* Copyright (C) 2026 perz3us */
#ifndef MEDIA_H
#define MEDIA_H

#include <re.h>

#define PT_PCMU		0
#define PT_PCMA		8
#define PT_G722		9
#define PT_DTMF		101

typedef void (media_dtmf_h)(char digit);

int media_open(const struct sa *laddr, uint16_t from, uint16_t to, media_dtmf_h *dtmfh);
uint16_t media_port(void);
void media_close(void);
int media_offer(struct mbuf **mb, const struct sa *laddr, int hd);
int media_answer(struct mbuf **mb, const struct sa *laddr, struct mbuf *offer, int hd);
int media_take_answer(struct mbuf *answer, int hd);

#endif
