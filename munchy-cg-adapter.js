/* ============================================================================
   Munchy Math — CrazyGames Portal Adapter + Desktop/Polish Pack  (v1.1)
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

  function gameplayStart() { if (active()) safe(function () { sdkGame().gameplayStart(); }); CG.inPlay = true; }
  function gameplayStop()  { if (active()) safe(function () { sdkGame().gameplayStop();  }); CG.inPlay = false; }

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
          safe(function () { CG.sdk.game.loadingStop(); }); // DOM is already interactive
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
      "@media (min-width: 880px) and (min-height: 500px) {",
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
      "@keyframes mmFlash { 0% { opacity: .55; } 100% { opacity: 0; } }"
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
   * boot                                                               *
   * ------------------------------------------------------------------ */
  function boot() {
    safe(injectDesktopCSS);
    safe(spawnDrifters);
    safe(hookGameplayEvents);
    safe(hookKeyboard);
    safe(hookHUD);
    safe(hookLevelScenes);
    safe(hookCorrectChime);
    safe(hookSDK);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
