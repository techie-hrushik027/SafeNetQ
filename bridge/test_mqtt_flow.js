require('dotenv').config(); // Load your exact .env variables
const mqtt = require('mqtt');

// Dynamically connect to the broker defined in your bridge/.env file
const brokerUrl = process.env.MQTT_BROKER_URL || 'mqtt://broker.hivemq.com:1883';
const telemetryTopic = process.env.MQTT_TOPIC || 'safenetq/telemetry/v1';
const client = mqtt.connect(brokerUrl);

let cumulativeEnergy = 12.45;

client.on('connect', () => {
    console.log('✅ Connected to Broker. Broadcasting HIGHLY DYNAMIC telemetry...');

    setInterval(() => {
        const voltage = (230 + (Math.random() * 80 - 40)).toFixed(2);
        const current = (5 + (Math.random() * 8 - 4)).toFixed(2);
        const frequency = (50 + (Math.random() * 6 - 3)).toFixed(2);
        const powerFactor = (0.70 + Math.random() * 0.29).toFixed(2);

        const realPower = (voltage * current * powerFactor).toFixed(2);
        const peakCurrent = (current * (1.414 + (Math.random() * 1.5))).toFixed(2);
        const crestFactor = (peakCurrent / current).toFixed(2);
        const diDt = (10 + (Math.random() * 80 - 20)).toFixed(2);
        cumulativeEnergy += (realPower / 1000);

        const payload = {
            status: "NORMAL",
            relay_state: 1,
            rms_current: parseFloat(current),
            peak_current: parseFloat(peakCurrent),
            crest_factor: parseFloat(crestFactor),
            di_dt: parseFloat(diDt),
            voltage: parseFloat(voltage),
            real_power: parseFloat(realPower),
            energy: parseFloat(cumulativeEnergy.toFixed(2)),
            frequency: parseFloat(frequency),
            power_factor: parseFloat(powerFactor)
        };

        // MATCHED TO YOUR SERVER.JS TOPIC
        client.publish(telemetryTopic, JSON.stringify(payload));
        console.log(`[${new Date().toLocaleTimeString()}] Wild Payload Sent:`, payload);

    }, 1000);
});
