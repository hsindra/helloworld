import { randomUUID } from 'crypto';
import { Redis } from '@upstash/redis';

const INDEX_KEY = 'songs:index';

function songKey(id: string): string {
  return `song:${id}`;
}

let client: Redis | null = null;

function getClient(): Redis {
  if (client) return client;
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) {
    throw new Error(
      'Banco de dados não configurado: conecte um Vercel KV / Upstash Redis ao projeto (variáveis KV_REST_API_URL e KV_REST_API_TOKEN).'
    );
  }
  client = new Redis({ url, token });
  return client;
}

export interface SavedSong {
  id: string;
  title: string;
  artist: string;
  /** Tom de referência da música. Obrigatório: o `chordpro` é sempre salvo em
   * graus (Nashville Number System), e sem o tom não há como reconvertê-lo
   * para nenhum tom concreto na visualização. */
  key: string;
  /** Concrete key the user prefers to play this song in — independent of
   * `key` (the song's original key). Defaults to `key` in the UI when unset. */
  preferredKey?: string;
  capo?: string;
  sourceUrl?: string;
  chordpro: string;
  savedAt: number;
}

export type SavedSongInput = Omit<SavedSong, 'id' | 'savedAt'> & { id?: string };

export async function saveSong(input: SavedSongInput): Promise<SavedSong> {
  const redis = getClient();
  const id = input.id ?? randomUUID();
  const existing = input.id ? await redis.get<SavedSong>(songKey(id)) : null;
  const savedAt = existing?.savedAt ?? Date.now();

  const song: SavedSong = {
    id,
    title: input.title,
    artist: input.artist,
    key: input.key,
    preferredKey: input.preferredKey,
    capo: input.capo,
    sourceUrl: input.sourceUrl,
    chordpro: input.chordpro,
    savedAt,
  };

  await redis.set(songKey(id), song);
  await redis.zadd(INDEX_KEY, { score: savedAt, member: id });
  return song;
}

export async function listSongs(): Promise<SavedSong[]> {
  const redis = getClient();
  const ids = await redis.zrange<string[]>(INDEX_KEY, 0, -1, { rev: true });
  if (!ids || ids.length === 0) return [];
  const songs = await Promise.all(ids.map((id) => redis.get<SavedSong>(songKey(id))));
  return songs.filter((s): s is SavedSong => s !== null);
}

export async function getSong(id: string): Promise<SavedSong | null> {
  const redis = getClient();
  return redis.get<SavedSong>(songKey(id));
}

export async function deleteSong(id: string): Promise<void> {
  const redis = getClient();
  await redis.del(songKey(id));
  await redis.zrem(INDEX_KEY, id);
}

const SETLIST_INDEX_KEY = 'setlists:index';

function setlistKey(id: string): string {
  return `setlist:${id}`;
}

export interface SetlistItem {
  songId: string;
  /** Tom em que essa música toca nesse setlist específico — independente
   * do `preferredKey` da música em "Minhas músicas". Pré-preenchido a
   * partir dele ao adicionar (ver app/page.tsx), editável depois. */
  preferredKey: string;
}

export interface Setlist {
  id: string;
  name: string;
  /** Ordem de exibição = ordem do array. */
  items: SetlistItem[];
  createdAt: number;
}

export type SetlistInput = Omit<Setlist, 'id' | 'createdAt'> & { id?: string };

export async function saveSetlist(input: SetlistInput): Promise<Setlist> {
  const redis = getClient();
  const id = input.id ?? randomUUID();
  const existing = input.id ? await redis.get<Setlist>(setlistKey(id)) : null;
  const createdAt = existing?.createdAt ?? Date.now();

  const setlist: Setlist = {
    id,
    name: input.name,
    items: input.items,
    createdAt,
  };

  await redis.set(setlistKey(id), setlist);
  await redis.zadd(SETLIST_INDEX_KEY, { score: createdAt, member: id });
  return setlist;
}

export async function listSetlists(): Promise<Setlist[]> {
  const redis = getClient();
  const ids = await redis.zrange<string[]>(SETLIST_INDEX_KEY, 0, -1, { rev: true });
  if (!ids || ids.length === 0) return [];
  const setlists = await Promise.all(ids.map((id) => redis.get<Setlist>(setlistKey(id))));
  return setlists.filter((c): c is Setlist => c !== null);
}

export async function getSetlist(id: string): Promise<Setlist | null> {
  const redis = getClient();
  return redis.get<Setlist>(setlistKey(id));
}

export async function deleteSetlist(id: string): Promise<void> {
  const redis = getClient();
  await redis.del(setlistKey(id));
  await redis.zrem(SETLIST_INDEX_KEY, id);
}

const SETTINGS_KEY = 'settings';

/** General, app-wide import preferences — not tied to any one song, so
 * there's a single record instead of an indexed list (see SavedSong). */
export interface Settings {
  convertMinorToRelativeMajor: boolean;
  stripTablature: boolean;
}

const DEFAULT_SETTINGS: Settings = {
  convertMinorToRelativeMajor: true,
  stripTablature: false,
};

export async function getSettings(): Promise<Settings> {
  const redis = getClient();
  const saved = await redis.get<Partial<Settings>>(SETTINGS_KEY);
  return { ...DEFAULT_SETTINGS, ...saved };
}

export async function saveSettings(settings: Settings): Promise<Settings> {
  const redis = getClient();
  await redis.set(SETTINGS_KEY, settings);
  return settings;
}
