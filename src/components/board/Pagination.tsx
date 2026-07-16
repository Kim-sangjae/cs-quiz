'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useCallback } from 'react';
import PaginationNav from '@/components/PaginationNav';

interface PaginationProps {
  currentPage: number;
  pageCount: number;
}

export default function Pagination({ currentPage, pageCount }: PaginationProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const goTo = useCallback(
    (page: number) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set('page', String(page));
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams]
  );

  return <PaginationNav page={currentPage} pageCount={pageCount} onChange={goTo} />;
}
