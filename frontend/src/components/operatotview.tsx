import { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { MetricCard } from './MetricCard';
import type { DetectorMetrics, DetectorState, HifMetrics, PzemMetrics, TelemetryPoint } from '../types/dashboard';

interface OperatorViewProps {
  pzemData: PzemMetrics;
  hifData: HifMetrics;
  detectorData: DetectorMetrics;
  rmsHistory: TelemetryPoint[];
  detectorState: DetectorState;
  tripReason: string;
  relayState: boolean;
}
type Tab = 'mains' | 'waveform' | 'detector';
type Condition = 'NORMAL' | 'OVERCURRENT' | 'SHORT_CIRCUIT' | 'HIF' | 'MANUAL' | 'PZEM_LOST';

const stateStyles: Record<DetectorState, string> = {
  'NO LOAD': 'bg-slate-100 text-slate-700 ring-slate-300',
  SETTLE: 'bg-blue-100 text-blue-800 ring-blue-300',
  LEARN: 'bg-amber-100 text-amber-800 ring-amber-300',
  ARMED: 'bg-emerald-100 text-emerald-800 ring-emerald-300',
  UNSTABLE: 'bg-red-100 text-red-800 ring-red-300 animate-pulse',
  UNKNOWN: 'bg-gray-100 text-gray-700 ring-gray-300'
};
const tabs: { id: Tab; label: string }[] = [
  { id: 'mains', label: 'PZEM Mains' }, { id: 'waveform', label: 'HIF Waveform Features' }, { id: 'detector', label: 'Detector' }
];
const conditions: { id: Condition; label: string; color: string }[] = [
  { id: 'NORMAL', label: 'Normal', color: '#22c55e' },
  { id: 'OVERCURRENT', label: 'Overcurrent', color: '#f59e0b' },
  { id: 'SHORT_CIRCUIT', label: 'Short circuit', color: '#ef4444' },
  { id: 'HIF', label: 'HIF / unstable', color: '#a855f7' },
  { id: 'MANUAL', label: 'Manual trip', color: '#64748b' },
  { id: 'PZEM_LOST', label: 'PZEM lost', color: '#0ea5e9' }
];

function resolveCondition(tripReason: string, detectorState: DetectorState): Condition {
  const reason = tripReason.trim().toUpperCase().replaceAll(' ', '_');
  if (reason.includes('OVERCURRENT')) return 'OVERCURRENT';
  if (reason.includes('SHORT_CIRCUIT')) return 'SHORT_CIRCUIT';
  if (reason.includes('PZEM_LOST')) return 'PZEM_LOST';
  if (reason.includes('MANUAL')) return 'MANUAL';
  if (reason === 'HIF' || reason.includes('HIF_TRIP') || detectorState === 'UNSTABLE') return 'HIF';
  return 'NORMAL';
}

export const OperatorView = ({ pzemData, hifData, detectorData, rmsHistory, detectorState, tripReason, relayState }: OperatorViewProps) => {
  const [tab, setTab] = useState<Tab>('mains');
  const condition = resolveCondition(tripReason, detectorState);
  const score = detectorData.score.value;
  const cusum = detectorData.cusum.value;
  const hits = Math.min(24, Math.max(0, detectorData.hits.value));
  const featureCards = [hifData.crestFactor, hifData.asymmetry, hifData.width, hifData.edge, hifData.roughness, hifData.jitter, hifData.shapeShift, hifData.peakCv, hifData.widthCv];

  return <div className="space-y-6 pb-12">
    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm" aria-label="System condition LED panel">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="text-sm font-bold uppercase tracking-wider text-gray-600">System condition LEDs</h2><p className="mt-1 text-sm text-gray-500">Live fault indication from MQTT telemetry</p></div>
        <span className="text-sm font-semibold text-gray-700">Relay: {relayState ? 'CLOSED / ON' : 'OPEN / OFF'}</span>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {conditions.map(item => {
          const active = condition === item.id;
          return <div key={item.id} className={`flex items-center gap-3 rounded-lg border px-3 py-3 ${active ? 'border-gray-300 bg-gray-50' : 'border-gray-200 bg-white'}`} aria-label={`${item.label}: ${active ? 'active' : 'inactive'}`}>
            <span className={`h-4 w-4 shrink-0 rounded-full border-2 ${active && item.id !== 'NORMAL' ? 'animate-pulse' : ''}`} style={{ backgroundColor: active ? item.color : '#f8fafc', borderColor: active ? item.color : '#cbd5e1', boxShadow: active ? `0 0 8px ${item.color}88, 0 0 16px ${item.color}55` : 'inset 0 1px 3px rgba(15, 23, 42, 0.12)' }} />
            <div><div className="text-xs font-semibold text-gray-700">{item.label}</div><div className={`text-[10px] font-semibold uppercase tracking-wider ${active ? 'text-gray-600' : 'text-gray-400'}`}>{active ? 'Active' : 'Off'}</div></div>
          </div>;
        })}
      </div>
    </section>

    <section className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm" aria-label="HIF detector state">
      <div><h2 className="text-sm font-bold uppercase tracking-wider text-gray-500">HIF Guard detector</h2><p className="mt-1 text-sm text-gray-500">Adaptive baseline and waveform irregularity monitor</p></div>
      <span className={`rounded-full px-5 py-2 text-sm font-black tracking-wider ring-1 ${stateStyles[detectorState]}`} role="status">{detectorState}</span>
    </section>

    <div className="border-b border-gray-200">
      <nav className="-mb-px flex flex-wrap gap-2" aria-label="Telemetry categories">
        {tabs.map(item => <button key={item.id} type="button" onClick={() => setTab(item.id)} className={`border-b-2 px-4 py-3 text-sm font-semibold transition-colors ${tab === item.id ? 'border-emerald-500 text-emerald-700' : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'}`} aria-current={tab === item.id ? 'page' : undefined}>{item.label}</button>)}
      </nav>
    </div>

    {tab === 'mains' && <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <MetricCard {...pzemData.voltage} /><MetricCard {...pzemData.current} /><MetricCard {...pzemData.realPower} />
        <MetricCard {...pzemData.powerFactor} /><MetricCard {...pzemData.frequency} /><MetricCard {...pzemData.energy} />
      </div>
      <ChartPanel title="PZEM RMS Current" data={rmsHistory} dataKey="rmsCurrent" color="#3b82f6" />
    </div>}

    {tab === 'waveform' && <section className="space-y-4" aria-label="ZMCT waveform features">
      <div><h2 className="text-sm font-bold uppercase tracking-wider text-gray-600">ZMCT103C waveform features</h2><p className="mt-1 text-sm text-gray-500">Shape and irregularity features; ZMCT is not the current meter.</p></div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">{featureCards.map(card => <MetricCard key={card.label} {...card} />)}</div>
    </section>}

    {tab === 'detector' && <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-start justify-between"><div><h2 className="text-sm font-bold uppercase tracking-wider text-gray-600">CUSUM Accumulator</h2><p className="mt-1 text-xs text-gray-500">Warning at 10 · trip at 30</p></div><strong className={`text-2xl ${cusum >= 30 ? 'text-red-600' : cusum >= 10 ? 'text-amber-600' : 'text-gray-900'}`}>{cusum.toFixed(1)}</strong></div>
        <div className="h-64"><ResponsiveContainer width="100%" height="100%"><LineChart data={detectorData.cusum.history.map(point => ({ time: point.time ?? '', value: point.val }))}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="time" hide /><YAxis domain={[0, 60]} width={40} /><Tooltip />
          <ReferenceLine y={10} stroke="#f59e0b" strokeDasharray="5 5" label={{ value: 'Warning 10', fill: '#b45309', fontSize: 11 }} />
          <ReferenceLine y={30} stroke="#dc2626" strokeDasharray="5 5" label={{ value: 'Trip 30', fill: '#b91c1c', fontSize: 11 }} />
          <Line type="monotone" dataKey="value" stroke="#7c3aed" strokeWidth={2.5} dot={false} isAnimationActive={false} />
        </LineChart></ResponsiveContainer></div>
      </section>
      <section className="space-y-5 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="grid grid-cols-2 gap-3"><MetricCard {...detectorData.score} /><MetricCard {...detectorData.hits} /></div>
        <div><div className="mb-2 flex justify-between text-sm"><h2 className="font-bold uppercase tracking-wider text-gray-600">Detection Hits</h2><strong>{hits.toFixed(0)} / 24</strong></div><div className="h-3 overflow-hidden rounded-full bg-gray-100"><div className={`h-full rounded-full transition-all ${hits >= 24 ? 'bg-red-500' : 'bg-blue-500'}`} style={{ width: `${hits / 24 * 100}%` }} /></div><div className="mt-1 text-right text-[10px] text-gray-400">24-hit rolling window</div></div>
        <ChartPanel title="Instantaneous anomaly score" data={detectorData.score.history.map(point => ({ time: point.time ?? '', value: point.val }))} dataKey="value" color="#f97316" />
      </section>
    </div>}
  </div>;
};

function ChartPanel({ title, data, dataKey, color }: { title: string; data: any[]; dataKey: string; color: string }) {
  return <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"><h2 className="mb-4 text-sm font-bold uppercase tracking-wider text-gray-500">{title}</h2><div className="h-64"><ResponsiveContainer width="100%" height="100%"><LineChart data={data}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="time" hide /><YAxis domain={['auto', 'auto']} width={40} /><Tooltip /><Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} dot={false} isAnimationActive={false} /></LineChart></ResponsiveContainer></div></section>;
}
