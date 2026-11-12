// SPDX-License-Identifier: GPL-2.0
// Copyright (C) 2026 perz3us
#include <getopt.h>
#include <signal.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <syslog.h>
#include <re.h>
#include <uci.h>
#include "audio.h"
#include "bus.h"
#include "call.h"
#include "clcc.h"
#include "modem.h"
#include "phones.h"
#include "sip.h"

#define MSIPD_VERSION	"0.2.0"
#define POLL_MS		500

static struct re_fhs *bus_fhs;
static struct tmr poll_tmr;
static struct call call, sent;
static const char *confdir;
static volatile sig_atomic_t reload;

static char *uci_get(const char *pkg, const char *path, char *out, size_t n)
{
	struct uci_context *ctx = uci_alloc_context();
	struct uci_ptr ptr;
	char spec[96];

	out[0] = 0;
	if (!ctx)
		return out;
	if (confdir)
		uci_set_confdir(ctx, confdir);
	snprintf(spec, sizeof(spec), "%s.%s", pkg, path);
	if (!uci_lookup_ptr(ctx, &ptr, spec, true) && ptr.o && ptr.o->type == UCI_TYPE_STRING)
		snprintf(out, n, "%s", ptr.o->v.string);
	uci_free_context(ctx);
	return out;
}

static int hd_on(void)
{
	char v[8];

	return !strcmp(uci_get("fxs", "main.hd", v, sizeof(v)), "1") &&
	       strcmp(uci_get("modem_sip", "main.hd", v, sizeof(v)), "0");
}

static void notify(void)
{
	if (!memcmp(&call, &sent, sizeof(call)))
		return;
	sent = call;
	bus_notify(&call);
}

static void at(const char *fmt, const char *arg)
{
	char cmd[64], r[256];

	snprintf(cmd, sizeof(cmd), fmt, arg ? arg : "");
	if (modem_at(cmd, r, sizeof(r)))
		syslog(LOG_WARNING, "%s failed", cmd);
}

static int valid_number(const char *s)
{
	size_t n = strlen(s), i;

	if (n < 1 || n > 30)
		return 0;
	for (i = 0; i < n; i++)
		if (!strchr("0123456789*#+", s[i]))
			return 0;
	return 1;
}

static void poll_modem(void *arg)
{
	struct clcc_call v[CLCC_MAX];
	char r[512];
	enum cstate was = call.st;
	int n = 0;

	(void)arg;
	tmr_start(&poll_tmr, POLL_MS, poll_modem, NULL);
	if (reload) {
		reload = 0;
		phones_load(confdir);
		syslog(LOG_INFO, "phones reloaded");
	}
	if (modem_at("AT+CLCC", r, sizeof(r)))
		return;
	n = clcc_parse_all(r, v, CLCC_MAX);
	call_from_clcc(&call, v, n);
	if (call.st == C_RINGING && was != C_RINGING)
		sip_ring_all(call.number);
	if (was == C_RINGING && call.st != C_RINGING && call.st != C_ACTIVE)
		sip_cancel_all();
	if (call.st == C_ACTIVE && was != C_ACTIVE)
		sip_connected();
	if (call.st == C_IDLE && was != C_IDLE)
		sip_bye();
	notify();
}

static void on_answered(const char *name)
{
	at("ATA", NULL);
	snprintf(call.answered_by, sizeof(call.answered_by), "%s", name);
	call.st = C_ACTIVE;
	notify();
}

static void on_dial(const char *name, const char *number)
{
	if (!valid_number(number)) {
		sip_bye();
		return;
	}
	call_dial(&call, name, number);
	at("ATD%s;", number);
	notify();
}

static void on_hangup(void)
{
	if (call.st == C_IDLE)
		return;
	at("AT+CHUP", NULL);
	call.st = C_ENDING;
	notify();
}

static void on_digit(char d)
{
	char s[2] = { d, 0 };

	at("AT+VTS=\"%s\"", s);
}

static int is_busy(void)
{
	return call.st != C_IDLE && call.st != C_OFF;
}

static const struct sip_cb sip_cbs = {
	.answered = on_answered, .dial = on_dial, .hangup = on_hangup,
	.digit = on_digit, .busy = is_busy, .hd = hd_on,
};

int ctl_dial(const char *number)
{
	if (is_busy() || !valid_number(number))
		return -1;
	call_dial(&call, "phone", number);
	at("ATD%s;", number);
	notify();
	return 0;
}

int ctl_answer(void)
{
	if (call.st != C_RINGING)
		return -1;
	sip_cancel_all();
	on_answered("phone");
	return 0;
}

void ctl_hangup(void)
{
	sip_bye();
	on_hangup();
}

int ctl_digit(char d)
{
	if (!strchr("0123456789*#ABCD", d))
		return -1;
	on_digit(d);
	return 0;
}

const struct call *ctl_call(void)
{
	return &call;
}

static void on_bus(int flags, void *arg)
{
	(void)flags;
	(void)arg;
	bus_handle();
}

static void on_hup(int sig)
{
	(void)sig;
	reload = 1;
}

static void on_signal(int sig)
{
	(void)sig;
	re_cancel();
}

int main(int argc, char **argv)
{
	char ip[48] = "", v[16];
	int c, port, from, to;

	while ((c = getopt(argc, argv, "c:b:s:V-:")) != -1) {
		if (c == 'c')
			confdir = optarg;
		else if (c == 'b')
			snprintf(ip, sizeof(ip), "%s", optarg);
		else if (c == 's')
			audio_fxsd_path = optarg;
		else if (c == 'V' || c == '-') {
			puts("msipd " MSIPD_VERSION);
			return 0;
		}
	}
	openlog("msipd", LOG_PID, LOG_DAEMON);
	if (!ip[0]) {
		uci_get("network", "lan.ipaddr", ip, sizeof(ip));
		strtok(ip, "/ ");
	}
	port = atoi(uci_get("modem_sip", "main.port", v, sizeof(v)));
	from = atoi(uci_get("modem_sip", "main.rtp_from", v, sizeof(v)));
	to = atoi(uci_get("modem_sip", "main.rtp_to", v, sizeof(v)));
	if (libre_init() || phones_load(confdir) < 0)
		return 1;
	if (sip_start(ip[0] ? ip : "0.0.0.0", port ? port : 5060, from ? from : 10000, to ? to : 10100, &sip_cbs)) {
		syslog(LOG_ERR, "cannot listen on %s", ip);
		return 1;
	}
	if (bus_start() || fd_listen(&bus_fhs, bus_fd(), FD_READ, on_bus, NULL)) {
		syslog(LOG_ERR, "cannot connect to ubus");
		return 1;
	}
	call_reset(&call);
	signal(SIGHUP, on_hup);
	tmr_start(&poll_tmr, 0, poll_modem, NULL);
	syslog(LOG_INFO, "msipd " MSIPD_VERSION " started on %s", ip);
	re_main(on_signal);
	bus_fhs = fd_close(bus_fhs);
	sip_stop();
	bus_stop();
	libre_close();
	return 0;
}
