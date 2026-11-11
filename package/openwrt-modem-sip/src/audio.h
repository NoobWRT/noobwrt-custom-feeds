/* SPDX-License-Identifier: GPL-2.0 */
/* Copyright (C) 2026 perz3us */
#ifndef AUDIO_H
#define AUDIO_H

#include <stdint.h>

struct audio_src {
	int (*open)(void);
	int (*read)(int16_t *buf, int max);
	int (*write)(const int16_t *buf, int n);
	int (*fd)(void);
	void (*close)(void);
};

extern const struct audio_src audio_fxsd;
extern const char *audio_fxsd_path;
int audio_hd(void);

#endif
