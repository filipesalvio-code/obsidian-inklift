/** InkLift API types — mirrors backend Pydantic models */

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface UserResponse {
  id: string;
  email: string;
  subscription_tier: string;
  pages_processed_this_month: number;
  created_at: string;
}

export interface SyncedNote {
  page_id: string;
  notebook_name: string;
  page_number: number;
  markdown: string;
  source_image_path: string | null;
  device_name: string;
  last_modified: string | null;
  server_updated_at: string | null;
}

export interface SyncChangesResponse {
  notes: SyncedNote[];
  count: number;
  server_time: string;
}

export interface SyncStatus {
  devices: Array<{
    id: string;
    name: string;
    device_type: string;
    last_synced_at: string | null;
  }>;
  pending_ocr_pages: number;
  latest_sync_job: {
    id: string;
    status: string;
    pages_processed: number;
    created_at: string;
  } | null;
}
