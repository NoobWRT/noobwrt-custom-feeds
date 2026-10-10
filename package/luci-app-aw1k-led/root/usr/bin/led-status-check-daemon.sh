#!/bin/sh
#=================================================
# Copyright (c) 2026 Lahiru S Liyanage (NoobLK) <liyanagelsofficial@gmail.com>
# GitHub: https://github.com/nooblk-98/luci-app-aw1k-led
# Telegram: @itsme_nooblk
# License: GPL-3.0-or-later
#=================================================

while true; do
    INTERVAL=$(uci get ledstatus.settings.interval 2>/dev/null)
    [ -z "$INTERVAL" ] && INTERVAL=20
    [ ! -f /tmp/led-night-active ] && /usr/bin/led-status-check.sh
    sleep "$INTERVAL"
done
