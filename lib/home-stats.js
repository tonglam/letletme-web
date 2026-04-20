/**
 * @typedef {{ event?: number }} EventResultLike
 */

/**
 * @typedef {{
 *   points?: number | null,
 *   player?: { webName?: string | null } | null
 * } | null | undefined} TopElementInfoLike
 */

/**
 * Get the current FPL season key in YYYY format, e.g. 2526 for 2025/26.
 * Premier League seasons roll over in August.
 *
 * @param {Date} [date]
 * @returns {number}
 */
function getCurrentSeasonKey(date = new Date()) {
  const month = date.getMonth() + 1;
  const year = date.getFullYear();

  if (month >= 8) {
    return Number(`${year.toString().slice(-2)}${(year + 1).toString().slice(-2)}`);
  }

  return Number(`${(year - 1).toString().slice(-2)}${year.toString().slice(-2)}`);
}

/**
 * Pick the result for the requested event from a season payload.
 * If that event is missing, fall back to the latest available event up to that id.
 *
 * @template {EventResultLike} T
 * @param {T[] | T | null | undefined} results
 * @param {number} eventId
 * @returns {T | null}
 */
function pickEventOverallResult(results, eventId) {
  const list = Array.isArray(results)
    ? results.filter(Boolean)
    : results
      ? [results]
      : [];

  const exact = list.find((result) => result.event === eventId);
  if (exact) {
    return exact;
  }

  const upToCurrent = list
    .filter((result) => typeof result.event === 'number' && result.event <= eventId)
    .sort((a, b) => /** @type {number} */ (b.event) - /** @type {number} */ (a.event));

  if (upToCurrent.length > 0) {
    return upToCurrent[0];
  }

  const descending = [...list].sort(
    (a, b) => (typeof b.event === 'number' ? b.event : -1) - (typeof a.event === 'number' ? a.event : -1),
  );

  return descending[0] ?? null;
}

/**
 * Format the top-scorer label from GraphQL event overall result data.
 *
 * @param {TopElementInfoLike} topElementInfo
 * @returns {string}
 */
function formatTopScorerValue(topElementInfo) {
  const webName = topElementInfo?.player?.webName;
  const points = topElementInfo?.points;

  if (!webName || typeof points !== 'number') {
    return 'N/A';
  }

  return `${webName} (${points})`;
}

module.exports = {
  formatTopScorerValue,
  getCurrentSeasonKey,
  pickEventOverallResult,
};
