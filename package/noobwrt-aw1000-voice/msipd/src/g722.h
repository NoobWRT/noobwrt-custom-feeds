/*
 * The state structures and options below are from SpanDSP (g722.h and
 * private/g722.h), Copyright (C) 2005 Steve Underwood, under the GNU Lesser
 * General Public License version 2.1, like g722.c. The small helpers at the
 * end stand in for the parts of SpanDSP that g722.c uses.
 */
#ifndef G722_H
#define G722_H

#include <stdbool.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>

#define SPAN_DECLARE(type) type

enum {
	G722_SAMPLE_RATE_8000 = 0x0001,
	G722_PACKED = 0x0002
};

typedef struct {
	int16_t nb;
	int16_t det;
	int16_t s;
	int16_t sz;
	int16_t r;
	int16_t p[2];
	int16_t a[2];
	int16_t b[6];
	int16_t d[7];
} g722_band_t;

typedef struct g722_encode_state_s {
	bool itu_test_mode;
	bool packed;
	bool eight_k;
	int bits_per_sample;
	int16_t x[12];
	int16_t y[12];
	int ptr;
	g722_band_t band[2];
	uint32_t out_buffer;
	int out_bits;
} g722_encode_state_t;

typedef struct g722_decode_state_s {
	bool itu_test_mode;
	bool packed;
	bool eight_k;
	int bits_per_sample;
	int16_t x[12];
	int16_t y[12];
	int ptr;
	g722_band_t band[2];
	uint32_t in_buffer;
	int in_bits;
} g722_decode_state_t;

g722_encode_state_t *g722_encode_init(g722_encode_state_t *s, int rate, int options);
int g722_encode_release(g722_encode_state_t *s);
int g722_encode_free(g722_encode_state_t *s);
int g722_encode(g722_encode_state_t *s, uint8_t g722_data[], const int16_t amp[], int len);
g722_decode_state_t *g722_decode_init(g722_decode_state_t *s, int rate, int options);
int g722_decode_release(g722_decode_state_t *s);
int g722_decode_free(g722_decode_state_t *s);
int g722_decode(g722_decode_state_t *s, int16_t amp[], const uint8_t g722_data[], int len);

static inline void *span_alloc(size_t n)
{
	return malloc(n);
}

static inline void span_free(void *p)
{
	free(p);
}

static inline int16_t saturate16(int32_t v)
{
	return v > INT16_MAX ? INT16_MAX : v < INT16_MIN ? INT16_MIN : (int16_t)v;
}

static inline int16_t saturate15(int32_t v)
{
	return v > 16383 ? 16383 : v < -16384 ? -16384 : (int16_t)v;
}

static inline int16_t sat_add16(int16_t a, int16_t b)
{
	return saturate16((int32_t)a + b);
}

static inline int16_t sat_sub16(int16_t a, int16_t b)
{
	return saturate16((int32_t)a - b);
}

static inline int32_t vec_circular_dot_prodi16(const int16_t x[], const int16_t y[], int n, int pos)
{
	int32_t z = 0;
	int i;

	for (i = 0; i < n - pos; i++)
		z += (int32_t)x[pos + i] * y[i];
	for (i = 0; i < pos; i++)
		z += (int32_t)x[i] * y[n - pos + i];
	return z;
}

#endif
