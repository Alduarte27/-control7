import HistoryClient from '@/components/history-client';
import React, { Suspense } from 'react';

export const dynamic = 'force-dynamic';

export default function HistoryPage() {
  return (
    <Suspense fallback={<div>Cargando historial...</div>}>
      <HistoryClient />
    </Suspense>
  );
}
