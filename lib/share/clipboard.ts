export type ClipboardCopyResult = 'copied' | 'unsupported' | 'failed'
export type ShareResult = 'shared' | ClipboardCopyResult

// html-to-image copies every computed CSS property by default. On a large
// standings page that can produce a multi-megabyte foreignObject SVG which
// Chrome may never finish decoding. Keep the visual/layout properties needed
// by our share cards while leaving browser-only properties out of the clone.
const SHARE_IMAGE_STYLE_PROPERTIES = [
	'align-content',
	'align-items',
	'align-self',
	'background-color',
	'background-image',
	'background-position',
	'background-repeat',
	'background-size',
	'border',
	'border-collapse',
	'border-color',
	'border-radius',
	'border-spacing',
	'border-style',
	'border-width',
	'box-shadow',
	'box-sizing',
	'color',
	'column-gap',
	'display',
	'fill',
	'flex',
	'flex-direction',
	'flex-grow',
	'flex-shrink',
	'flex-wrap',
	'font-family',
	'font-size',
	'font-style',
	'font-weight',
	'gap',
	'grid-auto-flow',
	'grid-template-columns',
	'grid-template-rows',
	'height',
	'justify-content',
	'justify-items',
	'justify-self',
	'letter-spacing',
	'line-height',
	'margin',
	'max-height',
	'max-width',
	'min-height',
	'min-width',
	'object-fit',
	'object-position',
	'opacity',
	'overflow',
	'overflow-wrap',
	'padding',
	'position',
	'right',
	'row-gap',
	'text-align',
	'text-decoration',
	'text-overflow',
	'text-transform',
	'top',
	'transform',
	'vertical-align',
	'visibility',
	'white-space',
	'width',
	'word-break',
	'z-index'
]

export function shouldIncludeShareImageNode(node: {
	nodeType: number
	getAttribute?: (name: string) => string | null
}): boolean {
	return (
		node.nodeType !== 1 || node.getAttribute?.('data-share-exclude') !== 'true'
	)
}

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
	const captureWidth = getShareCaptureWidth(element)
	return toBlob(element, {
		backgroundColor: '#210025',
		cacheBust: true,
		pixelRatio: 2,
		...(captureWidth
			? {
					width: captureWidth,
					style: { width: `${captureWidth}px` }
				}
			: {}),
		includeStyleProperties: SHARE_IMAGE_STYLE_PROPERTIES,
		// The app uses next/font CSS. Embedding remote font faces can reject the
		// whole SVG render in browsers with a stricter CORS policy; system fonts
		// keep the share usable when that optional embed is unavailable.
		skipFonts: true,
		// html-to-image applies the filter to text nodes as well as elements.
		filter: shouldIncludeShareImageNode
	})
}

function getShareCaptureWidth(element: HTMLElement): number | undefined {
	const widths = [element.clientWidth, element.scrollWidth]
	element.querySelectorAll<HTMLElement>('*').forEach(child => {
		widths.push(child.scrollWidth)
	})
	const width = Math.max(...widths)
	return width > element.clientWidth ? width : undefined
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
		await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
		return 'copied'
	} catch {
		return 'failed'
	}
}

function prefersNativeImageShare(): boolean {
	if (typeof navigator === 'undefined') return false
	const userAgentData = (
		navigator as Navigator & { userAgentData?: { mobile?: boolean } }
	).userAgentData
	return (
		userAgentData?.mobile === true ||
		/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent ?? '')
	)
}

function prefersNativeTextShare(): boolean {
	if (typeof navigator === 'undefined') return false
	const userAgentData = (
		navigator as Navigator & { userAgentData?: { mobile?: boolean } }
	).userAgentData
	return (
		userAgentData?.mobile === true ||
		/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent ?? '')
	)
}

async function tryNativeImageShare(blob: Blob): Promise<ShareResult> {
	if (typeof File === 'undefined' || typeof navigator.share !== 'function') {
		return 'unsupported'
	}

	try {
		const file = new File([blob], 'letletme-share.png', {
			type: 'image/png'
		})
		const shareData: ShareData = { files: [file] }
		if (navigator.canShare && !navigator.canShare(shareData)) {
			return 'unsupported'
		}
		await navigator.share(shareData)
		return 'shared'
	} catch {
		// A rejected native share can consume transient user activation. Do not
		// retry the clipboard in this same handler; let the caller report failure.
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
		if (prefersNativeImageShare()) {
			const nativeResult = await tryNativeImageShare(blob)
			if (nativeResult !== 'unsupported') return nativeResult
		}

		const clipboardResult = await copyImageBlobToClipboard(blob)
		if (clipboardResult === 'copied') return 'copied'
		if (clipboardResult === 'failed') {
			// Clipboard permission failures do not necessarily mean that the OS
			// share sheet is unavailable. Try it before reporting a hard failure.
			const nativeResult = await tryNativeImageShare(blob)
			return nativeResult === 'unsupported' ? 'failed' : nativeResult
		}

		// On desktop, use native sharing only when image clipboard support is
		// absent. This preserves the original click activation for the first
		// usable operation instead of consuming it on an unavailable share sheet.
		return tryNativeImageShare(blob)
	} catch {
		return 'failed'
	}
}

/**
 * Prefer the native share sheet when it can carry a rendered image. Desktop
 * browsers usually cannot, so the image is copied to the clipboard instead.
 */
export async function shareElementImage(
	element: HTMLElement
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
		// Desktop Chrome exposes navigator.share but can reject it when no OS
		// share target is available. Clipboard is the reliable desktop action;
		// keep the native share sheet first on mobile where it is expected.
		if (prefersNativeTextShare() && typeof navigator.share === 'function') {
			try {
				await navigator.share({ title: options.title, text })
				return 'shared'
			} catch {
				// The native share may have consumed the user activation. Return a
				// failure so the UI can expose its manual-copy fallback instead.
				return 'failed'
			}
		}
		const clipboardResult = await copyTextToClipboard(text)
		if (clipboardResult !== 'unsupported') return clipboardResult
		if (typeof navigator.share !== 'function') return clipboardResult
		try {
			await navigator.share({ title: options.title, text })
			return 'shared'
		} catch {
			return 'failed'
		}
	} catch {
		return 'failed'
	}
}
