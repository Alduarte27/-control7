'use client';

import React from 'react';
import Link from 'next/link';
import { Factory, ChevronLeft, PlusCircle, GripVertical, Edit, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import type { ProductDefinition, CategoryDefinition } from '@/lib/types';
import { db } from '@/lib/firebase';
import { collection, addDoc, getDocs, writeBatch, doc, query, orderBy, updateDoc, deleteDoc } from 'firebase/firestore';
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
import { Separator } from './ui/separator';

function EditProductDialog({
    product,
    categories,
    onClose,
    onSave,
}: {
    product: ProductDefinition;
    categories: CategoryDefinition[];
    onClose: () => void;
    onSave: (updatedProduct: ProductDefinition) => void;
}) {
    const [productName, setProductName] = React.useState(product.productName);
    const [categoryId, setCategoryId] = React.useState<string>(product.categoryId);
    const [color, setColor] = React.useState(product.color || '#000000');

    const handleSave = () => {
        onSave({
            ...product,
            productName,
            categoryId,
            color,
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
                        <Select value={categoryId} onValueChange={(value: string) => setCategoryId(value)}>
                            <SelectTrigger id="edit-product-category">
                                <SelectValue placeholder="Seleccionar categoría" />
                            </SelectTrigger>
                            <SelectContent>
                                {categories.map(cat => (
                                    <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="edit-product-color">Color del Producto</Label>
                        <Input
                            id="edit-product-color"
                            type="color"
                            value={color}
                            onChange={(e) => setColor(e.target.value)}
                            className="w-24 h-10 p-1"
                        />
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


function SortableItem({ product, categoryName, onEdit }: { product: ProductDefinition, categoryName: string, onEdit: (product: ProductDefinition) => void }) {
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
            <div className="flex items-center gap-2">
              <span className="h-4 w-4 rounded-full" style={{ backgroundColor: product.color || '#ccc' }}></span>
              {product.productName}
            </div>
        </div>
        <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{categoryName}</span>
            <Button variant="ghost" size="icon" onClick={() => onEdit(product)}>
                <Edit className="h-4 w-4" />
            </Button>
        </div>
      </li>
    );
}

export default function AdminClient() {
  const [products, setProducts] = React.useState<ProductDefinition[]>([]);
  const [categories, setCategories] = React.useState<CategoryDefinition[]>([]);
  const [newProductName, setNewProductName] = React.useState('');
  const [newProductCategoryId, setNewProductCategoryId] = React.useState<string>('');
  const [newCategoryName, setNewCategoryName] = React.useState('');
  const [editingProduct, setEditingProduct] = React.useState<ProductDefinition | null>(null);
  const { toast } = useToast();
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  React.useEffect(() => {
    const fetchInitialData = async () => {
        try {
            const categoriesSnapshot = await getDocs(query(collection(db, 'categories'), orderBy('name')));
            const categoriesList = categoriesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CategoryDefinition));
            setCategories(categoriesList);

            if (categoriesList.length > 0 && !newProductCategoryId) {
              setNewProductCategoryId(categoriesList[0].id);
            }

            const productsSnapshot = await getDocs(query(collection(db, 'products'), orderBy('order')));
            const productsList = productsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ProductDefinition));
            setProducts(productsList);
        } catch (error) {
            console.error('Error loading data from Firestore', error);
            toast({
                title: 'Error',
                description: 'No se pudieron cargar los datos iniciales.',
                variant: 'destructive',
            });
        }
    };
    fetchInitialData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast]);

  const handleAddProduct = async () => {
    if (newProductName.trim() === '' || !newProductCategoryId) {
      toast({
        title: 'Error',
        description: 'El nombre y la categoría del producto son obligatorios.',
        variant: 'destructive',
      });
      return;
    }

    try {
        const newOrder = products.length > 0 ? Math.max(...products.map(p => p.order)) + 1 : 0;
        const newProductData = {
            productName: newProductName.trim(),
            order: newOrder,
            categoryId: newProductCategoryId,
            color: '#cccccc' // Default color
        };
        const docRef = await addDoc(collection(db, 'products'), newProductData);

        const newProduct: ProductDefinition = {
            id: docRef.id,
            ...newProductData
        };

        setProducts(prevProducts => [...prevProducts, newProduct].sort((a,b) => a.order - b.order));
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
  
  const handleAddCategory = async () => {
    if (newCategoryName.trim() === '') return;
    try {
      const docRef = await addDoc(collection(db, 'categories'), { name: newCategoryName.trim() });
      const newCategory: CategoryDefinition = { id: docRef.id, name: newCategoryName.trim() };
      setCategories(prev => [...prev, newCategory].sort((a,b) => a.name.localeCompare(b.name)));
      setNewCategoryName('');
      toast({ title: 'Categoría Añadida' });
    } catch (error) {
      toast({ title: 'Error al añadir categoría', variant: 'destructive' });
    }
  };

  const handleDeleteCategory = async (categoryId: string) => {
    const isCategoryInUse = products.some(p => p.categoryId === categoryId);
    if (isCategoryInUse) {
        toast({
            title: 'Error',
            description: 'No se puede eliminar una categoría que está en uso por un producto.',
            variant: 'destructive',
        });
        return;
    }

    try {
        await deleteDoc(doc(db, 'categories', categoryId));
        setCategories(prev => prev.filter(c => c.id !== categoryId));
        if (newProductCategoryId === categoryId) {
            setNewProductCategoryId(categories.length > 1 ? categories.find(c => c.id !== categoryId)!.id : '');
        }
        toast({ title: 'Categoría Eliminada' });
    } catch (error) {
        toast({ title: 'Error al eliminar categoría', variant: 'destructive' });
    }
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (active.id !== over?.id) {
      setProducts((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over!.id);
        const newItems = arrayMove(items, oldIndex, newIndex);
        
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
              categoryId: updatedProduct.categoryId,
              color: updatedProduct.color,
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

  const getCategoryName = (categoryId: string) => {
    return categories.find(c => c.id === categoryId)?.name || 'Sin categoría';
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
        <div className="grid md:grid-cols-2 gap-6">
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Gestionar Productos y Categorías</CardTitle>
                <CardDescription>Añade, edita y organiza tus productos y categorías en un solo lugar.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                    <Label className="text-lg font-semibold">Añadir Nuevo Producto</Label>
                    <div className="flex items-end gap-2 mt-2">
                      <div className="flex-grow">
                        <Label htmlFor="new-product">Nombre del Nuevo Producto</Label>
                        <Input 
                          id="new-product"
                          value={newProductName}
                          onChange={(e) => setNewProductName(e.target.value)}
                          placeholder="Ej: Azúcar 1kg San Juan"
                        />
                      </div>
                      <div className="w-48">
                        <Label htmlFor="new-product-category">Categoría</Label>
                        <Select value={newProductCategoryId} onValueChange={setNewProductCategoryId} disabled={categories.length === 0}>
                            <SelectTrigger id="new-product-category">
                                <SelectValue placeholder="Seleccionar" />
                            </SelectTrigger>
                            <SelectContent>
                                {categories.map(cat => (
                                    <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                      </div>
                       <Button onClick={handleAddProduct}>
                          <PlusCircle className="mr-2 h-4 w-4" />
                          Añadir Producto
                      </Button>
                    </div>
                </div>
                
                <Separator />

                <div>
                    <Label className="text-lg font-semibold">Gestionar Categorías</Label>
                    <div className="flex items-end gap-2 mt-2">
                        <div className="flex-grow">
                            <Label htmlFor="new-category">Nombre de la Nueva Categoría</Label>
                            <Input 
                                id="new-category"
                                value={newCategoryName}
                                onChange={(e) => setNewCategoryName(e.target.value)}
                                placeholder="Ej: Familiar"
                            />
                        </div>
                        <Button onClick={handleAddCategory}>
                            <PlusCircle className="mr-2 h-4 w-4" />
                            Añadir Categoría
                        </Button>
                    </div>
                    <div className="space-y-2 mt-4">
                        <Label>Categorías existentes</Label>
                        {categories.length > 0 ? (
                            <ul className="space-y-2 max-h-40 overflow-y-auto pr-2">
                                {categories.map(cat => (
                                    <li key={cat.id} className="border p-2 rounded-md flex justify-between items-center text-sm">
                                        {cat.name}
                                        <Button variant="ghost" size="icon" onClick={() => handleDeleteCategory(cat.id)}>
                                            <Trash2 className="h-4 w-4 text-destructive" />
                                        </Button>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-sm text-muted-foreground text-center py-2">No hay categorías. Añade una para empezar.</p>
                        )}
                    </div>
                </div>
              </CardContent>
            </Card>
        </div>
        
        <Card>
          <CardHeader>
            <CardTitle>Lista de Productos Actual</CardTitle>
            <CardDescription>Arrastra los productos para reordenarlos. Haz clic en el icono de editar para cambiar el nombre, categoría y color.</CardDescription>
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
                                <SortableItem key={product.id} product={product} categoryName={getCategoryName(product.categoryId)} onEdit={setEditingProduct} />
                            ))}
                        </ul>
                    </SortableContext>
                </DndContext>
             ) : (
                <p className="text-muted-foreground text-center py-4">No hay productos definidos. Comienza añadiendo una categoría y luego un producto.</p>
             )}
          </CardContent>
        </Card>
      </main>
      {editingProduct && (
          <EditProductDialog 
              product={editingProduct}
              categories={categories}
              onClose={() => setEditingProduct(null)}
              onSave={handleSaveProduct}
          />
      )}
    </div>
  );
}
