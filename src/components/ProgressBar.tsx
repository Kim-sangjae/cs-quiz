interface ProgressBarProps {
  answered: number;
  total: number;
}

export default function ProgressBar({ answered, total }: ProgressBarProps) {
  const pct = Math.min((answered / total) * 100, 100);
  return (
    <div className="w-full bg-neutral-800 rounded-full h-1">
      <div
        className="bg-white rounded-full h-1 transition-all duration-200"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
