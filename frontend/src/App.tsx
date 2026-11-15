import { useEffect, useState } from "react";
import { OperatorView } from "./components/operatotview";
import { TechnicianView } from "./components/TechnicianView";
import { ViewStage, ViewSwitcher, type DashboardMode } from "./components/ViewSwitcher";
import { AuroraField } from "./components/AuroraField";
import { TelemetryIntroSequence } from "./components/TelemetryIntroSequence";
import { useTelemetry } from "./hooks/useTelemetry";
import { ZapOff } from "lucide-react";

function App() {
  const [currentView, setCurrentView] = useState<DashboardMode>("monitor");
  const [hasScrolled, setHasScrolled] = useState(false);

  useEffect(() => {
    const appTopbar = document.querySelector<HTMLElement>(".app-topbar");
    const updateScrollState = () => {
      setHasScrolled(window.scrollY > 80);
      if (appTopbar) {
        const height = `${appTopbar.offsetHeight}px`;
        if (document.documentElement.style.getPropertyValue("--app-topbar-height") !== height) {
          document.documentElement.style.setProperty("--app-topbar-height", height);
        }
      }
    };
    updateScrollState();
    window.addEventListener("scroll", updateScrollState, { passive: true });
    window.addEventListener("resize", updateScrollState);
    const resizeObserver = appTopbar ? new ResizeObserver(updateScrollState) : null;
    if (appTopbar) resizeObserver?.observe(appTopbar);
    return () => {
      window.removeEventListener("scroll", updateScrollState);
      window.removeEventListener("resize", updateScrollState);
      resizeObserver?.disconnect();
    };
  }, []);

  const {
    isConnected, mqttConnected, databaseConnected, logsError, logs, deviceMessages, commandResult,
    rmsHistory, pzemData, hifData, detectorData, detectorState, tripReason, relayState, sendCommand
  } = useTelemetry();

  const handleTripRelay = () => sendCommand('trip');
  const handleResetRelay = () => sendCommand('reset');

  return (
    <div className="app-shell min-h-screen text-gray-100 font-sans">
      <AuroraField />

      {/* Top Navbar (LogicMonitor Style) */}
      <nav className={`app-topbar bg-[#0b1426] text-white px-6 py-4 flex justify-between items-center shadow-md${hasScrolled ? " is-scrolled" : ""}`}>
        <div className="flex items-center gap-3">
          <ZapOff className={`app-brand-mark text-emerald-400${hasScrolled ? " is-scrolled" : ""}`} size={28} aria-hidden="true" />
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

      <TelemetryIntroSequence />

      {/* Main Content Area */}
      <main className="app-main p-8 max-w-7xl mx-auto">
        <div className="view-switcher-dock" id="telemetry-views">
          <ViewSwitcher activeView={currentView} onViewChange={setCurrentView} />
        </div>

        <section className="telemetry-dashboard" id="telemetry-dashboard" aria-label="SafeNetQ dashboard">
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
        </section>
      </main>
    </div>
  );
}

export default App;
