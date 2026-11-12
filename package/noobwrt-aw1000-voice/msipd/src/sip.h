/* SPDX-License-Identifier: GPL-2.0 */
/* Copyright (C) 2026 perz3us */
#ifndef SIP_H
#define SIP_H

struct sip_cb {
	void (*answered)(const char *name);
	void (*dial)(const char *name, const char *number);
	void (*hangup)(void);
	void (*digit)(char d);
	int (*busy)(void);
	int (*hd)(void);
};

int sip_start(const char *bind_ip, int port, int rtp_from, int rtp_to, const struct sip_cb *cb);
void sip_ring_all(const char *number);
void sip_cancel_all(void);
void sip_connected(void);
void sip_bye(void);
void sip_stop(void);

/* SMS over SIP: send to every phone (or only the phone named 'to'); returns
 * the number sent now, *queued the number kept for phones that are away. */
int sip_sms(const char *from, const char *name, const char *text, const char *to, int *queued);
void sms_flush(const char *user);

#endif
