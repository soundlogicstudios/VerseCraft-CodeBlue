/* UMD wrapper for VerseCraft CodeBlue PanelEngine (minimal story harness renderer). Additive file. */
(function(global){
  'use strict';

  function $(id){ return document.getElementById(id); }

  function safeText(s){ return String(s||""); }

  function PanelEngine(cfg){
    this.cfg = cfg || {};
    this.story = null;
    this.sceneId = null;
  }

  PanelEngine.prototype._setStatus = function(msg){
    var el = $(this.cfg.statusId);
    if(el) el.textContent = msg || "";
  };

  PanelEngine.prototype._render = function(scene){
    var textEl = $(this.cfg.textId);
    var choicesEl = $(this.cfg.choicesId);
    if(textEl) textEl.textContent = safeText(scene && scene.text);
    if(choicesEl){
      choicesEl.innerHTML = "";
      var opts = (scene && scene.options) ? scene.options : [];
      for(var i=0;i<opts.length;i++){
        (function(opt, self){
          var b = document.createElement("button");
          b.className = "choice-pill";
          b.type = "button";
          b.textContent = safeText(opt.label);
          b.onclick = function(){
            self.goto(opt.to);
          };
          choicesEl.appendChild(b);
        })(opts[i], this);
      }
    }
    if(global.VC_TTS) global.VC_TTS.speak(scene && scene.text);
  };


  PanelEngine.prototype.loadById = async function(id){
    this._setStatus("Loading story...");
    try{
      // CSP-safe embedded JSON: if code_blue_data.js is present, prefer embedded story text.
      if(global.VC_GET_STORY_JSON && url){
        var m = String(url).match(/\/library\/(.+?)\.json/i);
        if(m && m[1]){
          var emb = global.VC_GET_STORY_JSON(m[1]);
          if(emb && emb.start && emb.scenes){
            this.story = emb;
            this.sceneId = String(emb.start||'').trim();
            this._setStatus('');
            this._render(emb.scenes[this.sceneId] || {text:'[Missing start scene]', options:[]});
            return true;
          }
        }
      }

      if(global.VC_GET_STORY_JSON){
        var data = global.VC_GET_STORY_JSON(id);
        if(data && data.start && data.scenes){
          this.story = data;
          this.sceneId = String(data.start||"").trim();
          this._setStatus("");
          this._render(data.scenes[this.sceneId] || {text:"[Missing start scene]", options:[]});
          return true;
        }
      }
      throw new Error("Embedded story not found: " + id);
    }catch(e){
      this._setStatus("ERROR: "+(e && e.message ? e.message : "Failed to load story"));
      this._render({text:"[Story failed to load]\n\n"+(e && e.message ? e.message : ""), options:[]});
      return false;
    }
  };


  PanelEngine.prototype.load = async function(url){
    this._setStatus("Loading story...");
    try{
      // CSP-safe embedded JSON: if code_blue_data.js is present, prefer embedded story text.
      if(global.VC_GET_STORY_JSON && url){
        var m = String(url).match(/\/library\/(.+?)\.json/i);
        if(m && m[1]){
          var emb = global.VC_GET_STORY_JSON(m[1]);
          if(emb && emb.start && emb.scenes){
            this.story = emb;
            this.sceneId = String(emb.start||'').trim();
            this._setStatus('');
            this._render(emb.scenes[this.sceneId] || {text:'[Missing start scene]', options:[]});
            return true;
          }
        }
      }

      var res = await fetch(url, {cache:"no-store"});
      if(!res.ok) throw new Error("HTTP "+res.status+" for "+url);
      var data = await res.json();
      if(!data || !data.start || !data.scenes) throw new Error("Invalid story JSON schema");
      this.story = data;
      this.sceneId = data.start;
      this._setStatus("");
      this._render(data.scenes[this.sceneId] || {text:"[Missing start scene]", options:[]});
      return true;
    }catch(e){
      this._setStatus("ERROR: "+(e && e.message ? e.message : "Failed to load story"));
      this._render({text:"[Story failed to load]\n\n"+(e && e.message ? e.message : ""), options:[]});
      return false;
    }
  };

  PanelEngine.prototype.goto = function(sceneId){
    if(global.VC_TTS) global.VC_TTS.stop();
    this.sceneId = String(sceneId||"").trim();
    var sc = (this.story && this.story.scenes) ? this.story.scenes[this.sceneId] : null;
    if(!sc) sc = {text:"[Missing scene: "+this.sceneId+"]", options:[]};
    this._render(sc);
  };

  global.VC_PanelEngine = PanelEngine;
})(window);
