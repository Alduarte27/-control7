'use client';

import React from 'react';
import Link from 'next/link';
import { Factory, ChevronLeft, PlusCircle, GripVertical, Edit } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import type { ProductDefinition, ProductCategory } from '@/lib/types';
import { db } from '@/lib/firebase';
import { collection, addDoc, getDocs, writeBatch, doc, query, orderBy, updateDoc } from 'firebase/firestore';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';


function EditProductDialog({
    product,
    onClose,
    onSave,
}: {
    product: ProductDefinition;
    onClose: () => void;
    onSave: (updatedProduct: ProductDefinition) => void;
}) {
    const [productName, setProductName] = React.useState(product.productName);
    const [category, setCategory] = React.useState<ProductCategory>(product.category || 'Familiar');

    const handleSave = () => {
        onSave({
            ...product,
            productName,
            category,
        });
    };

    return (
        <Dialog open={true} onOpenChange={onClose}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Editar Producto</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="edit-product-name">Nombre del Producto</Label>
                        <Input
                            id="edit-product-name"
                            value={productName}
                            onChange={(e) => setProductName(e.target.value)}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="edit-product-category">Categoría</Label>
                        <Select value={category} onValueChange={(value: ProductCategory) => setCategory(value)}>
                            <SelectTrigger id="edit-product-category">
                                <SelectValue placeholder="Seleccionar categoría" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Familiar">Familiar</SelectItem>
                                <SelectItem value="Granel">Granel</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <DialogFooter>
                    <DialogClose asChild>
                        <Button type="button" variant="secondary">Cancelar</Button>
                    </DialogClose>
                    <Button type="button" onClick={handleSave}>Guardar Cambios</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}


function SortableItem({ product, onEdit }: { product: ProductDefinition, onEdit: (product: ProductDefinition) => void }) {
    const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
    } = useSortable({ id: product.id });
  
    const style = {
      transform: CSS.Transform.toString(transform),
      transition,
    };
  
    return (
      <li ref={setNodeRef} style={style} className="border p-3 rounded-md bg-muted/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
            <button {...attributes} {...listeners} className="cursor-grab p-1">
                <GripVertical className="h-5 w-5 text-muted-foreground" />
            </button>
            {product.productName}
        </div>
        <div className="flex items-center gap-2">
            <Badge variant={product.category === 'Familiar' ? 'secondary' : 'outline'}>
            {product.category || 'Sin categoría'}
            </Badge>
            <Button variant="ghost" size="icon" onClick={() => onEdit(product)}>
                <Edit className="h-4 w-4" />
            </Button>
        </div>
      </li>
    );
}

export default function AdminClient() {
  const [products, setProducts] = React.useState<ProductDefinition[]>([]);
  const [newProductName, setNewProductName] = React.useState('');
  const [newProductCategory, setNewProductCategory] = React.useState<ProductCategory>('Familiar');
  const [editingProduct, setEditingProduct] = React.useState<ProductDefinition | null>(null);
  const { toast } = useToast();
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  React.useEffect(() => {
    const fetchProducts = async () => {
        try {
            const productsCollection = collection(db, 'products');
            const q = query(productsCollection, orderBy('order'));
            const productsSnapshot = await getDocs(q);
            const productsList = productsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ProductDefinition));
            setProducts(productsList);
        } catch (error) {
            console.error('Error loading products from Firestore', error);
            toast({
                title: 'Error',
                description: 'No se pudieron cargar los productos.',
                variant: 'destructive',
            });
        }
    };
    fetchProducts();
  }, [toast]);

  const handleAddProduct = async () => {
    if (newProductName.trim() === '') {
      toast({
        title: 'Error',
        description: 'El nombre del producto no puede estar vacío.',
        variant: 'destructive',
      });
      return;
    }

    try {
        const newOrder = products.length > 0 ? Math.max(...products.map(p => p.order)) + 1 : 0;
        const newProductData = {
            productName: newProductName.trim(),
            order: newOrder,
            category: newProductCategory,
        };
        const docRef = await addDoc(collection(db, 'products'), newProductData);

        const newProduct: ProductDefinition = {
            id: docRef.id,
            ...newProductData
        };

        setProducts(prevProducts => [...prevProducts, newProduct]);
        setNewProductName('');
        toast({
            title: 'Producto Añadido',
            description: `Se ha añadido "${newProduct.productName}".`,
        });

    } catch (error) {
        console.error('Error adding product to Firestore: ', error);
        toast({
            title: 'Error',
            description: 'No se pudo añadir el producto.',
            variant: 'destructive',
        });
    }
  };
  
  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (active.id !== over?.id) {
      setProducts((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over!.id);
        const newItems = arrayMove(items, oldIndex, newIndex);
        
        // Update order in Firestore
        updateProductOrder(newItems);

        return newItems;
      });
    }
  };

  const handleSaveProduct = async (updatedProduct: ProductDefinition) => {
      try {
          const productRef = doc(db, 'products', updatedProduct.id);
          await updateDoc(productRef, {
              productName: updatedProduct.productName,
              category: updatedProduct.category,
          });
          
          setProducts(products.map(p => p.id === updatedProduct.id ? updatedProduct : p));
          setEditingProduct(null);

          toast({
              title: 'Producto Actualizado',
              description: `Se ha actualizado "${updatedProduct.productName}".`,
          });
      } catch (error) {
          console.error('Error updating product: ', error);
          toast({
              title: 'Error',
              description: 'No se pudo actualizar el producto.',
              variant: 'destructive',
          });
      }
  };
  
  const updateProductOrder = async (newOrderedProducts: ProductDefinition[]) => {
      try {
          const batch = writeBatch(db);
          newOrderedProducts.forEach((product, index) => {
              const productRef = doc(db, 'products', product.id);
              batch.update(productRef, { order: index });
          });
          await batch.commit();
          toast({
              title: 'Orden Actualizado',
              description: 'El orden de los productos ha sido guardado.',
          });
      } catch (error) {
          console.error('Error updating product order: ', error);
          toast({
              title: 'Error',
              description: 'No se pudo guardar el nuevo orden de los productos.',
              variant: 'destructive',
          });
      }
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
            <CardDescription>Añade nuevas presentaciones, asigna una categoría y reordénalas.</CardDescription>
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
              <div className="w-48">
                <Label htmlFor="new-product-category">Categoría</Label>
                <Select value={newProductCategory} onValueChange={(value: ProductCategory) => setNewProductCategory(value)}>
                    <SelectTrigger id="new-product-category">
                        <SelectValue placeholder="Seleccionar categoría" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="Familiar">Familiar</SelectItem>
                        <SelectItem value="Granel">Granel</SelectItem>
                    </SelectContent>
                </Select>
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
                <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                >
                    <SortableContext items={products} strategy={verticalListSortingStrategy}>
                        <ul className="space-y-2">
                            {products.map((product) => (
                                <SortableItem key={product.id} product={product} onEdit={setEditingProduct} />
                            ))}
                        </ul>
                    </SortableContext>
                </DndContext>
             ) : (
                <p className="text-muted-foreground text-center py-4">No hay productos definidos. Comienza añadiendo uno.</p>
             )}
          </CardContent>
        </Card>
      </main>
      {editingProduct && (
          <EditProductDialog 
              product={editingProduct}
              onClose={() => setEditingProduct(null)}
              onSave={handleSaveProduct}
          />
      )}
    </div>
  );
}
