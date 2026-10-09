/**
 * App.tsx
 * 
 * Main application root for SafeNetQ.
 * Implements the core layout shell: a fixed 64-width left sidebar and flexible main content.
 * Includes a simulated interval loop to mimic WebSocket telemetry injection for the graphs.
 */
import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { OperatorView } from './components/operatotview';
import { TechnicianView } from './components/TechnicianView';
import type{ SystemState, TelemetryPoint, PzemMetrics, ZmctMetrics, FaultLog } from './types/dashboard';

export const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<'operator' | 'technician'>('operator');
  const [systemStatus ] = useState<SystemState>('NORMAL');
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
  const [logs, ] = useState<FaultLog[]>([
    { id: 101, timestamp: '2026-10-07 14:12:02', type: 'OVERCURRENT', rmsCurrent: 18.5, crestFactor: 1.82, diDt: 1.45, actionTaken: 'Relay Tripped (<50ms)' }
  ]);

  // Telemetry Simulator Loop
  useEffect(() => {
    const interval = setInterval(() => {
      const timeStr = new Date().toTimeString().split(' ')[0];
      const baseRms = relayState ? 0 : 1.95 + (Math.random() * 0.2 - 0.1);
      
      setRmsHistory(prev => [...prev.slice(-29), { time: timeStr, rmsCurrent: Number(baseRms.toFixed(2)) }]);

      if (!relayState) {
        setPzemData(prev => ({
          voltage: { ...prev.voltage, value: 230 + (Math.random() * 2 - 1), history: [...prev.voltage.history.slice(1), { val: 230 + Math.random() }] },
          realPower: { ...prev.realPower, value: baseRms * 230 * 0.95, history: [...prev.realPower.history.slice(1), { val: baseRms * 230 * 0.95 }] },
          energy: { ...prev.energy, value: prev.energy.value + 0.0001 },
          frequency: { ...prev.frequency, value: 50.0 + (Math.random() * 0.1 - 0.05), history: [...prev.frequency.history.slice(1), { val: 50 }] },
          powerFactor: { ...prev.powerFactor, history: [...prev.powerFactor.history.slice(1), { val: 0.95 }] },
        }));
        setZmctData(prev => ({
          peakCurrent: { ...prev.peakCurrent, value: baseRms * 1.414, history: [...prev.peakCurrent.history.slice(1), { val: baseRms * 1.414 }] },
          crestFactor: { ...prev.crestFactor, value: 1.41 + (Math.random() * 0.04 - 0.02), history: [...prev.crestFactor.history.slice(1), { val: 1.41 }] },
          diDt: { ...prev.diDt, value: 0.12 + (Math.random() * 0.02 - 0.01), history: [...prev.diDt.history.slice(1), { val: 0.12 }] },
        }));
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [relayState]);

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