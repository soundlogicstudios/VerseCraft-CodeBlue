// Browser TTS helper for VerseCraft testbed (GitHub Pages safe).
// NOTE: Browsers do not expose a true "male/female" voice flag.
// We choose best-effort voices via language + name heuristics, and we CACHE
// the best male/female voices once voices are available.

export const tts = (() => {
  let enabled = false;
  let voiceProfile = "male"; // 'male' | 'female' | 'auto'
  let currentUtterance = null;

  // Cached voices (resolved once when voices are available)
  let cachedMaleVoice = null;
  let cachedFemaleVoice = null;
  let cachedAutoVoice = null;

  const maleHints = [
    "daniel","david","alex","fred","george","tom","thomas","mark","paul","john","james",
    "matt","matthew","ryan","michael","ben","brian","bruce","kevin","sam","steve",
    "male","man","guy"
  ];

  const femaleHints = [
    "samantha","victoria","karen","susan","linda","mary","emma","olivia","sara","sarah",
    "jenny","jennifer","allison","amy","female","woman","girl"
  ];

  function _voices() {
    try { return window.speechSynthesis.getVoices() || []; }
    catch { return []; }
  }

  // Score a voice for a requested profile (male/female/auto)
  function _scoreVoiceForProfile(v, profile) {
    const name = String(v?.name || "").toLowerCase();
    const lang = String(v?.lang || "").toLowerCase();

    let score = 0;

    // Prefer English
    if (lang.startsWith("en")) score += 50;
    if (lang === "en-us") score += 8;

    // De-prioritize harsh novelty voices
    if (name.includes("whisper")) score -= 10;

    if (profile === "male") {
      for (const h of maleHints) if (name.includes(h)) score += 12;
      for (const h of femaleHints) if (name.includes(h)) score -= 10;
    } else if (profile === "female") {
      for (const h of femaleHints) if (name.includes(h)) score += 12;
      for (const h of maleHints) if (name.includes(h)) score -= 10;
    }

    return score;
  }

  function _pickBestVoice(profile) {
    const voices = _voices();
    if (!voices.length) return null;

    const english = voices.filter(v => String(v.lang || "").toLowerCase().startsWith("en"));
    const pool = english.length ? english : voices;

    let best = pool[0];
    let bestScore = -1e9;

    for (const v of pool) {
      const s = _scoreVoiceForProfile(v, profile);
      if (s > bestScore) { bestScore = s; best = v; }
    }
    return best || null;
  }

  // Cache voices once (and refresh cache if voices list changes later)
  function _cacheVoices() {
    const voices = _voices();
    if (!voices.length) return;

    cachedMaleVoice = _pickBestVoice("male");
    cachedFemaleVoice = _pickBestVoice("female");
    cachedAutoVoice = _pickBestVoice("auto");

    // If male/female resolve to the same voice and we have >1 voice,
    // try to force them to be different by selecting the runner-up.
    if (cachedMaleVoice && cachedFemaleVoice && cachedMaleVoice === cachedFemaleVoice && voices.length > 1) {
      const english = voices.filter(v => String(v.lang || "").toLowerCase().startsWith("en"));
      const pool = english.length ? english : voices;

      // Find an alternative for female (or male) that isn't the same object
      let altFemale = null;
      let bestScore = -1e9;
      for (const v of pool) {
        if (v === cachedMaleVoice) continue;
        const s = _scoreVoiceForProfile(v, "female");
        if (s > bestScore) { bestScore = s; altFemale = v; }
      }
      if (altFemale) cachedFemaleVoice = altFemale;
    }
  }

  function _extractNarrative(raw) {
    const txt = String(raw || "");
    if (!txt) return "";
    const cut1 = txt.split("----------------")[0];
    const cut2 = cut1.split("\nCHOICES\n")[0];
    return cut2.trim();
  }

  function _voiceForCurrentProfile() {
    if (voiceProfile === "male") return cachedMaleVoice || cachedAutoVoice;
    if (voiceProfile === "female") return cachedFemaleVoice || cachedAutoVoice;
    return cachedAutoVoice || cachedMaleVoice || cachedFemaleVoice;
  }

  function speak(rawText) {
    if (!enabled) return;
    const text = _extractNarrative(rawText);
    if (!text) return;

    stop();

    const u = new SpeechSynthesisUtterance(text);

    // Stronger differentiation (still natural)
    u.rate = 0.98;
    u.pitch = (voiceProfile === "male") ? 0.80 : (voiceProfile === "female" ? 1.18 : 1.0);
    u.volume = 1.0;

    const v = _voiceForCurrentProfile();
    if (v) u.voice = v;

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

    // Ensure we have cached voices once a profile is set
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

        // iOS/Safari reliability: a user gesture happened, so kick a tiny silent utterance
        // to "prime" speech in some environments.
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

    // Voices often load async (especially on iOS).
    if (typeof window !== "undefined" && window.speechSynthesis) {
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
