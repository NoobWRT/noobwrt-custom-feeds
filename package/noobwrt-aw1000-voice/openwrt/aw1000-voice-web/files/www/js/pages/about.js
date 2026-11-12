// SPDX-License-Identifier: GPL-2.0-only
// About: who made this, what it is built on, versions and license.
import { h, card, pageHeader, kv } from '../ui.js';

const REPO = 'https://github.com/nooblk-98/noobwrt-aw1000-voice';

const link = (href, text) => h('a', { href, target: '_blank', rel: 'noopener' }, text || href);

const BUILT_ON = [
	[ 'openwrt-aw1000-phone', 'https://github.com/Perz3us/openwrt-aw1000-phone', 'perz3us',
		'The RJ11 phone port: aw1000-fxs driver, fxsd, SIP service hooks' ],
	[ 'openwrt-modem-sip', 'https://github.com/Perz3us/openwrt-modem-sip', 'perz3us',
		'msipd, the SIP server for phones and apps on the LAN' ],
	[ 'PR #16, configurable PCM slots', 'https://github.com/Perz3us/openwrt-aw1000-phone/pull/16', 'NoobWRT',
		'Modem PCM slot settings in fxsd' ],
	[ 'openwrt-aw1000-voice-awvoice', 'https://github.com/Pr0Luci/openwrt-aw1000-voice-awvoice', 'Pr0Luci',
		'Ideas for the planned answering machine and line tools' ],
	[ 'spandsp', 'https://github.com/freeswitch/spandsp', 'Steve Underwood and contributors',
		'G.722 codec in msipd (LGPL-2.1)' ],
	[ 'LuCI luci-lib-uqr', 'https://github.com/openwrt/luci', 'OpenWrt project',
		'QR codes on the SIP page (Apache-2.0)' ]
];

export default async function about(ctx) {
	const v = ctx.info.versions || {};

	return h('div',
		pageHeader('About', 'Phone management for the Arcadyan AW1000 on NoobWRT.'),
		h('div', { class: 'stack' },
			card(null, h('div', { class: 'about-hero' },
				h('img', { src: 'favicon.svg', alt: '', width: 64, height: 64 }),
				h('div',
					h('h2', 'noobwrt-aw1000-voice'),
					h('p', { class: 'muted' }, 'The RJ11 phone port, SIP phones and SMS of the AW1000, with this management interface.'),
					h('div', { class: 'row-actions' },
						link(REPO, 'Source on GitHub'), h('span', { class: 'muted' }, '·'),
						link(REPO + '/issues', 'Report a problem'), h('span', { class: 'muted' }, '·'),
						link('https://github.com/nooblk-98/noobwrt-arcadyan-aw1k', 'NoobWRT firmware'))))),

			h('div', { class: 'grid grid-2' },
				card('Maintainer and developer',
					h('div', { class: 'person' },
						h('div', { class: 'avatar avatar-lg' }, 'L'),
						h('div',
							h('strong', 'Lahiru S Liyanage (NoobLK)'),
							h('div', { class: 'muted small' }, 'Maintainer of this repository and NoobWRT'))),
					h('p', { class: 'muted', style: { marginTop: '12px' } },
						'Developer of this management interface, SMS and SMS over SIP, alerts, line health, the combined feed and its NoobWRT integration.'),
					kv([
						[ 'GitHub', link('https://github.com/nooblk-98', '@nooblk-98') ],
						[ 'Telegram', link('https://t.me/itsme_nooblk', '@itsme_nooblk') ],
						[ 'Email', h('a', { href: 'mailto:liyanagelsofficial@gmail.com' }, 'liyanagelsofficial@gmail.com') ]
					])),
				card('Versions', kv([
					[ 'Web interface', v.web ],
					[ 'Phone service (fxsd)', v.fxsd ],
					[ 'Phone driver', v.driver ],
					[ 'SIP server (msipd)', v.msipd ],
					[ 'Router', ctx.info.hostname ]
				]),
					h('p', { class: 'muted small', style: { marginTop: '12px' } },
						'Tested on NoobWRT with ModemManager. Not tested with QModem.'))),

			card('Built on',
				h('p', { class: 'muted' }, 'This would not exist without the work of these people and projects. Thank you.'),
				h('div', { class: 'table-wrap' }, h('table', { class: 'table' },
					h('thead', h('tr', h('th', 'Project'), h('th', 'Author'), h('th', 'Used for'))),
					h('tbody', BUILT_ON.map(([name, url, who, what]) => h('tr',
						h('td', link(url, name)), h('td', who), h('td', { class: 'muted' }, what))))))),

			card('License',
				h('p', 'Free software under the GNU General Public License, version 2 (GPL-2.0). Every file keeps the copyright notice of the person who wrote it; the G.722 codec stays under LGPL-2.1.'),
				h('p', { class: 'muted small' }, link(REPO + '/blob/main/LICENSE', 'License text'), ' · ',
					link(REPO + '/blob/main/CREDITS.md', 'Credits, file by file')))));
}
