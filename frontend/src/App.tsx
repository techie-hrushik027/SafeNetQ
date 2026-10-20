import { useState } from "react";
import { OperatorView } from "./components/operatotview";
import { TechnicianView } from "./components/TechnicianView";
import { useTelemetry } from "./hooks/useTelemetry";
import { ZapOff, ChevronDown, Activity } from "lucide-react";

function App() {
  const [currentView, setCurrentView] = useState<"operator" | "technician">("operator");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Added isConnected to the destructured hook
  const { isConnected, logs, rmsHistory, pzemData, zmctData, currentData, systemStatus, relayState } = useTelemetry();

  const handleTripRelay = () => console.log("Manual Trip Triggered");
  const handleResetRelay = () => console.log("Relay Reset Triggered");

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans">

      {/* Top Navbar (LogicMonitor Style) */}
      <nav className="bg-[#0b1426] text-white px-6 py-4 flex justify-between items-center shadow-md">
        <div className="flex items-center gap-3">
          <ZapOff className="text-emerald-400" size={28} />
          <span className="text-xl font-bold tracking-wider">SafeNetQ</span>
        </div>

        <div className="flex items-center gap-6">

          {/* Dynamic Broker Status Badge */}
          <div className={`text-xs font-medium px-3 py-1 rounded-full border ${isConnected
            ? 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20'
            : 'text-red-400 bg-red-400/10 border-red-400/20'
            }`}>
            Bridge: {isConnected ? 'Connected' : 'Disconnected'}
          </div>

          {/* Dropdown Menu */}
          <div className="relative">
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="flex items-center gap-2 text-sm font-medium hover:text-emerald-400 transition-colors cursor-pointer"
            >
              Views <ChevronDown size={16} />
            </button>

            {isDropdownOpen && (
              <div className="absolute right-0 mt-2 w-48 bg-white text-gray-800 rounded-md shadow-xl border border-gray-100 overflow-hidden z-50">
                <button
                  onClick={() => { setCurrentView("operator"); setIsDropdownOpen(false); }}
                  className="w-full text-left px-4 py-3 text-sm hover:bg-gray-50 flex items-center gap-2"
                >
                  <Activity size={16} /> Operator Dashboard
                </button>
                <button
                  onClick={() => { setCurrentView("technician"); setIsDropdownOpen(false); }}
                  className="w-full text-left px-4 py-3 text-sm hover:bg-gray-50 flex items-center gap-2 border-t border-gray-50"
                >
                  <ZapOff size={16} /> Technician Controls
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="p-8 max-w-7xl mx-auto">
        <header className="mb-8 border-b border-gray-200 pb-4">
          <h1 className="text-3xl font-bold text-gray-900">System Monitor</h1>
          <p className="text-sm text-gray-500 mt-1">Real-Time Monitoring and Relay-Based Protection for Power Distribution Systems</p>
        </header>

        {currentView === "operator" ? (
          <OperatorView pzemData={pzemData} zmctData={zmctData} currentData={currentData} rmsHistory={rmsHistory} systemStatus={systemStatus} />
        ) : (
          <TechnicianView
            logs={logs}
            relayState={relayState}
            onTripRelay={handleTripRelay}
            onResetRelay={handleResetRelay}
          />
        )}
      </main>
    </div>
  );
}

export default App;
