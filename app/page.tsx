'use client';

import { useState } from 'react';
import type { SongLookupResponse } from '@/lib/types';

export default function Home() {
  const [song, setSong] = useState('');
  const [artist, setArtist] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<SongLookupResponse[] | null>(null);
  const [selected, setSelected] = useState<SongLookupResponse | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResults(null);
    setSelected(null);
    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ song, artist }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Erro ao buscar a música.');
        return;
      }
      setResults(data.results as SongLookupResponse[]);
    } catch {
      setError('Falha de rede ao buscar a música.');
    } finally {
      setLoading(false);
    }
  }

  function handleDownload(result: SongLookupResponse) {
    const blob = new Blob([result.chordpro], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${result.artist} - ${result.title}.cho`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main>
      <h1>Cifra Club → ChordPro</h1>
      <p className="subtitle">
        Digite o nome da música (artista é opcional, ajuda a filtrar). O app busca no Cifra
        Club e mostra os resultados encontrados para você escolher.
      </p>

      <form onSubmit={handleSubmit}>
        <input
          placeholder="Música (ex: Maravilhosa Graça)"
          value={song}
          onChange={(e) => setSong(e.target.value)}
          required
        />
        <input
          placeholder="Artista (opcional)"
          value={artist}
          onChange={(e) => setArtist(e.target.value)}
        />
        <button type="submit" disabled={loading}>
          {loading ? 'Buscando…' : 'Buscar'}
        </button>
      </form>

      {error && <p className="error">{error}</p>}

      {results && !selected && (
        <ul className="results">
          {results.map((r) => (
            <li key={r.sourceUrl}>
              <button className="result-item" onClick={() => setSelected(r)}>
                <span className="result-title">{r.title}</span>
                <span className="result-artist">
                  {r.artist}
                  {r.key ? ` · Tom: ${r.key}` : ''}
                  {r.capo ? ` · Capotraste: ${r.capo}ª casa` : ''}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {selected && (
        <>
          <p className="meta">
            {selected.title} — {selected.artist}
            {selected.key ? ` · Tom: ${selected.key}` : ''}
            {selected.capo ? ` · Capotraste: ${selected.capo}ª casa` : ''}
            {' · '}
            <a href={selected.sourceUrl} target="_blank" rel="noreferrer">
              fonte
            </a>
            {' · '}
            <button className="secondary" onClick={() => setSelected(null)}>
              voltar aos resultados
            </button>
          </p>
          <textarea readOnly value={selected.chordpro} />
          <div className="actions">
            <button onClick={() => handleDownload(selected)}>Baixar .cho</button>
          </div>
        </>
      )}

      <footer className="disclaimer">
        Uso pessoal/educacional. Letras e cifras pertencem aos respectivos autores e ao Cifra
        Club — respeite os direitos autorais ao compartilhar os arquivos gerados.
      </footer>
    </main>
  );
}
