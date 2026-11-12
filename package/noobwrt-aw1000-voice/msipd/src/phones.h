/* SPDX-License-Identifier: GPL-2.0 */
/* Copyright (C) 2026 perz3us */
#ifndef PHONES_H
#define PHONES_H

#define PHONES_MAX	16
#define REALM		"modem-sip"

struct phone {
	char name[24];
	char user[16];
	char password[32];
	char contact[128];
	char ip[48];
	int port;
	long expires_at;
};

int phones_load(const char *uci_dir);
const struct phone *phone_by_user(const char *user);
int auth_check(const char *ip, const struct phone *p, const char *method, const char *uri,
	       const char *nonce, const char *response, long now);
int auth_banned(const char *ip, long now);
void reg_set(const char *user, const char *contact, const char *ip, int port, long expires_at);
int reg_online(long now, const struct phone **out, int max);
const char *reg_name(const char *user);
int phones_all(const struct phone **out, int max);

#endif
