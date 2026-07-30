import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  chordsOverLyricsToChordPro,
  buildChordPro,
  parseChordProHeader,
  parseChordProBody,
} from './chordpro.ts';

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

test('parseChordProHeader reads directives wherever they are', () => {
  const doc = buildChordPro(
    { title: 'Tempo Perdido', artist: 'Legião Urbana', key: 'Bm', capo: '2' },
    sample
  );
  const header = parseChordProHeader(doc);
  assert.equal(header.title, 'Tempo Perdido');
  assert.equal(header.artist, 'Legião Urbana');
  assert.equal(header.key, 'Bm');
  assert.equal(header.capo, '2');
});

test('parseChordProBody splits chord/lyric chunks and passes through plain lines', () => {
  const body = parseChordProBody('[E]Tempo perdido, ni[B]nguém quer\n\nlinha sem acorde');
  assert.equal(body.length, 3);
  assert.deepEqual(body[0], {
    type: 'chords',
    chunks: [
      { chord: 'E', lyric: 'Tempo perdido, ni' },
      { chord: 'B', lyric: 'nguém quer' },
    ],
  });
  assert.deepEqual(body[1], { type: 'blank' });
  assert.deepEqual(body[2], { type: 'text', text: 'linha sem acorde' });
});

test('parseChordProBody handles a chord with no following lyric', () => {
  const body = parseChordProBody('[E] [B] [C#m] [A]');
  assert.deepEqual(body[0], {
    type: 'chords',
    chunks: [
      { chord: 'E', lyric: ' ' },
      { chord: 'B', lyric: ' ' },
      { chord: 'C#m', lyric: ' ' },
      { chord: 'A', lyric: '' },
    ],
  });
});
