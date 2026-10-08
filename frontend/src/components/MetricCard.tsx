import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { Sparkline } from './Sparkline';

interface MetricCardProps {
  label: string;
  value: number;
  unit: string;
  icon: LucideIcon;
  history: { val: number }[];
  accentColor?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  value,
  unit,
  icon: Icon,
  history,
  accentColor = '#2563eb',
}) => {
  return (
    <div className="bg-white border border-gray-200 rounded p-3 flex flex-col justify-between shadow-sm">
      <div className="flex items-center justify-between border-b border-gray-100 pb-2">
        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
          {label}
        </span>
        <Icon className="w-4 h-4 text-gray-400" />
      </div>

      <div className="my-2 flex items-baseline justify-between">
        <span className="text-2xl font-bold font-mono text-gray-900">
          {typeof value === 'number' ? value.toFixed(2) : value}
        </span>
        <span className="text-xs font-medium text-gray-500 ml-1">{unit}</span>
      </div>

      <div className="pt-1 border-t border-gray-100">
        <Sparkline data={history} color={accentColor} />
      </div>
    </div>
  );
};
