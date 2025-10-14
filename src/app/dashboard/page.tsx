import DashboardClient from '@/components/dashboard-client';
import { getCachedCategories, getCachedProducts } from '@/services/data-service';

export default async function DashboardPage() {
  const categories = await getCachedCategories();
  const products = await getCachedProducts();
  return <DashboardClient prefetchedCategories={categories} prefetchedProducts={products} />;
}
