module("luci.controller.5g_led", package.seeall)

function index()
    if not node("admin", "tools").target then
        entry({"admin", "tools"}, firstchild(), _("Tools"), 50).dependent = false
    end

    entry({"admin", "tools", "5g"}, firstchild(), _("5G LED Config"), 60).dependent = false
    entry({"admin", "tools", "5g", "quality"}, cbi("5g/quality"), _("Quality"), 1)
    entry({"admin", "tools", "5g", "settings"}, cbi("5g/settings"), _("LED Settings"), 2)
    entry({"admin", "tools", "5g", "status"}, cbi("5g/status"), _("Signal Status"), 3)
end
