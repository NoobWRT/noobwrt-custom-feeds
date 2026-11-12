# SPDX-License-Identifier: GPL-2.0
# Copyright (C) 2026 perz3us

include $(TOPDIR)/rules.mk

PKG_NAME:=modem-sip
PKG_VERSION:=0.2.0
PKG_RELEASE:=2
PKG_LICENSE:=GPL-2.0-only
PKG_MAINTAINER:=perz3us

MSIP_ROOT ?= $(abspath $(realpath $(CURDIR))/../../msipd)

include $(INCLUDE_DIR)/package.mk

define Package/modem-sip
  SECTION:=net
  CATEGORY:=Network
  SUBMENU:=Telephony
  TITLE:=SIP phones for the router's modem SIM
  DEPENDS:=+libre +libubus +libubox +libuci +libopus
endef

define Package/modem-sip/description
  msipd lets SIP phones and apps on the LAN make and take calls through the
  modem SIM. It works as a SIP service for fxsd.
endef

define Package/modem-sip/conffiles
/etc/config/modem_sip
endef

define Build/Prepare
	mkdir -p $(PKG_BUILD_DIR)
	$(CP) $(MSIP_ROOT)/src $(MSIP_ROOT)/Makefile $(PKG_BUILD_DIR)/
endef

define Build/Compile
	$(MAKE) -C $(PKG_BUILD_DIR) CC="$(TARGET_CC)" CFLAGS="$(TARGET_CFLAGS)" LDFLAGS="$(TARGET_LDFLAGS)" build/msipd
endef

define Package/modem-sip/install
	$(INSTALL_DIR) $(1)/usr/sbin $(1)/etc/init.d $(1)/etc/config
	$(INSTALL_BIN) $(PKG_BUILD_DIR)/build/msipd $(1)/usr/sbin/msipd
	$(INSTALL_BIN) ./files/msipd.init $(1)/etc/init.d/msipd
	$(INSTALL_CONF) ./files/modem_sip.config $(1)/etc/config/modem_sip
	$(INSTALL_DIR) $(1)/usr/share/fxs/sip/modem-sip
	$(INSTALL_DATA) ./files/sip/info ./files/sip/map $(1)/usr/share/fxs/sip/modem-sip/
	$(INSTALL_BIN) ./files/sip/start ./files/sip/stop ./files/sip/status ./files/sip/setup ./files/sip/ports ./files/sip/account ./files/sip/phones $(1)/usr/share/fxs/sip/modem-sip/
endef

$(eval $(call BuildPackage,modem-sip))
