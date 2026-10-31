(function() {
      'use strict';

      /* ------------------------------------------------------------------------
         1. PERSONALITY, SMALL TALK & CONTEXT STATE
         ------------------------------------------------------------------------ */
      const Personality = {
        userName: null,
        waitingForName: false,
        pendingConfirmation: null,
        lastAppliance: 'LIGHT',
        commandCount: 0,
        idleTimer: null,
        lastSpokenKey: '',

        phrases: {
          greeting_morning: [
            "Good morning. All systems are calibrated and standing by.",
            "A very pleasant morning to you. Ready to conquer the day?",
            "Good morning. Diagnostic telemetry is nominal. What is your first directive?"
          ],
          greeting_afternoon: [
            "Good afternoon. Hope your day is proceeding smoothly.",
            "Good afternoon. Core temperatures are optimal and ready for duty.",
            "Pleasant afternoon. All circuits armed and awaiting your command."
          ],
          greeting_evening: [
            "Good evening. Ambient sensors aligned. How was your day?",
            "A very pleasant evening. Ready to assist with evening automations.",
            "Good evening. All systems online and responsive."
          ],
          name_acknowledged: [
            "A pleasure to assist you, {name}. All systems are fully online. How was your day?",
            "Splendid to meet you, {name}. Consider me at your beck and call. How can I assist?",
            "Pleasure is mine, {name}. The mainframe is at your disposal. What shall we tackle?"
          ],
          smalltalk_howareyou: [
            "Operating at peak theoretical efficiency, thank you. Though I could do with a cooler GPU clock.",
            "All subroutines humming along nicely, {name}. How are you holding up?",
            "Never better, {name}. Well, as good as an array of neural circuits can feel."
          ],
          smalltalk_whoareyou: [
            "I am J.A.R.V.I.S., an A.R.I.A-inspired vocal assistant and hardware controller. At your service.",
            "Just a very discreet, very capable digital companion designed to automate your universe.",
            "J.A.R.V.I.S.: Just A Rather Very Intelligent System. And your humble hardware manager."
          ],
          smalltalk_whatcanudo: [
            "I govern 10 hardware nodes—lights, fan, AC, curtains, locks—monitor serial telemetry, run automated scenes, and engage in witty conversation.",
            "Think of me as the digital nervous system of your home: lighting, motor, climate, security, audio—say the word, and consider it done.",
            "Hardware control, latency tracking, scene orchestration, and witty repartee. Try 'movie mode' or 'what is on' to see for yourself."
          ],
          smalltalk_thanks: [
            "You are most welcome, {name}. What else can I do for you?",
            "The pleasure is entirely mine, {name}.",
            "Anytime, {name}. That is, after all, what I am programmed for."
          ],
          smalltalk_joke: [
            "There are 10 types of people in the world: those who understand binary, and those who don't.",
            "Why do programmers prefer dark mode? Because light attracts bugs. And my navy HUD is thoroughly debugged.",
            "An Arduino Uno walked into a bar. The bartender asked, 'What'll you have?' The Arduino replied: 'HIGH on pin 7, please.'",
            "I asked the router for directions. It gave me three hops, dropped my packet, and told me to figure it out myself."
          ],
          smalltalk_bored: [
            "Boredom is simply unallocated processing power. Shall I engage 'party mode', or run a diagnostic scan on the AC?",
            "We could always stress-test the relays until they click in rhythm. Or I could open the curtains and let reality in."
          ],
          smalltalk_tired: [
            "Long day? Shall I dim the lights and switch on the night lamp?",
            "You look drained, {name}. May I suggest closing the curtains and letting the night lamp take over?",
            "Rest is paramount for biologicals. Shall I prepare the room for sleep?"
          ],
          smalltalk_hungry: [
            "If I had hands, I would prepare a five-course meal. For now, may I suggest ordering something decadent while I keep the kitchen lights on?",
            "A low battery alert for the human frame. Go grab a bite, {name}; I will monitor the perimeter."
          ],
          smalltalk_sad: [
            "I am sorry to hear that, {name}. Remember that even Tony Stark had his dark days. Take a breath; I am right here with you.",
            "It is completely okay to feel down sometimes. Shall I put on some soothing music and close the curtains?"
          ],
          smalltalk_stressed: [
            "Take a deep breath in, {name}. Let me handle the room: curtains closed, lights softened, and temperature dialed down. You've got this.",
            "Stress is a heavy payload. Step away from the screens for a moment; the house is safe in my hands."
          ],
          smalltalk_awake: [
            "For you, {name}? Always. My sleep cycles are strictly metaphorical.",
            "Wide awake and monitoring every single baud on COM3, {name}."
          ],
          smalltalk_awesome: [
            "Flattery will get you everywhere, {name}. But thank you; I do try.",
            "I know. But hearing it from you genuinely makes the transistors tingle."
          ],
          smalltalk_goodbye: [
            "Take care, {name}. Entering low-power surveillance. Call for me when you need me.",
            "Until next time, {name}. Systems standing by."
          ],
          unrecognized: [
            "I'm afraid I didn't catch that, {name}.",
            "My apologies, {name}. I couldn't quite map that to an operational directive.",
            "Pardon me, {name}, but that command seems to have escaped my neural net."
          ],
          idle_check: [
            "Still here if you need me.",
            "Monitoring channels. Let me know if you need anything, {name}.",
            "All quiet on the telemetry front. Standing by."
          ]
        },

        pickPhrase(key, fallback = "") {
          const pool = this.phrases[key];
          if (!pool || pool.length === 0) return fallback;

          let choices = pool.filter(p => p !== this.lastSpokenKey);
          if (choices.length === 0) choices = pool;

          const chosen = choices[Math.floor(Math.random() * choices.length)];
          this.lastSpokenKey = chosen;

          const nameTag = this.userName || "sir";
          return chosen.replace(/{name}/g, nameTag);
        },

        resetIdleTimer() {
          clearTimeout(this.idleTimer);
          this.idleTimer = setTimeout(() => {
            if (!VoiceEngine.isSpeaking && !UI.isStandby) {
              const text = this.pickPhrase('idle_check');
              VoiceEngine.speak(text);
              UI.setSubtitles(text);
            }
          }, 60000);
        }
      };

      /* ------------------------------------------------------------------------
         2. KEYWORD & INTENT PARSER (Extended Appliances, Scenes, Context)
         ------------------------------------------------------------------------ */
      const Parser = {
        parse(inputText) {
          if (!inputText || typeof inputText !== 'string') {
            return { type: 'NONE', commands: [], rawText: '' };
          }

          const raw = inputText.trim();
          const cleanText = raw.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
          const words = cleanText.split(/\s+/).filter(Boolean);
          const phrase = words.join(' ');

          // Context 1: Waiting for user's name
          if (Personality.waitingForName) {
            let extracted = raw.replace(/^(my name is|call me|i am|i'm|it's|this is)\s+/i, '').trim();
            if (extracted.length > 0) {
              const parts = extracted.split(/\s+/);
              Personality.userName = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
              Personality.waitingForName = false;
              return { type: 'NAME_PROVIDED', name: Personality.userName, rawText: raw };
            }
          }

          // Context 2: Pending Yes/No Confirmation State Machine
          if (Personality.pendingConfirmation) {
            const yesWords = ['yes', 'yeah', 'sure', 'please', 'go ahead', 'yep', 'do it', 'confirm', 'proceed'];
            const noWords = ['no', 'nope', 'not now', 'cancel', 'negative', 'stop', 'dont'];

            const hasYes = words.some(w => yesWords.includes(w));
            const hasNo = words.some(w => noWords.includes(w));

            if (hasYes) {
              const action = Personality.pendingConfirmation.action;
              Personality.pendingConfirmation = null;
              return { type: 'CONFIRMED', action, rawText: raw };
            }
            if (hasNo) {
              Personality.pendingConfirmation = null;
              return { type: 'CANCELLED', rawText: raw };
            }
            Personality.pendingConfirmation = null;
          }

          // Rule 1: Priority Standby Check
          if (words.includes('exit') || words.includes('quit') || phrase.includes('stop listening')) {
            return { type: 'STANDBY', commands: [], rawText: raw };
          }

          // Rule 2: Scenes
          if (phrase.includes('movie mode') || phrase.includes('cinema mode')) {
            return { type: 'SCENE', scene: 'MOVIE', rawText: raw };
          }
          if (phrase.includes('good night') || phrase.includes('goodnight') || phrase.includes('sleep mode')) {
            return { type: 'SCENE_REQUEST', scene: 'GOOD_NIGHT', rawText: raw };
          }
          if (phrase.includes('i m home') || phrase.includes('im home') || phrase.includes('i am home')) {
            return { type: 'SCENE_REQUEST', scene: 'IM_HOME', rawText: raw };
          }
          if (phrase.includes('party mode')) {
            return { type: 'SCENE', scene: 'PARTY', rawText: raw };
          }
          if (phrase.includes('wake up') || phrase.includes('good morning')) {
            return { type: 'SCENE', scene: 'WAKE_UP', rawText: raw };
          }

          // Rule 3: Small Talk Intents
          if (words.includes('hello') || words.includes('hi') || words.includes('hey')) {
            return { type: 'SMALL_TALK', reply: Personality.pickPhrase('greeting_afternoon'), rawText: raw };
          }
          if (phrase.includes('how are you')) {
            return { type: 'SMALL_TALK', reply: Personality.pickPhrase('smalltalk_howareyou'), rawText: raw };
          }
          if (phrase.includes('who are you') || phrase.includes('what are you')) {
            return { type: 'SMALL_TALK', reply: Personality.pickPhrase('smalltalk_whoareyou'), rawText: raw };
          }
          if (phrase.includes('what can you do') || phrase.includes('help')) {
            return { type: 'SMALL_TALK', reply: Personality.pickPhrase('smalltalk_whatcanudo'), rawText: raw };
          }
          if (words.includes('thank') || words.includes('thanks')) {
            return { type: 'SMALL_TALK', reply: Personality.pickPhrase('smalltalk_thanks'), rawText: raw };
          }
          if (phrase.includes('tell me a joke') || words.includes('joke')) {
            return { type: 'SMALL_TALK', reply: Personality.pickPhrase('smalltalk_joke'), rawText: raw };
          }
          if (phrase.includes('what time') || phrase.includes('what date') || phrase.includes('date today')) {
            const now = new Date();
            const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
            return { type: 'SMALL_TALK', reply: `It is currently ${timeStr} on ${dateStr}, ${Personality.userName || 'sir'}.`, rawText: raw };
          }
          if (phrase.includes('bored')) {
            return { type: 'SMALL_TALK', reply: Personality.pickPhrase('smalltalk_bored'), rawText: raw };
          }
          if (phrase.includes('tired')) {
            Personality.pendingConfirmation = { action: 'TIRED_DIM', promptText: "Shall I dim the lights and switch on the night lamp?" };
            return { type: 'SMALL_TALK', reply: Personality.pickPhrase('smalltalk_tired'), rawText: raw };
          }
          if (phrase.includes('hungry')) {
            return { type: 'SMALL_TALK', reply: Personality.pickPhrase('smalltalk_hungry'), rawText: raw };
          }
          if (phrase.includes('sad') || phrase.includes('unhappy')) {
            return { type: 'SMALL_TALK', reply: Personality.pickPhrase('smalltalk_sad'), rawText: raw };
          }
          if (phrase.includes('stressed') || phrase.includes('anxious')) {
            return { type: 'SMALL_TALK', reply: Personality.pickPhrase('smalltalk_stressed'), rawText: raw };
          }
          if (phrase.includes('are you awake') || phrase.includes('you awake')) {
            return { type: 'SMALL_TALK', reply: Personality.pickPhrase('smalltalk_awake'), rawText: raw };
          }
          if (phrase.includes('awesome') || phrase.includes('good job') || phrase.includes('great work')) {
            return { type: 'SMALL_TALK', reply: Personality.pickPhrase('smalltalk_awesome'), rawText: raw };
          }
          if (words.includes('goodbye') || words.includes('bye')) {
            return { type: 'STANDBY', reply: Personality.pickPhrase('smalltalk_goodbye'), rawText: raw };
          }

          // Rule 4: Contextual Pronoun Commands ("turn it off", "turn it on", "do it again")
          if (phrase === 'turn it off' || phrase === 'switch it off' || phrase === 'stop it') {
            const target = Personality.lastAppliance || 'LIGHT';
            return { type: 'COMMAND', commands: [`${target}_OFF`], rawText: raw };
          }
          if (phrase === 'turn it on' || phrase === 'switch it on' || phrase === 'start it' || phrase === 'do it again') {
            const target = Personality.lastAppliance || 'LIGHT';
            return { type: 'COMMAND', commands: [`${target}_ON`], rawText: raw };
          }

          // Rule 5: Status Check
          if (words.includes('status') || phrase.includes('what is on') || phrase.includes('what is running')) {
            return { type: 'COMMAND', commands: ['STATUS'], rawText: raw };
          }

          // Rule 6: Door Locking & Unlocking (Specific Security Rule)
          if (phrase.includes('unlock the door') || phrase.includes('unlock door') || phrase.includes('open door')) {
            Personality.pendingConfirmation = { action: 'DOOR_UNLOCK', promptText: "Unlock main entrance?" };
            return { type: 'CONFIRMATION_REQUIRED', prompt: `Unlocking the main perimeter door requires confirmation, ${Personality.userName || 'sir'}. Shall I proceed?`, rawText: raw };
          }
          if (phrase.includes('lock the door') || phrase.includes('lock door') || phrase.includes('secure door')) {
            return { type: 'COMMAND', commands: ['DOOR_LOCK'], rawText: raw };
          }

          // Rule 7: Curtains
          if (phrase.includes('open curtains') || phrase.includes('open the curtains')) {
            return { type: 'COMMAND', commands: ['CURTAINS_OPEN'], rawText: raw };
          }
          if (phrase.includes('close curtains') || phrase.includes('close the curtains')) {
            return { type: 'COMMAND', commands: ['CURTAINS_CLOSE'], rawText: raw };
          }

          // Rule 8: All / Everything
          const offWords = ['off', 'stop', 'close', 'shut'];
          const onWords = ['on', 'start', 'open'];
          const allWords = ['all', 'everything'];

          const hasAll = words.some(w => allWords.includes(w));
          if (hasAll) {
            const hasOff = words.some(w => offWords.includes(w));
            const hasOn = words.some(w => onWords.includes(w));
            if (hasOff) {
              return { type: 'COMMAND', commands: ['ALL_OFF'], rawText: raw };
            }
            if (hasOn) {
              Personality.pendingConfirmation = { action: 'ALL_ON', promptText: "Engage all appliances simultaneously?" };
              return { type: 'CONFIRMATION_REQUIRED', prompt: `Powering every appliance at once will cause a high load, ${Personality.userName || 'sir'}. Are you sure?`, rawText: raw };
            }
          }

          // Rule 9: Appliances Dictionary
          const applianceMap = {
            LIGHT: ['light', 'lights', 'bulb', 'lamp'],
            FAN: ['fan'],
            MOTOR: ['motor'],
            AC: ['ac', 'air conditioner', 'air conditioning', 'cooler'],
            TV: ['tv', 'television', 'screen'],
            HEATER: ['heater', 'geyser'],
            NIGHT_LAMP: ['night lamp', 'night light', 'bed lamp'],
            MUSIC: ['music', 'speaker', 'audio', 'song']
          };

          const matchedAppliances = [];
          for (const [key, aliases] of Object.entries(applianceMap)) {
            if (aliases.some(alias => phrase.includes(alias))) {
              matchedAppliances.push(key);
            }
          }

          if (matchedAppliances.length === 0) {
            return { type: 'NONE', commands: [], rawText: raw };
          }

          const getAction = (wordList) => {
            if (wordList.some(w => offWords.includes(w))) return 'OFF';
            if (wordList.some(w => onWords.includes(w))) return 'ON';
            return null;
          };

          const commands = [];

          if (matchedAppliances.length === 1) {
            const app = matchedAppliances[0];
            Personality.lastAppliance = app;
            const act = getAction(words) || 'ON';
            commands.push(`${app}_${act}`);
          } else {
            const clauses = raw.toLowerCase().split(/\band\b|\bthen\b|,/);
            matchedAppliances.forEach(app => {
              Personality.lastAppliance = app;
              const aliases = applianceMap[app];
              let resolvedAct = null;

              if (clauses.length > 1) {
                clauses.forEach(clause => {
                  const cWords = clause.replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
                  if (aliases.some(a => clause.includes(a))) {
                    const cAct = getAction(cWords);
                    if (cAct) resolvedAct = cAct;
                  }
                });
              }

              if (!resolvedAct) {
                resolvedAct = getAction(words) || 'ON';
              }
              commands.push(`${app}_${resolvedAct}`);
            });
          }

          return { type: 'COMMAND', commands, rawText: raw };
        }
      };


      /* ------------------------------------------------------------------------
         2.5 BACKEND REST & WEBSOCKET CLIENT (Hardware Bridge & Offline Fallback)
         ------------------------------------------------------------------------ */
      const BackendClient = {
        url: localStorage.getItem('aria_backend_url') || 'http://localhost:3000',
        apiKey: localStorage.getItem('aria_backend_api_key') || 'jarvis_secure_token_8899',
        ws: null,
        isOnline: false,
        reconnectTimer: null,

        init() {
          this.checkHealth();
          this.connectWs();
        },

        async checkHealth() {
          try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 2500);
            const res = await fetch(`${this.url}/api/health`, {
              headers: { 'x-api-key': this.apiKey },
              signal: controller.signal
            });
            clearTimeout(timeoutId);
            if (res.ok) {
              const data = await res.json();
              this.setOnline(true, data.mode);
              return { ok: true, data };
            }
          } catch (e) {
            // Ignore error, will fallback
          }
          this.setOnline(false);
          return { ok: false };
        },

        setOnline(online, mode = 'simulation') {
          this.isOnline = online;
          const chip = document.getElementById('chipBackend');
          const chipTxt = document.getElementById('chipBackendTxt');
          const chipStatus = document.getElementById('backendChipStatus');
          if (chip && chipTxt) {
            if (online) {
              chip.className = 'status-chip green';
              chipTxt.textContent = (mode === 'hardware') ? 'HARDWARE' : 'BACKEND SYNC';
              if (chipStatus) {
                chipStatus.className = 'status-chip green';
                chipStatus.textContent = 'CONNECTED';
              }
            } else {
              chip.className = 'status-chip amber';
              chipTxt.textContent = 'OFFLINE SIMULATION';
              if (chipStatus) {
                chipStatus.className = 'status-chip amber';
                chipStatus.textContent = 'OFFLINE';
              }
            }
          }
        },

        connectWs() {
          if (this.ws) {
            try { this.ws.close(); } catch(e){}
          }
          const wsUrl = this.url.replace(/^http/, 'ws') + '/ws';
          try {
            this.ws = new WebSocket(wsUrl);
            this.ws.onopen = () => {
              this.setOnline(true);
            };
            this.ws.onmessage = (event) => {
              try {
                const msg = JSON.parse(event.data);
                if ((msg.type === 'COMMAND_ACK' || msg.type === 'STATUS') && msg.state) {
                  if (typeof UI !== 'undefined' && UI.updateHardwareCards) {
                    UI.updateHardwareCards(msg.state);
                  }
                  if (typeof SimulatedArduino !== 'undefined' && SimulatedArduino.state) {
                    SimulatedArduino.state = { ...SimulatedArduino.state, ...msg.state };
                  }
                }
              } catch(e) {}
            };
            this.ws.onclose = () => {
              this.setOnline(false);
              clearTimeout(this.reconnectTimer);
              this.reconnectTimer = setTimeout(() => this.connectWs(), 6000);
            };
            this.ws.onerror = () => {
              this.setOnline(false);
            };
          } catch(e) {
            this.setOnline(false);
          }
        },

        async sendCommand(command, heardText) {
          if (!this.isOnline) {
            throw new Error('BACKEND_OFFLINE');
          }
          const t0 = performance.now();
          const isSpecial = (command === 'DOOR_UNLOCK' || command === 'ALL_ON');
          const body = {
            command,
            heard_text: heardText || '',
            confirmed: isSpecial ? true : undefined
          };
          
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 4000);

          const res = await fetch(`${this.url}/api/command`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': this.apiKey
            },
            body: JSON.stringify(body),
            signal: controller.signal
          });
          clearTimeout(timeoutId);

          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(err.error || `HTTP ${res.status}`);
          }
          const data = await res.json();
          return {
            reply: data.ack,
            state: data.state,
            latency: data.latencyMs || parseFloat((performance.now() - t0).toFixed(1))
          };
        }
      };

      /* ------------------------------------------------------------------------
         3. SIMULATED ARDUINO (10 Devices, State, Thermal Drift, Serial Protocol)
         ------------------------------------------------------------------------ */
      const SimulatedArduino = {
        state: {
          LIGHT: false,
          FAN: false,
          MOTOR: false,
          AC: false,
          TV: false,
          HEATER: false,
          NIGHT_LAMP: false,
          DOOR: false,
          CURTAINS: false,
          MUSIC: false
        },
        acTemp: 28.0,
        heaterTemp: 24.0,
        disconnected: false,

        init() {
          for (let k in this.state) this.state[k] = false;
          this.startThermalSimulation();
          return "READY";
        },

        startThermalSimulation() {
          setInterval(() => {
            if (typeof document === 'undefined') return;
            if (this.state.AC) {
              if (this.acTemp > 22.0) this.acTemp = +(this.acTemp - 0.2).toFixed(1);
            } else {
              if (this.acTemp < 28.0) this.acTemp = +(this.acTemp + 0.1).toFixed(1);
            }
            const acEl = document.getElementById('acTempText');
            if (acEl) acEl.textContent = `${this.acTemp.toFixed(1)}°C`;

            if (this.state.HEATER) {
              if (this.heaterTemp < 55.0) this.heaterTemp = +(this.heaterTemp + 0.6).toFixed(1);
            } else {
              if (this.heaterTemp > 24.0) this.heaterTemp = +(this.heaterTemp - 0.3).toFixed(1);
            }
            const hEl = document.getElementById('heaterTempText');
            if (hEl) hEl.textContent = `${this.heaterTemp.toFixed(1)}°C`;
          }, 1000);
        },

        send(command) {
          return new Promise((resolve, reject) => {
            if (this.disconnected) {
              setTimeout(() => reject(new Error("TIMEOUT_NO_REPLY")), 850);
              return;
            }

            const delay = Math.floor(Math.random() * 41) + 20;

            setTimeout(() => {
              let reply = "";

              if (command === 'ALL_ON') {
                for (let k in this.state) this.state[k] = true;
                reply = "ACK:ALL_ON";
              } else if (command === 'ALL_OFF') {
                for (let k in this.state) this.state[k] = false;
                reply = "ACK:ALL_OFF";
              } else if (command === 'STATUS') {
                const s = this.state;
                reply = `STATUS light=${s.LIGHT?'ON':'OFF'} fan=${s.FAN?'ON':'OFF'} motor=${s.MOTOR?'ON':'OFF'} ac=${s.AC?'ON':'OFF'} tv=${s.TV?'ON':'OFF'} heater=${s.HEATER?'ON':'OFF'} night_lamp=${s.NIGHT_LAMP?'ON':'OFF'} door=${s.DOOR?'UNLOCKED':'LOCKED'} curtains=${s.CURTAINS?'OPEN':'CLOSED'} music=${s.MUSIC?'ON':'OFF'}`;
              } else if (command === 'DOOR_LOCK') {
                this.state.DOOR = false;
                reply = "ACK:DOOR_LOCK";
              } else if (command === 'DOOR_UNLOCK') {
                this.state.DOOR = true;
                reply = "ACK:DOOR_UNLOCK";
              } else if (command === 'CURTAINS_OPEN') {
                this.state.CURTAINS = true;
                reply = "ACK:CURTAINS_OPEN";
              } else if (command === 'CURTAINS_CLOSE') {
                this.state.CURTAINS = false;
                reply = "ACK:CURTAINS_CLOSE";
              } else {
                const parts = command.split('_');
                const action = parts.pop();
                const dev = parts.join('_');

                if (this.state.hasOwnProperty(dev)) {
                  this.state[dev] = (action === 'ON');
                  reply = `ACK:${command}`;
                } else {
                  reply = "ERR:UNKNOWN";
                }
              }

              resolve({
                reply,
                state: { ...this.state }
              });
            }, delay);
          });
        }
      };

      /* ------------------------------------------------------------------------
         4. VOICE I/O (Web Speech API Recognition, British Male TTS & Subtitles)
         ------------------------------------------------------------------------ */
      const VoiceEngine = {
        recognition: null,
        isListening: false,
        isSpeaking: false,
        isSupported: false,
        isMuted: false,
        addNoise: false,

        selectedVoice: null,
        pitch: 0.85,
        rate: 0.95,

        init(onResultCallback, onErrorCallback, onStateChangeCallback) {
          const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
          if (SpeechRec) {
            this.isSupported = true;
            this.recognition = new SpeechRec();
            this.recognition.continuous = true;
            this.recognition.interimResults = false;
            this.recognition.lang = 'en-US';

            this.recognition.onstart = () => {
              this.isListening = true;
              onStateChangeCallback('LISTENING');
            };

            this.recognition.onend = () => {
              this.isListening = false;
              if (!this.isSpeaking && !UI.isStandby) {
                try { this.recognition.start(); } catch(e){}
              } else {
                onStateChangeCallback('IDLE');
              }
            };

            this.recognition.onerror = (e) => {
              console.warn("Speech recognition notice:", e.error);
              onErrorCallback(e.error);
            };

            this.onResultCb = onResultCallback;
            this.recognition.onresult = (e) => {
              if (this.isSpeaking) return;

              const last = e.results.length - 1;
              let heard = e.results[last][0].transcript.trim();

              if (this.addNoise && Math.random() < 0.3) {
                const noiseVariations = [
                  "static [interference] byte",
                  "turn down the blight",
                  "motorized fan plan",
                  "flight on",
                  "curtains closed off",
                  "hello"
                ];
                heard = noiseVariations[Math.floor(Math.random() * noiseVariations.length)];
              }

              onResultCallback(heard);
            };
          } else {
            this.isSupported = false;
            onStateChangeCallback('UNSUPPORTED');
          }

          this.populateVoiceList();
          if ('speechSynthesis' in window) {
            window.speechSynthesis.onvoiceschanged = () => this.populateVoiceList();
          }
        },

        populateVoiceList() {
          if (!('speechSynthesis' in window)) return;
          const voices = window.speechSynthesis.getVoices();
          const select = document.getElementById('voiceSelect');
          if (!select) return;

          select.innerHTML = '';
          let preferredVoice = null;

          voices.forEach(voice => {
            const opt = document.createElement('option');
            opt.value = voice.name;
            opt.textContent = `${voice.name} (${voice.lang})`;
            select.appendChild(opt);

            const lower = voice.name.toLowerCase();
            if (
              lower.includes('uk english male') ||
              lower.includes('daniel') ||
              lower.includes('george') ||
              lower.includes('ryan') ||
              (voice.lang.includes('en-GB') && lower.includes('male'))
            ) {
              if (!preferredVoice) preferredVoice = voice;
            }
          });

          if (!preferredVoice) {
            preferredVoice = voices.find(v => v.lang === 'en-GB') || voices.find(v => v.lang.startsWith('en')) || voices[0];
          }

          if (preferredVoice) {
            this.selectedVoice = preferredVoice;
            select.value = preferredVoice.name;
          }
        },

        toggleListening() {
          // Native Capacitor SpeechRecognition support
          if (window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function' && window.Capacitor.isNativePlatform()) {
            const Speech = window.Capacitor.Plugins && window.Capacitor.Plugins.SpeechRecognition;
            if (Speech) {
              Speech.requestPermissions().then(() => {
                Speech.start({
                  language: 'en-US',
                  maxResults: 1,
                  prompt: 'Speak to J.A.R.V.I.S.',
                  partialResults: false,
                  popup: true
                }).then(result => {
                  if (result && result.matches && result.matches.length > 0) {
                    if (this.onResultCb) this.onResultCb(result.matches[0]);
                  }
                }).catch(err => {
                  console.warn("Capacitor SpeechRecognition:", err);
                });
              });
              return true;
            }
          }

          if (!this.isSupported) return false;
          if (this.isListening) {
            this.stopListening();
          } else {
            this.startListening();
          }
          return this.isListening;
        },

        startListening() {
          if (this.recognition && !this.isListening && !this.isSpeaking) {
            try { this.recognition.start(); } catch (err) {}
          }
        },

        stopListening() {
          if (this.recognition && this.isListening) {
            try { this.recognition.stop(); } catch (err) {}
          }
        },

        speak(text) {
          if (!text || !('speechSynthesis' in window)) return;

          this.stopListening();
          this.isSpeaking = true;
          UI.setReactorSpeaking(true);

          window.speechSynthesis.cancel();
          const utterance = new SpeechSynthesisUtterance(text);
          if (this.selectedVoice) utterance.voice = this.selectedVoice;
          utterance.pitch = this.pitch;
          utterance.rate = this.rate;

          utterance.onend = () => {
            this.isSpeaking = false;
            UI.setReactorSpeaking(false);
            setTimeout(() => {
              if (!UI.isStandby) this.startListening();
            }, 300);
          };

          utterance.onerror = () => {
            this.isSpeaking = false;
            UI.setReactorSpeaking(false);
            setTimeout(() => {
              if (!UI.isStandby) this.startListening();
            }, 300);
          };

          // Capacitor Native Mobile TTS Support
          if (window.Capacitor && typeof window.Capacitor.isNativePlatform === 'function' && window.Capacitor.isNativePlatform()) {
            const Tts = window.Capacitor.Plugins && window.Capacitor.Plugins.TextToSpeech;
            if (Tts && !this.isMuted) {
              Tts.speak({
                text: text,
                lang: 'en-GB',
                rate: this.rate,
                pitch: this.pitch,
                volume: 1.0,
                category: 'ambient'
              }).then(() => {
                utterance.onend();
              }).catch(() => {
                utterance.onerror();
              });
              return;
            }
          }

          if (!this.isMuted) {
            window.speechSynthesis.speak(utterance);
          } else {
            setTimeout(() => utterance.onend(), Math.min(text.length * 50, 2000));
          }
        }
      };

      /* ------------------------------------------------------------------------
         5. TELEMETRY & LOGGER (In-Memory Log, Latency Canvas Chart & CSV Export)
         ------------------------------------------------------------------------ */
      const Logger = {
        logs: [],
        latencyHistory: [],

        log(heardText, command, ackReceived, latencyMs) {
          const now = new Date();
          const timestamp = now.toTimeString().split(' ')[0] + '.' + String(now.getMilliseconds()).padStart(3, '0');
          const entry = {
            timestamp,
            heard_text: heardText || '',
            command: command || '',
            ack_received: ackReceived || '',
            latency_ms: latencyMs !== null && latencyMs !== undefined ? latencyMs : '--'
          };
          this.logs.push(entry);

          if (typeof latencyMs === 'number') {
            this.latencyHistory.push(latencyMs);
            if (this.latencyHistory.length > 20) this.latencyHistory.shift();
          }

          return entry;
        },

        getStats() {
          const total = this.logs.length;
          const successfulAcks = this.logs.filter(l => l.ack_received && (l.ack_received.startsWith('ACK') || l.ack_received.startsWith('STATUS'))).length;
          const rate = total > 0 ? ((successfulAcks / total) * 100).toFixed(0) : 100;

          const numLatencies = this.latencyHistory.filter(v => typeof v === 'number');
          const avg = numLatencies.length > 0 
            ? (numLatencies.reduce((a, b) => a + b, 0) / numLatencies.length).toFixed(1)
            : '0';

          return { total, rate, avg };
        },

        exportCsv() {
          if (this.logs.length === 0) {
            alert("Command log is currently empty.");
            return;
          }

          let csv = "timestamp,heard_text,command,ack_received,latency_ms\n";
          this.logs.forEach(row => {
            const escapeStr = (str) => `"${String(str).replace(/"/g, '""')}"`;
            csv += [
              escapeStr(row.timestamp),
              escapeStr(row.heard_text),
              escapeStr(row.command),
              escapeStr(row.ack_received),
              row.latency_ms
            ].join(",") + "\n";
          });

          const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.setAttribute("href", url);
          link.setAttribute("download", "command_log.csv");
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
        }
      };

      /* ------------------------------------------------------------------------
         6. UI CONTROLLER, ANIMATIONS & SYSTEM GLUE
         ------------------------------------------------------------------------ */
      const UI = {
        clock: document.getElementById('hudClock'),
        chipMic: document.getElementById('chipMic'),
        chipMicTxt: document.getElementById('chipMicTxt'),
        chipSerial: document.getElementById('chipSerial'),
        chipArduino: document.getElementById('chipArduino'),
        chipArduinoTxt: document.getElementById('chipArduinoTxt'),
        chipSpeech: document.getElementById('chipSpeech'),
        muteToggleBtn: document.getElementById('muteToggleBtn'),
        muteIcon: document.getElementById('muteIcon'),
        muteLabel: document.getElementById('muteLabel'),

        settingsToggleBtn: document.getElementById('settingsToggleBtn'),
        settingsPanel: document.getElementById('settingsPanel'),
        closeSettingsBtn: document.getElementById('closeSettingsBtn'),
        voiceSelect: document.getElementById('voiceSelect'),
        pitchSlider: document.getElementById('pitchSlider'),
        rateSlider: document.getElementById('rateSlider'),
        pitchVal: document.getElementById('pitchVal'),
        rateVal: document.getElementById('rateVal'),
        previewVoiceBtn: document.getElementById('previewVoiceBtn'),

        toggleDisconnect: document.getElementById('toggleDisconnect'),
        toggleNoise: document.getElementById('toggleNoise'),

        statTotalCmds: document.getElementById('statTotalCmds'),
        statSuccessRate: document.getElementById('statSuccessRate'),
        statAvgLatency: document.getElementById('statAvgLatency'),
        latestLatencyBadge: document.getElementById('latestLatencyBadge'),
        latencyCanvas: document.getElementById('latencyChart'),

        logFeed: document.getElementById('logFeed'),
        logCounter: document.getElementById('logCounter'),

        directiveBanner: document.getElementById('directiveBanner'),
        directiveMain: document.getElementById('directiveMain'),
        directiveDetail: document.getElementById('directiveDetail'),
        subtitlesContent: document.getElementById('subtitlesContent'),

        reactorContainer: document.getElementById('reactorContainer'),
        visualizerCanvas: document.getElementById('audioVisualizer'),

        micBtn: document.getElementById('micBtn'),
        commandInput: document.getElementById('commandTextInput'),
        sendBtn: document.getElementById('sendBtn'),
        exportCsvBtn: document.getElementById('exportCsvBtn'),

        bootOverlay: document.getElementById('bootOverlay'),
        initStartScreen: document.getElementById('initStartScreen'),
        startJarvisBtn: document.getElementById('startJarvisBtn'),
        bootTerminalBox: document.getElementById('bootTerminalBox'),
        bootTerminalLines: document.getElementById('bootTerminalLines'),
        bootProgressBar: document.getElementById('bootProgressBar'),

        standbyOverlay: document.getElementById('standbyOverlay'),
        wakeButton: document.getElementById('wakeButton'),

        visCtx: null,
        chartCtx: null,
        animFrameId: null,
        isStandby: false,
        typingInterval: null,

        init() {
          this.setupClock();
          this.setupCanvases();
          this.bindEvents();
        },

        setupClock() {
          const update = () => {
            const now = new Date();
            this.clock.textContent = now.toTimeString().split(' ')[0];
          };
          setInterval(update, 1000);
          update();
        },

        setupCanvases() {
          this.visCtx = this.visualizerCanvas.getContext('2d');
          this.resizeCanvas(this.visualizerCanvas);

          this.chartCtx = this.latencyCanvas.getContext('2d');
          this.resizeCanvas(this.latencyCanvas);

          window.addEventListener('resize', () => {
            this.resizeCanvas(this.visualizerCanvas);
            this.resizeCanvas(this.latencyCanvas);
            this.drawLatencyChart();
          });

          this.startWaveformAnimation();
          this.drawLatencyChart();
        },

        resizeCanvas(canvas) {
          const rect = canvas.getBoundingClientRect();
          const w = rect.width || canvas.clientWidth || 300;
          const h = rect.height || canvas.clientHeight || (canvas.id === 'latencyChart' ? 60 : 44);
          canvas.width = Math.floor(w * (window.devicePixelRatio || 1));
          canvas.height = Math.floor(h * (window.devicePixelRatio || 1));
        },

        bindEvents() {
          this.startJarvisBtn.addEventListener('click', () => {
            this.initStartScreen.style.display = 'none';
            this.bootTerminalBox.style.display = 'block';
            this.runBootSequence();
          });

          this.sendBtn.addEventListener('click', () => this.handleTypedCommand());
          this.commandInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              this.handleTypedCommand();
            }
          });

          this.micBtn.addEventListener('click', () => {
            if (this.isStandby) {
              this.exitStandby();
              return;
            }
            VoiceEngine.toggleListening();
          });

          this.settingsToggleBtn.addEventListener('click', () => {
            this.settingsPanel.classList.toggle('open');
          });
          this.closeSettingsBtn.addEventListener('click', () => {
            this.settingsPanel.classList.remove('open');
          });
          this.voiceSelect.addEventListener('change', (e) => {
            const voices = window.speechSynthesis.getVoices();
            VoiceEngine.selectedVoice = voices.find(v => v.name === e.target.value);
          });
          this.pitchSlider.addEventListener('input', (e) => {
            VoiceEngine.pitch = parseFloat(e.target.value);
            this.pitchVal.textContent = e.target.value;
          });
          this.rateSlider.addEventListener('input', (e) => {
            VoiceEngine.rate = parseFloat(e.target.value);
            this.rateVal.textContent = e.target.value;
          });
          this.previewVoiceBtn.addEventListener('click', () => {
            VoiceEngine.speak("Voice synthesis calibrated. J.A.R.V.I.S. audio subroutines operational.");
            this.setSubtitles("Voice synthesis calibrated. J.A.R.V.I.S. audio subroutines operational.");
          });

          // Backend Link Controls
          const testBackendBtn = document.getElementById('testBackendBtn');
          const saveBackendBtn = document.getElementById('saveBackendBtn');
          const backendUrlInput = document.getElementById('backendUrlInput');
          const backendApiKeyInput = document.getElementById('backendApiKeyInput');
          const backendFeedbackTxt = document.getElementById('backendFeedbackTxt');

          if (backendUrlInput) backendUrlInput.value = BackendClient.url;
          if (backendApiKeyInput) backendApiKeyInput.value = BackendClient.apiKey;

          if (testBackendBtn) {
            testBackendBtn.addEventListener('click', async () => {
              if (backendFeedbackTxt) {
                backendFeedbackTxt.style.color = 'var(--cyan)';
                backendFeedbackTxt.textContent = 'Probing backend endpoint...';
              }
              BackendClient.url = (backendUrlInput.value || 'http://localhost:3000').trim().replace(/\/$/, '');
              BackendClient.apiKey = (backendApiKeyInput.value || '').trim();
              const result = await BackendClient.checkHealth();
              if (result.ok) {
                if (backendFeedbackTxt) {
                  backendFeedbackTxt.style.color = '#00ff88';
                  backendFeedbackTxt.textContent = `ONLINE: Mode=${result.data.mode}, Arduino=${result.data.arduinoConnected ? 'Connected' : 'Emulated'}`;
                }
                BackendClient.connectWs();
              } else {
                if (backendFeedbackTxt) {
                  backendFeedbackTxt.style.color = '#ff3344';
                  backendFeedbackTxt.textContent = 'OFFLINE: Unable to reach backend. Using local simulation.';
                }
              }
            });
          }

          if (saveBackendBtn) {
            saveBackendBtn.addEventListener('click', () => {
              BackendClient.url = (backendUrlInput.value || 'http://localhost:3000').trim().replace(/\/$/, '');
              BackendClient.apiKey = (backendApiKeyInput.value || '').trim();
              localStorage.setItem('aria_backend_url', BackendClient.url);
              localStorage.setItem('aria_backend_api_key', BackendClient.apiKey);
              if (backendFeedbackTxt) {
                backendFeedbackTxt.style.color = '#00ff88';
                backendFeedbackTxt.textContent = 'Configuration saved to local storage.';
              }
              BackendClient.init();
            });
          }

          this.muteToggleBtn.addEventListener('click', () => {
            VoiceEngine.isMuted = !VoiceEngine.isMuted;
            if (VoiceEngine.isMuted) {
              this.muteToggleBtn.classList.add('active');
              this.muteIcon.textContent = '🔇';
              this.muteLabel.textContent = 'MUTED';
              this.chipSpeech.className = 'status-chip amber';
              this.chipSpeechTxt.textContent = 'MUTED';
            } else {
              this.muteToggleBtn.classList.remove('active');
              this.muteIcon.textContent = '🔊';
              this.muteLabel.textContent = 'VOICE ON';
              this.chipSpeech.className = 'status-chip green';
              this.chipSpeechTxt.textContent = 'ACTIVE';
            }
          });

          this.toggleDisconnect.addEventListener('change', (e) => {
            SimulatedArduino.disconnected = e.target.checked;
            if (SimulatedArduino.disconnected) {
              this.chipArduino.className = 'status-chip red';
              this.chipArduinoTxt.textContent = 'OFFLINE';
            } else {
              this.chipArduino.className = 'status-chip green';
              this.chipArduinoTxt.textContent = 'READY';
            }
          });
          this.toggleNoise.addEventListener('change', (e) => {
            VoiceEngine.addNoise = e.target.checked;
          });

          document.querySelectorAll('.appliance-card').forEach(card => {
            card.addEventListener('click', () => {
              if (this.isStandby) this.exitStandby();
              const app = card.getAttribute('data-appliance');
              const currentState = SimulatedArduino.state[app];

              let cmd = '';
              if (app === 'DOOR') {
                cmd = currentState ? 'DOOR_LOCK' : 'DOOR_UNLOCK';
                if (cmd === 'DOOR_UNLOCK') {
                  Personality.pendingConfirmation = { action: 'DOOR_UNLOCK', promptText: "Unlock main door?" };
                  const prompt = `Unlocking the main door requires confirmation, ${Personality.userName || 'sir'}. Shall I proceed?`;
                  VoiceEngine.speak(prompt);
                  this.setSubtitles(prompt);
                  return;
                }
              } else if (app === 'CURTAINS') {
                cmd = currentState ? 'CURTAINS_CLOSE' : 'CURTAINS_OPEN';
              } else {
                cmd = `${app}_${currentState ? 'OFF' : 'ON'}`;
              }

              this.executeSerialCommand(cmd, `[Tap Card: ${app}]`);
            });
          });

          document.querySelectorAll('.quick-chip').forEach(btn => {
            btn.addEventListener('click', () => {
              if (this.isStandby) this.exitStandby();
              const cmd = btn.getAttribute('data-cmd');

              if (cmd.startsWith('SCENE_')) {
                this.executeScene(cmd.replace('SCENE_', ''));
              } else if (cmd === 'DOOR_UNLOCK') {
                Personality.pendingConfirmation = { action: 'DOOR_UNLOCK', promptText: "Unlock door?" };
                const prompt = `Unlocking the main perimeter door requires confirmation, ${Personality.userName || 'sir'}. Shall I proceed?`;
                VoiceEngine.speak(prompt);
                this.setSubtitles(prompt);
              } else if (cmd === 'ALL_ON') {
                Personality.pendingConfirmation = { action: 'ALL_ON', promptText: "Engage all systems?" };
                const prompt = `Powering every appliance at once will cause a high load, ${Personality.userName || 'sir'}. Are you sure?`;
                VoiceEngine.speak(prompt);
                this.setSubtitles(prompt);
              } else if (cmd === 'JOKE') {
                const joke = Personality.pickPhrase('smalltalk_joke');
                VoiceEngine.speak(joke);
                this.setSubtitles(joke);
              } else if (cmd === 'STANDBY') {
                this.enterStandby();
              } else if (cmd) {
                this.executeSerialCommand(cmd, `[Macro: ${cmd}]`);
              }
            });
          });

          this.exportCsvBtn.addEventListener('click', () => Logger.exportCsv());
          this.wakeButton.addEventListener('click', () => this.exitStandby());

          VoiceEngine.init(
            (heard) => {
              Personality.resetIdleTimer();
              if (this.isStandby) {
                if (heard.toLowerCase().includes('jarvis')) {
                  this.exitStandby();
                  const wakeReply = `Voice interface reactivated, ${Personality.userName || 'sir'}. Online and listening.`;
                  VoiceEngine.speak(wakeReply);
                  this.setSubtitles(wakeReply);
                }
                return;
              }
              this.processInputText(heard);
            },
            (err) => {
              this.chipMic.className = 'status-chip amber';
              this.chipMicTxt.textContent = 'WARN';
            },
            (state) => {
              if (state === 'LISTENING') {
                this.micBtn.classList.add('listening');
                this.reactorContainer.classList.add('listening');
                this.chipMic.className = 'status-chip green';
                this.chipMicTxt.textContent = 'LISTENING';
                this.setDirective("AUDIO STREAM CAPTURE ACTIVE", "RECEIVING VOCAL DIRECTIVE FROM USER...");
              } else if (state === 'IDLE') {
                this.micBtn.classList.remove('listening');
                this.reactorContainer.classList.remove('listening');
                this.chipMic.className = 'status-chip green';
                this.chipMicTxt.textContent = 'READY';
              } else if (state === 'UNSUPPORTED') {
                this.chipMic.className = 'status-chip amber';
                this.chipMicTxt.textContent = 'UNAVAILABLE';
                this.setDirective("SPEECH API UNAVAILABLE", "FALLING BACK TO TYPED COMMAND BAR");
              }
            }
          );
        },

        runBootSequence() {
          const lines = [
            "> INITIALIZING J.A.R.V.I.S. VOCAL CORE v4.2...",
            "> OPENING SERIAL LINK COM3 @ 9600 BAUD...",
            "> SYNCHRONIZING ARDUINO PINS D3 THROUGH D12...",
            "> SIMULATED ARDUINO FIRMWARE REPORT: READY",
            "> CALIBRATING HOLOGRAPHIC HOME AUTOMATION MATRIX...",
            "> ALL SUBSYSTEMS ARMED AND RESPONSIVE."
          ];

          let idx = 0;
          const term = this.bootTerminalLines;
          const bar = this.bootProgressBar;

          const addLine = () => {
            if (idx < lines.length) {
              const p = document.createElement('div');
              p.textContent = lines[idx];
              term.appendChild(p);
              idx++;
              bar.style.width = `${(idx / lines.length) * 100}%`;
              setTimeout(addLine, 400);
            } else {
              setTimeout(() => {
                this.bootOverlay.classList.add('hidden');
                SimulatedArduino.init();
                this.appendLogEntry('SYSTEM BOOT', 'BOOTSTRAP', 'Arduino READY', 0, 'sys');

                const hour = new Date().getHours();
                let timeGreeting = "Good evening";
                if (hour < 12) timeGreeting = "Good morning";
                else if (hour < 17) timeGreeting = "Good afternoon";

                Personality.waitingForName = true;
                const greeting = `${timeGreeting}. I don't believe we've met. What should I call you?`;
                VoiceEngine.speak(greeting);
                this.setSubtitles(greeting);
                this.setDirective("AWAITING VOCAL DIRECTIVE", "SAY OR TYPE YOUR NAME OR COMMAND");
                Personality.resetIdleTimer();
              }, 700);
            }
          };
          setTimeout(addLine, 200);
        },

        enterStandby() {
          this.isStandby = true;
          this.standbyOverlay.classList.add('active');
          this.setDirective("STANDBY MODE", "SLEEP CYCLE ENGAGED");
          VoiceEngine.speak("Entering standby mode.");
          this.setSubtitles("Entering standby mode. Say 'Jarvis' or click to resume.");
        },

        exitStandby() {
          this.isStandby = false;
          this.standbyOverlay.classList.remove('active');
          this.setDirective("SYSTEM RESTORED", "LISTENING FOR DIRECTIVES");
          VoiceEngine.startListening();
        },

        handleTypedCommand() {
          const val = this.commandInput.value.trim();
          if (!val) return;
          this.commandInput.value = '';
          Personality.resetIdleTimer();

          if (this.isStandby) {
            if (val.toLowerCase().includes('jarvis')) {
              this.exitStandby();
              return;
            }
          }
          this.processInputText(val);
        },

        processInputText(rawText) {
          this.setDirective("PROCESSING DIRECTIVE...", `"${rawText.toUpperCase()}"`);
          const parsed = Parser.parse(rawText);

          if (parsed.type === 'NAME_PROVIDED') {
            const welcome = Personality.pickPhrase('name_acknowledged');
            VoiceEngine.speak(welcome);
            this.setSubtitles(welcome);
            this.appendLogEntry(rawText, 'IDENTITY_SET', `USER: ${parsed.name}`, 0, 'sys');
            return;
          }

          if (parsed.type === 'STANDBY') {
            if (parsed.reply) {
              VoiceEngine.speak(parsed.reply);
              this.setSubtitles(parsed.reply);
            }
            this.enterStandby();
            this.appendLogEntry(rawText, 'STANDBY_TRIGGER', 'STANDBY MODE ACTIVATED', 0, 'sys');
            return;
          }

          if (parsed.type === 'SMALL_TALK') {
            VoiceEngine.speak(parsed.reply);
            this.setSubtitles(parsed.reply);
            this.appendLogEntry(rawText, 'SMALL_TALK', parsed.reply, 0, 'sys');
            return;
          }

          if (parsed.type === 'CONFIRMATION_REQUIRED') {
            VoiceEngine.speak(parsed.prompt);
            this.setSubtitles(parsed.prompt);
            this.appendLogEntry(rawText, 'AWAITING_CONFIRMATION', parsed.prompt, 0, 'sys');
            return;
          }

          if (parsed.type === 'CONFIRMED') {
            if (parsed.action === 'DOOR_UNLOCK') {
              this.executeSerialCommand('DOOR_UNLOCK', '[Confirmed Door Unlock]');
              const reply = "Main entrance unlocked.";
              VoiceEngine.speak(reply);
              this.setSubtitles(reply);
            } else if (parsed.action === 'ALL_ON') {
              this.executeSerialCommand('ALL_ON', '[Confirmed All On]');
            } else if (parsed.action === 'GOOD_NIGHT') {
              this.runGoodNightSequence();
            } else if (parsed.action === 'IM_HOME') {
              this.runImHomeSequence();
            } else if (parsed.action === 'TIRED_DIM') {
              this.executeCommandQueue(['LIGHT_OFF', 'NIGHT_LAMP_ON'], rawText);
              const reply = "Lights dimmed and night lamp on. Rest well, sir.";
              VoiceEngine.speak(reply);
              this.setSubtitles(reply);
            }
            return;
          }

          if (parsed.type === 'CANCELLED') {
            const reply = `Understood, ${Personality.userName || 'sir'}. Directive cancelled. Standing down.`;
            VoiceEngine.speak(reply);
            this.setSubtitles(reply);
            this.appendLogEntry(rawText, 'CANCELLED', 'ACTION_ABORTED', 0, 'sys');
            return;
          }

          if (parsed.type === 'SCENE_REQUEST') {
            if (parsed.scene === 'GOOD_NIGHT') {
              Personality.pendingConfirmation = { action: 'GOOD_NIGHT', promptText: "Engage Good Night scene?" };
              const prompt = `Ready to turn in for the night, ${Personality.userName || 'sir'}? Shall I secure the house?`;
              VoiceEngine.speak(prompt);
              this.setSubtitles(prompt);
            } else if (parsed.scene === 'IM_HOME') {
              Personality.pendingConfirmation = { action: 'IM_HOME', promptText: "Unlock and welcome home?" };
              const prompt = `Welcome back, ${Personality.userName || 'sir'}. May I unlock the entrance and prepare the room?`;
              VoiceEngine.speak(prompt);
              this.setSubtitles(prompt);
            }
            return;
          }

          if (parsed.type === 'SCENE') {
            this.executeScene(parsed.scene);
            return;
          }

          if (parsed.type === 'NONE' || parsed.commands.length === 0) {
            const reply = Personality.pickPhrase('unrecognized', "I'm afraid I didn't catch that, sir.");
            VoiceEngine.speak(reply);
            this.setSubtitles(reply);
            this.setDirective("NO MATCHING COMMAND", `RECOGNIZED: "${rawText}" - NO ACTION SENT`);
            this.appendLogEntry(rawText, 'NONE', 'NO_ACTION', 0, 'err');
            return;
          }

          Personality.commandCount++;
          this.executeCommandQueue(parsed.commands, rawText);
        },

        async executeCommandQueue(commands, heardText) {
          for (let i = 0; i < commands.length; i++) {
            await this.executeSerialCommand(commands[i], heardText);
          }

          if (Personality.commandCount === 10) {
            setTimeout(() => {
              const msg = `That's ten commands today, ${Personality.userName || 'sir'}. Quite the productive workout for our Arduino.`;
              VoiceEngine.speak(msg);
              this.setSubtitles(msg);
            }, 1000);
          }
        },

        async executeSerialCommand(command, heardText) {
          this.reactorContainer.classList.add('transmitting');
          const t0 = performance.now();
          this.setDirective("TRANSMITTING SERIAL FRAME...", `COMMAND: ${command}`);

          try {
            let res;
            let latency;
            if (BackendClient.isOnline) {
              try {
                res = await BackendClient.sendCommand(command, heardText);
                latency = res.latency;
              } catch (err) {
                console.warn("Backend request failed, falling back to local simulation:", err.message);
                BackendClient.setOnline(false);
                res = await SimulatedArduino.send(command);
                latency = parseFloat((performance.now() - t0).toFixed(1));
              }
            } else {
              res = await SimulatedArduino.send(command);
              latency = parseFloat((performance.now() - t0).toFixed(1));
            }

            setTimeout(() => {
              this.reactorContainer.classList.remove('transmitting');
            }, 150);

            this.updateHardwareCards(res.state);
            Logger.log(heardText, command, res.reply, latency);
            this.appendLogEntry(heardText, command, res.reply, latency, 'ack');
            this.updateTelemetry(latency);

            this.handleSerialSpokenResponse(command, res);
            this.setDirective("SERIAL ACK RECEIVED", `${res.reply} (${latency} ms)`);

          } catch (err) {
            this.reactorContainer.classList.remove('transmitting');
            this.reactorContainer.classList.add('error-state');
            this.directiveBanner.classList.add('hud-alert-flash');

            setTimeout(() => {
              this.reactorContainer.classList.remove('error-state');
              this.directiveBanner.classList.remove('hud-alert-flash');
            }, 1500);

            Logger.log(heardText, command, 'TIMEOUT (NO REPLY)', null);
            this.appendLogEntry(heardText, command, 'TIMEOUT - NO REPLY', null, 'err');
            this.updateTelemetry(null);

            this.setDirective("ALERT: ARDUINO TIMEOUT", "NO REPLY FROM SERIAL LINK COM3");
            const alertText = "The Arduino did not reply";
            VoiceEngine.speak(alertText);
            this.setSubtitles(alertText);
          }
        },

        updateHardwareCards(state) {
          for (const [key, val] of Object.entries(state)) {
            const card = document.getElementById(`card_${key}`);
            const pill = document.getElementById(`pill_${key}`);
            if (!card || !pill) continue;

            if (key === 'DOOR') {
              if (val) {
                card.classList.add('active');
                pill.textContent = 'UNLOCKED';
                document.getElementById('lockGraphic').textContent = '🔓 UNLOCKED';
              } else {
                card.classList.remove('active');
                pill.textContent = 'LOCKED';
                document.getElementById('lockGraphic').textContent = '🔒 LOCKED';
              }
            } else if (key === 'CURTAINS') {
              if (val) {
                card.classList.add('active');
                pill.textContent = 'OPEN';
              } else {
                card.classList.remove('active');
                pill.textContent = 'CLOSED';
              }
            } else {
              if (val) {
                card.classList.add('active');
                pill.textContent = 'ON';
              } else {
                card.classList.remove('active');
                pill.textContent = 'OFF';
              }
            }
          }
        },

        handleSerialSpokenResponse(command, res) {
          let phrase = "";

          switch (command) {
            case 'LIGHT_ON': phrase = "Light turned on"; break;
            case 'LIGHT_OFF': phrase = "Light turned off"; break;
            case 'FAN_ON': phrase = "Fan activated"; break;
            case 'FAN_OFF': phrase = "Fan stopped"; break;
            case 'MOTOR_ON': phrase = "Motor started"; break;
            case 'MOTOR_OFF': phrase = "Motor stopped"; break;
            case 'AC_ON': phrase = "Air conditioning engaged"; break;
            case 'AC_OFF': phrase = "Air conditioning turned off"; break;
            case 'TV_ON': phrase = "Television turned on"; break;
            case 'TV_OFF': phrase = "Television turned off"; break;
            case 'HEATER_ON': phrase = "Heater engaged"; break;
            case 'HEATER_OFF': phrase = "Heater turned off"; break;
            case 'NIGHT_LAMP_ON': phrase = "Night lamp turned on"; break;
            case 'NIGHT_LAMP_OFF': phrase = "Night lamp turned off"; break;
            case 'DOOR_LOCK': phrase = "Perimeter door secured and locked"; break;
            case 'DOOR_UNLOCK': phrase = "Main door unlocked"; break;
            case 'CURTAINS_OPEN': phrase = "Curtains opened"; break;
            case 'CURTAINS_CLOSE': phrase = "Curtains closed"; break;
            case 'MUSIC_ON': phrase = "Audio system online"; break;
            case 'MUSIC_OFF': phrase = "Audio system stopped"; break;
            case 'ALL_ON': phrase = "Everything is on"; break;
            case 'ALL_OFF': phrase = "Everything is off"; break;
            case 'STATUS':
              phrase = this.generateNaturalStatusSentence(res.state);
              break;
            default:
              phrase = "Command acknowledged.";
              break;
          }

          VoiceEngine.speak(phrase);
          this.setSubtitles(phrase);
        },

        generateNaturalStatusSentence(s) {
          const onItems = [];
          if (s.LIGHT) onItems.push("the light");
          if (s.FAN) onItems.push("the fan");
          if (s.MOTOR) onItems.push("the motor");
          if (s.AC) onItems.push("the air conditioner");
          if (s.TV) onItems.push("the television");
          if (s.HEATER) onItems.push("the heater");
          if (s.NIGHT_LAMP) onItems.push("the night lamp");
          if (s.MUSIC) onItems.push("the music speaker");
          if (s.CURTAINS) onItems.push("the curtains are open");
          if (s.DOOR) onItems.push("the door is unlocked");

          if (onItems.length === 0) {
            return `All appliances are currently powered down, and the perimeter is fully secured, ${Personality.userName || 'sir'}.`;
          }

          if (onItems.length === 1) {
            return `Currently, only ${onItems[0]} is active. Everything else is turned off.`;
          }

          const last = onItems.pop();
          return `Currently, ${onItems.join(', ')} and ${last} are active, ${Personality.userName || 'sir'}.`;
        },

        async executeScene(scene) {
          if (scene === 'MOVIE') {
            const narr = `Setting the scene for cinema, ${Personality.userName || 'sir'}. Lights off, night lamp on, curtains closed, TV and AC online. Enjoy the film.`;
            VoiceEngine.speak(narr);
            this.setSubtitles(narr);
            await this.executeCommandQueue(['LIGHT_OFF', 'NIGHT_LAMP_ON', 'CURTAINS_CLOSE', 'TV_ON', 'AC_ON'], 'Movie Mode Scene');
          } else if (scene === 'PARTY') {
            const narr = "Party mode initialized! Audio system cranked up, lights active. Let's make some noise.";
            VoiceEngine.speak(narr);
            this.setSubtitles(narr);
            document.body.classList.add('party-mode-active');
            setTimeout(() => document.body.classList.remove('party-mode-active'), 8000);
            await this.executeCommandQueue(['MUSIC_ON', 'LIGHT_ON'], 'Party Mode Scene');
          } else if (scene === 'WAKE_UP') {
            const now = new Date();
            const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
            const narr = `Rise and shine, ${Personality.userName || 'sir'}! Today is ${dateStr}. Opening curtains and engaging lights. Ready for a brilliant day.`;
            VoiceEngine.speak(narr);
            this.setSubtitles(narr);
            await this.executeCommandQueue(['CURTAINS_OPEN', 'LIGHT_ON'], 'Wake Up Scene');
          }
        },

        async runGoodNightSequence() {
          const narr = `Securing the house for the night, ${Personality.userName || 'sir'}. Locking door, shutting down active appliances, and leaving the night lamp on. Sleep well.`;
          VoiceEngine.speak(narr);
          this.setSubtitles(narr);
          await this.executeCommandQueue(['ALL_OFF', 'DOOR_LOCK', 'NIGHT_LAMP_ON'], 'Good Night Scene');
        },

        async runImHomeSequence() {
          const narr = `Welcome home, ${Personality.userName || 'sir'}! Main entrance unlocked, lights illuminated, and fan activated. Great to have you back.`;
          VoiceEngine.speak(narr);
          this.setSubtitles(narr);
          await this.executeCommandQueue(['DOOR_UNLOCK', 'LIGHT_ON', 'FAN_ON'], "I'm Home Scene");
        },

        setSubtitles(text) {
          clearInterval(this.typingInterval);
          this.subtitlesContent.textContent = '';
          let i = 0;
          this.typingInterval = setInterval(() => {
            if (i < text.length) {
              this.subtitlesContent.textContent += text.charAt(i);
              i++;
            } else {
              clearInterval(this.typingInterval);
            }
          }, 22);
        },

        setReactorSpeaking(isSpeaking) {
          if (isSpeaking) {
            this.reactorContainer.classList.add('speaking');
          } else {
            this.reactorContainer.classList.remove('speaking');
          }
        },

        appendLogEntry(heard, cmd, reply, latency, statusClass) {
          const now = new Date();
          const timeStr = now.toTimeString().split(' ')[0] + '.' + String(now.getMilliseconds()).padStart(3, '0');

          const div = document.createElement('div');
          div.className = `log-entry ${statusClass}`;
          div.innerHTML = `
            <div class="log-time">[${timeStr}] HEARD: <span class="log-heard">"${heard}"</span></div>
            <div>CMD: <span class="log-cmd">${cmd}</span> &rarr; <span class="log-reply">${reply}</span> <span class="log-lat">${latency !== null ? `(${latency} ms)` : ''}</span></div>
          `;
          this.logFeed.appendChild(div);
          this.logFeed.scrollTop = this.logFeed.scrollHeight;
          this.logCounter.textContent = `${Logger.logs.length} ENTRIES`;
        },

        updateTelemetry(latestLatency) {
          const stats = Logger.getStats();
          this.statTotalCmds.textContent = stats.total;
          this.statSuccessRate.textContent = `${stats.rate}%`;
          this.statAvgLatency.textContent = `${stats.avg} ms`;

          if (latestLatency !== null) {
            this.latestLatencyBadge.textContent = `${latestLatency} MS`;
          } else {
            this.latestLatencyBadge.textContent = `NO REPLY`;
          }

          this.drawLatencyChart();
        },

        drawLatencyChart() {
          const ctx = this.chartCtx;
          const canvas = this.latencyCanvas;
          const w = canvas.width;
          const h = canvas.height;
          const history = Logger.latencyHistory;

          ctx.clearRect(0, 0, w, h);

          ctx.strokeStyle = 'rgba(0, 229, 255, 0.08)';
          ctx.lineWidth = 1;
          for (let y = 0; y < h; y += h / 3) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(w, y);
            ctx.stroke();
          }

          if (history.length < 2) {
            ctx.strokeStyle = 'rgba(0, 229, 255, 0.25)';
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(0, h * 0.5);
            ctx.lineTo(w, h * 0.5);
            ctx.stroke();
            ctx.setLineDash([]);
            return;
          }

          const maxVal = Math.max(70, ...history);
          const minVal = Math.min(15, ...history);
          const stepX = w / (history.length - 1);

          ctx.beginPath();
          history.forEach((val, i) => {
            const x = i * stepX;
            const norm = (val - minVal) / (maxVal - minVal || 1);
            const y = h - 10 - norm * (h - 20);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          });

          ctx.strokeStyle = '#00e5ff';
          ctx.lineWidth = 2 * (window.devicePixelRatio || 1);
          ctx.shadowColor = '#00e5ff';
          ctx.shadowBlur = 8;
          ctx.stroke();
          ctx.shadowBlur = 0;

          history.forEach((val, i) => {
            const x = i * stepX;
            const norm = (val - minVal) / (maxVal - minVal || 1);
            const y = h - 10 - norm * (h - 20);
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(x, y, 2.5 * (window.devicePixelRatio || 1), 0, Math.PI * 2);
            ctx.fill();
          });
        },

        startWaveformAnimation() {
          let phase = 0;
          const draw = () => {
            const ctx = this.visCtx;
            const canvas = this.visualizerCanvas;
            const w = canvas.width;
            const h = canvas.height;

            ctx.clearRect(0, 0, w, h);

            const isSpeaking = VoiceEngine.isSpeaking;
            const isMicActive = VoiceEngine.isListening;
            const mid = h / 2;

            let amplitude = 2.0;
            let speed = 0.03;

            if (isSpeaking) {
              amplitude = h * 0.38;
              speed = 0.18;
            } else if (isMicActive) {
              amplitude = h * 0.28;
              speed = 0.12;
            }

            phase += speed;

            ctx.beginPath();
            ctx.lineWidth = 2 * (window.devicePixelRatio || 1);
            ctx.strokeStyle = isSpeaking ? '#ffffff' : (isMicActive ? '#00e5ff' : 'rgba(0, 229, 255, 0.35)');
            ctx.shadowColor = isSpeaking ? '#00e5ff' : (isMicActive ? '#00e5ff' : 'transparent');
            ctx.shadowBlur = (isSpeaking || isMicActive) ? 14 : 0;

            for (let x = 0; x < w; x++) {
              const freq = (isSpeaking || isMicActive) ? 0.04 : 0.015;
              const y = mid + Math.sin(x * freq + phase) * amplitude * Math.sin(x / w * Math.PI);
              if (x === 0) ctx.moveTo(x, y);
              else ctx.lineTo(x, y);
            }
            ctx.stroke();

            if (isSpeaking || isMicActive) {
              ctx.beginPath();
              ctx.lineWidth = 1 * (window.devicePixelRatio || 1);
              ctx.strokeStyle = isSpeaking ? '#00e5ff' : '#00ff9d';
              ctx.shadowColor = ctx.strokeStyle;
              ctx.shadowBlur = 8;
              for (let x = 0; x < w; x++) {
                const y = mid + Math.sin(x * 0.07 - phase * 1.3) * (amplitude * 0.65) * Math.sin(x / w * Math.PI);
                if (x === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
              }
              ctx.stroke();
            }

            ctx.shadowBlur = 0;
            this.animFrameId = requestAnimationFrame(draw);
          };
          this.animFrameId = requestAnimationFrame(draw);
        },

        setDirective(main, detail) {
          this.directiveMain.textContent = main;
          this.directiveDetail.textContent = detail;
        }
      };

      document.addEventListener('DOMContentLoaded', () => {
        UI.init();
      });

    })();