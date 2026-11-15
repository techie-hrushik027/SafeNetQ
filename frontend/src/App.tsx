import { useEffect, useState } from "react";
import { OperatorView } from "./components/operatotview";
import { TechnicianView } from "./components/TechnicianView";
import { ViewStage, ViewSwitcher, type DashboardMode } from "./components/ViewSwitcher";
import { AuroraField } from "./components/AuroraField";
import { useTelemetry } from "./hooks/useTelemetry";
import { ChevronDown, Zap } from "lucide-react";

function App() {
  const [currentView, setCurrentView] = useState<DashboardMode>("monitor");
  const [hasScrolled, setHasScrolled] = useState(false);

  useEffect(() => {
    const updateScrollState = () => setHasScrolled(window.scrollY > 80);
    updateScrollState();
    window.addEventListener("scroll", updateScrollState, { passive: true });
    return () => window.removeEventListener("scroll", updateScrollState);
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
          <span className="brand-mark" aria-hidden="true">
            <Zap className="brand-mark__icon text-emerald-400" size={28} />
            <span className="brand-mark__slash" />
          </span>
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
        <section className="telemetry-hero" aria-labelledby="telemetry-hero-title">
          <div className="telemetry-hero__copy">
            <div className="telemetry-hero__emblem" aria-hidden="true">
              <Zap size={54} strokeWidth={1.6} />
              <span className="telemetry-hero__emblem-slash" />
            </div>
            <h1 className="telemetry-hero__title" id="telemetry-hero-title" aria-label="SafeNetQ Telemetry">
              <span className="telemetry-title__text" data-text="SafeNetQ Telemetry" aria-hidden="true">
                <span className="telemetry-title__word">
                  {"SafeNetQ".split("").map((letter, index) => (
                    <span className="telemetry-title__char" style={{ transitionDelay: `${index * 18}ms` }} key={`brand-${index}`}>{letter}</span>
                  ))}
                </span>
                <span className="telemetry-title__word telemetry-title__word--accent">
                  {"Telemetry".split("").map((letter, index) => (
                    <span className="telemetry-title__char" style={{ transitionDelay: `${(index + 8) * 18}ms` }} key={`telemetry-${index}`}>{letter}</span>
                  ))}
                </span>
              </span>
              <svg className="telemetry-title__spark" viewBox="0 0 1000 100" preserveAspectRatio="none" aria-hidden="true">
                <path d="M0 52 H438 L454 45 L465 59 L482 22 L498 76 L514 51 H1000" pathLength="1000" />
              </svg>
            </h1>
            <p className="telemetry-hero__subtitle">
              Real-Time Monitoring and Relay-Based Protection for Power Distribution Systems Using Adaptive Baseline Learning
            </p>
          </div>
          <a className="telemetry-hero__scroll" href="#telemetry-dashboard" aria-label="Scroll to the telemetry dashboard">
            <span>SCROLL TO MONITOR</span>
            <ChevronDown size={20} aria-hidden="true" />
          </a>
        </section>

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
