// SPDX-License-Identifier: GPL-2.0
// Copyright (C) 2026 perz3us
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "../src/modem.h"

static const char *dir(void)
{
	const char *d = getenv("MSIP_FAKE");

	return d ? d : "/tmp/msip-fake";
}

int modem_at_wait(const char *cmd, char *resp, size_t n, int secs, const char *until)
{
	char path[256];
	FILE *f;
	size_t got = 0;

	(void)secs;
	(void)until;
	snprintf(path, sizeof(path), "%s/at.log", dir());
	if (strcmp(cmd, "AT+CLCC") && (f = fopen(path, "a"))) {
		fprintf(f, "%s\n", cmd);
		fclose(f);
	}
	resp[0] = 0;
	if (!strcmp(cmd, "AT+CLCC")) {
		snprintf(path, sizeof(path), "%s/clcc", dir());
		if ((f = fopen(path, "r"))) {
			got = fread(resp, 1, n - 8, f);
			fclose(f);
		}
	}
	snprintf(resp + got, n - got, "OK\r\n");
	return 0;
}

int modem_at(const char *cmd, char *resp, size_t n)
{
	return modem_at_wait(cmd, resp, n, 3, NULL);
}
