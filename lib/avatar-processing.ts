import sharp from 'sharp'

export const AVATAR_INPUT_MAX_BYTES = 5 * 1024 * 1024
export const AVATAR_OUTPUT_MAX_BYTES = 512 * 1024
export const AVATAR_MAX_PIXELS = 20_000_000
export const AVATAR_OUTPUT_SIZE = 512

export const AVATAR_CONTENT_TYPES = new Set([
	'image/jpeg',
	'image/png',
	'image/webp'
])

export class InvalidAvatarError extends Error {
	constructor(message = 'Invalid image') {
		super(message)
		this.name = 'InvalidAvatarError'
	}
}

export async function normalizeAvatar(
	input: Uint8Array,
	expectedContentType?: string
): Promise<Buffer> {
	if (input.byteLength === 0 || input.byteLength > AVATAR_INPUT_MAX_BYTES) {
		throw new InvalidAvatarError('Avatar file is too large')
	}

	try {
		const image = sharp(input, { limitInputPixels: AVATAR_MAX_PIXELS })
		const metadata = await image.metadata()
		if (
			!metadata.width ||
			!metadata.height ||
			metadata.width * metadata.height > AVATAR_MAX_PIXELS
		) {
			throw new InvalidAvatarError('Avatar dimensions are too large')
		}
		if (expectedContentType) {
			const expectedFormat =
				expectedContentType === 'image/jpeg'
					? 'jpeg'
					: expectedContentType === 'image/png'
						? 'png'
						: 'webp'
			if (metadata.format !== expectedFormat) {
				throw new InvalidAvatarError('Avatar MIME type does not match the image')
			}
		}

		const output = await sharp(input, { limitInputPixels: AVATAR_MAX_PIXELS })
			.rotate()
			.resize(AVATAR_OUTPUT_SIZE, AVATAR_OUTPUT_SIZE, { fit: 'cover' })
			.jpeg({ quality: 85, mozjpeg: true })
			.toBuffer()

		if (output.byteLength > AVATAR_OUTPUT_MAX_BYTES) {
			throw new InvalidAvatarError('Avatar output is too large')
		}
		return output
	} catch (error) {
		if (error instanceof InvalidAvatarError) throw error
		throw new InvalidAvatarError('Avatar image could not be decoded')
	}
}
