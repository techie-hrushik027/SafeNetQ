import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { MetricCard } from "./MetricCard";
import type { SystemState, PzemMetrics, ZmctMetrics, TelemetryPoint } from "../types/dashboard";

interface OperatorViewProps {
  pzemData: PzemMetrics;
  zmctData: ZmctMetrics;
  rmsHistory: TelemetryPoint[];
  systemStatus: SystemState;
}

const statusIndicators: SystemState[] = ['NORMAL', 'OVERCURRENT', 'SHORT_CIRCUIT', 'HIF'];

export const OperatorView = ({ pzemData, zmctData, rmsHistory, systemStatus }: OperatorViewProps) => {
  const isFault = systemStatus !== 'NORMAL';
  return (
    <div className="space-y-6 pb-12">

      <div className={`p-6 rounded-xl border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5 ${isFault ? 'bg-red-50 border-red-200 text-red-800' : 'bg-white border-gray-200 text-gray-800'}`}>
        <div className="flex items-center gap-8">
          <div aria-label="Fault status indicators" className="space-y-2">
            {statusIndicators.map(status => {
              const active = status !== 'NORMAL' && systemStatus === status;
              return (
                <div key={status} className="flex items-center gap-2.5 text-xs font-semibold tracking-wide text-gray-600">
                  <span aria-label={active ? 'Active fault' : 'Inactive'} className={`h-3 w-3 rounded-full border ${active ? 'border-red-600 bg-red-600 shadow-[0_0_8px_rgba(220,38,38,0.7)]' : 'border-gray-300 bg-transparent'}`} />
                  {status.replace('_', ' ')}
                </div>
              );
            })}
          </div>
          <div className="border-l border-gray-200 pl-6">
          <h2 className="text-sm font-bold uppercase tracking-wider opacity-80">Current System Status</h2>
          <p className="text-3xl font-black mt-1">{systemStatus}</p>
          </div>
        </div>
        <p className="text-xs text-gray-500">Normal operation: all fault LEDs off</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <h3 className="text-sm font-bold text-gray-500 mb-4 uppercase tracking-wider">RMS Current</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={rmsHistory}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="time" hide />
                <YAxis domain={['auto', 'auto']} width={40} />
                <Tooltip />
                <Line type="monotone" dataKey="rmsCurrent" stroke="#3b82f6" strokeWidth={2} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
          <h3 className="text-sm font-bold text-gray-500 mb-4 uppercase tracking-wider">Crest Factor</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={zmctData.crestFactor.history.map((h: any, i: number) => ({ time: i, value: h.val }))}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="time" hide />
                <YAxis domain={['auto', 'auto']} width={40} />
                <Tooltip />
                <Line type="monotone" dataKey="value" stroke="#f97316" strokeWidth={2} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* PARAMETERS SECTION - SCROLL DOWN TO SEE THIS ON THE DASHBOARD */}
      <div>
        <h3 className="text-sm font-bold text-gray-500 mb-4 uppercase tracking-wider">PZEM Parameters</h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <MetricCard {...pzemData.voltage} />
          <MetricCard {...pzemData.realPower} />
          <MetricCard {...pzemData.energy} />
          <MetricCard {...pzemData.frequency} />
          <MetricCard {...pzemData.powerFactor} />
        </div>
      </div>

      <div className="mt-6">
        <h3 className="text-sm font-bold text-gray-500 mb-4 uppercase tracking-wider">ZMCT103C Features</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <MetricCard {...zmctData.peakCurrent} />
          <MetricCard {...zmctData.crestFactor} />
          <MetricCard {...zmctData.diDt} />
        </div>
      </div>

    </div>
  );
};
