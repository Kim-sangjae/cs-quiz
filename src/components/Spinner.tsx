interface SpinnerProps {
  size?: number;
  className?: string;
}

export default function Spinner({ size = 24, className = '' }: SpinnerProps) {
  return (
    <div
      style={{ width: size, height: size }}
      className={`rounded-full border-2 border-neutral-800 border-t-neutral-400 animate-spin flex-shrink-0 ${className}`}
    />
  );
}
