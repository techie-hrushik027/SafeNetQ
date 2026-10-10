export type SystemState = 'NORMAL' | 'OVERCURRENT' | 'SHORT_CIRCUIT' | 'HIF';

export interface TelemetryPoint {
  time: string;
  rmsCurrent: number;
}

export interface MetricData {
  label: string;
  value: number;
  unit: string;
  history: { val: number }[];
}

export interface PzemMetrics {
  voltage: MetricData;
  realPower: MetricData;
  energy: MetricData;
  frequency: MetricData;
  powerFactor: MetricData;
}

export interface ZmctMetrics {
  peakCurrent: MetricData;
  crestFactor: MetricData;
  diDt: MetricData;
}

export interface FaultLog {
  id: number;
  timestamp: string;
  type: SystemState;
  rmsCurrent: number;
  crestFactor: number;
  diDt: number;
  actionTaken: string;
}