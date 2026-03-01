# InkLift for Obsidian

Sync AI-transcribed handwritten notes from your reMarkable tablet into your Obsidian vault.

InkLift uses AI-powered OCR (Google Gemini) to convert your handwritten notes into searchable text, then syncs them automatically as Markdown files into your Obsidian vault.

Learn more at [inklift.ai](https://inklift.ai).

## Features

- Automatic sync of AI-transcribed handwritten notes from reMarkable tablets
- Markdown file creation in your vault with OCR text
- Source image embedding (optional)
- Configurable sync interval and folder structure
- Conflict detection for locally-edited notes
- JWT-based authentication with automatic token refresh

## Installation

### BRAT (Beta Reviewer's Auto-update Tester)

1. Install the [BRAT plugin](https://github.com/TfTHacker/obsidian42-brat) from the Obsidian Community Plugins browser
2. Open BRAT settings (Settings > Community Plugins > BRAT)
3. Click **Add Beta plugin**
4. Enter: `filipesalvio-code/obsidian-inklift`
5. Click **Add Plugin**

### Community Plugin Store

Search for **InkLift** in the Obsidian Community Plugins browser (Settings > Community Plugins > Browse).

### Manual Installation

1. Download `main.js` and `manifest.json` from the [latest release](https://github.com/filipesalvio-code/obsidian-inklift/releases/latest)
2. Create a folder `inklift` in your vault's `.obsidian/plugins/` directory
3. Copy `main.js` and `manifest.json` into that folder
4. Restart Obsidian and enable the plugin in Settings > Community Plugins

## Configuration

After enabling the plugin, open its settings (Settings > Community Plugins > InkLift):

| Setting | Description | Default |
|---------|-------------|---------|
| **API URL** | Your InkLift server URL | `https://inklift.ai` |
| **Email / Password** | Your InkLift account credentials | - |
| **Sync folder** | Vault folder where synced notes are saved | `InkLift` |
| **Sync interval** | How often to check for new notes (minutes) | `15` |
| **Include source images** | Embed the original handwriting image | `true` |

## Requirements

- An InkLift account ([inklift.ai](https://inklift.ai))
- A reMarkable tablet connected to your InkLift account
- Obsidian desktop (v1.5.0 or later)

## Support

For issues and feature requests, please open an issue on [GitHub](https://github.com/filipesalvio-code/obsidian-inklift/issues).

## License

[MIT](LICENSE)
