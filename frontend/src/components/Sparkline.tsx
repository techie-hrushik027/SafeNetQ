import React from 'react';
import { LineChart, Line, ResponsiveContainer, YAxis } from 'recharts';

interface SparklineProps {
  data: { val: number }[];
  color?: string;
}

export const Sparkline: React.FC<SparklineProps> = ({ data, color = '#2563eb' }) => {
  return (
    <div className="h-9 w-full min-w-[60px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data.slice(-10)} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
          <YAxis domain={['auto', 'auto']} hide />
          <Line
            type="monotone"
            dataKey="val"
            stroke={color}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};