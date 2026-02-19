import { tts } from "./tts.js";

export class PanelEngine {
  constructor({ narrativeEl, choiceButtons }) {
    this.narrativeEl = narrativeEl;
    this.choiceButtons = choiceButtons;
    this.story = null;
    this.current = null;
  }

  async init(id) {
    const url = `./library/${id}.json`;
    this._setLoading(`Loading: ${url}`);
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      throw new Error(`Story JSON fetch failed (${res.status}) for ${url}`);
    }
    const data = await res.json();

    // Minimal schema validation (additive safety)
    if (!data || typeof data !== "object") {
      throw new Error(`Invalid story JSON (not an object) for ${url}`);
    }
    if (!data.start || !data.scenes || typeof data.scenes !== "object") {
      throw new Error(`Invalid story JSON (missing start/scenes) for ${url}`);
    }

    this.story = data;
    this.current = String(this.story.start).trim();
    this.render();
  }

  _setLoading(msg) {
    if (this.narrativeEl) {
      this.narrativeEl.textContent = msg || "Loading…";
    }
    // Disable buttons while loading
    for (const btn of (this.choiceButtons || [])) {
      if (!btn) continue;
      btn.disabled = true;
      const span = btn.querySelector("span") || btn;
      span.textContent = "";
    }
  }

  _setError(msg) {
    if (this.narrativeEl) {
      this.narrativeEl.textContent = msg || "Error.";
    }
    for (const btn of (this.choiceButtons || [])) {
      if (!btn) continue;
      btn.disabled = true;
      const span = btn.querySelector("span") || btn;
      span.textContent = "";
    }
  }

  render() {
    try {
      const scenes = this.story?.scenes;
      const node = scenes?.[this.current];

      if (!node) {
        this._setError(`Scene not found: ${this.current}`);
        return;
      }

      const rawText = String(node.text || "");
      this.narrativeEl.textContent = rawText;
      this.narrativeEl.scrollTop = 0;

      // Optional TTS narration (opt-in via UI toggle)
      tts.speak(rawText);

      const opts = Array.isArray(node.options) ? node.options : [];

      for (let i = 0; i < 4; i++) {
        const btn = this.choiceButtons[i];
        if (!btn) continue;

        const span = btn.querySelector("span") || btn;
        const opt = opts[i];

        if (!opt) {
          span.textContent = "";
          btn.disabled = true;
          btn.onclick = null;
          continue;
        }

        span.textContent = String(opt.label || "").trim();
        btn.disabled = false;

        btn.onclick = () => {
          tts.stop();
          this.current = String(opt.to || "").trim();
          this.render();
        };
      }
    } catch (e) {
      console.error(e);
      this._setError(`Render error: ${e?.message || e}`);
    }
  }
}
