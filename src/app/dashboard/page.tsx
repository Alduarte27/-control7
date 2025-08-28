import DashboardClient from '@/components/dashboard-client';
import { getCachedCategories } from '@/services/data-service';

export default async function DashboardPage() {
  const categories = await getCachedCategories();
  return <DashboardClient prefetchedCategories={categories} />;
}
