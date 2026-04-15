# luci-app-aw1k-led

LED Status Controller for the **Arcadyan AW1000** router running OpenWrt.

Controls the router's RGB LEDs based on live 5G signal quality and mobile internet status — with a built-in Night Mode that silences all LEDs on a schedule.

> **This package only works on the Arcadyan AW1000 router.**

---

## Features

- **5G Signal LED** — changes color based on SINR (excellent / good / average / poor / no signal)
- **Signal Quality LED** — changes color based on CSQ value (excellent / good / average / weak / offline)
- **Internet LED** — solid when connected, blinks when disconnected
- **WiFi LED** — on when WiFi is enabled, off when disabled
- **Night Mode** — turns off all status LEDs on a schedule; power LED does a slow airplane-style double-blink
- **Customizable colors** — pick any of 8 colors (Red, Green, Blue, Yellow, Cyan, Magenta, White, Off) for each signal level
- **Adjustable thresholds** — set your own SINR and CSQ cutoff values
- **LuCI web interface** — configure everything from the OpenWrt admin panel under **System → AW1000 LEDs**

---

## Installation

Download the latest `.ipk` or `.apk` from the [Releases](../../releases) page and install it:

**IPK (OpenWrt 24.x):**
```sh
opkg install luci-app-aw1k-led_*.ipk
```

**APK (OpenWrt 25.x):**
```sh
apk add --allow-untrusted luci-app-aw1k-led_*.apk
```

Then reboot or restart the service:
```sh
/etc/init.d/ledstatus restart
```

---

## LED Map

| LED | sysfs name | Used for |
|-----|-----------|----------|
| RGB | `*:5g` | 5G signal quality |
| Green | `green:internet` | Internet connected |
| Green | `green:wifi` | WiFi enabled |
| RGB | `*:signal` | Mobile signal (CSQ) |
| Green | `green:power` | Power / Night Mode beacon |

---

## Night Mode

When enabled, Night Mode activates at the set start time and deactivates at the end time (24-hour format).

During Night Mode:
- All status LEDs turn **off**
- Power LED does a slow **double-blink** (airplane tail beacon style)

Configure under **System → AW1000 LEDs → Night Mode**.

---

## Screenshots

![LuCI Settings](https://raw.githubusercontent.com/nooblk-98/luci-app-aw1k-led/main/docs/screenshot.png)

---

## License

GPL-3.0-or-later
