export interface SongSearchRequest {
  song: string;
  artist?: string;
}

export interface SongLookupResponse {
  chordpro: string;
  title: string;
  artist: string;
  key?: string;
  capo?: string;
  sourceUrl: string;
}

export interface SongSearchResponse {
  results: SongLookupResponse[];
}

export interface ApiErrorResponse {
  error: string;
}
