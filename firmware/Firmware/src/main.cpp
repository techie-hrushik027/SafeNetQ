#include <Arduino.h>
#include <WiFi.h>
#include <PubSubClient.h>
#include "secrets.h"

const char *WIFI_SSID = SECRET_WIFI_SSID;
const char *WIFI_PASSWORD = SECRET_WIFI_PASSWORD;
const char *MQTT_BROKER = SECRET_MQTT_BROKER;
const int MQTT_PORT = SECRET_MQTT_PORT;
const char *TELEMETRY_TOPIC = "safenetq/telemetry/v1";

// Pin Map (Based on corrected schematic)
const int ZMCT_PIN = 4;   // Fast ADC1 Path
const int RELAY_PIN = 14; // Opto-isolated Relay
const int RESET_BTN = 6;  // Physical lockout reset button

// Math/Calibration Constants
const float ADC_OFFSET = 2048.0; // Tune this at startup in production
const float CT_CALIBRATION = 0.05;
const int SAMPLES_PER_WINDOW = 80;
const int SAMPLE_INTERVAL_US = 250;

// Fault Thresholds (To be calibrated in lab)
const float LIMIT_RMS = 10.0;
const float LIMIT_DIDT = 50.0;
const float LIMIT_CF = 1.6;

// --- 2. FreeRTOS Data Structures ---
enum FaultStatus
{
  STATUS_NORMAL = 0,
  STATUS_OVERCURRENT = 1,
  STATUS_SHORT_CIRCUIT = 2,
  STATUS_HIF = 3
};

struct Features
{
  float rms;
  float peak;
  float cf;
  float didt;
  uint8_t status;
  uint8_t relay_state;
  uint32_t seq;
};

QueueHandle_t featureQueue;
WiFiClient espClient;
PubSubClient mqttClient(espClient);
TaskHandle_t TaskCore0, TaskCore1;

// --- 3. Wi-Fi & MQTT Setup ---
void setupWiFi()
{
  Serial.print("Connecting to Wi-Fi...");
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED)
  {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\n✅ Wi-Fi Connected!");
}

void reconnectMQTT()
{
  while (!mqttClient.connected())
  {
    char clientId[32];
    snprintf(clientId, sizeof(clientId), "SafeNetQ-%04X", random(0xffff));
    if (mqttClient.connect(clientId))
    {
      Serial.println("✅ MQTT Connected!");
    }
    else
    {
      vTaskDelay(5000 / portTICK_PERIOD_MS);
    }
  }
}

const char *statusToString(uint8_t status)
{
  switch (status)
  {
  case STATUS_OVERCURRENT:
    return "OVERCURRENT";
  case STATUS_SHORT_CIRCUIT:
    return "SHORT_CIRCUIT";
  case STATUS_HIF:
    return "HIF";
  default:
    return "NORMAL";
  }
}


// CORE 0: Network & Slow Polling Task
void codeForCore0(void *parameter)
{
  setupWiFi();
  mqttClient.setServer(MQTT_BROKER, MQTT_PORT);
  Features localFeat;

  for (;;)
  {
    if (!mqttClient.connected())
      reconnectMQTT();
    mqttClient.loop();

    // Peek the queue without blocking the network thread
    if (xQueuePeek(featureQueue, &localFeat, 0) == pdTRUE)
    {

      // TODO: Poll PZEM-004T via UART here for supplementary voltage/power telemetry
      float pzem_voltage_mock = 230.4;

      // Safely format JSON string in a fixed buffer (No Heap Allocation / Arduino Strings)
      char jsonPayload[256];
      snprintf(jsonPayload, sizeof(jsonPayload),
               "{\"status\":\"%s\",\"relay_state\":%d,\"rms_current\":%.2f,\"peak_current\":%.2f,\"crest_factor\":%.2f,\"di_dt\":%.2f,\"voltage\":%.2f,\"seq\":%lu}",
               statusToString(localFeat.status), localFeat.relay_state, localFeat.rms,
               localFeat.peak, localFeat.cf, localFeat.didt, pzem_voltage_mock, localFeat.seq);

      mqttClient.publish(TELEMETRY_TOPIC, jsonPayload);
    }

    vTaskDelay(1000 / portTICK_PERIOD_MS);
  }
}
// CORE 1: Hard Real-Time Math & Relay Engine (4kHz)
void codeForCore1(void *parameter)
{
  analogReadResolution(12);
  pinMode(RELAY_PIN, OUTPUT);
  pinMode(RESET_BTN, INPUT_PULLUP);

  digitalWrite(RELAY_PIN, HIGH); // Boot state: Assumes active-LOW relay module. HIGH = OFF/Safe.

  bool isLatched = false;
  uint8_t currentStatus = STATUS_NORMAL;
  uint32_t sequence = 0;
  Features outputFeat;

  for (;;)
  {
    float i_peak = 0.0;
    float sum_i_sq = 0.0;
    float max_di_dt = 0.0;
    float prev_i = 0.0;

    // 20ms Synchronized Sampling Window
    for (int i = 0; i < SAMPLES_PER_WINDOW; i++)
    {
      unsigned long loop_start = micros();

      float i_inst = (analogRead(ZMCT_PIN) - ADC_OFFSET) * CT_CALIBRATION;
      float abs_i = abs(i_inst);

      if (abs_i > i_peak)
        i_peak = abs_i;
      sum_i_sq += (i_inst * i_inst);

      if (i > 0)
      {
        float current_di_dt = abs(i_inst - prev_i);
        if (current_di_dt > max_di_dt)
          max_di_dt = current_di_dt;

        // INSTANT TRIP CHECK (Latency < 250us)
        if (current_di_dt > LIMIT_DIDT && !isLatched)
        {
          digitalWrite(RELAY_PIN, LOW); // Trip Relay
          currentStatus = STATUS_SHORT_CIRCUIT;
          isLatched = true;
        }
      }
      prev_i = i_inst;

      while (micros() - loop_start < SAMPLE_INTERVAL_US)
      {
      } // 250us timing lock
    }

    float calc_rms = sqrt(sum_i_sq / SAMPLES_PER_WINDOW);
    float calc_cf = (calc_rms > 0.1) ? (i_peak / calc_rms) : 0;

    // Windowed Trip Checks (Only evaluate if not already latched)
    if (!isLatched)
    {
      if (calc_rms > LIMIT_RMS)
      {
        digitalWrite(RELAY_PIN, LOW);
        currentStatus = STATUS_OVERCURRENT;
        isLatched = true;
      }
      else if (calc_cf > LIMIT_CF && calc_rms < LIMIT_RMS)
      {
        digitalWrite(RELAY_PIN, LOW);
        currentStatus = STATUS_HIF;
        isLatched = true;
      }
      else
      {
        currentStatus = STATUS_NORMAL;
        digitalWrite(RELAY_PIN, HIGH); // Keep relay engaged
      }
    }

    // Hardware Reset Button overrides latch
    if (isLatched && digitalRead(RESET_BTN) == LOW)
    {
      isLatched = false;
      currentStatus = STATUS_NORMAL;
      digitalWrite(RELAY_PIN, HIGH);
    }

    // Package and ship to Core 0 securely
    outputFeat = {calc_rms, i_peak, calc_cf, max_di_dt, currentStatus, (uint8_t)(isLatched ? 0 : 1), sequence++};
    xQueueOverwrite(featureQueue, &outputFeat);

    vTaskDelay(1 / portTICK_PERIOD_MS); // Feed Watchdog
  }
}

void setup()
{
  Serial.begin(115200);
  featureQueue = xQueueCreate(1, sizeof(Features));

  xTaskCreatePinnedToCore(codeForCore0, "NetTask", 10000, NULL, 1, &TaskCore0, 0);
  xTaskCreatePinnedToCore(codeForCore1, "MathTask", 10000, NULL, 2, &TaskCore1, 1);
}

void loop() { vTaskDelete(NULL); }