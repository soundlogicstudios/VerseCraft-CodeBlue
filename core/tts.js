// tts.js — VerseCraft TTS (stable, no regression)
// Goals:
// - Keep existing behavior: engine calls tts.speak(scene.text) on render.
// - VOICE toggle always visually updates and actually gates speech.
// - Switching POV does NOT create a second “ghost” TTS instance (singleton).
// - stop() always cancels whatever is speaking.
// - Male/Female differentiation via pitch (and best-effort voice choice).

function create_tts() {
  let enabled = false;
  let voiceProfile = "male"; // "male" | "female" | "auto"

  let cachedMaleVoice = null;
  let cachedFemaleVoice = null;
  let cachedAutoVoice = null;

  // Track currently bound toggle button + handler so we can rebind cleanly
  let boundButton = null;
  let boundAbort = null;

  const maleHints = [
    "daniel","david","alex","fred","tom","thomas","mark","paul","john","james",
    "matt","matthew","ryan","michael","ben","brian","bruce","kevin","sam","steve","male"
  ];
  const femaleHints = [
    "samantha","victoria","karen","zira","ava","emma","olivia","sara","sarah",
    "jenny","jennifer","allison","amy","female"
  ];

  function _voices() {
    try { return window.speechSynthesis.getVoices() || []; }
    catch { return []; }
  }

  function _score(v, profile) {
    const name = String(v?.name || "").toLowerCase();
    const lang = String(v?.lang || "").toLowerCase();
    let s = 0;

    if (lang.startsWith("en")) s += 50;
    if (lang === "en-us") s += 8;

    if (profile === "male") {
      for (const h of maleHints) if (name.includes(h)) s += 12;
      for (const h of femaleHints) if (name.includes(h)) s -= 10;
    } else if (profile === "female") {
      for (const h of femaleHints) if (name.includes(h)) s += 12;
      for (const h of maleHints) if (name.includes(h)) s -= 10;
    }
    return s;
  }

  function _pickBest(profile) {
    const vs = _voices();
    if (!vs.length) return null;

    const english = vs.filter(v => String(v.lang || "").toLowerCase().startsWith("en"));
    const pool = english.length ? english : vs;

    let best = pool[0];
    let bestS = -1e9;

    for (const v of pool) {
      const sv = _score(v, profile);
      if (sv > bestS) { bestS = sv; best = v; }
    }
    return best || null;
  }

  function _cacheVoices() {
    const vs = _voices();
    if (!vs.length) return;

    cachedMaleVoice = _pickBest("male");
    cachedFemaleVoice = _pickBest("female");
    cachedAutoVoice = _pickBest("auto");

    // Try to separate male/female if they collide and multiple voices exist
    if (cachedMaleVoice && cachedFemaleVoice && cachedMaleVoice === cachedFemaleVoice && vs.length > 1) {
      const english = vs.filter(v => String(v.lang || "").toLowerCase().startsWith("en"));
      const pool = english.length ? english : vs;
      for (const v of pool) {
        if (v !== cachedMaleVoice) { cachedFemaleVoice = v; break; }
      }
    }
  }

  function _extractNarrative(raw) {
    const txt = String(raw || "");
    if (!txt) return "";
    const cut1 = txt.split("----------------")[0];
    const idx = cut1.toUpperCase().indexOf("\nCHOICES");
    const cut2 = idx >= 0 ? cut1.slice(0, idx) : cut1;
    return cut2.trim();
  }

  function _voiceForProfile() {
    if (voiceProfile === "male") return cachedMaleVoice || cachedAutoVoice;
    if (voiceProfile === "female") return cachedFemaleVoice || cachedAutoVoice;
    return cachedAutoVoice || cachedMaleVoice || cachedFemaleVoice;
  }

  function _syncButton() {
    if (!boundButton || !boundButton.isConnected) return;
    boundButton.textContent = `Voice: ${enabled ? "ON" : "OFF"}`;
    boundButton.setAttribute("aria-pressed", enabled ? "true" : "false");
  }

  // iOS: voices arrive async; keep cache fresh without touching anything else
  if (window.speechSynthesis) {
    const prev = window.speechSynthesis.onvoiceschanged;
    window.speechSynthesis.onvoiceschanged = () => {
      try { if (typeof prev === "function") prev(); } catch (_) {}
      _cacheVoices();
    };
    _cacheVoices();
  }

  function speak(rawText) {
    if (!enabled) return;

    const text = _extractNarrative(rawText);
    if (!text) return;

    stop();

    const u = new SpeechSynthesisUtterance(text);

    _cacheVoices();
    const v = _voiceForProfile();
    if (v) u.voice = v;

    // POV shaping (NOT too low)
    if (voiceProfile === "male") {
      u.pitch = 0.86; // slightly higher than before
      u.rate  = 0.96;
    } else if (voiceProfile === "female") {
      u.pitch = 1.12;
      u.rate  = 1.00;
    } else {
      u.pitch = 1.0;
      u.rate  = 0.98;
    }

    u.volume = 1.0;

    try { window.speechSynthesis.speak(u); } catch (_) {}
  }

  function stop() {
    try { window.speechSynthesis.cancel(); } catch (_) {}
  }

  function setVoiceProfile(profile) {
    const p = String(profile || "").toLowerCase();
    if (p === "male" || p === "female" || p === "auto") voiceProfile = p;
    _cacheVoices();
  }

  function setEnabled(on) {
    enabled = !!on;
    if (!enabled) stop();
    _syncButton();
  }

  function isEnabled() { return enabled; }

  function toggle() {
    setEnabled(!enabled);
    return enabled;
  }

  // IMPORTANT: This matches “known good” expectations:
  // - binds button
  // - button click toggles enabled
  // - calls onEnableSpeak() so voice starts immediately when turned ON
  function initToggle({ buttonEl, onEnableSpeak } = {}) {
    if (!buttonEl) return;

    // Rebind cleanly every time (prevents stacked listeners across POV switches)
    if (boundAbort) {
      try { boundAbort.abort(); } catch (_) {}
    }
    boundAbort = new AbortController();
    boundButton = buttonEl;

    _syncButton();

    boundButton.addEventListener("click", () => {
      const nowOn = toggle();

      // Prime speech pipeline on user gesture (helps iOS)
      if (nowOn) {
        try {
          window.speechSynthesis.cancel();
          const prime = new SpeechSynthesisUtterance(" ");
          prime.volume = 0;
          window.speechSynthesis.speak(prime);
          window.speechSynthesis.cancel();
        } catch (_) {}

        if (typeof onEnableSpeak === "function") {
          try { onEnableSpeak(); } catch (_) {}
        }
      } else {
        stop();
      }
    }, { signal: boundAbort.signal });
  }

  // Optional: call this when leaving story harness to hard stop and unbind toggle
  function teardown({ keepEnabled = false } = {}) {
    stop();
    if (!keepEnabled) enabled = false;
    if (boundAbort) {
      try { boundAbort.abort(); } catch (_) {}
    }
    boundAbort = null;
    boundButton = null;
  }

  return {
    speak,
    stop,
    initToggle,
    setVoiceProfile,
    setEnabled,
    isEnabled,
    toggle,
    teardown
  };
}

// SINGLETON to prevent “toggle controls the wrong instance”
const KEY = "__VC_TTS__";
const instance = (typeof window !== "undefined" && window[KEY]) ? window[KEY] : create_tts();
if (typeof window !== "undefined") window[KEY] = instance;

export const tts = instance;
