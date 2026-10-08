const mqtt = require('mqtt');
const client = mqtt.connect('mqtt://broker.hivemq.com');
const TELEMETRY_TOPIC = 'safenetq/telemetry/v1';

client.on('connect', () => {
    console.log('🔌 Simulator connected to MQTT Broker. Beginning test sequence...');

    setTimeout(() => {
        const normalPayload = {
            status: "NORMAL",
            peak_current: 2.1,
            crest_factor: 1.41,
            di_dt: 120.5
        };
        console.log('Sending NORMAL telemetry...');
        client.publish(TELEMETRY_TOPIC, JSON.stringify(normalPayload));
    }, 1000);

    setTimeout(() => {
        const scPayload = {
            status: "SHORT_CIRCUIT",
            peak_current: 45.0,
            crest_factor: 1.45,
            di_dt: 4600.0 // Massive di/dt spike
        };
        console.log('Sending SHORT_CIRCUIT fault...');
        client.publish(TELEMETRY_TOPIC, JSON.stringify(scPayload));
    }, 3000);

    setTimeout(() => {
        const hifPayload = {
            status: "HIF",
            peak_current: 3.5,
            crest_factor: 1.95, // Distorted waveform ratio
            di_dt: 1300.0
        };
        console.log('Sending HIF fault...');
        client.publish(TELEMETRY_TOPIC, JSON.stringify(hifPayload));
    }, 5000);

    setTimeout(() => {
        console.log('✅ Test sequence complete. Shutting down simulator.');
        client.end();
        process.exit(0);
    }, 6000);
});