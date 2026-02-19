// tts.js — optional Text-to-Speech helper (additive module)
// Uses the browser Web Speech API (speechSynthesis). No keys required.
// Designed to be "opt-in": user must click the toggle button once (iOS gesture unlock).

export const tts = (() => {
  let enabled = false;
  let unlocked = false;

  function extractNarrative(rawText) {
    // Strip printed CHOICES section if present
    if (!rawText) return "";
    const parts = String(rawText).split("----------------");
    return String(parts[0] || "").trim();
  }

  function stop() {
    try { window.speechSynthesis.cancel(); } catch (_) {}
  }

  function pickVoice() {
    try {
      const voices = window.speechSynthesis.getVoices() || [];
      // Prefer en-US; fall back to any English voice
      return voices.find(v => v.lang === "en-US")
        || voices.find(v => /en/i.test(v.lang))
        || null;
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
