#!/bin/sh

while true; do
    INTERVAL=$(uci get ledstatus.settings.interval 2>/dev/null)
    [ -z "$INTERVAL" ] && INTERVAL=20
    [ ! -f /tmp/led-night-active ] && /usr/bin/led-status-check.sh
    sleep "$INTERVAL"
done
