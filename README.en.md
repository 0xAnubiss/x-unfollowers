# X Unfollowers

[Türkçe](README.md) · **English**

Chrome / Edge extension for X (Twitter). It finds accounts **you follow that do not follow you back**, lists them, and unfollows **only the ones you select**, one account at a time, with a delay you set.

Nothing is sent to an external server. Everything runs in your browser with the x.com session you already have open.

## Features

- Scan your following list and show who does not follow you back
- Search, select all / none, or pick accounts by hand
- Protect accounts with a star so they are never selected
- Configurable delay (seconds per unfollow)
- Optional random jitter (±20%) so the timing is not perfectly even
- Stop at any time
- Daily unfollow counter (local)

## Install (Chrome or Edge)

1. Download this repo and unzip it, or clone it:
   ```bash
   git clone https://github.com/0xAnubiss/x-unfollowers.git
   ```
2. Open `chrome://extensions` or `edge://extensions`
3. Turn on **Developer mode**
4. Click **Load unpacked**
5. Select the `x-unfollowers` folder
6. Log in to [x.com](https://x.com). A round button at the bottom-right opens the panel. You can also use the extension icon.

## Usage

1. Stay logged in on x.com
2. Open the panel → **Taramayı Başlat** (Start scan)
3. Review the list. Leave unchecked anyone you want to keep. The star (☆) adds an account to the protect list
4. Set **Aralık** (interval). **30 seconds or slower is recommended.** 60 seconds is safer
5. Keep **rastgele sapma** (random jitter) on if you want the wait to vary slightly
6. Click **Seçilenleri Çıkar** (Unfollow selected). Use **Durdur** (Stop) to cancel

If the first scan is empty or errors, open `https://x.com/following`, scroll a bit, then scan again. The extension is more reliable after X’s own following request is captured.

## Safety

X rate-limits bulk unfollows. To reduce the chance of a restriction:

- Use 30 seconds or more between accounts (60+ is safer)
- Do not unfollow hundreds in a single sitting
- Do not run other X automation in the same session

This is not X’s official API. If the site changes, the extension can break until it is updated. Use at your own risk.

## How it works

The extension runs on `x.com` / `twitter.com` as a Manifest V3 content script. It uses your existing logged-in session to read the following list, checks who follows you back, then calls X’s unfollow endpoint one selected account at a time.

| File | Role |
| --- | --- |
| `page-bridge.js` | Captures session headers from X’s own requests |
| `content.js` | Panel, scan, selection, delayed unfollow |
| `popup.html` | Toolbar popup |
| `background.js` | Opens an X tab from the popup if needed |

## Language

The default GitHub readme is Turkish. This is the English version. The in-page panel is Turkish.

## License

Use it on your own account, at your own risk.
