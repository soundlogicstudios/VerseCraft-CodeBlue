// tts.js (ES module) — with hard teardown + rebuild hooks

export const tts = (() => {
  let enabled = false;
  let voiceProfile = "male"; // 'male' | 'female' | 'auto'

  let cachedMaleVoice = null;
  let cachedFemaleVoice = null;
  let cachedAutoVoice = null;

  // Toggle binding state
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

    // Try to separate male/female if they collide and multiple voices exist
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

  function _syncButton() {
    if (!boundButton || !boundButton.isConnected) return;
    boundButton.textContent = `Voice: ${enabled ? "ON" : "OFF"}`;
    boundButton.setAttribute("aria-pressed", enabled ? "true" : "false");
  }

  // iOS: voices async
  if (window.speechSynthesis) {
    window.speechSynthesis.onvoiceschanged = () => { _cacheVoices(); };
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

    // Tuned voices (Adrian not too low)
    if (voiceProfile === "male") {
      u.pitch = 0.84;
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
    _cacheVoices();
  }

  function setEnabled(on) {
    enabled = !!on;
    if (!enabled) stop();
    _syncButton();
  }

  function toggle() {
    setEnabled(!enabled);
    return enabled;
  }

  // NEW: Hard teardown for POV switching
  function reset({ keepEnabled = false } = {}) {
    // stop audio
    stop();

    // reset voice caches
    cachedMaleVoice = null;
    cachedFemaleVoice = null;
    cachedAutoVoice = null;

    // optionally reset enabled
    if (!keepEnabled) enabled = false;

    // unbind toggle
    if (boundAbort) {
      try { boundAbort.abort(); } catch (_) {}
    }
    boundAbort = null;
    boundButton = null;

    // re-cache (so next init is fast)
    _cacheVoices();
  }

  // NEW: Rebuild toggle binding fresh every time
  function rebindToggle({ buttonEl, onEnableSpeak } = {}) {
    // kill old binding if any
    if (boundAbort) {
      try { boundAbort.abort(); } catch (_) {}
    }

    boundButton = buttonEl || null;
    boundAbort = new AbortController();

    _syncButton();

    if (!boundButton) return;

    boundButton.addEventListener("click", () => {
      const nowOn = toggle();

      // iOS prime on user gesture when turning ON
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

  return {
    speak,
    stop,
    setVoiceProfile,
    setEnabled,
    toggle,
    reset,
    rebindToggle
  };
})();
