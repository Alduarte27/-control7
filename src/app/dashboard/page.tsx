import DashboardClient from '@/components/dashboard-client';
import { getCategories, getProducts } from '@/services/data-service';

export default async function DashboardPage() {
  const categories = await getCategories();
  const products = await getProducts();
  return <DashboardClient prefetchedCategories={categories} prefetchedProducts={products} />;
}
