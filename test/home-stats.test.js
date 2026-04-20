const test = require('node:test');
const assert = require('node:assert/strict');

const {
  formatTopScorerValue,
  getCurrentSeasonKey,
  pickEventOverallResult,
} = require('../lib/home-stats');

test('getCurrentSeasonKey returns the FPL season key for dates before August', () => {
  assert.equal(getCurrentSeasonKey(new Date('2026-04-19T00:00:00Z')), 2526);
});

test('getCurrentSeasonKey returns the FPL season key for dates from August onward', () => {
  assert.equal(getCurrentSeasonKey(new Date('2026-08-01T00:00:00Z')), 2627);
});

test('pickEventOverallResult returns the current event result from the season payload', () => {
  const results = [
    { event: 31, highestScore: 80 },
    { event: 32, highestScore: 91 },
    { event: 33, highestScore: 77 },
  ];

  assert.deepEqual(pickEventOverallResult(results, 32), {
    event: 32,
    highestScore: 91,
  });
});

test('formatTopScorerValue returns N/A when topElementInfo.player is null', () => {
  assert.equal(
    formatTopScorerValue({
      points: 13,
      player: null,
    }),
    'N/A',
  );
});

test('formatTopScorerValue returns formatted player and points when present', () => {
  assert.equal(
    formatTopScorerValue({
      points: 15,
      player: { webName: 'Salah' },
    }),
    'Salah (15)',
  );
});
