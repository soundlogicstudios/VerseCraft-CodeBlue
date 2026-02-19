export const tts = (() => {
  let enabled = false;
  let voiceProfile = "male"; // 'male' | 'female' | 'auto'
  let currentUtterance = null;

  // Cached voices
  let cachedMaleVoice = null;
  let cachedFemaleVoice = null;
  let cachedAutoVoice = null;

  const maleHints = [
    "daniel","david","alex","fred","tom","thomas","mark","paul","john","james",
    "matt","matthew","ryan","michael","ben","brian","bruce","kevin","sam","steve",
    "male"
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

    // Prefer English
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

    // If both profiles resolve to the same voice object and multiple voices exist,
    // force them to be different by picking an alternate for female (or male).
    if (cachedMaleVoice && cachedFemaleVoice && cachedMaleVoice === cachedFemaleVoice && voices.length > 1) {
      const english = voices.filter(v => String(v.lang || "").toLowerCase().startsWith("en"));
      const pool = english.length ? english : voices;

      // Choose a different one for female if possible
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

  function _applySoundShape(u) {
    // This is the reliable part across iOS/Android.
    // Even if both profiles use the same underlying voice, these settings make them distinct.
    if (voiceProfile === "male") {
      u.pitch = 0.62;  // unmistakably deeper
      u.rate  = 0.92;  // slightly slower
    } else if (voiceProfile === "female") {
      u.pitch = 1.22;  // brighter
      u.rate  = 1.02;  // slightly quicker
    } else {
      u.pitch = 1.0;
      u.rate  = 0.98;
    }
    u.volume = 1.0;
  }

  function speak(rawText) {
    if (!enabled) return;

    const text = _extractNarrative(rawText);
    if (!text) return;

    stop();

    const u = new SpeechSynthesisUtterance(text);

    // voice cache (async on iOS)
    _cacheVoices();

    const v = _voiceForProfile();
    if (v) u.voice = v;

    _applySoundShape(u);

    currentUtterance = u;
    try { window.speechSynthesis.speak(u); } catch (_) {}
  }

  function stop() {
    try { window.speechSynthesis.cancel(); } catch (_) {}
    currentUtterance = null;
  }

  function setVoiceProfile(profile) {
    const p = String(profile || "").toLowerCase();
    if (p === "male" || p === "female" || p === "auto") voiceProfile = p;
    _cacheVoices();
  }

  function getVoiceProfile() { return voiceProfile; }

  function setEnabled(on) {
    enabled = !!on;
    if (!enabled) stop();
    if (enabled) _cacheVoices();
  }

  function initToggle({ buttonEl, onEnableSpeak } = {}) {
    if (!buttonEl) return;

    const sync = () => {
      buttonEl.textContent = `Voice: ${enabled ? "ON" : "OFF"}`;
      buttonEl.setAttribute("aria-pressed", enabled ? "true" : "false");
    };

    buttonEl.addEventListener("click", () => {
      enabled = !enabled;
      sync();

      if (enabled) {
        _cacheVoices();

        // iOS Safari: prime speech pipeline on user gesture
        try {
          window.speechSynthesis.cancel();
          const prime = new SpeechSynthesisUtterance(" ");
          prime.volume = 0;
          window.speechSynthesis.speak(prime);
          window.speechSynthesis.cancel();
        } catch (_) {}

        if (typeof onEnableSpeak === "function") onEnableSpeak();
      } else {
        stop();
      }
    });

    sync();

    if (window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = () => { _cacheVoices(); };
      _cacheVoices();
    }
  }

  return {
    speak,
    stop,
    initToggle,
    setVoiceProfile,
    getVoiceProfile,
    setEnabled
  };
})();
