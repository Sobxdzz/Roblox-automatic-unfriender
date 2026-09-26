# Roblox Auto Unfriend & GUI

A Tampermonkey userscript that lets you **select and unfriend multiple Roblox friends** quickly with a clean, modern floating panel.

---

## Features

- **Dual selection methods**
  - Click the red **–** button that appears on friend cards
  - Or select directly from the floating GUI list

- **Live Friends list**
  - Shows every friend currently loaded on the page
  - Matches the exact order you see on the page
  - Updates automatically as you scroll

- **Selected section**
  - Clear overview of everyone you’ve selected
  - One-click remove from selection

- **Unfriended History**
  - Saves display name, username, user ID, avatar and timestamp
  - **Profile** button next to each entry → opens their profile in a new tab so you can re-add them if needed
  - Persists across page reloads (stored in `localStorage`)

- **Dark mode** toggle (moon/sun icon)
- **Minimizable** panel (collapses to a small draggable button)
- Only fully active on the real **Friends** tab (`#!/friends`)
- Shows a clear message when you’re on Requests / Following / Followers

---

## Installation

1. Install **[Tampermonkey](https://www.tampermonkey.net/)** (Chrome, Firefox, Edge, etc.)
2. Create a new script in Tampermonkey
3. Paste the entire script code
4. Save
5. Go to [https://www.roblox.com/users/friends#!/friends](https://www.roblox.com/users/friends#!/friends)

The panel should appear on the right side of the page.

---

## How to use

1. Make sure you are on the **Friends** tab (not Requests, Following or Followers).
2. Select friends using either:
   - The red **–** button on their card, or
   - Clicking their row in the GUI
3. Review the **Selected** section.
4. Click **Delete Selected**.
5. Confirm the prompt.
6. The script will unfriend them one by one with a short delay.

You can minimize the panel with the **–** button in the header. Click the small “Unfriend” button to bring it back (it is also draggable).

---

## Important Notes & Warnings

| Topic | Details |
|-------|---------|
| **Page restriction** | The tool only works properly on the **Friends** list. On other tabs it will show a message asking you to navigate to Friends. |
| **Rate limiting** | The script adds a ~450 ms delay between each unfriend request. Unfriending a very large number at once may still trigger Roblox rate limits or temporary restrictions. |
| **Roblox ToS** | Bulk unfriending tools may violate Roblox’s Terms of Service. Use at your own risk. |
| **DOM dependency** | The script scrapes the page. If Roblox significantly changes the Friends page layout, some features (especially the – buttons or name/avatar detection) may break until the script is updated. |
| **Avatars & names** | Occasionally avatars may fail to load or display names may be slightly off due to how Roblox lazy-loads content. The history tries to keep the best available data. |
| **First card button** | Rarely the very first friend card may take a moment to show the – button. A delayed retry is built in. |
| **Data storage** | Selected users and Unfriended History are stored in your browser’s `localStorage`. Clearing site data will wipe the history. |

---

## Known Limitations

- Only shows friends that are currently loaded in the DOM (you need to scroll to load more).
- Does not fetch your entire friends list via API (by design, to stay simple and match what you see).
- No undo button (that’s why the Profile link exists in history).
- Works best on the desktop site.

---

## Changelog (recent)

**v5.0**
- Improved Unfriended History (better display names + Profile button)
- Stronger avatar fallbacks
- Cleaner handling when on non-Friends tabs

**v4.9**
- Fixed missing – button on the first friend card
- Made the minimized button draggable
- Better messages on Following / Followers / Requests

**v4.8**
- Only shows on the real Friends tab
- Added minimize / expand
- Improved name & avatar extraction

---

## Disclaimer

This is an unofficial third-party tool.  
It is **not** affiliated with, endorsed by, or connected to Roblox Corporation in any way.

Use responsibly.

---


Overview by grok :)
## License

MIT License – feel free to modify and share.
