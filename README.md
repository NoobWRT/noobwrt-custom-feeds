<div align="center">
  <img src="./images/logo.png" width="360" alt="openwrt logo" />

**Custom OpenWrt package feed with extra packages missing from official repositories**

[![CI/CD](https://img.shields.io/github/actions/workflow/status/nooblk-98/noobwrt-custom-feeds/sync-packages.yml?branch=main)](https://github.com/nooblk-98/noobwrt-custom-feeds/actions/workflows/sync-packages.yml)
[![License: AGPL](https://img.shields.io/badge/license-AGPL--3.0-blue.svg)](http://www.gnu.org/licenses/agpl-3.0)
[![Last Commit](https://img.shields.io/github/last-commit/nooblk-98/noobwrt-custom-feeds)](https://github.com/nooblk-98/noobwrt-custom-feeds/commits/main)
[![Contributions Welcome](https://img.shields.io/badge/contributions-welcome-brightgreen.svg)](https://github.com/nooblk-98/noobwrt-custom-feeds/blob/main/CONTRIBUTING.md)


</div>

---


# Noobwrt custom Packages

All packages are automatically synchronized with their original repositories **every day** and kept up-to-date with the latest changes and security updates.

## Quick Start

Add this line to your OpenWrt SDK's `feeds.conf` file:

```bash
echo "src-git noobwrt_packages https://github.com/nooblk-98/noobwrt-custom-feeds.git;main" >> feeds.conf.default
```
