import IAClient from '@/components/ia-client';
import { getCachedCategories } from '@/services/data-service';

export default async function IAPage({ searchParams }: { searchParams?: { [key: string]: string | string[] | undefined } }) {
  const planId = typeof searchParams?.planId === 'string' ? searchParams.planId : undefined;
  
  const categories = await getCachedCategories();

  return <IAClient initialPlanId={planId} prefetchedCategories={categories} />;
}
