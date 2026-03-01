/** InkLift vault sync engine — poll API, create/update Markdown files */

import type { App, TFile } from "obsidian";
import type { InkLiftAPI } from "./api";
import type { SyncedNote } from "./types";

const STORAGE_KEY_LAST_SYNC = "inklift-last-sync";

export class SyncEngine {
  constructor(
    private app: App,
    private api: InkLiftAPI,
    private syncFolder: string,
    private includeSourceImages: boolean
  ) {}

  getLastSync(): string | null {
    return this.app.loadLocalStorage(STORAGE_KEY_LAST_SYNC);
  }

  setLastSync(iso: string): void {
    this.app.saveLocalStorage(STORAGE_KEY_LAST_SYNC, iso);
  }

  async run(): Promise<{ synced: number; conflicts: number; errors: string[] }> {
    const since = this.getLastSync();
    const response = await this.api.getSyncChanges(since);

    const errors: string[] = [];
    let synced = 0;
    let conflicts = 0;

    for (const note of response.notes) {
      try {
        const result = await this.writeNoteToVault(note);
        if (result === "conflict") {
          conflicts++;
        } else if (result !== "skipped") {
          synced++;
        }
      } catch (e) {
        errors.push(`${note.notebook_name} p${note.page_number}: ${String(e)}`);
      }
    }

    this.setLastSync(response.server_time);
    return { synced, conflicts, errors };
  }

  private async writeNoteToVault(
    note: SyncedNote
  ): Promise<"created" | "updated" | "conflict" | "skipped"> {
    const folder = this.syncFolder.replace(/^\/|\/$/g, "") || "InkLift";
    const safeName = this.sanitizeFilename(note.notebook_name);
    const fileName = `${safeName} - Page ${note.page_number + 1}.md`;
    const path = folder ? `${folder}/${fileName}` : fileName;

    if (this.includeSourceImages && note.source_image_path) {
      await this.downloadSourceImage(note, folder);
    }

    const content = note.markdown;
    const existing = this.app.vault.getAbstractFileByPath(path);

    if (existing instanceof TFile) {
      // File exists — check for conflicts before overwriting
      const existingContent = await this.app.vault.read(existing);

      // Check if server content actually changed since our last write
      const lastServerUpdate = this.extractFrontmatterField(
        existingContent,
        "inklift_server_updated_at"
      );
      if (
        lastServerUpdate &&
        note.server_updated_at &&
        lastServerUpdate === note.server_updated_at
      ) {
        // Server hasn't changed — skip to preserve any local edits
        return "skipped";
      }

      // Check if user modified the body locally
      const existingBody = this.stripFrontmatter(existingContent);
      const newBody = this.stripFrontmatter(content);

      if (existingBody !== newBody && existingBody.trim() !== "") {
        // Both sides changed — create a conflict file, preserve user edits
        const dateStr = new Date().toISOString().slice(0, 10);
        const conflictPath = path.replace(
          ".md",
          ` (InkLift conflict ${dateStr}).md`
        );
        const conflictExists =
          this.app.vault.getAbstractFileByPath(conflictPath);
        if (!conflictExists) {
          const dir = this.app.vault.getAbstractFileByPath(folder);
          if (!dir) {
            await this.app.vault.createFolder(folder);
          }
          await this.app.vault.create(conflictPath, content);
        }
        return "conflict";
      }

      // No conflict — safe to update
      await this.app.vault.modify(existing, content);
      return "updated";
    } else {
      // New file — create folder if needed
      const dir = this.app.vault.getAbstractFileByPath(folder);
      if (!dir) {
        await this.app.vault.createFolder(folder);
      }
      await this.app.vault.create(path, content);
      return "created";
    }
  }

  /** Extract a value from YAML frontmatter by field name. */
  private extractFrontmatterField(
    content: string,
    field: string
  ): string | null {
    const match = content.match(new RegExp(`^${field}:\\s*(.+)$`, "m"));
    return match ? match[1].trim().replace(/^['"]|['"]$/g, "") : null;
  }

  /** Strip YAML frontmatter, returning only the body content. */
  private stripFrontmatter(content: string): string {
    const match = content.match(/^---\n[\s\S]*?\n---\n([\s\S]*)$/);
    return match ? match[1].trim() : content.trim();
  }

  private sanitizeFilename(name: string): string {
    return name.replace(/[<>:"/\\|?*]/g, "_").trim() || "Untitled";
  }

  private async downloadSourceImage(
    note: SyncedNote,
    folder: string
  ): Promise<void> {
    if (!note.source_image_path) return;
    const token = this.api.getAccessToken();
    if (!token) return;
    const basename = note.source_image_path.split("/").pop() ?? "source.png";
    const url = `${this.api.getBaseUrl()}/api/sync/image/${note.page_id}`;
    try {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const blob = await res.blob();
      const imagePath = folder ? `${folder}/${basename}` : basename;
      const arr = await blob.arrayBuffer();
      await this.app.vault.createBinary(imagePath, new Uint8Array(arr));
    } catch {
      // Silently skip if download fails
    }
  }
}
