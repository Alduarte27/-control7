import Control7Client from '@/components/control-7-client';
import { getCachedCategories, getCachedProducts } from '@/services/data-service';

export default async function Home({ searchParams }: { searchParams?: { [key: string]: string | string[] | undefined } }) {
  // NOTA: No pasamos el planId a propósito.
  // Esto fuerza a que la página de inicio SIEMPRE cargue la semana actual,
  // rompiendo el caché de la URL para los usuarios que tenían un planId antiguo guardado.
  // La navegación desde el historial seguirá funcionando porque el cliente leerá los searchParams.
  const planId = typeof searchParams?.planId === 'string' ? searchParams.planId : undefined;
  
  // Pre-fetch data on the server. This will be cached.
  const categories = await getCachedCategories();
  const products = await getCachedProducts();

  return <Control7Client 
    initialPlanId={planId} 
    prefetchedCategories={categories}
    prefetchedProducts={products}
  />;
}
