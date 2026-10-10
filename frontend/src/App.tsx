/**
 * App.tsx
 * 
 * Main application root for SafeNetQ.
 * Implements the core layout shell: a fixed 64-width left sidebar and flexible main content.
 * Includes a simulated interval loop to mimic WebSocket telemetry injection for the graphs.
 */
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
import { Sidebar } from './components/Sidebar';
import { OperatorView } from './components/operatotview';
import { TechnicianView } from './components/TechnicianView';
import type { SystemState, TelemetryPoint, PzemMetrics, ZmctMetrics, FaultLog } from './types/dashboard';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';
const socket = io(API_URL, { autoConnect: false });

interface FaultApiRow {
  id: number;
  timestamp: string;
  fault_type: string;
  peak_current_amps: number;
  crest_factor: number;
  di_dt: number;
  action_taken: string;
}

export const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<'operator' | 'technician'>('operator');
  const [systemStatus, setSystemStatus] = useState<SystemState>('NORMAL');
  const [relayState, setRelayState] = useState<boolean>(false);
  
  // Base State Maps
  const [rmsHistory, setRmsHistory] = useState<TelemetryPoint[]>([]);
  const [pzemData, setPzemData] = useState<PzemMetrics>({
    voltage: { label: 'Voltage', value: 230.1, unit: 'V', history: Array(10).fill({ val: 230 }) },
    realPower: { label: 'Real Power', value: 450.5, unit: 'W', history: Array(10).fill({ val: 450 }) },
    energy: { label: 'Energy', value: 12.45, unit: 'kWh', history: Array(10).fill({ val: 12.45 }) },
    frequency: { label: 'Frequency', value: 50.0, unit: 'Hz', history: Array(10).fill({ val: 50 }) },
    powerFactor: { label: 'Power Factor', value: 0.95, unit: '', history: Array(10).fill({ val: 0.95 }) },
  });
  const [zmctData, setZmctData] = useState<ZmctMetrics>({
    peakCurrent: { label: 'Peak Current', value: 2.8, unit: 'A', history: Array(10).fill({ val: 2.8 }) },
    crestFactor: { label: 'Crest Factor', value: 1.41, unit: '', history: Array(10).fill({ val: 1.41 }) },
    diDt: { label: 'di/dt', value: 0.12, unit: 'A/ms', history: Array(10).fill({ val: 0.12 }) },
  });
  const [logs, setLogs] = useState<FaultLog[]>([]);

  // Load historical faults and subscribe to live telemetry from the bridge.
  useEffect(() => {
    axios.get<FaultApiRow[]>(`${API_URL}/api/faults`)
      .then(({ data }) => {
        setLogs(data.map((log) => ({
          id: log.id,
          timestamp: log.timestamp,
          type: log.fault_type as SystemState,
          // The database currently stores peak current; the table labels this RMS.
          rmsCurrent: log.peak_current_amps,
          crestFactor: log.crest_factor,
          diDt: log.di_dt,
          actionTaken: log.action_taken,
        })));
      })
      .catch((error: unknown) => console.error('Error fetching faults:', error));

    const handleTelemetry = (data: {
      status: SystemState;
      relay_state: number | boolean;
      rms_current: number;
      peak_current: number;
      crest_factor: number;
      di_dt: number;
      voltage: number;
    }) => {
      const now = new Date().toLocaleTimeString();
      setSystemStatus(data.status);
      setRelayState(data.relay_state === 1 || data.relay_state === true);
      setRmsHistory((prev) => [...prev, { time: now, rmsCurrent: data.rms_current }].slice(-30));
      setZmctData((prev) => ({
        peakCurrent: { ...prev.peakCurrent, value: data.peak_current, history: [...prev.peakCurrent.history, { val: data.peak_current }].slice(-10) },
        crestFactor: { ...prev.crestFactor, value: data.crest_factor, history: [...prev.crestFactor.history, { val: data.crest_factor }].slice(-10) },
        diDt: { ...prev.diDt, value: data.di_dt, history: [...prev.diDt.history, { val: data.di_dt }].slice(-10) },
      }));
      setPzemData((prev) => ({
        ...prev,
        voltage: { ...prev.voltage, value: data.voltage, history: [...prev.voltage.history, { val: data.voltage }].slice(-10) },
      }));
    };

    socket.connect();
    socket.on('telemetry_update', handleTelemetry);
    return () => {
      socket.off('telemetry_update', handleTelemetry);
      socket.disconnect();
    };
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex font-sans antialiased text-gray-900">
      <Sidebar currentView={currentView} setCurrentView={setCurrentView} systemStatus={systemStatus} />
      <div className="flex-1 ml-64 p-6">
        <header className="mb-4 pb-3 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold tracking-tight text-gray-900">SafeNetQ Monitor</h1>
            <p className="text-xs text-gray-500">Edge-AI Sub-50ms Fault Isolation</p>
          </div>
          <div className="text-xs font-mono text-gray-500 bg-white border border-gray-200 px-3 py-1 rounded">
            Broker: <span className="text-green-600 font-semibold">Connected (MQTT/WS)</span>
          </div>
        </header>
        <main>
          {currentView === 'operator' ? (
            <OperatorView rmsHistory={rmsHistory} pzemData={pzemData} zmctData={zmctData} />
          ) : (
            <TechnicianView relayState={relayState} onTripRelay={() => setRelayState(true)} onResetRelay={() => setRelayState(false)} logs={logs} />
          )}
        </main>
      </div>
    </div>
  );
};

export default App;
