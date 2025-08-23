import Control7Client from '@/components/control-7-client';

export default function Home({ searchParams }: { searchParams?: { [key: string]: string | string[] | undefined } }) {
  const planId = typeof searchParams?.planId === 'string' ? searchParams.planId : undefined;
  
  return <Control7Client initialPlanId={planId} />;
}
