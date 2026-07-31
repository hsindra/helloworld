'use client';

import { useState } from 'react';
import type { SongLookupResponse } from '@/lib/types';
import { parseChordProHeader } from '@/lib/chordpro';
import type { SavedSong } from '@/lib/store';
import ChordProView from './ChordProView';

type Mode = 'search' | 'url' | 'saved';
type ViewMode = 'view' | 'code';

interface ViewerMeta {
  id?: string;
  sourceUrl?: string;
}

export default function Home() {
  const [mode, setMode] = useState<Mode>('search');
  const [song, setSong] = useState('');
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<SongLookupResponse[] | null>(null);

  const [chordpro, setChordpro] = useState<string | null>(null);
  const [viewerMeta, setViewerMeta] = useState<ViewerMeta>({});
  const [viewMode, setViewMode] = useState<ViewMode>('view');
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const [savedSongs, setSavedSongs] = useState<SavedSong[] | null>(null);
  const [savedLoading, setSavedLoading] = useState(false);
  const [savedError, setSavedError] = useState<string | null>(null);

  const header = chordpro ? parseChordProHeader(chordpro) : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResults(null);
    closeViewer();
    try {
      const body = mode === 'url' ? { url } : { song };
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
      if (mode === 'url' && found.length === 1) openResult(found[0]);
    } catch {
      setError('Falha de rede ao buscar a música.');
    } finally {
      setLoading(false);
    }
  }

  function openResult(result: SongLookupResponse) {
    setChordpro(result.chordpro);
    setViewerMeta({ sourceUrl: result.sourceUrl });
    setViewMode('view');
    setSaveMessage(null);
  }

  function openSaved(entry: SavedSong) {
    setChordpro(entry.chordpro);
    setViewerMeta({ id: entry.id, sourceUrl: entry.sourceUrl });
    setViewMode('view');
    setSaveMessage(null);
  }

  function closeViewer() {
    setChordpro(null);
    setViewerMeta({});
    setSaveMessage(null);
  }

  function handleDownload() {
    if (!chordpro || !header) return;
    const blob = new Blob([chordpro], { type: 'text/plain;charset=utf-8' });
    const downloadUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = `${header.artist || 'Artista'} - ${header.title || 'musica'}.cho`;
    a.click();
    URL.revokeObjectURL(downloadUrl);
  }

  async function handleSave() {
    if (!chordpro || !header) return;
    setSaving(true);
    setSaveMessage(null);
    try {
      const endpoint = viewerMeta.id ? `/api/songs/${viewerMeta.id}` : '/api/songs';
      const method = viewerMeta.id ? 'PUT' : 'POST';
      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: header.title || 'Sem título',
          artist: header.artist || '',
          key: header.key,
          capo: header.capo,
          sourceUrl: viewerMeta.sourceUrl,
          chordpro,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSaveMessage(data.error || 'Erro ao salvar.');
        return;
      }
      setViewerMeta((m) => ({ ...m, id: data.song.id }));
      setSaveMessage('Salvo!');
      if (savedSongs) loadSavedSongs();
    } catch {
      setSaveMessage('Falha de rede ao salvar.');
    } finally {
      setSaving(false);
    }
  }

  async function loadSavedSongs() {
    setSavedLoading(true);
    setSavedError(null);
    try {
      const res = await fetch('/api/songs');
      const data = await res.json();
      if (!res.ok) {
        setSavedError(data.error || 'Erro ao carregar músicas salvas.');
        return;
      }
      setSavedSongs(data.songs as SavedSong[]);
    } catch {
      setSavedError('Falha de rede ao carregar músicas salvas.');
    } finally {
      setSavedLoading(false);
    }
  }

  async function handleDeleteSaved(id: string) {
    await fetch(`/api/songs/${id}`, { method: 'DELETE' }).catch(() => null);
    setSavedSongs((list) => list?.filter((s) => s.id !== id) ?? null);
    if (viewerMeta.id === id) closeViewer();
  }

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    setResults(null);
    closeViewer();
    if (next === 'saved') loadSavedSongs();
  }

  return (
    <main>
      <h1>Cifra Club → ChordPro</h1>
      <p className="subtitle">
        Digite o nome da música (pode incluir o artista), cole a URL do Cifra Club, ou acesse
        suas músicas salvas.
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
        <button
          type="button"
          className={mode === 'saved' ? 'tab active' : 'tab'}
          onClick={() => switchMode('saved')}
        >
          Minhas músicas
        </button>
      </div>

      {mode === 'search' && (
        <form onSubmit={handleSubmit}>
          <input
            placeholder="Música ou artista + música (ex: Maravilhosa Graça, Aline Barros)"
            value={song}
            onChange={(e) => setSong(e.target.value)}
            required
          />
          <button type="submit" disabled={loading}>
            {loading ? 'Buscando…' : 'Buscar'}
          </button>
        </form>
      )}

      {mode === 'url' && (
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

      {(mode === 'search' || mode === 'url') && error && <p className="error">{error}</p>}

      {mode !== 'saved' && results && results.length > 1 && !chordpro && (
        <ul className="results">
          {results.map((r) => (
            <li key={r.sourceUrl}>
              <button className="result-item" onClick={() => openResult(r)}>
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

      {mode === 'saved' && !chordpro && (
        <>
          {savedLoading && <p className="meta">Carregando…</p>}
          {savedError && <p className="error">{savedError}</p>}
          {savedSongs && savedSongs.length === 0 && !savedLoading && (
            <p className="meta">Nenhuma música salva ainda.</p>
          )}
          {savedSongs && savedSongs.length > 0 && (
            <ul className="results">
              {savedSongs.map((s) => (
                <li key={s.id} className="saved-item">
                  <button className="result-item" onClick={() => openSaved(s)}>
                    <span className="result-title">{s.title}</span>
                    <span className="result-artist">{s.artist}</span>
                  </button>
                  <button
                    className="secondary danger"
                    onClick={() => handleDeleteSaved(s.id)}
                    title="Apagar"
                  >
                    Apagar
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {chordpro && header && (
        <>
          <p className="meta">
            {header.title || 'Sem título'} — {header.artist || 'Artista desconhecido'}
            {header.key ? ` · Tom: ${header.key}` : ''}
            {header.capo ? ` · Capotraste: ${header.capo}ª casa` : ''}
            {viewerMeta.sourceUrl && (
              <>
                {' · '}
                <a href={viewerMeta.sourceUrl} target="_blank" rel="noreferrer">
                  fonte
                </a>
              </>
            )}
            {' · '}
            <button className="secondary" onClick={closeViewer}>
              voltar
            </button>
          </p>

          <div className="view-tabs">
            <button
              type="button"
              className={viewMode === 'view' ? 'tab active' : 'tab'}
              onClick={() => setViewMode('view')}
            >
              Visualização
            </button>
            <button
              type="button"
              className={viewMode === 'code' ? 'tab active' : 'tab'}
              onClick={() => setViewMode('code')}
            >
              Código ChordPro
            </button>
          </div>

          {viewMode === 'code' ? (
            <textarea value={chordpro} onChange={(e) => setChordpro(e.target.value)} />
          ) : (
            <ChordProView text={chordpro} />
          )}

          <div className="actions">
            <button onClick={handleDownload}>Baixar .cho</button>
            <button className="secondary" onClick={handleSave} disabled={saving}>
              {saving ? 'Salvando…' : viewerMeta.id ? 'Salvar alterações' : 'Salvar música'}
            </button>
            {saveMessage && <span className="save-message">{saveMessage}</span>}
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
