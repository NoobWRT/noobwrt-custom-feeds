# Credits

## Maintainer and developer

**Lahiru S Liyanage (NoobLK)** maintains this repository and develops the management
interface, SMS and SMS over SIP, alerts, line health, the combined feed and its NoobWRT
integration.

- GitHub: [@nooblk-98](https://github.com/nooblk-98)
- Telegram: [@itsme_nooblk](https://t.me/itsme_nooblk)
- Email: liyanagelsofficial@gmail.com

## Sources

This repository combines and builds on GPL-2.0 work by others. Their copyright notices are
kept in every file they wrote.

| Part | Source | Author | License |
| --- | --- | --- | --- |
| `kernel/aw1000-fxs`, `fxsd`, `sip/`, `tools/`, `openwrt/aw1000-fxs`, `openwrt/fxsd`, `docs/` | [openwrt-aw1000-phone](https://github.com/Perz3us/openwrt-aw1000-phone) | perz3us | GPL-2.0 |
| `msipd/`, `openwrt/modem-sip` | [openwrt-modem-sip](https://github.com/Perz3us/openwrt-modem-sip) | perz3us | GPL-2.0 |
| `msipd/src/g722.c` | spandsp | Steve Underwood and contributors | LGPL-2.1 |
| rpcd backends `fxs` and `modem-sip` in `openwrt/aw1000-voice-web/files/rpcd` | luci-app-fxs, luci-app-modem-sip | perz3us | GPL-2.0 |
| Call log parser in `openwrt/aw1000-voice-web/files/www/js/calllog.js` | luci-app-fxs | perz3us | GPL-2.0 |
| Configurable modem PCM slots in `fxsd` (`-P`, `-Q`, `modem_slots`, `qdai_slot`) | [PR #16](https://github.com/Perz3us/openwrt-aw1000-phone/pull/16) | NoobWRT | GPL-2.0 |
| Management interface, SMS inbox and watcher, SMS over SIP in `msipd`, alerts, `aw1000-voice` rpcd, LuCI shortcut, screenshot tools | this repository | Lahiru S Liyanage (NoobLK) | GPL-2.0 |

Planned features from [openwrt-aw1000-voice-awvoice](https://github.com/Pr0Luci/openwrt-aw1000-voice-awvoice)
by Pr0Luci (GPL-2.0), such as the answering machine and the line health tools, will carry
their notices when they are ported.

The QR codes on the SIP page are drawn by `luci-lib-uqr` from the LuCI project
(Apache-2.0), loaded from the router at run time.
