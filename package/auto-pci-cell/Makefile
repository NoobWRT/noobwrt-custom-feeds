
include $(TOPDIR)/rules.mk

PKG_NAME:=auto-pci-cell
PKG_VERSION:=0.2.1
PKG_RELEASE:=1
PKG_LICENSE:=GPL-2.0-only
PKG_MAINTAINER:=perz3us

include $(INCLUDE_DIR)/package.mk

define Package/auto-pci-cell
  SECTION:=luci
  CATEGORY:=LuCI
  SUBMENU:=3. Applications
  TITLE:=Keeps a Quectel modem on the best 4G cell from a priority list
  DEPENDS:=+luci-base +rpcd +jshn
  PKGARCH:=all
endef

define Package/auto-pci-cell/conffiles
/etc/config/auto-pci-cell
endef

define Build/Compile
endef

define Package/auto-pci-cell/install
	$(INSTALL_DIR) $(1)/usr/sbin $(1)/etc/init.d $(1)/etc/config $(1)/usr/libexec/rpcd \
		$(1)/www/luci-static/resources/view $(1)/usr/share/luci/menu.d $(1)/usr/share/rpcd/acl.d
	$(INSTALL_BIN) ./files/auto-pci-cell $(1)/usr/sbin/auto-pci-cell
	$(INSTALL_BIN) ./files/auto-pci-cell.init $(1)/etc/init.d/auto-pci-cell
	$(INSTALL_CONF) ./files/auto-pci-cell.config $(1)/etc/config/auto-pci-cell
	$(INSTALL_BIN) ./files/auto-pci-cell.rpcd $(1)/usr/libexec/rpcd/auto-pci-cell
	$(INSTALL_DATA) ./files/auto-pci-cell.js $(1)/www/luci-static/resources/view/auto-pci-cell.js
	$(INSTALL_DATA) ./files/menu.json $(1)/usr/share/luci/menu.d/luci-app-auto-pci-cell.json
	$(INSTALL_DATA) ./files/acl.json $(1)/usr/share/rpcd/acl.d/luci-app-auto-pci-cell.json
endef

define Package/auto-pci-cell/postinst
#!/bin/sh
[ -n "$$IPKG_INSTROOT" ] || {
	rm -rf /tmp/luci-indexcache* /tmp/luci-modulecache
	/etc/init.d/rpcd reload
	/etc/init.d/auto-pci-cell enable
	/etc/init.d/auto-pci-cell restart
	/sbin/reload_config
}
exit 0
endef

define Package/auto-pci-cell/prerm
#!/bin/sh
[ -n "$$IPKG_INSTROOT" ] || {
	/etc/init.d/auto-pci-cell stop
	/etc/init.d/auto-pci-cell disable
	/usr/sbin/auto-pci-cell release
}
exit 0
endef

$(eval $(call BuildPackage,auto-pci-cell))
