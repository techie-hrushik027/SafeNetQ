import { useState } from "react";
import { Sidebar } from "./components/Sidebar";
import { OperatorView } from "./components/operatotview";
import { TechnicianView } from "./components/TechnicianView";
import { useTelemetry } from "./hooks/useTelemetry";

function App() {
  // Matched to SidebarProps: currentView instead of activeView
  const [currentView, setCurrentView] = useState<"operator" | "technician">("operator");

  // Bring in all live data and status states from your custom hook
  const { logs, rmsHistory, pzemData, zmctData, systemStatus, relayState } = useTelemetry();

  // Mock functions matching TechnicianViewProps exactly
  const handleTripRelay = () => console.log("Manual Trip Triggered");
  const handleResetRelay = () => console.log("Relay Reset Triggered");

  return (
    <div className="flex h-screen bg-gray-50 text-gray-900 font-sans overflow-hidden">

      {/* Pass exact props expected by Sidebar */}
      <Sidebar
        currentView={currentView}
        setCurrentView={setCurrentView}
        systemStatus={systemStatus}
      />

      <main className="flex-1 overflow-y-auto p-8">
        <header className="mb-8 flex justify-between items-end border-b border-gray-200 pb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">SafeNetQ Monitor</h1>
            <p className="text-sm text-gray-500">Edge-AI Sub-50ms Fault Isolation</p>
          </div>
          <div className="text-sm font-medium text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
            Broker: Connected (MQTT/WS)
          </div>
        </header>

        {currentView === "operator" ? (
          <OperatorView pzemData={pzemData} zmctData={zmctData} rmsHistory={rmsHistory} />
        ) : (
          /* Pass exact props expected by TechnicianView */
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