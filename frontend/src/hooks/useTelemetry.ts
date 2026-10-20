import { useState, useEffect, useCallback } from 'react';
import { io } from 'socket.io-client';
import axios from 'axios';
import type { DetectorMetrics, DetectorState, FaultLog, HifMetrics, MetricData, PzemMetrics, TelemetryPoint } from '../types/dashboard';

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
const socket = io(apiUrl);
const metric = (label: string, unit = ''): MetricData => ({ label, value: 0, unit, history: [] });
const append = (old: MetricData, value: number | undefined, time: string): MetricData => value === undefined
  ? old
  : { ...old, value, history: [...old.history, { val: value, time }].slice(-60) };
const readNumber = (...values: unknown[]): number | undefined => {
  const value = values.find(candidate => candidate !== undefined && candidate !== null && candidate !== '');
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value === 'string') { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : undefined; }
  return undefined;
};
const normalizeState = (state: unknown): DetectorState => {
  const normalized = String(state ?? 'UNKNOWN').trim().toUpperCase().replaceAll('_', ' ');
  return (['NO LOAD', 'SETTLE', 'LEARN', 'ARMED', 'UNSTABLE'] as string[]).includes(normalized) ? normalized as DetectorState : 'UNKNOWN';
};

export function useTelemetry() {
  const [isConnected, setIsConnected] = useState(socket.connected);
  const [logs, setLogs] = useState<FaultLog[]>([]);
  const [detectorState, setDetectorState] = useState<DetectorState>('UNKNOWN');
  const [relayState, setRelayState] = useState(false);
  const [rmsHistory, setRmsHistory] = useState<TelemetryPoint[]>([]);
  const [pzemData, setPzemData] = useState<PzemMetrics>({
    voltage: metric('Voltage', 'V'), current: metric('Current', 'A'), realPower: metric('Real Power', 'W'),
    energy: metric('Energy', 'kWh'), frequency: metric('Frequency', 'Hz'), powerFactor: metric('Power Factor')
  });
  const [hifData, setHifData] = useState<HifMetrics>({
    crestFactor: metric('Crest Factor'), asymmetry: metric('Asymmetry'), width: metric('Width'), edge: metric('Edge / di-dt'),
    roughness: metric('Roughness'), shapeShift: metric('Shape Shift'), peakCv: metric('Peak CV'),
    widthCv: metric('Width CV'), jitter: metric('Jitter')
  });
  const [detectorData, setDetectorData] = useState<DetectorMetrics>({ score: metric('Score'), cusum: metric('CUSUM'), hits: metric('Hits', '/ 24') });

  useEffect(() => {
    const handleConnect = () => setIsConnected(true);
    const handleDisconnect = () => setIsConnected(false);
    const handleTelemetry = (data: any) => {
      const t = data.telemetry ?? data;
      const stamp = new Date().toISOString();
      const now = new Date(stamp).toLocaleTimeString();
      const current = readNumber(t.I, t.rms_current, t.current_rms, t.currentRms);
      const rawState = t.State ?? t.state;
      setDetectorState(normalizeState(rawState));
      setRelayState(Boolean(readNumber(t.Load, t.load, data.relay_state) ?? (t.Load === true)));
      if (current !== undefined) setRmsHistory(prev => [...prev, { time: now, rmsCurrent: current }].slice(-60));
      setPzemData(prev => ({
        voltage: append(prev.voltage, readNumber(t.V, t.voltage), stamp),
        current: append(prev.current, current, stamp),
        realPower: append(prev.realPower, readNumber(t.P, t.real_power, t.realPower), stamp),
        energy: append(prev.energy, readNumber(t.E, t.energy), stamp),
        frequency: append(prev.frequency, readNumber(t.F, t.frequency), stamp),
        powerFactor: append(prev.powerFactor, readNumber(t.PF, t.power_factor, t.powerFactor), stamp)
      }));
      setHifData(prev => ({
        crestFactor: append(prev.crestFactor, readNumber(t.CF, t.crest_factor, t.crestFactor), stamp),
        asymmetry: append(prev.asymmetry, readNumber(t.Asym, t.asymmetry), stamp),
        width: append(prev.width, readNumber(t.Wid, t.width), stamp),
        edge: append(prev.edge, readNumber(t.Edge, t.edge, t.di_dt), stamp),
        roughness: append(prev.roughness, readNumber(t.Rough, t.roughness), stamp),
        shapeShift: append(prev.shapeShift, readNumber(t.Shape, t.shape), stamp),
        peakCv: append(prev.peakCv, readNumber(t.PkCV, t.peak_cv), stamp),
        widthCv: append(prev.widthCv, readNumber(t.WdCV, t.width_cv), stamp),
        jitter: append(prev.jitter, readNumber(t.Jit, t.jitter), stamp)
      }));
      setDetectorData(prev => ({
        score: append(prev.score, readNumber(t.Score, t.score), stamp),
        cusum: append(prev.cusum, readNumber(t.Cusum, t.cusum), stamp),
        hits: append(prev.hits, readNumber(t.Hits, t.hits), stamp)
      }));
    };
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('telemetry_update', handleTelemetry);
    axios.get(`${apiUrl}/api/faults`).then(({ data }) => setLogs(data.map((log: any) => ({
      id: log.id, timestamp: log.timestamp, type: log.fault_type,
      rmsCurrent: log.rms_current_amps ?? log.peak_current_amps ?? log.current_amps ?? 0,
      crestFactor: log.cf ?? log.crest_factor ?? 0, diDt: log.edge ?? log.di_dt ?? 0,
      score: log.score ?? 0, cusum: log.cusum ?? 0, jitter: log.jitter ?? 0,
      actionTaken: log.action_taken ?? ''
    })))).catch(error => console.error('Error fetching faults:', error));
    return () => {
      socket.off('connect', handleConnect); socket.off('disconnect', handleDisconnect);
      socket.off('telemetry_update', handleTelemetry);
    };
  }, []);

  const sendCommand = useCallback((command: string) => socket.emit('device_command', { command }), []);
  return { isConnected, logs, detectorState, relayState, rmsHistory, pzemData, hifData, detectorData, sendCommand };
}
