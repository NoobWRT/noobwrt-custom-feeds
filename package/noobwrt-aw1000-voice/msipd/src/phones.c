// SPDX-License-Identifier: GPL-2.0
// Copyright (C) 2026 perz3us
#include <ctype.h>
#include <stdio.h>
#include <string.h>
#include <re.h>
#include <uci.h>
#include "phones.h"

#define BAN_FAILS	5
#define BAN_SECS	600
#define BANS_MAX	32

static struct phone phones[PHONES_MAX];
static int nphones;

static struct {
	char ip[48];
	int fails;
	long until;
} bans[BANS_MAX];

static int valid_name(const char *s)
{
	size_t n = strlen(s), i;

	if (n < 1 || n > 23)
		return 0;
	for (i = 0; i < n; i++)
		if (!isalnum((unsigned char)s[i]) && !strchr(" _-", s[i]))
			return 0;
	return 1;
}

static int valid_user(const char *s)
{
	int i;

	if (strlen(s) != 7 || s[0] != 'p')
		return 0;
	for (i = 1; i < 7; i++)
		if (!isxdigit((unsigned char)s[i]) || isupper((unsigned char)s[i]))
			return 0;
	return 1;
}

static int valid_password(const char *s)
{
	size_t n = strlen(s), i;

	if (n < 8 || n > 31)
		return 0;
	for (i = 0; i < n; i++)
		if (!isalnum((unsigned char)s[i]) && !strchr("-_.!@#%+=:,", s[i]))
			return 0;
	return 1;
}

int phones_load(const char *uci_dir)
{
	static struct phone old[PHONES_MAX];
	int nold = nphones, i;
	struct uci_context *ctx = uci_alloc_context();
	struct uci_package *pkg = NULL;
	struct uci_element *e;

	memcpy(old, phones, sizeof(old));
	memset(bans, 0, sizeof(bans));
	nphones = 0;
	if (!ctx)
		return -1;
	if (uci_dir)
		uci_set_confdir(ctx, uci_dir);
	if (uci_load(ctx, "modem_sip", &pkg)) {
		uci_free_context(ctx);
		return -1;
	}
	uci_foreach_element(&pkg->sections, e) {
		struct uci_section *s = uci_to_section(e);
		const char *name = uci_lookup_option_string(ctx, s, "name");
		const char *user = uci_lookup_option_string(ctx, s, "user");
		const char *pass = uci_lookup_option_string(ctx, s, "password");
		struct phone *p;

		if (strcmp(s->type, "phone") || nphones >= PHONES_MAX || !name || !user || !pass ||
		    !valid_name(name) || !valid_user(user) || !valid_password(pass) || phone_by_user(user))
			continue;
		p = &phones[nphones++];
		memset(p, 0, sizeof(*p));
		snprintf(p->name, sizeof(p->name), "%s", name);
		snprintf(p->user, sizeof(p->user), "%s", user);
		snprintf(p->password, sizeof(p->password), "%s", pass);
		for (i = 0; i < nold; i++)
			if (!strcmp(old[i].user, user)) {
				memcpy(p->contact, old[i].contact, sizeof(p->contact));
				memcpy(p->ip, old[i].ip, sizeof(p->ip));
				p->port = old[i].port;
				p->expires_at = old[i].expires_at;
			}
	}
	uci_unload(ctx, pkg);
	uci_free_context(ctx);
	return nphones;
}

static struct phone *find(const char *user)
{
	int i;

	for (i = 0; user && i < nphones; i++)
		if (!strcmp(phones[i].user, user))
			return &phones[i];
	return NULL;
}

const struct phone *phone_by_user(const char *user)
{
	return find(user);
}

static int ban_slot(const char *ip, long now)
{
	int i, free_slot = -1, oldest = 0;

	for (i = 0; i < BANS_MAX; i++) {
		if (!strcmp(bans[i].ip, ip))
			return i;
		if (free_slot < 0 && (!bans[i].ip[0] || (bans[i].until && bans[i].until < now)))
			free_slot = i;
		if (bans[i].until < bans[oldest].until)
			oldest = i;
	}
	i = free_slot >= 0 ? free_slot : oldest;
	memset(&bans[i], 0, sizeof(bans[i]));
	snprintf(bans[i].ip, sizeof(bans[i].ip), "%s", ip);
	return i;
}

int auth_banned(const char *ip, long now)
{
	int i;

	for (i = 0; i < BANS_MAX; i++)
		if (!strcmp(bans[i].ip, ip))
			return bans[i].until >= now;
	return 0;
}

int auth_check(const char *ip, const struct phone *p, const char *method, const char *uri,
	       const char *nonce, const char *response, long now)
{
	uint8_t ha1[16], ha2[16], want[16];
	char hex[33];
	int b = ban_slot(ip, now), i;

	if (bans[b].until >= now)
		return -2;
	if (bans[b].until) {
		bans[b].until = 0;
		bans[b].fails = 0;
	}
	if (p) {
		md5_printf(ha1, "%s:%s:%s", p->user, REALM, p->password);
		md5_printf(ha2, "%s:%s", method, uri);
		md5_printf(want, "%w:%s:%w", ha1, sizeof(ha1), nonce, ha2, sizeof(ha2));
		for (i = 0; i < 16; i++)
			sprintf(hex + 2 * i, "%02x", want[i]);
		if (response && !strcmp(hex, response)) {
			bans[b].fails = 0;
			return 0;
		}
	}
	if (++bans[b].fails >= BAN_FAILS)
		bans[b].until = now + BAN_SECS;
	return -1;
}

void reg_set(const char *user, const char *contact, const char *ip, int port, long expires_at)
{
	struct phone *p = find(user);

	if (!p)
		return;
	snprintf(p->contact, sizeof(p->contact), "%s", contact);
	snprintf(p->ip, sizeof(p->ip), "%s", ip);
	p->port = port;
	p->expires_at = expires_at;
}

int reg_online(long now, const struct phone **out, int max)
{
	int i, n = 0;

	for (i = 0; i < nphones && n < max; i++)
		if (phones[i].contact[0] && phones[i].expires_at > now)
			out[n++] = &phones[i];
	return n;
}

const char *reg_name(const char *user)
{
	const struct phone *p = find(user);

	return p ? p->name : "";
}

int phones_all(const struct phone **out, int max)
{
	int i;

	for (i = 0; i < nphones && i < max; i++)
		out[i] = &phones[i];
	return i;
}
