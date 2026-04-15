'use strict';
'require view';
'require form';
'require uci';
'require ui';
'require rpc';

var callServiceList = rpc.declare({
    object: 'service',
    method: 'list',
    params: ['name'],
    expect: { '': {} }
});

function getServiceStatus() {
    return callServiceList('ledstatus').then(function(res) {
        try { return res['ledstatus']['instances']['instance1']['running']; }
        catch(e) { return false; }
    });
}

/* ─── Color palette ────────────────────────────────────────────────────────
 * Each entry: { id, label, hex, r, g, b }
 * r/g/b are 0 or 1 — the physical LED channels on AW1000 (max_brightness=1)
 * ────────────────────────────────────────────────────────────────────────── */
var COLORS = [
    { id: 'off',     label: 'Off',     hex: '#222222', r:0, g:0, b:0 },
    { id: 'red',     label: 'Red',     hex: '#ff3030', r:1, g:0, b:0 },
    { id: 'green',   label: 'Green',   hex: '#22dd44', r:0, g:1, b:0 },
    { id: 'blue',    label: 'Blue',    hex: '#3399ff', r:0, g:0, b:1 },
    { id: 'yellow',  label: 'Yellow',  hex: '#ffdd00', r:1, g:1, b:0 },
    { id: 'cyan',    label: 'Cyan',    hex: '#00eedd', r:0, g:1, b:1 },
    { id: 'magenta', label: 'Magenta', hex: '#dd44ff', r:1, g:0, b:1 },
    { id: 'white',   label: 'White',   hex: '#ffffff', r:1, g:1, b:1 }
];

function colorById(id) {
    for (var i = 0; i < COLORS.length; i++)
        if (COLORS[i].id === id) return COLORS[i];
    return COLORS[0];
}

return view.extend({
    load: function() {
        return Promise.all([
            uci.load('ledstatus'),
            getServiceStatus()
        ]);
    },

    render: function(data) {
        var running = data[1];
        var m, s, o;

        m = new form.Map('ledstatus', _('AW1000 LED Status'),
            _('Configure LED behaviour for the Arcadyan AW1000 router. Service status: ') +
            (running
                ? '<span style="color:#2dce89;font-weight:bold">' + _('Running') + '</span>'
                : '<span style="color:#f5365c;font-weight:bold">' + _('Stopped') + '</span>'));

        s = m.section(form.NamedSection, 'settings', 'ledstatus');
        s.anonymous = true;
        s.addremove = false;

        s.tab('general',    _('General'));
        s.tab('thresholds', _('Thresholds'));
        s.tab('colors',     _('LED Colors'));
        s.tab('nightmode',  _('Night Mode'));
        s.tab('about',      _('About'));

        /* ══════════════════════════════════════════════════════════════════
         * TAB: General
         * ══════════════════════════════════════════════════════════════════ */
        o = s.taboption('general', form.Flag, 'enabled', _('Enable LED service'));
        o.rmempty = false; o.default = '1';

        o = s.taboption('general', form.Value, 'interval',
            _('Check interval'), _('Seconds between each LED update (5–300)'));
        o.datatype = 'range(5,300)'; o.placeholder = '20'; o.rmempty = false;

        o = s.taboption('general', form.Value, 'modem_port',
            _('Modem AT port'), _('Serial port used for AT commands, e.g. /dev/ttyUSB2'));
        o.placeholder = '/dev/ttyUSB2'; o.rmempty = false;

        o = s.taboption('general', form.DummyValue, '_svc_ctrl', _('Service control'));
        o.rawhtml = true;
        o.default = '<button type="button" class="btn cbi-button cbi-button-action" id="aw1k-restart-btn">' +
                    _('Restart LED service') + '</button>' +
                    '<span id="aw1k-restart-status" style="margin-left:12px;font-size:13px"></span>';

        /* ══════════════════════════════════════════════════════════════════
         * TAB: Thresholds
         * ══════════════════════════════════════════════════════════════════ */
        o = s.taboption('thresholds', form.DummyValue, '_5g_hdr', '');
        o.rawhtml = true;
        o.default = '<h5 style="margin:0 0 4px">5G SINR thresholds</h5>' +
                    '<p style="color:#888;font-size:12px;margin:0 0 10px">' +
                    'Assign colours in the <b>LED Colors</b> tab. Thresholds only define the cutoff values.</p>';

        o = s.taboption('thresholds', form.Value, 'sinr_excellent',
            _('5G Excellent (≥)'), _('SINR ≥ this value'));
        o.datatype = 'integer'; o.placeholder = '25';

        o = s.taboption('thresholds', form.Value, 'sinr_good',
            _('5G Good (≥)'), _('SINR ≥ this value'));
        o.datatype = 'integer'; o.placeholder = '15';

        o = s.taboption('thresholds', form.Value, 'sinr_average',
            _('5G Average (≥)'), _('SINR ≥ this value'));
        o.datatype = 'integer'; o.placeholder = '5';

        o = s.taboption('thresholds', form.DummyValue, '_csq_hdr', '');
        o.rawhtml = true;
        o.default = '<h5 style="margin:16px 0 4px">CSQ signal thresholds</h5>' +
                    '<p style="color:#888;font-size:12px;margin:0 0 10px">' +
                    'Assign colours in the <b>LED Colors</b> tab. Thresholds only define the cutoff values.</p>';

        o = s.taboption('thresholds', form.Value, 'csq_excellent',
            _('CSQ Excellent (≥)'), _('CSQ ≥ this value'));
        o.datatype = 'range(0,31)'; o.placeholder = '20';

        o = s.taboption('thresholds', form.Value, 'csq_good',
            _('CSQ Good (≥)'), _('CSQ ≥ this value'));
        o.datatype = 'range(0,31)'; o.placeholder = '14';

        o = s.taboption('thresholds', form.Value, 'csq_average',
            _('CSQ Average (≥)'), _('CSQ ≥ this value'));
        o.datatype = 'range(0,31)'; o.placeholder = '10';

        /* ══════════════════════════════════════════════════════════════════
         * TAB: LED Colors
         * ══════════════════════════════════════════════════════════════════ */
        function pickerRow(uciKey, label, desc, currentColor) {
            var swatches = COLORS.map(function(c) {
                var sel = c.id === currentColor
                    ? 'outline:3px solid #5e72e4;outline-offset:2px;transform:scale(1.18);z-index:1;'
                    : '';
                return '<span data-key="' + uciKey + '" data-color="' + c.id + '" title="' + c.label + '" ' +
                    'onclick="awLkPick(this)" ' +
                    'style="display:inline-block;width:30px;height:30px;border-radius:50%;cursor:pointer;' +
                    'background:' + c.hex + ';border:2px solid rgba(0,0,0,0.18);position:relative;' +
                    'transition:transform .12s,outline .12s;' + sel + '"></span>';
            }).join('');

            return '<tr><td style="padding:6px 14px 6px 0;white-space:nowrap;font-size:13px;vertical-align:middle">' +
                '<b>' + label + '</b>' +
                (desc ? '<br><span style="color:#999;font-size:11px">' + desc + '</span>' : '') +
                '</td><td style="padding:6px 0;vertical-align:middle">' +
                '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">' +
                '<div id="aw1k-prev-' + uciKey + '" style="width:36px;height:36px;border-radius:8px;' +
                'flex-shrink:0;border:2px solid rgba(0,0,0,0.15);background:' + colorById(currentColor).hex + '"></div>' +
                '<div style="display:flex;gap:5px;flex-wrap:wrap">' + swatches + '</div>' +
                '<span id="aw1k-lbl-' + uciKey + '" style="font-size:13px;color:#888;min-width:52px">' +
                colorById(currentColor).label + '</span>' +
                '</div></td></tr>';
        }

        o = s.taboption('colors', form.DummyValue, '_colors_ui', '');
        o.rawhtml = true;

        o.cfgvalue = function(section_id) {
            var g = function(k, d) { return uci.get('ledstatus', section_id, k) || d; };

            var rows5g = [
                pickerRow('color_5g_excellent', '5G Excellent', 'SINR ≥ excellent threshold',  g('color_5g_excellent','green')),
                pickerRow('color_5g_good',      '5G Good',      'SINR ≥ good threshold',        g('color_5g_good','blue')),
                pickerRow('color_5g_average',   '5G Average',   'SINR ≥ average threshold',     g('color_5g_average','yellow')),
                pickerRow('color_5g_poor',      '5G Poor',      'SINR below average — blinks',  g('color_5g_poor','magenta')),
                pickerRow('color_5g_none',      '5G No signal', 'No NR5G cell found',            g('color_5g_none','red'))
            ].join('');

            var rowsSig = [
                pickerRow('color_sig_excellent', 'Signal Excellent', 'CSQ ≥ excellent threshold',  g('color_sig_excellent','green')),
                pickerRow('color_sig_good',      'Signal Good',      'CSQ ≥ good threshold',        g('color_sig_good','blue')),
                pickerRow('color_sig_average',   'Signal Average',   'CSQ ≥ average threshold',     g('color_sig_average','yellow')),
                pickerRow('color_sig_weak',      'Signal Weak',      'CSQ below average — blinks',  g('color_sig_weak','red')),
                pickerRow('color_sig_offline',   'Signal Offline',   'Internet disconnected',        g('color_sig_offline','magenta'))
            ].join('');

            return [
                '<div style="max-width:700px">',
                '<h5 style="margin:0 0 2px">5G SINR LED colors</h5>',
                '<p style="color:#888;font-size:12px;margin:0 0 10px">red:5g + green:5g + blue:5g — all 8 colors available.</p>',
                '<table style="border-collapse:collapse;width:100%">', rows5g, '</table>',
                '<h5 style="margin:16px 0 2px">Signal (CSQ) LED colors</h5>',
                '<p style="color:#888;font-size:12px;margin:0 0 10px">red:signal + green:signal + blue:signal.</p>',
                '<table style="border-collapse:collapse;width:100%">', rowsSig, '</table>',
                '</div>'
            ].join('');
        };
        o.write = function() {};

        /* ══════════════════════════════════════════════════════════════════
         * TAB: Night Mode
         * ══════════════════════════════════════════════════════════════════ */
        o = s.taboption('nightmode', form.Value, 'night_start',
            _('Start time'), _('Night Mode begins at this time (HH:MM), e.g. 21:00'));
        o.placeholder = '21:00'; o.rmempty = false;
        o.validate = function(section_id, value) {
            if (!/^\d{1,2}:\d{2}$/.test(value)) return _('Use HH:MM format');
            var p = value.split(':');
            if (+p[0] > 23 || +p[1] > 59) return _('Invalid time');
            return true;
        };

        o = s.taboption('nightmode', form.Value, 'night_end',
            _('End time'), _('Night Mode ends at this time (HH:MM), e.g. 07:00'));
        o.placeholder = '07:00'; o.rmempty = false;
        o.validate = function(section_id, value) {
            if (!/^\d{1,2}:\d{2}$/.test(value)) return _('Use HH:MM format');
            var p = value.split(':');
            if (+p[0] > 23 || +p[1] > 59) return _('Invalid time');
            return true;
        };

        o = s.taboption('nightmode', form.DummyValue, '_night_ctrl', _('Night Mode'));
        o.rawhtml = true;
        o.default = [
            '<button type="button" class="btn cbi-button cbi-button-action" id="aw1k-night-enable-btn">',
            _('Enable Night Mode'), '</button>',
            '&nbsp;',
            '<button type="button" class="btn cbi-button cbi-button-negative" id="aw1k-night-disable-btn">',
            _('Disable Night Mode'), '</button>',
            '<span id="aw1k-night-status" style="margin-left:12px;font-size:13px"></span>'
        ].join('');

        o = s.taboption('nightmode', form.DummyValue, '_night_info', '');
        o.rawhtml = true;
        o.default = [
            '<div style="background:var(--color-bg-2,#f4f4f4);border-radius:8px;padding:12px 16px;margin:8px 0 0;font-size:13px">',
            '<b>' + _('Night Mode behaviour') + '</b><br>',
            '<ul style="margin:6px 0 0 16px;padding:0">',
            '<li>' + _('Enable: turns off all status LEDs, sets crons for daily schedule') + '</li>',
            '<li>' + _('If current time is inside the night window, LEDs turn off immediately') + '</li>',
            '<li>' + _('Disable: clears crons, restores LED service') + '</li>',
            '<li>' + _('Power LED stays on solid. Phone LED slow-blinks during night') + '</li>',
            '</ul></div>'
        ].join('');

        /* ══════════════════════════════════════════════════════════════════
         * TAB: About
         * ══════════════════════════════════════════════════════════════════ */
        o = s.taboption('about', form.DummyValue, '_about_ui', '');
        o.rawhtml = true;
        o.default = [
            '<div style="max-width:480px">',
            '<h5 style="margin:0 0 4px">AW1000 LED Status</h5>',
            '<p style="color:#888;font-size:12px;margin:0 0 16px">LED controller for the Arcadyan AW1000 router on OpenWrt.</p>',
            '<table style="width:100%;border-collapse:collapse;font-size:13px">',
            '<tr style="border-bottom:1px solid rgba(0,0,0,0.06)">',
            '<td style="padding:8px 0;color:#888;width:130px">Version</td>',
            '<td style="padding:8px 0;font-weight:600">1.0.0</td>',
            '</tr>',
            '<tr style="border-bottom:1px solid rgba(0,0,0,0.06)">',
            '<td style="padding:8px 0;color:#888">Developer</td>',
            '<td style="padding:8px 0;font-weight:600">NoobLk</td>',
            '</tr>',
            '<tr style="border-bottom:1px solid rgba(0,0,0,0.06)">',
            '<td style="padding:8px 0;color:#888">Repository</td>',
            '<td style="padding:8px 0"><a href="https://github.com/nooblk-98/luci-app-aw1k-led" target="_blank" style="color:#5e72e4;text-decoration:none">github.com/nooblk-98/luci-app-aw1k-led</a></td>',
            '</tr>',
            '<tr style="border-bottom:1px solid rgba(0,0,0,0.06)">',
            '<td style="padding:8px 0;color:#888">Issues / Support</td>',
            '<td style="padding:8px 0"><a href="https://github.com/nooblk-98/luci-app-aw1k-led/issues" target="_blank" style="color:#5e72e4;text-decoration:none">Open an issue</a></td>',
            '</tr>',
            '<tr>',
            '<td style="padding:8px 0;color:#888">License</td>',
            '<td style="padding:8px 0">GPL-3.0-or-later</td>',
            '</tr>',
            '</table>',
            '<p style="margin:20px 0 0;color:#bbb;font-size:12px">Made with ♥ for the OpenWrt community</p>',
            '</div>'
        ].join('');

        /* ════════════════════════════════════════════════════════════════════
         * RENDER + wire up interactive buttons
         * ════════════════════════════════════════════════════════════════════ */
        var callInitAction = rpc.declare({
            object: 'luci',
            method: 'setInitAction',
            params: ['name', 'action'],
            expect: { result: false }
        });

        var callNightEnable = rpc.declare({
            object: 'luci.aw1k-led',
            method: 'night_enable',
            expect: { '': {} }
        });

        var callNightDisable = rpc.declare({
            object: 'luci.aw1k-led',
            method: 'night_disable',
            expect: { '': {} }
        });

        return m.render().then(function(node) {

            window.awLkPick = function(el) {
                var key = el.dataset.key;
                node.querySelectorAll('[data-key="' + key + '"]').forEach(function(sw) {
                    sw.style.outline = ''; sw.style.outlineOffset = ''; sw.style.transform = '';
                });
                el.style.outline = '3px solid #5e72e4'; el.style.outlineOffset = '2px'; el.style.transform = 'scale(1.18)';
                var hexMap   = { off:'#222222',red:'#ff3030',green:'#22dd44',blue:'#3399ff',yellow:'#ffdd00',cyan:'#00eedd',magenta:'#dd44ff',white:'#ffffff' };
                var labelMap = { off:'Off',red:'Red',green:'Green',blue:'Blue',yellow:'Yellow',cyan:'Cyan',magenta:'Magenta',white:'White' };
                var p = node.querySelector('#aw1k-prev-' + key); if (p) p.style.background = hexMap[el.dataset.color] || '#888';
                var l = node.querySelector('#aw1k-lbl-'  + key); if (l) l.textContent = labelMap[el.dataset.color] || el.dataset.color;
            };

            /* ── Restart button ── */
            var restartBtn    = node.querySelector('#aw1k-restart-btn');
            var restartStatus = node.querySelector('#aw1k-restart-status');
            if (restartBtn) {
                restartBtn.addEventListener('click', function() {
                    restartBtn.disabled = true;
                    restartStatus.textContent = _('Restarting…');
                    restartStatus.style.color = '#888';
                    callInitAction('ledstatus', 'restart').then(function() {
                        restartStatus.textContent = _('Restarted successfully.');
                        restartStatus.style.color = '#2dce89';
                    }).catch(function(e) {
                        restartStatus.textContent = _('Error: ') + e.message;
                        restartStatus.style.color = '#f5365c';
                    }).finally(function() { restartBtn.disabled = false; });
                });
            }

            /* ── Night Mode buttons ── */
            var nightEnableBtn  = node.querySelector('#aw1k-night-enable-btn');
            var nightDisableBtn = node.querySelector('#aw1k-night-disable-btn');
            var nightStatus     = node.querySelector('#aw1k-night-status');

            function nightModeCall(rpcFn, successMsg) {
                nightEnableBtn.disabled  = true;
                nightDisableBtn.disabled = true;
                nightStatus.textContent  = _('Please wait…');
                nightStatus.style.color  = '#888';
                rpcFn().then(function() {
                    nightStatus.textContent = successMsg;
                    nightStatus.style.color = '#2dce89';
                }).catch(function(e) {
                    nightStatus.textContent = _('Error: ') + (e.message || e);
                    nightStatus.style.color = '#f5365c';
                }).finally(function() {
                    nightEnableBtn.disabled  = false;
                    nightDisableBtn.disabled = false;
                });
            }

            if (nightEnableBtn)  nightEnableBtn.addEventListener('click',  function() { nightModeCall(callNightEnable,  _('Night Mode enabled. Crons set.')); });
            if (nightDisableBtn) nightDisableBtn.addEventListener('click', function() { nightModeCall(callNightDisable, _('Night Mode disabled. LEDs restored.')); });

            return node;
        });
    },

    handleSave: function(ev) {
        /* Save color picker selections into UCI before the standard save */
        var COLOR_KEYS = [
            'color_5g_excellent','color_5g_good','color_5g_average','color_5g_poor','color_5g_none',
            'color_sig_excellent','color_sig_good','color_sig_average','color_sig_weak','color_sig_offline'
        ];
        COLOR_KEYS.forEach(function(k) {
            var sel = document.querySelector('[data-key="' + k + '"][style*="scale"]');
            if (sel) uci.set('ledstatus', 'settings', k, sel.dataset.color);
        });

        return view.prototype.handleSave.call(this, ev);
    },

    handleSaveApply: function(ev) {
        return this.handleSave(ev).then(function() {
            return ui.changes.apply();
        });
    },

    handleReset: function(ev) {
        var DEFAULTS = {
            color_5g_excellent:  'green',
            color_5g_good:       'blue',
            color_5g_average:    'yellow',
            color_5g_poor:       'magenta',
            color_5g_none:       'red',
            color_sig_excellent: 'green',
            color_sig_good:      'blue',
            color_sig_average:   'yellow',
            color_sig_weak:      'red',
            color_sig_offline:   'magenta'
        };
        Object.keys(DEFAULTS).forEach(function(k) {
            uci.set('ledstatus', 'settings', k, DEFAULTS[k]);
        });
        return view.prototype.handleReset.call(this, ev);
    }
});
