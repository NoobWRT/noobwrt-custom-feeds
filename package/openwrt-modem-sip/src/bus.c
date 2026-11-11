// SPDX-License-Identifier: GPL-2.0
// Copyright (C) 2026 perz3us
#include <string.h>
#include <libubus.h>
#include <time.h>
#include "bus.h"
#include "phones.h"

static struct ubus_context *ubus;
static struct blob_buf bb;

static void put_status(const struct call *c)
{
	blob_buf_init(&bb, 0);
	blobmsg_add_string(&bb, "state", call_state_name(c->st));
	blobmsg_add_string(&bb, "origin", c->origin);
	blobmsg_add_string(&bb, "answered_by", c->answered_by);
	blobmsg_add_string(&bb, "number", c->number);
	blobmsg_add_string(&bb, "codec", media_codec());
	blobmsg_add_u8(&bb, "enabled", 1);
}

enum { A_LINE, A_NUMBER, A_DIGIT, A_MAX };

static const struct blobmsg_policy args_policy[A_MAX] = {
	[A_LINE] = { "line", BLOBMSG_TYPE_STRING },
	[A_NUMBER] = { "number", BLOBMSG_TYPE_STRING },
	[A_DIGIT] = { "digit", BLOBMSG_TYPE_STRING },
};

static int m_request(struct ubus_context *ctx, struct ubus_object *obj, struct ubus_request_data *req,
		     const char *method, struct blob_attr *msg)
{
	struct blob_attr *tb[A_MAX];
	const char *number, *digit;
	int bad = 0;

	(void)obj;
	blobmsg_parse(args_policy, A_MAX, tb, blob_data(msg), blob_len(msg));
	number = tb[A_NUMBER] ? blobmsg_get_string(tb[A_NUMBER]) : "";
	digit = tb[A_DIGIT] ? blobmsg_get_string(tb[A_DIGIT]) : "";
	if (!strcmp(method, "dial"))
		bad = ctl_dial(number);
	else if (!strcmp(method, "answer"))
		bad = ctl_answer();
	else if (!strcmp(method, "reject") || !strcmp(method, "hangup"))
		ctl_hangup();
	else if (!strcmp(method, "digit"))
		bad = strlen(digit) != 1 || ctl_digit(digit[0]);
	if (bad)
		return UBUS_STATUS_INVALID_ARGUMENT;
	put_status(ctl_call());
	ubus_send_reply(ctx, req, bb.head);
	return 0;
}

static int m_phones(struct ubus_context *ctx, struct ubus_object *obj, struct ubus_request_data *req,
		    const char *method, struct blob_attr *msg)
{
	const struct phone *p[PHONES_MAX];
	int n = phones_all(p, PHONES_MAX), i;
	long now = time(NULL);
	void *a, *t;

	(void)obj;
	(void)method;
	(void)msg;
	blob_buf_init(&bb, 0);
	a = blobmsg_open_array(&bb, "phones");
	for (i = 0; i < n; i++) {
		t = blobmsg_open_table(&bb, NULL);
		blobmsg_add_string(&bb, "name", p[i]->name);
		blobmsg_add_string(&bb, "user", p[i]->user);
		blobmsg_add_u8(&bb, "online", p[i]->contact[0] && p[i]->expires_at > now);
		blobmsg_add_string(&bb, "address", p[i]->contact[0] && p[i]->expires_at > now ? p[i]->ip : "");
		blobmsg_close_table(&bb, t);
	}
	blobmsg_close_array(&bb, a);
	ubus_send_reply(ctx, req, bb.head);
	return 0;
}

static const struct ubus_method methods[] = {
	UBUS_METHOD_NOARG("phones", m_phones),
	UBUS_METHOD_NOARG("status", m_request),
	UBUS_METHOD("dial", m_request, args_policy),
	UBUS_METHOD("answer", m_request, args_policy),
	UBUS_METHOD("reject", m_request, args_policy),
	UBUS_METHOD("hangup", m_request, args_policy),
	UBUS_METHOD("digit", m_request, args_policy),
};

static struct ubus_object_type obj_type = UBUS_OBJECT_TYPE("fxs_sip", methods);

static struct ubus_object obj = {
	.name = "fxs_sip",
	.type = &obj_type,
	.methods = methods,
	.n_methods = ARRAY_SIZE(methods),
};

int bus_start(void)
{
	if (!(ubus = ubus_connect(NULL)))
		return -1;
	return ubus_add_object(ubus, &obj);
}

int bus_fd(void)
{
	return ubus ? ubus->sock.fd : -1;
}

void bus_handle(void)
{
	ubus_handle_event(ubus);
}

void bus_notify(const struct call *c)
{
	put_status(c);
	ubus_send_event(ubus, "fxs_sip.call", bb.head);
}

void bus_stop(void)
{
	if (ubus)
		ubus_free(ubus);
	ubus = NULL;
}
