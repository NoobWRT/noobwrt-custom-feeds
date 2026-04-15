include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-aw1k-led
PKG_VERSION:=1.0.0
PKG_RELEASE:=3

PKG_MAINTAINER:=NoobLk
PKG_LICENSE:=GPL-3.0-or-later

LUCI_TITLE:=AW1000 LED Status Controller
LUCI_DEPENDS:=+luci-base +sms-tool

include $(TOPDIR)/feeds/luci/luci.mk

# call BuildPackage - OpenWrt buildroot signature
define Package/$(PKG_NAME)/install
	$(INSTALL_DIR) $(1)/etc/init.d
	$(INSTALL_BIN) ./root/etc/init.d/ledstatus $(1)/etc/init.d/ledstatus

	$(INSTALL_DIR) $(1)/etc/config
	$(INSTALL_CONF) ./root/etc/config/ledstatus $(1)/etc/config/ledstatus

	$(INSTALL_DIR) $(1)/etc/uci-defaults
	$(INSTALL_BIN) ./root/etc/uci-defaults/88-ledstatus-enable $(1)/etc/uci-defaults/88-ledstatus-enable

	$(INSTALL_DIR) $(1)/usr/bin
	$(INSTALL_BIN) ./root/usr/bin/led-status-check.sh $(1)/usr/bin/led-status-check.sh
	$(INSTALL_BIN) ./root/usr/bin/led-night-mode.sh $(1)/usr/bin/led-night-mode.sh
	$(INSTALL_BIN) ./root/usr/bin/led-status-check-daemon.sh $(1)/usr/bin/led-status-check-daemon.sh

	$(INSTALL_DIR) $(1)/usr/share/luci/menu.d
	$(INSTALL_DATA) ./root/usr/share/luci/menu.d/luci-app-aw1k-led.json $(1)/usr/share/luci/menu.d/luci-app-aw1k-led.json

	$(INSTALL_DIR) $(1)/usr/share/rpcd/acl.d
	$(INSTALL_DATA) ./root/usr/share/rpcd/acl.d/luci-app-aw1k-led.json $(1)/usr/share/rpcd/acl.d/luci-app-aw1k-led.json
endef

$(eval $(call BuildPackage,$(PKG_NAME)))
