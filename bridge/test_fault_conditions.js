require('dotenv').config();
const mqtt = require('mqtt');

const brokerUrl = process.env.MQTT_BROKER_URL || 'mqtt://broker.hivemq.com:1883';
const telemetryTopic = process.env.MQTT_TOPIC || 'safenetq/telemetry/v1';
const client = mqtt.connect(brokerUrl);
const testId = `LED-DB-${Date.now()}`;

// These messages exercise the MQTT -> bridge -> dashboard/database path.
// They report explicit statuses; they do not feed samples into the ESP32 ADC detector.
const scenarios = [
    {
        status: 'NORMAL', relay_state: 1,
        rms_current: 5.0, peak_current: 7.1, crest_factor: 1.42, di_dt: 20.0
    },
    {
        status: 'OVERCURRENT', relay_state: 0,
        rms_current: 12.5, peak_current: 17.7, crest_factor: 1.42, di_dt: 24.0
    },
    {
        status: 'SHORT_CIRCUIT', relay_state: 0,
        rms_current: 8.0, peak_current: 35.0, crest_factor: 4.38, di_dt: 75.0
    },
    {
        status: 'HIF', relay_state: 0,
        rms_current: 6.0, peak_current: 11.4, crest_factor: 1.90, di_dt: 32.0
    }
];

client.on('connect', () => {
    console.log(`Connected to ${brokerUrl}; publishing four condition scenarios to ${telemetryTopic}`);

    scenarios.forEach((scenario, index) => {
        setTimeout(() => {
            const payload = {
                ...scenario,
                voltage: 230.4,
                real_power: 1152,
                energy: 12.45,
                frequency: 50,
                power_factor: 1,
                test_run: true,
                test_id: testId
            };

            client.publish(telemetryTopic, JSON.stringify(payload), { qos: 1 }, (error) => {
                if (error) {
                    console.error(`Failed to publish ${scenario.status}:`, error.message);
                    client.end();
                    process.exitCode = 1;
                    return;
                }
                console.log(`[${new Date().toLocaleTimeString()}] Published ${scenario.status}`);
                if (index === scenarios.length - 1) {
                    console.log('Sequence complete. Check the dashboard LEDs and MySQL fault_logs.');
                    client.end();
                }
            });
        }, index * 2000);
    });
});

client.on('error', (error) => {
    console.error('MQTT test publisher error:', error.message);
    client.end();
    process.exitCode = 1;
});

