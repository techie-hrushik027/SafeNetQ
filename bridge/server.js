require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mqtt = require('mqtt');
const mysql = require('mysql2');
const cors = require('cors');

const app = express();
app.use(cors());
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: process.env.DB_PASS,
    database: 'safenetq_db'
});

db.connect((err) => {
    if (err) throw err;
    console.log('✅ MySQL Connected to safenetq_db');
});

const mqttClient = mqtt.connect('mqtt://broker.hivemq.com');
const TELEMETRY_TOPIC = 'safenetq/telemetry/v1';

mqttClient.on('connect', () => {
    console.log(`✅ MQTT Connected. Subscribed to ${TELEMETRY_TOPIC}`);
    mqttClient.subscribe(TELEMETRY_TOPIC);
});

mqttClient.on('message', (topic, message) => {
    try {
        const payload = JSON.parse(message.toString());

        io.emit('telemetry_update', payload);

        if (payload.status !== 'NORMAL') {
            const query = `INSERT INTO fault_logs (fault_type, peak_current_amps, crest_factor, di_dt, action_taken) VALUES (?, ?, ?, ?, ?)`;
            const values = [payload.status, payload.peak_current, payload.crest_factor, payload.di_dt, "TRIP_EXECUTED"];

            db.query(query, values, (err, result) => {
                if (err) console.error('Database Insert Error:', err);
                else console.log(`🚨 FAULT LOGGED: ${payload.status} at ID ${result.insertId}`);
            });
        }
    } catch (error) {
        console.error('Invalid MQTT JSON Payload:', error);
    }
});

const PORT = 4000;
server.listen(PORT, () => {
    console.log(`🚀 SafeNetQ Bridge running on port ${PORT}`);
});

// --- REST API ENDPOINTS FOR FRONTEND DASHBOARD ---

// 1. Fetch recent fault logs for the history table
app.get('/api/faults', (req, res) => {
    const query = 'SELECT * FROM fault_logs ORDER BY timestamp DESC LIMIT 100';
    db.query(query, (err, results) => {
        if (err) {
            console.error('Error fetching faults:', err);
            return res.status(500).json({ error: 'Database read error' });
        }
        res.json(results);
    });
});

// 2. Fetch fault statistics for KPI summary cards
app.get('/api/stats', (req, res) => {
    const query = `
        SELECT 
            COUNT(*) as total_faults,
            SUM(CASE WHEN fault_type = 'SHORT_CIRCUIT' THEN 1 ELSE 0 END) as short_circuits,
            SUM(CASE WHEN fault_type = 'OVERCURRENT' THEN 1 ELSE 0 END) as overcurrents,
            SUM(CASE WHEN fault_type = 'HIF' THEN 1 ELSE 0 END) as hifs
        FROM fault_logs
    `;
    db.query(query, (err, results) => {
        if (err) {
            console.error('Error fetching stats:', err);
            return res.status(500).json({ error: 'Database read error' });
        }
        res.json(results[0]);
    });
});