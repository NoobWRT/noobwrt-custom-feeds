---
name: Bug report
about: Report a bug in the LuCI front-end for adblock-fast
title: "[luci-app-adblock-fast] "
labels: bug
assignees: stangri

---

**Is this a LuCI bug or a service bug?**

LuCI is just the web UI; the actual work is done by the [adblock-fast](https://github.com/stangri/adblock-fast) service. Quick triage:

- Page won't render / a control does nothing / Save & Apply produces a JS error → **LuCI bug**, file here.
- After Save & Apply, `uci show adblock-fast` shows the wrong values → **LuCI bug**, file here.
- Settings save correctly (you can verify with `uci show adblock-fast` after Save & Apply) but the service still misbehaves (e.g. domains not blocked, lists not downloading) → **service bug**, please file at [stangri/adblock-fast](https://github.com/stangri/adblock-fast/issues) and include the diagnostics from that repo's bug template.

**Describe the bug**

What you saw in the UI.

**To reproduce**

1.
2.

**Versions**

- OpenWrt: (`ubus call system board`)
- `luci-app-adblock-fast`: (`apk list -I luci-app-adblock-fast` or `opkg list-installed | grep luci-app-adblock-fast`)
- `adblock-fast`: (same, for the underlying package)
- Browser:

**Browser console output**

Open browser dev tools (F12) → Console tab. Paste any errors that appear when you reproduce the bug.

**Screenshot**

If applicable.
