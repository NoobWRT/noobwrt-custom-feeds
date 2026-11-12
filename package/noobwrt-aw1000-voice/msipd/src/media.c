// SPDX-License-Identifier: GPL-2.0
// Copyright (C) 2026 perz3us
#include <string.h>
#include <strings.h>
#include <syslog.h>
#include "audio.h"
#include "call.h"
#include "codec.h"
#include "media.h"

#define OPUS_FMTP "minptime=10;useinbandfec=1;maxplaybackrate=16000;sprop-maxcapturerate=16000"

static struct rtp_sock *rtp;
static struct tmr tick;
static struct sa remote;
static struct g722 *g722;
static struct opus16 *opus;
static media_dtmf_h *dtmf_cb;
static int pt = -1, kind = C_NONE, dtmf_pt = PT_DTMF;
static uint32_t ts;
static uint32_t dtmf_ts;
static int16_t last_in, last_out;

static void down2(const int16_t *in, int16_t *out, int n)
{
	int i;

	for (i = 0; i < n; i++)
		out[i] = (in[2 * i] + in[2 * i + 1]) / 2;
}

static void up2(const int16_t *in, int16_t *out, int n, int16_t *last)
{
	int i;

	for (i = 0; i < n; i++) {
		out[2 * i] = (*last + in[i]) / 2;
		out[2 * i + 1] = in[i];
		*last = in[i];
	}
}

static void send_frame(const int16_t *pcm, int n)
{
	struct mbuf *mb = mbuf_alloc(RTP_HEADER_SIZE + 400);
	int16_t wide[320], pcm8[160];
	int bytes;

	if (!mb)
		return;
	mb->pos = mb->end = RTP_HEADER_SIZE;
	if (kind == C_OPUS || kind == C_G722) {
		if (n == 160) {
			up2(pcm, wide, 160, &last_out);
			pcm = wide;
		}
		bytes = kind == C_OPUS ? opus16_enc(opus, pcm, mb->buf + mb->pos, 400) : g722_enc(g722, pcm, 320, mb->buf + mb->pos);
	} else {
		if (n == 320) {
			down2(pcm, pcm8, 160);
			pcm = pcm8;
		}
		bytes = 160;
		(kind == C_PCMA ? g711a_enc : g711u_enc)(pcm, mb->buf + mb->pos, 160);
	}
	if (bytes > 0) {
		mb->end += bytes;
		rtp_send(rtp, &remote, false, false, pt, ts, 0, mb);
	}
	ts += kind == C_OPUS ? 960 : 160;
	mem_deref(mb);
}

static void on_tick(void *arg)
{
	int16_t pcm[320];
	int n;

	(void)arg;
	tmr_start(&tick, 10, on_tick, NULL);
	while (kind != C_NONE && (n = audio_fxsd.read(pcm, 320)) > 0)
		send_frame(pcm, n);
}

static void put16(const int16_t *pcm, int n)
{
	int16_t pcm8[160];
	int i;

	for (i = 0; i + 320 <= n; i += 320) {
		if (audio_hd()) {
			audio_fxsd.write(pcm + i, 320);
		} else {
			down2(pcm + i, pcm8, 160);
			audio_fxsd.write(pcm8, 160);
		}
	}
}

static void put8(const int16_t *pcm, int n)
{
	int16_t wide[320];
	int i;

	for (i = 0; i + 160 <= n; i += 160) {
		if (audio_hd()) {
			up2(pcm + i, wide, 160, &last_in);
			audio_fxsd.write(wide, 320);
		} else {
			audio_fxsd.write(pcm + i, 160);
		}
	}
}

static int use(int p, int k)
{
	if (k == C_G722 && !g722 && !(g722 = g722_new()))
		return -1;
	if (k == C_OPUS && !opus && !(opus = opus16_new()))
		return -1;
	pt = p;
	kind = k;
	return 0;
}

static void on_rtp(const struct sa *src, const struct rtp_header *hdr, struct mbuf *mb, void *arg)
{
	int16_t pcm[960];
	size_t n = mbuf_get_left(mb);
	const uint8_t *p = mbuf_buf(mb);
	int k;

	(void)src;
	(void)arg;
	if (kind == C_NONE)
		return;
	if (hdr->pt == dtmf_pt) {
		if (n >= 4 && (p[1] & 0x80) && hdr->ts != dtmf_ts && dtmf_cb && p[0] < 16) {
			dtmf_ts = hdr->ts;
			dtmf_cb("0123456789*#ABCD"[p[0]]);
		}
		return;
	}
	if (hdr->pt != pt) {
		k = codec_kind(hdr->pt, "");
		if (k == C_NONE || use(hdr->pt, k))
			return;
	}
	if (kind == C_OPUS) {
		put16(pcm, opus16_dec(opus, p, n, pcm, 960));
	} else if (kind == C_G722) {
		if (n <= 480)
			put16(pcm, g722_dec(g722, p, n, pcm));
	} else if (n <= 960) {
		(kind == C_PCMA ? g711a_dec : g711u_dec)(p, pcm, n);
		put8(pcm, n);
	}
}

int media_open(const struct sa *laddr, uint16_t from, uint16_t to, media_dtmf_h *dtmfh)
{
	dtmf_cb = dtmfh;
	if (rtp)
		return 0;
	return rtp_listen(&rtp, IPPROTO_UDP, laddr, from, to, false, on_rtp, NULL, NULL);
}

uint16_t media_port(void)
{
	return rtp ? sa_port(rtp_local(rtp)) : 0;
}

const char *media_codec(void)
{
	switch (kind) {
	case C_OPUS: return "opus";
	case C_G722: return "G722";
	case C_PCMA: return "PCMA";
	case C_PCMU: return "PCMU";
	}
	return "none";
}

static void start(const struct sa *r, int p, int k)
{
	char where[64];

	if (use(p, k))
		return;
	remote = *r;
	ts = 0;
	audio_fxsd.open();
	tmr_start(&tick, 10, on_tick, NULL);
	re_snprintf(where, sizeof(where), "%J", r);
	syslog(LOG_INFO, "audio %s to %s", media_codec(), where);
}

void media_close(void)
{
	tmr_cancel(&tick);
	audio_fxsd.close();
	g722_free(g722);
	g722 = NULL;
	opus16_free(opus);
	opus = NULL;
	pt = -1;
	kind = C_NONE;
}

static int add_dtmf(struct sdp_media *m, const char *id, uint32_t rate)
{
	return sdp_format_add(NULL, m, false, id, "telephone-event", rate, 1, NULL, NULL, NULL, false, "0-15");
}

static int add_codec(struct sdp_media *m, const char *id, int k)
{
	switch (k) {
	case C_OPUS: return sdp_format_add(NULL, m, false, id, "opus", 48000, 2, NULL, NULL, NULL, false, OPUS_FMTP);
	case C_G722: return sdp_format_add(NULL, m, false, id, "G722", 8000, 1, NULL, NULL, NULL, false, NULL);
	case C_PCMA: return sdp_format_add(NULL, m, false, id, "PCMA", 8000, 1, NULL, NULL, NULL, false, NULL);
	case C_PCMU: return sdp_format_add(NULL, m, false, id, "PCMU", 8000, 1, NULL, NULL, NULL, false, NULL);
	}
	return EINVAL;
}

static int new_media(struct sdp_session **sess, struct sdp_media **m, const struct sa *laddr)
{
	int err = sdp_session_alloc(sess, laddr);

	if (!err)
		err = sdp_media_add(m, *sess, "audio", media_port(), "RTP/AVP");
	if (!err)
		sdp_media_set_alt_protos(*m, 1, "RTP/AVPF");
	return err;
}

static int build(struct sdp_session **sess, struct sdp_media **m, const struct sa *laddr, int hd)
{
	int err = new_media(sess, m, laddr);

	if (!err && hd)
		err = add_codec(*m, "111", C_OPUS);
	if (!err && hd)
		err = add_codec(*m, "9", C_G722);
	if (!err)
		err = add_codec(*m, "8", C_PCMA);
	if (!err)
		err = add_codec(*m, "0", C_PCMU);
	if (!err)
		err = add_dtmf(*m, "101", 8000);
	if (!err && hd)
		err = add_dtmf(*m, "110", 48000);
	return err;
}

static int pick(struct sdp_media *m, int hd, int first, int *k, const struct sdp_format **dtmf)
{
	const struct sdp_format *f;
	int pts[32], n = 0, p, i;
	const char *names[32];
	uint32_t rate;
	struct le *le;

	for (le = sdp_media_format_lst(m, false)->head; le && n < 32; le = le->next) {
		f = le->data;
		pts[n] = f->pt;
		names[n++] = f->name ? f->name : "";
	}
	if ((p = sdp_pick(pts, names, n, hd, first)) < 0)
		return -1;
	for (i = 0; i < n && pts[i] != p; i++)
		;
	*k = codec_kind(p, names[i]);
	rate = *k == C_OPUS ? 48000 : 8000;
	dtmf_pt = -1;
	*dtmf = NULL;
	for (le = sdp_media_format_lst(m, false)->head; le; le = le->next) {
		f = le->data;
		if (f->name && !strcasecmp(f->name, "telephone-event") && f->srate == rate) {
			dtmf_pt = f->pt;
			*dtmf = f;
			break;
		}
	}
	return p;
}

static struct sdp_session *offered;
static struct sdp_media *offered_m;

int media_offer(struct mbuf **mb, const struct sa *laddr, int hd)
{
	struct sdp_session *sess = NULL;
	struct sdp_media *m;
	int err = build(&sess, &m, laddr, hd);

	if (!err)
		err = sdp_encode(mb, sess, true);
	if (err) {
		mem_deref(sess);
		return err;
	}
	mem_deref(offered);
	offered = sess;
	offered_m = m;
	return 0;
}

static struct sdp_session *answered;

int media_answer(struct mbuf **mb, const struct sa *laddr, struct mbuf *offer, int hd)
{
	struct sdp_session *all = NULL, *sess = NULL;
	struct sdp_media *m, *one;
	const struct sdp_format *dtmf;
	char id[8];
	int err = build(&all, &m, laddr, hd), p = -1, k = C_NONE;
	size_t pos = offer->pos;

	if (!err)
		err = sdp_decode(all, offer, true);
	if (!err && (p = pick(m, hd, 0, &k, &dtmf)) < 0)
		err = EPROTO;
	if (!err)
		err = new_media(&sess, &one, laddr);
	if (!err) {
		re_snprintf(id, sizeof(id), "%d", p);
		err = add_codec(one, id, k);
	}
	if (!err && dtmf)
		err = add_dtmf(one, dtmf->id, dtmf->srate);
	if (!err) {
		offer->pos = pos;
		err = sdp_decode(sess, offer, true);
	}
	if (!err)
		err = sdp_encode(mb, sess, false);
	mem_deref(all);
	if (err) {
		mem_deref(sess);
		return err;
	}
	mem_deref(answered);
	answered = sess;
	start(sdp_media_raddr(one), p, k);
	return 0;
}

int media_take_answer(struct mbuf *answer, int hd)
{
	const struct sdp_format *dtmf;
	int err = offered ? sdp_decode(offered, answer, false) : EPROTO, p = -1, k = C_NONE;

	if (!err && (p = pick(offered_m, hd, 1, &k, &dtmf)) < 0)
		err = EPROTO;
	if (!err)
		start(sdp_media_raddr(offered_m), p, k);
	offered = mem_deref(offered);
	return err;
}
