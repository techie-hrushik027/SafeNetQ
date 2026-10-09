import React from 'react';
import { ShieldAlert, Activity, Sliders, Server } from 'lucide-react';
import type { SystemState } from '../types/dashboard';

interface SidebarProps {
  currentView: 'operator' | 'technician';
  setCurrentView: (view: 'operator' | 'technician') => void;
  systemStatus: SystemState;
}

const STATUS_STATES: { key: SystemState; label: string }[] = [
  { key: 'NORMAL', label: 'NORMAL' },
  { key: 'OVERCURRENT', label: 'OVERCURRENT' },
  { key: 'SHORT_CIRCUIT', label: 'SHORT CIRCUIT' },
  { key: 'HIF', label: 'HIF' },
];

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  setCurrentView,
  systemStatus,
}) => {
  const getLedClass = (stateKey: SystemState) => {
    if (systemStatus === stateKey) {
      switch (stateKey) {
        case 'NORMAL':
          return 'bg-green-500 ring-2 ring-green-200';
        case 'OVERCURRENT':
          return 'bg-amber-500 ring-2 ring-amber-200';
        case 'SHORT_CIRCUIT':
          return 'bg-red-600 ring-2 ring-red-200';
        case 'HIF':
          return 'bg-purple-600 ring-2 ring-purple-200';
        default:
          return 'bg-gray-300';
      }
    }
    return 'bg-gray-300';
  };

  return (
    <aside className="w-64 bg-white border-r border-gray-200 flex flex-col justify-between h-screen fixed left-0 top-0 z-10 select-none">
      <div>
        <div className="h-14 px-4 border-b border-gray-200 flex items-center space-x-2 bg-gray-900 text-white">
          <ShieldAlert className="w-5 h-5 text-blue-400" />
          <span className="font-mono font-bold tracking-wide text-sm">SafeNetQ v0.1</span>
        </div>

        <nav className="p-3 space-y-1">
          <div className="px-2 py-1 text-[10px] font-bold tracking-wider text-gray-400 uppercase">
            Views
          </div>
          <button
            onClick={() => setCurrentView('operator')}
            className={`w-full flex items-center space-x-2.5 px-3 py-2 rounded text-xs font-medium transition-colors ${
              currentView === 'operator'
                ? 'bg-blue-50 text-blue-700 font-semibold'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>Operator Dashboard</span>
          </button>

          <button
            onClick={() => setCurrentView('technician')}
            className={`w-full flex items-center space-x-2.5 px-3 py-2 rounded text-xs font-medium transition-colors ${
              currentView === 'technician'
                ? 'bg-blue-50 text-blue-700 font-semibold'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>Technician Controls</span>
          </button>
        </nav>
      </div>

      <div className="p-3 border-t border-gray-200 bg-gray-50">
        <div className="flex items-center space-x-1.5 mb-2 px-1">
          <Server className="w-3.5 h-3.5 text-gray-500" />
          <span className="text-[11px] font-bold text-gray-600 uppercase tracking-wider">
            System Status
          </span>
        </div>

        <div className="bg-white border border-gray-200 rounded p-2.5 space-y-2">
          {STATUS_STATES.map((item) => {
            const isActive = systemStatus === item.key;
            return (
              <div key={item.key} className="flex items-center justify-between text-xs">
                <span
                  className={`font-mono text-[11px] ${
                    isActive ? 'font-bold text-gray-900' : 'text-gray-400'
                  }`}
                >
                  {item.label}
                </span>
                <span className={`w-2.5 h-2.5 rounded-full transition-all ${getLedClass(item.key)}`} />
              </div>
            );
          })}
        </div>
      </div>
    </aside>
  );
};