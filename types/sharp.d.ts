declare module 'sharp' {
	type SharpMetadata = {
		width?: number
		height?: number
		format?: string
	}

	type SharpPipeline = {
		metadata(): Promise<SharpMetadata>
		rotate(): SharpPipeline
		resize(width: number, height: number, options?: { fit?: string }): SharpPipeline
		jpeg(options?: { quality?: number; mozjpeg?: boolean }): SharpPipeline
		toBuffer(): Promise<Buffer>
	}

	type SharpFactory = (
		input: Uint8Array,
		options?: { limitInputPixels?: number }
	) => SharpPipeline

	const sharp: SharpFactory
	export default sharp
}
