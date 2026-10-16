import ReportClient from '@/components/report-client';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Reporte de Producción - Control 7 SGP',
  description: 'Reporte de pesos por máquina y turno',
};

export default async function ReportPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; shift?: string }>;
}) {
  const { date, shift } = await searchParams;
  return <ReportClient initialDate={date} initialShift={shift as 'day' | 'night' | undefined} />;
}
