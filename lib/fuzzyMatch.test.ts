import { test } from 'node:test';
import assert from 'node:assert/strict';
import { songMatchScore, MATCH_THRESHOLD } from './fuzzyMatch.ts';

test('scores a full title+artist match at 1', () => {
  assert.equal(songMatchScore('só tu és santo morada', 'Só Tu És Santo', 'MORADA'), 1);
});

test('matches on partial/prefix typing (typeahead case)', () => {
  const score = songMatchScore('so tu san', 'Só Tu És Santo', 'MORADA');
  assert.ok(score >= MATCH_THRESHOLD, `expected >= ${MATCH_THRESHOLD}, got ${score}`);
});

test('scores unrelated query low', () => {
  const score = songMatchScore('águas purificadoras', 'Só Tu És Santo', 'MORADA');
  assert.ok(score < MATCH_THRESHOLD, `expected < ${MATCH_THRESHOLD}, got ${score}`);
});

test('empty query scores 0', () => {
  assert.equal(songMatchScore('', 'Só Tu És Santo', 'MORADA'), 0);
});
