#!/bin/sh
# AW1000 LED Status Monitor
# Reads thresholds, colors and settings from UCI: uci get ledstatus.settings.*

# ─── Color → sysfs helper ────────────────────────────────────────────────────
# set_color <prefix> <colorid> [blink]
#   prefix  : 5g | signal
#   colorid : red|green|blue|yellow|cyan|magenta|white|off
#   blink   : if "1", use heartbeat trigger on lit channels
set_color() {
    local PREFIX="$1"
    local COLOR="$2"
    local BLINK="$3"

    case "$COLOR" in
        red)     R=1; G=0; B=0 ;;
        green)   R=0; G=1; B=0 ;;
        blue)    R=0; G=0; B=1 ;;
        yellow)  R=1; G=1; B=0 ;;
        cyan)    R=0; G=1; B=1 ;;
        magenta) R=1; G=0; B=1 ;;
        white)   R=1; G=1; B=1 ;;
        *)       R=0; G=0; B=0 ;;   # off / unknown
    esac

    for CH in red green blue; do
        eval "VAL=\$$( echo $CH | tr 'rgb' 'RGB' | tr '[:lower:]' '[:upper:]' | cut -c1)"
        # re-evaluate correctly
        case "$CH" in
            red)   VAL=$R ;;
            green) VAL=$G ;;
            blue)  VAL=$B ;;
        esac
        LED="/sys/class/leds/${CH}:${PREFIX}"
        if [ "$BLINK" = "1" ] && [ "$VAL" = "1" ]; then
            echo heartbeat > "$LED/trigger"
        else
            echo none       > "$LED/trigger"
            echo "$VAL"     > "$LED/brightness"
        fi
    done
}

# ─── Load UCI settings ────────────────────────────────────────────────────────
COMM=$(uci get ledstatus.settings.modem_port 2>/dev/null)
[ -z "$COMM" ] && COMM="/dev/ttyUSB2"

SINR_EXCELLENT=$(uci get ledstatus.settings.sinr_excellent 2>/dev/null); [ -z "$SINR_EXCELLENT" ] && SINR_EXCELLENT=25
SINR_GOOD=$(uci get ledstatus.settings.sinr_good       2>/dev/null); [ -z "$SINR_GOOD"      ] && SINR_GOOD=15
SINR_AVERAGE=$(uci get ledstatus.settings.sinr_average    2>/dev/null); [ -z "$SINR_AVERAGE"   ] && SINR_AVERAGE=5

CSQ_EXCELLENT=$(uci get ledstatus.settings.csq_excellent 2>/dev/null); [ -z "$CSQ_EXCELLENT"  ] && CSQ_EXCELLENT=20
CSQ_GOOD=$(uci get ledstatus.settings.csq_good      2>/dev/null); [ -z "$CSQ_GOOD"       ] && CSQ_GOOD=14
CSQ_AVERAGE=$(uci get ledstatus.settings.csq_average   2>/dev/null); [ -z "$CSQ_AVERAGE"    ] && CSQ_AVERAGE=10

# 5G colors
C5G_EXCELLENT=$(uci get ledstatus.settings.color_5g_excellent 2>/dev/null); [ -z "$C5G_EXCELLENT" ] && C5G_EXCELLENT=green
C5G_GOOD=$(uci get ledstatus.settings.color_5g_good      2>/dev/null); [ -z "$C5G_GOOD"      ] && C5G_GOOD=blue
C5G_AVERAGE=$(uci get ledstatus.settings.color_5g_average   2>/dev/null); [ -z "$C5G_AVERAGE"   ] && C5G_AVERAGE=yellow
C5G_POOR=$(uci get ledstatus.settings.color_5g_poor      2>/dev/null); [ -z "$C5G_POOR"      ] && C5G_POOR=magenta
C5G_NONE=$(uci get ledstatus.settings.color_5g_none      2>/dev/null); [ -z "$C5G_NONE"      ] && C5G_NONE=red

# Signal colors
CSIG_EXCELLENT=$(uci get ledstatus.settings.color_sig_excellent 2>/dev/null); [ -z "$CSIG_EXCELLENT" ] && CSIG_EXCELLENT=green
CSIG_GOOD=$(uci get ledstatus.settings.color_sig_good      2>/dev/null); [ -z "$CSIG_GOOD"      ] && CSIG_GOOD=blue
CSIG_AVERAGE=$(uci get ledstatus.settings.color_sig_average   2>/dev/null); [ -z "$CSIG_AVERAGE"   ] && CSIG_AVERAGE=yellow
CSIG_WEAK=$(uci get ledstatus.settings.color_sig_weak      2>/dev/null); [ -z "$CSIG_WEAK"      ] && CSIG_WEAK=red
CSIG_OFFLINE=$(uci get ledstatus.settings.color_sig_offline   2>/dev/null); [ -z "$CSIG_OFFLINE"   ] && CSIG_OFFLINE=magenta

# ─── 5G SINR ─────────────────────────────────────────────────────────────────
QENG_DATA=$(sms_tool -d "$COMM" at 'at+qeng="servingcell"' 2>/dev/null | tr -d '\r')
QENG_LINE=$(echo "$QENG_DATA" | grep -E 'QENG: "NR5G' | head -n1)
SINR=$(echo "$QENG_LINE" | awk -F',' '{print $6}' | grep -oE '[-0-9.]+')

set_color 5g off

if [ -z "$SINR" ]; then
    set_color 5g "$C5G_NONE"
    echo "5G: NO SIGNAL"
else
    SINR_INT=$(printf "%.0f" "$SINR" 2>/dev/null)
    if   [ "$SINR_INT" -ge "$SINR_EXCELLENT" ]; then
        set_color 5g "$C5G_EXCELLENT"
        echo "5G: Excellent (SINR=$SINR_INT color=$C5G_EXCELLENT)"
    elif [ "$SINR_INT" -ge "$SINR_GOOD" ]; then
        set_color 5g "$C5G_GOOD"
        echo "5G: Good (SINR=$SINR_INT color=$C5G_GOOD)"
    elif [ "$SINR_INT" -ge "$SINR_AVERAGE" ]; then
        set_color 5g "$C5G_AVERAGE"
        echo "5G: Average (SINR=$SINR_INT color=$C5G_AVERAGE)"
    else
        set_color 5g "$C5G_POOR" 1
        echo "5G: Poor/blink (SINR=$SINR_INT color=$C5G_POOR)"
    fi
fi

# ─── Internet connection ──────────────────────────────────────────────────────
found=0
ip link show wwan0_1 >/dev/null 2>&1 && ip route show dev wwan0_1 | grep -q '^default' && found=1
ip link show wwan0   >/dev/null 2>&1 && ip route show dev wwan0   | grep -q '^default' && found=1

if [ "$found" -eq 1 ]; then
    echo none > /sys/class/leds/green:internet/trigger
    echo 1    > /sys/class/leds/green:internet/brightness
    echo "Internet: Connected"
else
    echo heartbeat > /sys/class/leds/green:internet/trigger
    echo "Internet: Not connected"
fi

# ─── WiFi ─────────────────────────────────────────────────────────────────────
WIFI_DISABLED=$(uci get wireless.@wifi-device[0].disabled 2>/dev/null)
if [ "$WIFI_DISABLED" = "1" ]; then
    echo none > /sys/class/leds/green:wifi/trigger
    echo 0    > /sys/class/leds/green:wifi/brightness
    echo "WiFi: Disabled"
else
    echo none > /sys/class/leds/green:wifi/trigger
    echo 1    > /sys/class/leds/green:wifi/brightness
    echo "WiFi: Enabled"
fi

# ─── CSQ Signal ───────────────────────────────────────────────────────────────
CSQ=$(sms_tool -d "$COMM" at 'at+csq' 2>/dev/null \
    | grep -oE '\+csq: [0-9]+,[0-9]+' \
    | awk -F'[:,]' '{print $2}' \
    | tr -d '\r\n ')

set_color signal off

if [ "$found" -eq 1 ]; then
    if [ -n "$CSQ" ]; then
        if   [ "$CSQ" -ge "$CSQ_EXCELLENT" ]; then
            set_color signal "$CSIG_EXCELLENT"
            echo "Signal: Excellent (CSQ=$CSQ color=$CSIG_EXCELLENT)"
        elif [ "$CSQ" -ge "$CSQ_GOOD" ]; then
            set_color signal "$CSIG_GOOD"
            echo "Signal: Good (CSQ=$CSQ color=$CSIG_GOOD)"
        elif [ "$CSQ" -ge "$CSQ_AVERAGE" ]; then
            set_color signal "$CSIG_AVERAGE"
            echo "Signal: Average (CSQ=$CSQ color=$CSIG_AVERAGE)"
        else
            set_color signal "$CSIG_WEAK" 1
            echo "Signal: Weak/blink (CSQ=$CSQ color=$CSIG_WEAK)"
        fi
    else
        echo "Signal: CSQ not detected"
    fi
else
    set_color signal "$CSIG_OFFLINE"
    echo "Signal: Internet disconnected (color=$CSIG_OFFLINE)"
fi
