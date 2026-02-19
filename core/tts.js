// tts.js — optional Text-to-Speech helper (additive module)
// Uses the browser Web Speech API (speechSynthesis). No keys required.
// Designed to be "opt-in": user must click the toggle button once (iOS gesture unlock).

export const tts = (() => {
  let enabled = false;
  let unlocked = false;

  function extractNarrative(rawText) {
    // Strip printed CHOICES section if present
    if (!rawText) return "";
    let text = String(rawText);

    // Cut at delimiter line if present
    text = text.split("----------------")[0];

    // Also cut at a CHOICES header if present (case-insensitive)
    const m = text.match(/\n\s*CHOICES\b/i);
    if (m && typeof m.index === "number") text = text.slice(0, m.index);

    return String(text).trim();
  }

  function stop() {
    try { window.speechSynthesis.cancel(); } catch (_) {}
  }

  function pickVoice() {
    try {
      const voices = window.speechSynthesis.getVoices() || [];
      if (!voices.length) return null;

      // Prefer English voices
      const english = voices.filter(v => /en/i.test(String(v.lang || "")));
      const pool = english.length ? english : voices;

      // "Male-preferred" heuristic: browsers don't expose gender, so we guess by name.
      // We prefer voices whose names commonly map to male voices and avoid obvious female names.
      const maleHints = [
        "David","Mark","Alex","Daniel","Paul","Fred","George","John","James",
        "Thomas","Michael","Andrew","Ryan","Aaron","Arthur","Brian","Bruce",
        "Eddy","Ethan","Jack","Oliver","Liam","William"
      ];
      const femaleHints = ["Samantha","Victoria","Karen","Tessa","Fiona","Moira","Serena","Ava","Emily","Susan"];

      function score(v) {
        const name = String(v.name || "");
        const lang = String(v.lang || "");
        let s = 0;
        if (lang === "en-US") s += 6;
        else if (/en-US/i.test(lang)) s += 5;
        else if (/en/i.test(lang)) s += 3;

        for (const h of maleHints) if (name.includes(h)) s += 4;
        for (const h of femaleHints) if (name.includes(h)) s -= 6;

        // Slight preference for "Enhanced"/"Premium"/"Natural" voices if present
        if (/enhanced|premium|natural/i.test(name)) s += 1;

        return s;
      }

      return pool.slice().sort((a,b) => score(b) - score(a))[0] || null;
    } catch (_) {
      return null;
    }
  }

  function speak(rawText, opts = {}) {
    if (!enabled) return;
    const text = extractNarrative(rawText);
    if (!text) return;

    // Cancel any in-progress narration
    stop();

    try {
      const u = new SpeechSynthesisUtterance(text);
      u.rate = typeof opts.rate === "number" ? opts.rate : 0.98;
      u.pitch = typeof opts.pitch === "number" ? opts.pitch : 0.95;
      u.volume = typeof opts.volume === "number" ? opts.volume : 1.0;

      const v = pickVoice();
      if (v) u.voice = v;

      window.speechSynthesis.speak(u);
    } catch (_) {}
  }

  function setEnabled(next) {
    enabled = !!next;
  }

  function isEnabled() {
    return enabled;
  }

  function initToggle({ buttonEl, onEnableSpeak } = {}) {
    if (!buttonEl) return;

    // iOS/Safari: voices list can be async
    try {
      window.speechSynthesis.onvoiceschanged = () => {
        try { window.speechSynthesis.getVoices(); } catch (_) {}
      };
    } catch (_) {}

    const render = () => {
      buttonEl.textContent = enabled ? "Voice: ON" : "Voice: OFF";
      buttonEl.setAttribute("aria-pressed", enabled ? "true" : "false");
    };

    render();

    buttonEl.addEventListener("click", () => {
      // This click counts as a gesture unlock for iOS
      unlocked = true;
      enabled = !enabled;
      if (!enabled) {
        stop();
      } else {
        // Speak current scene immediately if caller provides hook
        if (typeof onEnableSpeak === "function") onEnableSpeak();
      }
      render();
    });
  }

  return {
    initToggle,
    speak,
    stop,
    setEnabled,
    isEnabled,
    extractNarrative,
  };
})();
