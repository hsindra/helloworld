import type { SavedSong } from './store';

export interface SongSearchRequest {
  song: string;
  artist?: string;
}

export interface SongLookupResponse {
  /** Present when this result is an already-saved song (or matched one),
   * so the client can update it in place instead of creating a duplicate. */
  id?: string;
  chordpro: string;
  title: string;
  artist: string;
  key: string;
  /** Concrete key the user prefers to play this song in, when this result
   * is an already-saved song — see `SavedSong.preferredKey` in lib/store.ts. */
  preferredKey?: string;
  capo?: string;
  sourceUrl: string;
}

export interface SongSearchResponse {
  results: SongLookupResponse[];
}

export interface ApiErrorResponse {
  error: string;
}

/** A checklist item with its `SavedSong` resolved alongside it — `song` is
 * `null` when the referenced song was deleted from "Minhas músicas" after
 * being added to the checklist. */
export interface ResolvedChecklistItem {
  songId: string;
  preferredKey: string;
  song: SavedSong | null;
}

export interface ResolvedChecklist {
  id: string;
  name: string;
  items: ResolvedChecklistItem[];
  createdAt: number;
}
