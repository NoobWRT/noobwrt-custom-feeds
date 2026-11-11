CFLAGS ?= -O2
override CFLAGS += -std=gnu11 -Wall -Wextra -Werror
override CFLAGS += -I/usr/local/include/re -I$(STAGING_DIR)/usr/include/re
CORE = build/msipd.o build/codec.o build/g722.o build/clcc.o build/phones.o build/call.o build/audio.o build/media.o build/sip.o build/bus.o
OBJS = $(CORE) build/modem.o
LIBS = -lre -lubus -lubox -luci -lopus -lm

build/msipd: $(OBJS)
	$(CC) $(CFLAGS) -o $@ $(OBJS) $(LDFLAGS) $(LIBS)

build/msipd-test: $(CORE) tests/fake_modem.c
	$(CC) $(CFLAGS) -o $@ $(CORE) tests/fake_modem.c $(LIBS)

build/g722.o: src/g722.c src/g722.h
	mkdir -p build
	$(CC) $(CFLAGS) -Wno-unused-parameter -c -o $@ $<

build/modem.o: src/modem.c src/modem.h
	mkdir -p build
	$(CC) $(CFLAGS) -Wno-format-truncation -c -o $@ $<

build/%.o: src/%.c $(wildcard src/*.h)
	mkdir -p build
	$(CC) $(CFLAGS) -c -o $@ $<

test: build/codec.o build/g722.o
	$(CC) $(CFLAGS) -o build/test_codec tests/test_codec.c build/codec.o build/g722.o -lopus -lm
	./build/test_codec
	$(CC) $(CFLAGS) -o build/test_clcc tests/test_clcc.c src/clcc.c
	./build/test_clcc
	$(CC) $(CFLAGS) -Wno-unused-function -Wno-format-truncation -o build/test_modem tests/test_modem.c
	./build/test_modem
	$(CC) $(CFLAGS) -o build/test_phones tests/test_phones.c src/phones.c -lre -luci -lubox
	./build/test_phones
	$(CC) $(CFLAGS) -o build/test_call tests/test_call.c src/call.c
	./build/test_call
	$(CC) $(CFLAGS) -o build/test_audio tests/test_audio.c src/audio.c
	./build/test_audio

clean:
	rm -rf build

.PHONY: test clean
