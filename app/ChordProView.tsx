import { parseChordProBody, parseChordProHeader } from '@/lib/chordpro';

const NBSP = ' ';

export default function ChordProView({ text }: { text: string }) {
  const header = parseChordProHeader(text);
  const lines = parseChordProBody(text);

  return (
    <div className="chordpro-view">
      <h2 className="view-title">{header.title || 'Sem título'}</h2>
      {header.artist && <p className="view-artist">{header.artist}</p>}
      {(header.key || header.capo) && (
        <p className="view-badges">
          {header.key && <span className="badge">Tom: {header.key}</span>}
          {header.capo && <span className="badge">Capotraste: {header.capo}ª casa</span>}
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
          return (
            <div key={i} className="view-line chords-line">
              {line.chunks.map((chunk, j) => (
                <span className="chunk" key={j}>
                  <span className="chunk-chord">{chunk.chord ?? NBSP}</span>
                  <span className="chunk-lyric">
                    {chunk.chord !== null && chunk.lyric ? (
                      <>
                        <span className="chunk-lyric-highlight">{chunk.lyric.slice(0, 2)}</span>
                        {chunk.lyric.slice(2)}
                      </>
                    ) : (
                      chunk.lyric || NBSP
                    )}
                  </span>
                </span>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
