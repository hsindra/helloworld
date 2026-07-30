import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chordsOverLyricsToChordPro, buildChordPro } from './chordpro.ts';

const sample = `(Intro) E  B  C#m  A

E                B
Tempo perdido, ninguém quer
C#m                    A
saber, mas nós vamos viver

E  B  C#m  A
`;

test('merges chord line into the lyric line at the right column', () => {
  const out = chordsOverLyricsToChordPro(sample);
  assert.match(out, /\[E\]Tempo perdido, ni\[B\]nguém quer/);
  assert.match(out, /\[C#m\]saber, mas nós vamos vi\[A\]ver/);
});

test('renders an instrumental-only chord line as bracketed chords', () => {
  const out = chordsOverLyricsToChordPro(sample);
  assert.match(out, /\[E\] \[B\] \[C#m\] \[A\]/);
});

test('strips Tom/Capotraste metadata lines from the body', () => {
  const withMeta = `Tom: Bm\nCapotraste na 2ª casa\n\nBm\nOla mundo\n`;
  const out = chordsOverLyricsToChordPro(withMeta);
  assert.doesNotMatch(out, /Tom:/);
  assert.doesNotMatch(out, /Capotraste/);
});

test('buildChordPro adds header directives', () => {
  const out = buildChordPro(
    { title: 'Tempo Perdido', artist: 'Legião Urbana', key: 'Bm', capo: '2' },
    sample
  );
  assert.match(out, /\{title: Tempo Perdido\}/);
  assert.match(out, /\{artist: Legião Urbana\}/);
  assert.match(out, /\{key: Bm\}/);
  assert.match(out, /\{capo: 2\}/);
});
