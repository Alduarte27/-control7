'use client';

import React from 'react';
import Link from 'next/link';
import { Factory, ChevronLeft, PlusCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import type { ProductDefinition } from '@/lib/types';

const PRODUCTS_STORAGE_KEY = 'control7-products-list';

export default function AdminClient() {
  const [products, setProducts] = React.useState<ProductDefinition[]>([]);
  const [newProductName, setNewProductName] = React.useState('');
  const { toast } = useToast();

  React.useEffect(() => {
    try {
      const savedProducts = localStorage.getItem(PRODUCTS_STORAGE_KEY);
      if (savedProducts) {
        setProducts(JSON.parse(savedProducts));
      }
    } catch (error) {
      console.error('Error loading products from localStorage', error);
    }
  }, []);

  const saveProducts = (updatedProducts: ProductDefinition[]) => {
    try {
        localStorage.setItem(PRODUCTS_STORAGE_KEY, JSON.stringify(updatedProducts));
        setProducts(updatedProducts);
    } catch (error) {
        toast({
            title: 'Error',
            description: 'No se pudieron guardar los productos.',
            variant: 'destructive',
        });
    }
  };

  const handleAddProduct = () => {
    if (newProductName.trim() === '') {
      toast({
        title: 'Error',
        description: 'El nombre del producto no puede estar vacío.',
        variant: 'destructive',
      });
      return;
    }

    const newProduct: ProductDefinition = {
      id: `prod-${Date.now()}`,
      productName: newProductName.trim(),
    };
    
    const updatedProducts = [...products, newProduct];
    saveProducts(updatedProducts);
    
    setNewProductName('');
    toast({
      title: 'Producto Añadido',
      description: `Se ha añadido "${newProduct.productName}".`,
    });
  };

  return (
    <div className="bg-background min-h-screen text-foreground">
      <header className="flex items-center justify-between p-4 border-b bg-card sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Factory className="h-8 w-8 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">Administración</h1>
        </div>
        <Link href="/">
          <Button variant="outline">
            <ChevronLeft className="mr-2 h-4 w-4" />
            Volver a la Planificación
          </Button>
        </Link>
      </header>
      <main className="p-4 md:p-8 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Gestionar Productos</CardTitle>
            <CardDescription>Añade nuevas presentaciones a la lista de productos disponibles para la planificación.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-end gap-2">
              <div className="flex-grow">
                <Label htmlFor="new-product">Nombre del Nuevo Producto</Label>
                <Input 
                  id="new-product"
                  value={newProductName}
                  onChange={(e) => setNewProductName(e.target.value)}
                  placeholder="Ej: Azúcar 1kg (50kg) San Juan"
                />
              </div>
              <Button onClick={handleAddProduct}>
                <PlusCircle className="mr-2 h-4 w-4" />
                Añadir Producto
              </Button>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Lista de Productos Actual</CardTitle>
          </CardHeader>
          <CardContent>
             {products.length > 0 ? (
                <ul className="space-y-2">
                    {products.map((product) => (
                        <li key={product.id} className="border p-3 rounded-md bg-muted/50">
                           {product.productName}
                        </li>
                    ))}
                </ul>
             ) : (
                <p className="text-muted-foreground text-center py-4">No hay productos definidos. Comienza añadiendo uno.</p>
             )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
