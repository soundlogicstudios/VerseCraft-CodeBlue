/* UMD wrapper for VerseCraft CodeBlue TTS (no module imports). Additive file. */
(function(global){
  'use strict';

  function extractNarrative(rawText){
    if(!rawText) return "";
    var t = String(rawText);
    // Cut off printed choices blocks
    var cut = t.split("----------------")[0];
    var idx = cut.indexOf("\nCHOICES");
    if(idx >= 0) cut = cut.slice(0, idx);
    return cut.trim();
  }

  function pickVoice(profile){
    var voices = (global.speechSynthesis && global.speechSynthesis.getVoices) ? global.speechSynthesis.getVoices() : [];
    if(!voices || !voices.length) return null;

    // Prefer English
    var english = voices.filter(function(v){
      var lang = (v.lang || "").toLowerCase();
      var name = (v.name || "").toLowerCase();
      return lang.indexOf("en") === 0 || name.indexOf("english") >= 0;
    });
    var pool = english.length ? english : voices;

    // Heuristic "male-ish" / "female-ish" name filters
    var maleHints = ["david","alex","daniel","tom","thomas","matt","matthew","mark","mike","michael","john","james","richard","ben","brian","fred","george","guy","sam","paul"];
    var femaleHints = ["samantha","victoria","karen","susan","lisa","amy","emma","ava","zoe","olivia","sarah","jenny","jennifer","katie","kate","anna","allison","alexa","siri"];
    function score(v){
      var n=(v.name||"").toLowerCase();
      var s=0;
      if(profile==="male"){
        maleHints.forEach(function(h){ if(n.indexOf(h)>=0) s+=2; });
        femaleHints.forEach(function(h){ if(n.indexOf(h)>=0) s-=2; });
      } else if(profile==="female"){
        femaleHints.forEach(function(h){ if(n.indexOf(h)>=0) s+=2; });
        maleHints.forEach(function(h){ if(n.indexOf(h)>=0) s-=2; });
      }
      // Prefer local/en-US slightly
      var lang=(v.lang||"").toLowerCase();
      if(lang==="en-us") s+=1;
      if(lang==="en-gb") s+=0.5;
      return s;
    }
    pool = pool.slice().sort(function(a,b){ return score(b)-score(a); });
    return pool[0] || null;
  }

  var tts = {
    enabled: false,
    profile: "male",
    _voice: null,
    init: function(){
      try { if(global.speechSynthesis) global.speechSynthesis.getVoices(); } catch(e){}
      if(global.speechSynthesis){
        global.speechSynthesis.onvoiceschanged = function(){
          try { global.speechSynthesis.getVoices(); } catch(e){}
        };
      }
    },
    setVoiceProfile: function(profile){
      this.profile = profile === "female" ? "female" : (profile === "male" ? "male" : "male");
      this._voice = null;
    },
    toggle: function(on){
      this.enabled = !!on;
      if(!this.enabled) this.stop();
    },
    speak: function(rawText){
      if(!this.enabled) return;
      var text = extractNarrative(rawText);
      if(!text) return;
      try { global.speechSynthesis.cancel(); } catch(e){}
      var u = new SpeechSynthesisUtterance(text);
      u.rate = 0.98;
      u.pitch = (this.profile==="female") ? 1.06 : 0.92;
      u.volume = 1.0;
      if(!this._voice) this._voice = pickVoice(this.profile);
      if(this._voice) u.voice = this._voice;
      try { global.speechSynthesis.speak(u); } catch(e){}
    },
    stop: function(){
      try { global.speechSynthesis.cancel(); } catch(e){}
    }
  };

  tts.init();
  global.VC_TTS = tts;
})(window);
