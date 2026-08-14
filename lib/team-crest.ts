/**
 * Local crest path under `public/images/team-logos/`.
 *
 * Use with an explicit rendered size so Next can emit a small responsive
 * derivative. Do not add cache-busting query strings.
 */
export function teamCrestSrc(shortName: string): string {
	return `/images/team-logos/${shortName.trim().toUpperCase()}.png`
}
