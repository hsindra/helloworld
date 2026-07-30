'use client';

import { useState } from 'react';
import type { SongLookupResponse } from '@/lib/types';

export default function Home() {
  const [artist, setArtist] = useState('');
  const [song, setSong] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SongLookupResponse | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch('/api/chordpro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ artist, song }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Erro ao buscar a música.');
        return;
      }
      setResult(data as SongLookupResponse);
    } catch {
      setError('Falha de rede ao buscar a música.');
    } finally {
      setLoading(false);
    }
  }

  function handleDownload() {
    if (!result) return;
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
        Digite o artista e a música. O app busca a cifra no Cifra Club e monta o arquivo
        ChordPro (.cho) com letra e acordes.
      </p>

      <form onSubmit={handleSubmit}>
        <input
          placeholder="Artista (ex: Legião Urbana)"
          value={artist}
          onChange={(e) => setArtist(e.target.value)}
          required
        />
        <input
          placeholder="Música (ex: Tempo Perdido)"
          value={song}
          onChange={(e) => setSong(e.target.value)}
          required
        />
        <button type="submit" disabled={loading}>
          {loading ? 'Buscando…' : 'Buscar'}
        </button>
      </form>

      {error && <p className="error">{error}</p>}

      {result && (
        <>
          <p className="meta">
            {result.title} — {result.artist}
            {result.key ? ` · Tom: ${result.key}` : ''}
            {result.capo ? ` · Capotraste: ${result.capo}ª casa` : ''}
            {' · '}
            <a href={result.sourceUrl} target="_blank" rel="noreferrer">
              fonte
            </a>
          </p>
          <textarea readOnly value={result.chordpro} />
          <div className="actions">
            <button onClick={handleDownload}>Baixar .cho</button>
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
