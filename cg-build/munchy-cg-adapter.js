/* ============================================================================
   Munchy Math — CrazyGames Portal Adapter + Desktop/Polish Pack  (v1.2)
   ----------------------------------------------------------------------------
   Include as the LAST script before </body>:
       <script src="munchy-cg-adapter.js"></script>

   100% additive — it never modifies existing game code. Everything is wrapped
   in try/catch, so the GitHub Pages / PWA / Play Store versions keep working
   exactly as before. On CrazyGames it activates:

   1. CrazyGames SDK v3 (init, loading events, gameplayStart/Stop, happytime)
   2. muteAudio compliance (mutes WebAudio + speech when the portal asks)
   3. Instant-play (lands kids straight in gameplay — a Full Launch requirement)
   4. Midgame ads at natural breaks only (quit / daily-challenge end, ≥3 min apart)
   Everywhere (portal AND own site) it adds:
   5. Desktop / Chromebook layout (centered column, decorative background)
   6. Keyboard controls (number keys answer, P pause, Esc quit menus)
   7. Extra juice: streak-milestone celebrations, score sparkles, drifting
      background math symbols
   8. Richer Munchy idle animation (gentle walk/bounce cycle, additive CSS only)
   9. Layered sound design (soft harmonic chime layered on top of correct
      answers; bigger arpeggio fanfare on level-up) — plays through the same
      muted-AudioContext pool, so portal muteAudio compliance still applies
   10. Background scene shift per level tier (color theme + drifting symbols
       change every few levels) and a bigger level-up moment (banner + flash +
       big confetti burst + fanfare)
   11. Intro sequence on page load: "Learn Like a Pro Labs" studio splash (spinning
       gradient ring, glowing badge, shine-sweep wordmark) -> Munchy Math logo ->
       loading progress bar -> reveals the start screen
   12. "Get Ready! 5-4-3-2-1" countdown the moment Play is actually clicked,
       intercepted via document-capture so it runs before the game's own
       click handler and replays faithfully afterward — no timers/energy
       ticking during the countdown
   13. CrazyGames Data module integration (cross-device cloud save) — dual-
       writes every localStorage call into CG.sdk.data with zero changes to
       index.html, and migrates existing progress in either direction the
       first time it runs on a given browser. Requires selecting "Yes, using
       the Data Module" in the CrazyGames submission form's Progress Save
       setting, or the SDK disables the module and this silently no-ops.
   14. Sitelock — the game only renders on CrazyGames domains plus the
       official srydhar.github.io / localhost / file:// origins (per
       https://docs.crazygames.com/resources/html5/sitelock/). Anywhere
       else the screens are hidden and a "play it here" message is shown
       instead, so a copy-pasted zip can't be silently re-hosted.
   15. Privacy/Terms notice — a small non-blocking link (home-screen footer
       + a line in the Parent section) pointing to the game's Privacy
       Policy, since the profile screen has a free-text name field (see
       https://docs.crazygames.com/requirements/technical/#user-consent).
   16. Soft ambient background music bed under active play (quiet, breathing
       pad), starting/stopping with gameplayStart()/gameplayStop(), riding
       the same shared/muted AudioContext as the rest of the sound layer.
   17. Screen transitions — quick fade/scale-in + soft whoosh whenever any
       menu screen becomes visible, and level-tier food-color theming via a
       CSS filter on #field. Both purely cosmetic/additive.
   ========================================================================== */
(function () {
  "use strict";
  var CG = { env: "none", sdk: null, muted: false, lastAd: 0, inPlay: false };
  function safe(fn) { try { return fn(); } catch (e) { /* never break the game */ } }

  /* ------------------------------------------------------------------ *
   * 0.  Audio interception layer (must exist before first Play click). *
   *     The game creates its AudioContexts lazily, so patching the     *
   *     constructor here still catches them all.                       *
   * ------------------------------------------------------------------ */
  var ctxs = [];
  safe(function () {
    var RealAC = window.AudioContext || window.webkitAudioContext;
    if (!RealAC) return;
    var Patched = function () {
      var c = new RealAC();
      ctxs.push(c);
      if (CG.muted) safe(function () { c.suspend(); });
      return c;
    };
    Patched.prototype = RealAC.prototype;
    window.AudioContext = Patched;
    window.webkitAudioContext = Patched;
  });
  var realSpeak = null;
  safe(function () {
    if (!window.speechSynthesis) return;
    realSpeak = window.speechSynthesis.speak.bind(window.speechSynthesis);
    window.speechSynthesis.speak = function (u) { if (!CG.muted) realSpeak(u); };
  });
  function setMuted(m) {
    CG.muted = !!m;
    ctxs.forEach(function (c) { safe(function () { m ? c.suspend() : c.resume(); }); });
    if (m) safe(function () { window.speechSynthesis.cancel(); });
  }

  /* ------------------------------------------------------------------ *
   * 1.  CrazyGames SDK v3 — loaded dynamically with graceful fallback. *
   *     On GitHub Pages the SDK reports env "disabled" and we no-op.   *
   *     Offline (PWA) the script fails to load and we no-op.           *
   * ------------------------------------------------------------------ */
  function sdkGame() { return CG.sdk && CG.sdk.game; }
  function active() { return CG.env === "crazygames" || CG.env === "local"; }

  function gameplayStart() { if (active()) safe(function () { sdkGame().gameplayStart(); }); CG.inPlay = true; safe(startBgMusic); }
  function gameplayStop()  { if (active()) safe(function () { sdkGame().gameplayStop();  }); CG.inPlay = false; safe(stopBgMusic); }

  function requestMidgameAd() {
    if (!active()) return;
    var now = Date.now();
    if (now - CG.lastAd < 180000) return;      // at most one ad per 3 minutes
    CG.lastAd = now;
    safe(function () {
      var wasMuted = CG.muted;
      var done = function () { if (!wasMuted) setMuted(false); };
      setMuted(true);                           // required: silence during ads
      var p = CG.sdk.ad.requestAd("midgame", { adFinished: done, adError: done, adStarted: function () {} });
      if (p && p.then) p.then(done).catch(done);
      setTimeout(done, 45000);                  // absolute safety net
    });
  }

  // loadingStop() is deferred until the intro splash (section 9 below) also
  // finishes, so from the portal's point of view the splash IS the loading
  // screen — instantPlay() below still fires the moment the SDK is ready,
  // independent of the splash timer, so actual gameplayStart() isn't delayed.
  var sdkReady = false, loadingStopped = false;
  function maybeStopLoading() {
    if (sdkReady && splashDone && !loadingStopped && active()) {
      loadingStopped = true;
      safe(function () { CG.sdk.game.loadingStop(); });
    }
  }
  // Safety net: if the splash overlay fails to build/run for any reason,
  // never leave the portal's loading screen stuck waiting on it.
  setTimeout(function () { splashDone = true; maybeStopLoading(); }, 8000);

  /* ------------------------------------------------------------------ *
   * CrazyGames Data module — cross-device cloud save.                  *
   *                                                                     *
   * The game already saves everything through plain localStorage (see  *
   * Profiles/Mastery/Treats/Goal modules in index.html). The Data      *
   * module has the exact same get/setItem/removeItem/clear API, so no  *
   * game code needs to change — we dual-write every localStorage call  *
   * into CG.sdk.data going forward, which is what actually persists    *
   * reliably inside the CrazyGames iframe and syncs across devices for *
   * logged-in users (CrazyGames warns plain localStorage isn't         *
   * reliable there — this fixes exactly that).                        *
   *                                                                     *
   * Because this script loads last, the game's own modules have        *
   * already hydrated once from local storage by the time this runs.    *
   * For repeat visits on the SAME device that's harmless — we always   *
   * mirror writes back into real localStorage too, so it stays         *
   * current. For a brand-new device (or cleared browser) that already  *
   * has cloud progress under this CrazyGames account, we detect that   *
   * on this pass, copy it down into localStorage, and reload the page  *
   * exactly once (guarded via sessionStorage) so the game re-hydrates  *
   * from the now-populated local data.                                 *
   * ------------------------------------------------------------------ */
  function hookDataModule() {
    if (!active() || !CG.sdk || !CG.sdk.data) return;
    var data = CG.sdk.data;
    var realGet = Storage.prototype.getItem;
    var realSet = Storage.prototype.setItem;
    var realRemove = Storage.prototype.removeItem;
    var realClear = Storage.prototype.clear;
    var PROFILE_BASES = ["munchy", "munchyMastery", "munchyTreats", "munchyGoal", "munchyLearn", "munchyTricks"];
    var GLOBAL_KEYS = ["munchyProfiles", "munchyVoice"];

    var didReload = false;
    safe(function () {
      if (sessionStorage.getItem("mmCgDataSyncDone")) return;
      sessionStorage.setItem("mmCgDataSyncDone", "1");
      var pulledDown = false;
      function pull(key) {
        var cloudVal = data.getItem(key);
        var localVal = realGet.call(localStorage, key);
        if (cloudVal !== null && cloudVal !== undefined && cloudVal !== localVal) {
          realSet.call(localStorage, key, cloudVal);
          pulledDown = true;
        }
      }
      GLOBAL_KEYS.forEach(pull);
      // discover profile ids from the (possibly just-pulled-down) profile list
      // so we can pull each profile's namespaced keys down too
      safe(function () {
        var raw = realGet.call(localStorage, "munchyProfiles");
        var profs = raw ? JSON.parse(raw).list : [];
        profs.forEach(function (p) {
          PROFILE_BASES.forEach(function (base) { pull(base + "::" + p.id); });
        });
      });
      if (pulledDown) {
        // also back up anything local-only that the cloud didn't have, then reload
        // once so the game re-hydrates from the now-complete localStorage.
        for (var i = 0; i < localStorage.length; i++) {
          var k = localStorage.key(i);
          if (data.getItem(k) === null) {
            (function (kk) { safe(function () { data.setItem(kk, realGet.call(localStorage, kk)); }); })(k);
          }
        }
        didReload = true;
        location.reload();
        return;
      }
      // no cloud data yet (first time this account/guest has played, or this is
      // the first load since integrating the Data module) — push existing local
      // progress up so it's backed up going forward.
      for (var j = 0; j < localStorage.length; j++) {
        var lk = localStorage.key(j);
        if (data.getItem(lk) === null) {
          (function (kk) { safe(function () { data.setItem(kk, realGet.call(localStorage, kk)); }); })(lk);
        }
      }
    });
    if (didReload) return;

    Storage.prototype.setItem = function (key, value) {
      var r = realSet.call(this, key, value);
      if (this === localStorage) safe(function () { data.setItem(key, value); });
      return r;
    };
    Storage.prototype.removeItem = function (key) {
      var r = realRemove.call(this, key);
      if (this === localStorage) safe(function () { data.removeItem(key); });
      return r;
    };
    Storage.prototype.clear = function () {
      var r = realClear.call(this);
      if (this === localStorage) safe(function () { data.clear(); });
      return r;
    };
  }

  function hookSDK() {
    var s = document.createElement("script");
    s.src = "https://sdk.crazygames.com/crazygames-sdk-v3.js";
    s.onload = function () {
      safe(function () {
        window.CrazyGames.SDK.init().then(function () {
          CG.sdk = window.CrazyGames.SDK;
          CG.env = CG.sdk.environment || "disabled";
          if (!active()) return;
          safe(function () { CG.sdk.game.loadingStart(); });
          sdkReady = true;
          maybeStopLoading();
          // ---- cross-device cloud save via the Data module ----
          safe(hookDataModule);
          // ---- muteAudio compliance ----
          safe(function () {
            if (CG.sdk.game.settings && CG.sdk.game.settings.muteAudio) setMuted(true);
            CG.sdk.game.addSettingsChangeListener(function (st) { setMuted(!!st.muteAudio); });
          });
          // ---- happytime on daily-goal celebrations ----
          safe(function () {
            if (window.GoalUI && window.GoalUI.celebrate) {
              var orig = window.GoalUI.celebrate;
              window.GoalUI.celebrate = function () {
                safe(function () { CG.sdk.game.happytime(); });
                return orig.apply(this, arguments);
              };
            }
          });
          instantPlay();
        }).catch(function () {});
      });
    };
    s.onerror = function () { /* offline / blocked — stay dormant */ };
    document.head.appendChild(s);
  }

  /* ------------------------------------------------------------------ *
   * 2.  Gameplay start/stop hooks on the existing buttons.             *
   * ------------------------------------------------------------------ */
  function on(id, fn) {
    var n = document.getElementById(id);
    if (n) n.addEventListener("click", fn);
  }
  function hookGameplayEvents() {
    on("playBtn", gameplayStart);
    on("resumeBtn", gameplayStart);
    on("pauseBtn", gameplayStop);
    on("quitBtn", function () { gameplayStop(); requestMidgameAd(); });
    on("dcStartBtn", gameplayStart);
    on("dcPlayBack", gameplayStop);
    on("dcResHome", function () { gameplayStop(); requestMidgameAd(); });
    on("practiceBtn", gameplayStart);
    on("speedBtn", gameplayStart);
    on("pracBack", gameplayStop);
    on("resMenu", gameplayStop);
    on("resAgain", gameplayStart);
  }

  /* ------------------------------------------------------------------ *
   * 3.  Instant play — portal users land in gameplay in one step.      *
   *     Only on CrazyGames; your own site keeps the friendly menu.     *
   * ------------------------------------------------------------------ */
  function instantPlay() {
    safe(function () {
      var start = document.getElementById("startScreen");
      var play = document.getElementById("playBtn");
      if (start && play && !start.classList.contains("hidden")) play.click();
    });
  }

  /* ------------------------------------------------------------------ *
   * 4.  Keyboard controls (desktop / Chromebook)                       *
   *     1..9 → tap the matching food bubble (left to right),           *
   *     also works on daily-challenge & advanced multiple choice.      *
   *     P → pause/resume, Esc → close the top screen if it has ✕.      *
   * ------------------------------------------------------------------ */
  function visible(el) { return el && el.offsetParent !== null; }
  function clickNth(sel, n) {
    var items = Array.prototype.filter.call(document.querySelectorAll(sel), visible);
    if (n >= 1 && n <= items.length) {
      // sort left-to-right so keys match what the child sees
      items.sort(function (a, b) { return a.getBoundingClientRect().left - b.getBoundingClientRect().left; });
      items[n - 1].click();
      return true;
    }
    return false;
  }
  function hookKeyboard() {
    window.addEventListener("keydown", function (ev) {
      if (ev.target && (ev.target.tagName === "INPUT" || ev.target.tagName === "SELECT")) return;
      var k = ev.key;
      if (k >= "1" && k <= "9") {
        var n = +k;
        if (clickNth("#field .food", n)) return;
        if (clickNth(".dc-choices .dc-choice", n)) return;
        if (clickNth("#advChoices .adv-choice", n)) return;
        // Learn-Lab number pad: type the digit
        clickNthPadKey(k);
      } else if (k === "0") { clickNthPadKey("0"); }
      else if (k === "Enter") { clickPadByText("✓") || clickPadByText("OK") || clickPadByText("GO"); }
      else if (k === "Backspace") { clickPadByText("⌫") || clickPadByText("DEL"); }
      else if (k === "p" || k === "P") {
        var pause = document.getElementById("pauseScreen");
        if (pause && pause.classList.contains("hidden")) { var b = document.getElementById("pauseBtn"); if (visible(b)) b.click(); }
        else { var r = document.getElementById("resumeBtn"); if (visible(r)) r.click(); }
      }
    });
  }
  function clickNthPadKey(digit) {
    var keys = Array.prototype.filter.call(document.querySelectorAll("#pad .key"), visible);
    for (var i = 0; i < keys.length; i++) {
      if (keys[i].textContent.trim() === digit) { keys[i].click(); return true; }
    }
    return false;
  }
  function clickPadByText(txt) {
    var keys = Array.prototype.filter.call(document.querySelectorAll("#pad .key"), visible);
    for (var i = 0; i < keys.length; i++) {
      if (keys[i].textContent.indexOf(txt) >= 0) { keys[i].click(); return true; }
    }
    return false;
  }

  /* ------------------------------------------------------------------ *
   * 5.  Desktop / Chromebook layout + decorative backdrop.             *
   *     The game stays a centered phone-style column (its layout is    *
   *     designed for that); the extra width becomes a friendly themed  *
   *     backdrop, so it looks intentional on 16:9 iframes.             *
   * ------------------------------------------------------------------ */
  function injectDesktopCSS() {
    var css = [
      /* CrazyGames' documented non-fullscreen preview sizes run from 821x462 up */
      /* to 1216x684 (all ~16:9) — this threshold is set just below their        */
      /* smallest listed size so every one of them gets the pillarbox treatment. */
      "@media (min-width: 800px) and (min-height: 440px) {",
      "  #app, .screen {",
      "    left: 50% !important; right: auto !important;",
      "    width: 520px !important; margin-left: -260px;",
      "    box-shadow: 0 0 60px rgba(0,0,0,.28);",
      "    border-radius: 0;",
      "  }",
      "  body { overflow: hidden; }",
      "  .food { width: 84px !important; height: 84px !important; font-size: 33px !important; }",
      "}",
      /* drifting background math symbols */
      ".mm-drift { position: fixed; pointer-events: none; color: rgba(255,255,255,.14);",
      "  font-weight: 900; z-index: 0; user-select: none;",
      "  animation: mmDrift linear infinite; }",
      "@keyframes mmDrift { from { transform: translateY(105vh) rotate(0deg); }",
      "  to { transform: translateY(-12vh) rotate(35deg); } }",
      /* streak milestone banner */
      "#mmStreakBanner { position: fixed; top: 18%; left: 50%; transform: translateX(-50%) scale(0);",
      "  background: linear-gradient(135deg,#ff6b6b,#ffd23f); color: #23204d; font-weight: 900;",
      "  font-size: 26px; padding: 14px 30px; border-radius: 999px; z-index: 95;",
      "  box-shadow: 0 10px 40px rgba(0,0,0,.35); pointer-events: none;",
      "  font-family: -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif; }",
      "#mmStreakBanner.go { animation: mmBanner 1.6s cubic-bezier(.34,1.56,.64,1) both; }",
      "@keyframes mmBanner { 0% { transform: translateX(-50%) scale(0); opacity: 0; }",
      "  18% { transform: translateX(-50%) scale(1.08); opacity: 1; }",
      "  30% { transform: translateX(-50%) scale(1); }",
      "  80% { transform: translateX(-50%) scale(1); opacity: 1; }",
      "  100% { transform: translateX(-50%) scale(.8); opacity: 0; } }",
      /* richer idle animation — gentle walk/bounce cycle. Same selector as the  */
      /* base stylesheet's #creatureWrap{animation:breathe...}; because this    */
      /* <style> tag is appended after the page's own, equal-specificity rules  */
      /* resolve in source order, so this cleanly replaces just the animation.  */
      /* The game's own .pop/.wobble feedback classes use !important and still  */
      /* take priority over both, so tap feedback is unaffected.                */
      "#creatureWrap { animation: mmWalk 2.4s ease-in-out infinite; }",
      "@keyframes mmWalk {",
      "  0%   { transform: translateY(0)    rotate(0deg)    scale(1); }",
      "  15%  { transform: translateY(-7px) rotate(-2.5deg) scale(1.02,0.985); }",
      "  30%  { transform: translateY(0)    rotate(0deg)    scale(1.03,0.97); }",
      "  45%  { transform: translateY(-3px) rotate(2.5deg)  scale(1.01,0.99); }",
      "  60%  { transform: translateY(-8px) rotate(0deg)    scale(0.99,1.02); }",
      "  75%  { transform: translateY(0)    rotate(-1.5deg) scale(1.02,0.98); }",
      "  100% { transform: translateY(0)    rotate(0deg)    scale(1); }",
      "}",
      /* background scene per level tier — smooth crossfade of the gradient */
      "body { transition: background-color 1.1s ease; }",
      "#app, .screen { transition: background 1.1s ease; }",
      /* bigger level-up moment */
      "#mmLevelBanner { position: fixed; top: 30%; left: 50%; transform: translateX(-50%) scale(0);",
      "  background: linear-gradient(135deg,#a78bfa,#4ecdc4,#ffd23f); background-size:220% 220%;",
      "  color: #fff; text-shadow:0 3px 0 rgba(0,0,0,.25); font-weight: 900;",
      "  font-size: 34px; padding: 20px 40px; border-radius: 26px; z-index: 96;",
      "  box-shadow: 0 14px 50px rgba(0,0,0,.4); pointer-events: none; text-align:center;",
      "  font-family: -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif; }",
      "#mmLevelBanner.go { animation: mmLevelBanner 2.1s cubic-bezier(.34,1.56,.64,1) both, mmLevelGrad 2.1s ease both; }",
      "@keyframes mmLevelBanner { 0% { transform: translateX(-50%) scale(0) rotate(-6deg); opacity: 0; }",
      "  20% { transform: translateX(-50%) scale(1.15) rotate(3deg); opacity: 1; }",
      "  35% { transform: translateX(-50%) scale(1) rotate(0deg); }",
      "  85% { transform: translateX(-50%) scale(1) rotate(0deg); opacity: 1; }",
      "  100% { transform: translateX(-50%) scale(.75) rotate(4deg); opacity: 0; } }",
      "@keyframes mmLevelGrad { 0% { background-position: 0% 50%; } 100% { background-position: 100% 50%; } }",
      "#mmFlash { position: fixed; inset: 0; background: #fff; opacity: 0; pointer-events: none; z-index: 93; }",
      "#mmFlash.go { animation: mmFlash .5s ease-out both; }",
      "@keyframes mmFlash { 0% { opacity: .55; } 100% { opacity: 0; } }",
      /* intro splash: studio card -> game logo -> loading bar (page load) */
      /* + separate "Get Ready" 5..1 countdown overlay (fires on Play click) */
      "#mmSplash, #mmReady { position: fixed; inset: 0; z-index: 999; display: flex; flex-direction: column;",
      "  align-items: center; justify-content: center; gap: 14px; overflow: hidden;",
      "  background: radial-gradient(120% 90% at 50% 20%,var(--bg2),var(--bg1) 75%); opacity: 1; transition: opacity .5s ease;",
      "  font-family: -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif; text-align: center; padding: 20px; }",
      "#mmSplash.mm-out, #mmReady.mm-out { opacity: 0; pointer-events: none; }",
      "#mmAmbient { position: absolute; inset: 0; z-index: 0; overflow: hidden; }",
      "#mmAmbient .mmRay { position: absolute; inset: -60%;",
      "  background: conic-gradient(from 0deg,transparent 0deg,rgba(255,255,255,.07) 35deg,transparent 90deg,transparent 200deg,rgba(255,255,255,.05) 240deg,transparent 300deg);",
      "  animation: mmRaySpin 44s linear infinite; }",
      "@keyframes mmRaySpin { to { transform: rotate(360deg); } }",
      ".mmBokeh { position: absolute; bottom: -40px; border-radius: 50%; filter: blur(1px);",
      "  background: radial-gradient(circle,rgba(255,255,255,.55),rgba(255,255,255,0) 72%); animation: mmBokehFloat linear infinite; }",
      "@keyframes mmBokehFloat { 0% { transform: translateY(0) scale(.8); opacity: 0; } 12% { opacity: .5; } 88% { opacity: .35; }",
      "  100% { transform: translateY(-115vh) scale(1.15); opacity: 0; } }",
      "#mmSplash .mmBar { position: absolute; left: 0; right: 0; height: 30px; background: #16132b; z-index: 6; transition: transform .55s cubic-bezier(.6,0,.3,1); }",
      "#mmSplash .mmBarTop { top: 0; }",
      "#mmSplash .mmBarBot { bottom: 0; }",
      "#mmSplash.mm-reveal .mmBarTop { transform: translateY(-100%); }",
      "#mmSplash.mm-reveal .mmBarBot { transform: translateY(100%); }",
      "#mmWipe { position: absolute; inset: 0; z-index: 5; pointer-events: none; opacity: 0;",
      "  background: linear-gradient(100deg,transparent 42%,rgba(255,255,255,.85) 50%,transparent 58%); transform: translateX(-140%); }",
      "#mmWipe.go { animation: mmWipeSweep .6s ease both; }",
      "@keyframes mmWipeSweep { 0% { transform: translateX(-140%); opacity: 0; } 12% { opacity: 1; } 55% { transform: translateX(0%); opacity: 1; }",
      "  100% { transform: translateX(140%); opacity: 0; } }",
      "#mmSplash .mm-phase { position: relative; z-index: 1; display: none; flex-direction: column; align-items: center; gap: 14px; }",
      "#mmSplash .mm-phase.on { display: flex; animation: mmSplashIn .6s cubic-bezier(.22,1,.36,1) both; }",
      "@keyframes mmSplashIn { 0% { opacity: 0; transform: scale(.82) translateY(16px); filter: blur(5px); }",
      "  60% { filter: blur(0); } 100% { opacity: 1; transform: scale(1) translateY(0); filter: blur(0); } }",
      "#mmStudioTag { font-size: 14px; font-weight: 700; color: #fff; opacity: .75; letter-spacing: 4px; text-transform: uppercase; margin-bottom: 2px; }",
      "@keyframes mmImpact { 0% { transform: scale(.3) rotate(-8deg); opacity: 0; } 55% { transform: scale(1.12) rotate(2deg); opacity: 1; }",
      "  75% { transform: scale(.96) rotate(-1deg); } 100% { transform: scale(1) rotate(0deg); } }",
      "#mmStudioBadge { position: relative; width: 172px; height: 130px; display: flex; align-items: center; justify-content: center; }",
      "#mmBurstRing { position: absolute; width: 190px; height: 150px; left: 50%; top: 50%; margin: -75px 0 0 -95px; border-radius: 50%;",
      "  background: radial-gradient(circle,rgba(255,255,255,.6),rgba(255,255,255,0) 70%); animation: mmBurstPulse 1s ease-out both; }",
      "@keyframes mmBurstPulse { 0% { transform: scale(.15); opacity: 1; } 100% { transform: scale(1.7); opacity: 0; } }",
      "#mmStudioLogoImg { position: relative; width: 172px; height: auto; display: block;",
      "  filter: drop-shadow(0 10px 20px rgba(0,0,0,.35)) drop-shadow(0 0 26px rgba(255,255,255,.4));",
      "  animation: mmImpact .7s cubic-bezier(.34,1.56,.64,1) both; }",
      ".mmSparkle { position: absolute; font-size: 16px; color: #fff; text-shadow: 0 0 8px rgba(255,255,255,.9); animation: mmTwinkle 1.6s ease-in-out infinite; }",
      ".mmSparkle.s1 { top: -8px; right: 10px; }",
      ".mmSparkle.s2 { bottom: 10px; left: -6px; font-size: 12px; animation-delay: .45s; }",
      ".mmSparkle.s3 { top: 46px; left: -14px; font-size: 10px; animation-delay: .9s; }",
      "@keyframes mmTwinkle { 0%,100% { opacity: .25; transform: scale(.7) rotate(0deg); } 50% { opacity: 1; transform: scale(1.15) rotate(15deg); } }",
      "#mmStudioName { font-size: clamp(21px,5.2vw,30px); font-weight: 900; letter-spacing: .5px; text-transform: uppercase; line-height: 1.25; max-width: 300px;",
      "  background: linear-gradient(100deg,#fff 0%,#fff 35%,#ffe9a8 45%,#fff 55%,#fff 100%);",
      "  background-size: 220% 100%; -webkit-background-clip: text; background-clip: text; color: transparent;",
      "  animation: mmShine 2.4s ease-in-out .3s 1; text-shadow: 0 6px 14px rgba(0,0,0,.3); }",
      "@keyframes mmShine { 0% { background-position: 140% 0; } 60%,100% { background-position: -40% 0; } }",
      "#mmStudioSub { font-size: 11px; font-weight: 800; letter-spacing: 5px; color: #fff; opacity: .9;",
      "  padding: 5px 15px; border: 1.5px solid rgba(255,255,255,.5); border-radius: 999px; margin-top: 2px; }",
      "#mmGameLogoWrap { position: relative; width: 170px; height: 170px; display: flex; align-items: center; justify-content: center; }",
      "#mmGameGlow { position: absolute; width: 190px; height: 190px; border-radius: 50%;",
      "  background: radial-gradient(circle,rgba(255,255,255,.4),rgba(255,255,255,0) 70%); animation: mmGameGlowPulse 1.6s ease-in-out infinite; }",
      "@keyframes mmGameGlowPulse { 0%,100% { opacity: .65; transform: scale(1); } 50% { opacity: 1; transform: scale(1.08); } }",
      "#mmGameLogoImg { position: relative; width: 168px; height: 168px; display: block;",
      "  filter: drop-shadow(0 12px 22px rgba(0,0,0,.3));",
      "  animation: mmImpact .7s cubic-bezier(.34,1.56,.64,1) both, mmFaceBounce 1.9s ease-in-out .7s infinite; }",
      "@keyframes mmFaceBounce { 0%,100% { transform: translateY(0) rotate(0deg); } 50% { transform: translateY(-9px) rotate(-2.5deg); } }",
      "#mmGameName { font-size: clamp(28px,7vw,40px); font-weight: 900; color: #fff; text-shadow: 0 6px 0 rgba(0,0,0,.15); }",
      "#mmGameTag { font-size: 11px; font-weight: 800; letter-spacing: 3px; color: #fff; opacity: .9;",
      "  padding: 5px 15px; border: 1.5px solid rgba(255,255,255,.5); border-radius: 999px; margin-top: 6px; }",
      "#mmLoadLabel { font-size: 13px; font-weight: 800; color: #fff; opacity: .85; letter-spacing: 2px; text-transform: uppercase; min-width: 130px; text-align: left; }",
      "#mmLoadRow { display: flex; align-items: baseline; gap: 8px; }",
      "#mmLoadPct { font-size: 13px; font-weight: 800; color: var(--accent); opacity: .95; min-width: 32px; }",
      "#mmLoadWrap { position: relative; width: 220px; height: 10px; border-radius: 999px; background: rgba(255,255,255,.25); overflow: hidden;",
      "  box-shadow: inset 0 1px 3px rgba(0,0,0,.25); }",
      "#mmLoadBar { position: relative; height: 100%; width: 0%; border-radius: 999px; background: linear-gradient(90deg,#ffd23f,#ff7eb3); transition: width .12s linear; overflow: hidden; }",
      "#mmLoadBar::after { content: ''; position: absolute; inset: 0; background: linear-gradient(100deg,transparent 30%,rgba(255,255,255,.65) 50%,transparent 70%);",
      "  background-size: 200% 100%; animation: mmBarShine 1s linear infinite; }",
      "@keyframes mmBarShine { 0% { background-position: 160% 0; } 100% { background-position: -60% 0; } }",
      "#mmLoadTip { font-size: 12px; color: #fff; opacity: .8; max-width: 260px; margin-top: 4px; font-weight: 700; min-height: 32px; }",
      "#mmCountLabel { font-size: 16px; font-weight: 800; color: #fff; opacity: .85; letter-spacing: 1px; }",
      "#mmCountNum { font-size: 88px; font-weight: 900; color: var(--accent); text-shadow: 0 8px 0 rgba(0,0,0,.2); }",
      "#mmCountNum.pop { animation: mmCountPop .5s cubic-bezier(.34,1.56,.64,1); }",
      "@keyframes mmCountPop { 0% { transform: scale(.4); opacity: 0; } 50% { transform: scale(1.25); opacity: 1; } 100% { transform: scale(1); opacity: 1; } }",
      "#mmSkip { position: absolute; bottom: 22px; font-size: 13px; color: #fff; opacity: .6; font-weight: 700; }",
      /* screen fade-in — only affects entry (never touches hidden/display timing), */
      /* so it can't conflict with offsetParent-based visibility checks elsewhere.  */
      "@keyframes mmScreenIn { 0% { opacity: 0; transform: scale(.97); } 100% { opacity: 1; transform: scale(1); } }",
      ".screen.mm-screen-in { animation: mmScreenIn .22s ease both; }",
      /* food colors drift with the level-tier scene theme (purely visual, additive) */
      "#field { transition: filter .9s ease; }",
      "body.mm-tier-1 #field { filter: hue-rotate(0deg); }",
      "body.mm-tier-2 #field { filter: hue-rotate(35deg) saturate(1.05); }",
      "body.mm-tier-3 #field { filter: hue-rotate(200deg) saturate(1.1) brightness(1.05); }",
      "body.mm-tier-4 #field { filter: hue-rotate(280deg) saturate(1.2); }"
    ].join("\n");
    var st = document.createElement("style");
    st.textContent = css;
    document.head.appendChild(st);
  }
  function spawnDrifters(customSyms) {
    var syms = customSyms || ["＋", "−", "×", "÷", "=", "★", "3", "7", "9"];
    for (var i = 0; i < 14; i++) {
      var d = document.createElement("div");
      d.className = "mm-drift";
      d.textContent = syms[i % syms.length];
      d.style.left = (Math.random() * 96) + "vw";
      d.style.fontSize = (18 + Math.random() * 34) + "px";
      d.style.animationDuration = (16 + Math.random() * 22) + "s";
      d.style.animationDelay = (-Math.random() * 30) + "s";
      document.body.appendChild(d);
    }
  }

  /* ------------------------------------------------------------------ *
   * 6.  Extra juice: streak milestones + score sparkles.               *
   *     Implemented by observing the HUD (no game code changes).       *
   * ------------------------------------------------------------------ */
  var MILESTONES = { 5: "🔥 ON FIRE!", 10: "⚡ UNSTOPPABLE!", 15: "🌟 MATH WIZARD!", 20: "👑 LEGENDARY!" };
  function celebrateStreak(n) {
    var b = document.getElementById("mmStreakBanner");
    if (!b) { b = document.createElement("div"); b.id = "mmStreakBanner"; document.body.appendChild(b); }
    b.textContent = MILESTONES[n] + "  " + n + " in a row!";
    b.classList.remove("go"); void b.offsetWidth; b.classList.add("go");
    burst(window.innerWidth / 2, window.innerHeight * 0.3, 26);
  }
  function burst(x, y, count) {
    var colors = ["#ffd23f", "#ff6b6b", "#43e97b", "#a78bfa", "#4ecdc4", "#fff"];
    for (var i = 0; i < count; i++) {
      var p = document.createElement("div");
      p.style.cssText = "position:fixed;width:9px;height:9px;border-radius:50%;pointer-events:none;z-index:94;" +
        "background:" + colors[i % colors.length] + ";left:" + x + "px;top:" + y + "px;";
      document.body.appendChild(p);
      var a = Math.random() * Math.PI * 2, sp = 60 + Math.random() * 160;
      p.animate(
        [{ transform: "translate(0,0) scale(1)", opacity: 1 },
         { transform: "translate(" + Math.cos(a) * sp + "px," + (Math.sin(a) * sp + 70) + "px) scale(.4)", opacity: 0 }],
        { duration: 700 + Math.random() * 500, easing: "cubic-bezier(.17,.67,.4,1)" });
      (function (node) { setTimeout(function () { node.remove(); }, 1300); })(p);
    }
  }
  function hookHUD() {
    var streakEl = document.getElementById("streak");
    var scoreEl = document.getElementById("score");
    if (streakEl) {
      new MutationObserver(function () {
        var v = parseInt(streakEl.textContent, 10);
        if (MILESTONES[v]) celebrateStreak(v);
      }).observe(streakEl, { childList: true, characterData: true, subtree: true });
    }
    if (scoreEl) {
      var last = 0;
      new MutationObserver(function () {
        var v = parseInt(scoreEl.textContent, 10) || 0;
        if (v > last) {
          var c = document.getElementById("creatureWrap");
          if (c && visible(c)) {
            var r = c.getBoundingClientRect();
            burst(r.left + r.width / 2, r.top + r.height / 3, 6);
          }
        }
        last = v;
      }).observe(scoreEl, { childList: true, characterData: true, subtree: true });
    }
  }

  /* ------------------------------------------------------------------ *
   * 7.  Layered sound design.                                          *
   *     A soft supplementary layer on top of the game's own SFX — a    *
   *     harmonic chime under correct answers, a bigger arpeggio        *
   *     fanfare on level-up. Uses window.AudioContext, which is the    *
   *     same constructor patched in section 0, so muteAudio compliance *
   *     and portal suspend/resume still cover this layer.              *
   * ------------------------------------------------------------------ */
  var layerCtx = null;
  function layerAudio() {
    if (!layerCtx) safe(function () {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (AC) layerCtx = new AC();
    });
    return layerCtx;
  }
  // Soft ambient bed under active play — a quiet drone the player likely never
  // consciously notices, but its absence would feel flat. Starts on
  // gameplayStart() / fades on gameplayStop(), riding the same shared
  // AudioContext (and therefore the same muteAudio compliance) as the rest
  // of this layer.
  var bgGain = null, bgNodes = [], bgPlaying = false;
  function startBgMusic() {
    if (bgPlaying) return;
    var a = layerAudio(); if (!a) return;
    bgPlaying = true;
    bgGain = a.createGain();
    bgGain.gain.value = 0.0001;
    bgGain.connect(a.destination);
    var chord = [261.63, 329.63, 392.00, 523.25]; // soft C major pad
    chord.forEach(function (f) {
      var o = a.createOscillator(), g = a.createGain();
      o.type = "sine"; o.frequency.value = f; g.gain.value = 0.045;
      o.connect(g); g.connect(bgGain); o.start();
      bgNodes.push(o);
    });
    // slow LFO on the master gain for a gentle "breathing" feel, not a static drone
    var lfo = a.createOscillator(), lfoGain = a.createGain();
    lfo.type = "sine"; lfo.frequency.value = 0.12; lfoGain.gain.value = 0.012;
    lfo.connect(lfoGain); lfoGain.connect(bgGain.gain); lfo.start();
    bgNodes.push(lfo);
    bgGain.gain.setValueAtTime(bgGain.gain.value, a.currentTime);
    bgGain.gain.linearRampToValueAtTime(CG.muted ? 0.0001 : 0.028, a.currentTime + 1.4);
  }
  function stopBgMusic() {
    if (!bgPlaying) return;
    bgPlaying = false;
    var a = layerAudio();
    safe(function () { if (bgGain && a) bgGain.gain.linearRampToValueAtTime(0.0001, a.currentTime + 0.6); });
    var nodes = bgNodes, g = bgGain;
    bgNodes = []; bgGain = null;
    setTimeout(function () {
      safe(function () { nodes.forEach(function (o) { o.stop(); o.disconnect(); }); });
      safe(function () { if (g) g.disconnect(); });
    }, 700);
  }
  function chimeNote(freq, start, dur, gainPeak, type) {
    var a = layerAudio(); if (!a) return;
    var o = a.createOscillator(), g = a.createGain();
    o.type = type || "sine"; o.frequency.value = freq;
    o.connect(g); g.connect(a.destination);
    var t0 = a.currentTime + start;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gainPeak, t0 + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }
  function playCorrectChime() {
    // soft major-third shimmer, quiet so it layers under the game's own beep
    safe(function () {
      chimeNote(1046.5, 0, 0.30, 0.05, "sine");   // C6
      chimeNote(1318.5, 0.05, 0.32, 0.045, "sine"); // E6
    });
  }
  function playLevelFanfare() {
    // bright ascending arpeggio, a bit louder — the "big moment" layer
    safe(function () {
      var notes = [523.25, 659.25, 783.99, 1046.5, 1318.5]; // C5 E5 G5 C6 E6
      notes.forEach(function (f, i) {
        chimeNote(f, i * 0.09, 0.35, 0.075, "triangle");
      });
    });
  }

  /* ------------------------------------------------------------------ *
   * 8.  Background scene per level tier + bigger level-up moment.      *
   *     Observed off the existing #level HUD span — no game code       *
   *     changes needed. Tiers just re-theme the existing CSS vars      *
   *     (--bg1/--bg2) the game already uses for its background.        *
   * ------------------------------------------------------------------ */
  var LEVEL_THEMES = [
    { max: 2,        bg1: "#7b5cff", bg2: "#36d1dc", syms: ["＋", "−", "×", "÷", "=", "★", "3", "7", "9"] }, // dawn
    { max: 4,        bg1: "#ff7eb3", bg2: "#ff8c42", syms: ["＋", "−", "×", "÷", "☀", "★", "4", "8"] },       // sunset
    { max: 6,        bg1: "#2b2467", bg2: "#5dade2", syms: ["✦", "✧", "×", "÷", "☾", "★", "6", "9"] },       // night sky
    { max: Infinity, bg1: "#ffb347", bg2: "#a78bfa", syms: ["👑", "★", "✦", "×", "÷", "12", "20"] }           // legendary
  ];
  function themeFor(level) {
    for (var i = 0; i < LEVEL_THEMES.length; i++) if (level <= LEVEL_THEMES[i].max) return LEVEL_THEMES[i];
    return LEVEL_THEMES[LEVEL_THEMES.length - 1];
  }
  var curTierIdx = -1;
  function applyScene(level) {
    var th = themeFor(level);
    var idx = LEVEL_THEMES.indexOf(th);
    document.documentElement.style.setProperty("--bg1", th.bg1);
    document.documentElement.style.setProperty("--bg2", th.bg2);
    if (idx !== curTierIdx) {
      curTierIdx = idx;
      safe(function () {
        // swap drifting symbols to match the new scene without piling up nodes
        Array.prototype.forEach.call(document.querySelectorAll(".mm-drift"), function (n) { n.remove(); });
        spawnDrifters(th.syms);
      });
      safe(function () {
        // food bubble colors drift with the scene too (see mm-tier-N rules above)
        document.body.className = (document.body.className || "").replace(/\bmm-tier-\d+\b/g, "").trim();
        document.body.className += " mm-tier-" + (idx + 1);
      });
    }
  }
  function flash() {
    var f = document.getElementById("mmFlash");
    if (!f) { f = document.createElement("div"); f.id = "mmFlash"; document.body.appendChild(f); }
    f.classList.remove("go"); void f.offsetWidth; f.classList.add("go");
  }
  function celebrateLevelUp(level) {
    var b = document.getElementById("mmLevelBanner");
    if (!b) { b = document.createElement("div"); b.id = "mmLevelBanner"; document.body.appendChild(b); }
    b.textContent = "🎉 LEVEL " + level + "! 🎉";
    b.classList.remove("go"); void b.offsetWidth; b.classList.add("go");
    flash();
    burst(window.innerWidth / 2, window.innerHeight * 0.35, 42);
    setTimeout(function () { burst(window.innerWidth / 2, window.innerHeight * 0.35, 24); }, 220);
    playLevelFanfare();
  }
  function hookLevelScenes() {
    var levelEl = document.getElementById("level");
    if (!levelEl) return;
    var last = parseInt(levelEl.textContent, 10) || 1;
    applyScene(last);
    new MutationObserver(function () {
      var v = parseInt(levelEl.textContent, 10) || 1;
      if (v > last) celebrateLevelUp(v);
      if (v !== last) applyScene(v);
      last = v;
    }).observe(levelEl, { childList: true, characterData: true, subtree: true });
  }
  function hookCorrectChime() {
    var scoreEl = document.getElementById("score");
    if (!scoreEl) return;
    var last = parseInt(scoreEl.textContent, 10) || 0;
    new MutationObserver(function () {
      var v = parseInt(scoreEl.textContent, 10) || 0;
      if (v > last) playCorrectChime();
      last = v;
    }).observe(scoreEl, { childList: true, characterData: true, subtree: true });
  }

  /* ------------------------------------------------------------------ *
   * 9.  Intro splash: "Learn Like a Pro Labs" studio card -> Munchy     *
   *     Math logo -> loading progress bar, then fades to reveal the    *
   *     start screen. Runs once per page load, independent of the      *
   *     CrazyGames SDK — on GitHub Pages/PWA it plays the same way.    *
   *     On the portal, loadingStop() (section 1) is held back until    *
   *     splashDone is true, so this overlay IS the loading screen from *
   *     the SDK's point of view; instantPlay() still fires the moment  *
   *     the SDK is ready, independent of this timer.                   *
   *     The 5-4-3-2-1 "Get Ready" moment now happens separately, when  *
   *     the player actually clicks Play — see section 10 below.        *
   * ------------------------------------------------------------------ */
  var splashDone = false;
  function runCountdown(done) {
    var n = 5;
    var numEl = document.getElementById("mmCountNum");
    var labelEl = document.getElementById("mmCountLabel");
    function pop(el) { el.classList.remove("pop"); void el.offsetWidth; el.classList.add("pop"); }
    function tick() {
      if (n < 1) {
        if (labelEl) labelEl.textContent = "";
        numEl.textContent = "GO!";
        pop(numEl);
        safe(function () { chimeNote(1318.5, 0, 0.28, 0.09, "triangle"); chimeNote(1568, 0.05, 0.3, 0.08, "triangle"); });
        setTimeout(done, 420);
        return;
      }
      numEl.textContent = n;
      pop(numEl);
      safe(function () { chimeNote(n === 1 ? 880 : 660, 0, 0.18, 0.06, "sine"); });
      n--;
      setTimeout(tick, 560);
    }
    tick();
  }
  var LOAD_TIPS = [
    "Tip: streaks of 5+ light up a bonus golden treat",
    "Tip: try Math Tricks for clever mental shortcuts",
    "Tip: the Mastery Map shows exactly what to practice next",
    "Tip: everyone gets their own profile and progress",
    "Tip: press 1-9 on your keyboard to answer fast"
  ];
  function runLoadingBar(done) {
    var bar = document.getElementById("mmLoadBar");
    var pctEl = document.getElementById("mmLoadPct");
    var tipEl = document.getElementById("mmLoadTip");
    var labelEl = document.getElementById("mmLoadLabel");
    var pct = 0, dots = 0, tipIdx = 0;
    if (tipEl) tipEl.textContent = LOAD_TIPS[0];
    var dotIv = setInterval(function () {
      dots = (dots + 1) % 4;
      if (labelEl) labelEl.textContent = "Loading" + new Array(dots + 1).join(".");
    }, 350);
    var tipIv = setInterval(function () {
      tipIdx = (tipIdx + 1) % LOAD_TIPS.length;
      if (tipEl) tipEl.textContent = LOAD_TIPS[tipIdx];
    }, 1700);
    var iv = setInterval(function () {
      var step = pct < 70 ? (4 + Math.random() * 8) : (1 + Math.random() * 3);
      pct = Math.min(100, pct + step);
      if (bar) bar.style.width = pct + "%";
      if (pctEl) pctEl.textContent = Math.round(pct) + "%";
      if (pct >= 100) {
        clearInterval(iv); clearInterval(dotIv); clearInterval(tipIv);
        if (labelEl) labelEl.textContent = "Ready!";
        setTimeout(done, 320);
      }
    }, 90);
  }
  function spawnBokeh(container) {
    for (var i = 0; i < 9; i++) {
      var b = document.createElement("div");
      b.className = "mmBokeh";
      var size = 14 + Math.random() * 30;
      b.style.width = size + "px"; b.style.height = size + "px";
      b.style.left = (Math.random() * 96) + "%";
      b.style.animationDuration = (7 + Math.random() * 6) + "s";
      b.style.animationDelay = (-Math.random() * 12) + "s";
      container.appendChild(b);
    }
  }
  function playWhoosh(rising) {
    safe(function () {
      var a = layerAudio(); if (!a) return;
      var o = a.createOscillator(), g = a.createGain();
      o.type = "sine"; g.gain.value = 0.0001;
      o.connect(g); g.connect(a.destination);
      var t0 = a.currentTime;
      o.frequency.setValueAtTime(rising ? 260 : 620, t0);
      o.frequency.exponentialRampToValueAtTime(rising ? 620 : 180, t0 + 0.32);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.05, t0 + 0.06);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.34);
      o.start(t0); o.stop(t0 + 0.36);
    });
  }
  function playImpactThud() {
    safe(function () { chimeNote(130, 0, 0.22, 0.09, "sine"); chimeNote(196, 0.02, 0.18, 0.05, "triangle"); });
  }
  function buildAndRunSplash() {
    var root = document.createElement("div");
    root.id = "mmSplash";
    root.innerHTML =
      '<div id="mmAmbient"><div class="mmRay"></div></div>' +
      '<div class="mmBar mmBarTop"></div><div class="mmBar mmBarBot"></div>' +
      '<div id="mmWipe"></div>' +
      '<div class="mm-phase" id="mmPhaseStudio">' +
        '<div id="mmStudioTag">Presents</div>' +
        '<div id="mmStudioBadge"><div id="mmBurstRing"></div>' +
          '<img id="mmStudioLogoImg" src="studio-logo.png" alt="">' +
          '<div class="mmSparkle s1">✦</div><div class="mmSparkle s2">✧</div><div class="mmSparkle s3">✦</div></div>' +
        '<div id="mmStudioName">Learn Like a Pro</div>' +
        '<div id="mmStudioSub">LABS</div>' +
      '</div>' +
      '<div class="mm-phase" id="mmPhaseGame">' +
        '<div id="mmGameLogoWrap"><div id="mmGameGlow"></div><img id="mmGameLogoImg" src="munchy-face.png" alt=""></div>' +
        '<div id="mmGameName">Munchy Math</div>' +
        '<div id="mmGameTag">FEED · LEARN · GROW</div>' +
      '</div>' +
      '<div class="mm-phase" id="mmPhaseLoad">' +
        '<div id="mmLoadRow"><div id="mmLoadLabel">Loading</div><div id="mmLoadPct">0%</div></div>' +
        '<div id="mmLoadWrap"><div id="mmLoadBar"></div></div>' +
        '<div id="mmLoadTip"></div>' +
      '</div>' +
      '<div id="mmSkip">Tap to skip</div>';
    document.body.appendChild(root);
    safe(function () { spawnBokeh(document.getElementById("mmAmbient")); });
    var phases = ["mmPhaseStudio", "mmPhaseGame", "mmPhaseLoad"];
    function showPhase(i) {
      phases.forEach(function (id, j) { document.getElementById(id).classList.toggle("on", j === i); });
      if (i > 0) {
        var w = document.getElementById("mmWipe");
        w.classList.remove("go"); void w.offsetWidth; w.classList.add("go");
        playWhoosh(i === 1);
        if (i === 1) setTimeout(playImpactThud, 260);
      }
    }
    var finished = false;
    function finish() {
      if (finished) return;
      finished = true;
      root.classList.add("mm-reveal");
      setTimeout(function () {
        root.classList.add("mm-out");
        setTimeout(function () { safe(function () { root.remove(); }); }, 500);
      }, 320);
      splashDone = true;
      maybeStopLoading();
    }
    root.addEventListener("click", finish);
    showPhase(0);
    setTimeout(function () {
      showPhase(1);
      setTimeout(function () {
        showPhase(2);
        runLoadingBar(finish);
      }, 1400);
    }, 2500);
    // absolute safety net — never leave the splash stuck over the game
    setTimeout(finish, 12000);
  }

  /* ------------------------------------------------------------------ *
   * 10. "Get Ready!" 5-4-3-2-1 countdown on the Play click itself.      *
   *     A capture-phase listener on document runs before the game's    *
   *     own click handler on #playBtn (capture always resolves before  *
   *     a target's own listeners, regardless of registration order),  *
   *     so the first real click is swallowed, the countdown overlay    *
   *     plays, and then the click is faithfully replayed — the game    *
   *     starts exactly as it would have, just a couple seconds later,  *
   *     with no energy/timer state touched in between.                 *
   * ------------------------------------------------------------------ */
  function showGetReadyCountdown(done) {
    var root = document.createElement("div");
    root.id = "mmReady";
    root.innerHTML = '<div id="mmCountLabel">Get Ready!</div><div id="mmCountNum">5</div>';
    document.body.appendChild(root);
    runCountdown(function () {
      root.classList.add("mm-out");
      setTimeout(function () { safe(function () { root.remove(); }); done(); }, 350);
    });
  }
  function hookPlayCountdown() {
    var pending = false;
    document.addEventListener("click", function (ev) {
      if (pending) return;
      var t = ev.target && ev.target.closest && ev.target.closest("#playBtn");
      if (!t) return;
      ev.preventDefault();
      ev.stopImmediatePropagation();
      // Report "gameplay start" to the SDK right now, at the moment the player's
      // intent is registered — not after the cosmetic countdown. CrazyGames uses
      // the time to this event to measure load performance (e.g. mobile-homepage
      // eligibility), so it should reflect true responsiveness, not our 3-4s
      // countdown flourish. The game's own internal start logic (and our regular
      // gameplayStart() bubble-listener from hookGameplayEvents) still only run
      // once the click is replayed below, which is fine — a duplicate SDK start
      // ping is harmless.
      gameplayStart();
      showGetReadyCountdown(function () {
        pending = true;
        safe(function () { t.click(); });
        pending = false;
      });
    }, true);
  }

  /* ------------------------------------------------------------------ *
   * 15. Sitelock — only render on CrazyGames domains + our own known    *
   *     origins. Everything is additive: if the check itself throws     *
   *     for any reason, safe() swallows it and the game plays normally  *
   *     (fail-open, never fail-closed on a bug in this file).           *
   * ------------------------------------------------------------------ */
  // Per https://docs.crazygames.com/resources/html5/sitelock/
  function isCrazyGames() {
    var hostname = window.location.hostname;
    var parts = hostname.split(".");
    var idx = parts.indexOf("crazygames");
    return idx !== -1 && idx >= parts.length - 3;
  }
  // The Play Store / PWA build is just this same page loaded from GitHub
  // Pages (PWABuilder wraps the live URL — it doesn't bundle a separate
  // copy), so whitelisting the GitHub Pages host covers Play Store, PWA
  // install, and "Add to Home Screen" too. localhost/127.0.0.1 and file://
  // (empty hostname) cover local dev and the cg-build/ sanity-check step.
  var ALLOWED_HOSTS = ["srydhar.github.io", "localhost", "127.0.0.1"];
  function isAllowedHost() {
    var h = window.location.hostname;
    if (!h) return true; // file:// — local testing
    if (isCrazyGames()) return true;
    return ALLOWED_HOSTS.indexOf(h) !== -1;
  }
  function hookSitelock() {
    if (isAllowedHost()) return;
    Array.prototype.forEach.call(document.querySelectorAll("#app, .screen"), function (n) {
      n.style.display = "none";
    });
    var msg = document.createElement("div");
    msg.style.cssText = "position:fixed;inset:0;z-index:99999;display:flex;flex-direction:column;" +
      "align-items:center;justify-content:center;gap:14px;text-align:center;padding:28px;" +
      "background:linear-gradient(160deg,#7b5cff,#36d1dc);color:#fff;" +
      "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;";
    msg.innerHTML =
      '<div style="font-size:46px;">🐾</div>' +
      '<div style="font-size:22px;font-weight:900;">Munchy Math</div>' +
      '<div style="font-size:15px;opacity:.9;max-width:320px;line-height:1.5;">' +
      "This copy isn&rsquo;t available on this site. Play Munchy Math free on CrazyGames.</div>";
    document.body.appendChild(msg);
  }

  /* ------------------------------------------------------------------ *
   * 16. Privacy / Terms notice — a small, non-blocking link (per        *
   *     https://docs.crazygames.com/requirements/technical/#user-consent) *
   *     since the profile-creation screen has a free-text name field.   *
   *     Two placements, both purely additive (no existing nodes moved): *
   *       a) a faint footer link, shown only while the home screen is   *
   *          visible (tracked via a class MutationObserver so it never  *
   *          overlaps gameplay or other screens)                        *
   *       b) a line inside the Parent section, the natural place for    *
   *          the audience that actually cares about this notice.        *
   * ------------------------------------------------------------------ */
  var PRIVACY_URL = "https://srydhar.github.io/munchy-math/privacy.html";
  function hookPrivacyLink() {
    var home = document.getElementById("startScreen");
    if (home) {
      var link = document.createElement("a");
      link.id = "mmPrivacyLink";
      link.href = PRIVACY_URL;
      link.target = "_blank";
      link.rel = "noopener";
      link.textContent = "Privacy & Terms";
      link.style.cssText = "position:fixed; left:50%; bottom:calc(env(safe-area-inset-bottom,0px) + 4px);" +
        "transform:translateX(-50%); z-index:51; font-size:10px; font-weight:700;" +
        "color:rgba(255,255,255,.55); text-decoration:underline; letter-spacing:.2px;" +
        "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;";
      document.body.appendChild(link);
      var sync = function () { link.style.display = home.classList.contains("hidden") ? "none" : "block"; };
      sync();
      safe(function () {
        new MutationObserver(sync).observe(home, { attributes: true, attributeFilter: ["class"] });
      });
    }
    var parent = document.getElementById("parentScreen");
    if (parent) {
      var note = document.createElement("p");
      note.className = "miniNote";
      note.style.cssText = "margin-top:14px;";
      note.innerHTML = 'Munchy Math stores player names/progress only on this device' +
        ' (or your CrazyGames account) — see our <a href="' + PRIVACY_URL +
        '" target="_blank" rel="noopener" style="color:inherit; text-decoration:underline;">' +
        'Privacy Policy &amp; Terms</a>.';
      parent.appendChild(note);
    }
  }

  /* ------------------------------------------------------------------ *
   * 17. Screen transitions — a quick fade/scale-in whenever any .screen *
   *     becomes visible (menu, pause, collection, etc.), plus a soft    *
   *     whoosh to match the polish already in the splash sequence.      *
   *     Only ever touches the class/animation of the entering screen —  *
   *     never its hide/display timing — so it can't conflict with       *
   *     offsetParent-based visibility checks used elsewhere (keyboard   *
   *     routing, the privacy-link sync above, etc.).                    *
   * ------------------------------------------------------------------ */
  function hookScreenTransitions() {
    var whooshReady = false; // let the intro splash's own sound design finish first
    setTimeout(function () { whooshReady = true; }, 3000);
    Array.prototype.forEach.call(document.querySelectorAll(".screen"), function (s) {
      safe(function () {
        // IMPORTANT: this observer watches the "class" attribute, and its own
        // callback also changes "class" (to add the fade-in class). Without
        // disconnecting first, that self-mutation would re-trigger the same
        // observer forever — an infinite loop that floods audio and hangs the
        // tab. Disconnecting before mutating, then reconnecting after, breaks
        // the feedback loop for good.
        var obs = new MutationObserver(function () {
          if (!s.classList.contains("hidden")) {
            obs.disconnect();
            s.classList.remove("mm-screen-in");
            void s.offsetWidth;
            s.classList.add("mm-screen-in");
            obs.observe(s, { attributes: true, attributeFilter: ["class"] });
            if (whooshReady) safe(function () { playWhoosh(true); });
          }
        });
        obs.observe(s, { attributes: true, attributeFilter: ["class"] });
      });
    });
  }

  /* ------------------------------------------------------------------ *
   * boot                                                               *
   * ------------------------------------------------------------------ */
  function boot() {
    safe(hookSitelock);
    safe(injectDesktopCSS);
    safe(buildAndRunSplash);
    safe(hookPlayCountdown);
    safe(spawnDrifters);
    safe(hookGameplayEvents);
    safe(hookKeyboard);
    safe(hookHUD);
    safe(hookLevelScenes);
    safe(hookCorrectChime);
    safe(hookPrivacyLink);
    safe(hookScreenTransitions);
    safe(hookSDK);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
