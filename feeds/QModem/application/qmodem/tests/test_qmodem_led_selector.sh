#!/bin/sh

set -eu

QMODEM_PACKAGE_DIR="$(CDPATH= cd "$(dirname "$0")/.." && pwd)"
initscript=qmodem_led
extra_command() { :; }
. "${QMODEM_PACKAGE_DIR}/files/etc/init.d/qmodem_led"

uci()
{
	[ "$1" = -q ] || return 1
	case "$2:$3" in
		show:qmodem)
			printf '%s\n' \
				'qmodem.modem_a=modem-device' \
				'qmodem.modem_b=modem-device'
			;;
		get:qmodem.main.enable_dial) echo 1 ;;
		get:qmodem.modem_a.state) echo enabled ;;
		get:qmodem.modem_a.enable_dial) echo 1 ;;
		get:qmodem.modem_a.path) echo /sys/bus/usb/devices/2-1/ ;;
		get:qmodem.modem_a.metric) echo 20 ;;
		get:qmodem.modem_b.state) echo "${MOCK_B_STATE:-enabled}" ;;
		get:qmodem.modem_b.enable_dial) echo 1 ;;
		get:qmodem.modem_b.path) echo /sys/bus/usb/devices/2-1.1/ ;;
		get:qmodem.modem_b.metric) echo 10 ;;
		*) return 1 ;;
	esac
}

ubus()
{
	printf '%s\n' '{"qmodem_network":{"instances":{"modem_modem_a":{"running":true},"modem_modem_b":{"running":true},"modem_stopped":{"running":false}}}}'
}

load_network_instances
[ "$RUNNING_MODEMS" = 'modem_a modem_b' ]
resolve_led_target any ''
[ "$LED_TARGET_FOUND:$LED_TARGET" = '1:modem_b' ]

resolve_led_target port 2-1
[ "$LED_TARGET_FOUND:$LED_TARGET" = '1:modem_a' ]

MOCK_B_STATE=disabled
resolve_led_target any ''
[ "$LED_TARGET_FOUND:$LED_TARGET" = '1:modem_a' ]

RUNNING_MODEMS=
resolve_led_target none ''
[ "$LED_TARGET_FOUND" = 1 ]
[ -z "$LED_TARGET" ]

echo 'qmodem_led selector tests passed'
