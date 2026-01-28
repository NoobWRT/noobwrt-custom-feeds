local sys  = require "luci.sys"
local m    = SimpleForm("led_status", translate("Current LED Status"))
m.description = translate("Live output of current LED behavior from system.")
m.reset = false
m.submit = false

local result = sys.exec("/usr/bin/led-status.sh 2>/dev/null") or ""

local csq, snr, led5g, internet, wifi = 0, 0, "off", "Disconnected", "Off"

for line in result:gmatch("[^\r\n]+") do
    local v = line:match("CSQ%s*=%s*(%d+)")
    if v then csq = tonumber(v) end

    v = line:match("SNR%s*=%s*(%d+)")
    if v then snr = tonumber(v) end

    v = line:match("5G LED:%s*(%w+)%s*%(")
    if v then led5g = v end

    v = line:match("Internet:%s*(%w+)")
    if v then internet = v end

    v = line:match("WiFi:%s*(%w+)")
    if v then wifi = v end
end

local s = m:section(SimpleSection, nil, translate("Current System Status"))

local csq_field = s:option(DummyValue, "csq", "CSQ")
csq_field.rawhtml = true
local csq_color = csq >= 30 and "green" or csq >= 20 and "orange" or "red"
csq_field.default = string.format("<span style='color:%s;'>CSQ=%d</span>", csq_color, csq)

local snr_field = s:option(DummyValue, "snr", "SNR")
snr_field.rawhtml = true
local snr_color = snr >= 10 and "green" or snr >= 5 and "orange" or "red"
snr_field.default = string.format("<span style='color:%s;'>SNR=%d</span>", snr_color, snr)

local led_field = s:option(DummyValue, "led5g", "5G LED")
led_field.rawhtml = true

local led_color = "gray"  -- default
local led_lower = led5g:lower()

if led_lower == "yellow" then
    led_color = "orange"
elseif led_lower == "purple" then
    led_color = "purple"
elseif led_lower == "green" then
    led_color = "green"
elseif led_lower == "red" then
    led_color = "red"
end

led_field.default = string.format("<span style='color:%s;'>%s (SNR=%d)</span>", led_color, led5g, snr)

local internet_field = s:option(DummyValue, "internet", "Internet")
internet_field.rawhtml = true
internet_field.default = internet == "Connected" and
  "<span style='color:green;'>Connected</span>" or
  "<span style='color:red;'>Disconnected</span>"

local wifi_field = s:option(DummyValue, "wifi", "WiFi")
wifi_field.rawhtml = true
wifi_field.default = wifi == "On" and
  "<span style='color:green;'>On</span>" or
  "<span style='color:red;'>Off</span>"

return m
