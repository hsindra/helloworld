export interface SongLookupRequest {
  artist: string;
  song: string;
}

export interface SongLookupResponse {
  chordpro: string;
  title: string;
  artist: string;
  key?: string;
  capo?: string;
  sourceUrl: string;
}

export interface ApiErrorResponse {
  error: string;
}
