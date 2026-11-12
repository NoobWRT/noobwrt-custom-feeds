# SPDX-License-Identifier: GPL-2.0-only
# Copyright (C) 2026 Lahiru S Liyanage (NoobLK)

include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-aw1000-voice
PKG_VERSION:=0.1.0
PKG_RELEASE:=1
PKG_LICENSE:=GPL-2.0-only
PKG_MAINTAINER:=Lahiru S Liyanage <liyanagelsofficial@gmail.com>

include $(INCLUDE_DIR)/package.mk

define Package/luci-app-aw1000-voice
  SECTION:=luci
  CATEGORY:=LuCI
  SUBMENU:=3. Applications
  TITLE:=LuCI shortcut to the AW1000 phone management interface
  DEPENDS:=+aw1000-voice-web +luci-base
  PKGARCH:=all
endef

define Package/luci-app-aw1000-voice/description
  Adds Services > Phone to LuCI: the line status and a button that opens the
  phone management interface on its own port.
endef

define Build/Compile
endef

define Package/luci-app-aw1000-voice/install
	$(INSTALL_DIR) $(1)/www/luci-static/resources/view/aw1000-voice $(1)/usr/share/luci/menu.d $(1)/usr/share/rpcd/acl.d
	$(INSTALL_DATA) ./files/launcher.js $(1)/www/luci-static/resources/view/aw1000-voice/launcher.js
	$(INSTALL_DATA) ./files/menu.json $(1)/usr/share/luci/menu.d/luci-app-aw1000-voice.json
	$(INSTALL_DATA) ./files/acl.json $(1)/usr/share/rpcd/acl.d/luci-app-aw1000-voice.json
endef

define Package/luci-app-aw1000-voice/postinst
#!/bin/sh
[ -n "$$IPKG_INSTROOT" ] || {
	rm -rf /tmp/luci-indexcache* /tmp/luci-modulecache
	/etc/init.d/rpcd reload
}
exit 0
endef

$(eval $(call BuildPackage,luci-app-aw1000-voice))
