#!/bin/sh
set -e
SDK=$(ls -d /cache/openwrt-sdk-*/ | head -1)
cd "$SDK"
rm -rf package/auto-pci-cell
mkdir -p package/auto-pci-cell
cp -r /src/Makefile /src/files package/auto-pci-cell/
sed -i '/CONFIG_PACKAGE_auto-pci-cell[= ]/d' .config
echo 'CONFIG_PACKAGE_auto-pci-cell=m' >> .config
make defconfig >/dev/null
make package/auto-pci-cell/clean >/dev/null 2>&1 || true
make package/auto-pci-cell/compile -j4 || make package/auto-pci-cell/compile V=s
mkdir -p /src/dist
rm -f /src/dist/*.apk
find bin -name 'auto-pci-cell*.apk' -exec cp {} /src/dist/ \;
IPK=/tmp/ipk; rm -rf $IPK; mkdir -p $IPK/c $IPK/d/usr/sbin $IPK/d/etc/init.d $IPK/d/etc/config $IPK/d/usr/libexec/rpcd $IPK/d/www/luci-static/resources/view $IPK/d/usr/share/luci/menu.d $IPK/d/usr/share/rpcd/acl.d
F=/src/files
install -m755 $F/auto-pci-cell $IPK/d/usr/sbin/auto-pci-cell
install -m755 $F/auto-pci-cell.init $IPK/d/etc/init.d/auto-pci-cell
install -m600 $F/auto-pci-cell.config $IPK/d/etc/config/auto-pci-cell
install -m755 $F/auto-pci-cell.rpcd $IPK/d/usr/libexec/rpcd/auto-pci-cell
install -m644 $F/auto-pci-cell.js $IPK/d/www/luci-static/resources/view/auto-pci-cell.js
install -m644 $F/menu.json $IPK/d/usr/share/luci/menu.d/luci-app-auto-pci-cell.json
install -m644 $F/acl.json $IPK/d/usr/share/rpcd/acl.d/luci-app-auto-pci-cell.json
V=$(sed -n 's/^PKG_VERSION:=//p' /src/Makefile); R=$(sed -n 's/^PKG_RELEASE:=//p' /src/Makefile)
cat > $IPK/c/control <<EOC
Package: auto-pci-cell
Version: $V-$R
Depends: luci-base, rpcd, jshn
Section: luci
Architecture: all
Maintainer: perz3us
License: GPL-2.0-only
Description: Keeps a Quectel modem on the best 4G cell from a priority list
EOC
echo /etc/config/auto-pci-cell > $IPK/c/conffiles
printf '#!/bin/sh\n[ -n "$IPKG_INSTROOT" ] || {\n\trm -rf /tmp/luci-indexcache* /tmp/luci-modulecache\n\t/etc/init.d/rpcd reload\n\t/etc/init.d/auto-pci-cell enable\n\t/etc/init.d/auto-pci-cell restart
	/sbin/reload_config\n}\nexit 0\n' > $IPK/c/postinst
printf '#!/bin/sh\n[ -n "$IPKG_INSTROOT" ] || {\n\t/etc/init.d/auto-pci-cell stop\n\t/etc/init.d/auto-pci-cell disable\n\t/usr/sbin/auto-pci-cell release\n}\nexit 0\n' > $IPK/c/prerm
chmod 755 $IPK/c/postinst $IPK/c/prerm
echo 2.0 > $IPK/debian-binary
tar --numeric-owner --owner=0 --group=0 -C $IPK/d -czf $IPK/data.tar.gz .
tar --numeric-owner --owner=0 --group=0 -C $IPK/c -czf $IPK/control.tar.gz .
rm -f /src/dist/*.ipk
tar --numeric-owner --owner=0 --group=0 -C $IPK -czf /src/dist/auto-pci-cell_$V-${R}_all.ipk ./debian-binary ./data.tar.gz ./control.tar.gz
ls -la /src/dist
