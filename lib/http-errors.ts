export class PayloadTooLargeError extends Error {
	constructor(readonly maxBytes: number) {
		super(`Request body exceeds ${maxBytes} bytes`)
		this.name = 'PayloadTooLargeError'
	}
}

export class ResponseReadAbortedError extends Error {
	constructor() {
		super('Response body read was aborted')
		this.name = 'ResponseReadAbortedError'
	}
}
