# J.A.R.V.I.S. // A.R.I.A Voice Assistant & Hardware Integration

> **Advanced Responsive Intelligent Assistant (A.R.I.A)** — Inspired by Tony Stark's J.A.R.V.I.S., engineered with a sci-fi holographic HUD, conversational voice synthesis, simulated/physical Arduino Uno dual-mode serial control, low-voltage relay automation, telemetry logging, and cross-platform Android mobile deployment.

[![Direct APK Download](https://img.shields.io/badge/Download_APK-v1.0.0_Ready-00e5ff?style=for-the-badge&logo=android&logoColor=black)](https://github.com/Madhav-does/aria-jarvis/releases/download/v1.0.0/jarvis-aria-v1.0.0.apk)
[![Live Web Demo](https://img.shields.io/badge/Vercel_Live_Demo-Online-00ff88?style=for-the-badge&logo=vercel&logoColor=black)](https://www-blue-ten.vercel.app)
[![GitHub Release](https://img.shields.io/github/v/release/Madhav-does/aria-jarvis?style=for-the-badge&color=1ea8ff)](https://github.com/Madhav-does/aria-jarvis/releases/latest)

> 📲 **Direct Mobile Download:** [**Download `jarvis-aria-v1.0.0.apk`**](https://github.com/Madhav-does/aria-jarvis/releases/download/v1.0.0/jarvis-aria-v1.0.0.apk) *(~4.1 MB)*  
> 🌐 **Live Web Application (Vercel):** [**https://www-blue-ten.vercel.app**](https://www-blue-ten.vercel.app)

---

## 1. System Architecture

```text
       +-------------------------------------------------------------+
       |                  CLIENT / USER INTERFACE                     |
       |                                                             |
       |   Desktop Web HUD (Chrome/Edge)   OR   Android Native APK   |
       |   - Holographic Arc-Reactor HUD        - Landscape Lock     |
       |   - British Male Vocal Synthesis       - Native Mic & TTS   |
       |   - Natural Keyword Speech Parser      - Wi-Fi LAN Sync     |
       +------------------------------+------------------------------+
                                      |
                     HTTP REST / JSON | WebSocket (/ws)
                  (x-api-key guarded) | (Live Push Events)
                                      v
       +-------------------------------------------------------------+
       |                  NODE.JS BACKEND RUNTIME                    |
       |                                                             |
       |   Express REST API + Rate Limiter (60 req/min) + Helmet     |
       |   Node.js Synchronous SQLite Engine (logs.db with WAL)      |
       |   Safety Confirmation Guard: DOOR_UNLOCK & ALL_ON           |
       +------------------------------+------------------------------+
                                      |
                      MODE Selection in backend/.env
             +------------------------+------------------------+
             |                                                 |
             v [MODE=simulation]                               v [MODE=hardware]
+---------------------------+              +-------------------------------------+
| SOFTWARE ARDUINO EMULATOR |              |  NODE SERIALPORT DRIVER (9600 BAUD) |
| - 10 Automated Appliances |              |  Auto-detects FTDI / CH340 / Uno    |
| - 20–60 ms Latency Jitter |              +------------------+------------------+
| - Thermodynamic Sim       |                                 | USB Serial Cable
|   (AC / Geyser Drift)     |                                 v
+---------------------------+              +-------------------------------------+
                                           |      PHYSICAL ARDUINO UNO R3        |
                                           |  D7 -> Relay 1 (LED Bulb / Lamp)    |
                                           |  D8 -> Relay 2 (9V DC Fan / Motor)  |
                                           +-------------------------------------+
```

---

## 2. Key Features

- **Iron Man Holographic HUD Interface**:
  - Deep space navy backdrop (`#02070d`), electric cyan luminescence (`#00e5ff`), active arc reactor with audio-synced pulsating wave ring, interactive real-time telemetry meters, and live CRT scanline overlays.
- **Vocal Personality & Conversational Dynamics**:
  - British male vocal synthesis (`UK English Male`, `Daniel`, `George`), dynamic pitch and cadence modulation, time-aware greetings, proactive suggestions, and context memory (tracks user name, last toggled appliance, and interaction count).
  - Context-aware small talk and safety confirmation state machine for sensitive actions (`DOOR_UNLOCK`, `ALL_ON`).
- **10 Holographic Home Appliances**:
  - **Light** (Pin D7): Primary illumination relay.
  - **Motor** (Pin D8): 9V DC magnetic inductive motor.
  - **Fan** (Pin D9): Dynamic blade rotation with speed acceleration.
  - **Air Conditioner** (Pin D10): Thermodynamic cooling simulation drifting down to 22°C.
  - **Television** (Pin D11): Holographic scanline signal distortion.
  - **Heater / Geyser** (Pin D12): Thermodynamic thermal curve heating up to 55°C.
  - **Night Lamp** (Pin D6): Warm amber incandescent glow.
  - **Door Lock** (Pin D5): High-security biometric solenoid mechanism with confirmation safeguards.
  - **Curtains**: Smooth spatial motor-actuated drapery curtains.
  - **Audio Matrix**: Ambient cybernetic background audio stream.
- **Dual Runtime Operational Modes**:
  - **Simulation Mode**: Self-contained zero-hardware testing with virtual serial delays, latency tracking, thermal simulation, and fault injection (timeout and acoustic noise generator).
  - **Hardware Mode**: Production bridging to physical Arduino Uno over USB Serial at 9600 baud, auto-reconnecting on disconnect with a 2-second bootloader reset buffer.
- **Security & Data Governance**:
  - Restricted command whitelist, `x-api-key` header verification, IP rate limiting, zero plain text exposure, and synchronous SQLite database logging with CSV analytics export.
- **Cross-Platform Mobile Integration (Capacitor Android)**:
  - Packaged native Android application locked to landscape HUD view, cleartext local LAN networking for home Wi-Fi routing, and native speech plugins (`@capacitor-community/speech-recognition` and `@capacitor-community/text-to-speech`).

---

## 3. Serial Protocol & Hardware Specification

Commands sent to the Arduino Uno must be newline-terminated (`\n`). The microcontroller processes the string and returns an acknowledgment string within 20–60 milliseconds.

| Command | Target Pin | Hardware Action | Arduino Response |
| :--- | :--- | :--- | :--- |
| `LIGHT_ON` | Digital Pin 7 | Energize Relay 1 (LED Bulb ON) | `ACK:LIGHT_ON` |
| `LIGHT_OFF` | Digital Pin 7 | De-energize Relay 1 (LED Bulb OFF) | `ACK:LIGHT_OFF` |
| `MOTOR_ON` | Digital Pin 8 | Energize Relay 2 (9V DC Motor ON) | `ACK:MOTOR_ON` |
| `MOTOR_OFF` | Digital Pin 8 | De-energize Relay 2 (9V DC Motor OFF) | `ACK:MOTOR_OFF` |
| `ALL_ON` | D7 & D8 | Energize All Relays | `ACK:ALL_ON` |
| `ALL_OFF` | D7 & D8 | De-energize All Relays | `ACK:ALL_OFF` |
| `STATUS` | Query | Reads Pin States | `STATUS light=ON motor=OFF` |

*Extended appliances (Fan D9, AC D10, TV D11, Heater D12, Night Lamp D6, Door D5, Curtains, Music) operate seamlessly through the backend software simulator bridge while routing physical D7 and D8 pins to the real Uno.*

---

## 4. Quickstart Guide

### Option A: Simulation Mode (Zero Hardware Required)

1. **Launch Backend**:
   ```bash
   cd backend
   cp .env.example .env
   npm install
   npm start
   ```
   *The backend starts at `http://localhost:3000` with `MODE=simulation`.*

2. **Launch HUD Frontend**:
   - Open `frontend/www/index.html` in your browser (Chrome or Edge recommended).
   - Click the glowing **INITIALIZE J.A.R.V.I.S.** arc reactor to unlock Web Audio subroutines.
   - Speak or type voice commands: *"Turn on the light"*, *"Status"*, *"Turn on the fan"*.

---

### Option B: Hardware Mode (Real Arduino Uno)

1. Connect your **Arduino Uno** via USB.
2. Flash the Arduino sketch with 9600 baud serial listener for pins D7 and D8.
3. Configure `backend/.env`:
   ```ini
   PORT=3000
   MODE=hardware
   API_KEY=jarvis_secure_token_8899
   # ARDUINO_PORT=COM3  # Optional: auto-detects if left blank
   ```
4. Start the backend:
   ```bash
   cd backend
   npm start
   ```
5. In the Frontend Settings panel (⚙️), ensure Backend URL is `http://localhost:3000` and click **Test Connection**. The top bar chip will turn green (`HARDWARE`).

---

## 5. Android Mobile App Build

The Android application is powered by Capacitor, allowing control over local Wi-Fi from your smartphone.

### Prerequisites
- Node.js 18+
- Java Development Kit (JDK 17)
- Android SDK (`build-tools` 34+ or 35+)

### Local Build Steps
1. Install dependencies in the project root:
   ```bash
   npm install
   ```
2. Sync web assets:
   ```bash
   npx cap sync android
   ```
3. Assemble the debug APK:
   - **Windows**:
     ```cmd
     cd android
     gradlew.bat assembleDebug
     ```
   - **macOS / Linux**:
     ```bash
     cd android
     ./gradlew assembleDebug
     ```
4. The generated APK will be at:
   ```
   android/app/build/outputs/apk/debug/app-debug.apk
   ```

### Connecting Phone to Backend
1. Ensure your smartphone and laptop are connected to the same Wi-Fi network.
2. Find your laptop's local LAN IP address (e.g. `192.168.1.45`).
3. Open the J.A.R.V.I.S. app on your phone, open Settings (⚙️), and set **Backend URL** to `http://192.168.1.45:3000`.
4. Tap **Test Connection** — the status chip will switch to green `BACKEND SYNC`.

---

## 6. Safety Notice: Low-Voltage Relay Operation

> [!WARNING]
> **Electrical Safety Warning**
>
> 1. **Bench Testing Protocol**: When testing the physical Arduino Uno and relay modules, use **strictly low-voltage DC power sources** (such as 5V–12V DC batteries, USB power, or low-voltage DC LED strips and 9V DC hobby motors).
> 2. **Mains Electricity Precaution**: **Never connect mains AC electricity (110V–240V AC)** to relay terminals on an open breadboard or uninsulated workbench. High-voltage alternating current carries severe risks of electric shock, electrocution, short-circuits, and electrical fires.
> 3. **Isolation & Enclosure**: If interfacing with mains appliances in a permanent installation, work exclusively with certified optocoupler-isolated relays, enclosed DIN-rail modules, proper fuses, and have the circuitry inspected by a licensed electrician.
