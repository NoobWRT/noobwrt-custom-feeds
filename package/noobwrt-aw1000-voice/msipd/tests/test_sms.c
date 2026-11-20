// SPDX-License-Identifier: GPL-2.0
// Copyright (C) 2026 perz3us
#include <assert.h>
#include <stdio.h>
#include "../src/sms.h"

static const int transient[] = { 408, 480, 486, 491, 500, 502, 503, 504, 600 };
static const int permanent[] = { 301, 302, 400, 401, 403, 404, 405, 407, 413,
				 415, 481, 488, 501, 603, 604, 606 };

int main(void)
{
	size_t i;

	/* delivered: 1xx and 2xx are never retried */
	assert(sms_should_retry(0, 200, 1) == 0);
	assert(sms_should_retry(0, 180, 1) == 0);
	assert(sms_should_retry(0, 299, 1) == 0);
	assert(sms_transient(0, 200) == 0);

	/* hard refusals are terminal from the first attempt */
	for (i = 0; i < sizeof(permanent) / sizeof(permanent[0]); i++) {
		assert(sms_should_retry(0, permanent[i], 1) == 0);
		assert(sms_transient(0, permanent[i]) == 0);
	}

	/* transient failures are retried while under the cap */
	for (i = 0; i < sizeof(transient) / sizeof(transient[0]); i++) {
		assert(sms_should_retry(0, transient[i], 1) == 1);
		assert(sms_should_retry(0, transient[i], SMS_TRIES - 1) == 1);
		assert(sms_should_retry(0, transient[i], SMS_TRIES) == 0);
		assert(sms_transient(0, transient[i]) == 1);
	}

	/* no response at all is transient */
	assert(sms_should_retry(1, 0, 1) == 1);
	assert(sms_should_retry(1, 0, SMS_TRIES - 1) == 1);
	assert(sms_should_retry(1, 0, SMS_TRIES) == 0);
	assert(sms_transient(1, 0) == 1);

	/* a final refusal wins over a transport error (libre may pass both) */
	assert(sms_should_retry(1, 415, 1) == 0);
	assert(sms_transient(1, 415) == 0);
	assert(sms_should_retry(1, 403, 1) == 0);
	assert(sms_should_retry(1, 503, 1) == 1);
	assert(sms_should_retry(1, 503, SMS_TRIES) == 0);

	printf("test_sms ok (SMS_TRIES=%d)\n", SMS_TRIES);
	return 0;
}
