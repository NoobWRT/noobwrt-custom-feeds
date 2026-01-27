# QModem RPCD Interface

## Overview

The QModem RPCD interface provides ubus access to modem control functions. This allows other services and web interfaces to interact with modems through the ubus system.

## Installation

The rpcd script is automatically installed with the qmodem package:
- Script location: `/usr/libexec/rpcd/qmodem`
- ACL configuration: `/usr/share/rpcd/acl.d/qmodem.json`

After installation, restart rpcd:
```bash
killall -HUP rpcd
```

## Available Methods

### Information Methods (Read-only)

#### base_info
Get basic modem information.
```bash
ubus call qmodem base_info '{"config_section":"modem1"}'
```

#### cell_info
Get cellular network information.
```bash
ubus call qmodem cell_info '{"config_section":"modem1"}'
```

#### info
Get comprehensive modem information.
```bash
ubus call qmodem info '{"config_section":"modem1"}'
```

#### network_info
Get network connection information.
```bash
ubus call qmodem network_info '{"config_section":"modem1"}'
```

#### sim_info
Get SIM card information.
```bash
ubus call qmodem sim_info '{"config_section":"modem1"}'
```

#### get_at_cfg
Get AT command configuration and available ports.
```bash
ubus call qmodem get_at_cfg '{"config_section":"modem1"}'
```

#### get_copyright
Get copyright information.
```bash
ubus call qmodem get_copyright '{"config_section":"modem1"}'
```

#### get_disabled_features
Get list of disabled features for this modem.
```bash
ubus call qmodem get_disabled_features '{"config_section":"modem1"}'
```

#### get_dns
Get DNS server information.
```bash
ubus call qmodem get_dns '{"config_section":"modem1"}'
```

#### get_imei
Get modem IMEI number.
```bash
ubus call qmodem get_imei '{"config_section":"modem1"}'
```

#### get_lockband
Get current band lock configuration.
```bash
ubus call qmodem get_lockband '{"config_section":"modem1"}'
```

#### get_mode
Get current network mode (LTE/5G/etc).
```bash
ubus call qmodem get_mode '{"config_section":"modem1"}'
```

#### get_neighborcell
Get neighboring cell information.
```bash
ubus call qmodem get_neighborcell '{"config_section":"modem1"}'
```

#### get_network_prefer
Get network preference settings.
```bash
ubus call qmodem get_network_prefer '{"config_section":"modem1"}'
```

#### get_reboot_caps
Get available reboot methods (hard/soft).
```bash
ubus call qmodem get_reboot_caps '{"config_section":"modem1"}'
```

#### get_sms
Get SMS messages.
```bash
ubus call qmodem get_sms '{"config_section":"modem1"}'
```

### Control Methods (Write)

#### clear_dial_log
Clear the dial log.
```bash
ubus call qmodem clear_dial_log '{"config_section":"modem1"}'
```

#### delete_sms
Delete SMS messages by index.
```bash
ubus call qmodem delete_sms '{"config_section":"modem1","index":"1 2 3"}'
```

#### do_reboot
Reboot the modem.
```bash
# Hard reboot
ubus call qmodem do_reboot '{"config_section":"modem1","params":{"method":"hard"}}'

# Soft reboot
ubus call qmodem do_reboot '{"config_section":"modem1","params":{"method":"soft"}}'
```

#### send_at
Send AT command to modem.
```bash
ubus call qmodem send_at '{"config_section":"modem1","params":{"at":"AT+CGMM","port":"/dev/ttyUSB2"}}'
```

#### send_raw_pdu
Send raw PDU SMS.
```bash
ubus call qmodem send_raw_pdu '{"config_section":"modem1","cmd":"<PDU_STRING>"}'
```

#### send_sms
Send SMS message.
```bash
ubus call qmodem send_sms '{
  "config_section":"modem1",
  "params":{
    "phone_number":"+1234567890",
    "message_content":"Hello World"
  }
}'
```

#### set_imei
Set modem IMEI (if supported).
```bash
ubus call qmodem set_imei '{"config_section":"modem1","imei":"123456789012345"}'
```

#### set_lockband
Set band lock configuration.
```bash
ubus call qmodem set_lockband '{
  "config_section":"modem1",
  "params":{
    "bands":"1,3,7,20"
  }
}'
```

#### set_mode
Set network mode.
```bash
ubus call qmodem set_mode '{"config_section":"modem1","mode":"auto"}'
```

#### set_neighborcell
Configure neighboring cell settings.
```bash
ubus call qmodem set_neighborcell '{
  "config_section":"modem1",
  "params":{
    "enable":"1"
  }
}'
```

#### set_network_prefer
Set network preference.
```bash
ubus call qmodem set_network_prefer '{
  "config_section":"modem1",
  "params":{
    "prefer":"lte"
  }
}'
```

#### set_sms_storage
Set SMS storage location.
```bash
ubus call qmodem set_sms_storage '{"config_section":"modem1","storage":"SM"}'
```

## HTTP Access via RPCD

You can also access these methods via HTTP through rpcd:

```bash
# Example: Get modem info
curl -X POST http://192.168.1.1/ubus \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "call",
    "params": [
      "<session_id>",
      "qmodem",
      "info",
      {"config_section":"modem1"}
    ]
  }'
```

## Configuration

### UCI Configuration Section
The `config_section` parameter refers to a UCI configuration section in `/etc/config/qmodem`. For example:

```
config modem 'modem1'
    option manufacturer 'Quectel'
    option platform 'RG500Q'
    option at_port '/dev/ttyUSB2'
    option path '1-1.4'
    ...
```

### ACL Permissions
Edit `/usr/share/rpcd/acl.d/qmodem.json` to configure access control for different user groups.

## Caching

Many information methods use caching (default 10 seconds) to avoid excessive modem queries. Cache files are stored in `/tmp/cache_*`.

## Troubleshooting

1. Check if rpcd is running:
```bash
ps | grep rpcd
```

2. List available ubus objects:
```bash
ubus list qmodem
```

3. Check rpcd logs:
```bash
logread | grep rpcd
```

4. Verify script permissions:
```bash
ls -l /usr/libexec/rpcd/qmodem
```
The script should be executable.

5. Test the script directly:
```bash
echo '{"config_section":"modem1"}' | /usr/libexec/rpcd/qmodem call info
```

## Migration from modem_ctrl.sh

The rpcd interface replaces direct calls to `modem_ctrl.sh`:

**Old way:**
```bash
/usr/share/qmodem/modem_ctrl.sh info modem1
```

**New way:**
```bash
ubus call qmodem info '{"config_section":"modem1"}'
```

## Dependencies

- libubox/jshn.sh - JSON handling
- uci - Configuration management
- jq - JSON processing
- tom_modem - Modem communication tool
- Vendor-specific scripts in `/usr/share/qmodem/vendor/`

## Notes

- All methods require a valid `config_section` parameter
- The config_section must exist in `/etc/config/qmodem`
- Vendor-specific functionality is loaded from `/usr/share/qmodem/vendor/` based on the modem manufacturer
- AT command language (Chinese/English) is automatically selected based on system language settings
