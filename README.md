# ČOI Blacklist Extension

[![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-green?logo=googlechrome&logoColor=white)](https://chrome.google.com)
[![Manifest V3](https://img.shields.io/badge/Manifest-V3-blue)](https://developer.chrome.com/docs/extensions/mv3/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Data Source](https://img.shields.io/badge/Data-ČOI-red)](https://coi.gov.cz)

A Chrome browser extension that warns users when visiting websites on the Czech Trade Inspection Authority (ČOI) blacklist of risky and fraudulent e-shops.

## Features

- **Real-time warnings** — Displays a warning banner when you visit a blacklisted website
- **Auto-updates** — Blacklist data is updated daily from the official ČOI website
- **Customizable** — Disable warnings, change banner position, add sites to whitelist
- **Privacy-first** — No tracking, no analytics, works offline
- **Lightweight** — No dependencies, no build step, vanilla JavaScript

## Installation

1. Clone or download this repository:
   ```bash
   git clone https://github.com/simonmarek/coi-blacklist-extension.git
   ```

2. Open Chrome and navigate to `chrome://extensions`

3. Enable **Developer mode** (toggle in top right corner)

4. Click **Load unpacked**

5. Select the `coi-blacklist-extension` folder

6. The extension icon should appear in your toolbar

## Usage

Once installed, the extension works automatically:

1. **Browse normally** — The extension checks every page you visit
2. **See warnings** — If a site is on the ČOI blacklist, a warning banner appears
3. **Get details** — Click "More info" to see why the site was blacklisted
4. **Dismiss temporarily** — Close the banner to hide it for 7 days on that site

### Popup

Click the extension icon to:
- See the status of the current website
- Toggle warnings on/off
- Manually update the blacklist
- Access settings

### Settings

Access via extension icon → Settings, or right-click → Options:

| Setting | Description |
|---------|-------------|
| **Show warnings** | Enable/disable warning banners |
| **Banner position** | Display at top or bottom of page |
| **Whitelist** | Domains where warnings won't appear |

## How It Works

```
┌─────────────────┐     Daily      ┌──────────────────┐
│   ČOI Website   │ ───────────────▶│  GitHub Actions  │
│  (HTML source)  │                 │  (scrapes data)  │
└─────────────────┘                 └────────┬─────────┘
                                             │
                                             ▼
┌─────────────────┐    On install   ┌──────────────────┐
│    Extension    │ ◀───────────────│  blacklist.json  │
│ (service worker)│    + periodic   │   (GitHub raw)   │
└────────┬────────┘                 └──────────────────┘
         │
         │ Checks domain
         ▼
┌─────────────────┐
│  Content Script │ ───▶ Shows warning banner if blacklisted
│  (every page)   │
└─────────────────┘
```

1. **Data Collection**: GitHub Actions runs daily, scraping the ČOI website for the current blacklist
2. **Storage**: The blacklist is stored as JSON in the repository
3. **Extension Updates**: The extension fetches the latest data on install and periodically
4. **Page Check**: When you visit a page, the content script checks if the domain is blacklisted
5. **Warning**: If blacklisted, a non-intrusive warning banner is displayed

## Development

### Prerequisites

- Google Chrome browser
- Node.js (for running the data update script)
- Git

### Project Structure

```
coi-blacklist-extension/
├── manifest.json           # Extension configuration
├── background.js           # Service worker
├── content.js              # Injected into pages
├── content.css             # Warning banner styles
├── popup/                  # Extension popup
├── options/                # Settings page
├── scripts/
│   └── update-blacklist.js # Data scraper (Node.js)
├── data/
│   └── blacklist.json      # Generated blacklist data
└── icons/                  # Extension icons
```

### Running Locally

```bash
# Clone the repository
git clone https://github.com/simonmarek/coi-blacklist-extension.git
cd coi-blacklist-extension

# Update blacklist data manually
node scripts/update-blacklist.js

# Load in Chrome
# 1. Go to chrome://extensions
# 2. Enable Developer mode
# 3. Click "Load unpacked"
# 4. Select the project folder
```

### Testing

Inject test data in DevTools console:

```javascript
chrome.storage.local.set({
  blacklist: {
    metadata: { lastUpdated: new Date().toISOString(), count: 1 },
    domains: ['example.com'],
    details: { 'example.com': { reason: 'Test entry', dateAdded: '2024-01-01' } }
  }
});
```

Then visit `example.com` to see the warning banner.

### Code Style

- ES6+ JavaScript (const/let, async/await, arrow functions)
- 2-space indentation
- Single quotes for strings
- No semicolons optional (project uses semicolons)
- All comments in English
- UI text in Czech

## Data Source

This extension uses data from the Czech Trade Inspection Authority (Česká obchodní inspekce):

- **Primary source**: [ČOI Risky E-shops List](https://www.coi.gov.cz/pro-spotrebitele/rizikove-e-shopy/)
- **About ČOI**: [Czech Trade Inspection Authority](https://www.coi.gov.cz/)

The blacklist includes e-shops that have been reported for:
- Non-delivery of goods
- Fraudulent practices
- Violation of consumer rights
- Other deceptive business practices

## Privacy

This extension is designed with privacy as a priority:

- **No data collection** — We don't collect any information about your browsing
- **Local processing** — All checks happen locally in your browser
- **No external requests** — Only connects to GitHub to download blacklist updates
- **No analytics** — No tracking, no telemetry, no third-party services
- **Open source** — Full source code available for audit

## Contributing

Contributions are welcome! Here's how you can help:

1. **Report bugs** — Open an [issue](https://github.com/simonmarek/coi-blacklist-extension/issues)
2. **Suggest features** — Open an issue with your idea
3. **Submit PRs** — Fork the repo and submit a pull request

### Contribution Guidelines

- Follow the existing code style
- Test your changes thoroughly
- Update documentation if needed
- Keep PRs focused on a single change

## License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.

## Disclaimer

This extension is **not an official product** of the Czech Trade Inspection Authority (ČOI). It uses publicly available data from the ČOI website.

The authors:
- Make no guarantees about the accuracy or completeness of the data
- Are not responsible for any damages arising from use of this extension
- Recommend users verify information independently before making decisions

## Acknowledgments

- [Czech Trade Inspection Authority (ČOI)](https://www.coi.gov.cz/) for providing the public blacklist data
- All [contributors](https://github.com/simonmarek/coi-blacklist-extension/graphs/contributors) who help improve this project

---

Made with care for Czech internet users
