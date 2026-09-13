#define _POSIX_C_SOURCE 200809L

#include "browser_media.h"

#include <arpa/inet.h>
#include <errno.h>
#include <fcntl.h>
#include <stdint.h>
#include <stdio.h>
#include <string.h>
#include <sys/stat.h>
#include <time.h>
#include <unistd.h>

#ifndef QMODEM_VOIP_HOST_TEST
#include <libwebsockets.h>
#endif

static void secure_zero(void *value, size_t length)
{
	volatile unsigned char *bytes = value;
	while (length--)
		*bytes++ = 0;
}

static int copy_string(char *destination, size_t size, const char *source)
{
	if (!destination || !size || !source || !source[0] || strlen(source) >= size)
		return -1;
	(void)snprintf(destination, size, "%s", source);
	return 0;
}

static int read_file(const char *path, uint8_t *output, size_t size, size_t *length)
{
	int file;
	ssize_t received;
	if (!path || !output || !length || !size || (file = open(path, O_RDONLY | O_CLOEXEC)) < 0)
		return -1;
	received = read(file, output, size);
	(void)close(file);
	if (received <= 0 || (size_t)received == size) {
		secure_zero(output, size);
		return -1;
	}
	*length = (size_t)received;
	return 0;
}

static int random_bytes(uint8_t *output, size_t length)
{
	int file;
	size_t done = 0;
	if (!output || !length)
		return -1;
	file = open("/dev/urandom", O_RDONLY | O_CLOEXEC);
	if (file < 0)
		return -1;
	while (done < length) {
		ssize_t received = read(file, output + done, length - done);
		if (received < 0 && errno == EINTR)
			continue;
		if (received <= 0) {
			(void)close(file);
			secure_zero(output, length);
			return -1;
		}
		done += (size_t)received;
	}
	(void)close(file);
	return 0;
}

static int constant_time_equal(const uint8_t *left, const uint8_t *right, size_t length)
{
	uint8_t different = 0;
	while (length--)
		different |= *left++ ^ *right++;
	return different == 0;
}

static const char base64url[] = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

static int base64url_value(unsigned char value)
{
	const char *position = strchr(base64url, value);
	return position ? (int)(position - base64url) : -1;
}

static void encode_token(const uint8_t input[QMODEM_VOIP_BROWSER_TOKEN_BYTES], char output[23])
{
	unsigned accumulator = 0;
	unsigned bits = 0;
	size_t position = 0;
	for (size_t i = 0; i < QMODEM_VOIP_BROWSER_TOKEN_BYTES; i++) {
		accumulator = (accumulator << 8) | input[i];
		bits += 8;
		while (bits >= 6) {
			bits -= 6;
			output[position++] = base64url[(accumulator >> bits) & 63U];
		}
	}
	if (bits)
		output[position++] = base64url[(accumulator << (6U - bits)) & 63U];
	output[position] = '\0';
}

static int decode_token(const char *input, uint8_t output[QMODEM_VOIP_BROWSER_TOKEN_BYTES])
{
	unsigned accumulator = 0;
	unsigned bits = 0;
	size_t position = 0;
	if (!input || strlen(input) != QMODEM_VOIP_BROWSER_TOKEN_TEXT)
		return -1;
	for (size_t i = 0; input[i]; i++) {
		int value = base64url_value((unsigned char)input[i]);
		if (value < 0)
			return -1;
		accumulator = (accumulator << 6) | (unsigned)value;
		bits += 6;
		while (bits >= 8) {
			bits -= 8;
			if (position >= QMODEM_VOIP_BROWSER_TOKEN_BYTES)
				return -1;
			output[position++] = (uint8_t)(accumulator >> bits);
		}
	}
	return position == QMODEM_VOIP_BROWSER_TOKEN_BYTES && bits == 4U ? 0 : -1;
}

static void clear_slot(struct qmodem_voip_browser_token *slot)
{
	secure_zero(slot, sizeof(*slot));
}

static void expire_tokens(struct qmodem_voip_browser_tokens *tokens, uint64_t now)
{
	for (size_t i = 0; i < QMODEM_VOIP_BROWSER_TOKEN_SLOTS; i++)
		if (tokens->slots[i].active && now >= tokens->slots[i].expires_at)
			clear_slot(&tokens->slots[i]);
}

void qmodem_voip_browser_tokens_init(struct qmodem_voip_browser_tokens *tokens)
{
	if (tokens)
		secure_zero(tokens, sizeof(*tokens));
}

void qmodem_voip_browser_tokens_clear(struct qmodem_voip_browser_tokens *tokens)
{
	if (tokens)
		secure_zero(tokens, sizeof(*tokens));
}

int qmodem_voip_browser_token_issue(struct qmodem_voip_browser_tokens *tokens,
				    const char *session_id, uint64_t call_revision,
				    const char *origin, const char *peer_address,
				    uint64_t now, char token[23])
{
	struct qmodem_voip_browser_token *slot = NULL;
	if (!tokens || !token || !call_revision || copy_string((char[65]){ 0 }, 65, session_id) ||
	    copy_string((char[193]){ 0 }, 193, origin) || strncmp(origin, "https://", 8) != 0)
		return -1;
	expire_tokens(tokens, now);
	for (size_t i = 0; i < QMODEM_VOIP_BROWSER_TOKEN_SLOTS; i++)
		if (!tokens->slots[i].active) {
			slot = &tokens->slots[i];
			break;
		}
	if (!slot) {
		slot = &tokens->slots[0];
		for (size_t i = 1; i < QMODEM_VOIP_BROWSER_TOKEN_SLOTS; i++)
			if (tokens->slots[i].expires_at < slot->expires_at)
				slot = &tokens->slots[i];
		clear_slot(slot);
	}
	if (random_bytes(slot->secret, sizeof(slot->secret)) ||
	    copy_string(slot->session_id, sizeof(slot->session_id), session_id) ||
	    copy_string(slot->origin, sizeof(slot->origin), origin)) {
		clear_slot(slot);
		return -1;
	}
	slot->call_revision = call_revision;
	if (peer_address && copy_string(slot->peer_address, sizeof(slot->peer_address), peer_address)) {
		clear_slot(slot);
		return -1;
	}
	slot->expires_at = now + QMODEM_VOIP_BROWSER_TOKEN_TTL;
	slot->active = 1;
	encode_token(slot->secret, token);
	return 0;
}

int qmodem_voip_browser_token_consume(struct qmodem_voip_browser_tokens *tokens,
				      const char *token, const char *session_id,
				      uint64_t call_revision, const char *origin,
				      const char *peer_address, uint64_t now)
{
	uint8_t secret[QMODEM_VOIP_BROWSER_TOKEN_BYTES];
	int accepted = -1;
	if (!tokens || !session_id || !origin || decode_token(token, secret) != 0)
		return -1;
	expire_tokens(tokens, now);
	for (size_t i = 0; i < QMODEM_VOIP_BROWSER_TOKEN_SLOTS; i++) {
		struct qmodem_voip_browser_token *slot = &tokens->slots[i];
		if (!slot->active || !constant_time_equal(slot->secret, secret, sizeof(secret)))
			continue;
		if (slot->call_revision == call_revision && strcmp(slot->session_id, session_id) == 0 &&
		    strcmp(slot->origin, origin) == 0 && peer_address && peer_address[0] &&
		    ((!slot->peer_address[0] && copy_string(slot->peer_address,
			    sizeof(slot->peer_address), peer_address) == 0) ||
		     (slot->peer_address[0] && strcmp(slot->peer_address, peer_address) == 0)))
			accepted = 0;
		clear_slot(slot);
		break;
	}
	secure_zero(secret, sizeof(secret));
	return accepted;
}

static uint32_t read_le32(const uint8_t *value)
{
	return (uint32_t)value[0] | ((uint32_t)value[1] << 8) |
		((uint32_t)value[2] << 16) | ((uint32_t)value[3] << 24);
}

int qmodem_voip_browser_frame_parse(const uint8_t *data, size_t length,
				    struct qmodem_voip_browser_frame *frame)
{
	if (!data || !frame || length != QMODEM_VOIP_BROWSER_FRAME_SIZE ||
	    read_le32(data) != QMODEM_VOIP_BROWSER_MAGIC || data[4] != QMODEM_VOIP_BROWSER_VERSION ||
	    data[5] != QMODEM_VOIP_BROWSER_FORMAT_S16LE || data[6] != 1U || data[7] != 0U ||
	    read_le32(data + 8) != QMODEM_VOIP_BROWSER_RATE ||
	    read_le32(data + 20) != QMODEM_VOIP_BROWSER_FRAME_SAMPLES)
		return -1;
	frame->sequence = read_le32(data + 12);
	frame->timestamp_ms = read_le32(data + 16);
	for (size_t i = 0; i < QMODEM_VOIP_BROWSER_FRAME_SAMPLES; i++)
		frame->samples[i] = (int16_t)((uint16_t)data[24 + i * 2] |
			((uint16_t)data[25 + i * 2] << 8));
	return 0;
}

int qmodem_voip_browser_configure(struct qmodem_voip_browser_media *browser,
				  struct qmodem_voip_media_engine *engine,
				  const char *address, const char *certificate, const char *key)
{
	struct in_addr parsed;
	struct stat certificate_stat;
	struct stat key_stat;
	if (!browser || !engine || !address || inet_pton(AF_INET, address, &parsed) != 1 ||
	    parsed.s_addr == INADDR_ANY || (ntohl(parsed.s_addr) >> 24) == 127U ||
	    copy_string(browser->address, sizeof(browser->address), address) ||
	    copy_string(browser->certificate, sizeof(browser->certificate), certificate) ||
	    copy_string(browser->key, sizeof(browser->key), key) || stat(certificate, &certificate_stat) ||
	    stat(key, &key_stat) || !S_ISREG(certificate_stat.st_mode) || !S_ISREG(key_stat.st_mode) ||
	    read_file(certificate, browser->certificate_data, sizeof(browser->certificate_data),
		&browser->certificate_length) ||
	    read_file(key, browser->key_data, sizeof(browser->key_data), &browser->key_length))
		return -1;
	browser->engine = engine;
	qmodem_voip_browser_tokens_init(&browser->tokens);
	return 0;
}

#ifndef QMODEM_VOIP_HOST_TEST
struct qmodem_voip_browser_connection {
	uint8_t downlink[LWS_PRE + QMODEM_VOIP_BROWSER_FRAME_SIZE];
	unsigned downlink_offset;
	unsigned downlink_samples;
};

static int query_value(const char *query, const char *key, char *value, size_t size)
{
	const char *position;
	size_t key_length = strlen(key);
	if (!query || !key || !value || !size)
		return -1;
	position = query;
	while (position && *position) {
		const char *next = strchr(position, '&');
		size_t length = next ? (size_t)(next - position) : strlen(position);
		if (length > key_length + 1U && strncmp(position, key, key_length) == 0 &&
		    position[key_length] == '=' && length - key_length - 1U < size) {
			memcpy(value, position + key_length + 1U, length - key_length - 1U);
			value[length - key_length - 1U] = '\0';
			return 0;
		}
		position = next ? next + 1 : NULL;
	}
	return -1;
}

static int cookie_value(const char *cookie, const char *key, char *value, size_t size)
{
	const char *position = cookie;
	size_t key_length = strlen(key);
	while (position && *position) {
		while (*position == ' ' || *position == ';')
			position++;
		if (strncmp(position, key, key_length) == 0 && position[key_length] == '=') {
			const char *end = strchr(position + key_length + 1U, ';');
			size_t length = end ? (size_t)(end - (position + key_length + 1U)) :
				strlen(position + key_length + 1U);
			if (!length || length >= size)
				return -1;
			memcpy(value, position + key_length + 1U, length);
			value[length] = '\0';
			return 0;
		}
		position = strchr(position, ';');
		if (position)
			position++;
	}
	return -1;
}

static void write_le32(uint8_t *value, uint32_t number)
{
	value[0] = (uint8_t)number;
	value[1] = (uint8_t)(number >> 8);
	value[2] = (uint8_t)(number >> 16);
	value[3] = (uint8_t)(number >> 24);
}

static int browser_callback(struct lws *wsi, enum lws_callback_reasons reason,
			    void *user, void *input, size_t length)
{
	struct qmodem_voip_browser_media *browser = lws_context_user(lws_get_context(wsi));
	struct qmodem_voip_browser_connection *connection = user;
	if (!browser)
		return -1;
	if (reason == LWS_CALLBACK_FILTER_PROTOCOL_CONNECTION) {
		char uri[512] = { 0 };
		char query[512] = { 0 };
		char cookie[512] = { 0 };
		char origin[193] = { 0 };
		char token[23] = { 0 };
		char requested_session[65] = { 0 };
		char cookie_session[65] = { 0 };
		char peer_address[64] = { 0 };
		if (browser->client || lws_hdr_copy(wsi, origin, sizeof(origin), WSI_TOKEN_ORIGIN) <= 0 ||
		    lws_hdr_copy(wsi, uri, sizeof(uri), WSI_TOKEN_GET_URI) <= 0 ||
		    lws_hdr_copy(wsi, query, sizeof(query), WSI_TOKEN_HTTP_URI_ARGS) <= 0 ||
		    lws_hdr_copy(wsi, cookie, sizeof(cookie), WSI_TOKEN_HTTP_COOKIE) <= 0 ||
		    strcmp(uri, "/media") != 0 || query_value(query, "token", token, sizeof(token)) ||
		    query_value(query, "session_id", requested_session, sizeof(requested_session)) ||
		    cookie_value(cookie, "sysauth", cookie_session, sizeof(cookie_session)) ||
		    strcmp(requested_session, cookie_session) != 0 ||
		    !lws_get_peer_simple(wsi, peer_address, sizeof(peer_address)) ||
		    qmodem_voip_browser_token_consume(&browser->tokens, token, requested_session,
			browser->call_revision, origin, peer_address, (uint64_t)time(NULL)) != 0)
			return -1;
		(void)copy_string(browser->origin, sizeof(browser->origin), origin);
		return 0;
	}
	if (reason == LWS_CALLBACK_ESTABLISHED) {
		if (browser->client || qmodem_voip_browser_media_attach(browser,
			browser->call_revision) != 0)
			return -1;
		browser->client = wsi;
		return 0;
	}
	if (reason == LWS_CALLBACK_RECEIVE) {
		if (!lws_frame_is_binary(wsi) || !lws_is_final_fragment(wsi) ||
		    lws_remaining_packet_payload(wsi) != 0 ||
		    qmodem_voip_browser_media_receive(browser, input, length) != 0)
			return -1;
		return 0;
	}
	if (reason == LWS_CALLBACK_SERVER_WRITEABLE) {
		struct qmodem_voip_media_frame frame;
		int16_t samples[QMODEM_VOIP_BROWSER_SAMPLES];
		size_t sample_count = 0;
		if (!connection->downlink_samples) {
			if (qmodem_voip_media_queue_pop(&browser->engine->modem_to_canonical, &frame) != 0 ||
			    qmodem_voip_media_resample(frame.samples, QMODEM_VOIP_MEDIA_SAMPLES,
				QMODEM_VOIP_MEDIA_RATE, samples, QMODEM_VOIP_BROWSER_SAMPLES,
				QMODEM_VOIP_BROWSER_RATE, &sample_count) != 0 ||
			    sample_count != QMODEM_VOIP_BROWSER_SAMPLES)
				return 0;
			memset(connection->downlink, 0, sizeof(connection->downlink));
			write_le32(connection->downlink + LWS_PRE, QMODEM_VOIP_BROWSER_MAGIC);
			connection->downlink[LWS_PRE + 4] = QMODEM_VOIP_BROWSER_VERSION;
			connection->downlink[LWS_PRE + 5] = QMODEM_VOIP_BROWSER_FORMAT_S16LE;
			connection->downlink[LWS_PRE + 6] = 1;
			write_le32(connection->downlink + LWS_PRE + 8, QMODEM_VOIP_BROWSER_RATE);
			write_le32(connection->downlink + LWS_PRE + 12, (uint32_t)frame.sequence);
			write_le32(connection->downlink + LWS_PRE + 16, (uint32_t)frame.timestamp_ms);
			write_le32(connection->downlink + LWS_PRE + 20, QMODEM_VOIP_BROWSER_FRAME_SAMPLES);
			for (size_t i = 0; i < QMODEM_VOIP_BROWSER_FRAME_SAMPLES; i++) {
				connection->downlink[LWS_PRE + 24 + i * 2] = (uint8_t)samples[i];
				connection->downlink[LWS_PRE + 25 + i * 2] = (uint8_t)((uint16_t)samples[i] >> 8);
			}
			connection->downlink_samples = QMODEM_VOIP_BROWSER_FRAME_SAMPLES;
		}
		if (lws_write(wsi, connection->downlink + LWS_PRE,
			QMODEM_VOIP_BROWSER_FRAME_SIZE, LWS_WRITE_BINARY) != QMODEM_VOIP_BROWSER_FRAME_SIZE)
			return -1;
		secure_zero(connection->downlink, sizeof(connection->downlink));
		connection->downlink_samples = 0;
		return 0;
	}
	if (reason == LWS_CALLBACK_CLOSED) {
		if (browser->client == wsi) {
			browser->client = NULL;
			browser->attached = 0;
			browser->engine->browser_media_ready = 0;
		}
		secure_zero(connection, sizeof(*connection));
	}
	return 0;
}

static const struct lws_protocols browser_protocols[] = {
	{ "qmodem-voip", browser_callback, sizeof(struct qmodem_voip_browser_connection), 0, 0, NULL, 0 },
	LWS_PROTOCOL_LIST_TERM
};
#endif

int qmodem_voip_browser_media_start(struct qmodem_voip_browser_media *browser,
				    uint64_t call_revision)
{
	if (!browser || !browser->engine || !browser->engine->ready || !call_revision || browser->ready)
		return -1;
#ifdef QMODEM_VOIP_HOST_TEST
	return -1;
#else
	{
		struct lws_context_creation_info info;
		memset(&info, 0, sizeof(info));
		info.port = 9443;
		info.iface = browser->address;
		info.protocols = browser_protocols;
		info.server_ssl_cert_mem = browser->certificate_data;
		info.server_ssl_cert_mem_len = (unsigned int)browser->certificate_length;
		info.server_ssl_private_key_mem = browser->key_data;
		info.server_ssl_private_key_mem_len = (unsigned int)browser->key_length;
		info.options = LWS_SERVER_OPTION_DO_SSL_GLOBAL_INIT;
		info.user = browser;
		browser->context = lws_create_context(&info);
	}
	if (!browser->context)
		return -1;
	browser->call_revision = call_revision;
	browser->ready = 1;
	return 0;
#endif
}

void qmodem_voip_browser_media_stop(struct qmodem_voip_browser_media *browser)
{
	if (!browser)
		return;
#ifndef QMODEM_VOIP_HOST_TEST
	if (browser->context)
		lws_context_destroy(browser->context);
#endif
	browser->context = NULL;
	browser->client = NULL;
	browser->attached = 0;
	browser->ready = 0;
	browser->call_revision = 0;
	browser->expected_sequence = 0;
	browser->last_timestamp_ms = 0;
	browser->sequence_seen = 0;
	browser->uplink_count = 0;
	secure_zero(browser->uplink, sizeof(browser->uplink));
	secure_zero(browser->certificate_data, sizeof(browser->certificate_data));
	secure_zero(browser->key_data, sizeof(browser->key_data));
	browser->certificate_length = 0;
	browser->key_length = 0;
	qmodem_voip_browser_tokens_clear(&browser->tokens);
	if (browser->engine) {
		qmodem_voip_media_queue_clear(&browser->engine->modem_to_canonical);
		qmodem_voip_media_queue_clear(&browser->engine->canonical_to_modem);
		browser->engine->browser_media_ready = 0;
	}
}

int qmodem_voip_browser_media_receive(struct qmodem_voip_browser_media *browser,
				      const uint8_t *data, size_t length)
{
	struct qmodem_voip_browser_frame frame;
	int16_t converted[80];
	size_t converted_samples = 0;
	if (!browser || !browser->ready || !browser->attached ||
	    qmodem_voip_browser_frame_parse(data, length, &frame) != 0 ||
	    (browser->sequence_seen && frame.sequence != browser->expected_sequence) ||
	    (browser->last_timestamp_ms && frame.timestamp_ms < browser->last_timestamp_ms) ||
	    qmodem_voip_media_resample(frame.samples, QMODEM_VOIP_BROWSER_FRAME_SAMPLES,
		QMODEM_VOIP_BROWSER_RATE, converted, sizeof(converted) / sizeof(converted[0]),
		QMODEM_VOIP_MEDIA_RATE, &converted_samples) != 0 || converted_samples != 80U)
		return -1;
	browser->expected_sequence = frame.sequence + 1U;
	browser->last_timestamp_ms = frame.timestamp_ms;
	browser->sequence_seen = 1;
	memcpy(browser->uplink + browser->uplink_count, converted, sizeof(converted));
	browser->uplink_count += 80U;
	if (browser->uplink_count == QMODEM_VOIP_MEDIA_SAMPLES) {
		browser->uplink_count = 0;
		if (qmodem_voip_media_queue_push(&browser->engine->canonical_to_modem,
			browser->uplink, QMODEM_VOIP_MEDIA_SAMPLES, frame.timestamp_ms) != 0) {
			browser->dropped++;
			return -1;
		}
		secure_zero(browser->uplink, sizeof(browser->uplink));
	}
	return 0;
}

int qmodem_voip_browser_media_attach(struct qmodem_voip_browser_media *browser,
				     uint64_t call_revision)
{
	if (!browser || !browser->ready || !browser->engine || !browser->engine->ready ||
	    browser->attached || browser->call_revision != call_revision)
		return -1;
	browser->attached = 1;
	browser->engine->browser_media_ready = 1;
	return 0;
}

int qmodem_voip_browser_media_service(struct qmodem_voip_browser_media *browser)
{
	if (!browser || !browser->ready)
		return -1;
#ifdef QMODEM_VOIP_HOST_TEST
	return -1;
#else
	if (browser->client)
		lws_callback_on_writable(browser->client);
	return lws_service(browser->context, 0) < 0 ? -1 : 0;
#endif
}

const char *qmodem_voip_browser_media_url(const struct qmodem_voip_browser_media *browser,
					   char *buffer, size_t size)
{
	if (!browser || !browser->ready || !buffer || !size ||
	    snprintf(buffer, size, "wss://%s:9443/media", browser->address) >= (int)size)
		return NULL;
	return buffer;
}
