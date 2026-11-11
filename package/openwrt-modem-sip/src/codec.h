/* SPDX-License-Identifier: GPL-2.0 */
/* Copyright (C) 2026 perz3us */
#ifndef CODEC_H
#define CODEC_H

#include <stdint.h>
#include <stdlib.h>

void g711a_enc(const int16_t *in, uint8_t *out, int n);
void g711a_dec(const uint8_t *in, int16_t *out, int n);
void g711u_enc(const int16_t *in, uint8_t *out, int n);
void g711u_dec(const uint8_t *in, int16_t *out, int n);

struct g722;
struct g722 *g722_new(void);
int g722_enc(struct g722 *c, const int16_t *in, int n, uint8_t *out);
int g722_dec(struct g722 *c, const uint8_t *in, int n, int16_t *out);
void g722_free(struct g722 *c);

struct opus16;
struct opus16 *opus16_new(void);
int opus16_enc(struct opus16 *c, const int16_t *in, uint8_t *out, int max);
int opus16_dec(struct opus16 *c, const uint8_t *in, int n, int16_t *out, int max);
void opus16_free(struct opus16 *c);

#endif
