/** UTC instant for Monday 00:00 in India, where The Dailicle operates. */
export function startOfCurrentSupportWeek(now = new Date()): Date {
  const indiaOffsetMs = 5.5 * 60 * 60 * 1000;
  const indiaNow = new Date(now.getTime() + indiaOffsetMs);
  const daysSinceMonday = (indiaNow.getUTCDay() + 6) % 7;
  const mondayInShiftedUtc = Date.UTC(
    indiaNow.getUTCFullYear(),
    indiaNow.getUTCMonth(),
    indiaNow.getUTCDate() - daysSinceMonday
  );
  return new Date(mondayInShiftedUtc - indiaOffsetMs);
}
