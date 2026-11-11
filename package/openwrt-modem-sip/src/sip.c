// SPDX-License-Identifier: GPL-2.0
// Copyright (C) 2026 perz3us
#include <string.h>
#include <syslog.h>
#include <time.h>
#include <re.h>
#include "media.h"
#include "phones.h"
#include "sip.h"

#define REG_MAX 300

struct leg {
	struct sipsess *sess;
	char name[24];
};

static struct sip *sip;
static struct sipsess_sock *ssock;
static struct sip_lsnr *lsnr;
static struct sa laddr, maddr;
static char nonce[17];
static char local_ip[48];
static const struct sip_cb *cb;
static struct leg legs[PHONES_MAX];
static struct sipsess *active;
static char active_name[24];
static struct mbuf *out_desc;
static struct sipsess *dead[PHONES_MAX + 2];
static int ndead;
static struct tmr reap_tmr;

static void reap(void *arg)
{
	(void)arg;
	while (ndead > 0)
		mem_deref(dead[--ndead]);
}

static void bury(struct sipsess *s)
{
	if (!s || ndead >= (int)RE_ARRAY_SIZE(dead))
		return;
	dead[ndead++] = s;
	tmr_start(&reap_tmr, 0, reap, NULL);
}

static void challenge(const struct sip_msg *msg, int proxy)
{
	sip_replyf(sip, msg, proxy ? 407 : 401, proxy ? "Proxy Authentication Required" : "Unauthorized",
		   "%s: Digest realm=\"" REALM "\", nonce=\"%s\", algorithm=MD5\r\nContent-Length: 0\r\n\r\n",
		   proxy ? "Proxy-Authenticate" : "WWW-Authenticate", nonce);
}

static const struct phone *authenticate(const struct sip_msg *msg, int proxy, const char *method)
{
	const struct sip_hdr *h = sip_msg_hdr(msg, proxy ? SIP_HDR_PROXY_AUTHORIZATION : SIP_HDR_AUTHORIZATION);
	struct httpauth_digest_resp r;
	char user[16] = "", uri[256] = "", got_nonce[32] = "", resp[40] = "", ip[48];
	const struct phone *p;
	int rc;

	if (!h || httpauth_digest_response_decode(&r, &h->val)) {
		challenge(msg, proxy);
		return NULL;
	}
	pl_strcpy(&r.username, user, sizeof(user));
	pl_strcpy(&r.uri, uri, sizeof(uri));
	pl_strcpy(&r.nonce, got_nonce, sizeof(got_nonce));
	pl_strcpy(&r.response, resp, sizeof(resp));
	if (strcmp(got_nonce, nonce)) {
		challenge(msg, proxy);
		return NULL;
	}
	sa_ntop(&msg->src, ip, sizeof(ip));
	p = phone_by_user(user);
	rc = auth_check(ip, p, method, uri, got_nonce, resp, time(NULL));
	if (rc == -1) {
		sip_reply(sip, msg, 403, "Forbidden");
		syslog(LOG_WARNING, "wrong login for %s from %s", user, ip);
		if (auth_banned(ip, time(NULL)))
			syslog(LOG_WARNING, "%s blocked for 10 minutes after 5 wrong logins", ip);
	}
	return rc ? NULL : p;
}

static void on_register(const struct sip_msg *msg)
{
	const struct phone *p = authenticate(msg, 0, "REGISTER");
	const struct sip_hdr *h;
	struct sip_addr addr;
	struct pl v;
	char contact[128] = "", ip[48];
	uint32_t exp = REG_MAX;

	if (!p)
		return;
	h = sip_msg_hdr(msg, SIP_HDR_CONTACT);
	if (pl_isset(&msg->expires))
		exp = pl_u32(&msg->expires);
	if (h && !sip_addr_decode(&addr, &h->val)) {
		if (!msg_param_decode(&addr.params, "expires", &v))
			exp = pl_u32(&v);
		pl_strcpy(&addr.auri, contact, sizeof(contact));
	}
	if (exp > REG_MAX)
		exp = REG_MAX;
	if (!contact[0] || !exp) {
		reg_set(p->user, "", "", 0, 0);
		sip_reply(sip, msg, 200, "OK");
		return;
	}
	sa_ntop(&msg->src, ip, sizeof(ip));
	reg_set(p->user, contact, ip, sa_port(&msg->src), time(NULL) + exp);
	sip_replyf(sip, msg, 200, "OK", "Contact: <%s>;expires=%u\r\nExpires: %u\r\nContent-Length: 0\r\n\r\n",
		   contact, exp, exp);
}

static bool on_request(const struct sip_msg *msg, void *arg)
{
	(void)arg;
	if (!pl_strcmp(&msg->met, "REGISTER")) {
		on_register(msg);
		return true;
	}
	if (!pl_strcmp(&msg->met, "OPTIONS")) {
		sip_reply(sip, msg, 200, "OK");
		return true;
	}
	return false;
}

static void on_info(struct sip *s, const struct sip_msg *msg, void *arg)
{
	struct pl sig;

	(void)arg;
	if (msg->mb && !re_regex((const char *)mbuf_buf(msg->mb), mbuf_get_left(msg->mb), "Signal=[ ]*[0-9*#A-D]1",
				 NULL, &sig))
		cb->digit(sig.p[0]);
	sip_reply(s, msg, 200, "OK");
}

static struct leg *leg_of(void *arg)
{
	return arg;
}

static void drop_legs(void)
{
	int i;

	for (i = 0; i < PHONES_MAX; i++) {
		bury(legs[i].sess);
		legs[i].sess = NULL;
	}
}

static int on_leg_answer(const struct sip_msg *msg, void *arg)
{
	struct leg *l = leg_of(arg);

	if (active) {
		bury(l->sess);
		l->sess = NULL;
		return 0;
	}
	active = l->sess;
	l->sess = NULL;
	snprintf(active_name, sizeof(active_name), "%s", l->name);
	drop_legs();
	if (!msg->mb || media_take_answer(msg->mb, cb->hd()))
		syslog(LOG_WARNING, "%s: could not use the audio in its answer, the call has no sound", active_name);
	cb->answered(active_name);
	return 0;
}

static void on_estab(const struct sip_msg *msg, void *arg)
{
	(void)msg;
	(void)arg;
}

static void on_close(int err, const struct sip_msg *msg, void *arg)
{
	struct leg *l = arg;

	(void)err;
	(void)msg;
	if (l && l->sess) {
		l->sess = NULL;
		return;
	}
	if (active) {
		active = NULL;
		out_desc = mem_deref(out_desc);
		media_close();
		cb->hangup();
	}
}

static int leg_offer(struct mbuf **descp, const struct sa *src, const struct sa *dst, void *arg)
{
	(void)src;
	(void)dst;
	(void)arg;
	return media_offer(descp, &maddr, cb->hd());
}

static int answer_ignore(const struct sip_msg *msg, void *arg)
{
	(void)msg;
	(void)arg;
	return 0;
}

static void on_invite(const struct sip_msg *msg, void *arg)
{
	const struct phone *p;
	char number[32] = "";
	struct mbuf *desc = NULL;

	(void)arg;
	if (!(p = authenticate(msg, 1, "INVITE")))
		return;
	if (cb->busy() || active) {
		sip_reply(sip, msg, 486, "Busy Here");
		return;
	}
	pl_strcpy(&msg->uri.user, number, sizeof(number));
	if (!number[0] || !msg->mb || media_answer(&desc, &maddr, msg->mb, cb->hd())) {
		sip_reply(sip, msg, number[0] ? 488 : 404, number[0] ? "Not Acceptable Here" : "Not Found");
		if (number[0]) {
			struct pl ml = PL_INIT;

			if (msg->mb)
				re_regex((char *)msg->mb->buf, msg->mb->end, "m=audio [^\r\n]+", &ml);
			syslog(LOG_WARNING, "%s: no audio format in common, call refused (offer: %.*s)",
			       p->name, (int)ml.l, ml.p ? ml.p : "");
		}
		mem_deref(desc);
		return;
	}
	if (sipsess_accept(&active, ssock, msg, 180, "Ringing", REL100_DISABLED, "msipd", "application/sdp", NULL,
			   NULL, NULL, false, NULL, answer_ignore, on_estab, on_info, NULL, on_close, NULL, NULL)) {
		mem_deref(desc);
		return;
	}
	out_desc = desc;
	snprintf(active_name, sizeof(active_name), "%s", p->name);
	cb->dial(p->name, number);
}

void sip_connected(void)
{
	if (active && out_desc) {
		sipsess_answer(active, 200, "OK", out_desc, NULL);
		out_desc = mem_deref(out_desc);
	}
}

void sip_ring_all(const char *number)
{
	const struct phone *on[PHONES_MAX];
	char from[96];
	int n = reg_online(time(NULL), on, PHONES_MAX), i;

	snprintf(from, sizeof(from), "sip:%s@%s", number[0] ? number : "anonymous", local_ip);
	for (i = 0; i < n; i++) {
		if (legs[i].sess)
			continue;
		snprintf(legs[i].name, sizeof(legs[i].name), "%s", on[i]->name);
		sipsess_connect(&legs[i].sess, ssock, on[i]->contact, number, from, "msipd", NULL, 0,
				"application/sdp", NULL, NULL, false, NULL, leg_offer, NULL, on_leg_answer, NULL,
				on_estab, on_info, NULL, on_close, &legs[i], NULL);
	}
}

void sip_cancel_all(void)
{
	drop_legs();
}

void sip_bye(void)
{
	drop_legs();
	if (!active)
		return;
	if (out_desc)
		sipsess_reject(active, 480, "Temporarily Unavailable", NULL);
	bury(active);
	active = NULL;
	out_desc = mem_deref(out_desc);
	media_close();
}

int sip_start(const char *bind_ip, int port, int rtp_from, int rtp_to, const struct sip_cb *c)
{
	int err;

	cb = c;
	snprintf(local_ip, sizeof(local_ip), "%s", bind_ip);
	rand_str(nonce, sizeof(nonce));
	if ((err = sa_set_str(&laddr, bind_ip, port)) || (err = sa_set_str(&maddr, bind_ip, 0)))
		return err;
	if ((err = sip_alloc(&sip, NULL, 32, 32, 32, "msipd", NULL, NULL)) ||
	    (err = sip_transp_add(sip, SIP_TRANSP_UDP, &laddr)) ||
	    (err = sip_listen(&lsnr, sip, true, on_request, NULL)) ||
	    (err = sipsess_listen(&ssock, sip, 32, on_invite, NULL)))
		return err;
	return media_open(&maddr, rtp_from, rtp_to, cb->digit);
}

void sip_stop(void)
{
	drop_legs();
	reap(NULL);
	active = mem_deref(active);
	media_close();
	sipsess_close_all(ssock);
	ssock = mem_deref(ssock);
	lsnr = mem_deref(lsnr);
	sip_close(sip, true);
	sip = mem_deref(sip);
}
