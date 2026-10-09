/**
 * OperatorView.tsx
 * Core telemetry dashboard for the SafeNetQ system.
 * Displays high-speed ADC sampling (Fast Path) via a live LineChart, 
 * alongside two metric grids for PZEM-004T (Slow Path) and ZMCT103C features.
 * Adheres strictly to a flat, high-contrast industrial enterprise design.
 */
import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Zap, Activity, Gauge, Radio, Cpu, TrendingUp, Waves, Percent } from 'lucide-react';
import type { TelemetryPoint, PzemMetrics, ZmctMetrics } from '../types/dashboard';
import { MetricCard } from './MetricCard';

interface OperatorViewProps {
  rmsHistory: TelemetryPoint[];
  pzemData: PzemMetrics;
  zmctData: ZmctMetrics;
}

export const OperatorView: React.FC<OperatorViewProps> = ({ rmsHistory, pzemData, zmctData }) => {
  return (
    <div className="space-y-4">
      {/* Top Row: Live RMS Current Stream */}
      <div className="bg-white border border-gray-200 rounded p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3 border-b border-gray-100 pb-2">
          <div>
            <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wide">Live RMS Current Stream</h2>
            <p className="text-xs text-gray-400">ZMCT103C High-speed 4kHz Windowed Sampling</p>
          </div>
          <span className="flex items-center space-x-1.5 text-xs font-mono text-green-600 bg-green-50 px-2 py-0.5 rounded border border-green-200">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            <span>ACTIVE</span>
          </span>
        </div>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={rmsHistory} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="2 2" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} domain={['auto', 'auto']} />
              <Tooltip
                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '4px', color: '#fff', fontSize: '12px', fontFamily: 'monospace' }}
                itemStyle={{ color: '#38bdf8' }}
              />
              <Line type="monotone" dataKey="rmsCurrent" name="RMS Current (A)" stroke="#2563eb" strokeWidth={2} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Middle Section: Energy Monitor (grid-cols-5) */}
      <div>
        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">PZEM-004T Slow-Path Telemetry (1Hz)</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          <MetricCard label="Voltage" value={pzemData.voltage.value} unit={pzemData.voltage.unit} icon={Zap} history={pzemData.voltage.history} accentColor="#2563eb" />
          <MetricCard label="Real Power" value={pzemData.realPower.value} unit={pzemData.realPower.unit} icon={Activity} history={pzemData.realPower.history} accentColor="#0284c7" />
          <MetricCard label="Energy" value={pzemData.energy.value} unit={pzemData.energy.unit} icon={Gauge} history={pzemData.energy.history} accentColor="#16a34a" />
          <MetricCard label="Frequency" value={pzemData.frequency.value} unit={pzemData.frequency.unit} icon={Radio} history={pzemData.frequency.history} accentColor="#d97706" />
          <MetricCard label="Power Factor" value={pzemData.powerFactor.value} unit={pzemData.powerFactor.unit} icon={Percent} history={pzemData.powerFactor.history} accentColor="#9333ea" />
        </div>
      </div>

      {/* Bottom Section: ML Features (grid-cols-3) */}
      <div>
        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">ZMCT103C Fast-Path Edge Features</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <MetricCard label="Peak Current" value={zmctData.peakCurrent.value} unit={zmctData.peakCurrent.unit} icon={Cpu} history={zmctData.peakCurrent.history} accentColor="#dc2626" />
          <MetricCard label="Crest Factor" value={zmctData.crestFactor.value} unit={zmctData.crestFactor.unit} icon={Waves} history={zmctData.crestFactor.history} accentColor="#ea580c" />
          <MetricCard label="di / dt" value={zmctData.diDt.value} unit={zmctData.diDt.unit} icon={TrendingUp} history={zmctData.diDt.history} accentColor="#0284c7" />
        </div>
      </div>
    </div>
  );
};