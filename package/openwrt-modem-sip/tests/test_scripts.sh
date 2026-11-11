#!/bin/sh
# SPDX-License-Identifier: GPL-2.0
# Copyright (C) 2026 perz3us

F=$(pwd)/openwrt/modem-sip/files/sip
T=/tmp/msip-scripts
fail=0

ok() { echo "ok   $1"; }
bad() { echo "FAIL $1"; fail=1; }

rm -rf $T && mkdir -p $T/conf $T/bin
printf "config main 'main'\n\toption port '5070'\n\toption rtp_from '12000'\n\toption rtp_to '12010'\n" > $T/conf/modem_sip
printf "config interface 'lan'\n\toption ipaddr '192.168.1.1/24'\n" > $T/conf/network
printf '#!/bin/sh\nexec %s -c %s "$@"\n' "$(command -v uci)" "$T/conf" > $T/bin/uci
printf '#!/bin/sh\nexit 1\n' > $T/bin/ubus
printf '#!/bin/sh\nexit 1\n' > $T/bin/pidof
chmod +x $T/bin/*
export PATH=$T/bin:$PATH

[ "$(sh $F/setup)" = "Add a phone on the Modem SIP page, then scan its QR code with Linphone." ] && ok "setup asks for a phone" || bad "setup asks for a phone"
[ "$(sh $F/ports | tr '\n' ' ')" = "sip 5070 rtp 12000-12010 " ] && ok "ports from the config" || bad "ports from the config"

user=$(sh $F/phones add Pixel)
echo "$user" | grep -qx 'p[0-9a-f]\{6\}' && ok "add makes a user" || bad "add makes a user ($user)"
sh $F/phones add "Kitchen phone" >/dev/null && ok "names can have spaces" || bad "names can have spaces"
sh $F/phones add Pixel >/dev/null 2>&1 && bad "same name refused" || ok "same name refused"
sh $F/phones add 'a;reboot' >/dev/null 2>&1 && bad "bad name refused" || ok "bad name refused"
sh $F/phones add 'ThisNameIsWayTooLongToUse' >/dev/null 2>&1 && bad "long name refused" || ok "long name refused"

pass=$(uci -q get "modem_sip.$(uci -q show modem_sip | sed -n "s/^modem_sip\.\([^.=]*\)\.name='Pixel'$/\1/p").password")
echo "$pass" | grep -qx '[A-Za-z0-9]\{20\}' && ok "password is 20 letters and digits" || bad "password is 20 letters and digits"

list=$(sh $F/phones list)
[ "$(echo "$list" | wc -l)" = 2 ] && echo "$list" | grep -q "^Pixel	$user	0$" && ok "list" || bad "list ($list)"
echo "$list" | grep -q "$pass" && bad "list never shows passwords" || ok "list never shows passwords"
sh $F/setup | grep -q . && bad "setup quiet with phones" || ok "setup quiet with phones"

acc=$(sh $F/account Pixel)
echo "$acc" | grep -qx "user=$user" && echo "$acc" | grep -qx "password=$pass" && echo "$acc" | grep -qx "host=192.168.1.1" &&
	echo "$acc" | grep -qx "port=5070" && ok "account by name" || bad "account by name ($acc)"
sh $F/account Nobody >/dev/null && bad "account for unknown phone fails" || ok "account for unknown phone fails"

sh $F/phones remove Pixel && [ "$(sh $F/phones list | wc -l)" = 1 ] && ok "remove" || bad "remove"
sh $F/phones remove Pixel 2>/dev/null && bad "remove twice fails" || ok "remove twice fails"

[ "$(sh $F/status)" = not-installed ] && ok "status without msipd" || bad "status without msipd"
sh $F/stop && ok "stop is safe when not installed" || bad "stop is safe when not installed"

R=$(pwd)/openwrt/luci-app-modem-sip/files/modem-sip.rpcd
mkdir -p /usr/share/libubox && ln -sf /usr/local/share/libubox/jshn.sh /usr/share/libubox/jshn.sh
export PHONES=$F/phones
rpc() { echo "$2" | bash $R call "$1" | tr -d "
	 "; }
sh $R list | grep -q phone_add && ok "rpcd lists its methods" || bad "rpcd lists its methods"
out=$(rpc phone_add '{"name":"Laptop"}')
[ "$out" = '{"result":true}' ] && sh $F/phones list | grep -q "^Laptop" && ok "rpcd adds a phone" || bad "rpcd adds a phone ($out)"
out=$(rpc phone_add '{"name":"a;reboot"}')
[ "$out" = '{"result":false,"error":"name"}' ] && ok "rpcd refuses a bad name" || bad "rpcd refuses a bad name ($out)"
out=$(rpc phone_add '{"name":"Laptop"}')
[ "$out" = '{"result":false,"error":"failed"}' ] && ok "rpcd refuses a name in use" || bad "rpcd refuses a name in use ($out)"
out=$(rpc status "")
echo "$out" | grep -q '"running":false' && echo "$out" | grep -q '{"name":"Laptop","user":"p[0-9a-f]*","online":false}' &&
	echo "$out" | grep -q '"name":"Kitchenphone"' && ok "rpcd status lists phones" || bad "rpcd status lists phones ($out)"
echo "$out" | grep -q password && bad "rpcd status hides passwords" || ok "rpcd status hides passwords"
out=$(rpc phone_remove '{"name":"Laptop"}')
[ "$out" = '{"result":true}' ] && ! sh $F/phones list | grep -q "^Laptop" && ok "rpcd removes a phone" || bad "rpcd removes a phone ($out)"
export ACCOUNT=$F/account MSIPD_INIT=$T/bin/msipd-init SIP_VPN=$T/none
printf '#!/bin/sh\necho "$1" >> %s/init.log\n' "$T" > $T/bin/msipd-init && chmod +x $T/bin/msipd-init
out=$(rpc phone_login '{"name":"Kitchen phone"}')
kpass=$(uci -q get "modem_sip.$(uci -q show modem_sip | sed -n "s/^modem_sip\.\([^.=]*\)\.name='Kitchen phone'$/\1/p").password")
echo "$out" | grep -q "\"server\":\"192.168.1.1\"" && echo "$out" | grep -q "\"port\":5070" && echo "$out" | grep -q "\"password\":\"$kpass\"" && ok "rpcd shows a login" || bad "rpcd shows a login ($out)"
out=$(rpc phone_password '{"name":"Kitchen phone","password":"my-pin.88"}')
[ "$out" = '{"result":true}' ] && sh $F/account "Kitchen phone" | grep -qx "password=my-pin.88" && ok "rpcd sets a chosen password" || bad "rpcd sets a chosen password ($out)"
for p in short7! 'has space1' 'a$(id)bcdef' 'semi;colon12'; do
	out=$(rpc phone_password "{\"name\":\"Kitchen phone\",\"password\":\"$p\"}")
	[ "$out" = '{"result":false,"error":"password"}' ] && ok "rpcd refuses password $p" || bad "rpcd refuses password $p ($out)"
done
out=$(rpc phone_password '{"name":"Kitchen phone"}')
sh $F/account "Kitchen phone" | grep -qx 'password=[A-Za-z0-9]\{20\}' && ok "rpcd makes a new random password" || bad "rpcd makes a new random password ($out)"
out=$(rpc phone_rename '{"name":"Kitchen phone","new":"Desk"}')
[ "$out" = '{"result":true}' ] && sh $F/phones list | grep -q "^Desk	" && ok "rpcd renames a phone" || bad "rpcd renames a phone ($out)"
sh $F/phones add Other >/dev/null
out=$(rpc phone_rename '{"name":"Desk","new":"Other"}')
[ "$out" = '{"result":false,"error":"failed"}' ] && ok "rename refuses a name in use" || bad "rename refuses a name in use ($out)"
out=$(rpc settings "")
[ "$out" = '{"port":5070,"rtp_from":12000,"rtp_to":12010,"hd":true,"phone_hd":false}' ] && ok "rpcd reads settings" || bad "rpcd reads settings ($out)"
: > $T/init.log
out=$(rpc set_settings '{"port":5070,"rtp_from":12000,"rtp_to":12010,"hd":false}')
[ "$out" = '{"result":true}' ] && [ "$(uci -q get modem_sip.main.hd)" = 0 ] && [ ! -s $T/init.log ] && ok "hd change saves without a restart" || bad "hd change saves without a restart ($out)"
out=$(rpc set_settings '{"port":5080,"rtp_from":13000,"rtp_to":13100,"hd":true}')
[ "$out" = '{"result":true}' ] && [ "$(sh $F/ports | tr '\n' ' ')" = "sip 5080 rtp 13000-13100 " ] && grep -qx restart $T/init.log && ok "port change restarts msipd" || bad "port change restarts msipd ($out)"
for bad in '"port":80,"rtp_from":13000,"rtp_to":13100' '"port":5080,"rtp_from":13000,"rtp_to":13005' '"port":13050,"rtp_from":13000,"rtp_to":13100' '"port":"50;x","rtp_from":13000,"rtp_to":13100'; do
	out=$(rpc set_settings "{$bad,\"hd\":true}")
	echo "$out" | grep -q '"result":false' && ok "settings refuse $bad" || bad "settings refuse $bad ($out)"
done
printf '#!/bin/sh\necho "{ \\"state\\": \\"active\\" }"\n' > $T/bin/ubus
out=$(rpc set_settings '{"port":5090,"rtp_from":13000,"rtp_to":13100,"hd":true}')
[ "$out" = '{"result":false,"error":"busy"}' ] && [ "$(uci -q get modem_sip.main.port)" = 5080 ] && ok "no port change during a call" || bad "no port change during a call ($out)"
printf '#!/bin/sh\nexit 1\n' > $T/bin/ubus
grep -qx "PAGE=admin/services/modem-sip" $F/info && ok "info names the page" || bad "info names the page"

[ $fail = 0 ] && echo ALL_OK
exit $fail
