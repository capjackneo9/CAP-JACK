/** Subset of the AzuraCast API shapes NCVR consumes. */
export interface AzSong {
  id: string; text: string; artist: string; title: string; album?: string; genre?: string; art?: string | null;
}
export interface AzHistoryItem {
  sh_id: number; played_at: number; duration: number; playlist?: string | null; streamer?: string | null;
  is_request?: boolean; song: AzSong;
}
export interface AzNowPlaying {
  station: {
    id: number; name: string; shortcode: string; listen_url?: string | null;
    mounts?: Array<{ url: string; is_default: boolean; name?: string; format?: string; bitrate?: number }>;
    public_player_url?: string;
  };
  listeners?: { total: number; unique: number; current: number };
  live?: { is_live: boolean; streamer_name: string; broadcast_start: number | null; art?: string | null };
  now_playing?: (AzHistoryItem & { elapsed: number; remaining: number }) | null;
  playing_next?: (Omit<AzHistoryItem, "sh_id"> & { cued_at?: number }) | null;
  song_history?: AzHistoryItem[];
  is_online: boolean;
}
export interface AzScheduleItem {
  id?: number; start_time: number; end_time: number; start_date?: string | null; end_date?: string | null;
  days: number[]; loop_once?: boolean;
}
export interface AzPlaylist {
  id: number; name: string; type: string; is_enabled: boolean; schedule_items?: AzScheduleItem[];
}
export interface AzStreamer {
  id: number; streamer_username: string; display_name: string; is_active: boolean; enforce_schedule?: boolean;
  schedule_items?: AzScheduleItem[];
}
export interface AzMedia { id: number; unique_id?: string; song_id?: string; path: string; title?: string; artist?: string }
export interface AzStationStatus { backend_running: boolean; frontend_running: boolean }
