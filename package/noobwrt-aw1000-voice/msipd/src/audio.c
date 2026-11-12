// SPDX-License-Identifier: GPL-2.0
// Copyright (C) 2026 perz3us
#include <errno.h>
#include <stdio.h>
#include <string.h>
#include <sys/socket.h>
#include <sys/un.h>
#include <time.h>
#include <unistd.h>
#include "audio.h"

#define RETRY_MS 500

const char *audio_fxsd_path = "/var/run/fxsd/pcm.sock";
static int sock = -1;
static long tried = -RETRY_MS;
static int wanted;
static int last_n = 160;

static long now_ms(void)
{
	struct timespec t;

	clock_gettime(CLOCK_MONOTONIC, &t);
	return t.tv_sec * 1000L + t.tv_nsec / 1000000;
}

static int try_connect(void)
{
	struct sockaddr_un a = { .sun_family = AF_UNIX };

	tried = now_ms();
	snprintf(a.sun_path, sizeof(a.sun_path), "%s", audio_fxsd_path);
	if ((sock = socket(AF_UNIX, SOCK_SEQPACKET | SOCK_NONBLOCK | SOCK_CLOEXEC, 0)) < 0)
		return -1;
	if (connect(sock, (struct sockaddr *)&a, sizeof(a))) {
		close(sock);
		sock = -1;
		return -1;
	}
	return 0;
}

static int fxsd_open(void)
{
	wanted = 1;
	return sock >= 0 ? 0 : try_connect();
}

static void drop(void)
{
	if (sock >= 0)
		close(sock);
	sock = -1;
}

static int fxsd_read(int16_t *buf, int max)
{
	ssize_t n;

	if (sock < 0) {
		if (wanted && now_ms() - tried >= RETRY_MS)
			try_connect();
		return 0;
	}
	n = recv(sock, buf, max * sizeof(*buf), MSG_DONTWAIT);
	if (n > 0) {
		last_n = n / sizeof(*buf);
		return last_n;
	}
	if (n == 0 || (errno != EAGAIN && errno != EWOULDBLOCK && errno != EINTR))
		drop();
	return 0;
}

static int fxsd_write(const int16_t *buf, int n)
{
	if (sock < 0 || send(sock, buf, n * sizeof(*buf), MSG_DONTWAIT | MSG_NOSIGNAL) < 0)
		return 0;
	return n;
}

int audio_hd(void)
{
	return last_n == 320;
}

static int fxsd_fd(void)
{
	return sock;
}

static void fxsd_close(void)
{
	wanted = 0;
	drop();
}

const struct audio_src audio_fxsd = {
	.open = fxsd_open,
	.read = fxsd_read,
	.write = fxsd_write,
	.fd = fxsd_fd,
	.close = fxsd_close,
};
