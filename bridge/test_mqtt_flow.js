const mqtt = require('mqtt');
const client = mqtt.connect('mqtt://broker.hivemq.com:1883');

const TOPIC = "safenetq/telemetry/v1";
let seq = 0;

client.on('connect', () => {
    console.log('✅ Connected to HiveMQ broker for testing!');

    // Publish a test packet every 2 seconds
    setInterval(() => {
        const payload = JSON.stringify({
            status: "NORMAL",
            relay_state: 1,
            rms_current: 4.25,
            peak_current: 6.01,
            crest_factor: 1.41,
            di_dt: 12.5,
            voltage: 230.2,
            seq: seq++
        });

        client.publish(TOPIC, payload, (err) => {
            if (!err) {
                console.log(`📤 Published telemetry packet #${seq}:`, payload);
            } else {
                console.error('❌ Publish failed:', err);
            }
        });
    }, 2000);
});