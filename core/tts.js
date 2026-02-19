let maleVoice = null;
let femaleVoice = null;
let currentVoice = null;
let voicesReady = false;

/* Resolve voices once */
function initVoices() {
  const voices = speechSynthesis.getVoices();
  if (!voices.length) return;

  const english = voices.filter(v =>
    v.lang && v.lang.toLowerCase().includes("en")
  );

  if (!english.length) return;

  // Default fallback
  maleVoice = english[0];
  femaleVoice = english[0];

  // Try to find distinct voices by common names
  const maleCandidate = english.find(v =>
    /daniel|david|alex|fred|tom|google us english male/i.test(v.name)
  );

  const femaleCandidate = english.find(v =>
    /samantha|victoria|karen|zira|ava|google us english female/i.test(v.name)
  );

  if (maleCandidate) maleVoice = maleCandidate;
  if (femaleCandidate) femaleVoice = femaleCandidate;

  voicesReady = true;
}

speechSynthesis.onvoiceschanged = initVoices;
initVoices();

/* Profile setter */
function setVoiceProfile(profile) {
  if (!voicesReady) initVoices();

  if (profile === "male") {
    currentVoice = maleVoice;
  } else {
    currentVoice = femaleVoice;
  }
}

/* Speak */
function speak(text) {
  if (!text) return;

  speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);

  if (currentVoice) {
    utterance.voice = currentVoice;
  }

  utterance.rate = 0.95;
  utterance.pitch = 1.0;
  utterance.volume = 1.0;

  speechSynthesis.speak(utterance);
}

function stop() {
  speechSynthesis.cancel();
}

export const tts = {
  speak,
  stop,
  setVoiceProfile
};
