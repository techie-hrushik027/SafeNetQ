import { LineChart, Line, ResponsiveContainer } from "recharts";

export const MetricCard = ({ label, value, unit, history }: any) => {
  // Safe fallback if history is undefined during the first render tick
  const safeHistory = history && history.length > 0 ? history : [{ val: 0 }];

  return (
    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col justify-between h-32">
      <div className="flex justify-between items-start">
        <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">{label}</span>
        <span className="text-gray-400 font-medium">{unit}</span>
      </div>

      <div className="flex items-end justify-between mt-2">
        <span className="text-3xl font-black text-gray-800">{value}</span>

        {/* Mini Sparkline Graph */}
        <div className="h-10 w-20">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={safeHistory}>
              <Line
                type="monotone"
                dataKey="val"
                stroke="#10b981" /* Emerald color */
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};