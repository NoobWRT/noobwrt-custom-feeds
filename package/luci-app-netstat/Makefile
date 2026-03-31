include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-netstat
PKG_VERSION:=1.0.6
PKG_RELEASE:=8

PKG_MAINTAINER:=dotycat <support@dotycat.com>
PKG_LICENSE:=GPL-3.0

LUCI_TITLE:=NET Stats
LUCI_DESCRIPTION:=This LuCI app provides net statistic functionality in a web interface.

PKG_BUILD_DIR:=$(BUILD_DIR)/$(PKG_NAME)

include $(INCLUDE_DIR)/package.mk

define Package/$(PKG_NAME)
  SECTION:=luci
  CATEGORY:=LuCI
  SUBMENU:=3. Applications
  TITLE:=$(LUCI_TITLE)
  PKGARCH:=all
  DEPENDS:=+vnstat
endef

define Package/$(PKG_NAME)/description
  $(LUCI_DESCRIPTION)
endef

define Build/Compile
endef

define Package/$(PKG_NAME)/install
	$(INSTALL_DIR) $(1)/etc/config
	$(INSTALL_CONF) ./files/etc/config/netstats $(1)/etc/config/netstats

	$(INSTALL_DIR) $(1)/etc/uci-defaults
	$(INSTALL_BIN) ./files/etc/uci-defaults/99-vnstat $(1)/etc/uci-defaults/99-vnstat

	$(INSTALL_DIR) $(1)/usr/lib/lua/luci/controller
	$(INSTALL_DATA) ./files/usr/lib/lua/luci/controller/netstat.lua $(1)/usr/lib/lua/luci/controller/netstat.lua

	$(INSTALL_DIR) $(1)/usr/lib/lua/luci/model/cbi/netstat
	$(INSTALL_DATA) ./files/usr/lib/lua/luci/model/cbi/netstat/config.lua $(1)/usr/lib/lua/luci/model/cbi/netstat/config.lua

	$(INSTALL_DIR) $(1)/usr/lib/lua/luci/view
	$(INSTALL_DATA) ./files/usr/lib/lua/luci/view/vnstat.htm $(1)/usr/lib/lua/luci/view/vnstat.htm

	$(INSTALL_DIR) $(1)/www/luci-static/resources/netstat
	$(INSTALL_DATA) ./files/www/luci-static/resources/netstat/chart.js $(1)/www/luci-static/resources/netstat/chart.js
	$(INSTALL_DATA) ./files/www/luci-static/resources/netstat/chartjs-plugin-datalabels $(1)/www/luci-static/resources/netstat/chartjs-plugin-datalabels
	$(INSTALL_DATA) ./files/www/luci-static/resources/netstat/eye-off-outline.svg $(1)/www/luci-static/resources/netstat/eye-off-outline.svg
	$(INSTALL_DATA) ./files/www/luci-static/resources/netstat/eye-outline.svg $(1)/www/luci-static/resources/netstat/eye-outline.svg
	$(INSTALL_DATA) ./files/www/luci-static/resources/netstat/netstat.css $(1)/www/luci-static/resources/netstat/netstat.css
	$(INSTALL_DATA) ./files/www/luci-static/resources/netstat/netstat_dark.css $(1)/www/luci-static/resources/netstat/netstat_dark.css

	$(INSTALL_DIR) $(1)/www/luci-static/resources/view/status/include
	$(INSTALL_DATA) ./files/www/luci-static/resources/view/status/include/08_stats.js $(1)/www/luci-static/resources/view/status/include/08_stats.js
endef

$(eval $(call BuildPackage,$(PKG_NAME)))
