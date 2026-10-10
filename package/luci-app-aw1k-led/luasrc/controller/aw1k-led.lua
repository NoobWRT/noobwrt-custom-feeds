--=================================================
-- Copyright (c) 2026 Lahiru S Liyanage (NoobLK) <liyanagelsofficial@gmail.com>
-- GitHub: https://github.com/nooblk-98/luci-app-aw1k-led
-- Telegram: @itsme_nooblk
-- License: GPL-3.0-or-later
--=================================================

module("luci.controller.aw1k-led", package.seeall)

function index()
    entry({"admin", "system", "aw1k-led"},
        view("aw1k-led/settings"),
        _("AW1000 LEDs"), 60)
            .dependent = false
end
