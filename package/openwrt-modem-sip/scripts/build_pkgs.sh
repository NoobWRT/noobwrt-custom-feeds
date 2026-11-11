#!/bin/sh
set -e
SDK=$(ls -d /cache/openwrt-sdk-*/ | head -1)
SDK=${SDK%/}
cd "$SDK"

{ grep -E '^src-git(-full)? (--root=package )?(base|packages|luci|telephony) ' feeds.conf.default; echo "src-link msip /work/openwrt"; } > feeds.conf.msip
cp feeds.conf feeds.conf.keep 2>/dev/null || true
cp feeds.conf.msip feeds.conf
./scripts/feeds update -a >/dev/null
./scripts/feeds install libre libopus libubox ubus uci rpcd luci-base luci-lib-uqr >/dev/null 2>&1
./scripts/feeds install -p msip -a >/dev/null 2>&1 || true
for p in modem-sip luci-app-modem-sip; do
	sed -i "/CONFIG_PACKAGE_$p[= ]/d" .config
	echo "CONFIG_PACKAGE_$p=m" >> .config
done
make defconfig >/dev/null
make package/feeds/msip/modem-sip/clean >/dev/null 2>&1 || true
for p in modem-sip luci-app-modem-sip; do
	make package/feeds/msip/$p/compile -j4 || make package/feeds/msip/$p/compile V=s
done
[ -f feeds.conf.keep ] && mv feeds.conf.keep feeds.conf

mkdir -p /work/dist
rm -f /work/dist/*.apk
find bin \( -name 'modem-sip-*.apk' -o -name 'luci-app-modem-sip-*.apk' \) -exec cp {} /work/dist/ \;
find bin \( -name 'libre[0-9]-*.apk' -o -name 'libopus[0-9]*.apk' \) -exec cp {} /work/dist/ \;
ls -la /work/dist
