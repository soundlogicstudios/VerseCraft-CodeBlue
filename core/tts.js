// tts.js
// Cross-platform TTS for VerseCraft testbed.
// Fixes:
// 1) Singleton: prevents "two TTS instances" (toggle stops the wrong one) after character switching.
// 2) Safe toggle binding: no duplicated listeners, always syncs button state.
// 3) POV shaping: Adrian deeper (but not too low), Celeste brighter.
// 4) NEW: If VOICE is toggled ON, it immediately speaks the most recent scene text
//        (so narration does NOT wait for the first choice).

function create_tts_singleton() {
  let enabled = false;
  let voiceProfile = "male"; // 'male' | 'female' | 'auto'

  let cachedMaleVoice = null;
  let cachedFemaleVoice = null;
  let cachedAutoVoice = null;

  // Remember the last narrative text requested (even if VOICE was OFF).
  let lastNarrativeText = "";

  // Track any toggle buttons we bind so state stays consistent.
  const boundButtons = new Set();

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

  function _scoreVoice(v, profile) {
    const name = String(v?.name || "").toLowerCase();
    const lang = String(v?.lang || "").toLowerCase();
    let score = 0;

    if (lang.startsWith("en")) score += 50;
    if (lang === "en-us") score += 8;

    if (profile === "male") {
      for (const h of maleHints) if (name.includes(h)) score += 12;
      for (const h of femaleHints) if (name.includes(h)) score -= 10;
    } else if (profile === "female") {
      for (const h of femaleHints) if (name.includes(h)) score += 12;
      for (const h of maleHints) if (name.includes(h)) score -= 10;
    }
    return score;
  }

  function _pickBest(profile) {
    const voices = _voices();
    if (!voices.length) return null;

    const english = voices.filter(v => String(v.lang || "").toLowerCase().startsWith("en"));
    const pool = english.length ? english : voices;

    let best = pool[0];
    let bestScore = -1e9;

    for (const v of pool) {
      const s = _scoreVoice(v, profile);
      if (s > bestScore) { bestScore = s; best = v; }
    }
    return best || null;
  }

  function _cacheVoices() {
    const voices = _voices();
    if (!voices.length) return;

    cachedMaleVoice = _pickBest("male");
    cachedFemaleVoice = _pickBest("female");
    cachedAutoVoice = _pickBest("auto");

    // If both profiles resolve to the same voice and we have multiple voices,
    // try to force a different female voice (best effort).
    if (cachedMaleVoice && cachedFemaleVoice && cachedMaleVoice === cachedFemaleVoice && voices.length > 1) {
      const english = voices.filter(v => String(v.lang || "").toLowerCase().startsWith("en"));
      const pool = english.length ? english : voices;
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

  function _syncButtons() {
    for (const btn of boundButtons) {
      if (!btn || !btn.isConnected) continue;
      btn.textContent = `Voice: ${enabled ? "ON" : "OFF"}`;
      btn.setAttribute("aria-pressed", enabled ? "true" : "false");
    }
  }

  // iOS Safari: voices often arrive async
  if (window.speechSynthesis) {
    window.speechSynthesis.onvoiceschanged = () => { _cacheVoices(); };
    _cacheVoices();
  }

  function speak(rawText) {
    // Always capture last narrative text, even if VOICE is OFF right now.
    const text = _extractNarrative(rawText);
    if (text) lastNarrativeText = text;

    if (!enabled) return;
    if (!text) return;

    stop();

    const u = new SpeechSynthesisUtterance(text);

    // Always refresh cache before speaking; cheap and helps iOS.
    _cacheVoices();

    const v = _voiceForProfile();
    if (v) u.voice = v;

    // ✅ POV shaping (Adrian pitch raised)
    if (voiceProfile === "male") {
      u.pitch = 0.86;  // raised from 0.78
      u.rate  = 0.96;
    } else if (voiceProfile === "female") {
      u.pitch = 1.14;
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

    // IMPORTANT: do NOT auto-play on profile switch.
    _cacheVoices();
  }

  function getVoiceProfile() { return voiceProfile; }

  function setEnabled(on) {
    enabled = !!on;

    if (!enabled) {
      stop();
      _syncButtons();
      return;
    }

    _syncButtons();

    // ✅ NEW: when enabling voice, immediately speak the last known narrative text.
    // This removes the “wait until first choice” problem.
    if (lastNarrativeText) {
      // Slight delay helps iOS after prime
      setTimeout(() => {
        // Re-speak using the cached text
        // (call speak so it uses current profile shaping)
        speak(lastNarrativeText);
      }, 60);
    }
  }

  function isEnabled() { return enabled; }

  function toggle() {
    setEnabled(!enabled);
    return enabled;
  }

  // Idempotent toggle binder: safe to call multiple times, won’t stack listeners.
  function initToggle({ buttonEl } = {}) {
    if (!buttonEl) return;

    // If previously bound, remove previous handler using AbortController.
    if (buttonEl.__vc_tts_abort__) {
      try { buttonEl.__vc_tts_abort__.abort(); } catch (_) {}
    }
    const ac = new AbortController();
    buttonEl.__vc_tts_abort__ = ac;

    boundButtons.add(buttonEl);
    _syncButtons();

    buttonEl.addEventListener("click", () => {
      const nowOn = toggle();

      // User gesture: prime iOS speech pipeline when turning ON
      if (nowOn) {
        try {
          window.speechSynthesis.cancel();
          const prime = new SpeechSynthesisUtterance(" ");
          prime.volume = 0;
          window.speechSynthesis.speak(prime);
          window.speechSynthesis.cancel();
        } catch (_) {}
      }
      // NOTE: setEnabled(true) will immediately speak lastNarrativeText if available.
    }, { signal: ac.signal });
  }

  return {
    speak,
    stop,
    initToggle,
    setVoiceProfile,
    getVoiceProfile,
    setEnabled,
    isEnabled,
    toggle
  };
}

// ✅ Singleton export: if loaded twice (module + fallback), both point to same instance.
const KEY = "__VC_TTS_SINGLETON__";
const singleton = (typeof window !== "undefined" && window[KEY]) ? window[KEY] : create_tts_singleton();
if (typeof window !== "undefined") window[KEY] = singleton;

export const tts = singleton;
