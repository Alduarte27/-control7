import ReportClient from '@/components/report-client';
import { db } from '@/lib/firebase';
import type { ProductData } from '@/lib/types';
import { doc, getDoc } from 'firebase/firestore';
import { notFound } from 'next/navigation';

async function getPlanData(planId: string) {
    try {
        const planDocRef = doc(db, "productionPlans", planId);
        const planDocSnap = await getDoc(planDocRef);

        if (!planDocSnap.exists()) {
            return null;
        }
        
        const data = planDocSnap.data();
        return {
            data: data.products as ProductData[],
            week: data.week as number,
            year: data.year as number,
        };
    } catch (error) {
        console.error("Error fetching plan data for report:", error);
        return null;
    }
}


export default async function ReportPage({ searchParams }: { searchParams?: { [key: string]: string | string[] | undefined } }) {
  const planId = typeof searchParams?.planId === 'string' ? searchParams.planId : undefined;

  if (!planId) {
    return (
        <div className="flex items-center justify-center h-screen">
            <p>ID de plan no especificado. Por favor, genera el reporte desde la página principal.</p>
        </div>
    );
  }

  const reportData = await getPlanData(planId);

  if (!reportData) {
      notFound();
  }

  return (
    <ReportClient 
        initialData={reportData.data}
        week={reportData.week}
        year={reportData.year}
    />
  );
}
