'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { SongLookupResponse } from '@/lib/types';
import { parseChordProHeader } from '@/lib/chordpro';
import { songMatchScore, MATCH_THRESHOLD } from '@/lib/fuzzyMatch';
import type { SavedSong } from '@/lib/store';
import ChordProView from './ChordProView';

type Mode = 'search' | 'saved';
type ViewMode = 'view' | 'code';

const KEY_OPTIONS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

/** Falls back to the first concrete key when the song's original/saved key
 * isn't one of the ones the preferred-key combo offers (e.g. a minor key). */
function normalizeKey(key: string | undefined): string {
  return key && KEY_OPTIONS.includes(key) ? key : KEY_OPTIONS[0];
}

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
  const [mode, setMode] = useState<Mode>('saved');
  const [song, setSong] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<SongLookupResponse[] | null>(null);

  const [chordpro, setChordpro] = useState<string | null>(null);
  const [viewerMeta, setViewerMeta] = useState<ViewerMeta>({});
  const [viewMode, setViewMode] = useState<ViewMode>('view');
  const [showGrau, setShowGrau] = useState(true);
  const [preferredKey, setPreferredKey] = useState<string>(KEY_OPTIONS[0]);
  const [showBeatMark, setShowBeatMark] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [showSaveCopy, setShowSaveCopy] = useState(false);
  const [copyTitle, setCopyTitle] = useState('');
  const [copySaving, setCopySaving] = useState(false);

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
    setShowGrau(true);
    setPreferredKey(normalizeKey(result.preferredKey || result.key));
    setSaveMessage(null);
    setDirty(false);
    setMenuOpen(false);
  }

  function openSaved(entry: SavedSong) {
    setChordpro(entry.chordpro);
    setViewerMeta({ id: entry.id, sourceUrl: entry.sourceUrl });
    setViewMode('view');
    setShowGrau(true);
    setPreferredKey(normalizeKey(entry.preferredKey || entry.key));
    setSaveMessage(null);
    setDirty(false);
    setMenuOpen(false);
  }

  function closeViewer() {
    setChordpro(null);
    setViewerMeta({});
    setShowGrau(true);
    setPreferredKey(KEY_OPTIONS[0]);
    setSaveMessage(null);
    setDirty(false);
    setMenuOpen(false);
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
          preferredKey,
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

  // Muda o tom preferencial imediatamente na tela e, se a música já estiver
  // salva, persiste em segundo plano — sem exigir um "Salvar" manual.
  async function handlePreferredKeyChange(newKey: string) {
    setPreferredKey(newKey);
    if (!chordpro || !header || !viewerMeta.id) return;
    try {
      await fetch(`/api/songs/${viewerMeta.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: header.title || 'Sem título',
          artist: header.artist || '',
          key: header.key,
          preferredKey: newKey,
          capo: header.capo,
          sourceUrl: viewerMeta.sourceUrl,
          chordpro,
        }),
      });
      if (savedSongs) loadSavedSongs();
    } catch {
      // Best-effort: a escolha já vale pra sessão atual mesmo se a
      // persistência falhar; o usuário pode tentar de novo depois.
    }
  }

  async function handleSaveCopy() {
    if (!chordpro || !header) return;
    const title = copyTitle.trim() || `${header.title || 'Sem título'}_copy`;
    setCopySaving(true);
    setSaveMessage(null);
    try {
      const titledChordpro = /^\s*\{title:[^}]*\}\s*$/im.test(chordpro)
        ? chordpro.replace(/^\s*\{title:[^}]*\}\s*$/im, `{title: ${title}}`)
        : chordpro;
      const res = await fetch('/api/songs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          artist: header.artist || '',
          key: header.key,
          preferredKey,
          capo: header.capo,
          sourceUrl: viewerMeta.sourceUrl,
          chordpro: titledChordpro,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSaveMessage(data.error || 'Erro ao salvar cópia.');
        return;
      }
      setChordpro(titledChordpro);
      setViewerMeta((m) => ({ ...m, id: data.song.id }));
      setSaveMessage('Cópia salva!');
      setShowSaveCopy(false);
      setMenuOpen(false);
      loadSavedSongs();
    } catch {
      setSaveMessage('Falha de rede ao salvar cópia.');
    } finally {
      setCopySaving(false);
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

  const savedSongsAlphabetical = useMemo(() => {
    if (!savedSongs) return null;
    return [...savedSongs].sort((a, b) => a.title.localeCompare(b.title, 'pt-BR'));
  }, [savedSongs]);

  // Fecha o menu de opções da música ao clicar fora dele.
  useEffect(() => {
    if (!menuOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  // Fecha o formulário de "salvar cópia" junto com o menu.
  useEffect(() => {
    if (!menuOpen) setShowSaveCopy(false);
  }, [menuOpen]);

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
          {savedSongsAlphabetical && savedSongsAlphabetical.length === 0 && !savedLoading && (
            <p className="meta">Nenhuma música salva ainda.</p>
          )}
          {savedSongsAlphabetical && savedSongsAlphabetical.length > 0 && (
            <ul className="results">
              {savedSongsAlphabetical.map((s) => (
                <li key={s.id} className="saved-item">
                  <button className="result-item" onClick={() => openSaved(s)}>
                    <span className="result-title">{s.title}</span>
                    <span className="badge">Tom: {s.preferredKey || s.key}</span>
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
          <button type="button" className="back-button" onClick={closeViewer} aria-label="Voltar" title="Voltar">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>

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
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <path d="M10.478 1.647a.5.5 0 1 0-.956-.294l-4 13a.5.5 0 0 0 .956.294l4-13zM4.854 4.146a.5.5 0 0 1 0 .708L1.707 8l3.147 3.146a.5.5 0 0 1-.708.708l-3.5-3.5a.5.5 0 0 1 0-.708l3.5-3.5a.5.5 0 0 1 .708 0zm6.292 0a.5.5 0 0 0 0 .708L14.293 8l-3.147 3.146a.5.5 0 0 0 .708.708l3.5-3.5a.5.5 0 0 0 0-.708l-3.5-3.5a.5.5 0 0 0-.708 0z" />
              </svg>
            </button>

            {saveMessage && <span className="save-message">{saveMessage}</span>}

            <div className="menu-wrap" ref={menuRef}>
              <button
                type="button"
                className="tab"
                aria-label="Menu"
                title="Menu"
                aria-haspopup="true"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((v) => !v)}
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
                  <line x1="3" y1="6" x2="21" y2="6" />
                  <line x1="3" y1="12" x2="21" y2="12" />
                  <line x1="3" y1="18" x2="21" y2="18" />
                </svg>
              </button>

              {menuOpen && (
                <div className="menu-dropdown">
                  <label className="menu-toggle">
                    <svg
                      className="menu-icon"
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <line x1="4" y1="9" x2="20" y2="9" />
                      <line x1="4" y1="15" x2="20" y2="15" />
                      <line x1="10" y1="3" x2="8" y2="21" />
                      <line x1="16" y1="3" x2="14" y2="21" />
                    </svg>
                    Grau
                    <span className="switch">
                      <input
                        type="checkbox"
                        checked={showGrau}
                        onChange={(e) => setShowGrau(e.target.checked)}
                      />
                      <span className="switch-track" />
                    </span>
                  </label>
                  <label className="key-selector">
                    <svg
                      className="menu-icon"
                      width="14"
                      height="14"
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
                    Tom
                    <select
                      value={preferredKey}
                      onChange={(e) => handlePreferredKeyChange(e.target.value)}
                    >
                      {KEY_OPTIONS.map((k) => {
                        const isOriginal = k === header.key;
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
                            {isOriginal ? ' (original)' : ''}
                            {isPreferred ? ' (preferencial)' : ''}
                          </option>
                        );
                      })}
                    </select>
                  </label>
                  <label className="menu-toggle">
                    <svg
                      className="menu-icon"
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <circle cx="12" cy="12" r="9" />
                      <polyline points="12 7 12 12 15 14" />
                    </svg>
                    Compasso
                    <span className="switch">
                      <input
                        type="checkbox"
                        checked={showBeatMark}
                        onChange={(e) => setShowBeatMark(e.target.checked)}
                      />
                      <span className="switch-track" />
                    </span>
                  </label>
                  <button
                    type="button"
                    className="menu-item-button"
                    onClick={() => {
                      handleDownload();
                      setMenuOpen(false);
                    }}
                  >
                    <svg
                      className="menu-icon"
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M12 3v12" />
                      <polyline points="7 10 12 15 17 10" />
                      <path d="M5 21h14" />
                    </svg>
                    Baixar .cho
                  </button>
                  {showSaveCopy ? (
                    <div className="save-copy-form">
                      <input
                        type="text"
                        value={copyTitle}
                        onChange={(e) => setCopyTitle(e.target.value)}
                        autoFocus
                      />
                      <button type="button" onClick={handleSaveCopy} disabled={copySaving}>
                        {copySaving ? 'Salvando…' : 'Salvar'}
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="menu-item-button"
                      onClick={() => {
                        setCopyTitle(`${header.title || 'Sem título'}_copy`);
                        setShowSaveCopy(true);
                      }}
                    >
                      <svg
                        className="menu-icon"
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <rect x="9" y="9" width="11" height="11" rx="2" />
                        <path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" />
                      </svg>
                      Salvar cópia
                    </button>
                  )}
                  {viewerMeta.id && (
                    <button
                      type="button"
                      className="menu-item-button danger"
                      onClick={() => {
                        handleDeleteSaved(viewerMeta.id!);
                        setMenuOpen(false);
                      }}
                    >
                      <svg
                        className="menu-icon"
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="3 6 5 6 21 6" />
                        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                        <path d="M10 11v6" />
                        <path d="M14 11v6" />
                        <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                      </svg>
                      Apagar
                    </button>
                  )}
                </div>
              )}
            </div>
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
            <ChordProView
              text={chordpro}
              viewKey={showGrau ? 'graus' : preferredKey}
              preferredKey={preferredKey}
              sourceUrl={viewerMeta.sourceUrl}
              showBeatMark={showBeatMark}
            />
          )}

          {!viewerMeta.id && (
            <div className="actions">
              <button className="secondary" onClick={handleSave} disabled={saving}>
                {saving ? 'Salvando…' : 'Salvar música'}
              </button>
            </div>
          )}
        </>
      )}

      <footer className="disclaimer">
        Uso pessoal/educacional. Letras e cifras pertencem aos respectivos autores e ao Cifra
        Club — respeite os direitos autorais ao compartilhar os arquivos gerados.
      </footer>
    </main>
  );
}
