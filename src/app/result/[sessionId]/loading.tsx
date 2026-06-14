import Spinner from '@/components/Spinner';

export default function Loading() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <Spinner size={32} />
    </div>
  );
}
