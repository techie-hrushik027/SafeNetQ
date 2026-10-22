require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mqtt = require('mqtt');
const mysql = require('mysql2');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

let db = null;
let databaseConnected = false;
let databaseRetryTimer = null;
function connectDatabase() {
    if (databaseRetryTimer) {
        clearTimeout(databaseRetryTimer);
        databaseRetryTimer = null;
    }
    db = mysql.createConnection({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASS,
        database: process.env.DB_NAME || 'safenetq_db'
    });
    db.connect((err) => {
        if (err) {
            databaseConnected = false;
            console.error('MySQL unavailable; live telemetry will continue without fault history:', err.message);
            databaseRetryTimer = setTimeout(connectDatabase, 5000);
            return;
        }
        databaseConnected = true;
        console.log('MySQL connected to safenetq_db');
    });
    db.on('error', (err) => {
        console.error('MySQL connection error:', err.message);
        if (err.fatal) {
            databaseConnected = false;
            if (!databaseRetryTimer) databaseRetryTimer = setTimeout(connectDatabase, 5000);
        }
    });
}
connectDatabase();

const TELEMETRY_TOPIC = process.env.MQTT_TOPIC || 'safenetq/telemetry/v1';
const COMMAND_TOPIC = process.env.MQTT_COMMAND_TOPIC || 'safenetq/command/v1';
const mqttClient = mqtt.connect(process.env.MQTT_BROKER_URL || 'mqtt://broker.hivemq.com:1883');
let latestTelemetry = null;
let activeFaultSignature = null;
let lastFaultAttemptSignature = null;
let lastFaultAttemptAt = 0;
let previousDetectorState = null;
let previousTripReason = 'NONE';
let previousRelayState = null;
let deviceMessageSequence = 0;

function numberFrom(...candidates) {
    for (const value of candidates) {
        if (value === null || value === undefined || value === '') continue;
        const parsed = Number(value);
        if (Number.isFinite(parsed)) return parsed;
    }
    return null;
}

function getTelemetry(payload) {
    return payload.telemetry && typeof payload.telemetry === 'object' ? payload.telemetry : payload;
}

function faultFrom(payload, telemetry) {
    const state = String(telemetry.State ?? telemetry.state ?? '').trim().toUpperCase().replaceAll(' ', '_');
    const explicit = String(payload.TripReason ?? telemetry.TripReason ?? payload.trip_reason ?? telemetry.trip_reason ?? payload.fault_type ?? payload.status ?? payload.Trip ?? payload.Fault ?? '').trim().toUpperCase().replaceAll(' ', '_');
    if (explicit.includes('OVERCURRENT')) return 'OVERCURRENT';
    if (explicit.includes('SHORT_CIRCUIT')) return 'SHORT_CIRCUIT';
    if (explicit.includes('MANUAL')) return 'MANUAL';
    if (explicit === 'HIF' || explicit.includes('HIF_TRIP')) return 'HIF';
    if (explicit.includes('PZEM_LOST')) return 'PZEM_LOST';
    if (state === 'UNSTABLE') return 'HIF';
    return null;
}

function emitDeviceMessage(message, level = 'info') {
    io.emit('device_message', {
        id: `${Date.now()}-${++deviceMessageSequence}`,
        timestamp: new Date().toISOString(),
        level,
        message,
        source: 'mqtt'
    });
}

io.on('connection', (socket) => {
    console.log(`Dashboard connected: ${socket.id}`);
    if (latestTelemetry) socket.emit('telemetry_update', latestTelemetry);

    socket.on('device_command', (request) => {
        const command = String(typeof request === 'string' ? request : request?.command ?? '').trim().toLowerCase();
        if (!['reset', 'trip'].includes(command)) {
            socket.emit('command_result', { command, accepted: false, error: 'Unsupported command' });
            return;
        }
        if (!mqttClient.connected) {
            socket.emit('command_result', { command, accepted: false, error: 'MQTT broker is offline' });
            return;
        }
        mqttClient.publish(COMMAND_TOPIC, command, { qos: 1 }, (err) => {
            const result = err
                ? { command, accepted: false, error: err.message }
                : { command, accepted: true, topic: COMMAND_TOPIC };
            socket.emit('command_result', result);
            if (!err) console.log(`Dashboard command published: ${command}`);
        });
    });
});

mqttClient.on('connect', () => {
    console.log(`MQTT connected. Subscribing to ${TELEMETRY_TOPIC}`);
    mqttClient.subscribe(TELEMETRY_TOPIC, { qos: 1 }, (err) => {
        if (err) console.error('MQTT subscribe failed:', err.message);
    });
});
mqttClient.on('error', (err) => console.error('MQTT connection error:', err.message));
mqttClient.on('offline', () => console.warn('MQTT client is offline; waiting to reconnect'));

mqttClient.on('message', (_topic, message) => {
    try {
        const payload = JSON.parse(message.toString());
        if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('Payload must be a JSON object');
        latestTelemetry = payload;
        io.emit('telemetry_update', payload);

        const telemetry = getTelemetry(payload);
        const detectorState = String(telemetry.State ?? telemetry.state ?? '').trim().toUpperCase().replaceAll('_', ' ');
        const tripReason = String(payload.TripReason ?? telemetry.TripReason ?? payload.trip_reason ?? telemetry.trip_reason ?? 'none').trim().toUpperCase().replaceAll(' ', '_');
        const relayValue = numberFrom(telemetry.Load, telemetry.load, payload.relay_state);
        const relayState = relayValue === null ? null : relayValue !== 0;

        if (detectorState && detectorState !== previousDetectorState) {
            emitDeviceMessage(`Detector state changed to ${detectorState}`, detectorState === 'UNSTABLE' ? 'warning' : 'info');
            previousDetectorState = detectorState;
        }
        if (tripReason !== previousTripReason) {
            if (tripReason !== 'NONE') {
                emitDeviceMessage(`Device trip reported: ${tripReason.replaceAll('_', ' ')}`, 'critical');
            }
            previousTripReason = tripReason;
        }
        if (relayState !== null && relayState !== previousRelayState) {
            emitDeviceMessage(`Relay ${relayState ? 'closed (load on)' : 'open (load off)'}`,
                relayState ? 'info' : (tripReason !== 'NONE' ? 'critical' : 'warning'));
            previousRelayState = relayState;
        }

        const faultType = faultFrom(payload, telemetry);
        const isTestFault = payload.test_run === true && faultType !== null;
        const explicitReason = String(payload.TripReason ?? telemetry.TripReason ?? payload.trip_reason ?? telemetry.trip_reason ?? '').trim().toUpperCase();
        const signatureReason = explicitReason && explicitReason !== 'NONE' ? explicitReason : detectorState;
        const signature = faultType ? `${faultType}:${payload.trip_id ?? payload.test_id ?? signatureReason}` : null;
        if (!signature) {
            activeFaultSignature = null;
            lastFaultAttemptSignature = null;
            lastFaultAttemptAt = 0;
        }
        const now = Date.now();
        const shouldLogFault = faultType && signature !== activeFaultSignature &&
            (signature !== lastFaultAttemptSignature || now - lastFaultAttemptAt >= 5000 || isTestFault);
        if (shouldLogFault) {
            lastFaultAttemptSignature = signature;
            lastFaultAttemptAt = now;
            const current = numberFrom(telemetry.I, telemetry.rms_current, telemetry.current_rms, telemetry.currentRms, telemetry.peak_current) ?? 0;
            const crestFactor = numberFrom(telemetry.CF, telemetry.crest_factor, telemetry.crestFactor) ?? 0;
            const edge = numberFrom(telemetry.Edge, telemetry.edge, telemetry.di_dt, telemetry.diDt) ?? 0;
            const score = numberFrom(telemetry.Score, telemetry.score) ?? 0;
            const cusum = numberFrom(telemetry.Cusum, telemetry.cusum) ?? 0;
            const jitter = numberFrom(telemetry.Jit, telemetry.jitter) ?? 0;
            const action = isTestFault ? 'SIMULATED_TEST' : (faultType === 'HIF' ? 'HIF_EVENT' : 'TRIP_REPORTED');
            if (!databaseConnected) {
                io.emit('fault_log_error', { faultType, error: 'MySQL is unavailable; event was not persisted' });
                return;
            }
            const query = `INSERT INTO fault_logs
                (fault_type, peak_current_amps, crest_factor, di_dt, action_taken, rms_current_amps, score, cusum, cf, edge, jitter)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
            const values = [faultType, current, crestFactor, edge, action, current, score, cusum, crestFactor, edge, jitter];
            db.query(query, values, (err, result) => {
                if (err) {
                    console.error('Database insert error (apply SafeNetQ_v5_migration.sql):', err.message);
                    io.emit('fault_log_error', { faultType, error: err.message });
                } else {
                    activeFaultSignature = signature;
                    const row = {
                        id: result.insertId,
                        timestamp: new Date().toISOString(),
                        fault_type: faultType,
                        rms_current_amps: current,
                        peak_current_amps: current,
                        cf: crestFactor,
                        crest_factor: crestFactor,
                        edge,
                        di_dt: edge,
                        score,
                        cusum,
                        jitter,
                        action_taken: action
                    };
                    io.emit('fault_logged', row);
                    console.log(`Fault logged: ${faultType} at ID ${result.insertId}`);
                }
            });
        }
    } catch (error) {
        console.error('Invalid MQTT JSON payload:', error.message);
    }
});

app.get('/api/health', (_req, res) => {
    res.json({ bridge: 'ok', mqtt: mqttClient.connected, database: databaseConnected, topic: TELEMETRY_TOPIC, commandTopic: COMMAND_TOPIC, hasTelemetry: latestTelemetry !== null });
});

app.get('/api/faults', (_req, res) => {
    if (!databaseConnected) return res.status(503).json({ error: 'Database unavailable' });
    db.query('SELECT * FROM fault_logs ORDER BY timestamp DESC LIMIT 100', (err, results) => {
        if (err) {
            console.error('Error fetching faults:', err.message);
            return res.status(500).json({ error: 'Database read error' });
        }
        res.json(results);
    });
});

app.get('/api/stats', (_req, res) => {
    if (!databaseConnected) return res.status(503).json({ error: 'Database unavailable' });
    const query = `SELECT COUNT(*) as total_faults,
        SUM(CASE WHEN fault_type = 'SHORT_CIRCUIT' THEN 1 ELSE 0 END) as short_circuits,
        SUM(CASE WHEN fault_type = 'OVERCURRENT' THEN 1 ELSE 0 END) as overcurrents,
        SUM(CASE WHEN fault_type = 'HIF' THEN 1 ELSE 0 END) as hifs
        FROM fault_logs`;
    db.query(query, (err, results) => {
        if (err) {
            console.error('Error fetching stats:', err.message);
            return res.status(500).json({ error: 'Database read error' });
        }
        res.json(results[0]);
    });
});

const PORT = Number(process.env.PORT) || 4000;
server.listen(PORT, () => console.log(`SafeNetQ bridge running on port ${PORT}`));
