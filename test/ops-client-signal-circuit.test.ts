import assert from 'node:assert/strict'
import test from 'node:test'

import {
	beginClientSignalForward,
	createClientSignalForwardCircuit,
	recordClientSignalForwardFailure,
	recordClientSignalForwardSuccess,
	CLIENT_SIGNAL_CIRCUIT_OPEN_MS
} from '../lib/ops-client-signal-circuit'

test('client signal circuit opens after three failures and recovers half-open', () => {
	const circuit = createClientSignalForwardCircuit()
	const now = 1_000_000

	assert.equal(beginClientSignalForward(circuit, now), true)
	recordClientSignalForwardFailure(circuit, now)
	assert.equal(beginClientSignalForward(circuit, now), true)
	recordClientSignalForwardFailure(circuit, now)
	assert.equal(beginClientSignalForward(circuit, now), true)
	recordClientSignalForwardFailure(circuit, now)

	assert.equal(beginClientSignalForward(circuit, now + 1), false)
	assert.equal(
		beginClientSignalForward(circuit, now + CLIENT_SIGNAL_CIRCUIT_OPEN_MS),
		true
	)
	assert.equal(
		beginClientSignalForward(circuit, now + CLIENT_SIGNAL_CIRCUIT_OPEN_MS),
		false,
		'only one half-open request may run'
	)
	recordClientSignalForwardSuccess(circuit)
	assert.equal(beginClientSignalForward(circuit, now), true)
})
