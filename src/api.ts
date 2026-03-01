/** InkLift API client — HTTP calls with JWT auth */

import type { TokenResponse, SyncChangesResponse, SyncStatus } from "./types";

const DEFAULT_BASE = "http://localhost:8000";

export class InkLiftAPI {
  private baseUrl: string;
  private accessToken: string | null = null;
  private refreshToken: string | null = null;

  /** Called when tokens are refreshed, so the plugin can persist them. */
  onTokenRefresh: ((accessToken: string, refreshToken: string) => void) | null =
    null;

  constructor(baseUrl: string = DEFAULT_BASE) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  setTokens(access: string, refresh: string): void {
    this.accessToken = access;
    this.refreshToken = refresh;
  }

  clearTokens(): void {
    this.accessToken = null;
    this.refreshToken = null;
  }

  isAuthenticated(): boolean {
    return !!this.accessToken;
  }

  private async request<T>(
    method: string,
    path: string,
    options?: {
      body?: unknown;
      headers?: Record<string, string>;
      skipAuth?: boolean;
    }
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...options?.headers,
    };

    if (!options?.skipAuth && this.accessToken) {
      headers["Authorization"] = `Bearer ${this.accessToken}`;
    }

    const init: RequestInit = { method, headers };
    if (options?.body) {
      init.body = JSON.stringify(options.body);
    }

    const res = await fetch(url, init);

    if (res.status === 401 && this.refreshToken && !options?.skipAuth) {
      const refreshed = await this.refresh();
      if (refreshed) {
        return this.request<T>(method, path, options);
      }
    }

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`API ${method} ${path}: ${res.status} — ${text}`);
    }

    const contentType = res.headers.get("content-type");
    if (contentType?.includes("application/json")) {
      return res.json() as Promise<T>;
    }
    return res.text() as unknown as T;
  }

  async login(email: string, password: string): Promise<TokenResponse> {
    const data = await this.request<TokenResponse>("POST", "/api/auth/login", {
      body: { email, password },
      skipAuth: true,
    });
    this.setTokens(data.access_token, data.refresh_token);
    this.onTokenRefresh?.(data.access_token, data.refresh_token);
    return data;
  }

  async refresh(): Promise<boolean> {
    if (!this.refreshToken) return false;
    try {
      const data = await this.request<TokenResponse>("POST", "/api/auth/refresh", {
        body: { refresh_token: this.refreshToken },
        skipAuth: true,
      });
      this.setTokens(data.access_token, data.refresh_token);
      this.onTokenRefresh?.(data.access_token, data.refresh_token);
      return true;
    } catch {
      this.clearTokens();
      return false;
    }
  }

  async getSyncChanges(since: string | null): Promise<SyncChangesResponse> {
    const qs = since ? `?since=${encodeURIComponent(since)}` : "";
    return this.request<SyncChangesResponse>("GET", `/api/sync/changes${qs}`);
  }

  async getSyncStatus(): Promise<SyncStatus> {
    return this.request<SyncStatus>("GET", "/api/sync/status");
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  getAccessToken(): string | null {
    return this.accessToken;
  }
}
