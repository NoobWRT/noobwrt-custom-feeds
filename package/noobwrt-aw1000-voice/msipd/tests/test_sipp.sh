#!/bin/sh
# SPDX-License-Identifier: GPL-2.0
# Copyright (C) 2026 perz3us

S=tests/sipp
C=/tmp/msip-conf
export MSIP_FAKE=/tmp/msip-fake
PIXEL="-s p1a2b3c -au p1a2b3c -ap Kq3vX9mZr2LtW8yPb5Nd"
LAPTOP="-s pa0b1c2 -au pa0b1c2 -ap Zz9Yy8Xx7Ww6Vv5Uu4Tt"
fail=0

ok() { echo "ok   $1"; }
bad() { echo "FAIL $1"; fail=1; }
sipp_run() { sipp 127.0.0.1:5060 -m 1 -nostdin -timeout 20 -timeout_error "$@" >/dev/null 2>&1; }
clcc() { printf '%s\r\n' "$1" > $MSIP_FAKE/clcc; }
at_has() { grep -qx "$1" $MSIP_FAKE/at.log; }
wait_at() {
	i=0
	while [ $i -lt 50 ]; do at_has "$1" && return 0; sleep 0.1; i=$((i + 1)); done
	return 1
}

rm -rf $C $MSIP_FAKE && mkdir -p $C $MSIP_FAKE && : > $MSIP_FAKE/clcc && : > $MSIP_FAKE/at.log
cat > $C/modem_sip <<EOF
config main 'main'
	option port '5060'
	option rtp_from '10000'
	option rtp_to '10100'
config phone
	option name 'Pixel'
	option user 'p1a2b3c'
	option password 'Kq3vX9mZr2LtW8yPb5Nd'
config phone
	option name 'Laptop'
	option user 'pa0b1c2'
	option password 'Zz9Yy8Xx7Ww6Vv5Uu4Tt'
EOF
printf "config fxs 'main'\n\toption hd '0'\n" > $C/fxs

ubusd >/dev/null 2>&1 &
UBUSD=$!
sleep 0.5
./build/msipd-test -c $C -b 127.0.0.1 -s /tmp/msip-pcm.sock &
MSIPD=$!
sleep 0.5

state() { ubus call fxs_sip status | sed -n 's/.*"state": "\([a-z]*\)".*/\1/p'; }
field() { ubus call fxs_sip status | sed -n "s/.*\"$1\": \"\\([^\"]*\\)\".*/\\1/p"; }

[ "$(state)" = idle ] && ok "status idle" || bad "status idle"

sipp_run -sf $S/register.xml -p 5062 $PIXEL && ok "register_ok" || bad "register_ok"
sipp_run -sf $S/register_bad.xml -p 5070 -s p1a2b3c -au p1a2b3c -ap wrongpassword12345678 && ok "wrong password gets 403" || bad "wrong password gets 403"

i=0
while [ $i -lt 4 ]; do sipp_run -sf $S/register_bad.xml -i 127.0.0.2 -p 5071 -s pa0b1c2 -au pa0b1c2 -ap wrongpassword12345678; i=$((i + 1)); done
sipp_run -sf $S/register_bad.xml -i 127.0.0.2 -p 5071 -s pa0b1c2 -au pa0b1c2 -ap wrongpassword12345678
if sipp_run -sf $S/register.xml -i 127.0.0.2 -p 5071 $LAPTOP; then bad "register_wrong_bans"; else ok "register_wrong_bans"; fi
sipp_run -sf $S/register.xml -p 5064 $LAPTOP && ok "ban is per address" || bad "ban is per address"

sipp 127.0.0.1:5060 -sf $S/uas_answer.xml -p 5062 -m 1 -nostdin -timeout 20 -timeout_error >/dev/null 2>&1 &
A=$!
sipp 127.0.0.1:5060 -sf $S/uas_ring.xml -p 5064 -m 1 -nostdin -timeout 20 -timeout_error >/dev/null 2>&1 &
B=$!
sleep 0.5
clcc '+CLCC: 1,1,4,0,0,"0771234567",129'
wait_at ATA && ok "incoming_rings_two, first answer sends ATA" || bad "incoming_rings_two, first answer sends ATA"
[ "$(field answered_by)" = Pixel ] && ok "answered_by Pixel" || bad "answered_by Pixel"
[ "$(field codec)" = PCMA ] && ok "audio starts in PCMA" || bad "audio starts in PCMA ($(field codec))"
clcc '+CLCC: 1,1,0,0,0,"0771234567",129'
wait $B && ok "other phone gets CANCEL" || bad "other phone gets CANCEL"
sleep 0.6
clcc ''
wait $A && ok "network hangup sends BYE" || bad "network hangup sends BYE"
sleep 0.6
[ "$(state)" = idle ] && ok "idle after the call" || bad "idle after the call"

: > $MSIP_FAKE/at.log
sipp 127.0.0.1:5060 -sf $S/uas_ring.xml -p 5062 -m 1 -nostdin -timeout 20 -timeout_error >/dev/null 2>&1 &
A=$!
sipp 127.0.0.1:5060 -sf $S/uas_ring.xml -p 5064 -m 1 -nostdin -timeout 20 -timeout_error >/dev/null 2>&1 &
B=$!
sleep 0.5
clcc '+CLCC: 1,1,4,0,0,"0771234567",129'
sleep 1
clcc ''
wait $A && wait $B && ok "cancel_on_network_hangup" || bad "cancel_on_network_hangup"
at_has ATA && bad "no ATA when nobody answered" || ok "no ATA when nobody answered"

: > $MSIP_FAKE/at.log
sleep 0.6
sipp 127.0.0.1:5060 -sf $S/uac_call.xml -p 5064 -m 1 -nostdin -timeout 20 -timeout_error $LAPTOP >/dev/null 2>&1 &
A=$!
wait_at 'ATD0771234567;' && ok "call_out sends ATD" || bad "call_out sends ATD"
[ "$(field codec)" = PCMA ] && ok "call out has audio in PCMA" || bad "call out has audio in PCMA ($(field codec))"
[ "$(field origin)" = Laptop ] && ok "origin Laptop" || bad "origin Laptop"
clcc '+CLCC: 1,0,3,0,0,"0771234567",129'
sleep 0.6
clcc '+CLCC: 1,0,0,0,0,"0771234567",129'
wait_at 'AT+VTS="7"' && ok "dtmf_info" || bad "dtmf_info"
wait_at 'AT+CHUP' && ok "BYE from phone hangs up" || bad "BYE from phone hangs up"
clcc ''
wait $A && ok "call_out scenario" || bad "call_out scenario"

sleep 0.6
clcc '+CLCC: 1,1,4,0,0,"0771234567",129'
sleep 0.6
sipp_run -sf $S/uac_busy.xml -p 5066 $LAPTOP && ok "busy_second_invite" || bad "busy_second_invite"
clcc ''
sleep 0.6

printf "config fxs 'main'
	option hd '1'
" > $C/fxs
: > $MSIP_FAKE/at.log
sipp 127.0.0.1:5060 -sf $S/uas_answer_opus.xml -p 5062 -m 1 -nostdin -timeout 20 -timeout_error >/dev/null 2>&1 &
A=$!
sleep 0.5
clcc '+CLCC: 1,1,4,0,0,"0771234567",129'
wait_at ATA && [ "$(field codec)" = opus ] && ok "hd incoming offers opus and uses it" || bad "hd incoming offers opus and uses it ($(field codec))"
clcc '+CLCC: 1,1,0,0,0,"0771234567",129'
sleep 0.6
clcc ''
wait $A && ok "hd incoming scenario" || bad "hd incoming scenario"
sleep 0.6

: > $MSIP_FAKE/at.log
sipp 127.0.0.1:5060 -sf $S/uac_call_hd.xml -p 5064 -m 1 -nostdin -timeout 20 -timeout_error $LAPTOP >/dev/null 2>&1 &
A=$!
wait_at 'ATD0771234567;' && [ "$(field codec)" = opus ] && ok "hd call out picks opus" || bad "hd call out picks opus ($(field codec))"
clcc '+CLCC: 1,0,3,0,0,"0771234567",129'
sleep 0.6
clcc '+CLCC: 1,0,0,0,0,"0771234567",129'
wait_at 'AT+CHUP'
clcc ''
wait $A && ok "hd call out answers with opus only" || bad "hd call out answers with opus only"
sleep 0.6
printf "config fxs 'main'
	option hd '0'
" > $C/fxs

ubus call fxs_sip digit '{"line":"phone","digit":"5"}' >/dev/null && wait_at 'AT+VTS="5"' && ok "ubus digit" || bad "ubus digit"
ubus call fxs_sip digit '{"line":"phone","digit":"x"}' >/dev/null 2>&1 && bad "bad digit refused" || ok "bad digit refused"
ubus call fxs_sip dial '{"line":"phone","number":"0771234567;ATH"}' >/dev/null 2>&1 && bad "bad number refused" || ok "bad number refused"

kill -0 $MSIPD && ok "msipd still running" || bad "msipd still running"
kill $MSIPD $UBUSD 2>/dev/null
[ $fail = 0 ] && echo ALL_OK
exit $fail
