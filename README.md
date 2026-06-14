# 🍓 Munchy Math

A fun, offline-capable maths game for kids aged 4–12. Help Munchy the monster eat by tapping the food with the right answer — solve equations, grow your streak, and collect monster friends!

**[▶ Play Now](https://YOUR-USERNAME.github.io/munchy-math/)** ← replace with your GitHub Pages URL after deployment

---

## Screenshots

> Add screenshots here after launch

---

## Features

### Core Game
- Feed Munchy by tapping the food with the correct answer
- Four operations — addition, subtraction, multiplication, division
- Three difficulty levels — Easy, Medium, Hard
- Streak system, level-up progression, energy bar
- Collect a monster friend at each new level

### Learn Lab
- **See it** — step through a full times table or operation set
- **Practice** — adaptive queue that focuses on weak spots
- **Speed mode** — race the clock for a personal best

### Math Tricks
- 13 clever shortcuts for faster mental maths
- Basic tricks for whole numbers (doubles, tens, finger multiplication…)
- Advanced tricks for fractions and decimals

### Daily Challenges
- A fresh 8-question challenge every day
- Date-seeded questions — every player gets the same challenge on the same day
- 3-star rating system, day streak tracker
- 7 weekly themes: Speed Round, Times Table Blast, Mixed Bag, Big Numbers, Subtraction Sprint, Master Class, Fun Friday Mix

### Advanced Mode (ages 8–12)
- Toggle in the player profile: Basic or Advanced
- Advanced mode: fractions or decimals (your choice)
- Stacked fraction display, multiple-choice answers
- Fraction × fraction, fraction × whole number, decimal addition and multiplication
- Learn Lab and Math Tricks both adapt automatically

### Accessibility & Languages
- Voice narration reads every equation aloud (Web Speech API)
- Voice picker — choose from all voices installed on your device
- 6 languages: 🇬🇧 English, 🇮🇳 Hindi, 🇪🇸 Spanish, 🇮🇳 Tamil, 🇮🇳 Telugu, 🇩🇪 German
- Works fully offline after first load (PWA / service worker)
- No ads, no data collection, no accounts required

### Parent Zone
- Problems solved, accuracy, best streak
- Daily goal setting with customisable targets and focus skills
- Voice and language settings

---

## Tech Stack

| What | How |
|------|-----|
| Language | Vanilla HTML + CSS + JavaScript (no frameworks) |
| Storage | `localStorage` (all data stays on device) |
| Audio | Web Speech API |
| Offline | Service Worker (cache-first strategy) |
| Distribution | PWA → TWA via PWABuilder → Google Play Store |
| Build step | None — single HTML file, zero dependencies |

---

## Running Locally

No build step needed. Just open `index.html` in a browser.

```bash
# If you want a local server (required for service worker to work):
npx serve .
# Then open http://localhost:3000
```

Or use the VS Code **Live Server** extension — right-click `index.html` → Open with Live Server.

---

## Project Structure

```
munchy-math/
├── index.html        # The entire game (single file)
├── manifest.json     # PWA manifest
├── sw.js             # Service worker (offline caching)
├── icon-72.png       # App icons (all sizes for PWA + Play Store)
├── icon-96.png
├── icon-128.png
├── icon-144.png
├── icon-152.png
├── icon-192.png
├── icon-384.png
├── icon-512.png
├── DEPLOY.md         # Step-by-step Play Store deployment guide
└── README.md         # This file
```

The HTML file is structured as 13 sequential `<script>` blocks, each exposing a `window.X` module:

| Script | Module | Purpose |
|--------|--------|---------|
| 1 | Profiles | Player profiles, localStorage namespacing |
| 2 | Mastery | Per-fact mastery tracking |
| 3 | Treats | Treat/reward system |
| 4 | Goal | Daily goal setting |
| 5 | Speak | Voice narration (Web Speech API) |
| 6 | Play | Core game engine |
| 7 | Learn Lab | Practice and speed modes |
| 8 | Mastery Map | Visual mastery grid |
| 9 | Snack Time | Treat screen minigame |
| 10 | Math Tricks | Trick cards and practice |
| 11 | Profiles UI | Profile creation and management |
| 12 | Localization | i18n for 6 languages |
| 13 | Daily Challenge | Date-seeded daily challenges |

---

## Deployment

See **DEPLOY.md** for the complete step-by-step guide:
1. Host on GitHub Pages (free)
2. Generate Android APK with PWABuilder (free)
3. Submit to Google Play Store ($25 one-time fee)

---

## Roadmap

- [ ] Puzzles — magic squares, missing operators, fill-in chains
- [ ] Mini Games — alternative game formats (number ninja, matching pairs)
- [ ] Pass & Play — two-player head-to-head on one device
- [ ] More languages
- [ ] iOS App Store release

---

## Licence

MIT — free to use, modify and distribute.
