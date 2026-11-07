# PCI Cell Lock

Keeps a Quectel modem on your best 4G cell. You make a list of cells in the order you want them, and it moves down the list when a cell loses signal and back up when a better one returns. Made for the Arcadyan AW1000 with an RG500Q EA modem. It works on NoobWRT and on MyWRT, and needs ubus at daemon on the router.

## What it does

The list holds up to 5 cells, each a PCI and an EARFCN. The lock is removed only when every cell on the list has failed, and it locks again when one comes back.

You can add timed lists, so different cells are used at different times of day. Each list has its own switch, and so does the main list.

It waits for phone calls, SIP calls and SMS before moving up the list. If the current cell has lost signal it moves right away.

It starts at boot and runs without the LuCI page open. It only sends 4G lock commands and never changes 5G locks, bands or network mode.

## Install

It installs turned off and changes nothing until you turn it on under Services, Auto Pci Cell. Copy the package to /tmp on the router first, then log out of LuCI and back in after installing.

On NoobWRT:

    apk add --allow-untrusted /tmp/auto-pci-cell-0.2.1-r1.apk

On MyWRT:

    opkg install /tmp/auto-pci-cell_0.2.1-1_all.ipk

MyWRT has its own PCI Lock, which has to stay off or this app pauses:

    uci set pcilock.cfg.enabled=0; uci commit pcilock; /etc/init.d/pcilock disable

To remove it, use `opkg remove auto-pci-cell` or `apk del auto-pci-cell`.

## Trying better cells

The app reads the modem's neighbour list, and if a better cell shows there twice it moves to it. It can also try a better cell at the interval you set, 5 minutes by default. A failed try drops the internet until the modem is back on the current cell, so these tries can be turned off or limited to set times. Moving away from a lost cell and moving back through the neighbour list still work at any time.

## Limits

An incoming SMS cannot be seen until it has arrived. SIP calls are seen only when they go through the SIM or the phone daemon. Network handovers can still interrupt a call, the app only avoids switching on purpose. A cell with signal but no internet is not detected. If you change the lock by hand while the app is on, it puts its own lock back.

## Build

With the OpenWrt 25.12 SDK in the owrt-sdk-cache Docker volume:

    docker run --rm -v owrt-sdk-cache:/cache -v "$PWD:/src" owrt-sdk-env sh /src/build.sh

The packages end up in dist.

## License

GPL 2.0
