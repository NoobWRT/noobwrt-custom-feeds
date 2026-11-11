// SPDX-License-Identifier: GPL-2.0
// Copyright (C) 2026 perz3us
#include <opus/opus.h>
#include "codec.h"
#include "g722.h"

static uint8_t alaw1(int16_t s)
{
	int v = s, mask, seg = 0;

	if (v >= 0) {
		mask = 0xd5;
	} else {
		mask = 0x55;
		v = -v - 1;
	}
	v >>= 3;
	while (seg < 8 && v >= (32 << seg))
		seg++;
	if (seg >= 8)
		return 0x7f ^ mask;
	return ((seg << 4) | ((seg < 2 ? v >> 1 : v >> seg) & 0x0f)) ^ mask;
}

static int16_t alaw_dec1(uint8_t a)
{
	int t, seg;

	a ^= 0x55;
	t = (a & 0x0f) << 4;
	seg = (a & 0x70) >> 4;
	if (seg == 0)
		t += 8;
	else if (seg == 1)
		t += 0x108;
	else
		t = (t + 0x108) << (seg - 1);
	return (a & 0x80) ? t : -t;
}

static uint8_t ulaw1(int16_t s)
{
	int v = s >> 2, mask, seg = 0;

	if (v < 0) {
		v = -v;
		mask = 0x7f;
	} else {
		mask = 0xff;
	}
	if (v > 8159)
		v = 8159;
	v += 0x21;
	while (seg < 8 && v > (0x3f << seg | ((1 << seg) - 1)))
		seg++;
	if (seg >= 8)
		return 0x7f ^ mask;
	return ((seg << 4) | ((v >> (seg + 1)) & 0x0f)) ^ mask;
}

static int16_t ulaw_dec1(uint8_t u)
{
	int t;

	u = ~u;
	t = (((u & 0x0f) << 3) + 0x84) << ((u & 0x70) >> 4);
	return (u & 0x80) ? 0x84 - t : t - 0x84;
}

void g711a_enc(const int16_t *in, uint8_t *out, int n)
{
	while (n-- > 0)
		*out++ = alaw1(*in++);
}

void g711a_dec(const uint8_t *in, int16_t *out, int n)
{
	while (n-- > 0)
		*out++ = alaw_dec1(*in++);
}

void g711u_enc(const int16_t *in, uint8_t *out, int n)
{
	while (n-- > 0)
		*out++ = ulaw1(*in++);
}

void g711u_dec(const uint8_t *in, int16_t *out, int n)
{
	while (n-- > 0)
		*out++ = ulaw_dec1(*in++);
}

struct g722 {
	g722_encode_state_t enc;
	g722_decode_state_t dec;
};

struct g722 *g722_new(void)
{
	struct g722 *c = calloc(1, sizeof(*c));

	if (c) {
		g722_encode_init(&c->enc, 64000, 0);
		g722_decode_init(&c->dec, 64000, 0);
	}
	return c;
}

int g722_enc(struct g722 *c, const int16_t *in, int n, uint8_t *out)
{
	return g722_encode(&c->enc, out, in, n);
}

int g722_dec(struct g722 *c, const uint8_t *in, int n, int16_t *out)
{
	return g722_decode(&c->dec, out, in, n);
}

void g722_free(struct g722 *c)
{
	free(c);
}

struct opus16 {
	OpusEncoder *enc;
	OpusDecoder *dec;
};

struct opus16 *opus16_new(void)
{
	struct opus16 *c = calloc(1, sizeof(*c));
	int err;

	if (!c)
		return NULL;
	c->enc = opus_encoder_create(16000, 1, OPUS_APPLICATION_VOIP, &err);
	if (c->enc) {
		opus_encoder_ctl(c->enc, OPUS_SET_BITRATE(24000));
		opus_encoder_ctl(c->enc, OPUS_SET_INBAND_FEC(1));
		opus_encoder_ctl(c->enc, OPUS_SET_PACKET_LOSS_PERC(5));
		c->dec = opus_decoder_create(16000, 1, &err);
	}
	if (!c->enc || !c->dec) {
		opus16_free(c);
		return NULL;
	}
	return c;
}

int opus16_enc(struct opus16 *c, const int16_t *in, uint8_t *out, int max)
{
	int n = opus_encode(c->enc, in, 320, out, max);

	return n > 0 ? n : 0;
}

int opus16_dec(struct opus16 *c, const uint8_t *in, int n, int16_t *out, int max)
{
	int got = opus_decode(c->dec, n ? in : NULL, n, out, n || max < 320 ? max : 320, 0);

	return got > 0 ? got : 0;
}

void opus16_free(struct opus16 *c)
{
	if (!c)
		return;
	if (c->enc)
		opus_encoder_destroy(c->enc);
	if (c->dec)
		opus_decoder_destroy(c->dec);
	free(c);
}
