// SPDX-License-Identifier: GPL-2.0
// Copyright (C) 2026 perz3us
#include <assert.h>
#include <stdio.h>
#include <string.h>
#include <sys/socket.h>
#include <sys/un.h>
#include <time.h>
#include <unistd.h>
#include "../src/audio.h"

#define SOCK "/tmp/msip-test-pcm.sock"

static int listen_at(void)
{
	struct sockaddr_un a = { .sun_family = AF_UNIX };
	int s = socket(AF_UNIX, SOCK_SEQPACKET, 0);

	strcpy(a.sun_path, SOCK);
	unlink(SOCK);
	assert(s >= 0 && !bind(s, (struct sockaddr *)&a, sizeof(a)) && !listen(s, 1));
	return s;
}

static void ms(int n)
{
	struct timespec t = { n / 1000, (n % 1000) * 1000000L };

	nanosleep(&t, NULL);
}

static int read_frame(int16_t *buf, int want)
{
	int i, n;

	for (i = 0; i < 200; i++) {
		if ((n = audio_fxsd.read(buf, 320)) == want)
			return n;
		ms(10);
	}
	return n;
}

int main(void)
{
	int16_t f8[160], f16[320], got[320];
	int ls, c;

	audio_fxsd_path = SOCK;
	memset(f8, 1, sizeof(f8));
	memset(f16, 2, sizeof(f16));

	ls = listen_at();
	assert(audio_fxsd.open() == 0);
	c = accept(ls, NULL, NULL);
	assert(c >= 0);

	assert(send(c, f8, sizeof(f8), 0) == sizeof(f8));
	assert(read_frame(got, 160) == 160 && !memcmp(got, f8, sizeof(f8)));
	assert(send(c, f16, sizeof(f16), 0) == sizeof(f16));
	assert(read_frame(got, 320) == 320 && !memcmp(got, f16, sizeof(f16)));
	assert(audio_fxsd.write(f8, 160) == 160);
	assert(recv(c, got, sizeof(got), 0) == sizeof(f8));

	close(c);
	close(ls);
	assert(audio_fxsd.read(got, 320) == 0);
	ls = listen_at();
	ms(600);
	assert(audio_fxsd.read(got, 320) == 0);
	c = accept(ls, NULL, NULL);
	assert(c >= 0);
	assert(send(c, f8, sizeof(f8), 0) == sizeof(f8));
	assert(read_frame(got, 160) == 160);

	audio_fxsd.close();
	close(c);
	close(ls);
	unlink(SOCK);
	puts("test_audio ok");
	return 0;
}
