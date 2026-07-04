# Munchy Math — Google Play Store Launch Guide

## Files in this folder

| File | Purpose |
|------|---------|
| `index.html` | The game (main file — use this, not munchy-math.html) |
| `manifest.json` | PWA manifest (app name, icons, colours) |
| `sw.js` | Service worker (offline caching) |
| `icon-*.png` | App icons in all required sizes |

---

## Step 1 — Host on GitHub Pages (free, ~10 minutes)

1. Go to **github.com** and create a free account (or sign in).
2. Click **New repository** → name it `munchy-math` → set to **Public** → click Create.
3. Upload all files from this folder (index.html, manifest.json, sw.js, all icon-*.png files).
4. Go to **Settings → Pages** → under "Branch" select `main` → click Save.
5. Wait ~2 minutes. Your app is now live at:
   `https://YOUR-USERNAME.github.io/munchy-math/`
6. Open that URL on your phone and verify the game works and installs as a PWA.

> **Important:** The URL must use HTTPS (GitHub Pages does this automatically).

---

## Step 2 — Generate Android APK with PWABuilder (free, ~15 minutes)

1. Go to **pwabuilder.com**
2. Enter your GitHub Pages URL and click Start.
3. PWABuilder will check your PWA score (should be green on all checks).
4. Click **Package for stores → Android**.
5. Fill in:
   - **Package ID:** `com.yourname.munchymath` (use your own domain/name)
   - **App version:** `1`
   - **Version name:** `1.0.0`
   - Leave signing options as "Generate new signing key" — **save the key file and password safely, you need it for every update**.
6. Click **Generate** → download the `.zip` file.
7. Inside the zip you'll find an `.aab` file (Android App Bundle) — this is what you upload to Play Store.

---

## Step 3 — Google Play Console ($25 one-time, ~30 minutes)

1. Go to **play.google.com/console** and pay the $25 registration fee.
2. Click **Create app**.
3. Fill in app details:
   - **App name:** Munchy Math
   - **Default language:** English
   - **App or Game:** Game
   - **Free or Paid:** Free
4. Complete the store listing:
   - **Short description** (80 chars): Fun maths game for kids! Feed Munchy by solving equations. 🎮
   - **Full description:** See the text below ↓
   - **Screenshots:** Take 2–3 screenshots on a phone (or use Chrome DevTools mobile view). Minimum size 1080×1920.
   - **Feature graphic:** 1024×500 px banner image (use Canva — free).
   - **Icon:** Upload `icon-512.png`
5. Content rating questionnaire:
   - Select **Education**
   - Answer No to all violence/mature content questions
   - You'll receive an **Everyone** or **Everyone 3+** rating — perfect for a kids' app.
6. Target audience: Select **Ages 5-8** and/or **Ages 9-12**.
   - This triggers the Families policy compliance check.
   - Answer No to ads, No to data collection from children — both are true.
7. Upload the `.aab` file to the **Production** track.
8. Submit for review.

**Review time:** 3–7 days for a new developer account.

---

## Full description for Play Store

```
Munchy is hungry — help him eat by solving fun maths problems! 🍓🧮

Munchy Math is a colourful, encouraging maths game for kids aged 4 to 12. Tap the food with the right answer to feed Munchy, grow your streak, and unlock a collection of monster friends!

✨ FEATURES
• Addition, subtraction, multiplication and division
• Easy, Medium and Hard difficulty levels
• Learn Lab — see it, practise it, race the clock!
• Math Tricks — clever shortcuts that make maths easier
• Daily Challenges — a fresh challenge every day with a streak counter
• Advanced Mode — fractions and decimals for older learners
• Mastery Map — track which facts you know cold
• 6 languages: English, Hindi, Spanish, Tamil, Telugu, German
• Voice narration reads every question aloud
• Zero ads, zero data collection — completely safe for children
• Works fully offline after first load

🏆 DESIGNED FOR LEARNING
• Adaptive difficulty that adjusts as your child improves
• Never punishing — mistakes are treated as learning moments
• Parent section with progress stats and daily goal setting

Download free today and let the feeding frenzy begin! 🎉
```

---

## After launch checklist

- [ ] Share the Play Store link with friends and family for first reviews
- [ ] Reply to every review in the first week (Google rewards engagement)
- [ ] Take screenshots of the game in multiple languages for a localised listing
- [ ] Add `screenshot-play.png` (1080×1920) to the folder and re-upload for richer store listing
- [ ] Consider translating the store listing description into Hindi and Spanish (free in Play Console)

---

## Updating the app later

When you make changes to the game:
1. Update the cache version in `sw.js`: change `munchy-math-v1` to `munchy-math-v2`
2. Upload the updated files to GitHub (Pages auto-deploys in ~2 minutes)
3. In PWABuilder, generate a new APK — increment the **App version** number each time
4. Upload the new `.aab` to Play Console under the same app
