/**
 * Local crest path under `public/images/team-logos/`.
 *
 * Use with an explicit rendered size so Next can emit a small responsive
 * derivative. Do not add cache-busting query strings.
 */
export function teamCrestSrc(shortName: string): string {
	const normalized = shortName.trim().toUpperCase()
	if (!/^[A-Z0-9]{2,5}$/.test(normalized)) {
		return '/images/squad-pitch/kits/DEFAULT.png'
	}
	return `/images/team-logos/${normalized}.png`
}
