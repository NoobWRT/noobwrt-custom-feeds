# SPDX-License-Identifier: GPL-2.0-only
# Copyright (C) 2026 perz3us
# Copyright (C) 2026 Lahiru S Liyanage (NoobLK)

include $(TOPDIR)/rules.mk

PKG_NAME:=aw1000-voice-web
PKG_VERSION:=0.2.0
PKG_RELEASE:=1
PKG_LICENSE:=GPL-2.0-only
PKG_MAINTAINER:=Lahiru S Liyanage <liyanagelsofficial@gmail.com>

include $(INCLUDE_DIR)/package.mk

define Package/aw1000-voice-web
  SECTION:=net
  CATEGORY:=Network
  SUBMENU:=Telephony
  TITLE:=Phone management interface for the AW1000 RJ11 port and SIP phones
  DEPENDS:=+fxsd +rpcd +uhttpd +uhttpd-mod-ubus +cgi-io +luci-lib-uqr
  CONFLICTS:=luci-app-fxs luci-app-modem-sip
  PKGARCH:=all
endef

define Package/aw1000-voice-web/description
  A standalone web interface, served by its own uhttpd instance (port 7766 by
  default), to manage the phone port: missed calls, call history, recordings,
  phonebook, speed dial, blocking, do not disturb, alarms, phone services, SIP
  phones and every fxsd setting. It replaces luci-app-fxs and
  luci-app-modem-sip and carries their rpcd backends.
endef

define Package/aw1000-voice-web/conffiles
/etc/config/aw1000_voice
endef

define Build/Compile
endef

WWW:=/www/aw1000-voice

define Package/aw1000-voice-web/install
	$(INSTALL_DIR) $(1)$(WWW)/css $(1)$(WWW)/js/pages $(1)$(WWW)/cgi-bin $(1)$(WWW)/lib $(1)$(WWW)/icons
	$(CP) ./files/www/index.html ./files/www/favicon.svg ./files/www/manifest.webmanifest $(1)$(WWW)/
	$(SED) 's/@VERSION@/$(PKG_VERSION)-$(PKG_RELEASE)/g' $(1)$(WWW)/index.html
	$(CP) ./files/www/icons/*.png $(1)$(WWW)/icons/
	$(CP) ./files/www/css/*.css $(1)$(WWW)/css/
	$(CP) ./files/www/js/*.js $(1)$(WWW)/js/
	$(CP) ./files/www/js/pages/*.js $(1)$(WWW)/js/pages/
	$(LN) /usr/libexec/cgi-io $(1)$(WWW)/cgi-bin/cgi-download
	$(LN) /usr/libexec/cgi-io $(1)$(WWW)/cgi-bin/cgi-upload
	$(LN) /www/luci-static/resources/uqr.js $(1)$(WWW)/lib/uqr.js
	$(INSTALL_DIR) $(1)/usr/libexec/rpcd $(1)/usr/share/rpcd/acl.d $(1)/etc/config $(1)/etc/uci-defaults
	$(INSTALL_BIN) ./files/rpcd/fxs $(1)/usr/libexec/rpcd/fxs
	$(INSTALL_BIN) ./files/rpcd/modem-sip $(1)/usr/libexec/rpcd/modem-sip
	$(INSTALL_BIN) ./files/rpcd/aw1000-voice $(1)/usr/libexec/rpcd/aw1000-voice
	$(INSTALL_DATA) ./files/acl.json $(1)/usr/share/rpcd/acl.d/aw1000-voice.json
	$(INSTALL_CONF) ./files/aw1000_voice.config $(1)/etc/config/aw1000_voice
	$(INSTALL_BIN) ./files/aw1000-voice.defaults $(1)/etc/uci-defaults/90-aw1000-voice-web
	$(INSTALL_DIR) $(1)/usr/libexec $(1)/etc/hotplug.d/iface
	$(INSTALL_BIN) ./files/aw1000-voice.defaults $(1)/usr/libexec/aw1000-voice-web-setup
	$(INSTALL_BIN) ./files/aw1000-voice-notify $(1)/usr/libexec/aw1000-voice-notify
	$(INSTALL_DATA) ./files/aw1000-voice.hotplug $(1)/etc/hotplug.d/iface/95-aw1000-voice-web
endef

define Package/aw1000-voice-web/postinst
#!/bin/sh
[ -n "$$IPKG_INSTROOT" ] && exit 0
/usr/libexec/aw1000-voice-web-setup
rm -f /etc/uci-defaults/90-aw1000-voice-web
/etc/init.d/rpcd reload
exit 0
endef

define Package/aw1000-voice-web/prerm
#!/bin/sh
[ -n "$$IPKG_INSTROOT" ] && exit 0
uci -q delete uhttpd.phone && uci commit uhttpd && /etc/init.d/uhttpd reload
exit 0
endef

$(eval $(call BuildPackage,aw1000-voice-web))
