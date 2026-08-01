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
  capo?: string;
  sourceUrl: string;
}

export interface SongSearchResponse {
  results: SongLookupResponse[];
}

export interface ApiErrorResponse {
  error: string;
}
