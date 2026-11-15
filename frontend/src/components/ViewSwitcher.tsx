import { Children, type CSSProperties, type KeyboardEvent, type ReactNode, useRef } from 'react';
import { Activity, ShieldCheck } from 'lucide-react';
import './ViewSwitcher.css';

export type DashboardMode = 'monitor' | 'relay';

const MODES: { id: DashboardMode; label: string; icon: typeof Activity; accent: string }[] = [
  { id: 'monitor', label: 'SAFENETQ TELEMETRY', icon: Activity, accent: '#34d399' },
  { id: 'relay', label: 'RELAY & FAULT LOGS', icon: ShieldCheck, accent: '#818cf8' },
];

interface ViewSwitcherProps {
  activeView: DashboardMode;
  onViewChange: (view: DashboardMode) => void;
}

export function ViewSwitcher({ activeView, onViewChange }: ViewSwitcherProps) {
  const activeIndex = MODES.findIndex((mode) => mode.id === activeView);
  const activeMode = MODES[activeIndex] ?? MODES[0];
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const style = {
    '--indicator-offset': `${activeIndex * 100}%`,
    '--active-accent': activeMode.accent,
  } as CSSProperties;

  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex = index;
    if (event.key === 'ArrowRight') nextIndex = (index + 1) % MODES.length;
    else if (event.key === 'ArrowLeft') nextIndex = (index - 1 + MODES.length) % MODES.length;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = MODES.length - 1;
    else return;

    event.preventDefault();
    onViewChange(MODES[nextIndex].id);
    tabRefs.current[nextIndex]?.focus();
  };

  return (
    <div className="mode-switcher" role="tablist" aria-label="Dashboard views" style={style}>
      <span className="mode-switcher__indicator" aria-hidden="true" />
      {MODES.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          className="mode-switcher__tab"
          type="button"
          id={`mode-tab-${id}`}
          role="tab"
          aria-selected={activeView === id}
          tabIndex={activeView === id ? 0 : -1}
          aria-controls={`mode-panel-${id}`}
          ref={(element) => { tabRefs.current[MODES.findIndex((mode) => mode.id === id)] = element; }}
          onKeyDown={(event) => handleTabKeyDown(event, MODES.findIndex((mode) => mode.id === id))}
          onClick={() => onViewChange(id)}
        >
          <Icon size={17} strokeWidth={1.9} aria-hidden="true" />
          <span>{label}</span>
        </button>
      ))}
    </div>
  );
}

interface ViewStageProps {
  activeView: DashboardMode;
  children: ReactNode;
}

export function ViewStage({ activeView, children }: ViewStageProps) {
  const panels = Children.toArray(children);
  const activeIndex = MODES.findIndex((mode) => mode.id === activeView);
  const style = { '--stage-offset': `${activeIndex * -100}%` } as CSSProperties;

  return (
    <div className="view-stage" aria-live="polite">
      <div className="view-stage__track" style={style}>
        {panels.map((panel, index) => {
          const isActive = index === activeIndex;
          return (
            <section
              key={MODES[index]?.id ?? index}
              className={`view-stage__panel${isActive ? ' is-active' : ''}`}
              data-view={MODES[index]?.id}
              id={`mode-panel-${MODES[index]?.id ?? index}`}
              role="tabpanel"
              aria-hidden={!isActive}
              aria-labelledby={`mode-tab-${MODES[index]?.id ?? index}`}
              inert={!isActive}
            >
              {panel}
            </section>
          );
        })}
      </div>
    </div>
  );
}
