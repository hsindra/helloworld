import { slugify } from './slugify.ts';

/** Minimum score (see songMatchScore) for a saved song to be considered a
 * match — chosen to tolerate typos/partial words without surfacing unrelated
 * songs. */
export const MATCH_THRESHOLD = 0.5;

/** Rough 0-1 fuzzy match between what the user typed and a song's title +
 * artist. Tolerant of partial words (so it also works for live typeahead
 * while the user is still typing) and doesn't require an exact match. */
export function songMatchScore(query: string, title: string, artist: string): number {
  const queryTokens = slugify(query).split('-').filter(Boolean);
  if (queryTokens.length === 0) return 0;
  const targetTokens = slugify(`${artist} ${title}`).split('-').filter(Boolean);
  if (targetTokens.length === 0) return 0;

  const matched = queryTokens.filter((qt) =>
    targetTokens.some((tt) => tt.includes(qt) || qt.includes(tt))
  );
  return matched.length / queryTokens.length;
}
