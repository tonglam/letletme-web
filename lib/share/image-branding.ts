export const SHARE_BRAND_NAME = 'LetLetMe'
export const SHARE_BRAND_URL = 'letletme.top'
export const SHARE_BRAND_VERSION = 2

const TILE_ANGLE = (-18 * Math.PI) / 180

export interface ShareBrandTile {
	x: number
	y: number
	fontSize: number
	angle: number
}

export interface ShareBrandSignature {
	x: number
	y: number
	width: number
	height: number
	fontSize: number
}

export interface ShareBrandLayout {
	tiles: ShareBrandTile[]
	signature: ShareBrandSignature
}

function clamp(value: number, minimum: number, maximum: number): number {
	return Math.min(maximum, Math.max(minimum, value))
}

/**
 * Builds a dense, staggered watermark field. Its spacing is deliberately
 * smaller than a normal social crop, so trimming an edge cannot remove every
 * LetLetMe mark.
 */
export function buildShareBrandLayout(
	width: number,
	height: number
): ShareBrandLayout {
	const safeWidth = Math.max(1, width)
	const safeHeight = Math.max(1, height)
	const shortSide = Math.min(safeWidth, safeHeight)
	const tileFontSize = clamp(Math.round(shortSide * 0.032), 14, 30)
	const stepX = Math.max(tileFontSize * 7.3, safeWidth * 0.28)
	const stepY = Math.max(tileFontSize * 4.8, safeHeight * 0.16)
	const tiles: ShareBrandTile[] = []

	let row = 0
	for (
		let y = -stepY * 0.2;
		y <= safeHeight + stepY * 0.2;
		y += stepY
	) {
		const offset = row % 2 === 0 ? 0 : stepX / 2
		for (
			let x = -stepX * 0.3 + offset;
			x <= safeWidth + stepX * 0.3;
			x += stepX
		) {
			tiles.push({ x, y, fontSize: tileFontSize, angle: TILE_ANGLE })
		}
		row += 1
	}

	const margin = clamp(Math.round(shortSide * 0.018), 8, 18)
	const signatureFontSize = clamp(Math.round(shortSide * 0.024), 12, 20)
	const signatureHeight = Math.max(
		1,
		Math.min(safeHeight, Math.round(signatureFontSize * 2.15))
	)
	const signatureWidth = Math.max(
		1,
		Math.min(safeWidth, Math.round(signatureFontSize * 12.8))
	)

	return {
		tiles,
		signature: {
			x: Math.max(0, safeWidth - margin - signatureWidth),
			y: Math.max(0, safeHeight - margin - signatureHeight),
			width: signatureWidth,
			height: signatureHeight,
			fontSize: signatureFontSize
		}
	}
}

/** Draw the brand over the final pixels so captured content cannot cover it. */
export function drawShareBranding(
	context: CanvasRenderingContext2D,
	width: number,
	height: number
): void {
	const layout = buildShareBrandLayout(width, height)

	for (const tile of layout.tiles) {
		context.save()
		context.translate(tile.x, tile.y)
		context.rotate(tile.angle)
		context.globalAlpha = 0.12
		context.textAlign = 'center'
		context.textBaseline = 'middle'
		context.font = `700 ${tile.fontSize}px ui-sans-serif, system-ui, sans-serif`
		context.lineWidth = Math.max(1, tile.fontSize * 0.1)
		context.strokeStyle = 'rgba(33, 0, 37, 0.7)'
		context.strokeText(SHARE_BRAND_NAME, 0, 0)
		context.fillStyle = '#f8f6ef'
		context.fillText(SHARE_BRAND_NAME, 0, 0)
		context.restore()
	}

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
