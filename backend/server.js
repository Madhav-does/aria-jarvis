'use strict';

require('dotenv').config();
const path = require('path');
const http = require('http');
const express = require('express');
const { WebSocketServer } = require('ws');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
let Database;
try {
  Database = require('better-sqlite3');
} catch {
  // Built-in SQLite in Node 22+ (DatabaseSync)
  const { DatabaseSync } = require('node:sqlite');
  Database = class {
    constructor(file) {
      this.db = new DatabaseSync(file);
    }
    pragma(query) {
      try { this.db.exec(`PRAGMA ${query};`); } catch (e) {}
    }
    exec(sql) {
      return this.db.exec(sql);
    }
    prepare(sql) {
      const stmt = this.db.prepare(sql);
      return {
        run: (...args) => stmt.run(...args),
        all: (...args) => stmt.all(...args),
        get: (...args) => stmt.get(...args)
      };
    }
  };
}
const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const simulator = require('./simulator');

const PORT = parseInt(process.env.PORT, 10) || 3000;
const MODE = (process.env.MODE || 'simulation').toLowerCase();
const API_KEY = process.env.API_KEY || 'jarvis_secure_token_8899';
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS || '*';

// Whitelist of valid hardware / simulated serial commands
const ALLOWED_COMMANDS = new Set([
  'LIGHT_ON', 'LIGHT_OFF',
  'MOTOR_ON', 'MOTOR_OFF',
  'FAN_ON', 'FAN_OFF',
  'AC_ON', 'AC_OFF',
  'TV_ON', 'TV_OFF',
  'HEATER_ON', 'HEATER_OFF',
  'NIGHT_LAMP_ON', 'NIGHT_LAMP_OFF',
  'DOOR_LOCK', 'DOOR_UNLOCK',
  'CURTAINS_OPEN', 'CURTAINS_CLOSE',
  'MUSIC_ON', 'MUSIC_OFF',
  'ALL_ON', 'ALL_OFF',
  'STATUS'
]);

// Real Arduino Uno sketch only accepts these 7 commands
const REAL_ARDUINO_COMMANDS = new Set([
  'LIGHT_ON', 'LIGHT_OFF',
  'MOTOR_ON', 'MOTOR_OFF',
  'ALL_ON', 'ALL_OFF',
  'STATUS'
]);

// ---------------------------------------------------------------------------
// 1. DATABASE SETUP (SQLite)
// ---------------------------------------------------------------------------
const dbPath = path.join(__dirname, 'data', 'logs.db');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS command_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL,
    heard_text TEXT,
    command TEXT NOT NULL,
    ack_received TEXT NOT NULL,
    latency_ms REAL,
    client_ip TEXT
  )
`);

const insertLogStmt = db.prepare(`
  INSERT INTO command_logs (timestamp, heard_text, command, ack_received, latency_ms, client_ip)
  VALUES (@timestamp, @heard_text, @command, @ack_received, @latency_ms, @client_ip)
`);

const getRecentLogsStmt = db.prepare(`
  SELECT timestamp, heard_text, command, ack_received, latency_ms, client_ip
  FROM command_logs
  ORDER BY id DESC
  LIMIT ?
`);

const getAllLogsForCsvStmt = db.prepare(`
  SELECT timestamp, heard_text, command, ack_received, latency_ms
  FROM command_logs
  ORDER BY id ASC
`);

// ---------------------------------------------------------------------------
// 2. HARDWARE SERIAL LINK MANAGER (Arduino Uno auto-detect & auto-reconnect)
// ---------------------------------------------------------------------------
let realSerialPort = null;
let serialParser = null;
let arduinoConnected = false;
let serialReady = false;
let activeSerialPending = null; // { resolve, reject, command, t0, timer }

async function detectAndConnectArduino() {
  if (MODE !== 'hardware') return;

  try {
    const ports = await SerialPort.list();
    let targetPort = process.env.ARDUINO_PORT;

    if (!targetPort) {
      const match = ports.find(p => {
        const desc = `${p.manufacturer || ''} ${p.friendlyName || ''} ${p.description || ''}`.toLowerCase();
        return desc.includes('arduino') || desc.includes('ch340') || desc.includes('usb serial');
      });
      if (match) targetPort = match.path;
    }

    if (!targetPort) {
      console.log('[HARDWARE MODE] No Arduino detected on USB ports. Retrying in 5 seconds...');
      arduinoConnected = false;
      setTimeout(detectAndConnectArduino, 5000);
      return;
    }

    console.log(`[HARDWARE MODE] Opening Arduino link on ${targetPort} @ 9600 baud...`);
    realSerialPort = new SerialPort({
      path: targetPort,
      baudRate: parseInt(process.env.ARDUINO_BAUD, 10) || 9600,
      autoOpen: true
    });

    serialParser = realSerialPort.pipe(new ReadlineParser({ delimiter: '\r\n' }));

    realSerialPort.on('open', () => {
      console.log(`[HARDWARE MODE] Port ${targetPort} opened. Waiting 2.0s for Arduino Uno boot reset...`);
      arduinoConnected = true;
      setTimeout(() => {
        serialReady = true;
        console.log('[HARDWARE MODE] Arduino Uno is READY for serial directives.');
        broadcast({ type: 'HARDWARE_STATUS', arduinoConnected: true, port: targetPort });
      }, 2000);
    });

    serialParser.on('data', (line) => {
      const clean = line.trim();
      console.log(`[SERIAL RX] <- ${clean}`);

      if (activeSerialPending) {
        clearTimeout(activeSerialPending.timer);
        const latency = parseFloat((performance.now() - activeSerialPending.t0).toFixed(1));
        const res = { reply: clean, latency };
        const resolve = activeSerialPending.resolve;
        activeSerialPending = null;
        resolve(res);
      }
    });

    realSerialPort.on('error', (err) => {
      console.error('[HARDWARE ERROR]', err.message);
      handleSerialDisconnect();
    });

    realSerialPort.on('close', () => {
      console.warn('[HARDWARE MODE] Arduino serial link disconnected.');
      handleSerialDisconnect();
    });

  } catch (err) {
    console.error('[HARDWARE MODE] Error during connection setup:', err.message);
    handleSerialDisconnect();
  }
}

function handleSerialDisconnect() {
  arduinoConnected = false;
  serialReady = false;
  if (activeSerialPending) {
    clearTimeout(activeSerialPending.timer);
    activeSerialPending.reject(new Error("SERIAL_DISCONNECTED"));
    activeSerialPending = null;
  }
  broadcast({ type: 'HARDWARE_STATUS', arduinoConnected: false, port: null });
  setTimeout(detectAndConnectArduino, 5000);
}

function sendToRealArduino(cmd) {
  return new Promise((resolve, reject) => {
    if (!realSerialPort || !serialReady || !arduinoConnected) {
      return reject(new Error("ARDUINO_NOT_CONNECTED"));
    }

    const t0 = performance.now();
    const timer = setTimeout(() => {
      if (activeSerialPending) {
        activeSerialPending = null;
        reject(new Error("TIMEOUT_NO_REPLY"));
      }
    }, 1200);

    activeSerialPending = { resolve, reject, command: cmd, t0, timer };
    console.log(`[SERIAL TX] -> ${cmd}`);
    realSerialPort.write(`${cmd}\n`, (err) => {
      if (err) {
        clearTimeout(timer);
        activeSerialPending = null;
        reject(err);
      }
    });
  });
}

// ---------------------------------------------------------------------------
// 3. EXPRESS APP & SECURITY MIDDLEWARE
// ---------------------------------------------------------------------------
const app = express();
const server = http.createServer(app);

app.set('trust proxy', 1);

// Security Headers
app.use(helmet({
  contentSecurityPolicy: false // Allow HUD inline graphics and scripts
}));

// CORS Configuration
const allowedOriginsList = ALLOWED_ORIGINS === '*'
  ? '*'
  : ALLOWED_ORIGINS.split(',').map(s => s.trim());

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOriginsList === '*' || allowedOriginsList.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Blocked by CORS policy'));
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'x-api-key', 'Authorization']
}));

// Rate Limiting (60 requests per minute)
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Rate limit is 60 requests per minute.' }
});
app.use('/api/', limiter);

app.use(express.json());

// API Key Verification Middleware
function requireApiKey(req, res, next) {
  const token = req.headers['x-api-key'] || req.query.apiKey;
  if (!token || token !== API_KEY) {
    return res.status(401).json({ error: 'Unauthorized: Invalid or missing x-api-key header.' });
  }
  next();
}

// ---------------------------------------------------------------------------
// 4. WEBSOCKET SERVER (/ws)
// ---------------------------------------------------------------------------
const wss = new WebSocketServer({ server, path: '/ws' });

function broadcast(payload) {
  const message = JSON.stringify(payload);
  wss.clients.forEach(client => {
    if (client.readyState === 1) { // OPEN
      client.send(message);
    }
  });
}

wss.on('connection', (ws, req) => {
  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  console.log(`[WS] Client connected from ${clientIp}`);

  // Push current state and mode on initial handshake
  const currentState = simulator.getState();
  ws.send(JSON.stringify({
    type: 'INIT',
    mode: MODE,
    arduinoConnected: MODE === 'hardware' ? arduinoConnected : true,
    state: currentState
  }));

  ws.on('error', console.error);
});

// ---------------------------------------------------------------------------
// 5. REST API ENDPOINTS
// ---------------------------------------------------------------------------

// POST /api/command
app.post('/api/command', requireApiKey, async (req, res) => {
  const { command, heard_text = '', confirmed = false } = req.body;
  const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1';

  // 1. Whitelist validation (never execute arbitrary user text)
  if (!command || !ALLOWED_COMMANDS.has(command)) {
    return res.status(400).json({ error: `Command not allowed. Must be one of: ${Array.from(ALLOWED_COMMANDS).join(', ')}` });
  }

  // 2. High-security confirmation check for Door Unlock and All On
  if ((command === 'DOOR_UNLOCK' || command === 'ALL_ON') && confirmed !== true) {
    return res.status(400).json({
      error: `Confirmation required: ${command} necessitates 'confirmed: true' in request payload.`
    });
  }

  const t0 = performance.now();
  let reply = "";
  let latencyMs = 0;
  let state = {};

  try {
    if (MODE === 'hardware' && REAL_ARDUINO_COMMANDS.has(command)) {
      // Send directly to physical Arduino Uno
      const hwRes = await sendToRealArduino(command);
      reply = hwRes.reply;
      latencyMs = hwRes.latency;

      // Also sync simulated mirror state
      const simRes = await simulator.send(command);
      state = simRes.state;
    } else {
      // Execute through simulator
      const simRes = await simulator.send(command);
      reply = simRes.reply;
      state = simRes.state;
      latencyMs = parseFloat((performance.now() - t0).toFixed(1));
    }

    // Save to SQLite
    const now = new Date();
    const timestamp = now.toTimeString().split(' ')[0] + '.' + String(now.getMilliseconds()).padStart(3, '0');

    insertLogStmt.run({
      timestamp,
      heard_text,
      command,
      ack_received: reply,
      latency_ms: latencyMs,
      client_ip: clientIp
    });

    const responsePayload = {
      command,
      ack: reply,
      latencyMs,
      state
    };

    // Broadcast update to all WebSocket clients
    broadcast({
      type: 'COMMAND_ACK',
      command,
      ack: reply,
      latencyMs,
      state,
      timestamp,
      heard_text
    });

    return res.json(responsePayload);

  } catch (err) {
    console.error(`[COMMAND ERROR] ${command}:`, err.message);
    const latency = parseFloat((performance.now() - t0).toFixed(1));

    // Log failure
    const now = new Date();
    const timestamp = now.toTimeString().split(' ')[0] + '.' + String(now.getMilliseconds()).padStart(3, '0');

    insertLogStmt.run({
      timestamp,
      heard_text,
      command,
      ack_received: 'TIMEOUT_NO_REPLY',
      latency_ms: latency,
      client_ip: clientIp
    });

    broadcast({
      type: 'COMMAND_ERROR',
      command,
      error: err.message,
      timestamp
    });

    return res.status(504).json({
      error: "Arduino did not reply or serial timeout",
      command,
      latencyMs: latency
    });
  }
});

// GET /api/status
app.get('/api/status', (req, res) => {
  res.json({
    mode: MODE,
    arduinoConnected: MODE === 'hardware' ? arduinoConnected : true,
    state: simulator.getState()
  });
});

// GET /api/logs?limit=100
app.get('/api/logs', requireApiKey, (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
  const rows = getRecentLogsStmt.all(limit);
  res.json({ logs: rows });
});

// GET /api/export.csv
app.get('/api/export.csv', (req, res) => {
  const rows = getAllLogsForCsvStmt.all();
  let csv = 'timestamp,heard_text,command,ack_received,latency_ms\n';

  rows.forEach(r => {
    const esc = (val) => `"${String(val || '').replace(/"/g, '""')}"`;
    csv += `${esc(r.timestamp)},${esc(r.heard_text)},${esc(r.command)},${esc(r.ack_received)},${r.latency_ms}\n`;
  });

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="command_log.csv"');
  res.send(csv);
});

// GET /api/health
app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    mode: MODE,
    arduinoConnected: MODE === 'hardware' ? arduinoConnected : true,
    port: (realSerialPort && realSerialPort.path) || null,
    timestamp: new Date().toISOString()
  });
});

// Serve frontend static assets as fallback
app.use(express.static(path.join(__dirname, '..', 'frontend', 'www')));

// ---------------------------------------------------------------------------
// 6. SERVER INITIALIZATION
// ---------------------------------------------------------------------------
server.listen(PORT, '0.0.0.0', () => {
  console.log(`=======================================================`);
  console.log(`  J.A.R.V.I.S. // A.R.I.A BACKEND SERVER ONLINE`);
  console.log(`  Mode:           ${MODE.toUpperCase()}`);
  console.log(`  HTTP Endpoint:  http://localhost:${PORT}`);
  console.log(`  WebSocket:      ws://localhost:${PORT}/ws`);
  console.log(`  API Security:   x-api-key enforced`);
  console.log(`=======================================================`);

  if (MODE === 'hardware') {
    detectAndConnectArduino();
  }
});
