import DashboardClient from '@/components/dashboard-client';
import { getFreshCategories, getFreshProducts } from '@/services/data-service';

export default async function DashboardPage() {
  const categories = await getFreshCategories();
  const products = await getFreshProducts();
  return <DashboardClient prefetchedCategories={categories} prefetchedProducts={products} />;
}
