/**
 * Local crest path under `public/images/team-logos/`.
 *
 * Use with next/image `unoptimized`: the optimizer’s small-size palette
 * downsample turns dark crests (especially Coventry) near-monochrome.
 * Static `/images/*` responses are still browser/CDN cached — do not add
 * cache-busting query strings.
 */
export function teamCrestSrc(shortName: string): string {
	return `/images/team-logos/${shortName.trim().toUpperCase()}.png`
}
