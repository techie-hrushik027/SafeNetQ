import './AuroraField.css';

/** Soft, liquid color fields that flow behind the SafeNetQ dashboard. */
export function AuroraField() {
  return (
    <div className="aurora-field" aria-hidden="true">
      <div className="aurora-flow aurora-flow--blue" />
      <div className="aurora-flow aurora-flow--violet" />
      <div className="aurora-flow aurora-flow--cyan" />
      <div className="aurora-flow aurora-flow--teal" />
    </div>
  );
}
