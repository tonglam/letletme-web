export type ClipboardCopyResult = 'copied' | 'unsupported' | 'failed'
export type ShareResult = 'shared' | ClipboardCopyResult

export async function copyTextToClipboard(
	text: string
): Promise<ClipboardCopyResult> {
	if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText) {
		return 'unsupported'
	}
	try {
		await navigator.clipboard.writeText(text)
		return 'copied'
	} catch {
		return 'failed'
	}
}

async function elementToPng(element: HTMLElement): Promise<Blob | null> {
	const { toBlob } = await import('html-to-image')
	return toBlob(element, {
		backgroundColor: '#210025',
		cacheBust: true,
		pixelRatio: 2,
		// The app uses next/font CSS. Embedding remote font faces can reject the
		// whole SVG render in browsers with a stricter CORS policy; system fonts
		// keep the share usable when that optional embed is unavailable.
		skipFonts: true,
		filter: node => node.dataset.shareExclude !== 'true',
	})
}

async function copyImageBlobToClipboard(
	blob: Blob
): Promise<ClipboardCopyResult> {
	if (
		typeof navigator === 'undefined' ||
		!navigator.clipboard?.write ||
		typeof ClipboardItem === 'undefined'
	) {
		return 'unsupported'
	}

	try {
		await navigator.clipboard.write([
			new ClipboardItem({ 'image/png': blob })
		])
		return 'copied'
	} catch {
		return 'failed'
	}
}

/** Render a visual result to PNG and copy it to the system clipboard. */
export async function copyElementImageToClipboard(
	element: HTMLElement
): Promise<ClipboardCopyResult> {
	if (
		typeof navigator === 'undefined' ||
		!navigator.clipboard?.write ||
		typeof ClipboardItem === 'undefined'
	) {
		return 'unsupported'
	}

	try {
		const blob = await elementToPng(element)
		if (!blob) return 'failed'
		return copyImageBlobToClipboard(blob)
	} catch {
		return 'failed'
	}
}

/**
 * Share an already-rendered image. Keeping this separate from DOM rendering
 * makes the native-share/clipboard fallback deterministic and testable.
 */
export async function shareImageBlob(blob: Blob): Promise<ShareResult> {
	if (typeof navigator === 'undefined') return 'unsupported'

	try {
		if (typeof File !== 'undefined' && typeof navigator.share === 'function') {
			try {
				const file = new File([blob], 'letletme-share.png', {
					type: 'image/png'
				})
				const shareData: ShareData = {
					files: [file]
				}
				if (!navigator.canShare || navigator.canShare(shareData)) {
					await navigator.share(shareData)
					return 'shared'
				}
			} catch {
				// Rendering the image is asynchronous, so desktop browsers and
				// some mobile browsers can reject the native share because the
				// original user activation has expired. The image is still valid;
				// continue with the clipboard fallback instead of losing it.
			}
		}

		return copyImageBlobToClipboard(blob)
	} catch {
		return 'failed'
	}
}

/**
 * Prefer the native share sheet when it can carry a rendered image. Desktop
 * browsers usually cannot, so the image is copied to the clipboard instead.
 */
export async function shareElementImage(
	element: HTMLElement,
): Promise<ShareResult> {
	try {
		const blob = await elementToPng(element)
		if (!blob) return 'failed'
		return shareImageBlob(blob)
	} catch {
		return 'failed'
	}
}

/** Prefer the native text share sheet, falling back to clipboard copy. */
export async function shareText(
	text: string,
	options: { title?: string } = {}
): Promise<ShareResult> {
	if (typeof navigator === 'undefined') return 'unsupported'
	try {
		if (typeof navigator.share === 'function') {
			try {
				await navigator.share({ title: options.title, text })
				return 'shared'
			} catch {
				// The native share may have consumed the user activation. Return a
				// failure so the UI can expose its manual-copy fallback instead.
				return 'failed'
			}
		}
		return copyTextToClipboard(text)
	} catch {
		return 'failed'
	}
}
