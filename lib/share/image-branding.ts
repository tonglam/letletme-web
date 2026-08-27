export const SHARE_BRAND_NAME = 'LetLetMe'
export const SHARE_BRAND_URL = 'letletme.top'
export const SHARE_BRAND_VERSION = 2

export interface ShareBrandSignature {
	x: number
	y: number
	width: number
	height: number
	fontSize: number
}

export interface ShareBrandLayout {
	signature: ShareBrandSignature
}

function clamp(value: number, minimum: number, maximum: number): number {
	return Math.min(maximum, Math.max(minimum, value))
}

export function buildShareBrandLayout(
	width: number,
	height: number
): ShareBrandLayout {
	const safeWidth = Math.max(1, width)
	const safeHeight = Math.max(1, height)
	const shortSide = Math.min(safeWidth, safeHeight)

	const margin = clamp(Math.round(shortSide * 0.018), 8, 18)
	const signatureFontSize = clamp(Math.round(shortSide * 0.016), 9, 14)
	const signatureHeight = Math.max(
		1,
		Math.min(safeHeight, Math.round(signatureFontSize * 2.15))
	)
	const signatureWidth = Math.max(
		1,
		Math.min(safeWidth, Math.round(signatureFontSize * 11.4))
	)

	return {
		signature: {
			x: Math.max(0, safeWidth - margin - signatureWidth),
			y: Math.max(0, safeHeight - margin - signatureHeight),
			width: signatureWidth,
			height: signatureHeight,
			fontSize: signatureFontSize
		}
	}
}

/** Draw the brand signature over the final pixels so captured content cannot cover it. */
export function drawShareBranding(
	context: CanvasRenderingContext2D,
	width: number,
	height: number
): void {
	const layout = buildShareBrandLayout(width, height)

	const signature = layout.signature
	context.save()
	context.globalAlpha = 1
	context.fillStyle = 'rgba(33, 0, 37, 0.88)'
	context.fillRect(
		signature.x,
		signature.y,
		signature.width,
		signature.height
	)
	context.fillStyle = '#00ff85'
	context.fillRect(
		signature.x,
		signature.y,
		Math.max(3, Math.round(signature.fontSize * 0.2)),
		signature.height
	)
	context.textAlign = 'right'
	context.textBaseline = 'middle'
	context.font = `700 ${signature.fontSize}px ui-sans-serif, system-ui, sans-serif`
	context.fillStyle = '#f8f6ef'
	context.fillText(
		`${SHARE_BRAND_NAME} · ${SHARE_BRAND_URL}`,
		signature.x + signature.width - signature.fontSize * 0.65,
		signature.y + signature.height / 2,
		signature.width - signature.fontSize
	)
	context.restore()
}

/** Convert a rendered DOM canvas to the only shareable output: a branded PNG. */
export function brandedCanvasToPng(
	canvas: HTMLCanvasElement
): Promise<Blob | null> {
	const context = canvas.getContext('2d')
	if (!context) return Promise.resolve(null)
	drawShareBranding(context, canvas.width, canvas.height)
	return new Promise(resolve => canvas.toBlob(resolve, 'image/png'))
}
