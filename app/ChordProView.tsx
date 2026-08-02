import { parseChordProBody, parseChordProHeader } from '@/lib/chordpro';
import { nashvilleToChord } from '@/lib/transpose';

const NBSP = ' ';

export type ViewKey = 'graus' | string;

interface KeySelect {
  options: string[];
  /** Highlighted em vermelho no combo, pra distinguir do `preferredKey`
   * (destacado em azul) — ver Discovery/setlists.md. */
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
  onEditCode,
}: {
  text: string;
  viewKey: ViewKey;
  preferredKey: string;
  sourceUrl?: string;
  showBeatMark?: boolean;
  /** Quando presente, o badge de tom vira um `<select>` editável (usado na
   * visualização de setlist, onde o tom por música pode ser ajustado
   * direto na tela) — sem isso, o badge é só texto (música individual). */
  keySelect?: KeySelect;
  /** Quando presente, mostra um link "Editar código" ao lado do link do
   * Cifra Club, que abre a música individual já no modo de código ChordPro
   * (usado na visualização de setlist — a música individual já tem sua
   * própria aba de código, então não precisa deste link). */
  onEditCode?: () => void;
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
      <p className="view-artist">
        {keySelect ? (
          <label className="badge badge-tom badge-select">
            Tom
            <select value={preferredKey} onChange={(e) => keySelect.onChange(e.target.value)}>
              {keySelect.options.map((k) => {
                const isOriginal = k === keySelect.originalKey;
                const isPreferred = k === preferredKey;
                return (
                  <option
                    key={k}
                    value={k}
                    style={{
                      color: isPreferred ? '#4f9dff' : isOriginal ? '#ff6b6b' : undefined,
                      fontWeight: isPreferred || isOriginal ? 700 : undefined,
                    }}
                  >
                    {k}
                    {isOriginal && !isPreferred ? ' (original)' : ''}
                  </option>
                );
              })}
            </select>
          </label>
        ) : (
          <span className="badge badge-tom">Tom: {preferredKey}</span>
        )}
        {header.artist && <span className="view-artist-name">{header.artist}</span>}
        {sourceUrl && (
          <a className="source-link" href={sourceUrl} target="_blank" rel="noreferrer">
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
            cifraclub
          </a>
        )}
        {onEditCode && (
          <button type="button" className="source-link" onClick={onEditCode}>
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z" />
            </svg>
            código
          </button>
        )}
      </p>
      {header.originalMinorKey && (
        <p className="key-disclaimer">
          A música original é em tom menor {header.originalMinorKey} e foi apresentada em{' '}
          {header.key} como grau 1.
        </p>
      )}
      {header.capo && (
        <p className="view-badges">
          <span className="badge">Capotraste: {header.capo}ª casa</span>
        </p>
      )}
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
          // Uma linha que só tem {tag} + acorde(s) sem letra (ex: "{Verso 1}
          // [1 | 4 | 1 | 47M]") não é um par "acorde em cima da sílaba" — é
          // rótulo + progressão. Empilhar em duas linhas (o layout normal de
          // chord-over-lyric) faria o rótulo e a progressão parecerem
          // desalinhados; aqui os dois ficam lado a lado, na mesma linha.
          const hasTag = line.chunks.some((c) => c.kind === 'tag');
          const hasRealLyric = line.chunks.some((c) => c.kind === 'chord' && c.lyric.trim() !== '');
          if (hasTag && !hasRealLyric) {
            return (
              <p key={i} className="view-line">
                {line.chunks
                  .filter((c) => c.kind === 'tag' || c.chord !== null)
                  .map((chunk, j) => (
                    <span key={j}>
                      {j > 0 && '  '}
                      {chunk.kind === 'tag' ? (
                        <span className="chunk-tag">{chunk.label}</span>
                      ) : (
                        <span
                          className={
                            chunk.chord!.includes('|')
                              ? 'chunk-chord chunk-chord-plain'
                              : 'chunk-chord'
                          }
                        >
                          {displayChord(chunk.chord!)}
                        </span>
                      )}
                    </span>
                  ))}
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
