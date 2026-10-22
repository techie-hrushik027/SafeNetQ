import { useState, useEffect, useCallback, useRef } from 'react';
import { io } from 'socket.io-client';
import axios from 'axios';
import type { CommandResult, DetectorMetrics, DetectorState, DeviceMessage, FaultLog, HifMetrics, MetricData, PzemMetrics, TelemetryPoint } from '../types/dashboard';

const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000';
const socket = io(apiUrl, { reconnection: true });

const metric = (label: string, unit = ''): MetricData => ({ label, value: 0, unit, history: [] });
const append = (old: MetricData, value: number | undefined, time: string): MetricData => value === undefined
  ? old
  : { ...old, value, history: [...old.history, { val: value, time }].slice(-120) };
const readNumber = (...values: unknown[]): number | undefined => {
  for (const value of values) {
    if (value === undefined || value === null || value === '') continue;
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return undefined;
};
const normalizeState = (state: unknown): DetectorState => {
  const normalized = String(state ?? 'UNKNOWN').trim().toUpperCase().replaceAll('_', ' ');
  return (['NO LOAD', 'SETTLE', 'LEARN', 'ARMED', 'UNSTABLE'] as string[]).includes(normalized)
    ? normalized as DetectorState
    : 'UNKNOWN';
};
const mapFault = (log: any): FaultLog => ({
  id: Number(log.id) || Date.now(),
  timestamp: String(log.timestamp ?? new Date().toISOString()),
  type: log.fault_type ?? 'HIF',
  rmsCurrent: Number(log.rms_current_amps ?? log.peak_current_amps ?? log.current_amps ?? 0),
  crestFactor: Number(log.cf ?? log.crest_factor ?? 0),
  diDt: Number(log.edge ?? log.di_dt ?? 0),
  score: Number(log.score ?? 0),
  cusum: Number(log.cusum ?? 0),
  jitter: Number(log.jitter ?? 0),
  actionTaken: String(log.action_taken ?? '')
});

export function useTelemetry() {
  const [isConnected, setIsConnected] = useState(socket.connected);
  const [mqttConnected, setMqttConnected] = useState(false);
  const [databaseConnected, setDatabaseConnected] = useState(false);
  const [logsError, setLogsError] = useState('');
  const [logs, setLogs] = useState<FaultLog[]>([]);
  const [deviceMessages, setDeviceMessages] = useState<DeviceMessage[]>([]);
  const [commandResult, setCommandResult] = useState<CommandResult | null>(null);
  const previousDatabaseStatus = useRef(false);
  const [detectorState, setDetectorState] = useState<DetectorState>('UNKNOWN');
  const [tripReason, setTripReason] = useState('none');
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
  const [detectorData, setDetectorData] = useState<DetectorMetrics>({
    score: metric('Score'), cusum: metric('CUSUM'), hits: metric('Hits', '/ 24')
  });

  const refreshFaults = useCallback(async () => {
    try {
      const { data } = await axios.get(`${apiUrl}/api/faults`);
      if (!Array.isArray(data)) throw new Error('Fault API returned an unexpected response');
      setLogs(data.map(mapFault));
      setLogsError('');
    } catch (error) {
      const message = axios.isAxiosError(error) && error.response?.status === 503
        ? 'MySQL is unavailable; fault events cannot be saved.'
        : 'Could not load saved fault logs from the bridge.';
      setLogsError(message);
    }
  }, []);

  const refreshHealth = useCallback(async () => {
    try {
      const { data } = await axios.get(`${apiUrl}/api/health`, { timeout: 3000 });
      setMqttConnected(Boolean(data.mqtt));
      setDatabaseConnected(Boolean(data.database));
      if (data.database && !previousDatabaseStatus.current) void refreshFaults();
      previousDatabaseStatus.current = Boolean(data.database);
    } catch {
      setMqttConnected(false);
      setDatabaseConnected(false);
      previousDatabaseStatus.current = false;
    }
  }, [refreshFaults]);

  useEffect(() => {
    const handleConnect = () => {
      setIsConnected(true);
      void refreshFaults();
      void refreshHealth();
    };
    const handleDisconnect = () => setIsConnected(false);
    const handleTelemetry = (data: any) => {
      const t = data.telemetry ?? data;
      const stamp = new Date().toISOString();
      const now = new Date(stamp).toLocaleTimeString();
      const current = readNumber(t.I, t.rms_current, t.current_rms, t.currentRms);
      const rawState = t.State ?? t.state;
      const rawTripReason = t.TripReason ?? t.trip_reason;
      setDetectorState(normalizeState(rawState));
      if (rawTripReason !== undefined && rawTripReason !== null) setTripReason(String(rawTripReason));
      setRelayState(Boolean(readNumber(t.Load, t.load, data.relay_state) ?? (t.Load === true)));
      if (current !== undefined) setRmsHistory(prev => [...prev, { time: now, rmsCurrent: current }].slice(-120));
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
    const handleFaultLogged = (row: any) => {
      const fault = mapFault(row);
      setLogs(prev => [fault, ...prev.filter(item => item.id !== fault.id)].slice(0, 100));
      setLogsError('');
    };
    const handleDeviceMessage = (event: DeviceMessage) => {
      setDeviceMessages(prev => [event, ...prev.filter(item => item.id !== event.id)].slice(0, 80));
    };
    const handleCommandResult = (result: CommandResult) => setCommandResult(result);
    const handleFaultLogError = (result: { error?: string }) => setLogsError(result.error || 'Fault log save failed.');

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('telemetry_update', handleTelemetry);
    socket.on('fault_logged', handleFaultLogged);
    socket.on('device_message', handleDeviceMessage);
    socket.on('command_result', handleCommandResult);
    socket.on('fault_log_error', handleFaultLogError);
    if (socket.connected) handleConnect();
    void refreshFaults();
    void refreshHealth();
    const healthTimer = window.setInterval(() => void refreshHealth(), 5000);

    return () => {
      window.clearInterval(healthTimer);
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('telemetry_update', handleTelemetry);
      socket.off('fault_logged', handleFaultLogged);
      socket.off('device_message', handleDeviceMessage);
      socket.off('command_result', handleCommandResult);
      socket.off('fault_log_error', handleFaultLogError);
    };
  }, [refreshFaults, refreshHealth]);

  const sendCommand = useCallback((command: string) => {
    setCommandResult(null);
    socket.emit('device_command', { command });
  }, []);

  return {
    isConnected, mqttConnected, databaseConnected, logsError, logs, deviceMessages, commandResult,
    detectorState, tripReason, relayState, rmsHistory, pzemData, hifData, detectorData, sendCommand
  };
}
