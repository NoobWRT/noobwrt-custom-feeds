# SPDX-License-Identifier: GPL-2.0
# Copyright (C) 2026 perz3us

include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-modem-sip
PKG_VERSION:=0.1.0
PKG_RELEASE:=1
PKG_LICENSE:=GPL-2.0-only
PKG_MAINTAINER:=perz3us

include $(INCLUDE_DIR)/package.mk

define Package/luci-app-modem-sip
  SECTION:=luci
  CATEGORY:=LuCI
  SUBMENU:=3. Applications
  TITLE:=LuCI page for Modem SIP
  DEPENDS:=+modem-sip +luci-base +rpcd +luci-lib-uqr
  PKGARCH:=all
endef

define Build/Compile
endef

define Package/luci-app-modem-sip/install
	$(INSTALL_DIR) $(1)/www/luci-static/resources/view/modem-sip $(1)/usr/share/luci/menu.d $(1)/usr/share/rpcd/acl.d $(1)/usr/libexec/rpcd
	$(INSTALL_DATA) ./files/view/phones.js ./files/view/settings.js $(1)/www/luci-static/resources/view/modem-sip/
	$(INSTALL_DATA) ./files/menu.json $(1)/usr/share/luci/menu.d/luci-app-modem-sip.json
	$(INSTALL_DATA) ./files/acl.json $(1)/usr/share/rpcd/acl.d/luci-app-modem-sip.json
	$(INSTALL_BIN) ./files/modem-sip.rpcd $(1)/usr/libexec/rpcd/modem-sip
endef

define Package/luci-app-modem-sip/postinst
#!/bin/sh
[ -n "$$IPKG_INSTROOT" ] || {
	rm -rf /tmp/luci-indexcache* /tmp/luci-modulecache
	/etc/init.d/rpcd reload
}
exit 0
endef

$(eval $(call BuildPackage,luci-app-modem-sip))
