local m = SimpleForm("led_about", translate("About"))
m.description = translate("Project info and developer credits.")
m.reset = false
m.submit = false

local s = m:section(SimpleSection, nil, translate("About"))

local badge = s:option(DummyValue, "_badge", "")
badge.rawhtml = true
badge.default = [[
<div style="display:flex; flex-direction:column; gap:8px;">
  <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
    <a href="https://github.com/nooblk-98" target="_blank" rel="noopener">
      <img alt="GitHub" src="https://img.shields.io/badge/GitHub-nooblk--98-181717?logo=github&logoColor=white">
    </a>
  </div>
  <div>
    <a href="https://github.com/nooblk-98/luci-app-aw1k-led" target="_blank" rel="noopener">
      <img alt="Repo" src="https://img.shields.io/badge/Repo-luci--app--aw1k--led-0b5fff?logo=github&logoColor=white">
    </a>
  </div>
  <ul style="margin:10px 0 0 0; padding-left:18px; list-style:disc; list-style-position:outside; line-height:1.5;">
    <li>Tested with QModem</li>
    <li>LED status for 5G, signal, internet, WiFi, power, and phone</li>
    <li>Uses <code>sms_tool</code> for CSQ and QENG parsing</li>
  </ul>
</div>
]]

return m
