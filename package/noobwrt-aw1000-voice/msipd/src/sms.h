// SPDX-License-Identifier: GPL-2.0
// Copyright (C) 2026 perz3us
#ifndef SMS_H
#define SMS_H

/* Total SMS send attempts, including the first one. */
#define SMS_TRIES	3

/*
 * 1 if a failed SMS send may be tried again, 0 if it must be dropped.
 * err is non-zero when there was no response at all (timeout, transport
 * error); scode is the SIP final response code, or 0 when there was none.
 * attempts is the number of attempts already made, including this one.
 */
int sms_should_retry(int err, int scode, int attempts);

/* 1 for a failure that is worth retrying (had the attempt cap allowed it). */
int sms_transient(int err, int scode);

#endif
