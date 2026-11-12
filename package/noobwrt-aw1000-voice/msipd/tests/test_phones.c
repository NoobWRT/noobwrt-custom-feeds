// SPDX-License-Identifier: GPL-2.0
// Copyright (C) 2026 perz3us
#include <assert.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "../src/phones.h"

#define DIR "/tmp/msip-test"
#define GOOD "08d828e8ae2fbba40b73d5e75d172b83"
#define NONCE "4f7a9c1e2b3d"
#define URI "sip:192.168.1.1"

static void write_config(const char *body)
{
	FILE *f;

	system("rm -rf " DIR " && mkdir -p " DIR);
	f = fopen(DIR "/modem_sip", "w");
	fputs(body, f);
	fclose(f);
}

static const char *pixel =
	"config phone\n\toption name 'Pixel'\n\toption user 'p1a2b3c'\n\toption password 'Kq3vX9mZr2LtW8yPb5Nd'\n"
	"config phone\n\toption name 'Laptop'\n\toption user 'pa0b1c2'\n\toption password 'Zz9Yy8Xx7Ww6Vv5Uu4Tt'\n";

static void digest_ok(void)
{
	const struct phone *p = phone_by_user("p1a2b3c");

	assert(p && !strcmp(p->name, "Pixel"));
	assert(auth_check("10.0.0.5", p, "REGISTER", URI, NONCE, GOOD, 1000) == 0);
}

static void five_fails_bans(void)
{
	const struct phone *p = phone_by_user("p1a2b3c");
	int i;

	for (i = 0; i < 5; i++)
		assert(auth_check("10.0.0.6", p, "REGISTER", URI, NONCE, "00000000000000000000000000000000", 2000) == -1);
	assert(auth_check("10.0.0.6", p, "REGISTER", URI, NONCE, GOOD, 2000) == -2);
	assert(auth_check("10.0.0.6", p, "REGISTER", URI, NONCE, GOOD, 2600) == -2);
	assert(auth_check("10.0.0.6", p, "REGISTER", URI, NONCE, GOOD, 2601) == 0);
}

static void reload_lifts_bans(void)
{
	const struct phone *p = phone_by_user("p1a2b3c");
	int i;

	for (i = 0; i < 5; i++)
		auth_check("10.0.0.9", p, "REGISTER", URI, NONCE, "00000000000000000000000000000000", 3000);
	assert(auth_banned("10.0.0.9", 3000));
	assert(auth_check("10.0.0.9", p, "REGISTER", URI, NONCE, GOOD, 3001) == -2);
	write_config(pixel);
	assert(phones_load(DIR) == 2);
	assert(!auth_banned("10.0.0.9", 3001));
	p = phone_by_user("p1a2b3c");
	assert(auth_check("10.0.0.9", p, "REGISTER", URI, NONCE, GOOD, 3001) == 0);
}

static void ban_is_per_ip(void)
{
	const struct phone *p = phone_by_user("p1a2b3c");
	int i;

	for (i = 0; i < 5; i++)
		auth_check("10.0.0.7", p, "REGISTER", URI, NONCE, "bad", 3000);
	assert(auth_check("10.0.0.7", p, "REGISTER", URI, NONCE, GOOD, 3000) == -2);
	assert(auth_check("10.0.0.8", p, "REGISTER", URI, NONCE, GOOD, 3000) == 0);
}

static void expired_contact_not_rung(void)
{
	const struct phone *on[4];

	reg_set("p1a2b3c", "sip:p1a2b3c@10.0.0.5:5062", "10.0.0.5", 5062, 100);
	reg_set("pa0b1c2", "sip:pa0b1c2@10.0.0.9:5064", "10.0.0.9", 5064, 500);
	assert(reg_online(99, on, 4) == 2);
	assert(reg_online(101, on, 4) == 1 && !strcmp(on[0]->name, "Laptop"));
	assert(!strcmp(reg_name("pa0b1c2"), "Laptop"));
	reg_set("pa0b1c2", "", "", 0, 0);
	assert(reg_online(101, on, 4) == 0);
}

static void reload_keeps_registrations(void)
{
	const struct phone *on[4];

	write_config(pixel);
	phones_load(DIR);
	reg_set("p1a2b3c", "sip:p1a2b3c@10.0.0.5:5062", "10.0.0.5", 5062, 9000);
	assert(phones_load(DIR) == 2);
	assert(reg_online(100, on, 4) == 1 && !strcmp(on[0]->contact, "sip:p1a2b3c@10.0.0.5:5062"));
	assert(phones_all(on, 4) == 2);
}

static void unknown_user_rejected(void)
{
	assert(!phone_by_user("nobody"));
	assert(auth_check("10.0.0.5", NULL, "REGISTER", URI, NONCE, GOOD, 4000) == -1);
}

static void bad_name_rejected(void)
{
	write_config("config phone\n\toption name 'Bad;name'\n\toption user 'p000001'\n\toption password 'Aaaaaaaaaaaaaaaaaaaa'\n"
		     "config phone\n\toption name 'ThisNameIsWayTooLongToUse'\n\toption user 'p000002'\n\toption password 'Bbbbbbbbbbbbbbbbbbbb'\n"
		     "config phone\n\toption name 'Kitchen phone'\n\toption user 'p000003'\n\toption password 'Cccccccccccccccccccc'\n");
	assert(phones_load(DIR) == 1);
	assert(!phone_by_user("p000001") && !phone_by_user("p000002"));
	assert(phone_by_user("p000003"));
}

#define PH(n, u, pw) "config phone\n\toption name '" n "'\n\toption user '" u "'\n\toption password '" pw "'\n"

static void password_rules(void)
{
	write_config(PH("a", "p000011", "my-pin.88") PH("b", "p000012", "short7!") PH("c", "p000013", "has space1")
		     PH("d", "p000014", "quote\"inside") PH("e", "p000015", "Aa1!Aa1!Aa1!Aa1!Aa1!Aa1!Aa1!Aa1!")
		     PH("f", "p000016", "Aa1!Aa1!Aa1!Aa1!Aa1!Aa1!Aa1!Aa1"));
	assert(phones_load(DIR) == 2);
	assert(phone_by_user("p000011") && phone_by_user("p000016"));
	assert(!phone_by_user("p000012") && !phone_by_user("p000013") && !phone_by_user("p000014") && !phone_by_user("p000015"));
}

int main(void)
{
	write_config(pixel);
	assert(phones_load(DIR) == 2);
	digest_ok();
	five_fails_bans();
	ban_is_per_ip();
	reload_lifts_bans();
	expired_contact_not_rung();
	reload_keeps_registrations();
	unknown_user_rejected();
	bad_name_rejected();
	password_rules();
	puts("test_phones ok");
	return 0;
}
