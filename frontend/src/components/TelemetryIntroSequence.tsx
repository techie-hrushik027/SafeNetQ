import { useEffect, useRef } from 'react';
import { ZapOff } from 'lucide-react';
import './TelemetryIntroSequence.css';

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const range = (value: number, start: number, end: number) => {
  const t = clamp01((value - start) / (end - start));
  return t * t * (3 - 2 * t);
};

export function TelemetryIntroSequence() {
  const sequenceRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const sequence = sequenceRef.current;
    if (!sequence) return;

    let frame = 0;
    const paintProgress = () => {
      frame = 0;
      const pin = sequence.querySelector<HTMLElement>('.telemetry-storm__pin');
      const nav = document.querySelector<HTMLElement>('.app-topbar');
      const navHeight = nav?.getBoundingClientRect().height ?? 68;
      sequence.style.setProperty('--nav-height', `${navHeight}px`);

      const travel = Math.max(1, sequence.offsetHeight - (window.innerHeight - navHeight));
      const distance = navHeight - sequence.getBoundingClientRect().top;
      const progress = clamp01(distance / travel);

      const bolts = [
        { id: 'a', draw: range(progress, 0.02, 0.3), fade: range(progress, 0.34, 0.56) },
        { id: 'b', draw: range(progress, 0.2, 0.5), fade: range(progress, 0.53, 0.75) },
        { id: 'c', draw: range(progress, 0.38, 0.68), fade: range(progress, 0.7, 0.88) },
      ];
      bolts.forEach(({ id, draw, fade }) => {
        sequence.style.setProperty(`--bolt-${id}-dash`, `${1 - draw}`);
        sequence.style.setProperty(`--bolt-${id}-opacity`, `${draw * (1 - fade * 0.56)}`);
      });

      const mark = range(progress, 0.55, 0.72);
      const title = range(progress, 0.72, 0.92);
      const titleSettle = range(progress, 0.82, 0.99);
      const glow = clamp01(1 - Math.abs(progress - 0.82) / 0.13) * title;
      const flash = Math.max(
        clamp01(1 - Math.abs(progress - 0.16) / 0.045),
        clamp01(1 - Math.abs(progress - 0.39) / 0.04),
        clamp01(1 - Math.abs(progress - 0.61) / 0.045),
      );

      sequence.style.setProperty('--storm-progress', `${progress}`);
      sequence.style.setProperty('--storm-flash', `${flash * 0.28}`);
      sequence.style.setProperty('--storm-flash-soft', `${flash * 0.14}`);
      sequence.style.setProperty('--mark-opacity', `${mark * (1 - range(progress, 0.69, 0.76) * 0.82)}`);
      sequence.style.setProperty('--mark-scale', `${0.72 + mark * 0.28}`);
      sequence.style.setProperty('--mark-y', `${(1 - mark) * 60}px`);
      sequence.style.setProperty('--mark-tilt', `${(1 - mark) * 48}deg`);
      sequence.style.setProperty('--mark-cross', `${range(progress, 0.65, 0.7) * (1 - range(progress, 0.75, 0.79))}`);
      sequence.style.setProperty('--title-opacity', `${title}`);
      sequence.style.setProperty('--title-scale', `${0.86 + titleSettle * 0.14}`);
      sequence.style.setProperty('--title-y', `${(1 - titleSettle) * 110}px`);
      sequence.style.setProperty('--title-blur', `${(1 - titleSettle) * 16}px`);
      sequence.style.setProperty('--title-glow', `${glow}`);
      sequence.style.setProperty('--title-glow-soft', `${glow * 0.72}`);
      sequence.style.setProperty('--subtitle-opacity', `${range(progress, 0.84, 0.97)}`);
      sequence.style.setProperty('--subtitle-y', `${(1 - range(progress, 0.86, 0.98)) * 48}px`);
      sequence.style.setProperty('--cue-opacity', `${1 - range(progress, 0.02, 0.08)}`);
      if (pin) pin.dataset.progress = progress.toFixed(3);
    };
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(paintProgress);
    };

    schedule();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, []);

  return (
    <section className="telemetry-storm" ref={sequenceRef} aria-label="SafeNetQ introduction">
      <div className="telemetry-storm__pin">
        <div className="telemetry-storm__sky" aria-hidden="true" />

        <svg className="telemetry-storm__definitions" aria-hidden="true" focusable="false">
          <defs>
            <linearGradient id="storm-bolt-color" x1="0" y1="0" x2="0.15" y2="1">
              <stop offset="0" stopColor="#dffcff" />
              <stop offset="0.48" stopColor="#69e8ff" />
              <stop offset="1" stopColor="#3b82f6" />
            </linearGradient>
            <filter id="storm-bolt-glow" x="-100%" y="-30%" width="300%" height="160%">
              <feGaussianBlur stdDeviation="14" />
            </filter>
            <filter id="storm-bolt-core-glow" x="-80%" y="-30%" width="260%" height="160%">
              <feGaussianBlur stdDeviation="4" />
            </filter>
            <filter id="kinetic-flowfield" x="-20%" y="-35%" width="140%" height="170%">
              <feTurbulence type="fractalNoise" baseFrequency="0.009 0.045" numOctaves="1" seed="7" result="flow-noise">
                <animate attributeName="baseFrequency" values="0.008 0.035;0.015 0.065;0.008 0.035" dur="3.4s" repeatCount="indefinite" />
              </feTurbulence>
              <feDisplacementMap in="SourceGraphic" in2="flow-noise" scale="24" xChannelSelector="R" yChannelSelector="G">
                <animate attributeName="scale" values="8;28;12;24" dur="2.8s" repeatCount="indefinite" />
              </feDisplacementMap>
            </filter>
          </defs>
        </svg>

        <svg className="telemetry-storm__bolts" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
          <g className="storm-bolt storm-bolt--a">
            <path className="storm-bolt__halo" pathLength="1" d="M490 -40 L520 45 L482 101 L520 159 L468 219 L497 278 L438 332 L465 391 L403 451 L431 512 L372 571 L401 633 L344 692 L374 750 L319 812 L342 870 L293 940 M468 219 L387 240 L349 286 M465 391 L548 415 L583 461 M372 571 L292 585 L254 628 M344 692 L425 711 L462 754" />
            <path className="storm-bolt__core-glow" pathLength="1" d="M490 -40 L520 45 L482 101 L520 159 L468 219 L497 278 L438 332 L465 391 L403 451 L431 512 L372 571 L401 633 L344 692 L374 750 L319 812 L342 870 L293 940 M468 219 L387 240 L349 286 M465 391 L548 415 L583 461 M372 571 L292 585 L254 628 M344 692 L425 711 L462 754" />
            <path className="storm-bolt__core" pathLength="1" d="M490 -40 L520 45 L482 101 L520 159 L468 219 L497 278 L438 332 L465 391 L403 451 L431 512 L372 571 L401 633 L344 692 L374 750 L319 812 L342 870 L293 940 M468 219 L387 240 L349 286 M465 391 L548 415 L583 461 M372 571 L292 585 L254 628 M344 692 L425 711 L462 754" />
          </g>
          <g className="storm-bolt storm-bolt--b">
            <path className="storm-bolt__halo" pathLength="1" d="M1125 -50 L1090 42 L1135 104 L1090 162 L1144 226 L1101 287 L1151 347 L1098 405 L1142 466 L1084 526 L1125 584 L1061 641 L1104 701 L1045 756 L1081 819 L1028 878 L1055 940 M1144 226 L1222 242 L1266 284 M1142 466 L1054 483 L1012 531 M1104 701 L1181 715 L1219 758" />
            <path className="storm-bolt__core-glow" pathLength="1" d="M1125 -50 L1090 42 L1135 104 L1090 162 L1144 226 L1101 287 L1151 347 L1098 405 L1142 466 L1084 526 L1125 584 L1061 641 L1104 701 L1045 756 L1081 819 L1028 878 L1055 940 M1144 226 L1222 242 L1266 284 M1142 466 L1054 483 L1012 531 M1104 701 L1181 715 L1219 758" />
            <path className="storm-bolt__core" pathLength="1" d="M1125 -50 L1090 42 L1135 104 L1090 162 L1144 226 L1101 287 L1151 347 L1098 405 L1142 466 L1084 526 L1125 584 L1061 641 L1104 701 L1045 756 L1081 819 L1028 878 L1055 940 M1144 226 L1222 242 L1266 284 M1142 466 L1054 483 L1012 531 M1104 701 L1181 715 L1219 758" />
          </g>
          <g className="storm-bolt storm-bolt--c">
            <path className="storm-bolt__halo" pathLength="1" d="M807 -55 L780 38 L821 99 L775 160 L809 218 L755 279 L794 338 L739 397 L779 456 L721 516 L758 576 L704 633 L739 692 L682 749 L715 808 L664 866 L689 940 M809 218 L893 239 L928 278 M779 456 L856 474 L900 517 M704 633 L623 651 L588 691" />
            <path className="storm-bolt__core-glow" pathLength="1" d="M807 -55 L780 38 L821 99 L775 160 L809 218 L755 279 L794 338 L739 397 L779 456 L721 516 L758 576 L704 633 L739 692 L682 749 L715 808 L664 866 L689 940 M809 218 L893 239 L928 278 M779 456 L856 474 L900 517 M704 633 L623 651 L588 691" />
            <path className="storm-bolt__core" pathLength="1" d="M807 -55 L780 38 L821 99 L775 160 L809 218 L755 279 L794 338 L739 397 L779 456 L721 516 L758 576 L704 633 L739 692 L682 749 L715 808 L664 866 L689 940 M809 218 L893 239 L928 278 M779 456 L856 474 L900 517 M704 633 L623 651 L588 691" />
          </g>
        </svg>

        <div className="telemetry-storm__safety-mark" aria-hidden="true">
          <ZapOff size={138} strokeWidth={1.15} />
          <span className="telemetry-storm__crossing" />
        </div>

        <div className="telemetry-storm__title-block">
          <h1 className="telemetry-storm__title kinetic-heading" data-text="SafeNetQ Telemetry" aria-label="SafeNetQ Telemetry">SafeNetQ Telemetry</h1>
          <p className="telemetry-storm__subtitle">
            Real-Time Monitoring and Relay-Based Protection for Power Distribution Systems Using Adaptive Baseline Learning
          </p>
        </div>

        <div className="telemetry-storm__scroll" style={{ opacity: 'var(--cue-opacity, 1)' }} aria-hidden="true">
          <span>SCROLL TO REVEAL</span>
          <i />
        </div>
      </div>
    </section>
  );
}
