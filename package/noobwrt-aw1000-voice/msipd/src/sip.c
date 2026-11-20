// SPDX-License-Identifier: GPL-2.0
// Copyright (C) 2026 perz3us
#include <errno.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <syslog.h>
#include <time.h>
#include <unistd.h>
#include <sys/wait.h>
#include <re.h>
#include "media.h"
#include "phones.h"
#include "sip.h"
#include "sms.h"

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
	sms_flush(p->user);
}

/*
 * SMS over SIP (RFC 3428 MESSAGE).
 *
 * Out to the phones: sip_sms() sends a text/plain MESSAGE from
 * sip:<number>@<router> to every phone that is logged in. A phone that is
 * offline, or does not take the message, gets it the next time it registers
 * (kept in memory, up to SMS_QMAX messages for SMS_KEEP seconds).
 *
 * In from the phones: an authenticated MESSAGE to sip:<number>@<router> is
 * handed to SMS_HELPER, which sends it as an SMS through the modem. Typing
 * and delivery notices (is-composing, IMDN) are accepted and ignored.
 */
#define SMS_HELPER	"/usr/libexec/aw1000-voice-sms"
#define SMS_QMAX	32
#define SMS_KEEP	(7 * 86400)
#define SMS_TEXT	1600
/* A REGISTER retransmission must not resend a message that just failed. */
#define SMS_RETRY_MIN	5

/* Monotonic seconds: the retry guard must not move when the wall clock does. */
static long sms_ticks(void)
{
	struct timespec ts;

	clock_gettime(CLOCK_MONOTONIC, &ts);
	return (long)ts.tv_sec;
}

struct sms_out {
	unsigned id;
	char user[16];
	char from[32];
	char name[48];
	char *text;
	long at;
	int attempts;
	int inflight;
	long last_try;
};

static struct sms_out queue[SMS_QMAX];
static int nqueue;
static unsigned next_sms_id;

static void clean_name(char *dst, size_t len, const char *src)
{
	size_t n = 0;

	for (; src && *src && n + 1 < len; src++)
		if (*src != '"' && *src != '\\' && (unsigned char)*src >= 0x20)
			dst[n++] = *src;
	dst[n] = '\0';
}

static int number_ok(const char *s)
{
	size_t n = 0;

	if (*s == '+')
		s++;
	for (; *s; s++, n++)
		if (*s < '0' || *s > '9')
			return 0;
	return n >= 3 && n <= 20;
}

static int queue_find(unsigned id);

static unsigned queue_add(const char *user, const char *from, const char *name, const char *text,
			  long at, int attempts)
{
	struct sms_out *q;
	char *copy;

	/* Allocate first: a failed copy must not cost us an old message. */
	if (!(copy = strdup(text)))
		return 0;
	if (nqueue == SMS_QMAX) {
		free(queue[0].text);
		memmove(queue, queue + 1, sizeof(queue[0]) * (SMS_QMAX - 1));
		nqueue--;
		syslog(LOG_WARNING, "SMS queue full, dropped the oldest message");
	}
	q = &queue[nqueue];
	q->text = copy;
	do {
		if (!++next_sms_id)
			next_sms_id = 1;
	} while (queue_find(next_sms_id) >= 0);
	q->id = next_sms_id;
	snprintf(q->user, sizeof(q->user), "%s", user);
	snprintf(q->from, sizeof(q->from), "%s", from);
	snprintf(q->name, sizeof(q->name), "%s", name);
	q->at = at;
	q->attempts = attempts;
	q->inflight = 0;
	q->last_try = 0;
	nqueue++;
	return q->id;
}

static int queue_find(unsigned id)
{
	int i;

	for (i = 0; i < nqueue; i++)
		if (queue[i].id == id)
			return i;
	return -1;
}

static void queue_remove(int i)
{
	int j;

	free(queue[i].text);
	for (j = i; j < nqueue - 1; j++)
		queue[j] = queue[j + 1];
	nqueue--;
}

struct sms_req {
	unsigned id;		/* queued id, or 0 for a first attempt */
	char user[16];
	char from[32];
	char name[48];
	char *text;
	long at;
	int attempts;		/* attempts including this one */
};

static void sms_req_destroy(void *arg)
{
	struct sms_req *r = arg;

	free(r->text);
}

static const char *sms_reason(int scode)
{
	if (scode >= 300)
		return "temporarily unavailable";
	return "no answer";
}

static void sms_log_retry(const char *from, const char *user, int scode, int attempts)
{
	syslog(LOG_INFO, "SMS from %s not taken by %s (%s), attempt %d of %d, kept for its next login",
	       from, reg_name(user), sms_reason(scode), attempts, SMS_TRIES);
}

static void sms_log_drop(const char *from, const char *user, int err, int scode, int attempts)
{
	if (sms_transient(err, scode))
		syslog(LOG_WARNING, "SMS from %s not taken by %s (%s), dropped after %d attempts",
		       from, reg_name(user), sms_reason(scode), attempts);
	else
		syslog(LOG_WARNING, "SMS from %s refused by %s (SIP %u), dropped", from,
		       reg_name(user), (unsigned)scode);
}

/* Add a message that must wait, keeping its original age and attempt count. */
static unsigned sms_admit(const char *user, const char *from, const char *name,
			  const char *text, long at, int attempts)
{
	unsigned id = queue_add(user, from, name, text, at, attempts);
	int i = queue_find(id);

	if (i >= 0 && attempts > 0)
		queue[i].last_try = sms_ticks();
	return id;
}

/* One final answer for one queued message: deliver, keep it for the next
 * login, or drop it.  Called once per attempt, so it logs once. */
static void sms_finish(unsigned id, int err, int scode)
{
	struct sms_out *q;
	int i = queue_find(id);

	if (i < 0)
		return;			/* its slot was recycled while in flight */
	q = &queue[i];
	if (!err && scode > 0 && scode < 200)
		return;			/* provisional answer, still in flight */
	q->inflight = 0;
	if (!err && scode >= 200 && scode < 300) {
		syslog(LOG_INFO, "SMS from %s delivered to %s", q->from, reg_name(q->user));
		queue_remove(i);
		return;
	}
	if (sms_should_retry(err, scode, q->attempts)) {
		sms_log_retry(q->from, q->user, scode, q->attempts);
		return;
	}
	sms_log_drop(q->from, q->user, err, scode, q->attempts);
	queue_remove(i);
}

static void on_sms_resp(int err, const struct sip_msg *msg, void *arg)
{
	struct sms_req *r = arg;
	int scode = msg ? (int)msg->scode : 0;

	if (!err && msg && scode < 200)
		return;
	if (r->id) {
		sms_finish(r->id, err, scode);
	} else if (!err && scode >= 200 && scode < 300) {
		syslog(LOG_INFO, "SMS from %s delivered to %s", r->from, reg_name(r->user));
	} else if (sms_should_retry(err, scode, r->attempts)) {
		if (sms_admit(r->user, r->from, r->name, r->text, r->at, r->attempts))
			sms_log_retry(r->from, r->user, scode, r->attempts);
		else
			sms_log_drop(r->from, r->user, err, scode, r->attempts);
	} else {
		sms_log_drop(r->from, r->user, err, scode, r->attempts);
	}
	mem_deref(r);
}

static int send_sms(const struct phone *p, struct sms_req *r)
{
	return sip_requestf(NULL, sip, true, "MESSAGE", p->contact, NULL, NULL, NULL, on_sms_resp, r,
			   "To: <%s>\r\n"
			   "From: \"%s\" <sip:%s@%s>;tag=%x\r\n"
			   "Call-ID: %x%x@%s\r\n"
			   "CSeq: 1 MESSAGE\r\n"
			   "Max-Forwards: 70\r\n"
			   "User-Agent: msipd\r\n"
			   "Content-Type: text/plain;charset=UTF-8\r\n"
			   "Content-Length: %zu\r\n"
			   "\r\n"
			   "%s",
			   p->contact, r->name[0] ? r->name : r->from, r->from, local_ip, rand_u32(),
			   rand_u32(), rand_u32(), local_ip, strlen(r->text), r->text);
}

/* First attempt to a phone that is online right now.  It is not put in the
 * bounded queue unless it fails, so a delivered message can never evict a
 * message waiting for an offline phone. */
static int send_initial(const struct phone *p, const char *from, const char *name,
			const char *text, long at)
{
	struct sms_req *r;
	int err;

	if (!(r = mem_zalloc(sizeof(*r), sms_req_destroy)))
		return ENOMEM;
	if (!(r->text = strdup(text))) {
		mem_deref(r);
		return ENOMEM;
	}
	snprintf(r->user, sizeof(r->user), "%s", p->user);
	snprintf(r->from, sizeof(r->from), "%s", from);
	snprintf(r->name, sizeof(r->name), "%s", name);
	r->at = at;
	r->attempts = 1;
	err = send_sms(p, r);
	if (err)
		mem_deref(r);
	return err;
}

/* Send queued message 'id' to p.  The queue entry stays the single source of
 * truth: it is removed only when sms_finish() delivers or drops it. */
static int send_queued(const struct phone *p, unsigned id)
{
	struct sms_req *r;
	struct sms_out *q;
	int i = queue_find(id), err;

	if (i < 0)
		return ENOENT;
	q = &queue[i];
	if (!(r = mem_zalloc(sizeof(*r), sms_req_destroy)))
		return ENOMEM;
	if (!(r->text = strdup(q->text))) {
		mem_deref(r);
		return ENOMEM;
	}
	r->id = id;
	snprintf(r->user, sizeof(r->user), "%s", q->user);
	snprintf(r->from, sizeof(r->from), "%s", q->from);
	snprintf(r->name, sizeof(r->name), "%s", q->name);
	r->at = q->at;
	r->attempts = ++q->attempts;
	q->inflight = 1;
	q->last_try = sms_ticks();
	err = send_sms(p, r);
	if (err) {
		sms_finish(id, err, 0);
		mem_deref(r);
	}
	return err;
}

int sip_sms(const char *from, const char *name, const char *text, const char *to, int *queued)
{
	const struct phone *all[PHONES_MAX];
	char cname[48], cfrom[32];
	long now = time(NULL);
	int n = phones_all(all, PHONES_MAX), i, sent = 0;

	*queued = 0;
	if (!text || !*text)
		return 0;
	clean_name(cname, sizeof(cname), name);
	snprintf(cfrom, sizeof(cfrom), "%s", number_ok(from) ? from : "SMS");
	for (i = 0; i < n; i++) {
		int err;

		if (to && *to && strcmp(to, all[i]->name))
			continue;
		if (all[i]->contact[0] && all[i]->expires_at > now) {
			err = send_initial(all[i], cfrom, cname, text, now);
			if (!err) {
				sent++;
				continue;
			}
			/* Could not even submit it: that still counts as
			 * attempt 1, so admit it for a bounded retry. */
			if (!sms_admit(all[i]->user, cfrom, cname, text, now, 1))
				continue;
			sms_log_retry(cfrom, all[i]->user, 0, 1);
			(*queued)++;
			continue;
		}
		if (sms_admit(all[i]->user, cfrom, cname, text, now, 0))
			(*queued)++;
	}
	return sent;
}

void sms_flush(const char *user)
{
	const struct phone *all[PHONES_MAX];
	const struct phone *p = NULL;
	int n = phones_all(all, PHONES_MAX), i;

	for (i = 0; i < n; i++)
		if (!strcmp(all[i]->user, user))
			p = all[i];
	if (!p || !p->contact[0])
		return;
	for (i = 0; i < nqueue; i++) {
		struct sms_out *q = &queue[i];
		unsigned id = q->id;
		long now = time(NULL);

		if (now - q->at > SMS_KEEP) {
			queue_remove(i);
			i--;
			continue;
		}
		if (strcmp(q->user, user) || q->inflight ||
		    (q->attempts > 0 && sms_ticks() - q->last_try < SMS_RETRY_MIN))
			continue;
		/* send_queued() logs the outcome once through sms_finish() */
		(void)send_queued(p, id);
		if (queue_find(id) < 0)
			i--;
	}
}

/* Run SMS_HELPER send <number> <file> <phone> detached, so msipd never waits. */
static void sms_to_modem(const char *phone, const char *number, const char *text, size_t len)
{
	char path[] = "/tmp/msipd-sms.XXXXXX";
	pid_t pid;
	int fd;

	if ((fd = mkstemp(path)) < 0)
		return;
	if (write(fd, text, len) != (ssize_t)len) {
		close(fd);
		unlink(path);
		return;
	}
	close(fd);
	pid = fork();
	if (pid == 0) {
		if (fork() == 0) {
			execl(SMS_HELPER, SMS_HELPER, "send", number, path, phone, (char *)NULL);
			_exit(127);
		}
		_exit(0);
	}
	if (pid > 0)
		waitpid(pid, NULL, 0);
	else
		unlink(path);
}

static void on_message(const struct sip_msg *msg)
{
	const struct phone *p;
	char number[32] = "";
	const char *body;
	size_t len;

	if (!(p = authenticate(msg, 1, "MESSAGE")))
		return;
	/* typing and delivery notices from the app: fine, nothing to send */
	if (msg_ctype_cmp(&msg->ctyp, "application", "im-iscomposing+xml") ||
	    msg_ctype_cmp(&msg->ctyp, "message", "imdn+xml")) {
		sip_reply(sip, msg, 200, "OK");
		return;
	}
	if (!msg->mb || !mbuf_get_left(msg->mb)) {
		sip_reply(sip, msg, 400, "Empty Message");
		return;
	}
	body = (const char *)mbuf_buf(msg->mb);
	len = mbuf_get_left(msg->mb);
	if (msg_ctype_cmp(&msg->ctyp, "message", "cpim")) {
		/* CPIM: CPIM headers, blank line, MIME headers, blank line, text */
		const char *e = body + len, *s = body;
		int blank;

		for (blank = 0; blank < 2 && s; blank++) {
			const char *nl = NULL, *t;

			for (t = s; t + 3 < e; t++)
				if (t[0] == '\r' && t[1] == '\n' && t[2] == '\r' && t[3] == '\n') {
					nl = t + 4;
					break;
				}
			s = nl;
		}
		if (!s || s >= e) {
			sip_reply(sip, msg, 415, "Unsupported Media Type");
			return;
		}
		body = s;
		len = (size_t)(e - s);
	} else if (!msg_ctype_cmp(&msg->ctyp, "text", "plain")) {
		sip_reply(sip, msg, 415, "Unsupported Media Type");
		return;
	}
	pl_strcpy(&msg->uri.user, number, sizeof(number));
	if (!number_ok(number)) {
		sip_reply(sip, msg, 404, "Not Found");
		syslog(LOG_WARNING, "%s: SMS to '%s' refused, not a phone number", p->name, number);
		return;
	}
	if (len > SMS_TEXT) {
		sip_reply(sip, msg, 413, "Message Too Large");
		return;
	}
	sip_reply(sip, msg, 202, "Accepted");
	syslog(LOG_INFO, "%s: sending an SMS to %s", p->name, number);
	sms_to_modem(p->name, number, body, len);
}

static bool on_request(const struct sip_msg *msg, void *arg)
{
	(void)arg;
	if (!pl_strcmp(&msg->met, "REGISTER")) {
		on_register(msg);
		return true;
	}
	if (!pl_strcmp(&msg->met, "MESSAGE")) {
		on_message(msg);
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
