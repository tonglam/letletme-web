export const CLIENT_SIGNAL_CIRCUIT_FAILURE_THRESHOLD = 3
export const CLIENT_SIGNAL_CIRCUIT_OPEN_MS = 60_000

export type ClientSignalForwardCircuit = {
	consecutiveFailures: number
	openedUntilMs: number
	halfOpenInFlight: boolean
}

export function createClientSignalForwardCircuit(): ClientSignalForwardCircuit {
	return {
		consecutiveFailures: 0,
		openedUntilMs: 0,
		halfOpenInFlight: false
	}
}

export function beginClientSignalForward(
	circuit: ClientSignalForwardCircuit,
	nowMs: number
): boolean {
	if (circuit.openedUntilMs > nowMs) return false
	if (circuit.openedUntilMs > 0) {
		if (circuit.halfOpenInFlight) return false
		circuit.halfOpenInFlight = true
	}
	return true
}

export function recordClientSignalForwardSuccess(
	circuit: ClientSignalForwardCircuit
): void {
	circuit.consecutiveFailures = 0
	circuit.openedUntilMs = 0
	circuit.halfOpenInFlight = false
}

export function recordClientSignalForwardFailure(
	circuit: ClientSignalForwardCircuit,
	nowMs: number
): void {
	const consecutiveFailures = circuit.consecutiveFailures + 1
	if (
		circuit.halfOpenInFlight ||
		consecutiveFailures >= CLIENT_SIGNAL_CIRCUIT_FAILURE_THRESHOLD
	) {
		circuit.consecutiveFailures = consecutiveFailures
		circuit.openedUntilMs = nowMs + CLIENT_SIGNAL_CIRCUIT_OPEN_MS
		circuit.halfOpenInFlight = false
		return
	}
	circuit.consecutiveFailures = consecutiveFailures
}
