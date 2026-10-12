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

const db = mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS,
    database: process.env.DB_NAME || 'safenetq_db'
});

let databaseConnected = false;
db.connect((err) => {
    if (err) {
        console.error('MySQL unavailable; live telemetry will continue without fault history:', err.message);
        return;
    }
    databaseConnected = true;
    console.log('MySQL connected to safenetq_db');
});

const TELEMETRY_TOPIC = process.env.MQTT_TOPIC || 'safenetq/telemetry/v1';
const mqttClient = mqtt.connect(process.env.MQTT_BROKER_URL || 'mqtt://broker.hivemq.com:1883');
let latestTelemetry = null;

io.on('connection', (socket) => {
    console.log(`Dashboard connected: ${socket.id}`);
    if (latestTelemetry) socket.emit('telemetry_update', latestTelemetry);
});

mqttClient.on('connect', () => {
    console.log(`MQTT connected. Subscribing to ${TELEMETRY_TOPIC}`);
    mqttClient.subscribe(TELEMETRY_TOPIC, (err) => {
        if (err) console.error('MQTT subscribe failed:', err.message);
    });
});
mqttClient.on('error', (err) => console.error('MQTT connection error:', err.message));
mqttClient.on('offline', () => console.warn('MQTT client is offline; waiting to reconnect'));

mqttClient.on('message', (_topic, message) => {
    try {
        const payload = JSON.parse(message.toString());
        latestTelemetry = payload;
        io.emit('telemetry_update', payload);

        const status = payload.status ?? payload.inference?.fault_status;
        if (databaseConnected && status && status !== 'NORMAL') {
            const telemetry = payload.telemetry ?? payload;
            const query = `INSERT INTO fault_logs (fault_type, peak_current_amps, crest_factor, di_dt, action_taken) VALUES (?, ?, ?, ?, ?)`;
            const values = [status, telemetry.peak_current ?? telemetry.peakCurrent, telemetry.crest_factor ?? telemetry.crestFactor, telemetry.di_dt ?? telemetry.diDt, 'TRIP_EXECUTED'];
            db.query(query, values, (err, result) => {
                if (err) console.error('Database insert error:', err.message);
                else console.log(`Fault logged: ${status} at ID ${result.insertId}`);
            });
        }
    } catch (error) {
        console.error('Invalid MQTT JSON payload:', error.message);
    }
});

app.get('/api/health', (_req, res) => {
    res.json({ bridge: 'ok', mqtt: mqttClient.connected, database: databaseConnected, topic: TELEMETRY_TOPIC, hasTelemetry: latestTelemetry !== null });
});

app.get('/api/faults', (req, res) => {
    if (!databaseConnected) return res.status(503).json({ error: 'Database unavailable' });
    db.query('SELECT * FROM fault_logs ORDER BY timestamp DESC LIMIT 100', (err, results) => {
        if (err) {
            console.error('Error fetching faults:', err.message);
            return res.status(500).json({ error: 'Database read error' });
        }
        res.json(results);
    });
});

app.get('/api/stats', (req, res) => {
    if (!databaseConnected) return res.status(503).json({ error: 'Database unavailable' });
    const query = `
        SELECT COUNT(*) as total_faults,
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
