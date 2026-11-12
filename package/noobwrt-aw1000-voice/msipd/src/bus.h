/* SPDX-License-Identifier: GPL-2.0 */
/* Copyright (C) 2026 perz3us */
#ifndef BUS_H
#define BUS_H

#include "call.h"

int ctl_dial(const char *number);
int ctl_answer(void);
void ctl_hangup(void);
int ctl_digit(char d);
const struct call *ctl_call(void);

int bus_start(void);
int bus_fd(void);
void bus_handle(void);
void bus_notify(const struct call *c);
void bus_stop(void);

#endif
