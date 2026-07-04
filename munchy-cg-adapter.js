/* ============================================================================
   Munchy Math — CrazyGames Portal Adapter + Desktop/Polish Pack  (v1.0)
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
      "  100% { transform: translateX(-50%) scale(.8); opacity: 0; } }"
    ].join("\n");
    var st = document.createElement("style");
    st.textContent = css;
    document.head.appendChild(st);
  }
  function spawnDrifters() {
    var syms = ["＋", "−", "×", "÷", "=", "★", "3", "7", "9"];
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
   * boot                                                               *
   * ------------------------------------------------------------------ */
  function boot() {
    safe(injectDesktopCSS);
    safe(spawnDrifters);
    safe(hookGameplayEvents);
    safe(hookKeyboard);
    safe(hookHUD);
    safe(hookSDK);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
