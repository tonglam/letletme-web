import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const projectRoot = join(scriptDir, '..')
const assetRoot = join(projectRoot, 'public', 'images', 'squad-pitch')
const kitRoot = join(assetRoot, 'kits')
const legacyBadgeRoot = join(assetRoot, 'badges')
const previewRoot = join(projectRoot, 'artifacts', 'squad-pitch-assets')

const teams = [
	{
		code: 'ARS',
		name: 'Arsenal',
		home: {
			primary: '#d81830', secondary: '#f6f1e8', accent: '#741129', detail: '#163b70', pattern: 'sleeves',
			description: 'Rich red body, crisp white sleeves, and darker red architectural trim.',
			source: 'https://www.fourfourtwo.com/products-kit/arsenal-home-kit-2026-27', status: 'reported',
		},
		away: {
			primary: '#101a43', secondary: '#f5d22e', accent: '#c51f3c', detail: '#f5d22e', pattern: 'zigzag',
			description: 'Deep navy with a tonal geometric zigzag and vivid yellow-red trim.',
			source: 'https://www.adidas.com/us/arsenal-fc-26-27-away-authentic-jersey/JZ3161.html', status: 'official',
		},
	},
	{
		code: 'AVL',
		name: 'Aston Villa',
		home: {
			primary: '#581733', secondary: '#401025', accent: '#9fd3eb', detail: '#f4d35e', pattern: 'solid-texture',
			description: 'A clean all-claret look with restrained sky-blue edge details.',
			source: 'https://www.avfc.co.uk/news/2026/may/26/news-aston-villa-and-adidas-unveil-2026-27-home-kit/', status: 'official',
		},
		away: {
			primary: '#101112', secondary: '#29252a', accent: '#c9a34a', detail: '#6f183c', pattern: 'geometry',
			description: 'Black with a deep tonal geometry and restrained antique-gold and claret trim.',
			source: 'https://www.footyheadlines.com/2025/11/aston-villa-26-27-away-kit.html', status: 'reported',
		},
	},
	{
		code: 'BOU',
		name: 'Bournemouth',
		home: {
			primary: '#d7192d', secondary: '#111315', accent: '#e8b84a', detail: '#f5f1e9', pattern: 'stripes',
			description: 'Wide red-and-black vertical stripes with a faint heritage texture.',
			source: 'https://superstore.afcb.co.uk/products/mens-home-shirt-26-27-red-black', status: 'official',
		},
		away: {
			primary: '#5b2579', secondary: '#37144f', accent: '#f5f1e9', detail: '#a66ccc', pattern: 'zigzag',
			description: 'Purple with bold retro zigzags and bright white collar details.',
			source: 'https://www.footyheadlines.com/8363495290/no-more-umbro-hummel-bournemouth-26-27-away-kit-released.html', status: 'reported',
		},
	},
	{
		code: 'BRE',
		name: 'Brentford',
		home: {
			primary: '#df1b2f', secondary: '#f5f2e9', accent: '#f0b82c', detail: '#17191d', pattern: 'stripes',
			description: 'Red-and-white stripes with honey-yellow collar and cuff details.',
			source: 'https://www.brentfordfc.com/en/news/article/club-news-always-twogether-brentford-launches-2026-28-home-kit', status: 'official',
		},
		away: {
			primary: '#14233e', secondary: '#eee2c6', accent: '#eee2c6', detail: '#b79f75', pattern: 'pinstripes',
			description: 'Tailored navy and cream pinstripes with a cream crew-neck trim.',
			source: 'https://www.brentfordfc.com/en/news/article/club-news-tailored-for-the-game-brentford-launches-2026-27-away-kit', status: 'official',
		},
	},
	{
		code: 'BHA',
		name: 'Brighton',
		home: {
			primary: '#125eb5', secondary: '#f4f1e9', accent: '#f4f1e9', detail: '#f3cf3f', pattern: 'pinstripes',
			description: 'Royal blue with crisp white pinstripes and a white neckline.',
			source: 'https://www.brightonandhovealbion.com/media-article/a-nod-to-1983-for-2026-27', status: 'official',
		},
		away: {
			primary: '#f5f2ea', secondary: '#125eb5', accent: '#125eb5', detail: '#f3cf3f', pattern: 'pinstripes',
			description: 'The home structure inverted: white with royal-blue pinstripes.',
			source: 'https://www.brightonandhovealbion.com/media-article/a-nod-to-1983-for-2026-27', status: 'official',
		},
	},
	{
		code: 'CHE',
		name: 'Chelsea',
		home: {
			primary: '#1649a8', secondary: '#0d337d', accent: '#c8a250', detail: '#f5f1e8', pattern: 'tonal-grid',
			description: 'Two-tone bright blue woven geometry with restrained gold accents.',
			source: 'https://www.chelseafc.com/en/news/article/lion-takes-pride-of-place-as-new-chelsea-home-kit-set-loose', status: 'official',
		},
		away: {
			primary: '#0b0b0d', secondary: '#2a251c', accent: '#c8a250', detail: '#e0c577', pattern: 'tonal-grid',
			description: 'Black with a low-contrast laurel-like weave and metallic gold trim.',
			source: 'https://www.chelseafc.com/en/news/article/2026-27-chelsea-away-kit-is-unveiled', status: 'official',
		},
	},
	{
		code: 'COV',
		name: 'Coventry City',
		home: {
			primary: '#2d86bf', secondary: '#f1f8fb', accent: '#17385d', detail: '#69b5dc', pattern: 'stripes',
			description: 'Bold sky-blue and white stripes with fine navy pinstripe details.',
			source: 'https://www.ccfcstore.com/kit/home-kit/mens/4370_coventry-city-adult-2627-ss-home-shirt.html', status: 'official',
		},
		away: {
			primary: '#f0eadc', secondary: '#d5cdbf', accent: '#ff655f', detail: '#182c47', pattern: 'geometry',
			description: 'Warm off-white with angular tonal panels, navy, and hot-coral piping.',
			source: 'https://www.bnppre.net/new-kits/coventry-city-jersey-26-27-away-hummel.html?ml=1', status: 'reported',
		},
	},
	{
		code: 'CRY',
		name: 'Crystal Palace',
		home: {
			primary: '#f5f2e9', secondary: '#d0273d', accent: '#1e438d', detail: '#f1cb3f', pattern: 'sash',
			description: 'White with a red-and-blue sash descending from viewer-right to viewer-left.',
			source: 'https://about.macron.com/en/news/kit-launches/crystal-palace-eagle-sash-kit-2026-27/', status: 'official',
		},
		away: {
			primary: '#111214', secondary: '#c92740', accent: '#2351a0', detail: '#f2d14a', pattern: 'feathers',
			description: 'Black with tonal feather shapes and sharp red-blue edge panels.',
			source: 'https://www.footyheadlines.com/5144833225/crystal-palace-26-27-eagle-black-away-kit-released.html', status: 'reported',
		},
	},
	{
		code: 'EVE',
		name: 'Everton',
		home: {
			primary: '#17479d', secondary: '#103678', accent: '#f5f2ea', detail: '#f0c948', pattern: 'solid-texture',
			description: 'Royal blue with clean white collar and subtle yellow highlights.',
			source: 'https://www.footballkitarchive.com/everton-fc-2026-27-home-kit-491885/', status: 'reported',
		},
		away: {
			primary: '#f5f2e9', secondary: '#172c4d', accent: '#e1a72c', detail: '#172c4d', pattern: 'pinstripes',
			description: 'White with alternating navy and amber pinstripes and dark cuffs.',
			source: 'https://store.evertonfc.com/en/everton-castore-away-pro-shirt-2026-27/p-130069382256681586+z-92-2590427606', status: 'official',
		},
	},
	{
		code: 'FUL',
		name: 'Fulham',
		home: {
			primary: '#f5f2ea', secondary: '#17191b', accent: '#c81d35', detail: '#d9d6cf', pattern: 'plain',
			description: 'Clean white body with its red-trimmed collar retained and no chest graphic.',
			source: 'https://www.fulhamfc.com/news/2026/july/23/26-27-home-kit-revealed/', status: 'official',
		},
		away: {
			primary: '#c91e35', secondary: '#151719', accent: '#f5f2e9', detail: '#841126', pattern: 'checker',
			description: 'A compact red-and-black checkerboard inspired by early-1990s change kits.',
			source: 'https://www.footyheadlines.com/5917078515/exclusive-fulham-26-27-away-kit-design-leaked.html', status: 'reported',
		},
	},
	{
		code: 'HUL',
		name: 'Hull City',
		home: {
			primary: '#ef9d22', secondary: '#151719', accent: '#f4f1e8', detail: '#ef9d22', pattern: 'stripes',
			description: 'Wide amber-and-black stripes with a bright fold-over collar.',
			source: 'https://www.footballshirtculture.com/new-kits/hull-city-jersey-26-27-home-oxen.html?ml=1', status: 'reported',
		},
		away: {
			primary: '#f4f1e9', secondary: '#151719', accent: '#ee9a21', detail: '#151719', pattern: 'shoulder-bars',
			description: 'White with black-and-amber shoulder bars, collar, and cuff bands.',
			source: 'https://www.oxensports.com/blogs/oxen-news/hull-city-2026-27-away-kit', status: 'official',
		},
	},
	{
		code: 'IPS',
		name: 'Ipswich Town',
		home: {
			primary: '#194b91', secondary: '#12366f', accent: '#f3f0e8', detail: '#dd3443', pattern: 'geometry',
			description: 'Royal blue with restrained tonal geometry and no chest chevron.',
			source: 'https://shop.itfc.co.uk/products/2627-adult-home-shirt-ss-blue', status: 'official',
		},
		away: {
			primary: '#eee2ad', secondary: '#17191b', accent: '#d7273c', detail: '#17191b', pattern: 'horizontal-pinstripes',
			description: 'Cream-yellow with fine black-and-red horizontal pinstripes.',
			source: 'https://www.itfc.co.uk/news/2026/july/03/2026-27-kits-revealed/', status: 'official',
		},
	},
	{
		code: 'LEE',
		name: 'Leeds United',
		home: {
			primary: '#f5f2e9', secondary: '#184a9b', accent: '#f0cf38', detail: '#184a9b', pattern: 'horizontal-pinstripes',
			description: 'White with understated blue-and-yellow horizontal pinstripes.',
			source: 'https://shop.leedsunited.com/en/x-9595', status: 'official',
		},
		away: {
			primary: '#f1cf28', secondary: '#ddbc1f', accent: '#17284a', detail: '#f5f2e9', pattern: 'solid-texture',
			description: 'EQT yellow with night-navy details and a crisp white accent.',
			source: 'https://www.leedsunited.com/en/news/leeds-united-unveil-adidas-away-kit-for-2627-season', status: 'official',
		},
	},
	{
		code: 'LIV',
		name: 'Liverpool',
		home: {
			primary: '#aa1d35', secondary: '#81152a', accent: '#f4eee3', detail: '#c94c60', pattern: 'plain',
			description: 'Simplified deep-red body with light collar trim and no chest graphic.',
			source: 'https://www.liverpoolfc.com/news/lfc-and-adidas-unveil-2026-27-home-kit-inspired-iconic-title-winning-season?amp=1', status: 'official',
		},
		away: {
			primary: '#f3f1eb', secondary: '#c7c5c0', accent: '#b91f3a', detail: '#25282b', pattern: 'ticket-grid',
			description: 'Clean white with grey ticket-grid geometry and restrained red details.',
			source: 'https://www.liverpoolfc.com/news/liverpool-fc-officially-unveils-new-adidas-away-kit-2026-27/', status: 'official',
		},
	},
	{
		code: 'MCI',
		name: 'Manchester City',
		home: {
			primary: '#72c5e8', secondary: '#3e8fb7', accent: '#e7edf0', detail: '#6c2d4d', pattern: 'gradient',
			description: 'A full sky-blue gradient, darker at the shoulders and lighter below.',
			source: 'https://www.mancity.com/news/club/manchester-city-202627-home-kit-launched-63914816', status: 'official',
		},
		away: {
			primary: '#111315', secondary: '#e7bd36', accent: '#f0c940', detail: '#f4efe1', pattern: 'bee',
			description: 'Black with an abstract worker-bee field and strong yellow accents.',
			source: 'https://shop.mancity.com/gb/en/manchester-city-away-jersey-2026-27/701242828-pumablack-flaxen.html', status: 'official',
		},
	},
	{
		code: 'MUN',
		name: 'Manchester United',
		home: {
			primary: '#c91a2c', secondary: '#a71323', accent: '#151719', detail: '#f4f1e9', pattern: 'solid-texture',
			description: 'Classic red with bold black-and-white collar and cuff bands.',
			source: 'https://footykitsbattle.com/manchester-united-kit-2026-27/', status: 'reported',
		},
		away: {
			primary: '#1758a6', secondary: '#103c79', accent: '#d82731', detail: '#f4f1e9', pattern: 'waves',
			description: 'Royal blue with a tonal river-wave field and red-white V trim.',
			source: 'https://www.manutd.com/en/news/out-now-2026-27-adidas-away-kit', status: 'official',
		},
	},
	{
		code: 'NEW',
		name: 'Newcastle United',
		home: {
			primary: '#151719', secondary: '#f4f1e8', accent: '#52b9d8', detail: '#151719', pattern: 'disrupted-stripes',
			description: 'Black-and-white stripes broken into offset blocks with blue energy trim.',
			source: 'https://www.newcastleunited.com/en/news/newcastle-united-and-adidas-unveil-2026-27-home-kit', status: 'official',
		},
		away: {
			primary: '#0c1932', secondary: '#17315a', accent: '#f3f1e9', detail: '#4c6f9b', pattern: 'castle',
			description: 'Deep night navy with a low-contrast, castle-like architectural field.',
			source: 'https://www.newcastleunited.com/en/news/introducing-our-2026-27-adidas-away-kit', status: 'official',
		},
	},
	{
		code: 'NFO',
		name: 'Nottingham Forest',
		home: {
			primary: '#c82d36', secondary: '#8f2029', accent: '#f3efe6', detail: '#df5961', pattern: 'mist',
			description: 'Layered shades of red with a soft mist-like tonal graphic.',
			source: 'https://shop.nottinghamforest.co.uk/products/nffc-26-27-home-shirt', status: 'official',
		},
		away: {
			primary: '#173c31', secondary: '#275a45', accent: '#d52232', detail: '#f3efe6', pattern: 'leaves',
			description: 'Dark green with abstract leaf shapes, red trim, and light details.',
			source: 'https://www.reddit.com/r/nffc/comments/1vjjw4t/new_away_shirt/', status: 'reported',
		},
	},
	{
		code: 'SUN',
		name: 'Sunderland',
		home: {
			primary: '#d8222c', secondary: '#f4f0e8', accent: '#d8222c', detail: '#151719', pattern: 'stripes',
			description: 'Red-and-white stripes with a faint heritage jacquard and red shoulders.',
			source: 'https://www.safcstore.com/en/x-9581', status: 'official',
		},
		away: {
			primary: '#ef9ac3', secondary: '#161719', accent: '#161719', detail: '#f4f0e8', pattern: 'yoke',
			description: 'Pink with a black shoulder yoke and restrained mid-century geometry.',
			source: 'https://www.footballkitarchive.com/sunderland-afc-2026-27-away-kit-490451/', status: 'reported',
		},
	},
	{
		code: 'TOT',
		name: 'Tottenham Hotspur',
		home: {
			primary: '#f6f3eb', secondary: '#16213e', accent: '#16213e', detail: '#68c7e9', pattern: 'plain',
			description: 'Simplified lilywhite body with its navy collar retained and no chest graphic.',
			source: 'https://www.footyheadlines.com/2025/08/tottenham-26-27-home-kit.html', status: 'reported',
		},
		away: {
			primary: '#111b38', secondary: '#ff713d', accent: '#ff5fa2', detail: '#5d3d91', pattern: 'flow',
			description: 'Deep navy crossed by flowing iridescent orange-and-pink bands.',
			source: 'https://www.tottenhamhotspur.com/news/1074152/gallery-new-nike-202627-away-kit-up-close', status: 'official',
		},
	},
]

const fplHomeReferences = {
	ARS: { teamId: 3, sampledColours: ['#d81830', '#f0f0f0'] },
	AVL: { teamId: 7, sampledColours: ['#481830', '#c0d8f0'] },
	BOU: { teamId: 91, sampledColours: ['#303030', '#d81830'] },
	BRE: { teamId: 94, sampledColours: ['#f0f0f0', '#d81830'] },
	BHA: { teamId: 36, sampledColours: ['#1860c0', '#f0f0f0'] },
	CHE: { teamId: 8, sampledColours: ['#184890'] },
	COV: { teamId: 9, sampledColours: ['#ffffff', '#1860a8'] },
	CRY: { teamId: 31, sampledColours: ['#f0f0f0', '#184878', '#d81830'] },
	EVE: { teamId: 11, sampledColours: ['#184890'] },
	FUL: { teamId: 54, sampledColours: ['#f0f0f0', '#000000'] },
	HUL: { teamId: 88, sampledColours: ['#f09000', '#181818'] },
	IPS: { teamId: 40, sampledColours: ['#183078', '#184890'] },
	LEE: { teamId: 2, sampledColours: ['#ffffff'] },
	LIV: { teamId: 14, sampledColours: ['#a81830'] },
	MCI: { teamId: 43, sampledColours: ['#78c0d8', '#d8f0f0'] },
	MUN: { teamId: 1, sampledColours: ['#c00030'] },
	NEW: { teamId: 4, sampledColours: ['#181818', '#ffffff'] },
	NFO: { teamId: 17, sampledColours: ['#c03030', '#a83030'] },
	SUN: { teamId: 56, sampledColours: ['#d81818', '#ffffff'] },
	TOT: { teamId: 6, sampledColours: ['#f0f0f0'] },
}

const shirtPath = [
	'M86 18',
	'C96 24 106 27 120 27',
	'C134 27 144 24 154 18',
	'L188 30',
	'Q194 32 198 38',
	'L223 72',
	'L190 99',
	'L170 76',
	'L170 207',
	'H70',
	'V76',
	'L50 99',
	'L17 72',
	'L42 38',
	'Q46 32 52 30',
	'Z',
].join(' ')

const leftSleeve = 'M15 68 L42 36 L88 19 L80 82 L50 102 Z'
const rightSleeve = 'M152 19 L198 36 L225 68 L190 102 L160 82 Z'

function escapeXml(value) {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
}

function verticalStripes(primary, secondary, width = 18) {
	const blocks = []
	for (let x = 56, index = 0; x < 184; x += width, index += 1) {
		blocks.push(`<rect x="${x}" y="10" width="${width}" height="204" fill="${index % 2 === 0 ? primary : secondary}"/>`)
	}
	return blocks.join('')
}

function verticalPinstripes(colours) {
	return Array.from({ length: 9 }, (_, index) => {
		const x = 78 + index * 10.5
		return `<rect x="${x}" y="24" width="2.4" height="184" rx="1.2" fill="${colours[index % colours.length]}" opacity="0.82"/>`
	}).join('')
}

function patternMarkup(kit, id) {
	const { primary, secondary, accent, detail, pattern } = kit
	if (pattern === 'plain') {
		return `<rect width="240" height="220" fill="${primary}"/>`
	}
	if (pattern === 'solid-texture') {
		return `
			<rect width="240" height="220" fill="${primary}"/>
			<path d="M42 52 L91 27 L176 194 M18 102 L121 31 L210 128 M52 206 L188 95" fill="none" stroke="${secondary}" stroke-width="17" opacity="0.28"/>
			<path d="${leftSleeve}" fill="${primary}"/><path d="${rightSleeve}" fill="${primary}"/>
			<path d="M20 75 L51 98 M220 75 L189 98" stroke="${accent}" stroke-width="7"/>
		`
	}
	if (pattern === 'sleeves') {
		return `
			<rect x="68" y="14" width="104" height="198" fill="${primary}"/>
			<path d="${leftSleeve}" fill="${secondary}"/><path d="${rightSleeve}" fill="${secondary}"/>
			<path d="M65 63 L78 67 L78 199 L68 199 Z M175 63 L162 67 L162 199 L172 199 Z" fill="${accent}" opacity="0.94"/>
		`
	}
	if (pattern === 'stripes') {
		return `
			${verticalStripes(primary, secondary, 19)}
			<path d="${leftSleeve}" fill="${primary}"/><path d="${rightSleeve}" fill="${primary}"/>
			<path d="M18 71 L47 38 L60 33 L52 88 Z M222 71 L193 38 L180 33 L188 88 Z" fill="${secondary}" opacity="0.92"/>
		`
	}
	if (pattern === 'pinstripes') {
		return `
			<rect width="240" height="220" fill="${primary}"/>
			${verticalPinstripes([secondary, secondary, detail])}
			<path d="${leftSleeve}" fill="${primary}"/><path d="${rightSleeve}" fill="${primary}"/>
			<path d="M18 72 L50 98 M190 98 L222 72" fill="none" stroke="${accent}" stroke-width="6"/>
		`
	}
	if (pattern === 'sash') {
		return `
			<rect width="240" height="220" fill="${primary}"/>
			<path d="M162 14 H198 L89 214 H48 Z" fill="${secondary}"/>
			<path d="M157 14 H173 L59 214 H41 Z" fill="${accent}"/>
			<path d="M183 14 H189 L74 214 H67 Z" fill="${detail}" opacity="0.42"/>
			<path d="${leftSleeve}" fill="${primary}"/><path d="${rightSleeve}" fill="${primary}"/>
		`
	}
	if (pattern === 'tonal-grid') {
		const cells = []
		for (let row = 0; row < 7; row += 1) {
			for (let col = 0; col < 5; col += 1) {
				if ((row + col) % 2 === 0) cells.push(`<path d="M${54 + col * 31} ${24 + row * 28} h31 l-15.5 28 h-31 Z" fill="${secondary}" opacity="0.34"/>`)
			}
		}
		return `<rect width="240" height="220" fill="${primary}"/>${cells.join('')}<path d="${leftSleeve}" fill="${primary}"/><path d="${rightSleeve}" fill="${primary}"/><path d="M20 75 L51 98 M220 75 L189 98" stroke="${detail}" stroke-width="4" opacity="0.75"/>`
	}
	if (pattern === 'zigzag') {
		return `<rect width="240" height="220" fill="${primary}"/><path d="M24 56 L72 30 L104 56 L137 30 L189 57 L217 42 V73 L188 88 L137 62 L104 88 L72 62 L24 88 Z" fill="${secondary}" opacity="0.38"/><path d="M25 124 L72 98 L104 124 L137 98 L188 124 L216 109 V139 L188 155 L137 129 L104 155 L72 129 L25 155 Z" fill="${secondary}" opacity="0.25"/><path d="M40 187 L84 163 L119 188 L156 162 L204 188" fill="none" stroke="${accent}" stroke-width="7" opacity="0.8"/><path d="${leftSleeve}" fill="${primary}"/><path d="${rightSleeve}" fill="${primary}"/><path d="M18 72 L50 98 M190 98 L222 72" stroke="${detail}" stroke-width="5"/>`
	}
	if (pattern === 'geometry') {
		return `<rect width="240" height="220" fill="${primary}"/><path d="M45 30 L115 30 L77 102 Z M117 30 H196 L159 104 Z M80 106 L121 35 L160 106 L121 178 Z M44 192 L79 111 L119 192 Z M124 192 L161 111 L199 192 Z" fill="${secondary}" opacity="0.34"/><path d="M19 73 L50 98 M221 73 L190 98" stroke="${detail}" stroke-width="5"/>`
	}
	if (pattern === 'feathers') {
		const feathers = Array.from({ length: 12 }, (_, index) => {
			const col = index % 4
			const row = Math.floor(index / 4)
			const x = 55 + col * 42 + (row % 2) * 11
			const y = 38 + row * 58
			return `<path d="M${x} ${y + 26} Q${x + 19} ${y - 7} ${x + 34} ${y + 4} Q${x + 26} ${y + 29} ${x} ${y + 26} Z" fill="${index % 2 === 0 ? secondary : accent}" opacity="0.24"/>`
		}).join('')
		return `<rect width="240" height="220" fill="${primary}"/>${feathers}<path d="${leftSleeve}" fill="${primary}"/><path d="${rightSleeve}" fill="${primary}"/><path d="M18 71 L50 98" stroke="${secondary}" stroke-width="8"/><path d="M222 71 L190 98" stroke="${accent}" stroke-width="8"/>`
	}
	if (pattern === 'checker') {
		const cells = []
		for (let row = 0; row < 7; row += 1) {
			for (let col = 0; col < 5; col += 1) {
				if ((row + col) % 2 === 0) cells.push(`<rect x="${55 + col * 27}" y="${23 + row * 27}" width="27" height="27" fill="${secondary}" opacity="0.78"/>`)
			}
		}
		return `<rect width="240" height="220" fill="${primary}"/>${cells.join('')}<path d="${leftSleeve}" fill="${secondary}"/><path d="${rightSleeve}" fill="${secondary}"/><path d="M18 72 L50 98 M190 98 L222 72" stroke="${accent}" stroke-width="6"/>`
	}
	if (pattern === 'waves') {
		return `<rect width="240" height="220" fill="${primary}"/><path d="M34 58 Q69 26 104 58 T174 58 T244 58 M20 103 Q55 71 90 103 T160 103 T230 103 M12 151 Q47 119 82 151 T152 151 T222 151 M0 195 Q35 163 70 195 T140 195 T210 195" fill="none" stroke="${secondary}" stroke-width="9" opacity="0.3"/><path d="M20 77 Q55 45 90 77 T160 77 T230 77 M12 171 Q47 139 82 171 T152 171 T222 171" fill="none" stroke="${accent}" stroke-width="4" opacity="0.76"/><path d="${leftSleeve}" fill="${primary}"/><path d="${rightSleeve}" fill="${primary}"/><path d="M18 72 L50 98 M190 98 L222 72" stroke="${detail}" stroke-width="5"/>`
	}
	if (pattern === 'shoulder-bars') {
		return `<rect width="240" height="220" fill="${primary}"/><path d="M34 31 L93 18 L83 36 L25 52 Z M206 31 L147 18 L157 36 L215 52 Z" fill="${secondary}"/><path d="M27 48 L83 31 M213 48 L157 31" stroke="${accent}" stroke-width="7"/><path d="M20 75 L51 98 M220 75 L189 98" stroke="${secondary}" stroke-width="9"/>`
	}
	if (pattern === 'horizontal-pinstripes') {
		const lines = Array.from({ length: 10 }, (_, index) => {
			const y = 34 + index * 17
			return `<path d="M57 ${y} H183" stroke="${index % 2 === 0 ? secondary : accent}" stroke-width="${index % 2 === 0 ? 2.4 : 1.4}" opacity="${index % 2 === 0 ? 0.78 : 0.9}"/>`
		}).join('')
		return `<rect width="240" height="220" fill="${primary}"/>${lines}<path d="${leftSleeve}" fill="${primary}"/><path d="${rightSleeve}" fill="${primary}"/><path d="M18 72 L50 98 M190 98 L222 72" stroke="${detail}" stroke-width="6"/>`
	}
	if (pattern === 'ticket-grid') {
		return `<rect width="240" height="220" fill="${primary}"/><path d="M55 45 H185 M55 75 H185 M55 105 H185 M55 135 H185 M55 165 H185 M76 22 V205 M108 22 V205 M140 22 V205 M172 22 V205" stroke="${secondary}" stroke-width="2" stroke-dasharray="7 5" opacity="0.62"/><path d="M63 193 L179 34" stroke="${accent}" stroke-width="7" opacity="0.72"/><path d="${leftSleeve}" fill="${primary}"/><path d="${rightSleeve}" fill="${primary}"/><path d="M18 72 L50 98 M190 98 L222 72" stroke="${detail}" stroke-width="4"/>`
	}
	if (pattern === 'gradient') {
		return `<defs><linearGradient id="${id}-kit-gradient" x1="0" y1="0" x2="0" y2="1"><stop stop-color="${secondary}"/><stop offset="0.45" stop-color="${primary}"/><stop offset="1" stop-color="#b9e5f4"/></linearGradient></defs><rect width="240" height="220" fill="url(#${id}-kit-gradient)"/><path d="M24 43 Q120 86 216 43" fill="none" stroke="${accent}" stroke-width="3" opacity="0.5"/><path d="${leftSleeve}" fill="${secondary}" opacity="0.72"/><path d="${rightSleeve}" fill="${secondary}" opacity="0.72"/><path d="M18 72 L50 98 M190 98 L222 72" stroke="${detail}" stroke-width="4" opacity="0.85"/>`
	}
	if (pattern === 'bee') {
		const hexes = []
		for (let row = 0; row < 6; row += 1) {
			for (let col = 0; col < 5; col += 1) {
				const x = 55 + col * 31 + (row % 2) * 15.5
				const y = 30 + row * 31
				hexes.push(`<path d="M${x} ${y} l12 -7 l12 7 v14 l-12 7 l-12 -7 Z" fill="none" stroke="${secondary}" stroke-width="2.5" opacity="0.42"/>`)
			}
		}
		return `<rect width="240" height="220" fill="${primary}"/>${hexes.join('')}<path d="M18 72 L50 98 M190 98 L222 72" stroke="${detail}" stroke-width="4"/>`
	}
	if (pattern === 'disrupted-stripes') {
		const blocks = []
		for (let row = 0; row < 6; row += 1) {
			for (let col = 0; col < 6; col += 1) {
				const x = 51 + col * 24 + (row % 2 === 0 ? 0 : 8)
				const y = 22 + row * 32
				blocks.push(`<rect x="${x}" y="${y}" width="18" height="32" fill="${col % 2 === 0 ? primary : secondary}"/>`)
			}
		}
		return `<rect width="240" height="220" fill="${secondary}"/>${blocks.join('')}<path d="${leftSleeve}" fill="${primary}"/><path d="${rightSleeve}" fill="${primary}"/><path d="M18 72 L50 98 M190 98 L222 72" stroke="${accent}" stroke-width="7"/>`
	}
	if (pattern === 'castle') {
		return `<rect width="240" height="220" fill="${primary}"/><path d="M42 92 H61 V64 H78 V82 H99 V49 H119 V73 H142 V52 H161 V84 H181 V66 H199 V92 H217 V203 H42 Z" fill="${secondary}" opacity="0.58"/><path d="M46 121 H194 M56 151 H184 M69 181 H171" stroke="${detail}" stroke-width="4" opacity="0.28"/><path d="M18 72 L50 98 M190 98 L222 72" stroke="${accent}" stroke-width="5"/>`
	}
	if (pattern === 'mist') {
		return `<defs><radialGradient id="${id}-mist-a"><stop stop-color="${detail}" stop-opacity="0.55"/><stop offset="1" stop-color="${detail}" stop-opacity="0"/></radialGradient><radialGradient id="${id}-mist-b"><stop stop-color="${secondary}" stop-opacity="0.9"/><stop offset="1" stop-color="${secondary}" stop-opacity="0"/></radialGradient></defs><rect width="240" height="220" fill="${primary}"/><ellipse cx="83" cy="80" rx="71" ry="52" fill="url(#${id}-mist-a)"/><ellipse cx="161" cy="137" rx="89" ry="68" fill="url(#${id}-mist-b)"/><ellipse cx="67" cy="188" rx="62" ry="43" fill="url(#${id}-mist-a)"/><path d="${leftSleeve}" fill="${primary}"/><path d="${rightSleeve}" fill="${primary}"/><path d="M18 72 L50 98 M190 98 L222 72" stroke="${accent}" stroke-width="5"/>`
	}
	if (pattern === 'leaves') {
		const leaves = Array.from({ length: 15 }, (_, index) => {
			const col = index % 5
			const row = Math.floor(index / 5)
			const x = 51 + col * 34 + (row % 2) * 10
			const y = 35 + row * 60
			return `<path d="M${x} ${y + 26} Q${x + 8} ${y - 2} ${x + 28} ${y + 2} Q${x + 25} ${y + 24} ${x} ${y + 26} Z" fill="${secondary}" opacity="${0.35 + (index % 3) * 0.08}"/>`
		}).join('')
		return `<rect width="240" height="220" fill="${primary}"/>${leaves}<path d="M47 193 Q105 139 190 39" fill="none" stroke="${detail}" stroke-width="3" opacity="0.28"/><path d="M18 72 L50 98 M190 98 L222 72" stroke="${accent}" stroke-width="7"/>`
	}
	if (pattern === 'yoke') {
		return `<rect width="240" height="220" fill="${primary}"/><path d="M13 28 H227 V68 Q180 86 120 86 Q60 86 13 68 Z" fill="${secondary}"/><path d="M57 67 Q120 92 183 67" fill="none" stroke="${accent}" stroke-width="7"/><path d="M55 112 L91 91 L120 112 L149 91 L185 112 M55 157 L91 136 L120 157 L149 136 L185 157" fill="none" stroke="${detail}" stroke-width="4" opacity="0.22"/>`
	}
	if (pattern === 'diagonal-pinstripes') {
		const lines = Array.from({ length: 11 }, (_, index) => {
			const offset = -95 + index * 28
			return `<path d="M${offset} 220 L${offset + 145} 0" stroke="${index % 3 === 0 ? secondary : accent}" stroke-width="${index % 3 === 0 ? 2.4 : 1.2}" opacity="${index % 3 === 0 ? 0.3 : 0.18}"/>`
		}).join('')
		return `<rect width="240" height="220" fill="${primary}"/>${lines}<path d="${leftSleeve}" fill="${primary}"/><path d="${rightSleeve}" fill="${primary}"/><path d="M18 72 L50 98 M190 98 L222 72" stroke="${secondary}" stroke-width="6"/>`
	}
	if (pattern === 'flow') {
		return `<rect width="240" height="220" fill="${primary}"/><path d="M-18 180 C48 158 40 63 119 81 C187 97 190 19 257 37" fill="none" stroke="${secondary}" stroke-width="34" opacity="0.88"/><path d="M-13 186 C54 163 45 71 120 88 C190 104 195 27 253 45" fill="none" stroke="${accent}" stroke-width="15" opacity="0.82"/><path d="M13 201 C79 178 73 100 133 112 C192 124 210 69 251 68" fill="none" stroke="${detail}" stroke-width="6" opacity="0.74"/><path d="${leftSleeve}" fill="${primary}" opacity="0.94"/><path d="${rightSleeve}" fill="${primary}" opacity="0.94"/>`
	}
	return `<rect width="240" height="220" fill="${primary}"/>`
}

function renderJersey(kit) {
	const id = `${kit.code}-${kit.variant}`.toLowerCase()
	const title = `${kit.name} ${kit.variant} original abstract jersey`
	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 220" role="img" aria-labelledby="${id}-title">
	<title id="${id}-title">${escapeXml(title)}</title>
	<defs><clipPath id="${id}-shirt"><path d="${shirtPath}"/></clipPath><linearGradient id="${id}-shade" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#000" stop-opacity="0.22"/><stop offset="0.22" stop-color="#fff" stop-opacity="0.12"/><stop offset="0.54" stop-color="#fff" stop-opacity="0.02"/><stop offset="1" stop-color="#000" stop-opacity="0.3"/></linearGradient><pattern id="${id}-weave" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(32)"><path d="M0 1 H8" stroke="#fff" stroke-opacity="0.12" stroke-width="1"/></pattern><filter id="${id}-shadow" x="-30%" y="-30%" width="160%" height="180%"><feDropShadow dx="0" dy="7" stdDeviation="5" flood-color="#061811" flood-opacity="0.38"/></filter></defs>
	<ellipse cx="120" cy="209" rx="75" ry="8" fill="#061811" opacity="0.24"/>
	<g filter="url(#${id}-shadow)"><g clip-path="url(#${id}-shirt)">${patternMarkup(kit, id)}<rect width="240" height="220" fill="url(#${id}-shade)"/><rect width="240" height="220" fill="url(#${id}-weave)" opacity="0.42"/><path d="M69 69 Q86 83 88 207 H70 Z M171 69 Q154 83 152 207 H170 Z" fill="#061811" opacity="0.13"/><path d="M91 29 Q120 48 149 29" fill="none" stroke="#fff" stroke-opacity="0.22" stroke-width="4"/></g><path d="${shirtPath}" fill="none" stroke="#071713" stroke-width="5" stroke-linejoin="round"/><path d="M86 18 Q120 50 154 18 L141 13 Q120 31 99 13 Z" fill="#071713"/><path d="M96 16 Q120 37 144 16" fill="none" stroke="${kit.accent}" stroke-width="4" stroke-linecap="round"/><path d="M49 98 L70 75 M191 98 L170 75" fill="none" stroke="#071713" stroke-opacity="0.42" stroke-width="3"/></g>
</svg>`
}

function renderPitch() {
	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1304 1244" role="img" aria-labelledby="pitch-title" preserveAspectRatio="xMidYMid slice">
	<title id="pitch-title">Original LetLetMe matchday pitch background</title>
	<defs><linearGradient id="sky" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#00d9c5"/><stop offset="0.48" stop-color="#00ff85"/><stop offset="1" stop-color="#ff2882"/></linearGradient><linearGradient id="field" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#079554"/><stop offset="0.5" stop-color="#047e46"/><stop offset="1" stop-color="#035e39"/></linearGradient><radialGradient id="halo" cx="50%" cy="0%" r="78%"><stop offset="0" stop-color="#fff" stop-opacity="0.36"/><stop offset="0.5" stop-color="#00ff85" stop-opacity="0.08"/><stop offset="1" stop-color="#38003c" stop-opacity="0"/></radialGradient><pattern id="field-stripes" width="1304" height="174" patternUnits="userSpaceOnUse"><rect width="1304" height="87" fill="#fff" opacity="0.035"/><rect y="87" width="1304" height="87" fill="#001c13" opacity="0.045"/></pattern><pattern id="fascia-grid" width="32" height="32" patternUnits="userSpaceOnUse" patternTransform="skewX(-20)"><path d="M0 0 H32 V32" fill="none" stroke="#fff" stroke-opacity="0.08" stroke-width="1"/></pattern><pattern id="goal-net" width="18" height="18" patternUnits="userSpaceOnUse" patternTransform="skewX(-12)"><path d="M0 0 H18 V18" fill="none" stroke="#eafff3" stroke-opacity="0.5" stroke-width="2"/></pattern><filter id="grain" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="11"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="table" tableValues="0 0.05"/></feComponentTransfer></filter><clipPath id="field-clip"><path d="M68 112 H1236 L1304 350 V1244 H0 V350 Z"/></clipPath></defs>
	<rect width="1304" height="1244" fill="#210025"/><rect width="1304" height="184" fill="url(#sky)"/><rect width="1304" height="240" fill="url(#halo)"/><path d="M56 24 H1248 Q1278 24 1278 54 V126 H26 V54 Q26 24 56 24 Z" fill="#26002b" opacity="0.9"/><path d="M56 24 H1248 Q1278 24 1278 54 V126 H26 V54 Q26 24 56 24 Z" fill="url(#fascia-grid)"/><path d="M42 112 H1262 L1304 350 V1244 H0 V350 Z" fill="url(#field)"/><g clip-path="url(#field-clip)"><rect y="112" width="1304" height="1132" fill="url(#field-stripes)"/><rect width="1304" height="1244" filter="url(#grain)" opacity="0.58"/></g><g fill="none" stroke="#f6fff8" stroke-width="9" stroke-linejoin="round" opacity="0.96"><path d="M80 142 H1224 L1300 1244 H4 Z"/><path d="M282 142 L244 342 H1060 L1022 142"/><path d="M460 142 L451 232 H853 L844 142"/><path d="M471 342 Q652 474 833 342"/><path d="M28 919 H1276"/><circle cx="652" cy="919" r="196"/><circle cx="652" cy="919" r="8" fill="#f6fff8" stroke="none"/><circle cx="652" cy="295" r="7" fill="#f6fff8" stroke="none"/></g><g><path d="M520 142 V63 H784 V142" fill="url(#goal-net)" stroke="#f6fff8" stroke-width="7"/><path d="M520 63 H784" stroke="#f6fff8" stroke-width="9"/><path d="M542 142 L561 82 H743 L762 142" fill="none" stroke="#f6fff8" stroke-opacity="0.4" stroke-width="3"/></g><path d="M0 350 L42 112 H1262 L1304 350" fill="none" stroke="#00ff85" stroke-width="5" opacity="0.65"/><path d="M0 1188 Q652 1118 1304 1188 V1244 H0 Z" fill="#061d16" opacity="0.22"/>
</svg>`
}

function dataUri(svg) {
	return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`
}

function renderKitBoard(jerseys) {
	const cards = teams.map((team, index) => {
		const col = index % 5
		const row = Math.floor(index / 5)
		const x = 72 + col * 336
		const y = 154 + row * 266
		return `<g transform="translate(${x} ${y})"><rect width="304" height="238" rx="22" fill="#220b27" stroke="#fff" stroke-opacity="0.13"/><rect x="18" y="18" width="7" height="143" rx="3.5" fill="${team.home.primary}"/><rect x="18" y="90" width="7" height="71" rx="3.5" fill="${team.home.secondary}"/><image href="${dataUri(jerseys.get(team.code))}" x="54" y="10" width="196" height="180"/><text x="24" y="215" fill="#00ff85" font-family="Avenir Next Condensed, Impact, sans-serif" font-size="22" font-weight="900" letter-spacing="2">${team.code}</text><text x="85" y="215" fill="#f7f2e9" font-family="Avenir Next, sans-serif" font-size="17" font-weight="700">${escapeXml(team.name)}</text></g>`
	}).join('')

	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1800 1290" role="img" aria-label="Original home kit asset board"><defs><pattern id="board-grid" width="36" height="36" patternUnits="userSpaceOnUse"><path d="M36 0 H0 V36" fill="none" stroke="#fff" stroke-opacity="0.04"/></pattern><linearGradient id="board-accent" x1="0" y1="0" x2="1" y2="0"><stop stop-color="#00ff85"/><stop offset="0.58" stop-color="#00d9c5"/><stop offset="1" stop-color="#ff2882"/></linearGradient></defs><rect width="1800" height="1290" fill="#130017"/><rect width="1800" height="1290" fill="url(#board-grid)"/><rect x="72" y="64" width="1656" height="5" rx="2.5" fill="url(#board-accent)"/><text x="72" y="112" fill="#f7f2e9" font-family="Avenir Next Condensed, Impact, sans-serif" font-size="48" font-weight="900" letter-spacing="3">HOME KIT SYSTEM</text><text x="1728" y="108" text-anchor="end" fill="#9a83a0" font-family="Avenir Next, sans-serif" font-size="18" letter-spacing="2">20 ORIGINAL SVG · FPL PALETTE CHECKED · NO OFFICIAL MARKS</text>${cards}<text x="72" y="1254" fill="#9a83a0" font-family="Avenir Next, sans-serif" font-size="16">Home kits only. Official FPL thumbnails are used for colour review only and are not included in public assets.</text></svg>`
}

function renderFplComparisonBoard(jerseys) {
	const cards = teams.map((team, index) => {
		const col = index % 5
		const row = Math.floor(index / 5)
		const x = 72 + col * 336
		const y = 154 + row * 266
		const fpl = fplHomeReferences[team.code]
		const fplAsset = `https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_${fpl.teamId}-220.webp`
		return `<g transform="translate(${x} ${y})"><rect width="304" height="238" rx="22" fill="#220b27" stroke="#fff" stroke-opacity="0.13"/><text x="20" y="34" fill="#00ff85" font-family="Avenir Next Condensed, Impact, sans-serif" font-size="20" font-weight="900" letter-spacing="2">${team.code}</text><text x="77" y="34" fill="#f7f2e9" font-family="Avenir Next, sans-serif" font-size="16" font-weight="700">${escapeXml(team.name)}</text><text x="75" y="62" text-anchor="middle" fill="#a991ae" font-family="Avenir Next, sans-serif" font-size="11" font-weight="700" letter-spacing="2">FPL</text><text x="220" y="62" text-anchor="middle" fill="#a991ae" font-family="Avenir Next, sans-serif" font-size="11" font-weight="700" letter-spacing="2">OUR SVG</text><image href="${fplAsset}" x="28" y="70" width="94" height="123" preserveAspectRatio="xMidYMid meet"/><image href="${dataUri(jerseys.get(team.code))}" x="148" y="61" width="144" height="132"/><path d="M140 66 V198" stroke="#fff" stroke-opacity="0.1"/>${fpl.sampledColours.map((colour, colourIndex) => `<circle cx="${32 + colourIndex * 22}" cy="214" r="7" fill="${colour}" stroke="#fff" stroke-opacity="0.35"/>`).join('')}<circle cx="246" cy="214" r="7" fill="${team.home.primary}" stroke="#fff" stroke-opacity="0.35"/><circle cx="268" cy="214" r="7" fill="${team.home.secondary}" stroke="#fff" stroke-opacity="0.35"/></g>`
	}).join('')

	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1800 1290" role="img" aria-label="FPL home kit colour comparison board"><defs><pattern id="audit-grid" width="36" height="36" patternUnits="userSpaceOnUse"><path d="M36 0 H0 V36" fill="none" stroke="#fff" stroke-opacity="0.04"/></pattern><linearGradient id="audit-accent" x1="0" y1="0" x2="1" y2="0"><stop stop-color="#00ff85"/><stop offset="0.58" stop-color="#00d9c5"/><stop offset="1" stop-color="#ff2882"/></linearGradient></defs><rect width="1800" height="1290" fill="#130017"/><rect width="1800" height="1290" fill="url(#audit-grid)"/><rect x="72" y="64" width="1656" height="5" rx="2.5" fill="url(#audit-accent)"/><text x="72" y="112" fill="#f7f2e9" font-family="Avenir Next Condensed, Impact, sans-serif" font-size="48" font-weight="900" letter-spacing="3">FPL COLOUR CROSS-CHECK</text><text x="1728" y="108" text-anchor="end" fill="#9a83a0" font-family="Avenir Next, sans-serif" font-size="18" letter-spacing="2">REVIEW ONLY · OFFICIAL IMAGES ARE NOT SHIPPED</text>${cards}<text x="72" y="1254" fill="#9a83a0" font-family="Avenir Next, sans-serif" font-size="16">Left: live FPL home thumbnail. Right: original abstract SVG. Dots show sampled FPL colours and our configured primary pair.</text></svg>`
}

function renderPitchBoard(pitch) {
	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1800 1560" role="img" aria-label="Original pitch background asset board"><defs><pattern id="pitch-board-grid" width="36" height="36" patternUnits="userSpaceOnUse"><path d="M36 0 H0 V36" fill="none" stroke="#fff" stroke-opacity="0.04"/></pattern><linearGradient id="pitch-board-accent" x1="0" y1="0" x2="1" y2="0"><stop stop-color="#00ff85"/><stop offset="0.58" stop-color="#00d9c5"/><stop offset="1" stop-color="#ff2882"/></linearGradient></defs><rect width="1800" height="1560" fill="#130017"/><rect width="1800" height="1560" fill="url(#pitch-board-grid)"/><rect x="72" y="64" width="1656" height="5" rx="2.5" fill="url(#pitch-board-accent)"/><text x="72" y="112" fill="#f7f2e9" font-family="Avenir Next Condensed, Impact, sans-serif" font-size="48" font-weight="900" letter-spacing="3">MATCHDAY PITCH</text><text x="1728" y="108" text-anchor="end" fill="#9a83a0" font-family="Avenir Next, sans-serif" font-size="18" letter-spacing="2">1304 × 1244 · ORIGINAL VECTOR</text><rect x="72" y="148" width="1408" height="1344" rx="28" fill="#220b27" stroke="#fff" stroke-opacity="0.13"/><image href="${dataUri(pitch)}" x="100" y="176" width="1352" height="1288" preserveAspectRatio="xMidYMid meet"/><g transform="translate(1512 176)"><rect width="216" height="422" rx="24" fill="#220b27" stroke="#fff" stroke-opacity="0.13"/><text x="24" y="44" fill="#f7f2e9" font-family="Avenir Next Condensed, Impact, sans-serif" font-size="24" font-weight="900">SYSTEM</text><rect x="24" y="72" width="168" height="36" rx="8" fill="#38003c"/><rect x="24" y="122" width="168" height="36" rx="8" fill="#00ff85"/><rect x="24" y="172" width="168" height="36" rx="8" fill="#ff2882"/><rect x="24" y="222" width="168" height="36" rx="8" fill="#047e46"/><circle cx="60" cy="319" r="30" fill="#00ff85"/><text x="60" y="329" text-anchor="middle" fill="#28002d" font-family="Avenir Next, sans-serif" font-size="28" font-weight="900">C</text><circle cx="156" cy="319" r="30" fill="#f5f1e8"/><text x="156" y="329" text-anchor="middle" fill="#28002d" font-family="Avenir Next, sans-serif" font-size="28" font-weight="900">V</text><text x="108" y="384" text-anchor="middle" fill="#9a83a0" font-family="Avenir Next, sans-serif" font-size="13">CSS UI markers</text></g><g transform="translate(1512 630)"><rect width="216" height="288" rx="24" fill="#220b27" stroke="#fff" stroke-opacity="0.13"/><text x="24" y="44" fill="#00ff85" font-family="Avenir Next Condensed, Impact, sans-serif" font-size="20" font-weight="900" letter-spacing="1">SAFE AREA</text><text x="24" y="82" fill="#f7f2e9" font-family="Avenir Next, sans-serif" font-size="16">Blank fascia</text><text x="24" y="106" fill="#9a83a0" font-family="Avenir Next, sans-serif" font-size="14">for HTML title</text><text x="24" y="150" fill="#f7f2e9" font-family="Avenir Next, sans-serif" font-size="16">No league logo</text><text x="24" y="174" fill="#9a83a0" font-family="Avenir Next, sans-serif" font-size="14">no club marks</text><text x="24" y="218" fill="#f7f2e9" font-family="Avenir Next, sans-serif" font-size="16">Perspective lines</text><text x="24" y="242" fill="#9a83a0" font-family="Avenir Next, sans-serif" font-size="14">poster-first layout</text></g></svg>`
}

rmSync(kitRoot, { recursive: true, force: true })
rmSync(legacyBadgeRoot, { recursive: true, force: true })
rmSync(previewRoot, { recursive: true, force: true })
mkdirSync(kitRoot, { recursive: true })
mkdirSync(previewRoot, { recursive: true })

const jerseys = new Map()
for (const team of teams) {
	const kit = { ...team.home, code: team.code, name: team.name, variant: 'home' }
	const svg = renderJersey(kit)
	jerseys.set(team.code, svg)
	writeFileSync(join(kitRoot, `${team.code}.svg`), `${svg}\n`)
}

const pitch = renderPitch()
writeFileSync(join(assetRoot, 'pitch-background.svg'), `${pitch}\n`)

const manifest = {
	schemaVersion: 3,
	season: '2026-27',
	kitScope: 'home-only',
	generatedFrom: 'Stable high-level design descriptions plus live FPL home-shirt palette verification on 2026-08-16.',
	artwork: 'Original abstract LetLetMe artwork. References inform only broad colours and layout characteristics.',
	notices: [
		'No Premier League or FPL branding is included.',
		'No club crests, sponsor marks, manufacturer marks, player likenesses, or official kit artwork are included.',
		'Official FPL thumbnails were used only to verify primary colours and are not embedded in public assets.',
	],
	pitch: '/images/squad-pitch/pitch-background.svg',
	fplVerification: {
		sourcePage: 'https://fantasy.premierleague.com/en/transfers',
		checkedAt: '2026-08-16',
		method: 'Live Chrome inspection plus dominant-colour sampling of the current FPL home-shirt thumbnails.',
	},
	captainMarkers: {
		rendering: 'css-circle',
		captain: { text: 'C', background: '#111315', foreground: '#f5f1e8', border: '#00ff85' },
		viceCaptain: { text: 'V', background: '#111315', foreground: '#f5f1e8', border: '#f5f1e8' },
	},
	teams: Object.fromEntries(teams.map(team => [
		team.code,
		{
			name: team.name,
			homeKit: {
				asset: `/images/squad-pitch/kits/${team.code}.svg`,
				palette: { primary: team.home.primary, secondary: team.home.secondary, accent: team.home.accent, detail: team.home.detail },
				designReference: { description: team.home.description, source: team.home.source, status: team.home.status },
				fplReference: {
					asset: `https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_${fplHomeReferences[team.code].teamId}-220.webp`,
					sampledColours: fplHomeReferences[team.code].sampledColours,
					paletteStatus: 'aligned',
				},
			},
		},
	])),
}
writeFileSync(join(assetRoot, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)

writeFileSync(join(previewRoot, 'kits-board.svg'), `${renderKitBoard(jerseys)}\n`)
writeFileSync(join(previewRoot, 'fpl-home-comparison.svg'), `${renderFplComparisonBoard(jerseys)}\n`)

const pitchBoard = renderPitchBoard(pitch)
	.replace('<circle cx="60" cy="319" r="30" fill="#00ff85"/>', '<circle cx="60" cy="319" r="30" fill="#111315" stroke="#00ff85" stroke-width="4"/>')
	.replace('<text x="60" y="329" text-anchor="middle" fill="#28002d"', '<text x="60" y="329" text-anchor="middle" fill="#f5f1e8"')
	.replace('<circle cx="156" cy="319" r="30" fill="#f5f1e8"/>', '<circle cx="156" cy="319" r="30" fill="#111315" stroke="#f5f1e8" stroke-width="4"/>')
	.replace('<text x="156" y="329" text-anchor="middle" fill="#28002d"', '<text x="156" y="329" text-anchor="middle" fill="#f5f1e8"')
writeFileSync(join(previewRoot, 'pitch-board.svg'), `${pitchBoard}\n`)

console.log(`Generated ${teams.length} home club kits, no goalkeeper kit, 1 pitch, and 3 review boards. Captain markers are black CSS circles.`)
