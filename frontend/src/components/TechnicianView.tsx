/**
 * TechnicianView.tsx
 * Hardware actuation and fault log interface.
 * Provides manual mechanical relay control and displays a dense, flat table 
 * mimicking event-driven logging from the backend MySQL `fault_logs` table.
 */
import React from 'react';
import { Power, RotateCcw, AlertOctagon, Table } from 'lucide-react';
import type { FaultLog, SystemState } from '../types/dashboard';

interface TechnicianViewProps {
  relayState: boolean;
  onTripRelay: () => void;
  onResetRelay: () => void;
  logs: FaultLog[];
}

export const TechnicianView: React.FC<TechnicianViewProps> = ({ relayState, onTripRelay, onResetRelay, logs }) => {
  const getBadgeClass = (type: SystemState) => {
    switch (type) {
      case 'NORMAL': return 'bg-green-100 text-green-800 border-green-300';
      case 'OVERCURRENT': return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'SHORT_CIRCUIT': return 'bg-red-100 text-red-800 border-red-300';
      case 'HIF': return 'bg-purple-100 text-purple-800 border-purple-300';
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
            <div className={`p-2.5 rounded ${relayState ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
              <Power className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xs font-semibold text-gray-500">Relay Status</div>
              <div className="text-base font-bold font-mono text-gray-900">
                {relayState ? 'TRIPPED (CIRCUIT OPEN)' : 'CLOSED (NORMAL OPERATION)'}
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button onClick={onTripRelay} disabled={relayState} className={`flex items-center space-x-1.5 px-4 py-2 rounded text-xs font-bold uppercase transition ${relayState ? 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200' : 'bg-red-600 hover:bg-red-700 text-white'}`}>
              <AlertOctagon className="w-4 h-4" />
              <span>Manual Trip</span>
            </button>
            <button onClick={onResetRelay} disabled={!relayState} className={`flex items-center space-x-1.5 px-4 py-2 rounded text-xs font-bold uppercase transition ${!relayState ? 'bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-200' : 'bg-green-600 hover:bg-green-700 text-white'}`}>
              <RotateCcw className="w-4 h-4" />
              <span>Reset Relay</span>
            </button>
          </div>
        </div>
      </div>

      {/* MySQL Fault Event Logs Table */}
      <div className="bg-white border border-gray-200 rounded p-4 shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-100 pb-2 mb-3">
          <div className="flex items-center space-x-2">
            <Table className="w-4 h-4 text-gray-500" />
            <h2 className="text-sm font-bold text-gray-800 uppercase tracking-wide">MySQL Fault Event Logs</h2>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-gray-100 border-b border-gray-200 text-gray-600 font-mono uppercase text-[11px]">
                <th className="p-2.5">Log ID</th>
                <th className="p-2.5">Timestamp</th>
                <th className="p-2.5">Fault Type</th>
                <th className="p-2.5 text-right">RMS Current</th>
                <th className="p-2.5 text-right">Crest Factor</th>
                <th className="p-2.5 text-right">di / dt</th>
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
                  <td className="p-2.5 font-semibold text-gray-800">{log.actionTaken}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};