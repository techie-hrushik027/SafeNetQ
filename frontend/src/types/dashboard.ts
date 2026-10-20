export type DetectorState = 'NO LOAD' | 'SETTLE' | 'LEARN' | 'ARMED' | 'UNSTABLE' | 'UNKNOWN';
// Retained for historical fault rows produced by the earlier bridge schema.
export type SystemState = 'NORMAL' | 'OVERCURRENT' | 'SHORT_CIRCUIT' | 'HIF' | DetectorState;

export interface TelemetryPoint {
  time: string;
  rmsCurrent: number;
}

export interface MetricData {
  label: string;
  value: number;
  unit: string;
  history: { val: number; time?: string }[];
}

export interface PzemMetrics {
  voltage: MetricData;
  current: MetricData;
  realPower: MetricData;
  energy: MetricData;
  frequency: MetricData;
  powerFactor: MetricData;
}

export interface HifMetrics {
  crestFactor: MetricData;
  asymmetry: MetricData;
  width: MetricData;
  edge: MetricData;
  roughness: MetricData;
  shapeShift: MetricData;
  peakCv: MetricData;
  widthCv: MetricData;
  jitter: MetricData;
}

export interface DetectorMetrics {
  score: MetricData;
  cusum: MetricData;
  hits: MetricData;
}

export interface FaultLog {
  id: number;
  timestamp: string;
  type: SystemState;
  rmsCurrent: number;
  crestFactor: number;
  diDt: number;
  score: number;
  cusum: number;
  jitter: number;
  actionTaken: string;
}
