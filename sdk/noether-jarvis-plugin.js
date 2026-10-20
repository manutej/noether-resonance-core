/**
 * @file sdk/noether-jarvis-plugin.js
 * @module NoetherJarvisPlugin
 * @version 9.0.0
 *
 * Plug-and-Play Conversational AI & 3D Quantum Field Plugin SDK for Noether Resonance Core.
 *
 * Allows any web application, executive dashboard, or external AI agent pipeline to:
 *   1. Mount the 3D Noether Quantum Orb (`NoetherJarvisPlugin.mount('#target', options)`)
 *   2. Run live full-duplex or push-to-talk Jarvis voice conversations (`NoetherJarvisPlugin.createVoiceSession(options)`)
 *   3. Pipe external WebAudio streams, WebSocket LLM streams, or Antigravity CLI events directly into the 3D field.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.NoetherJarvisPlugin = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  class NoetherVoiceSession {
    constructor(options = {}) {
      this.apiBase = (options.apiBase || '').replace(/\/$/, '');
      this.speaker = options.speaker || 'Kore';
      this.geminiApiKey = options.geminiApiKey || '';
      this.continuous = Boolean(options.continuous);
      this.history = [];
      this.state = 'idle';
      this.recognition = null;
      this.isListening = false;
      this.onStateChange = options.onStateChange || function () {};
      this.onTranscript = options.onTranscript || function () {};
      this.onTurnStart = options.onTurnStart || function () {};
      this.onTurnComplete = options.onTurnComplete || function () {};
      this.onError = options.onError || function () {};
    }

    _setState(next) {
      this.state = next;
      try { this.onStateChange(next); } catch (_) {}
      if (typeof window !== 'undefined' && window.noetherResonance) {
        window.noetherResonance.setState(next);
      }
    }

    async ask(promptText, opts = {}) {
      const prompt = String(promptText || '').trim();
      if (!prompt) return null;

      this._setState('thinking');
      try { this.onTurnStart({ prompt, history: this.history.slice() }); } catch (_) {}

      const res = await fetch(`${this.apiBase}/api/turn`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          speaker: opts.speaker || this.speaker,
          geminiApiKey: opts.geminiApiKey || this.geminiApiKey || (typeof localStorage !== 'undefined' ? localStorage.getItem('NOETHER_GEMINI_API_KEY') : '') || '',
          history: this.history.slice(-8),
          synthesizeUserVoice: Boolean(opts.synthesizeUserVoice)
        })
      });

      if (!res.ok) {
        throw new Error(`Noether /api/turn returned HTTP ${res.status}`);
      }
      const data = await res.json();
      if (!data.ok) {
        throw new Error(data.error || 'Noether turn failed');
      }

      this.history.push({ role: 'user', content: prompt });
      this.history.push({ role: 'assistant', content: data.aiResponse });
      if (this.history.length > 16) this.history = this.history.slice(-16);

      try { this.onTurnComplete(data); } catch (_) {}
      return data;
    }

    startVoiceCapture() {
      if (typeof window === 'undefined') return false;
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SR) {
        this.onError(new Error('SpeechRecognition API is not supported in this browser.'));
        return false;
      }
      if (this.recognition) {
        try { this.recognition.stop(); } catch (_) {}
      }
      const rec = new SR();
      rec.lang = 'en-US';
      rec.interimResults = true;
      rec.maxAlternatives = 1;
      this.recognition = rec;
      this.isListening = true;
      this._setState('listening');

      let finalTranscript = '';
      rec.onresult = ev => {
        let interim = '';
        for (let i = ev.resultIndex; i < ev.results.length; i++) {
          const t = ev.results[i][0].transcript;
          if (ev.results[i].isFinal) finalTranscript += t;
          else interim += t;
        }
        const combined = (finalTranscript || interim).trim();
        this.onTranscript(combined, Boolean(finalTranscript));
      };

      rec.onend = async () => {
        this.isListening = false;
        this.recognition = null;
        const text = finalTranscript.trim();
        if (text) {
          await this.ask(text);
        } else if (!this.continuous) {
          this._setState('idle');
        }
      };

      rec.onerror = err => {
        this.isListening = false;
        this.recognition = null;
        this.onError(err);
      };

      rec.start();
      return true;
    }

    stopVoiceCapture() {
      this.isListening = false;
      if (this.recognition) {
        try { this.recognition.stop(); } catch (_) {}
        this.recognition = null;
      }
    }

    clearHistory() {
      this.history = [];
    }
  }

  function mount(targetSelectorOrEl, options = {}) {
    const container = typeof targetSelectorOrEl === 'string'
      ? document.querySelector(targetSelectorOrEl)
      : targetSelectorOrEl;
    if (!container) throw new Error('NoetherJarvisPlugin.mount: target container not found');

    const srcUrl = options.srcUrl || '/';
    const url = new URL(srcUrl, window.location.origin);
    if (options.mode === 'music') url.searchParams.set('workspace', 'music');
    else url.searchParams.set('workspace', 'jarvis');
    if (options.embed) url.searchParams.set('embed', '1');

    const iframe = document.createElement('iframe');
    iframe.src = url.toString();
    iframe.allow = 'microphone; autoplay; midi';
    iframe.style.cssText = 'width:100%;height:100%;border:0;border-radius:inherit;display:block;background:#07060a;';
    container.innerHTML = '';
    container.appendChild(iframe);

    return {
      iframe,
      sendCommand(cmdObj) {
        if (iframe.contentWindow) {
          iframe.contentWindow.postMessage({ type: 'noether_plugin_cmd', ...cmdObj }, '*');
        }
      }
    };
  }

  return {
    version: '9.0.0',
    NoetherVoiceSession,
    createVoiceSession: opts => new NoetherVoiceSession(opts),
    mount
  };
});
