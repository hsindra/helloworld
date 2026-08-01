'use client';

import { useEffect, useMemo, useState } from 'react';
import type { SongLookupResponse } from '@/lib/types';
import { parseChordProHeader } from '@/lib/chordpro';
import { songMatchScore, MATCH_THRESHOLD } from '@/lib/fuzzyMatch';
import type { SavedSong } from '@/lib/store';
import ChordProView, { type ViewKey } from './ChordProView';

type Mode = 'search' | 'saved';
type ViewMode = 'view' | 'code';

const KEY_OPTIONS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

interface ViewerMeta {
  id?: string;
  sourceUrl?: string;
}

// Client-side heuristic only, to decide which field to send — doesn't import
// lib/cifraclub.ts here since that pulls in server-only scraping deps. The
// API route re-validates with the real normalizeCifraUrl().
function looksLikeCifraUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    return /(^|\.)cifraclub\.com\.br$/i.test(new URL(withScheme).hostname);
  } catch {
    return false;
  }
}

export default function Home() {
  const [mode, setMode] = useState<Mode>('search');
  const [song, setSong] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<SongLookupResponse[] | null>(null);

  const [chordpro, setChordpro] = useState<string | null>(null);
  const [viewerMeta, setViewerMeta] = useState<ViewerMeta>({});
  const [viewMode, setViewMode] = useState<ViewMode>('view');
  const [viewKey, setViewKey] = useState<ViewKey>('graus');
  const [showBeatMark, setShowBeatMark] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  const [savedSongs, setSavedSongs] = useState<SavedSong[] | null>(null);
  const [savedLoading, setSavedLoading] = useState(false);
  const [savedError, setSavedError] = useState<string | null>(null);

  const header = chordpro ? parseChordProHeader(chordpro) : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMode('search');
    setLoading(true);
    setError(null);
    setResults(null);
    closeViewer();
    try {
      const body = looksLikeCifraUrl(song) ? { url: song } : { song };
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
      if (found.length === 1) openResult(found[0]);
    } catch {
      setError('Falha de rede ao buscar a música.');
    } finally {
      setLoading(false);
    }
  }

  function openResult(result: SongLookupResponse) {
    setChordpro(result.chordpro);
    setViewerMeta({ id: result.id, sourceUrl: result.sourceUrl });
    setViewMode('view');
    setViewKey('graus');
    setSaveMessage(null);
    setDirty(false);
  }

  function openSaved(entry: SavedSong) {
    setChordpro(entry.chordpro);
    setViewerMeta({ id: entry.id, sourceUrl: entry.sourceUrl });
    setViewMode('view');
    setViewKey('graus');
    setSaveMessage(null);
    setDirty(false);
  }

  function closeViewer() {
    setChordpro(null);
    setViewerMeta({});
    setViewKey('graus');
    setSaveMessage(null);
    setDirty(false);
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
      setDirty(false);
      if (savedSongs) loadSavedSongs();
    } catch {
      setSaveMessage('Falha de rede ao salvar.');
    } finally {
      setSaving(false);
    }
  }

  // Auto-save: while editing the raw ChordPro code, persist automatically a
  // moment after the user stops typing (creates the song on first edit if it
  // isn't saved yet, same as the manual save button).
  useEffect(() => {
    if (!dirty || viewMode !== 'code' || saving) return;
    const timer = setTimeout(() => {
      handleSave();
    }, 1200);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chordpro, dirty, viewMode, saving]);

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

  // Carrega as músicas salvas assim que a tela abre (não só ao trocar de aba),
  // pra já ter dados disponíveis pro autocomplete enquanto o usuário digita.
  useEffect(() => {
    loadSavedSongs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sugestões de músicas já salvas, calculadas ao vivo enquanto o usuário
  // digita (não precisa ser um match exato/completo).
  const typeaheadMatches = useMemo(() => {
    const query = song.trim();
    if (query.length < 2 || !savedSongs || results) return [];
    return savedSongs
      .map((s) => ({ s, score: songMatchScore(query, s.title, s.artist) }))
      .filter((m) => m.score >= MATCH_THRESHOLD)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map((m) => m.s);
  }, [song, savedSongs, results]);

  function openTypeaheadMatch(entry: SavedSong) {
    setSong('');
    openSaved(entry);
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
      {!chordpro && <h1>CifraX</h1>}

      <div className="search-field">
        <form onSubmit={handleSubmit}>
          <input
            placeholder="Música, artista + música, ou cole uma URL do Cifra Club"
            value={song}
            onChange={(e) => setSong(e.target.value)}
            autoComplete="off"
            required
          />
          <button type="submit" disabled={loading}>
            {loading ? 'Buscando…' : 'Buscar'}
          </button>
        </form>

        {typeaheadMatches.length > 0 && (
          <ul className="typeahead">
            {typeaheadMatches.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  className="result-item"
                  onClick={() => openTypeaheadMatch(s)}
                >
                  <span className="result-title">
                    {s.title} <span className="badge">Salva</span>
                  </span>
                  <span className="result-artist">{s.artist}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mode-tabs">
        <button
          type="button"
          className={mode === 'saved' ? 'tab active' : 'tab'}
          onClick={() => switchMode(mode === 'saved' ? 'search' : 'saved')}
        >
          Minhas músicas
        </button>
      </div>

      {mode === 'search' && error && <p className="error">{error}</p>}

      {mode !== 'saved' && results && results.length > 1 && !chordpro && (
        <ul className="results">
          {results.map((r) => (
            <li key={r.sourceUrl}>
              <button className="result-item" onClick={() => openResult(r)}>
                <span className="result-title">
                  {r.title} {r.id && <span className="badge">Salva</span>}
                </span>
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
              aria-label="Visualização"
              title="Visualização"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M9 18V5l12-2v13" />
                <circle cx="6" cy="18" r="3" />
                <circle cx="18" cy="16" r="3" />
              </svg>
            </button>
            <button
              type="button"
              className={viewMode === 'code' ? 'tab active' : 'tab'}
              onClick={() => setViewMode('code')}
              aria-label="Código ChordPro"
              title="Código ChordPro"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="16 18 22 12 16 6" />
                <polyline points="8 6 2 12 8 18" />
              </svg>
            </button>
            {viewMode === 'view' && (
              <>
                <label className="key-selector">
                  Tom:
                  <select value={viewKey} onChange={(e) => setViewKey(e.target.value)}>
                    <option value="graus">Graus</option>
                    {KEY_OPTIONS.map((k) => (
                      <option key={k} value={k}>
                        {k}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="beat-mark-toggle">
                  <input
                    type="checkbox"
                    checked={showBeatMark}
                    onChange={(e) => setShowBeatMark(e.target.checked)}
                  />
                  Compasso
                </label>
                {viewerMeta.id && (
                  <button
                    type="button"
                    className="secondary danger"
                    onClick={() => handleDeleteSaved(viewerMeta.id!)}
                    title="Apagar"
                  >
                    Apagar
                  </button>
                )}
              </>
            )}
          </div>

          {viewMode === 'code' ? (
            <textarea
              value={chordpro}
              onChange={(e) => {
                setChordpro(e.target.value);
                setDirty(true);
                setSaveMessage(null);
              }}
            />
          ) : (
            <ChordProView text={chordpro} viewKey={viewKey} showBeatMark={showBeatMark} />
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
