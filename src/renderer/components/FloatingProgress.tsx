type FloatingProgressProps = {
  label: string;
  percent: number;
};

export const FloatingProgress = ({ label, percent }: FloatingProgressProps) => {
  const clampedPercent = Math.min(Math.max(percent, 0), 100);

  return (
    <div className="floating-progress" role="status" aria-live="polite">
      <div className="floating-progress-header">
        <span className="floating-progress-label">{label}</span>
        <strong className="floating-progress-percent">{clampedPercent}%</strong>
      </div>
      <div
        className="floating-progress-track"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={clampedPercent}
      >
        <div className="floating-progress-fill" style={{ width: `${clampedPercent}%` }} />
      </div>
    </div>
  );
};
