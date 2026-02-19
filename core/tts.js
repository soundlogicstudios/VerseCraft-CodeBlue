// Browser TTS helper for VerseCraft testbed (GitHub Pages safe).
// NOTE: Browsers do not expose a true "male/female" voice flag.
// We choose best-effort voices via language + name heuristics.

export const tts = (() => {
  let enabled = false;
  let voiceProfile = "male"; // 'male' | 'female' | 'auto'
  let currentUtterance = null;

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

  function _scoreVoice(v) {
    const name = String(v?.name || "").toLowerCase();
    const lang = String(v?.lang || "").toLowerCase();

    // Prefer English (adjust if you want other languages)
    let score = 0;
    if (lang.startsWith("en")) score += 50;
    if (lang === "en-us") score += 8;

    // De-prioritize novelty voices that can be harsh
    if (name.includes("whisper")) score -= 10;

    // Profile bias
    if (voiceProfile === "male") {
      for (const h of maleHints) if (name.includes(h)) score += 12;
      for (const h of femaleHints) if (name.includes(h)) score -= 10;
    } else if (voiceProfile === "female") {
      for (const h of femaleHints) if (name.includes(h)) score += 12;
      for (const h of maleHints) if (name.includes(h)) score -= 10;
    }

    return score;
  }

  function _pickVoice() {
    const voices = _voices();
    if (!voices.length) return null;

    // filter to English first if possible
    const english = voices.filter(v => String(v.lang || "").toLowerCase().startsWith("en"));
    const pool = english.length ? english : voices;

    let best = pool[0];
    let bestScore = -1e9;
    for (const v of pool) {
      const s = _scoreVoice(v);
      if (s > bestScore) { bestScore = s; best = v; }
    }
    return best;
  }

  function _extractNarrative(raw) {
    const txt = String(raw || "");
    if (!txt) return "";
    // Prefer to cut at delimiter or CHOICES header (for printed format)
    const cut1 = txt.split("----------------")[0];
    const cut2 = cut1.split("\nCHOICES\n")[0];
    return cut2.trim();
  }

  function speak(rawText) {
    if (!enabled) return;
    const text = _extractNarrative(rawText);
    if (!text) return;

    stop();

    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.98;
    u.pitch = (voiceProfile === "male") ? 0.92 : (voiceProfile === "female" ? 1.05 : 1.0);
    u.volume = 1.0;

    const v = _pickVoice();
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
  }

  function getVoiceProfile() { return voiceProfile; }

  function setEnabled(on) {
    enabled = !!on;
    if (!enabled) stop();
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
      if (enabled && typeof onEnableSpeak === "function") onEnableSpeak();
      if (!enabled) stop();
    });

    sync();

    // Some browsers load voices async
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = () => { _voices(); };
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
