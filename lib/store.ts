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

const CHECKLIST_INDEX_KEY = 'checklists:index';

function checklistKey(id: string): string {
  return `checklist:${id}`;
}

export interface ChecklistItem {
  songId: string;
  /** Tom em que essa música toca nesse checklist específico — independente
   * do `preferredKey` da música em "Minhas músicas". Pré-preenchido a
   * partir dele ao adicionar (ver app/page.tsx), editável depois. */
  preferredKey: string;
}

export interface Checklist {
  id: string;
  name: string;
  /** Ordem de exibição = ordem do array. */
  items: ChecklistItem[];
  createdAt: number;
}

export type ChecklistInput = Omit<Checklist, 'id' | 'createdAt'> & { id?: string };

export async function saveChecklist(input: ChecklistInput): Promise<Checklist> {
  const redis = getClient();
  const id = input.id ?? randomUUID();
  const existing = input.id ? await redis.get<Checklist>(checklistKey(id)) : null;
  const createdAt = existing?.createdAt ?? Date.now();

  const checklist: Checklist = {
    id,
    name: input.name,
    items: input.items,
    createdAt,
  };

  await redis.set(checklistKey(id), checklist);
  await redis.zadd(CHECKLIST_INDEX_KEY, { score: createdAt, member: id });
  return checklist;
}

export async function listChecklists(): Promise<Checklist[]> {
  const redis = getClient();
  const ids = await redis.zrange<string[]>(CHECKLIST_INDEX_KEY, 0, -1, { rev: true });
  if (!ids || ids.length === 0) return [];
  const checklists = await Promise.all(ids.map((id) => redis.get<Checklist>(checklistKey(id))));
  return checklists.filter((c): c is Checklist => c !== null);
}

export async function getChecklist(id: string): Promise<Checklist | null> {
  const redis = getClient();
  return redis.get<Checklist>(checklistKey(id));
}

export async function deleteChecklist(id: string): Promise<void> {
  const redis = getClient();
  await redis.del(checklistKey(id));
  await redis.zrem(CHECKLIST_INDEX_KEY, id);
}
