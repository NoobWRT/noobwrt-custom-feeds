m = Map("5g-led", translate("5G Signal Quality"))

m.description = translate("Configure LED behavior for Bad 5G signal.")

s = m:section(NamedSection, "signal", "quality", translate("Signal Quality Thresholds"))

local qualities = {
	{ id = "excellent", label = translate("Excellent") },
	{ id = "good", label = translate("Good") },
	{ id = "average", label = translate("Average") },
	{ id = "bad", label = translate("Bad") }
}

local first = true
for _, q in ipairs(qualities) do
	if not first then
		local spacer = s:option(DummyValue, "_space_" .. q.id, "")
		spacer.rawhtml = true
		spacer.default = "<hr/>"
	end
	first = false

	s:option(Value, q.id .. "_min_snr", translate(q.label .. " - Minimum SNR")).datatype = "uinteger"

	local color = s:option(ListValue, q.id .. "_color", translate(q.label .. " - LED Color"))
	color:value("green", translate("Green"))
	color:value("blue", translate("Blue"))
	color:value("red", translate("Red"))
	color:value("yellow", translate("Yellow"))
	color:value("purple", translate("Purple"))

	s:option(Flag, q.id .. "_blink", translate(q.label .. " - Blink LED"))
end

return m
