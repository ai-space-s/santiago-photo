type ProgressBarProps = {
  label: string;
  value: number;
  message?: string;
};

export const ProgressBar = ({ label, value, message }: ProgressBarProps) => (
  <footer className="status-bar">
    <span>{label}</span>
    <div className="progress-track" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={value}>
      <div className="progress-fill" style={{ width: `${Math.min(Math.max(value, 0), 100)}%` }} />
    </div>
    <span>{message ?? `${value}%`}</span>
  </footer>
);
