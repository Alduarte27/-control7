import IAClient from '@/components/ia-client';

export default function IAPage({ searchParams }: { searchParams?: { [key: string]: string | string[] | undefined } }) {
  const planId = typeof searchParams?.planId === 'string' ? searchParams.planId : undefined;
  
  return <IAClient initialPlanId={planId} />;
}
