import { useState } from "react";
import { OperatorView } from "./components/operatotview";
import { TechnicianView } from "./components/TechnicianView";
import { ViewStage, ViewSwitcher, type DashboardMode } from "./components/ViewSwitcher";
import { useTelemetry } from "./hooks/useTelemetry";
import { ZapOff } from "lucide-react";

function App() {
  const [currentView, setCurrentView] = useState<DashboardMode>("monitor");

  const {
    isConnected, mqttConnected, databaseConnected, logsError, logs, deviceMessages, commandResult,
    rmsHistory, pzemData, hifData, detectorData, detectorState, tripReason, relayState, sendCommand
  } = useTelemetry();

  const handleTripRelay = () => sendCommand('trip');
  const handleResetRelay = () => sendCommand('reset');

  return (
    <div className="app-shell min-h-screen text-gray-100 font-sans">

      {/* Top Navbar (LogicMonitor Style) */}
      <nav className="app-topbar bg-[#0b1426] text-white px-6 py-4 flex justify-between items-center shadow-md">
        <div className="flex items-center gap-3">
          <ZapOff className="text-emerald-400" size={28} />
          <span className="safenetq-brand text-xl font-bold tracking-wider">SafeNetQ</span>
        </div>

        <div className="app-nav-controls">

          {/* Dynamic Broker Status Badge */}
          <div className="app-nav-statuses">
            <div className={`connection-badge text-xs font-medium px-3 py-1 rounded-full border ${isConnected
              ? 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20'
              : 'text-red-400 bg-red-400/10 border-red-400/20'
              }`}>
              Bridge: {isConnected ? 'Connected' : 'Disconnected'}
            </div>
            <div className={`connection-badge text-xs font-medium px-3 py-1 rounded-full border ${mqttConnected ? 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20' : 'text-red-400 bg-red-400/10 border-red-400/20'}`}>
              MQTT: {mqttConnected ? 'Connected' : 'Disconnected'}
            </div>
            <div className={`connection-badge text-xs font-medium px-3 py-1 rounded-full border ${databaseConnected ? 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20' : 'text-amber-300 bg-amber-400/10 border-amber-400/20'}`}>
              MySQL: {databaseConnected ? 'Connected' : 'Unavailable'}
            </div>
          </div>

        </div>
      </nav>

      {/* Main Content Area */}
      <main className="app-main p-8 max-w-7xl mx-auto">
        <header className="page-heading mb-8 border-b border-gray-200 pb-4">
          <h1 className="text-3xl font-bold text-gray-900">SafeNetQ Telemetry</h1>
          <p className="text-sm text-gray-500 mt-1">Real-Time Monitoring and Relay-Based Protection for Power Distribution Systems Using Adaptive Baseline Learning</p>
          <ViewSwitcher activeView={currentView} onViewChange={setCurrentView} />
        </header>

        <ViewStage activeView={currentView}>
          <OperatorView pzemData={pzemData} hifData={hifData} detectorData={detectorData} rmsHistory={rmsHistory} detectorState={detectorState} tripReason={tripReason} relayState={relayState} />
          <TechnicianView
            logs={logs}
            deviceMessages={deviceMessages}
            logsError={logsError}
            mqttConnected={mqttConnected}
            databaseConnected={databaseConnected}
            commandResult={commandResult}
            relayState={relayState}
            onTripRelay={handleTripRelay}
            onResetRelay={handleResetRelay}
          />
        </ViewStage>
      </main>
    </div>
  );
}

export default App;
