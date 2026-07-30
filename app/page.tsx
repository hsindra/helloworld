'use client';

import { useState } from 'react';
import type { SongLookupResponse } from '@/lib/types';

type Mode = 'search' | 'url';

export default function Home() {
  const [mode, setMode] = useState<Mode>('search');
  const [song, setSong] = useState('');
  const [artist, setArtist] = useState('');
  const [url, setUrl] = useState('');
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
      const body = mode === 'url' ? { url } : { song, artist };
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Erro ao buscar a música.');
        return;
      }
      const found = data.results as SongLookupResponse[];
      setResults(found);
      if (mode === 'url' && found.length === 1) setSelected(found[0]);
    } catch {
      setError('Falha de rede ao buscar a música.');
    } finally {
      setLoading(false);
    }
  }

  function handleDownload(result: SongLookupResponse) {
    const blob = new Blob([result.chordpro], { type: 'text/plain;charset=utf-8' });
    const downloadUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = `${result.artist} - ${result.title}.cho`;
    a.click();
    URL.revokeObjectURL(downloadUrl);
  }

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    setResults(null);
    setSelected(null);
  }

  return (
    <main>
      <h1>Cifra Club → ChordPro</h1>
      <p className="subtitle">
        Digite o nome da música (artista é opcional) ou cole direto a URL da página no Cifra
        Club. O app busca a cifra e monta o arquivo ChordPro (.cho).
      </p>

      <div className="mode-tabs">
        <button
          type="button"
          className={mode === 'search' ? 'tab active' : 'tab'}
          onClick={() => switchMode('search')}
        >
          Buscar por nome
        </button>
        <button
          type="button"
          className={mode === 'url' ? 'tab active' : 'tab'}
          onClick={() => switchMode('url')}
        >
          Colar URL
        </button>
      </div>

      {mode === 'search' ? (
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
      ) : (
        <form onSubmit={handleSubmit}>
          <input
            placeholder="https://www.cifraclub.com.br/artista/musica/"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            required
          />
          <button type="submit" disabled={loading}>
            {loading ? 'Buscando…' : 'Buscar'}
          </button>
        </form>
      )}

      {error && <p className="error">{error}</p>}

      {results && results.length > 1 && !selected && (
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
            {results && results.length > 1 && (
              <>
                {' · '}
                <button className="secondary" onClick={() => setSelected(null)}>
                  voltar aos resultados
                </button>
              </>
            )}
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
