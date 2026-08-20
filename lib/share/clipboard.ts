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
		pixelRatio: 2
	})
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
		await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
		return 'copied'
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
	options: { title?: string; text?: string } = {}
): Promise<ShareResult> {
	if (typeof navigator === 'undefined') return 'unsupported'

	try {
		const blob = await elementToPng(element)
		if (!blob) return 'failed'

		if (typeof File !== 'undefined' && typeof navigator.share === 'function') {
			const file = new File([blob], 'letletme-share.png', {
				type: 'image/png'
			})
			const shareData: ShareData = {
				title: options.title,
				text: options.text,
				files: [file]
			}
			if (!navigator.canShare || navigator.canShare(shareData)) {
				await navigator.share(shareData)
				return 'shared'
			}
		}

		if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') {
			return 'unsupported'
		}
		await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
		return 'copied'
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
			await navigator.share({ title: options.title, text })
			return 'shared'
		}
		return copyTextToClipboard(text)
	} catch {
		return 'failed'
	}
}
