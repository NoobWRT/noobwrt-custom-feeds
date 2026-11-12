// SPDX-License-Identifier: GPL-2.0
// Copyright (C) 2026 perz3us
#include <assert.h>
#include <math.h>
#include <stdio.h>
#include "../src/codec.h"

static void a_law_roundtrip(void)
{
	int16_t in[1], out[1];
	uint8_t b[1];
	int v;

	for (v = -32768; v < 32768; v += 8) {
		int step = abs(v) < 64 ? 16 : abs(v) / 16 + 16;

		in[0] = v;
		g711a_enc(in, b, 1);
		g711a_dec(b, out, 1);
		assert(abs(out[0] - v) <= step);
	}
}

static void u_law_known(void)
{
	int16_t in[2] = { 0, -32768 }, back[1];
	uint8_t b[2];
	int v;

	g711u_enc(in, b, 2);
	assert(b[0] == 0xff && b[1] == 0x00);
	for (v = -32768; v < 32768; v += 8) {
		int16_t one = v;
		int step = abs(v) < 128 ? 16 : abs(v) / 16 + 16;

		g711u_enc(&one, b, 1);
		g711u_dec(b, back, 1);
		assert(abs(back[0] - v) <= step);
	}
}

static void g722_size(void)
{
	struct g722 *c = g722_new();
	int16_t pcm[320] = { 0 }, back[320];
	uint8_t data[200];

	assert(c);
	assert(g722_enc(c, pcm, 320, data) == 160);
	assert(g722_dec(c, data, 160, back) == 320);
	g722_free(c);
}

static void g722_tone(void)
{
	struct g722 *c = g722_new();
	static int16_t pcm[1600], back[1600];
	static uint8_t data[800];
	double sig = 0, err = 0;
	int i, best = 0, lag;

	for (i = 0; i < 1600; i++)
		pcm[i] = (int16_t)(8000 * sin(2 * M_PI * 1000 * i / 16000.0));
	assert(g722_enc(c, pcm, 1600, data) == 800);
	assert(g722_dec(c, data, 800, back) == 1600);
	for (lag = 0; lag < 40; lag++) {
		double e = 0;

		for (i = 200; i < 1500; i++)
			e += pow(pcm[i] - back[i + lag], 2);
		if (lag == 0 || e < err) {
			err = e;
			best = lag;
		}
	}
	for (i = 200; i < 1500; i++)
		sig += pow(pcm[i], 2);
	assert(10 * log10(sig / err) > 25);
	(void)best;
	g722_free(c);
}

static void opus_tone(void)
{
	struct opus16 *c = opus16_new();
	static int16_t pcm[8000], back[8000 + 960];
	uint8_t data[400];
	double sig = 0, err = 0;
	int i, f, n, got = 0, lag;

	assert(c);
	for (i = 0; i < 8000; i++)
		pcm[i] = (int16_t)(8000 * sin(2 * M_PI * 1000 * i / 16000.0));
	for (f = 0; f < 25; f++) {
		n = opus16_enc(c, pcm + f * 320, data, sizeof(data));
		assert(n > 0 && n <= (int)sizeof(data));
		n = opus16_dec(c, data, n, back + got, 960);
		assert(n == 320);
		got += n;
	}
	for (lag = 0; lag < 400; lag++) {
		double e = 0;

		for (i = 2000; i < 7000; i++)
			e += pow(pcm[i] - back[i + lag], 2);
		if (lag == 0 || e < err)
			err = e;
	}
	for (i = 2000; i < 7000; i++)
		sig += pow(pcm[i], 2);
	assert(10 * log10(sig / err) > 10);
	assert(opus16_dec(c, NULL, 0, back, 960) == 320);
	opus16_free(c);
}

int main(void)
{
	a_law_roundtrip();
	u_law_known();
	g722_size();
	g722_tone();
	opus_tone();
	puts("test_codec ok");
	return 0;
}
