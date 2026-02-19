import { tts } from "./tts.js";
export class PanelEngine {
  constructor({ narrativeEl, choiceButtons }) {
    this.narrativeEl = narrativeEl;
    this.choiceButtons = choiceButtons;
    this.story = null;
    this.current = null;
  }

  async init(id) {
    const res = await fetch(`./library/${id}.json`, { cache: "no-store" });
    this.story = await res.json();
    this.current = this.story.start;
    this.render();
  }

  render() {
    const node = this.story.scenes[this.current];
    this.narrativeEl.textContent = node.text;
    this.narrativeEl.scrollTop = 0;

    // Optional TTS narration (opt-in via UI toggle)
    tts.speak(node.text);

    for (let i = 0; i < 4; i++) {
      const btn = this.choiceButtons[i];
      const span = btn.querySelector("span");
      const opt = node.options[i];
      if (!opt) {
        span.textContent = "Not a choice";
        btn.disabled = true;
        continue;
      }
      span.textContent = opt.label;
      btn.disabled = false;
      btn.onclick = () => {
        // stop any in-progress narration before navigating
        tts.stop();
        this.current = opt.to;
        this.render();
      };
    }
  }
}
