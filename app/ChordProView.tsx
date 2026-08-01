import { parseChordProBody, parseChordProHeader } from '@/lib/chordpro';
import { nashvilleToChord } from '@/lib/transpose';

const NBSP = ' ';

export type ViewKey = 'graus' | string;

interface KeySelect {
  options: string[];
  /** Highlighted em vermelho no combo, pra distinguir do `preferredKey`
   * (destacado em azul) — ver Discovery/checklists.md. */
  originalKey?: string;
  onChange: (key: string) => void;
}

export default function ChordProView({
  text,
  viewKey,
  preferredKey,
  sourceUrl,
  showBeatMark = true,
  keySelect,
}: {
  text: string;
  viewKey: ViewKey;
  preferredKey: string;
  sourceUrl?: string;
  showBeatMark?: boolean;
  /** Quando presente, o badge de tom vira um `<select>` editável (usado na
   * visualização de checklist, onde o tom por música pode ser ajustado
   * direto na tela) — sem isso, o badge é só texto (música individual). */
  keySelect?: KeySelect;
}) {
  const header = parseChordProHeader(text);
  const lines = parseChordProBody(text);

  function displayChord(chord: string): string {
    const clean = chord.endsWith('.') ? chord.slice(0, -1) : chord;
    if (viewKey === 'graus') return clean;
    try {
      return nashvilleToChord(clean, viewKey);
    } catch {
      return clean;
    }
  }

  return (
    <div className="chordpro-view">
      <h2 className="view-title">{header.title || 'Sem título'}</h2>
      {header.artist && (
        <p className="view-artist">
          {header.artist}
          {sourceUrl && (
            <>
              {' · '}
              <a href={sourceUrl} target="_blank" rel="noreferrer">
                fonte
              </a>
            </>
          )}
        </p>
      )}
      <p className="view-badges">
        {keySelect ? (
          <label className="badge badge-select">
            Tom
            <select value={preferredKey} onChange={(e) => keySelect.onChange(e.target.value)}>
              {keySelect.options.map((k) => (
                <option
                  key={k}
                  value={k}
                  style={{
                    color:
                      k === preferredKey
                        ? '#4f9dff'
                        : k === keySelect.originalKey
                          ? '#ff6b6b'
                          : undefined,
                    fontWeight: k === preferredKey || k === keySelect.originalKey ? 700 : undefined,
                  }}
                >
                  {k}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <span className="badge">Tom: {preferredKey}</span>
        )}
        {header.capo && <span className="badge">Capotraste: {header.capo}ª casa</span>}
      </p>
      <div className="view-body">
        {lines.map((line, i) => {
          if (line.type === 'blank') return <div key={i} className="view-blank" />;
          if (line.type === 'text') {
            return (
              <p key={i} className="view-line">
                {line.text}
              </p>
            );
          }
          return (
            <div key={i} className="view-line chords-line">
              {line.chunks.map((chunk, j) =>
                chunk.kind === 'tag' ? (
                  <span className="chunk" key={j}>
                    <span className="chunk-chord">{NBSP}</span>
                    <span className="chunk-lyric chunk-tag">{chunk.label}</span>
                  </span>
                ) : (
                  <span className="chunk" key={j}>
                    <span
                      className={
                        chunk.chord !== null && chunk.chord.includes('|')
                          ? 'chunk-chord chunk-chord-plain'
                          : 'chunk-chord'
                      }
                    >
                      {chunk.chord !== null ? displayChord(chunk.chord) : NBSP}
                    </span>
                    <span className="chunk-lyric">
                      {chunk.chord !== null &&
                      chunk.lyric &&
                      showBeatMark &&
                      !chunk.chord.endsWith('.') &&
                      !chunk.chord.includes('|') ? (
                        <>
                          <span className="chunk-lyric-highlight">{chunk.lyric.slice(0, 2)}</span>
                          {chunk.lyric.slice(2)}
                        </>
                      ) : (
                        chunk.lyric || NBSP
                      )}
                    </span>
                  </span>
                )
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
