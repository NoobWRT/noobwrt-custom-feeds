#!/bin/sh
# AW1000 Night Mode controller (cron-based)
# Usage: led-night-mode.sh on|off|enable|disable
#
#   on       — activate night mode now (LEDs off, power LED on)
#   off      — deactivate night mode now (start LED service)
#   enable   — save night_enabled=1, set crons, activate if in window
#   disable  — save night_enabled=0, clear crons, restore LEDs

STATUS_LEDS="green:5g blue:5g red:5g green:internet green:wifi green:signal blue:signal red:signal"
POWER_LED="/sys/class/leds/green:power"
PHONE_LED="/sys/class/leds/green:phone"
BLINK_PID="/tmp/led-night-blink.pid"
NIGHT_ACTIVE_FLAG="/tmp/led-night-active"
BLINK_MARKER="aw1k_led_night_blink"
CRON_TAG="# aw1k-night-mode"

valid_time() {
    case "$1" in
        [0-1][0-9]:[0-5][0-9]|2[0-3]:[0-5][0-9]|[0-9]:[0-5][0-9]) return 0 ;;
        *) return 1 ;;
    esac
}

time_to_mins() {
    echo "$1" | awk -F: '{print ($1+0) * 60 + ($2+0)}'
}

is_night_active() {
    [ -f "$NIGHT_ACTIVE_FLAG" ]
}

# Phone LED slow blink during night mode — runs in background
_start_blink() {
    python3 -c "
import time
LED = '/sys/class/leds/green:phone'
def w(f, v):
    open(LED + '/' + f, 'w').write(v)
w('trigger', 'none')
while True:
    w('brightness', '1'); time.sleep(0.15)
    w('brightness', '0'); time.sleep(0.15)
    w('brightness', '1'); time.sleep(0.15)
    w('brightness', '0'); time.sleep(3.0)
" "$BLINK_MARKER" &
    echo $! > "$BLINK_PID"
}

_stop_blink() {
    if [ -f "$BLINK_PID" ]; then
        kill "$(cat "$BLINK_PID")" 2>/dev/null
        rm -f "$BLINK_PID"
    fi
    ps | grep "$BLINK_MARKER" | grep -v grep | awk '{print $1}' | while read -r pid; do
        [ -n "$pid" ] && kill "$pid" 2>/dev/null
    done
    echo none > "$PHONE_LED/trigger"
    echo 0    > "$PHONE_LED/brightness"
}

night_on() {
    # Turn off all status LEDs
    for led in $STATUS_LEDS; do
        echo none > "/sys/class/leds/$led/trigger"
        echo 0    > "/sys/class/leds/$led/brightness"
    done

    # Power LED stays on solid
    echo none > "$POWER_LED/trigger"
    echo 1    > "$POWER_LED/brightness"

    # Phone LED blinks as night indicator
    _stop_blink
    _start_blink
    touch "$NIGHT_ACTIVE_FLAG"

    logger -t led-night-mode "Night Mode activated"
}

night_off() {
    _stop_blink
    echo none > "$POWER_LED/trigger"
    echo 1    > "$POWER_LED/brightness"
    rm -f "$NIGHT_ACTIVE_FLAG"
    # Restart LED service to restore normal LED behaviour
    /etc/init.d/ledstatus restart >/dev/null 2>&1 &
    logger -t led-night-mode "Night Mode deactivated"
}

# ── Cron management ──────────────────────────────────────────────────────────

# Remove all night-mode cron entries we own
_clear_crons() {
    local tmp
    tmp=$(crontab -l 2>/dev/null | grep -v "$CRON_TAG")
    echo "$tmp" | crontab -
}

# Add the two recurring crons (night_start → on, night_end → off)
# cron format: minute hour * * * command
_add_crons() {
    local start="$1"   # HH:MM
    local end="$2"     # HH:MM

    local s_min s_hour e_min e_hour
    s_min=$(echo  "$start" | awk -F: '{printf "%d", $2}')
    s_hour=$(echo "$start" | awk -F: '{printf "%d", $1}')
    e_min=$(echo  "$end"   | awk -F: '{printf "%d", $2}')
    e_hour=$(echo "$end"   | awk -F: '{printf "%d", $1}')

    # at night_start → activate night mode
    local cron_on="$s_min $s_hour * * * /usr/bin/led-night-mode.sh on $CRON_TAG"
    # at night_end   → deactivate night mode (restarts LED service)
    local cron_off="$e_min $e_hour * * * /usr/bin/led-night-mode.sh off $CRON_TAG"

    local existing
    existing=$(crontab -l 2>/dev/null | grep -v "$CRON_TAG")
    printf '%s\n%s\n%s\n' "$existing" "$cron_on" "$cron_off" | \
        grep -v '^$' | crontab -
}

# ── In-window check ──────────────────────────────────────────────────────────

_in_window() {
    local start="$1" end="$2"
    local now start_m end_m now_m

    now=$(date +%H:%M)
    now_m=$(time_to_mins "$now")
    start_m=$(time_to_mins "$start")
    end_m=$(time_to_mins "$end")

    [ "$start_m" -eq "$end_m" ] && return 1   # degenerate — never in window

    if [ "$start_m" -lt "$end_m" ]; then
        # Same-day window (e.g. 09:00–17:00)
        [ "$now_m" -ge "$start_m" ] && [ "$now_m" -lt "$end_m" ] && return 0
    else
        # Overnight window (e.g. 21:00–07:00)
        { [ "$now_m" -ge "$start_m" ] || [ "$now_m" -lt "$end_m" ]; } && return 0
    fi
    return 1
}

# ── Public commands ──────────────────────────────────────────────────────────

do_enable() {
    local start end
    start=$(uci get ledstatus.settings.night_start 2>/dev/null)
    end=$(uci get ledstatus.settings.night_end   2>/dev/null)

    valid_time "$start" || start="21:00"
    valid_time "$end"   || end="07:00"

    uci set ledstatus.settings.night_enabled=1
    uci commit ledstatus

    # Set up recurring crons
    _clear_crons
    _add_crons "$start" "$end"

    # Activate immediately if we are currently inside the night window
    if _in_window "$start" "$end"; then
        night_on
    fi

    logger -t led-night-mode "Night Mode enabled (${start}–${end})"
}

do_disable() {
    uci set ledstatus.settings.night_enabled=0
    uci commit ledstatus

    # Remove all night-mode crons
    _clear_crons

    # Restore LEDs if night mode was active
    if is_night_active; then
        _stop_blink
        rm -f "$NIGHT_ACTIVE_FLAG"
        /etc/init.d/ledstatus restart >/dev/null 2>&1 &
    fi

    logger -t led-night-mode "Night Mode disabled"
}

case "$1" in
    on)      night_on  ;;
    off)     night_off ;;
    enable)  do_enable  ;;
    disable) do_disable ;;
    *)
        echo "Usage: $0 on|off|enable|disable"
        exit 1
        ;;
esac
