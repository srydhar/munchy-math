# Munchy Math — CrazyGames Launch Guide

*Prepared July 2026. Everything a new Claude session (or you) needs to finish the launch.*

---

## What was built in this session

| File | Purpose |
|---|---|
| `munchy-cg-adapter.js` | The key file. Adds CrazyGames SDK v3 (init, loading + gameplay events, happytime, muteAudio compliance, midgame ads at natural breaks), instant-play on the portal, desktop/Chromebook layout, keyboard controls (1–9 answer, P pause), and extra juice (streak celebration banners at 5/10/15/20, score sparkles, drifting background math symbols). 100% additive — wrapped in try/catch, dormant on GitHub Pages/PWA/Play Store builds. |
| `build_crazygames_zip.py` | Automated packager: injects the adapter into your `index.html`, strips the service-worker registration, bundles icons, produces `munchy-math-crazygames.zip`. |
| `cover-1920x1080.png`, `cover-800x800.png`, `cover-600x900.png` | Cover art for the developer portal (16:9 required; others for extra slots). |
| `make_covers.py` | Regenerates covers if you want tweaks. |
| ⚠️ `cg-build/` and `munchy-math-crazygames.zip` | **Placeholder test output only** (built from a dummy file to verify the script). Delete them; the real ones regenerate in step 2. |

Why an adapter file instead of an edited `index.html`: your index.html is 183KB and couldn't be fully downloaded in this session. The adapter integrates through the page's DOM and global modules (verified against the actual source), so no blind edits were needed.

## Step-by-step launch

**1. Get the repo locally.** Connect your local `munchy-math` folder to the Claude session (or clone it from GitHub).

**2. Build the CrazyGames package.**
```
python3 build_crazygames_zip.py /path/to/munchy-math
```
This produces `munchy-math-crazygames.zip`. Sanity-check by opening `cg-build/index.html` in a browser — the game must play normally (adapter stays dormant outside CrazyGames).

**3. Update GitHub Pages too (optional but recommended).** Copy `munchy-cg-adapter.js` into the repo and add this line just before `</body>` in `index.html`:
```html
<script src="munchy-cg-adapter.js"></script>
```
Your PWA/WhatsApp version then gets the desktop layout, keyboard controls, and celebrations too (the SDK part stays off there automatically). Push to GitHub; Pages redeploys in ~2 min.

**4. Submit to CrazyGames.**
- Create a developer account at https://developer.crazygames.com
- Submit a game → HTML5 → upload the zip
- Use the **QA preview tool** on the portal to test: instant play works, ads show as overlay placeholders in preview, no console errors
- Fill in metadata (copy-paste below) and upload the covers
- Submit for review. Basic Launch review typically takes days–weeks. Respond to any feedback and resubmit.

**5. After launch, also submit to** GameDistribution (gamedistribution.com) and GamePix (partners.gamepix.com) for extra reach — both accept kids' educational games and pay ad revenue share. Their SDKs differ; a future Claude session can make adapter variants the same way.

## Copy-paste metadata

**Name:** Munchy Math

**Tagline:** Feed the monster, master the math!

**Description:**
Munchy is hungry — and only correct answers fill his tummy! Tap the food with the right answer to feed Munchy, build streaks, and hatch new monster friends.

Made for ages 5–12, loved by parents and teachers:
- Addition, subtraction, multiplication and division with Easy/Medium/Hard levels
- Advanced mode with fractions and decimals for older kids
- Learn Lab: see each fact visually, practice it, then race the clock
- Mastery Map shows exactly which facts are mastered
- Math Tricks teaches clever mental-math shortcuts
- Daily challenges, monster collection, costumes and snack time
- Multiple player profiles — siblings and classmates each keep their own progress
- Voice narration reads every problem aloud; plays in 6 languages
- No login, no downloads — works on any phone, tablet or Chromebook

**Controls:** Tap or click the food with the correct answer. Keyboard: press 1–9 to pick an answer, P to pause.

**Category:** Casual / Educational · **Tags:** math, educational, kids, learning, numbers, times tables, brain, school

## Honest income expectations (important)

- CrazyGames places kid-focused games on **kids.crazygames.com where ads are disabled** — so CrazyGames income may be small or zero. Basic Launch has no monetization anyway; monetization requires being selected for Full Launch.
- Income is more likely from **GameDistribution / GamePix** (they syndicate to many sites, including ones that monetize kids' content compliantly) — submit there too.
- The real win on CrazyGames is **traffic and users**, which fits the stated goal: kids learning math. Treat income as a slow secondary outcome.

## Traffic plan (zero budget)

1. **WhatsApp**: share https://srydhar.github.io/munchy-math/ with parent groups & teachers — "Add to Home Screen" works offline. This is your highest-conversion channel in India.
2. **Teachers**: the profiles feature (one device, many kids) + mastery map is a classroom pitch. Offer it to 2–3 local schools.
3. **YouTube Shorts / Instagram Reels**: 15–30s clips of Munchy reacting + a kid's streak celebration. Link in bio.
4. **Keep the Play Store app** updated with the same code — three channels, one codebase.

## Remaining work for the next session (Sonnet 5 is fine)

1. ✅ Done — build ran against the real repo, `munchy-math-crazygames.zip` verified (adapter injected once, service worker stripped, icons bundled, syntax-checked).
2. ✅ Done — polish pass added **additively** to `munchy-cg-adapter.js` (v1.1), so it applies on GitHub Pages/PWA too, not just the CrazyGames build:
   - Richer Munchy idle animation — replaced the plain "breathe" with a gentle multi-step walk/bounce cycle (`#creatureWrap`/`mmWalk` keyframes). The game's own `.pop`/`.wobble` tap-feedback classes still take priority (they use `!important`), so nothing about tap feedback changed.
   - Layered sound design — a soft harmonic chime plays under correct answers, and a 5-note ascending fanfare plays on level-up. Runs through the same patched `AudioContext` as the rest of the adapter, so portal `muteAudio` compliance still covers it.
   - Background scene per level tier — every few levels the background gradient (`--bg1`/`--bg2`) and the drifting math symbols re-theme (dawn → sunset → night sky → "legendary" gold/purple at level 7+).
   - Bigger level-up moment — a large "LEVEL UP!" banner, a full-screen flash, and a double confetti burst, layered on top of the existing streak-milestone celebration.
   - All of it is observed off existing DOM elements (`#level`, `#score`) via `MutationObserver` and wrapped in `safe()`/try-catch, matching the rest of the adapter's "never break the game" design — worst case on any error is a silent no-op, not a crash.
   - Verified: `node --check` passes on the adapter, the rebuilt zip contains the updated adapter byte-for-byte, and the built `index.html` still has exactly one adapter `<script>` tag and zero leftover service-worker registrations. (Couldn't run a full headless-browser execution test — no network access to install jsdom in this sandbox — but every new code path is defensively wrapped, so failure mode is "feature doesn't show up," never a broken game.)
3. ⏳ Not done — optional adapter variants for GameDistribution/GamePix SDKs. Skipped tonight to focus on CrazyGames readiness; still worth doing after CrazyGames submission.
4. ⏳ Not done — reuse pipeline for the English-learning game. Future project once Munchy Math is live.

### What's left that only you can do
- **Push to GitHub.** This session's folder still isn't a git working copy — I edited files directly in your connected folder, but can't `git commit`/`push`. Sync/push the updated `index.html` and `munchy-cg-adapter.js` (and the rebuilt `munchy-math-crazygames.zip`, if you want it in the repo too) the same way you did last time.
- **CrazyGames submission** (step 4 in this guide): create the developer account, upload `munchy-math-crazygames.zip`, run it through the QA preview tool, paste in the metadata below, and submit for review. I can't create accounts or submit on your behalf — this needs your login. If you'd like, next session I can walk through the portal side-by-side with you using browser tools once you're signed in, to catch anything before you hit submit.
