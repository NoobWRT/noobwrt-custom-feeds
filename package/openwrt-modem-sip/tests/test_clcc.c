// SPDX-License-Identifier: GPL-2.0
// Copyright (C) 2026 perz3us
#include <assert.h>
#include <stdio.h>
#include <string.h>
#include "../src/clcc.h"

int main(void)
{
	struct clcc_call c[CLCC_MAX];

	assert(clcc_parse_all("+CLCC: 1,1,0,1,0,\"\",128\r\n+CLCC: 2,1,0,1,0,\"\",128\r\nOK\r\n", c, CLCC_MAX) == 0);
	assert(clcc_parse_all("+CLCC: 1,1,0,1,0,\"\",128\r\n+CLCC: 4,1,4,0,0,\"+94771234567\",145\r\nOK\r\n", c, CLCC_MAX) == 1);
	assert(c[0].id == 4 && c[0].dir == 1 && c[0].stat == CLCC_INCOMING && !strcmp(c[0].number, "+94771234567"));
	assert(clcc_parse_all("+CLCC: 1,0,3,0,0,\"0771234567\",129\r\nOK\r\n", c, CLCC_MAX) == 1);
	assert(c[0].dir == 0 && c[0].stat == CLCC_ALERTING);
	assert(clcc_parse_all("+CLCC: 1,1,4,0,0,\"\",128\r\nOK\r\n", c, CLCC_MAX) == 1 && !c[0].number[0]);
	assert(clcc_parse_all("OK\r\n", c, CLCC_MAX) == 0);
	puts("test_clcc ok");
	return 0;
}
