// SPDX-License-Identifier: GPL-2.0
// Copyright (C) 2026 perz3us
#include "sms.h"

/*
 * A final SIP answer wins over a transport error: libre may hand us both,
 * and an explicit 415 must not be mistaken for "no answer".
 */
int sms_transient(int err, int scode)
{
	if (scode >= 300) {
		switch (scode) {
		case 408:	/* Request Timeout */
		case 480:	/* Temporarily Unavailable */
		case 486:	/* Busy Here */
		case 491:	/* Request Pending */
		case 500:	/* Server Internal Error */
		case 502:	/* Bad Gateway */
		case 503:	/* Service Unavailable */
		case 504:	/* Server Time-out */
		case 600:	/* Busy Everywhere */
			return 1;
		default:
			return 0;
		}
	}
	if (err || scode <= 0)
		return 1;
	return 0;
}

int sms_should_retry(int err, int scode, int attempts)
{
	if (!sms_transient(err, scode))
		return 0;
	return attempts < SMS_TRIES;
}
