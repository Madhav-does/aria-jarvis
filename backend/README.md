# J.A.R.V.I.S. // A.R.I.A Backend Server

Node.js, Express, WebSocket, and SerialPort controller for the A.R.I.A voice assistant and hardware simulation system.

---

## Features

- **Dual Operating Modes**:
  - `simulation` (default): Emulates an Arduino Uno with 10 home appliances, temperature simulation (AC/Heater thermal drift), random 20–60ms serial latency, and state persistence.
  - `hardware`: Auto-detects physical Arduino Uno (via FTDI / CH340 / USB Serial) at 9600 baud, waits 2 seconds for bootloader reset, sends newline-terminated commands, and bridges real hardware pins (`LIGHT_ON`, `LIGHT_OFF`, `MOTOR_ON`, `MOTOR_OFF`, `ALL_ON`, `ALL_OFF`, `STATUS`) while simulating extended appliances in software.
- **RESTful Endpoints**:
  - `POST /api/command`: Dispatches commands with whitelist verification, latency calculation, and state return.
  - `GET /api/status`: Returns current states and active runtime mode.
  - `GET /api/logs`: Returns historical logs stored in SQLite.
  - `GET /api/export.csv`: Exports timestamped telemetry in CSV format.
  - `GET /api/health`: Healthcheck, connection status, and port diagnostics.
- **Live WebSocket Synchronisation (`/ws`)**:
  - Pushes instantaneous updates whenever appliances change state or logs are generated.
- **Robust Security**:
  - Restricted command whitelist.
  - API Token enforcement via `x-api-key` header.
  - High-security confirmation flag (`"confirmed": true`) required for safety-critical actions (`DOOR_UNLOCK`, `ALL_ON`).
  - Rate limiting (60 requests/minute per IP) and Helmet HTTP security headers.
  - SQLite logging (`backend/data/logs.db`) using native Node.js SQLite with WAL mode.

---

## Installation & Setup

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
2. Configure your environment variables:
   - `PORT=3000`
   - `MODE=simulation` (or `hardware`)
   - `API_KEY=your_secure_token`
   - `ARDUINO_PORT=COM3` (optional override; auto-detects if omitted)
   - `ALLOWED_ORIGINS=*`
3. Install dependencies:
   ```bash
   npm install
   ```
4. Start server:
   ```bash
   npm start
   ```
   Or run in development mode with auto-reload:
   ```bash
   npm run dev
   ```
