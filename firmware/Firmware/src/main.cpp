// SafeNetQ v5 "HIF Guard"
//
//  * PZEM-004T is the only current meter. It does the overcurrent trip (default 5 A).
//  * The ZMCT103C is NOT used to measure current. It only feeds the HIF (high
//    impedance / arcing fault) detector, which looks at waveform irregularity
//    (crest factor, asymmetry, edge steepness di/dt, roughness, shape change,
//    timing jitter) relative to a baseline it learns from the connected load.
//  * Sampling + analysis run on core 0, everything else on core 1.
//  * OLED rotates through 7 pages of 5 values each. BOOT button: short press =
//    next page (or reset a trip), long press (1.2 s) = re-learn the HIF baseline.

#include <Arduino.h>
#include <WiFi.h>
#include <PubSubClient.h>
#include <U8g2lib.h>
#include <Wire.h>
#include <PZEM004Tv30.h>
#include <esp_task_wdt.h>
#include <Preferences.h>
#include <math.h>
#include <string.h>
#include <stdint.h>
#include "secrets.h"

#define TELEMETRY_TOPIC "safenetq/telemetry/v1"
#define COMMAND_TOPIC   "safenetq/command/v1"

// Forward declaration: the Arduino builder auto-generates function prototypes
// that land above the struct definition, so the type must be known up here.
struct Detector;

// ---------- Pins ----------
#define SENSOR_PIN 1      // ZMCT103C OUT
#define SDA_PIN    12     // OLED
#define SCL_PIN    13     // OLED
#define PZEM_RX    10     // ESP32 RX <- PZEM TX
#define PZEM_TX    11     // ESP32 TX -> PZEM RX
#define RELAY_PIN  9      // Relay IN (load wired on COM + NO)
#define BTN_PIN    0      // BOOT button

// ---------- Settings ----------
#define RELAY_ACTIVE_LOW   false  // module is active-HIGH: pin HIGH = relay ON = load ON
#define TRIP_LIMIT_DEFAULT 5.0f   // A, overcurrent trip (PZEM)
#define OC_TIME_MS         500    // over the limit this long -> trip
#define OC_INSTANT_X       1.5f   // above limit x this -> trip immediately
#define INRUSH_BLANK_MS    300    // ignore overcurrent right after relay turns ON
#define PZEM_POLL_MS       250
#define PZEM_LOSS_TRIPS    false  // true = trip if the PZEM stops answering for 3 s
#define HIF_MODE_DEFAULT   1      // 0 = off, 1 = warn only, 2 = trip relay
#define HIF_SENS_DEFAULT   1.5f   // detector sensitivity multiplier (0.5 to 5)
#define BOOT_DELAY_MS      2000
#define WDT_TIMEOUT_MS     5000
#define SAMPLE_US          125    // ZMCT sampling interval (8 kHz)
#define PAGE_MS            2500
#define OLED_MS            200

// ===================== CORE BEGIN (pure C++, no Arduino calls) =====================
// Waveform analysis + HIF detector. Written so it can be tested on a PC.
//
// What the ZMCT signal looks like in this build: the module output sits above the
// ADC ceiling, so the ADC only sees one half-cycle of the current as a "lobe" that
// dips below the ceiling. Everything below works on those lobes, and every
// detection decision is relative to a baseline learned from the load itself.

#define WIN_N          1000     // samples per analysis window (~125 ms at 125 us)
#define MAX_LOBES      16
#define SHAPE_BINS     12
#define NOSIG_PP_MV    40.0f    // peak-to-peak below this = no usable ZMCT signal
#define LOBE_MIN_SMP   6        // shorter lobes are noise

// Feature indexes. First F_IRR_N are "irregularity" features (should be ~0 on a
// healthy load), the rest are "shape" features (differ per load, stable per load).
enum { F_PEAKCV = 0, F_WIDTHCV, F_JIT, F_SHAPE, F_ROUGH,
       F_WIDTH, F_CF, F_ASYM, F_EDGE, F_NUM };
#define F_IRR_N 5

struct WinFeat {
  bool  valid, noSignal, noCeil;
  int   nLobes;
  float ceilMv, dcMv, minMv, depthMv, periodMs;
  float f[F_NUM];
};

struct Lobe { float ts, te, peak, cf, asym, rough, edge, shp[SHAPE_BINS]; };

static float gD[WIN_N], gS[WIN_N];
static Lobe  gL[MAX_LOBES];

static float interpAt(const float *a, int n, float t) {
  if (t <= 0) return a[0];
  if (t >= n - 1) return a[n - 1];
  int i = (int)t;
  return a[i] + (a[i + 1] - a[i]) * (t - i);
}

// si = first index at/above thr, ei = first index below the low threshold afterwards
static bool buildLobe(int si, int ei, int n, float thr, Lobe &L) {
  float a = gS[si - 1], b = gS[si];
  L.ts = (si - 1) + ((b > a) ? (thr - a) / (b - a) : 1.0f);
  int m = ei - 1;
  while (m > si && gS[m] < thr) m--;
  float c = gS[m], e = (m + 1 < n) ? gS[m + 1] : 0.0f;
  L.te = m + ((c > e) ? (c - thr) / (c - e) : 0.0f);
  float width = L.te - L.ts;
  if (width < LOBE_MIN_SMP) return false;

  int i0 = (int)ceilf(L.ts), i1 = (int)floorf(L.te);
  if (i0 < 1) i0 = 1;
  if (i1 > n - 2) i1 = n - 2;
  if (i1 - i0 < 3) return false;

  float pk = 0, area = 0, sq = 0, mom = 0;
  for (int k = i0; k <= i1; k++) {
    float v = gS[k];
    if (v > pk) pk = v;
    area += v; sq += v * v; mom += v * k;
  }
  if (pk <= 0 || area <= 0) return false;
  int cnt = i1 - i0 + 1;

  L.peak = pk;
  L.cf   = pk / sqrtf(sq / cnt);                         // peak / rms inside the lobe
  float cen = mom / area;
  L.asym = 2.0f * ((cen - L.ts) / width - 0.5f);          // 0 = symmetric lobe

  float r = 0; int rc = 0;                                // high-frequency roughness
  for (int k = i0 + 2; k <= i1 - 2; k++) { r += fabsf(gD[k] - gS[k]); rc++; }
  L.rough = (rc > 0) ? r / rc / pk : 0;

  float sl = 0;                                           // steepest edge (di/dt proxy)
  for (int k = i0; k <= i1; k++) {
    float s = 0.5f * fabsf(gS[k + 1] - gS[k - 1]);
    if (s > sl) sl = s;
  }
  L.edge = sl * width / pk;                               // half-sine = 3.14

  for (int q = 0; q < SHAPE_BINS; q++) {
    float u = (q + 0.5f) / SHAPE_BINS;
    L.shp[q] = interpAt(gS, n, L.ts + u * width) / pk;
  }
  return true;
}

void analyzeWindow(const uint16_t *raw, int n, float dtUs, WinFeat &o) {
  memset(&o, 0, sizeof(o));
  uint16_t mx = 0, mn = 65535;
  uint32_t sum = 0;
  for (int k = 0; k < n; k++) {
    uint16_t v = raw[k];
    if (v > mx) mx = v;
    if (v < mn) mn = v;
    sum += v;
  }
  o.ceilMv = mx; o.minMv = mn; o.dcMv = (float)sum / n;
  if ((float)(mx - mn) < NOSIG_PP_MV) { o.noSignal = true; return; }

  int nTop = 0;
  for (int k = 0; k < n; k++) if (raw[k] + 3 >= mx) nTop++;
  o.noCeil = (nTop < n / 10);

  for (int k = 0; k < n; k++) gD[k] = (float)mx - (float)raw[k];
  gS[0] = gD[0]; gS[n - 1] = gD[n - 1];
  float dmax = 0;
  for (int k = 1; k < n - 1; k++) {
    gS[k] = 0.25f * (gD[k - 1] + 2.0f * gD[k] + gD[k + 1]);
    if (gS[k] > dmax) dmax = gS[k];
  }
  float thrHi = fmaxf(20.0f, 0.20f * dmax), thrLo = 0.5f * thrHi;

  int nl = 0;
  bool in = false;
  int si = 0;
  for (int k = 0; k < n; k++) {
    if (!in) {
      if (gS[k] >= thrHi) { in = true; si = k; }
    } else if (gS[k] < thrLo) {
      in = false;
      if (si > 0 && nl < MAX_LOBES && buildLobe(si, k, n, thrHi, gL[nl])) nl++;
    }
  }
  o.nLobes = nl;
  if (nl < 3) return;                                      // signal but not analysable

  float per[MAX_LOBES];
  int np = nl - 1;
  float pm = 0;
  for (int i = 0; i < np; i++) { per[i] = gL[i + 1].ts - gL[i].ts; pm += per[i]; }
  pm /= np;
  o.periodMs = pm * dtUs / 1000.0f;
  if (o.periodMs < 16.0f || o.periodMs > 24.0f) return;

  float jit = 0;
  for (int i = 0; i < np; i++) jit += fabsf(per[i] - pm);
  jit = jit / np / pm;

  float wm = 0, pkm = 0, cf = 0, asym = 0, rough = 0, edge = 0;
  for (int i = 0; i < nl; i++) {
    wm += (gL[i].te - gL[i].ts) / pm;
    pkm += gL[i].peak; cf += gL[i].cf; asym += gL[i].asym;
    rough += gL[i].rough; edge += gL[i].edge;
  }
  wm /= nl; pkm /= nl; cf /= nl; asym /= nl; rough /= nl; edge /= nl;

  float wv = 0, pv = 0;
  for (int i = 0; i < nl; i++) {
    float dw = (gL[i].te - gL[i].ts) / pm - wm, dp = gL[i].peak - pkm;
    wv += dw * dw; pv += dp * dp;
  }
  float widthCV = (wm > 0) ? sqrtf(wv / nl) / wm : 0;
  float peakCV  = (pkm > 0) ? sqrtf(pv / nl) / pkm : 0;

  float shp = 0;
  for (int i = 0; i < nl - 1; i++) {
    float s = 0;
    for (int q = 0; q < SHAPE_BINS; q++) {
      float dd = gL[i].shp[q] - gL[i + 1].shp[q];
      s += dd * dd;
    }
    shp += sqrtf(s / SHAPE_BINS);
  }
  shp /= (nl - 1);

  o.depthMv = pkm;
  o.f[F_PEAKCV] = peakCV;  o.f[F_WIDTHCV] = widthCV; o.f[F_JIT] = jit;
  o.f[F_SHAPE]  = shp;     o.f[F_ROUGH]   = rough;
  o.f[F_WIDTH]  = wm;      o.f[F_CF]      = cf;
  o.f[F_ASYM]   = asym;    o.f[F_EDGE]    = edge;
  o.valid = true;
}

// ---------------------------- HIF detector ----------------------------
// Per-window flow:
//   NOLOAD -> SETTLE (ignore transient) -> LEARN (learn this load's normal) -> ARMED
//   ARMED scores how much the waveform deviates from the learned normal and runs a
//   CUSUM + a hit counter. A clean change of load (shape changes but the waveform
//   stays regular) is re-learned silently. A waveform that never settles is
//   reported as UNSTABLE and raises the alarm after UNSTABLE_ALARM_MS.

enum { D_NOLOAD = 0, D_SETTLE, D_LEARN, D_ARMED, D_UNSTABLE };

// ---- Tuning (windows are ~8 per second) ----
#define SETTLE_MS          1200
#define LEARN_N            32       // windows used to learn a baseline (~4 s)
#define LEARN_GOOD_MIN     22       // of LEARN_N must be regular
#define HIT_T              3.0f     // score above this counts as a hit
#define CUSUM_K            2.0f     // reference level removed from the score
#define WARN_H             10.0f
#define TRIP_H             30.0f
#define CLEAR_H            2.0f
#define HIT_WARN_N         5        // hits in last 24 windows -> warn
#define HIT_ALARM_N        9        // hits in last 24 windows -> alarm
#define SHIFT_T            4.0f     // shape change big enough to call it a new load
#define SHIFT_N            5
#define UNSTABLE_ALARM_MS  8000
#define ADAPT              0.01f
#define FORCE_SCORE        6.0f     // score for a window that cannot be analysed

static const float FLOOR_F[F_NUM] = { 0.030f, 0.030f, 0.004f, 0.050f, 0.020f,
                                      0.030f, 0.100f, 0.080f, 0.500f };
static const float GATE_F[F_IRR_N] = { 0.10f, 0.06f, 0.012f, 0.15f, 0.10f };

struct Detector {
  int      state;
  uint32_t since, unstableSince;
  float    mu[F_NUM], m2[F_NUM], sd[F_NUM];
  int      learnGood, learnBad;
  float    sm[F_NUM];
  bool     smInit;
  float    zIrr, zShape, score, cusum;
  uint32_t hitBits;
  int      hitCount, shiftRun;
  bool     warn, alarm;
  uint32_t alarmEvents, winCount;
};

static void detClearScore(Detector &d) {
  d.zIrr = d.zShape = d.score = d.cusum = 0;
  d.hitBits = 0; d.hitCount = 0; d.shiftRun = 0;
  d.warn = false; d.alarm = false;
}

void detReset(Detector &d) {
  memset(&d, 0, sizeof(d));
  d.state = D_NOLOAD;
}

static void detBeginSettle(Detector &d, uint32_t now) {
  d.state = D_SETTLE; d.since = now;
  detClearScore(d);
}

static void detBeginLearn(Detector &d) {
  d.state = D_LEARN;
  d.learnGood = d.learnBad = 0;
  for (int i = 0; i < F_NUM; i++) { d.mu[i] = 0; d.m2[i] = 0; d.sd[i] = 0; }
}

// Called when something outside the waveform says "the load changed" (e.g. PZEM step).
void detLoadEvent(Detector &d, uint32_t now) {
  if (d.state == D_ARMED || d.state == D_LEARN || d.state == D_UNSTABLE) detBeginSettle(d, now);
}

void detRelearn(Detector &d, uint32_t now) {
  if (d.state != D_NOLOAD) detBeginSettle(d, now);
}

void detUpdate(Detector &d, const WinFeat &w, uint32_t now, bool inject, float sens) {
  d.winCount++;
  if (w.noSignal) {
    if (d.state != D_NOLOAD) { d.state = D_NOLOAD; d.smInit = false; detClearScore(d); }
    return;
  }
  if (d.state == D_NOLOAD) detBeginSettle(d, now);

  float x[F_NUM];
  bool ok = w.valid;
  if (ok) {
    memcpy(x, w.f, sizeof(x));
    if (inject) {                                  // synthetic arc-like irregularity
      x[F_PEAKCV] += 0.12f; x[F_WIDTHCV] += 0.10f; x[F_JIT] += 0.012f;
      x[F_SHAPE]  += 0.20f; x[F_ROUGH]   += 0.12f; x[F_WIDTH] *= 0.9f;
    }
    if (!d.smInit) { memcpy(d.sm, x, sizeof(x)); d.smInit = true; }
    else for (int i = 0; i < F_NUM; i++) d.sm[i] += 0.25f * (x[i] - d.sm[i]);
  }

  if (d.state == D_SETTLE) {
    if (now - d.since >= SETTLE_MS) detBeginLearn(d);
    return;
  }

  if (d.state == D_LEARN || d.state == D_UNSTABLE) {
    bool good = false;
    if (ok) {
      int over = 0;
      for (int i = 0; i < F_IRR_N; i++) if (x[i] > GATE_F[i]) over++;
      good = (over <= 1);
    }
    if (good) {
      d.learnGood++;
      for (int i = 0; i < F_NUM; i++) {            // Welford running mean / M2
        float dl = x[i] - d.mu[i];
        d.mu[i] += dl / d.learnGood;
        d.m2[i] += dl * (x[i] - d.mu[i]);
      }
    } else d.learnBad++;

    if (d.learnGood + d.learnBad >= LEARN_N) {
      if (d.learnGood >= LEARN_GOOD_MIN) {
        for (int i = 0; i < F_NUM; i++) d.sd[i] = sqrtf(d.m2[i] / (d.learnGood - 1));
        d.state = D_ARMED; d.since = now;
        detClearScore(d);
      } else {
        if (d.state != D_UNSTABLE) { d.state = D_UNSTABLE; d.unstableSince = now; }
        d.learnGood = d.learnBad = 0;
        for (int i = 0; i < F_NUM; i++) { d.mu[i] = 0; d.m2[i] = 0; }
      }
    }
    if (d.state == D_UNSTABLE && now - d.unstableSince >= UNSTABLE_ALARM_MS) {
      if (!d.alarm) { d.alarm = true; d.alarmEvents++; }
      d.warn = true;
    }
    return;
  }

  // ---------------- ARMED ----------------
  float zi = 0, zs = 0;
  if (!ok) {
    zi = FORCE_SCORE;
  } else {
    float zmax = 0;
    for (int i = 0; i < F_IRR_N; i++) {
      float sdE = fmaxf(1.5f * d.sd[i], FLOOR_F[i]);
      float z = (x[i] - d.mu[i]) / sdE;
      if (z < 0) z = 0;
      if (z > 8) z = 8;
      zi += z;
      if (z > zmax) zmax = z;
    }
    zi /= F_IRR_N;
    if (0.5f * zmax > zi) zi = 0.5f * zmax;      // one strongly abnormal feature is enough
    for (int i = F_IRR_N; i < F_NUM; i++) {
      float sdE = fmaxf(2.0f * d.sd[i], FLOOR_F[i]);
      float z = fabsf(x[i] - d.mu[i]) / sdE;
      if (z > 8) z = 8;
      zs += z;
    }
    zs /= (F_NUM - F_IRR_N);
  }
  d.zIrr = zi; d.zShape = zs;
  d.score = (zi + 0.25f * zs) * sens;

  bool hit = d.score > HIT_T;
  d.hitBits = (d.hitBits << 1) | (hit ? 1u : 0u);
  d.hitCount = __builtin_popcount(d.hitBits & 0x00FFFFFFu);
  d.cusum += d.score - CUSUM_K;
  if (d.cusum < 0) d.cusum = 0;
  if (d.cusum > 2.0f * TRIP_H) d.cusum = 2.0f * TRIP_H;     // cap so an alarm clears quickly

  // Clean change of load: shape moved a lot but waveform stays regular -> re-learn.
  if (ok && zs > SHIFT_T && zi < 1.5f) d.shiftRun++; else d.shiftRun = 0;
  if (d.shiftRun >= SHIFT_N) { detBeginSettle(d, now); return; }

  // Slow drift tracking, only while everything is calm.
  if (ok && d.score < 1.0f) {
    for (int i = 0; i < F_NUM; i++) {
      float e = x[i] - d.mu[i];
      d.mu[i] += ADAPT * e;
      float v = (1.0f - ADAPT) * d.sd[i] * d.sd[i] + ADAPT * e * e;
      d.sd[i] = sqrtf(v);
    }
  }

  bool aNow = (d.cusum >= TRIP_H) || (d.hitCount >= HIT_ALARM_N);
  bool wNow = (d.cusum >= WARN_H) || (d.hitCount >= HIT_WARN_N);
  if (aNow) {
    if (!d.alarm) { d.alarm = true; d.alarmEvents++; }
  } else if (d.alarm && d.cusum < CLEAR_H && d.hitCount < 3) {
    d.alarm = false;
  }
  d.warn = wNow || d.alarm;
}
// ===================== CORE END =====================

// ====================== Application (Arduino side) ======================
#define NPAGES 7

U8G2_SH1106_128X64_NONAME_F_HW_I2C u8g2(U8G2_R0, U8X8_PIN_NONE);
PZEM004Tv30 pzem(Serial1, PZEM_RX, PZEM_TX);
Preferences prefs;

// ---- shared between the sampler task (core 0) and the main loop (core 1) ----
portMUX_TYPE featMux = portMUX_INITIALIZER_UNLOCKED;
WinFeat gFeat;
volatile uint32_t gFeatSeq = 0;
volatile uint32_t gDropped = 0;
static uint16_t rawBuf[WIN_N];

Detector det;

// ---- settings (saved in flash) ----
float tripLimitA = TRIP_LIMIT_DEFAULT;
int   hifMode = HIF_MODE_DEFAULT;
float hifSens = HIF_SENS_DEFAULT;

// ---- runtime state ----
bool  relayOn = false, tripped = false, streamData = true, featStream = false, injectOn = false;
char  tripReason[16] = "none";
uint32_t tripCount = 0, relayOnAt = 0, ocSince = 0;
float pv = 0, pi = 0, pp = 0, pe = 0, pfreq = 0, ppf = 0;
bool  pzemOk = false;
uint32_t lastPzemMs = 0, lastPzemGood = 0, lastSeq = 0, lastAlarmEvents = 0;
float prevI = 0;
WinFeat lastWin;
int   page = 0;
uint32_t pageHoldUntil = 0, pageChangedAt = 0;
float winRate = 0;
uint32_t winCntSec = 0, winRateT = 0;
String cmd = "";

const char *STATE_NAME[] = { "NO LOAD", "SETTLE", "LEARN", "ARMED", "UNSTABLE" };

struct TelemetrySnapshot {
  uint32_t seq;
  float v, i, p, pf, f, e, score, cusum, cf, asym, wid, edge, rough, shape, pkcv, wdcv, jit, dc, lobe, win;
  int load, hits;
  char state[12];
  char trip[16];
};

WiFiClient wifiClient;
PubSubClient mqttClient(wifiClient);
portMUX_TYPE telemetryMux = portMUX_INITIALIZER_UNLOCKED;
portMUX_TYPE commandMux = portMUX_INITIALIZER_UNLOCKED;
TelemetrySnapshot telemetrySnapshot = {};
volatile bool resetCommandRequested = false;
volatile bool tripCommandRequested = false;

// ---------- Saved settings ----------
void loadSettings() {
  prefs.begin("safenetq", true);
  tripLimitA = prefs.getFloat("limit", TRIP_LIMIT_DEFAULT);
  hifMode = prefs.getInt("hifm", HIF_MODE_DEFAULT);
  hifSens = prefs.getFloat("sens", HIF_SENS_DEFAULT);
  prefs.end();
  if (hifMode < 0 || hifMode > 2) hifMode = HIF_MODE_DEFAULT;
  if (hifSens < 0.3f || hifSens > 6.0f) hifSens = HIF_SENS_DEFAULT;
}

void saveSettings() {
  prefs.begin("safenetq", false);
  prefs.putFloat("limit", tripLimitA);
  prefs.putInt("hifm", hifMode);
  prefs.putFloat("sens", hifSens);
  prefs.end();
}

// ---------- Relay ----------
void setRelay(bool on) {
  relayOn = on;
  if (on) relayOnAt = millis();
  digitalWrite(RELAY_PIN, (on ^ RELAY_ACTIVE_LOW) ? HIGH : LOW);
  Serial.println(on ? ">> RELAY ON  = LOAD ON" : ">> RELAY OFF = LOAD OFF");
}

void resetTrip() {
  tripped = false;
  ocSince = 0;
  strcpy(tripReason, "none");
  detRelearn(det, millis());
  setRelay(true);
}

void tripNow(const char *why) {
  tripped = true;
  tripCount++;
  strncpy(tripReason, why, sizeof(tripReason) - 1);
  tripReason[sizeof(tripReason) - 1] = 0;
  setRelay(false);
  Serial.printf(">> TRIPPED (%s): I=%.3fA P=%.1fW limit=%.1fA | HIF state=%s score=%.2f cusum=%.1f hits=%d\n",
                why, pi, pp, tripLimitA, STATE_NAME[det.state], det.score, det.cusum, det.hitCount);
}

void captureTelemetry() {
  const float *s = det.sm;
  portENTER_CRITICAL(&telemetryMux);
  telemetrySnapshot.seq++;
  telemetrySnapshot.v = pv; telemetrySnapshot.i = pi; telemetrySnapshot.p = pp;
  telemetrySnapshot.pf = ppf; telemetrySnapshot.f = pfreq; telemetrySnapshot.e = pe;
  telemetrySnapshot.load = relayOn ? 1 : 0;
  telemetrySnapshot.score = det.score; telemetrySnapshot.cusum = det.cusum; telemetrySnapshot.hits = det.hitCount;
  telemetrySnapshot.cf = s[F_CF]; telemetrySnapshot.asym = s[F_ASYM]; telemetrySnapshot.wid = s[F_WIDTH];
  telemetrySnapshot.edge = s[F_EDGE]; telemetrySnapshot.rough = s[F_ROUGH]; telemetrySnapshot.shape = s[F_SHAPE];
  telemetrySnapshot.pkcv = s[F_PEAKCV]; telemetrySnapshot.wdcv = s[F_WIDTHCV]; telemetrySnapshot.jit = s[F_JIT];
  telemetrySnapshot.dc = lastWin.dcMv; telemetrySnapshot.lobe = lastWin.depthMv; telemetrySnapshot.win = winRate;
  strncpy(telemetrySnapshot.state, STATE_NAME[det.state], sizeof(telemetrySnapshot.state) - 1);
  strncpy(telemetrySnapshot.trip, tripReason, sizeof(telemetrySnapshot.trip) - 1);
  portEXIT_CRITICAL(&telemetryMux);
}

void formatTelemetryJson(const TelemetrySnapshot &t, char *out, size_t capacity) {
  snprintf(out, capacity,
    "{\"V\":%.1f,\"I\":%.3f,\"P\":%.1f,\"PF\":%.2f,\"F\":%.1f,\"E\":%.3f,\"Load\":%d,\"State\":\"%s\",\"Score\":%.2f,\"Cusum\":%.1f,\"Hits\":%d,\"CF\":%.2f,\"Asym\":%+.2f,\"Wid\":%.3f,\"Edge\":%.2f,\"Rough\":%.3f,\"Shape\":%.3f,\"PkCV\":%.3f,\"WdCV\":%.3f,\"Jit\":%.4f,\"DC\":%.0f,\"Lobe\":%.0f,\"Win\":%.1f,\"TripReason\":\"%s\"}",
    t.v, t.i, t.p, t.pf, t.f, t.e, t.load, t.state, t.score, t.cusum, t.hits,
    t.cf, t.asym, t.wid, t.edge, t.rough, t.shape, t.pkcv, t.wdcv, t.jit, t.dc, t.lobe, t.win, t.trip);
}

void onMqttMessage(char *topic, byte *payload, unsigned int length) {
  if (strcmp(topic, COMMAND_TOPIC) != 0) return;
  portENTER_CRITICAL(&commandMux);
  if (length == 5 && memcmp(payload, "reset", 5) == 0) resetCommandRequested = true;
  else if (length == 4 && memcmp(payload, "trip", 4) == 0) tripCommandRequested = true;
  portEXIT_CRITICAL(&commandMux);
}

void mqttTask(void *) {
  WiFi.mode(WIFI_STA);
  WiFi.setSleep(false);
  WiFi.begin(SECRET_WIFI_SSID, SECRET_WIFI_PASSWORD);
  mqttClient.setServer(SECRET_MQTT_BROKER, SECRET_MQTT_PORT);
  mqttClient.setCallback(onMqttMessage);
  mqttClient.setKeepAlive(20);
  mqttClient.setSocketTimeout(1);
  mqttClient.setBufferSize(512);

  uint32_t lastConnectAttempt = 0;
  uint32_t sentSeq = 0;
  for (;;) {
    const uint32_t now = millis();
    if (WiFi.status() != WL_CONNECTED && now - lastConnectAttempt > 5000) {
      lastConnectAttempt = now;
      WiFi.reconnect();
    } else if (WiFi.status() == WL_CONNECTED && !mqttClient.connected() && now - lastConnectAttempt > 5000) {
      lastConnectAttempt = now;
      char clientId[32];
      snprintf(clientId, sizeof(clientId), "SafeNetQ-v5-%04X", (unsigned)random(0xffff));
      if (mqttClient.connect(clientId)) {
        mqttClient.subscribe(COMMAND_TOPIC, 1);
        Serial.println(">> MQTT connected; subscribed to reset commands");
      }
    }

    if (mqttClient.connected()) {
      mqttClient.loop();
      TelemetrySnapshot copy;
      portENTER_CRITICAL(&telemetryMux);
      copy = telemetrySnapshot;
      portEXIT_CRITICAL(&telemetryMux);
      if (copy.seq != 0 && copy.seq != sentSeq) {
        char json[512];
        formatTelemetryJson(copy, json, sizeof(json));
        if (mqttClient.publish(TELEMETRY_TOPIC, json, false)) sentSeq = copy.seq;
      }
    }
    vTaskDelay(pdMS_TO_TICKS(10));
  }
}

// ---------- ZMCT sampler task (core 0) ----------
// Records a window of fixed-rate samples, analyses it and publishes the features.
// A window with a timing glitch (long gap between samples) is dropped.
static uint32_t tStamp[WIN_N];

void zmctTask(void *arg) {
  for (;;) {
    uint32_t t0 = micros();
    uint32_t next = t0;
    for (int k = 0; k < WIN_N; k++) {
      rawBuf[k] = (uint16_t)analogReadMilliVolts(SENSOR_PIN);
      tStamp[k] = micros();
      next += SAMPLE_US;
      while ((int32_t)(micros() - next) < 0) { }
    }
    bool glitch = false;
    for (int k = 1; k < WIN_N; k++) {
      if (tStamp[k] - tStamp[k - 1] > 2 * SAMPLE_US + 60) { glitch = true; break; }
    }
    if (glitch) {
      gDropped++;
    } else {
      float dt = (float)(tStamp[WIN_N - 1] - tStamp[0]) / (WIN_N - 1);
      WinFeat f;
      analyzeWindow(rawBuf, WIN_N, dt, f);
      portENTER_CRITICAL(&featMux);
      gFeat = f;
      gFeatSeq = gFeatSeq + 1;
      portEXIT_CRITICAL(&featMux);
    }
    vTaskDelay(1);
  }
}

// ---------- Serial commands ----------
void printHelp() {
  Serial.println();
  Serial.println("=== Commands (set Serial Monitor to 'Newline') ===");
  Serial.println("on / off / reset : relay control (reset clears a trip)");
  Serial.println("limit <A>        : overcurrent trip current (saved)");
  Serial.println("hif off|warn|trip: HIF action (warn = alert only, trip = cut the relay)");
  Serial.println("sens <x>         : HIF sensitivity 0.5..5, higher = more sensitive");
  Serial.println("relearn          : forget the HIF baseline and learn again");
  Serial.println("inject on|off    : fake arc-like irregularity to test alarm path");
  Serial.println("base             : print learned HIF baseline");
  Serial.println("stream / feat    : 1 Hz summary / every-window features (for logging)");
  Serial.println("s                : status");
  Serial.println("==================================================");
}

void printBase() {
  const char *nm[F_NUM] = { "PeakCV", "WidthCV", "Jitter", "Shape", "Rough", "Width", "Crest", "Asym", "Edge" };
  Serial.printf(">> detector %s | baseline mean (sd):\n", STATE_NAME[det.state]);
  for (int i = 0; i < F_NUM; i++) Serial.printf("   %-8s %.4f (%.4f)\n", nm[i], det.mu[i], det.sd[i]);
}

void handleCommand(String c) {
  c.trim();
  c.toLowerCase();
  if (c.length() == 0) return;

  if (c == "on" || c == "reset" || c == "1") resetTrip();
  else if (c == "off" || c == "0") setRelay(false);
  else if (c.startsWith("limit ")) {
    float v = c.substring(6).toFloat();
    if (v >= 0.5f && v <= 20) { tripLimitA = v; saveSettings(); Serial.printf(">> trip limit = %.1f A (saved)\n", v); }
    else Serial.println(">> Invalid (0.5 to 20 A)");
  }
  else if (c.startsWith("hif ")) {
    String a = c.substring(4); a.trim();
    if (a == "off") hifMode = 0; else if (a == "warn") hifMode = 1; else if (a == "trip") hifMode = 2;
    else { Serial.println(">> use: hif off | warn | trip"); return; }
    saveSettings();
    Serial.printf(">> HIF mode = %s (saved)\n", hifMode == 0 ? "OFF" : (hifMode == 1 ? "WARN" : "TRIP"));
  }
  else if (c.startsWith("sens ")) {
    float v = c.substring(5).toFloat();
    if (v >= 0.5f && v <= 5.0f) { hifSens = v; saveSettings(); Serial.printf(">> sensitivity = %.2f (saved)\n", v); }
    else Serial.println(">> Invalid (0.5 to 5)");
  }
  else if (c == "relearn") { detRelearn(det, millis()); Serial.println(">> HIF baseline will be learned again"); }
  else if (c == "inject on")  { injectOn = true;  Serial.println(">> INJECT ON (synthetic arc-like irregularity)"); }
  else if (c == "inject off") { injectOn = false; Serial.println(">> INJECT OFF"); }
  else if (c == "base") printBase();
  else if (c == "stream") { streamData = !streamData; Serial.println(streamData ? ">> Stream ON" : ">> Stream OFF"); }
  else if (c == "feat")   { featStream = !featStream; Serial.println(featStream ? ">> Feature stream ON" : ">> Feature stream OFF"); }
  else if (c == "s") {
    Serial.printf(">> LOAD:%s | trip:%s (%s) | limit:%.1fA | HIF:%s sens:%.2f | state:%s | alarms:%lu | dropped windows:%lu\n",
                  relayOn ? "ON" : "OFF", tripped ? "YES" : "no", tripReason, tripLimitA,
                  hifMode == 0 ? "OFF" : (hifMode == 1 ? "WARN" : "TRIP"), hifSens,
                  STATE_NAME[det.state], (unsigned long)det.alarmEvents, (unsigned long)gDropped);
  }
  else if (c == "?" || c == "help") printHelp();
  else Serial.println(">> Unknown command. Type ? for help");
}

void readSerial() {
  while (Serial.available()) {
    char ch = Serial.read();
    if (ch == '\n' || ch == '\r') { handleCommand(cmd); cmd = ""; }
    else if (cmd.length() < 24) cmd += ch;
  }
}

// ---------- PZEM ----------
void pollPzem(uint32_t now) {
  float v = pzem.voltage();
  float i = pzem.current();
  float p = pzem.power();
  float e = pzem.energy();
  float f = pzem.frequency();
  float pf = pzem.pf();
  bool ok = !isnan(v) && !isnan(i) && !isnan(p);
  pzemOk = ok;
  if (!ok) return;
  pv = v; pi = i; pp = p; pfreq = isnan(f) ? 0 : f; ppf = isnan(pf) ? 0 : pf;
  if (!isnan(e)) pe = e;
  lastPzemGood = now;

  // A clear change in load current = the load changed, so re-learn quietly.
  if (fabsf(i - prevI) > fmaxf(0.30f, 0.15f * prevI)) detLoadEvent(det, now);
  prevI = i;

  // Overcurrent trip (time based, uses fresh PZEM readings only)
  bool blanking = relayOn && (now - relayOnAt < INRUSH_BLANK_MS);
  if (relayOn && !tripped && !blanking) {
    if (i > tripLimitA * OC_INSTANT_X) {
      tripNow("OVERCURRENT");
    } else if (i > tripLimitA) {
      if (ocSince == 0) ocSince = now;
      if (now - ocSince >= OC_TIME_MS) tripNow("OVERCURRENT");
    } else ocSince = 0;
  } else if (!relayOn || blanking) ocSince = 0;
}

// ---------- OLED ----------
static void row(int i, const char *label, const char *val) {
  int y = 21 + 10 * i;
  u8g2.drawStr(0, y, label);
  int w = u8g2.getStrWidth(val);
  u8g2.drawStr(128 - w, y, val);
}

static void header(int idx, const char *title, const char *st) {
  char b[24];
  snprintf(b, sizeof(b), "%d/%d %s", idx + 1, NPAGES, title);
  u8g2.drawStr(0, 8, b);
  u8g2.drawStr(128 - u8g2.getStrWidth(st), 8, st);
  u8g2.drawHLine(0, 10, 128);
}

const char *zmctStatus() {
  if (lastWin.noSignal) return (pzemOk && pi > 0.5f) ? "BLIND" : "NO SIG";
  if (lastWin.noCeil) return "NO CEIL";
  if (!lastWin.valid) return "ODD";
  return "OK";
}

void drawAlert(uint32_t now) {
  u8g2.setFont(u8g2_font_7x13B_tr);
  char b[28];
  if (tripped) {
    u8g2.drawStr(0, 13, "** TRIPPED **");
    snprintf(b, sizeof(b), "%s", tripReason);
  } else {
    u8g2.drawStr(0, 13, "** HIF ALERT **");
    snprintf(b, sizeof(b), "arc-like waveform");
  }
  u8g2.drawStr(0, 28, b);
  u8g2.setFont(u8g2_font_6x10_tr);
  snprintf(b, sizeof(b), "I %.2fA  P %.0fW", pi, pp);               u8g2.drawStr(0, 42, b);
  snprintf(b, sizeof(b), "score %.1f cusum %.0f", det.score, det.cusum); u8g2.drawStr(0, 52, b);
  u8g2.drawStr(0, 62, tripped ? "BOOT = reset" : (hifMode == 2 ? "trip armed" : "warn mode, no trip"));
}

void drawScreen(uint32_t now) {
  u8g2.clearBuffer();
  u8g2.setFont(u8g2_font_6x10_tr);

  bool alertPhase = (tripped || det.alarm) && (tripped || ((now / 1500) & 1));
  if (alertPhase) { drawAlert(now); u8g2.sendBuffer(); return; }

  const char *st = tripped ? "TRIP" : (det.alarm ? "HIF!" : (det.warn ? "HIF?" : (relayOn ? "ON" : "OFF")));
  char a[24], b[24];
  const float *s = det.sm;
  bool hv = det.smInit && (det.state != D_NOLOAD);

  switch (page) {
    case 0:
      header(0, "MAINS", st);
      if (pzemOk) {
        snprintf(b, sizeof(b), "%.1f V", pv);   row(0, "Voltage", b);
        snprintf(b, sizeof(b), "%.3f A", pi);   row(1, "Current", b);
        snprintf(b, sizeof(b), "%.1f W", pp);   row(2, "Power", b);
        snprintf(b, sizeof(b), "%.2f", ppf);    row(3, "PF", b);
        snprintf(b, sizeof(b), "%.1f Hz", pfreq); row(4, "Freq", b);
      } else { row(0, "PZEM", "no data"); row(1, "check", "TX=10 RX=11"); row(2, "PZEM", "5V + GND"); }
      break;
    case 1: {
      header(1, "POWER", st);
      float S = pv * pi, Q = (S > pp) ? sqrtf(S * S - pp * pp) : 0;
      snprintf(b, sizeof(b), "%.3f kWh", pe);  row(0, "Energy", b);
      snprintf(b, sizeof(b), "%.0f VA", S);    row(1, "Apparent", b);
      snprintf(b, sizeof(b), "%.0f var", Q);   row(2, "Reactive", b);
      snprintf(b, sizeof(b), "%.1f A", tripLimitA); row(3, "Trip lim", b);
      snprintf(b, sizeof(b), "%.0f %%", 100.0f * pi / tripLimitA); row(4, "Load", b);
      break;
    }
    case 2: {
      header(2, "HIF", st);
      row(0, "State", STATE_NAME[det.state]);
      snprintf(b, sizeof(b), "%.2f", det.score);                      row(1, "Score", b);
      snprintf(b, sizeof(b), "%.0f/%.0f", det.cusum, TRIP_H);         row(2, "CUSUM", b);
      snprintf(b, sizeof(b), "%d/24", det.hitCount);                  row(3, "Hits", b);
      if (det.state == D_ARMED) snprintf(b, sizeof(b), "READY");
      else if (det.state == D_LEARN || det.state == D_UNSTABLE) snprintf(b, sizeof(b), "%d %%", (det.learnGood + det.learnBad) * 100 / LEARN_N);
      else snprintf(b, sizeof(b), "--");
      row(4, "Baseline", b);
      break;
    }
    case 3:
      header(3, "WAVE A", st);
      if (hv) {
        snprintf(b, sizeof(b), "%.2f", s[F_CF]);        row(0, "Crest", b);
        snprintf(b, sizeof(b), "%+.2f", s[F_ASYM]);     row(1, "Asym", b);
        snprintf(b, sizeof(b), "%.1f %%", 100 * s[F_WIDTH]); row(2, "Width", b);
        snprintf(b, sizeof(b), "%.1f", s[F_EDGE]);      row(3, "di/dt", b);
        snprintf(b, sizeof(b), "%.3f", s[F_ROUGH]);     row(4, "Rough", b);
      } else { row(0, "Crest", "--"); row(1, "Asym", "--"); row(2, "Width", "--"); row(3, "di/dt", "--"); row(4, "Rough", "--"); }
      break;
    case 4:
      header(4, "WAVE B", st);
      if (hv) {
        snprintf(b, sizeof(b), "%.3f", s[F_SHAPE]);          row(0, "Shape", b);
        snprintf(b, sizeof(b), "%.1f %%", 100 * s[F_PEAKCV]); row(1, "PeakVar", b);
        snprintf(b, sizeof(b), "%.1f %%", 100 * s[F_WIDTHCV]); row(2, "WidthVar", b);
        snprintf(b, sizeof(b), "%.2f %%", 100 * s[F_JIT]);   row(3, "Jitter", b);
        snprintf(b, sizeof(b), "%.2f ms", lastWin.periodMs); row(4, "Period", b);
      } else { row(0, "Shape", "--"); row(1, "PeakVar", "--"); row(2, "WidthVar", "--"); row(3, "Jitter", "--"); row(4, "Period", "--"); }
      break;
    case 5:
      header(5, "SIGNAL", st);
      snprintf(b, sizeof(b), "%.0f mV", lastWin.dcMv);    row(0, "DC mean", b);
      snprintf(b, sizeof(b), "%.0f mV", lastWin.depthMv); row(1, "Lobe", b);
      snprintf(b, sizeof(b), "%.0f mV", lastWin.ceilMv);  row(2, "Ceiling", b);
      row(3, "ZMCT", zmctStatus());
      snprintf(b, sizeof(b), "%.1f", winRate);            row(4, "Win/s", b);
      break;
    default: {
      header(6, "SYSTEM", st);
      row(0, "Relay", relayOn ? "ON" : "OFF");
      row(1, "Trip", tripReason);
      snprintf(b, sizeof(b), "%lu", (unsigned long)tripCount);   row(2, "Trips", b);
      snprintf(a, sizeof(a), "%s%s", hifMode == 0 ? "OFF" : (hifMode == 1 ? "WARN" : "TRIP"), injectOn ? "+INJ" : "");
      row(3, "HIF mode", a);
      uint32_t sec = now / 1000;
      snprintf(b, sizeof(b), "%02lu:%02lu:%02lu", (unsigned long)(sec / 3600), (unsigned long)((sec / 60) % 60), (unsigned long)(sec % 60));
      row(4, "Uptime", b);
      break;
    }
  }
  u8g2.sendBuffer();
}

// ---------- Setup ----------
void setup() {
  Serial.begin(115200);
  uint32_t t0 = millis();
  while (!Serial && millis() - t0 < 2000);

  pinMode(RELAY_PIN, OUTPUT);
  pinMode(BTN_PIN, INPUT_PULLUP);
  setRelay(false);

  loadSettings();
  detReset(det);
  memset(&lastWin, 0, sizeof(lastWin));
  memset(&gFeat, 0, sizeof(gFeat));
  Serial.printf(">> Loaded: trip limit %.1f A, HIF mode %d, sens %.2f\n", tripLimitA, hifMode, hifSens);

  analogReadResolution(12);
  analogSetPinAttenuation(SENSOR_PIN, ADC_11db);

  Wire.begin(SDA_PIN, SCL_PIN);
  Wire.setClock(400000);
  u8g2.setI2CAddress(0x3C << 1);
  u8g2.begin();
  u8g2.clearBuffer();
  u8g2.setFont(u8g2_font_ncenB08_tr);
  u8g2.drawStr(0, 25, "SafeNetQ HIF Guard");
  u8g2.drawStr(0, 45, "LOAD: OFF");
  u8g2.sendBuffer();
  delay(BOOT_DELAY_MS);

  esp_task_wdt_config_t wdt = { .timeout_ms = WDT_TIMEOUT_MS, .idle_core_mask = 0, .trigger_panic = true };
  if (esp_task_wdt_init(&wdt) != ESP_OK) esp_task_wdt_reconfigure(&wdt);
  esp_task_wdt_add(NULL);

  xTaskCreatePinnedToCore(zmctTask, "zmct", 8192, NULL, 2, NULL, 0);
  xTaskCreatePinnedToCore(mqttTask, "mqtt", 6144, NULL, 1, NULL, 0);

  setRelay(true);
  printHelp();
}

// ---------- Loop ----------
void loop() {
  static uint32_t lastOled = 0, lastPrint = 0, btnT = 0;
  static bool btnPrev = false;
  uint32_t now = millis();

  esp_task_wdt_reset();
  readSerial();

  bool resetFromMqtt = false, tripFromMqtt = false;
  portENTER_CRITICAL(&commandMux);
  resetFromMqtt = resetCommandRequested;
  tripFromMqtt = tripCommandRequested;
  resetCommandRequested = false;
  tripCommandRequested = false;
  portEXIT_CRITICAL(&commandMux);
  if (tripFromMqtt && relayOn && !tripped) tripNow("MANUAL");
  if (resetFromMqtt && tripped) resetTrip();

  // --- PZEM (also runs the overcurrent trip) ---
  if (now - lastPzemMs >= PZEM_POLL_MS) {
    lastPzemMs = now;
    pollPzem(now);
    esp_task_wdt_reset();
    if (PZEM_LOSS_TRIPS && relayOn && !tripped && now - lastPzemGood > 3000 && now > 6000) tripNow("PZEM LOST");
  }

  // --- new ZMCT window from the sampler task ---
  uint32_t seq;
  WinFeat f;
  portENTER_CRITICAL(&featMux);
  seq = gFeatSeq;
  f = gFeat;
  portEXIT_CRITICAL(&featMux);
  if (seq != lastSeq) {
    lastSeq = seq;
    lastWin = f;
    winCntSec++;
    if (hifMode != 0) detUpdate(det, f, now, injectOn, hifSens);

    if (featStream) {
      Serial.printf("W,%lu,%s,%d,%.4f,%.4f,%.4f,%.4f,%.4f,%.4f,%.3f,%+.3f,%.3f,%.2f,%.2f\n",
                    (unsigned long)now, STATE_NAME[det.state], f.valid ? 1 : 0,
                    f.f[F_PEAKCV], f.f[F_WIDTHCV], f.f[F_JIT], f.f[F_SHAPE], f.f[F_ROUGH],
                    f.f[F_WIDTH], f.f[F_CF], f.f[F_ASYM], f.f[F_EDGE], det.score, det.cusum);
    }
  }

  // --- HIF action ---
  if (hifMode == 0) { det.warn = false; det.alarm = false; }
  if (det.alarmEvents != lastAlarmEvents) {
    lastAlarmEvents = det.alarmEvents;
    Serial.printf(">> HIF ALARM: state=%s score=%.2f cusum=%.1f hits=%d zIrr=%.2f zShape=%.2f\n",
                  STATE_NAME[det.state], det.score, det.cusum, det.hitCount, det.zIrr, det.zShape);
  }
  if (hifMode == 2 && det.alarm && relayOn && !tripped && now - relayOnAt > 1500) tripNow("HIF");

  // --- BOOT button: short = next page / reset trip, long = relearn ---
  bool b = (digitalRead(BTN_PIN) == LOW);
  if (b && !btnPrev) btnT = now;
  if (!b && btnPrev) {
    uint32_t dur = now - btnT;
    if (dur > 1200) { detRelearn(det, now); Serial.println(">> HIF baseline will be learned again"); }
    else if (dur > 30) {
      if (tripped) resetTrip();
      else { page = (page + 1) % NPAGES; pageHoldUntil = now + 10000; pageChangedAt = now; }
    }
  }
  btnPrev = b;

  // --- page rotation ---
  if (now > pageHoldUntil && now - pageChangedAt >= PAGE_MS) { page = (page + 1) % NPAGES; pageChangedAt = now; }

  // --- OLED ---
  if (now - lastOled >= OLED_MS) { lastOled = now; drawScreen(now); }

  // --- window rate + 1 Hz summary ---
  if (now - winRateT >= 1000) {
    winRate = winCntSec * 1000.0f / (now - winRateT);
    winCntSec = 0; winRateT = now;
  }
  if (now - lastPrint >= 1000) {
    lastPrint = now;
    captureTelemetry();
    if (streamData) {
      TelemetrySnapshot copy;
      portENTER_CRITICAL(&telemetryMux);
      copy = telemetrySnapshot;
      portEXIT_CRITICAL(&telemetryMux);
      char json[512];
      formatTelemetryJson(copy, json, sizeof(json));
      Serial.println(json);
    }
  }

  delay(5);
}
