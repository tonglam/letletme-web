import { PayloadTooLargeError, readBoundedJson } from '@/lib/http-security-core'

export class InvalidBugReportJsonError extends Error {
	constructor() {
		super('Invalid JSON body')
		this.name = 'InvalidBugReportJsonError'
	}
}

export async function readBugReportJson(
	request: Request,
	maxBytes: number
): Promise<unknown> {
	try {
		return await readBoundedJson(request, maxBytes)
	} catch (error) {
		if (error instanceof PayloadTooLargeError) throw error
		throw new InvalidBugReportJsonError()
	}
}
