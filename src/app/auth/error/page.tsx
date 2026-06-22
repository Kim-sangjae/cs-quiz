import { Suspense } from 'react';
import ErrorClient from './ErrorClient';

export default function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  return (
    <Suspense>
      <ErrorContent searchParams={searchParams} />
    </Suspense>
  );
}

async function ErrorContent({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return <ErrorClient error={error ?? ''} />;
}
