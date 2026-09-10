type StartupPresentationProps = {
  label: string;
  percentage: number;
  showBackdrop: boolean;
};

/** A lightweight title plate shared by the lazy import and scene assembly. */
export function StartupPresentation({
  label,
  percentage,
  showBackdrop,
}: StartupPresentationProps) {
  if (!showBackdrop && percentage >= 100) return null;

  return (
    <>
      {showBackdrop ? (
        <div className="three-startup-curtain" aria-hidden="true" />
      ) : null}
      <div
        className={`three-progress${showBackdrop ? " three-progress--startup" : ""}`}
        role="status"
      >
        {showBackdrop ? (
          <header className="three-startup-brand" aria-hidden="true">
            <svg className="three-startup-mark" viewBox="0 0 100 76" fill="none">
              <path d="M7 45 50 20 93 45 50 70Z" fill="#d5c4a5" />
              <path d="m7 45 43 25v5L7 50Z" fill="#bbaa8b" />
              <path d="m50 70 43-25v5L50 75Z" fill="#9caa9e" />
              <path d="m20 37 13-8 13 8-13 8Z" fill="#efdfb9" />
              <path d="m20 37 13 8v14l-13-8Z" fill="#b78150" />
              <path d="m33 45 13-8v14l-13 8Z" fill="#d5a569" />
              <path d="m43 19 16-9 16 9-16 9Z" fill="#f5e8c6" />
              <path d="m43 19 16 9v29l-16-9Z" fill="#b78150" />
              <path d="m59 28 16-9v29l-16 9Z" fill="#d5a569" />
              <path d="m49 35 5 3m-5 5 5 3m11-14 5-3m-5 11 5-3" stroke="#645f4d" strokeWidth="2" />
            </svg>
            <span className="three-startup-eyebrow">Isometric</span>
            <strong className="three-startup-title">Berlin</strong>
          </header>
        ) : null}
        <span className="three-progress-label">{label}</span>
        <strong className="three-progress-percentage" aria-hidden="true">
          {percentage}%
        </strong>
        <div className="three-progress-track" aria-hidden="true">
          <span style={{ width: `${percentage}%` }} />
        </div>
      </div>
    </>
  );
}
