// SPDX-License-Identifier: GPL-2.0-only
// Schema-driven forms bound to UCI: one named section, or a list of sections.
//
// A field: { name, label, type, help, options: [[value, label]], placeholder,
//            default, min, max, validate(value, values), depends: { opt: value } }
// Types: text, number, select, toggle, list, days, time, date, password.

import { h, clear, icon, toast, modal, confirm, button, iconButton, empty, busy } from './ui.js';
import { uci } from './api.js';

export const DAYS = [ [ 'mon', 'Mon' ], [ 'tue', 'Tue' ], [ 'wed', 'Wed' ], [ 'thu', 'Thu' ], [ 'fri', 'Fri' ], [ 'sat', 'Sat' ], [ 'sun', 'Sun' ] ];

export const V = {
	phone: v => !v || /^\+?[0-9]{3,20}$/.test(v) || 'Enter a phone number',
	phoneRequired: v => (!!v && /^\+?[0-9]{3,20}$/.test(v)) || 'Enter a phone number',
	prefix: v => (!!v && /^\+?[0-9*#]{1,20}$/.test(v)) || 'Enter a number or the start of one',
	time: v => /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(v || '') || 'Enter a time like 22:00',
	optTime: v => !v || /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/.test(v) || 'Enter a time like 22:00',
	date: v => /^20[0-9]{2}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/.test(v || '') || 'Enter a date like 2026-12-31',
	optDate: v => !v || /^20[0-9]{2}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/.test(v) || 'Enter a date like 2026-12-31',
	starCode: v => !v || /^\*[0-9]{1,6}$/.test(v) || 'Enter a * and 1 to 6 digits',
	host: v => !v || /^[A-Za-z0-9.:_-]{1,253}$/.test(v) || 'Enter a host name or address',
	required: v => (v !== '' && v != null) || 'Required'
};

function rangeCheck(f, v) {
	if (v === '' || v == null)
		return true;
	if (!/^-?[0-9]+$/.test(String(v)))
		return 'Enter a whole number';
	if (f.min != null && +v < f.min) return 'At least ' + f.min;
	if (f.max != null && +v > f.max) return 'At most ' + f.max;
	return true;
}

function initial(f, values) {
	const v = values[f.name];

	if (v !== undefined)
		return v;
	if (f.type === 'list' || f.type === 'days')
		return f.default || [];
	return f.default !== undefined ? f.default : '';
}

function control(f, value, onchange) {
	const id = 'f-' + f.name + '-' + Math.random().toString(36).slice(2, 7);
	let el, get;

	switch (f.type) {
	case 'toggle':
		el = h('label', { class: 'switch' },
			h('input', { type: 'checkbox', id, checked: value === '1' || value === true, onchange }),
			h('span', { class: 'slider' }));
		get = () => el.querySelector('input').checked ? '1' : '0';
		break;
	case 'select':
		el = h('select', { id, onchange }, (f.options || []).map(([v, l]) => h('option', { value: v, selected: String(value) === String(v) }, l ?? v)));
		if (value !== '' && !(f.options || []).some(([v]) => String(v) === String(value)))
			el.appendChild(h('option', { value, selected: true }, value));
		get = () => el.value;
		break;
	case 'days': {
		const set = new Set(Array.isArray(value) ? value : String(value || '').split(/\s+/).filter(Boolean));
		el = h('div', { class: 'chips', id }, DAYS.map(([d, l]) => h('label', { class: 'chip' },
			h('input', { type: 'checkbox', value: d, checked: set.has(d), onchange }), h('span', l))));
		get = () => [ ...el.querySelectorAll('input:checked') ].map(i => i.value);
		break;
	}
	case 'list': {
		const items = (Array.isArray(value) ? value : (value ? [ value ] : [])).slice();
		const list = h('div', { class: 'list-items' });
		const input = h('input', { type: 'text', placeholder: f.placeholder || '', onkeydown: e => { if (e.key === 'Enter') { e.preventDefault(); addItem(); } } });
		const draw = () => clear(list, items.length ? items.map((it, i) => h('span', { class: 'tag' }, it,
			h('button', { type: 'button', 'aria-label': 'Remove ' + it, onclick: () => { items.splice(i, 1); draw(); onchange(); } }, '×'))) : h('span', { class: 'muted small' }, 'None'));
		const addItem = () => {
			const v = input.value.trim();
			if (!v) return;
			const ok = f.validateItem ? f.validateItem(v) : true;
			if (ok !== true) { toast(ok, 'error'); return; }
			if (!items.includes(v)) items.push(v);
			input.value = '';
			draw();
			onchange();
		};
		draw();
		el = h('div', { class: 'list-field', id }, list, h('div', { class: 'list-add' }, input, button('Add', { small: true, onclick: addItem })));
		get = () => items.slice();
		break;
	}
	default:
		el = h('input', {
			id,
			type: f.type === 'password' ? 'password' : f.type === 'number' ? 'number' : f.type === 'time' ? 'time' : f.type === 'date' ? 'date' : 'text',
			value: value ?? '',
			placeholder: f.placeholder || '',
			min: f.min, max: f.max,
			autocomplete: f.type === 'password' ? 'new-password' : 'off',
			oninput: onchange
		});
		if (f.datalist) {
			const dl = h('datalist', { id: id + '-dl' }, f.datalist.map(v => h('option', { value: v })));
			el.setAttribute('list', id + '-dl');
			el = h('span', { class: 'with-dl' }, el, dl);
			get = () => el.querySelector('input').value.trim();
		} else {
			get = () => el.value.trim();
		}
	}
	return { el, get, id };
}

// Render fields; returns { el, values(), validate() }.
export function fieldset(fields, values = {}) {
	const ctrls = {};
	const rows = {};
	const root = h('div', { class: 'form' });

	const refresh = () => {
		const cur = current();
		for (const f of fields) {
			if (!f.depends) continue;
			const show = Object.entries(f.depends).every(([k, want]) => {
				const v = cur[k];
				return Array.isArray(want) ? want.includes(v) : (want && want.not !== undefined ? v !== want.not : v === want);
			});
			rows[f.name].hidden = !show;
		}
	};
	const current = () => {
		const out = {};
		for (const f of fields)
			out[f.name] = ctrls[f.name].get();
		return out;
	};

	for (const f of fields) {
		if (f.type === 'heading') {
			root.appendChild(h('h3', { class: 'form-heading' }, f.label));
			ctrls[f.name] = { get: () => undefined };
			rows[f.name] = {};
			continue;
		}
		const c = control(f, initial(f, values), () => { refresh(); row.classList.remove('invalid'); });
		const err = h('div', { class: 'field-error' });
		const row = h('div', { class: 'field' + (f.type === 'toggle' ? ' field-toggle' : '') },
			h('label', { for: c.id, class: 'field-label' }, f.label),
			h('div', { class: 'field-control' }, c.el, f.help ? h('div', { class: 'field-help' }, f.help) : null, err));
		row._err = err;
		ctrls[f.name] = c;
		rows[f.name] = row;
		root.appendChild(row);
	}
	refresh();

	return {
		el: root,
		values: () => {
			const out = current();
			for (const f of fields)
				if (f.type === 'heading' || rows[f.name].hidden) delete out[f.name];
			return out;
		},
		validate: () => {
			const cur = current();
			let ok = true;
			for (const f of fields) {
				if (f.type === 'heading' || rows[f.name].hidden) continue;
				let r = f.type === 'number' ? rangeCheck(f, cur[f.name]) : true;
				if (r === true && f.validate) r = f.validate(cur[f.name], cur);
				rows[f.name].classList.toggle('invalid', r !== true);
				rows[f.name]._err.textContent = r === true ? '' : r;
				if (r !== true && ok) {
					ok = false;
					rows[f.name].querySelector('input, select')?.focus();
				}
			}
			return ok;
		}
	};
}

// One UCI section edited in place, with a Save button.
export function sectionForm({ config, section, fields, values, onsaved, saveLabel = 'Save' }) {
	const fs = fieldset(fields, values);
	const save = button(saveLabel, { kind: 'primary', icon: 'check', onclick: async () => {
		if (!fs.validate()) return;
		await busy(save, async () => {
			await uci.save(config, section, fs.values());
			await uci.commit(config);
			onsaved && await onsaved();
		}, 'Saved');
	} });

	return h('div', { class: 'section-form' }, fs.el, h('div', { class: 'form-actions' }, save));
}

// A list of UCI sections of one type: table + add/edit dialog + delete.
// columns: [{ label, render(section) }]
export function gridEditor({ config, type, title, fields, columns, max, emptyText, toggle = 'enabled', addLabel = 'Add', onchange, defaults = {} }) {
	const root = h('div', { class: 'grid-editor' });
	let rows = [];

	const reload = async () => {
		rows = await uci.sections(config, type);
		draw();
	};

	const commit = async () => {
		await uci.commit(config);
		onchange && await onchange();
		await reload();
	};

	const edit = (sec) => {
		const fs = fieldset(fields, sec || defaults);
		modal({
			title: (sec ? 'Edit ' : addLabel + ' ') + title.toLowerCase(),
			body: fs.el,
			actions: [
				{ label: 'Cancel' },
				{ label: 'Save', kind: 'primary', onclick: async () => {
					if (!fs.validate()) return false;
					const vals = fs.values();
					if (sec) {
						await uci.save(config, sec['.name'], vals);
					} else {
						const set = {};
						for (const [k, v] of Object.entries(vals))
							if (v !== '' && !(Array.isArray(v) && !v.length)) set[k] = v;
						await uci.add(config, type, set);
					}
					await commit();
					toast('Saved');
				} }
			]
		});
	};

	const del = async (sec) => {
		if (!await confirm('Delete ' + title.toLowerCase(), 'Delete "' + (sec.name || sec.number || sec['.name']) + '"?'))
			return;
		await uci.remove(config, sec['.name']);
		await commit();
		toast('Deleted');
	};

	const flip = async (sec, input) => {
		await busy(input, async () => {
			await uci.set(config, sec['.name'], { [toggle]: input.checked ? '1' : '0' });
			await commit();
		});
	};

	const draw = () => {
		const full = max && rows.length >= max;
		const addBtn = button(addLabel, { kind: 'primary', icon: 'add', small: true, disabled: full, onclick: () => edit(null) });
		const hasToggle = fields.some(f => f.name === toggle && f.type === 'toggle');

		clear(root,
			h('div', { class: 'grid-head' },
				h('span', { class: 'muted small' }, rows.length + (max ? ' of ' + max : '') + ' ' + (rows.length === 1 ? 'entry' : 'entries')),
				addBtn),
			rows.length ? h('div', { class: 'table-wrap' }, h('table', { class: 'table' },
				h('thead', h('tr', hasToggle ? h('th', { class: 'col-toggle' }, 'On') : null, columns.map(c => h('th', c.label)), h('th', { class: 'col-actions' }, ''))),
				h('tbody', rows.map(sec => h('tr', { class: hasToggle && sec[toggle] === '0' ? 'row-off' : '' },
					hasToggle ? h('td', { class: 'col-toggle' }, h('label', { class: 'switch switch-sm' },
						h('input', { type: 'checkbox', checked: sec[toggle] !== '0', onchange: e => flip(sec, e.target) }), h('span', { class: 'slider' }))) : null,
					columns.map(c => h('td', { 'data-label': c.label }, c.render(sec))),
					h('td', { class: 'col-actions' },
						iconButton('edit', 'Edit', () => edit(sec)),
						iconButton('trash', 'Delete', () => del(sec), 'danger'))))))) :
				empty(emptyText || 'Nothing here yet.', 'add'));
	};

	root.appendChild(h('div', { class: 'loading' }, 'Loading…'));
	reload().catch(e => clear(root, h('div', { class: 'alert alert-error' }, e.message)));
	root.reload = reload;
	return root;
}

export function daysText(days) {
	const set = Array.isArray(days) ? days : String(days || '').split(/\s+/).filter(Boolean);
	if (set.length === 7) return 'Every day';
	if (set.join(' ') === 'mon tue wed thu fri') return 'Weekdays';
	if (set.join(' ') === 'sat sun') return 'Weekends';
	return DAYS.filter(([d]) => set.includes(d)).map(([, l]) => l).join(', ') || '—';
}

export { icon };
