import { App, Notice, Plugin, PluginSettingTab, Setting } from "obsidian";
import { InkLiftAPI } from "./api";
import { SyncEngine } from "./sync";

export interface InkLiftSettings {
  apiUrl: string;
  accessToken: string;
  refreshToken: string;
  syncFolder: string;
  syncIntervalMinutes: number;
  includeSourceImages: boolean;
}

const DEFAULT_SETTINGS: InkLiftSettings = {
  apiUrl: "https://inklift.ai",
  accessToken: "",
  refreshToken: "",
  syncFolder: "InkLift",
  syncIntervalMinutes: 15,
  includeSourceImages: true,
};

export default class InkLiftPlugin extends Plugin {
  settings: InkLiftSettings;
  private syncInterval: number | null = null;
  private api: InkLiftAPI = new InkLiftAPI();

  async onload() {
    await this.loadSettings();
    this.api = new InkLiftAPI(this.settings.apiUrl);
    this.api.onTokenRefresh = (access, refresh) => {
      this.settings.accessToken = access;
      this.settings.refreshToken = refresh;
      this.saveSettings();
    };

    if (this.settings.accessToken && this.settings.refreshToken) {
      this.api.setTokens(this.settings.accessToken, this.settings.refreshToken);
    }

    this.addSettingTab(new InkLiftSettingTab(this.app, this));

    this.addRibbonIcon("pencil", "InkLift: Sync now", () => this.syncNotes());

    this.addCommand({
      id: "inklift-sync",
      name: "Sync handwritten notes",
      callback: () => this.syncNotes(),
    });

    if (this.settings.accessToken) {
      this.startPeriodicSync();
    }
  }

  onunload() {
    if (this.syncInterval) {
      window.clearInterval(this.syncInterval);
    }
  }

  async syncNotes() {
    if (!this.settings.accessToken) {
      new Notice("InkLift: Log in via settings first.");
      return;
    }

    this.api.setTokens(this.settings.accessToken, this.settings.refreshToken);
    new Notice("InkLift: Syncing...");

    const engine = new SyncEngine(
      this.app,
      this.api,
      this.settings.syncFolder,
      this.settings.includeSourceImages
    );

    try {
      const { synced, errors } = await engine.run();
      if (errors.length > 0) {
        new Notice(`InkLift: Synced ${synced}, ${errors.length} errors.`);
      } else {
        new Notice(`InkLift: Synced ${synced} note(s).`);
      }
    } catch (e) {
      new Notice(`InkLift: Sync failed — ${String(e)}`);
    }
  }

  private startPeriodicSync() {
    const intervalMs = this.settings.syncIntervalMinutes * 60 * 1000;
    this.syncInterval = window.setInterval(
      () => this.syncNotes(),
      intervalMs
    );
    this.registerInterval(this.syncInterval);
  }

  async loadSettings() {
    const saved = await this.loadData();
    this.settings = Object.assign({}, DEFAULT_SETTINGS, saved);

    // Migrate legacy apiToken → accessToken
    if (saved?.apiToken && !this.settings.accessToken) {
      this.settings.accessToken = saved.apiToken;
      this.settings.refreshToken = "";
      await this.saveSettings();
    }
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}

class InkLiftSettingTab extends PluginSettingTab {
  plugin: InkLiftPlugin;

  constructor(app: App, plugin: InkLiftPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "InkLift Settings" });

    new Setting(containerEl)
      .setName("API URL")
      .setDesc("InkLift server URL (e.g. http://localhost:8000)")
      .addText((text) =>
        text
          .setPlaceholder("http://localhost:8000")
          .setValue(this.plugin.settings.apiUrl)
          .onChange(async (value) => {
            this.plugin.settings.apiUrl = value;
            await this.plugin.saveSettings();
          })
      );

    // ── Login Section ──
    containerEl.createEl("h3", { text: "Account" });

    const isLoggedIn = !!this.plugin.settings.accessToken;
    if (isLoggedIn) {
      new Setting(containerEl)
        .setName("Status")
        .setDesc("Logged in")
        .addButton((btn) =>
          btn.setButtonText("Log out").onClick(async () => {
            this.plugin.settings.accessToken = "";
            this.plugin.settings.refreshToken = "";
            this.plugin.api.clearTokens();
            await this.plugin.saveSettings();
            this.display();
          })
        );
    } else {
      let emailValue = "";
      let passwordValue = "";

      new Setting(containerEl)
        .setName("Email")
        .setDesc("Your InkLift account email")
        .addText((text) =>
          text.setPlaceholder("you@example.com").onChange((value) => {
            emailValue = value;
          })
        );

      new Setting(containerEl)
        .setName("Password")
        .setDesc("Your InkLift account password")
        .addText((text) =>
          text
            .setPlaceholder("Password")
            .then((t) => {
              t.inputEl.type = "password";
            })
            .onChange((value) => {
              passwordValue = value;
            })
        );

      new Setting(containerEl)
        .setName("")
        .addButton((btn) =>
          btn
            .setButtonText("Log in")
            .setCta()
            .onClick(async () => {
              if (!emailValue || !passwordValue) {
                new Notice("InkLift: Enter email and password.");
                return;
              }
              try {
                const api = new InkLiftAPI(this.plugin.settings.apiUrl);
                const tokens = await api.login(emailValue, passwordValue);
                this.plugin.settings.accessToken = tokens.access_token;
                this.plugin.settings.refreshToken = tokens.refresh_token;
                this.plugin.api.setTokens(
                  tokens.access_token,
                  tokens.refresh_token
                );
                await this.plugin.saveSettings();
                new Notice("InkLift: Logged in successfully.");
                this.display();
              } catch (e) {
                new Notice(`InkLift: Login failed — ${String(e)}`);
              }
            })
        );
    }

    // ── Advanced: Manual Token Entry ──
    containerEl.createEl("h3", { text: "Advanced" });

    new Setting(containerEl)
      .setName("Access token")
      .setDesc("Paste access token manually (advanced)")
      .addText((text) =>
        text
          .setPlaceholder("Access token")
          .setValue(this.plugin.settings.accessToken)
          .onChange(async (value) => {
            this.plugin.settings.accessToken = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Refresh token")
      .setDesc("Paste refresh token manually (advanced)")
      .addText((text) =>
        text
          .setPlaceholder("Refresh token")
          .setValue(this.plugin.settings.refreshToken)
          .onChange(async (value) => {
            this.plugin.settings.refreshToken = value;
            await this.plugin.saveSettings();
          })
      );

    // ── Sync Settings ──
    containerEl.createEl("h3", { text: "Sync" });

    new Setting(containerEl)
      .setName("Sync folder")
      .setDesc("Vault folder for synced notes")
      .addText((text) =>
        text
          .setPlaceholder("InkLift")
          .setValue(this.plugin.settings.syncFolder)
          .onChange(async (value) => {
            this.plugin.settings.syncFolder = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Sync interval (minutes)")
      .setDesc("How often to check for new notes")
      .addText((text) =>
        text
          .setPlaceholder("15")
          .setValue(String(this.plugin.settings.syncIntervalMinutes))
          .onChange(async (value) => {
            const num = parseInt(value, 10);
            if (!isNaN(num) && num >= 1) {
              this.plugin.settings.syncIntervalMinutes = num;
              await this.plugin.saveSettings();
            }
          })
      );

    new Setting(containerEl)
      .setName("Include source images")
      .setDesc("Embed the original handwriting image alongside text")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.includeSourceImages)
          .onChange(async (value) => {
            this.plugin.settings.includeSourceImages = value;
            await this.plugin.saveSettings();
          })
      );
  }
}
