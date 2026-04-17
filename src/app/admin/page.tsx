import AdminClient from '@/components/admin-client';
import { getCategories, getProducts } from '@/services/data-service';

export default async function AdminPage() {
  // Although the client component fetches data, pre-fetching on the server
  // ensures the data is available in the cache for the initial client render,
  // potentially speeding up the initial load.
  await Promise.all([getCategories(), getProducts()]);
  
  return <AdminClient />;
}
