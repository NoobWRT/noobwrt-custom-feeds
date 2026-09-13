include $(TOPDIR)/rules.mk

# Include unified version
include ../../version.mk

PKG_NAME:=qmodem-voip
PKG_VERSION:=$(QMODEM_VERSION)
PKG_RELEASE:=$(QMODEM_RELEASE)
PKG_LICENSE:=GPL-2.0-or-later
PKG_BUILD_DIR:=$(BUILD_DIR)/$(PKG_NAME)-$(PKG_VERSION)

include $(INCLUDE_DIR)/package.mk

define Package/$(PKG_NAME)
  SECTION:=utils
  CATEGORY:=Utilities
  TITLE:=QModem VoIP daemon (experimental)
  DEPENDS:=+libubus +libubox +libblobmsg-json +libjson-c +uci +jsonfilter +jshn \
	+alsa-lib +libspandsp3 +libsoxr +libwebsockets-mbedtls +px5g-mbedtls \
	+libpj +libpjlib-util +libpjsip \
	+kmod-usb-serial +kmod-usb-serial-option
endef

define Package/$(PKG_NAME)/description
  Experimental QModem voice daemon. Owns the exclusive modem audio PCM fd and
  drives call control through module profiles. SIP and web consumers attach to
  the daemon's media socket.
endef

define Build/Prepare
	$(RM) -r $(PKG_BUILD_DIR)
	mkdir -p $(PKG_BUILD_DIR)
	$(CP) ./src/* $(PKG_BUILD_DIR)/
endef

define Build/Compile
	$(TARGET_CC) $(TARGET_CPPFLAGS) $(TARGET_CFLAGS) \
		-DPJ_AUTOCONF=1 -DPJ_IS_BIG_ENDIAN=0 -DPJ_IS_LITTLE_ENDIAN=1 \
		-I$(STAGING_DIR)/usr/include -I$(STAGING_DIR)/usr/lib/spandsp3/include \
		-Wall -Wextra -Werror -std=gnu11 \
		-o $(PKG_BUILD_DIR)/qmodem_voip_registrar \
		$(PKG_BUILD_DIR)/registrar.c $(PKG_BUILD_DIR)/sip_gateway.c \
		$(PKG_BUILD_DIR)/sip_activation.c $(TARGET_LDFLAGS) \
		-L$(STAGING_DIR)/usr/lib/spandsp3/lib \
		-lpjsip -lpjlib-util -lpj -lspandsp -lsoxr -lasound -lubus -lubox -lwebsockets
	$(TARGET_CC) $(TARGET_CPPFLAGS) $(TARGET_CFLAGS) -std=gnu11 -Wall -Wextra -Werror \
		-I$(STAGING_DIR)/usr/include -I$(STAGING_DIR)/usr/lib/spandsp3/include \
		-o $(PKG_BUILD_DIR)/qmodem_voip \
		$(PKG_BUILD_DIR)/qmodem_voip.c $(PKG_BUILD_DIR)/call_state.c \
		$(PKG_BUILD_DIR)/sip_gateway.c $(PKG_BUILD_DIR)/sip_activation.c \
		$(PKG_BUILD_DIR)/media_core.c $(PKG_BUILD_DIR)/media_alsa.c \
		$(PKG_BUILD_DIR)/media_serial.c $(PKG_BUILD_DIR)/browser_media.c \
		$(PKG_BUILD_DIR)/rtp_transport.c \
		$(TARGET_LDFLAGS) \
		-L$(STAGING_DIR)/usr/lib/spandsp3/lib \
		-lspandsp -lubus -lubox -lblobmsg_json -ljson-c -lsoxr -lasound \
		-lwebsockets -lm -lpthread
endef

define Package/$(PKG_NAME)/install
	$(INSTALL_DIR) $(1)/usr/bin
	$(INSTALL_BIN) $(PKG_BUILD_DIR)/qmodem_voip $(1)/usr/bin/
	$(INSTALL_BIN) $(PKG_BUILD_DIR)/qmodem_voip_registrar $(1)/usr/bin/
	$(INSTALL_DIR) $(1)/usr/lib/qmodem_voip $(1)/usr/share/qmodem $(1)/usr/sbin \
		$(1)/etc/init.d $(1)/etc/config $(1)/etc/qmodem_voip $(1)/etc/uci-defaults
	$(INSTALL_BIN) ./files/usr/lib/qmodem_voip/*.sh $(1)/usr/lib/qmodem_voip/
	$(INSTALL_DATA) ./files/usr/share/qmodem/modem_supports.json $(1)/usr/share/qmodem/
	$(INSTALL_BIN) ./files/usr/sbin/qmodem_voip_modem_safety $(1)/usr/sbin/
	$(INSTALL_BIN) ./files/usr/sbin/qmodem_voip_registrar_wait $(1)/usr/sbin/
	$(INSTALL_BIN) ./files/etc/init.d/qmodem_voip $(1)/etc/init.d/
	$(INSTALL_CONF) ./files/etc/config/qmodem_voip $(1)/etc/config/
	$(INSTALL_BIN) ./files/etc/qmodem_voip/firewall.include $(1)/etc/qmodem_voip/
	$(INSTALL_BIN) ./files/etc/uci-defaults/90-qmodem-voip-firewall $(1)/etc/uci-defaults/
	$(INSTALL_BIN) ./files/etc/uci-defaults/91-qmodem-voip-https $(1)/etc/uci-defaults/
endef

$(eval $(call BuildPackage,$(PKG_NAME)))