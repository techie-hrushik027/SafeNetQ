/**
 * TechnicianView.tsx
 * Hardware actuation and fault log interface.
 * Provides manual mechanical relay control and displays a dense, flat table 
 * mimicking event-driven logging from the backend MySQL `fault_logs` table.
 */
import React from 'react';
import { Power, RotateCcw, AlertOctagon, Table, Radio } from 'lucide-react';
import type { CommandResult, DeviceMessage, FaultLog, SystemState } from '../types/dashboard';

interface TechnicianViewProps {
  relayState: boolean;
  onTripRelay: () => void;
  onResetRelay: () => void;
  logs: FaultLog[];
  deviceMessages: DeviceMessage[];
  logsError: string;
  mqttConnected: boolean;
  databaseConnected: boolean;
  commandResult: CommandResult | null;
}

export const TechnicianView: React.FC<TechnicianViewProps> = ({ relayState, onTripRelay, onResetRelay, logs, deviceMessages, logsError, mqttConnected, databaseConnected, commandResult }) => {
  const getBadgeClass = (type: SystemState) => {
    switch (type) {
      case 'NORMAL': return 'bg-green-100 text-green-800 border-green-300';
      case 'OVERCURRENT': return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'SHORT_CIRCUIT': return 'bg-red-100 text-red-800 border-red-300';
      case 'HIF': return 'bg-purple-100 text-purple-800 border-purple-300';
      case 'UNSTABLE': return 'bg-red-100 text-red-800 border-red-300';
      case 'MANUAL': return 'bg-slate-100 text-slate-800 border-slate-300';
      case 'PZEM_LOST': return 'bg-sky-100 text-sky-800 border-sky-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  return (
    <div className="space-y-4">
      {/* 5V Mechanical Relay Control Panel */}
      <div className="bg-white border border-gray-200 rounded p-4 shadow-sm">
        <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wide border-b border-gray-100 pb-2 mb-3">
          Hardware Relay Manual Control (5V Actuator)
        </h2>

        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className={`p-2.5 rounded ${relayState ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
              <Power className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xs font-semibold text-gray-500">Relay Status</div>
              <div className="text-base font-bold font-mono text-gray-900">
                {relayState ? 'CLOSED (LOAD ENERGIZED)' : 'OPEN (LOAD OFF / TRIPPED)'}
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button type="button" onClick={onTripRelay} disabled={!relayState || !mqttConnected} title={!mqttConnected ? 'MQTT is offline' : undefined} className={`flex items-center space-x-1.5 px-4 py-2 rounded text-xs font-bold uppercase transition ${!relayState || !mqttConnected ? 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200' : 'bg-red-600 hover:bg-red-700 text-white'}`}>
              <AlertOctagon className="w-4 h-4" />
              <span>Manual Trip</span>
            </button>
            <button type="button" onClick={onResetRelay} disabled={!mqttConnected} title={!mqttConnected ? 'MQTT is offline' : undefined} className="flex items-center space-x-1.5 rounded bg-green-600 px-4 py-2 text-xs font-bold uppercase text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-gray-300">
              <RotateCcw className="w-4 h-4" />
              <span>Reset Relay</span>
            </button>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
          <span className={`font-semibold ${mqttConnected ? 'text-emerald-700' : 'text-red-700'}`}>MQTT {mqttConnected ? 'ready' : 'offline'}</span>
          {commandResult && <span role="status" className={commandResult.accepted ? 'text-emerald-700' : 'text-red-700'}>
            {commandResult.accepted ? `${commandResult.command.toUpperCase()} published to ${commandResult.topic ?? 'device'}` : `${commandResult.command.toUpperCase()} failed: ${commandResult.error ?? 'not accepted'}`}
          </span>}
        </div>
      </div>

      {/* Telemetry-derived device activity. Raw USB Serial Monitor text is not sent over MQTT. */}
      <div className="bg-white border border-gray-200 rounded p-4 shadow-sm">
        <div className="flex items-center gap-2 border-b border-gray-100 pb-2 mb-3">
          <Radio className="w-4 h-4 text-gray-500" />
          <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wide">Live device messages</h2>
          <span className="ml-auto text-[10px] uppercase tracking-wide text-gray-400">MQTT events</span>
        </div>
        <div className="max-h-56 space-y-1 overflow-y-auto rounded bg-slate-950 p-3 font-mono text-xs">
          {deviceMessages.length === 0 ? <div className="text-slate-400">Waiting for state, trip, or relay events from MQTT telemetry.</div> : deviceMessages.map(event => (
            <div key={event.id} className={event.level === 'critical' ? 'text-red-300' : event.level === 'warning' ? 'text-amber-200' : 'text-emerald-200'}>
              <span className="text-slate-500">{new Date(event.timestamp).toLocaleTimeString()} &gt; </span>{event.message}
            </div>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-gray-500">These are messages derived from MQTT telemetry. USB Serial Monitor text appears here only if firmware also publishes it over MQTT.</p>
      </div>

      {/* MySQL Fault Event Logs Table */}
      <div className="bg-white border border-gray-200 rounded p-4 shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-100 pb-2 mb-3">
          <div className="flex items-center space-x-2">
            <Table className="w-4 h-4 text-gray-500" />
            <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wide">MySQL Fault Event Logs</h2>
          </div>
          <span className={`text-xs font-semibold ${databaseConnected ? 'text-emerald-700' : 'text-red-700'}`}>MySQL {databaseConnected ? 'connected' : 'unavailable'}</span>
        </div>

        {logsError && <div role="alert" className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{logsError}</div>}

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-gray-100 border-b border-gray-200 text-gray-600 font-mono uppercase text-[11px]">
                <th className="p-2.5">Log ID</th>
                <th className="p-2.5">Timestamp</th>
                <th className="p-2.5">Fault Type</th>
                <th className="p-2.5 text-right">RMS Current</th>
                <th className="p-2.5 text-right">Crest Factor</th>
                <th className="p-2.5 text-right">Edge</th>
                <th className="p-2.5 text-right">Jitter</th>
                <th className="p-2.5 text-right">Score</th>
                <th className="p-2.5 text-right">CUSUM</th>
                <th className="p-2.5">Action Taken</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 font-mono">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50">
                  <td className="p-2.5 font-bold text-gray-700">#{log.id}</td>
                  <td className="p-2.5 text-gray-500">{log.timestamp}</td>
                  <td className="p-2.5"><span className={`px-2 py-0.5 rounded border text-[10px] font-bold ${getBadgeClass(log.type)}`}>{log.type}</span></td>
                  <td className="p-2.5 text-right">{log.rmsCurrent.toFixed(2)} A</td>
                  <td className="p-2.5 text-right">{log.crestFactor.toFixed(2)}</td>
                  <td className="p-2.5 text-right">{log.diDt.toFixed(2)}</td>
                  <td className="p-2.5 text-right">{log.jitter.toFixed(4)}</td>
                  <td className="p-2.5 text-right">{log.score.toFixed(2)}</td>
                  <td className="p-2.5 text-right">{log.cusum.toFixed(2)}</td>
                  <td className="p-2.5 font-semibold text-gray-800">{log.actionTaken}</td>
                </tr>
              ))}
              {logs.length === 0 && <tr><td colSpan={10} className="p-5 text-center font-sans text-sm text-gray-500">{databaseConnected ? 'No fault events have been logged yet.' : 'Fault history is unavailable until MySQL connects.'}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
