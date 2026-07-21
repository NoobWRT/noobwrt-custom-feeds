#!/bin/sh

. /usr/share/qmodem/led_scripts/connectivity.sh
. /usr/share/qmodem/led_scripts/misectel_led.sh

ON_OFF="$1"

misectel_led_init || exit 1
if [ "$ON_OFF" = off ]; then
	internet_leds_off
	exit 0
fi

internet_led_disconnected
last_connected=0
failed_probes=0
while true; do
	if qmodem_connectivity_probe 1; then
		connected=1
		failed_probes=0
	else
		failed_probes=$((failed_probes + 1))
		[ "$last_connected" != 1 ] || [ "$failed_probes" -ge 3 ] || {
			sleep 5
			continue
		}
		connected=0
	fi
	if [ "$connected" != "$last_connected" ]; then
		if [ "$connected" = 1 ]; then
			internet_led_connected
		else
			internet_led_disconnected
		fi
		last_connected="$connected"
	fi
	sleep 5
done
