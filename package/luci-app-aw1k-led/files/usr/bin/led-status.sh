#!/bin/sh

turn_on_led() {
    LED_PATH="/sys/class/leds/$1"
    [ -d "$LED_PATH" ] && {
        echo none > "$LED_PATH/trigger"
        echo 1 > "$LED_PATH/brightness"
    }
}

turn_off_led() {
    LED_PATH="/sys/class/leds/$1"
    [ -d "$LED_PATH" ] && {
        echo none > "$LED_PATH/trigger"
        echo 0 > "$LED_PATH/brightness"
    }
}

set_led_blink() {
    LED_PATH="/sys/class/leds/$1"
    [ -d "$LED_PATH" ] && {
        echo heartbeat > "$LED_PATH/trigger"
    }
}

set_5g_led_by_snr() {
    local best_min_snr=-1
    local best_color=""
    local best_blink=0

    config_cb() { :; }

    . /lib/functions.sh
    config_load 5g-led

    local SNR_LVLS="excellent good average bad"
    for lvl in $SNR_LVLS; do
        local min_snr color blink
        config_get min_snr signal "${lvl}_min_snr"
        config_get color signal "${lvl}_color"
        config_get blink signal "${lvl}_blink"

        if [ "$SNR" -ge "$min_snr" ] && [ "$min_snr" -gt "$best_min_snr" ]; then
            best_min_snr=$min_snr
            best_color=$color
            best_blink=$blink
        fi
    done

    for LED in green:5g blue:5g red:5g; do
        turn_off_led "$LED"
    done

    case "$best_color" in
        green) turn_on_led "green:5g" ;;
        blue)  turn_on_led "blue:5g" ;;
        red)   turn_on_led "red:5g" ;;
        yellow)
            turn_on_led "red:5g"
            turn_on_led "green:5g"
            ;;
        purple)
            turn_on_led "red:5g"
            turn_on_led "blue:5g"
            ;;
    esac

    if [ "$best_blink" = "1" ]; then
        case "$best_color" in
            yellow)
                set_led_blink "red:5g"
                set_led_blink "green:5g"
                ;;
            purple)
                set_led_blink "red:5g"
                set_led_blink "blue:5g"
                ;;
            *)
                set_led_blink "${best_color}:5g"
                ;;
        esac
    fi

    echo "5G LED: $best_color (SNR=$SNR)"
}

#------------------------------------#  KILL ALL 
for LED in \
    green:signal blue:signal red:signal \
    green:5g blue:5g red:5g \
    green:internet red:internet \
    green:wifi blue:wifi red:wifi; do
    turn_off_led "$LED"
done

#------------------------------------#  POWER LED 
if [ "$(uci get 5g-led.station.enable_power 2>/dev/null)" = "1" ]; then
    turn_on_led "green:power"
else
    turn_off_led "green:power"
fi

#------------------------------------#  MODEM & SNR 
COMM=$(uci get modeminfo.settings.comm 2>/dev/null)
if [ -z "$COMM" ]; then
    echo "Modem: Not Configured"
    turn_on_led "red:phone"
    exit 1
fi

MODEM_INFO=$(sms_tool -d "$COMM" at 'AT+CSQ;+QENG="servingcell"')

#------------------------------------#  CSQ & SNR 
CSQ=$(echo "$MODEM_INFO" | grep -i '+CSQ:' | awk -F'[ ,:]+' '{print $2}')
[ -z "$CSQ" ] && CSQ=0

QENG_NR5G=$(echo "$MODEM_INFO" | grep 'NR5G-NSA')
if [ -n "$QENG_NR5G" ]; then
    NR5G_SINR=$(echo "$QENG_NR5G" | awk -F',' '{print $6}' | tr -d '"')
    if echo "$NR5G_SINR" | grep -qE '^[0-9]+$'; then
        SNR=$NR5G_SINR
    else
        SNR=0
    fi
else
    SNR=0
fi

echo "CSQ = $CSQ"
echo "SNR = $SNR"

#------------------------------------#  PHONE LED 
if [ "$(uci get 5g-led.station.enable_phone 2>/dev/null)" = "1" ]; then
    if [ -n "$MODEM_INFO" ]; then
        turn_on_led "green:phone"
        set_led_blink "red:phone"
    else
        turn_on_led "red:phone"
    fi
else
    turn_off_led "green:phone"
    turn_off_led "red:phone"
fi

#------------------------------------#  LED 5G QUALITY 
if [ "$(uci get 5g-led.station.enable_5g 2>/dev/null)" = "1" ]; then
    set_5g_led_by_snr
fi

#------------------------------------# INTERNET
found=0
for IFACE in wwan0_1 wwan0; do
    if ip link show "$IFACE" >/dev/null 2>&1 && \
       ip route show dev "$IFACE" | grep -q '^default'; then
        found=1
        break
    fi
done

if [ "$(uci get 5g-led.station.enable_internet 2>/dev/null)" = "1" ]; then
    if [ "$found" -eq 1 ]; then
        turn_on_led "green:internet"
        echo "Internet: Connected"
    else
        turn_off_led "red:internet"
        echo "Internet: Not Connected"
    fi
fi

#------------------------------------#  WIFI 
if [ "$(uci get 5g-led.station.enable_wifi 2>/dev/null)" = "1" ]; then
    WIFI_STATUS=$(uci get wireless.@wifi-device[0].disabled 2>/dev/null)
    if [ "$WIFI_STATUS" = "1" ]; then
        echo "WiFi: Off"
    else
        turn_on_led "green:wifi"
        echo "WiFi: On"
    fi
fi

#------------------------------------#  SIGNAL 
if [ "$(uci get 5g-led.station.enable_mobile_signal 2>/dev/null)" = "1" ]; then
    if [ "$found" -eq 1 ]; then
        if [ "$CSQ" -ge 30 ]; then
            turn_on_led "green:signal"
            echo "Signal: Excellent (CSQ=$CSQ)"
        elif [ "$CSQ" -ge 20 ]; then
            turn_on_led "blue:signal"
            echo "Signal: Good (CSQ=$CSQ)"
        elif [ "$CSQ" -ge 1 ]; then
            turn_on_led "red:signal"
            turn_on_led "green:signal"
            echo "Signal: Average (CSQ=$CSQ)"
        else
            set_led_blink "red:signal"
            echo "Signal: Poor (CSQ=$CSQ)"
        fi
    else
        turn_on_led "red:signal"
        echo "Signal: No Internet (CSQ=$CSQ)"
    fi
fi
