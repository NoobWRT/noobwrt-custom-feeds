<h1 align="center">openwrt-modem-sip</h1>

<p align="center">SIP phones and apps that call through the router's modem SIM</p>

<p align="center">
  <a href="https://github.com/Perz3us/openwrt-modem-sip/releases/latest"><img src="https://img.shields.io/github/v/release/Perz3us/openwrt-modem-sip?label=release" alt="Release"></a>
  <a href="https://github.com/Perz3us/openwrt-modem-sip/releases"><img src="https://img.shields.io/github/downloads/Perz3us/openwrt-modem-sip/total?label=downloads" alt="Downloads"></a>
  <img src="https://img.shields.io/badge/router-Arcadyan%20AW1000-0a7bbb" alt="Router">
  <a href="https://openwrt.org"><img src="https://img.shields.io/badge/OpenWrt-25.12-00b5e2?logo=openwrt&logoColor=white" alt="OpenWrt"></a>
  <a href="LICENSE"><img src="https://img.shields.io/github/license/Perz3us/openwrt-modem-sip" alt="License"></a>
</p>

My [AW1000 phone port](https://github.com/Perz3us/openwrt-aw1000-phone) used QModem for SIP,
and newer firmware like NoobWRT dropped QModem. So I wrote a small SIP server of my own,
`msipd`. Phones and apps on the LAN log in to the router, and calls on the SIM ring all of them
together with the RJ11 phone.

## What it does

Every phone gets its own login, made on the router, with a QR code for Linphone. An incoming
call rings all phones at once and the first one to answer gets it. You can call out from any
phone, and keypad tones work for bank and carrier menus.

When HD calling is on, calls use Opus or G.722, otherwise PCMA or PCMU. The call history on the
phone port says which phone answered, like Answered on Pixel, and call recording works through
the phone port with nothing extra to set up. Five wrong logins block that address for 10
minutes.

It listens on the LAN only. Phones outside the home can reach it through a VPN, turn that on
in the SIP tab of the phone port.

## What you need

[openwrt-aw1000-phone](https://github.com/Perz3us/openwrt-aw1000-phone) 0.8.0 or newer, which
carries the call audio, on OpenWrt 25.12 or NoobWRT.

## Install

Copy the packages from the latest release to the router and run:

```
apk add --allow-untrusted ./libre2-*.apk ./modem-sip-*.apk ./luci-app-modem-sip-*.apk
```

`libopus` comes from the OpenWrt package feed, so the router needs internet for the first
install.

## Set up a phone

Open Modem SIP under Services and press Turn on. If the phone port uses QModem voice, it asks
before switching. Type a name like `Pixel` and press Add phone. In Linphone, scan the phone's
QR code. For other apps press Login and type the server, user name and password, with UDP.

The phone shows as online once it has logged in. Ports and HD are on the Settings tab.

## Problems

`logread -e msipd` shows logins, blocked addresses and the codec each call used. If a call fails
because there was no audio format in common, the log line shows what the app offered.

## Build

`./build.sh` builds the packages with the OpenWrt SDK in Docker, into `dist/`.

## License

GPL-2.0. `src/g722.c` comes from spandsp and stays under LGPL-2.1.
