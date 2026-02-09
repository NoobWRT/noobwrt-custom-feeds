include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-aw1k-led
PKG_VERSION:=1.0.0
PKG_RELEASE:=5

PKG_MAINTAINER:=dotycat <support@dotycat.com>
PKG_LICENSE:=GPL-3.0

LUCI_TITLE:=AW1K LED Controller
LUCI_DESCRIPTION:=LuCI application to configure LED behavior based on 5G signal quality.
LUCI_DEPENDS:=

PKG_BUILD_DIR := $(BUILD_DIR)/$(PKG_NAME)

include $(INCLUDE_DIR)/package.mk

define Package/$(PKG_NAME)
  SECTION:=luci
  CATEGORY:=LuCI
  SUBMENU:=3. Applications
  TITLE:=$(LUCI_TITLE)
  PKGARCH:=all
  DEPENDS:=$(LUCI_DEPENDS)
endef

define Package/$(PKG_NAME)/description
  $(LUCI_DESCRIPTION)
endef

define Build/Compile
endef

define Package/$(PKG_NAME)/install
	$(CP) ./files/* $(1)/
endef

$(eval $(call BuildPackage,$(PKG_NAME)))
