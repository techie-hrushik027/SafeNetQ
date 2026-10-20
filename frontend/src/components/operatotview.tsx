import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { MetricCard } from "./MetricCard";
import type { SystemState, PzemMetrics, ZmctMetrics, MetricData, TelemetryPoint } from "../types/dashboard";

interface OperatorViewProps {
  pzemData: PzemMetrics;
  zmctData: ZmctMetrics;
  currentData: MetricData;
  rmsHistory: TelemetryPoint[];
  systemStatus: SystemState;
}

const conditions: { status: SystemState; label: string; color: string; glow: string }[] = [
  { status: "NORMAL", label: "Normal", color: "#22c55e", glow: "rgba(34, 197, 94, 0.55)" },
  { status: "OVERCURRENT", label: "Overcurrent", color: "#ef4444", glow: "rgba(239, 68, 68, 0.55)" },
  { status: "SHORT_CIRCUIT", label: "Short Circuit", color: "#ef4444", glow: "rgba(239, 68, 68, 0.55)" },
  { status: "HIF", label: "HIF", color: "#ef4444", glow: "rgba(239, 68, 68, 0.55)" },
];

export const OperatorView = ({ pzemData, zmctData, currentData, rmsHistory, systemStatus }: OperatorViewProps) => {
  return (
    <div className="space-y-6 pb-12">
      <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm" aria-label="System condition LED panel">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-gray-600">Current System Status</h2>
            <p className="mt-1 text-sm text-gray-500">One indicator lights for the active condition</p>
          </div>
          <span className="text-sm font-semibold text-gray-600">{systemStatus.replace("_", " ")}</span>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {conditions.map(({ status, label, color, glow }) => {
            const active = systemStatus === status;
            return (
              <div key={status} className={`flex items-center gap-3 rounded-lg border px-4 py-3 ${active ? "border-gray-300 bg-gray-50" : "border-gray-200 bg-white"}`} aria-label={`${label}: ${active ? "active" : "inactive"}`}>
                <span className={`h-4 w-4 shrink-0 rounded-full border-2 ${active && status !== "NORMAL" ? "animate-pulse" : ""}`} style={{ backgroundColor: active ? color : "#f8fafc", borderColor: active ? color : "#cbd5e1", boxShadow: active ? `0 0 8px ${glow}, 0 0 16px ${glow}` : "inset 0 1px 3px rgba(15, 23, 42, 0.12)" }} />
                <div>
                  <div className="text-sm font-semibold text-gray-700">{label}</div>
                  <div className={`text-[10px] font-semibold uppercase tracking-wider ${active ? "text-gray-600" : "text-gray-400"}`}>{active ? "Active" : "Off"}</div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-gray-500">RMS Current</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={rmsHistory}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="time" hide />
                <YAxis domain={["auto", "auto"]} width={40} />
                <Tooltip />
                <Line type="monotone" dataKey="rmsCurrent" stroke="#3b82f6" strokeWidth={2} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-gray-500">Crest Factor</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={zmctData.crestFactor.history.map((h) => ({ time: h.time ?? "", value: h.val }))}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="time" tick={{ fontSize: 10 }} tickFormatter={(time) => new Date(time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })} interval="preserveStartEnd" minTickGap={24} />
                <YAxis domain={["auto", "auto"]} width={40} />
                <Tooltip />
                <Line type="monotone" dataKey="value" stroke="#f97316" strokeWidth={2} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div>
        <h3 className="mb-4 text-sm font-bold uppercase tracking-wider text-gray-500">SafeNetQ Parameters</h3>
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
            <MetricCard {...pzemData.voltage} />
            <MetricCard {...pzemData.realPower} />
            <MetricCard {...pzemData.energy} />
            <MetricCard {...pzemData.frequency} />
            <MetricCard {...pzemData.powerFactor} />
          </div>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <MetricCard {...currentData} />
            <MetricCard {...zmctData.peakCurrent} />
            <MetricCard {...zmctData.crestFactor} />
            <MetricCard {...zmctData.diDt} />
          </div>
        </div>
      </div>
    </div>
  );
};
