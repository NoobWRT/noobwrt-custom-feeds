# luci-app-aw1k-led

LuCI app for AW1000 LED status with QModem support.

## Highlights
- Tested with QModem
- LED status for 5G, signal, internet, WiFi, power, and phone
- Uses `sms_tool` for CSQ and QENG parsing

## Install (OpenWrt)
1. Copy package files to your build tree or device.
2. Enable and start the service:
```
/etc/init.d/led-status enable
/etc/init.d/led-status start
```

## Notes
- The modem AT port can be set in UCI: `modeminfo.settings.comm`
- Default port fallback is `/dev/ttyUSB2` if not configured

## About
- Tested with QModem
- LED status for 5G, signal, internet, WiFi, power, and phone
- Uses `sms_tool` for CSQ and QENG parsing

## Developer
Created and tested for QModem by **nooblk-98**.
