
'use client';

import React from 'react';
import Link from 'next/link';
import { Factory, ChevronLeft, PlusCircle, Edit, RefreshCw, Info, X, Shield, Trash2, QrCode, Share2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import type { ProductDefinition, CategoryDefinition, ProductData } from '@/lib/types';
import { db } from '@/lib/firebase';
import { collection, getDocs, writeBatch, doc, query, orderBy, updateDoc, onSnapshot, addDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose, DialogTrigger } from '@/components/ui/dialog';
import { Separator } from './ui/separator';
import { Switch } from './ui/switch';
import { cn } from '@/lib/utils';
import { addCategoryAction, addProductAction, deleteCategoryAction, toggleCategoryIsPlannedAction, toggleProductStatusAction, updateProductAction } from '@/actions/admin-actions';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Checkbox } from './ui/checkbox';
import { QRCodeSVG } from 'qrcode.react';

// --- Access Management Types ---
const availableModules = [
    { id: 'ia', label: 'Operaciones (IA)' },
    { id: 'dashboard', label: 'Dashboard' },
    { id: 'stops', label: 'Bitácora' },
    { id: 'log-history', label: 'Historial Bitácoras' },
    { id: 'materials', label: 'Material Empaque' },
    { id: 'melaza', label: 'Material Melaza' },
    { id: 'history', label: 'Historial Planes' },
    { id: 'admin', label: 'Admin' },
    { id: 'export', label: 'Exportar / Reportes' }
];

type Permissions = {
    [key: string]: boolean;
};

type AccessProfile = {
    id: string;
    name: string;
    permissions: Permissions;
};

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
    const [sackWeight, setSackWeight] = React.useState(product.sackWeight || 50);
    const [presentationWeight, setPresentationWeight] = React.useState(product.presentationWeight || 1);

    const handleSave = () => {
        onSave({
            ...product,
            productName,
            categoryId,
            color,
            sackWeight: Number(sackWeight),
            presentationWeight: Number(presentationWeight),
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
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="edit-product-weight">Peso por Fardo (kg)</Label>
                            <Input
                                id="edit-product-weight"
                                type="number"
                                value={sackWeight}
                                onChange={(e) => setSackWeight(Number(e.target.value))}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="edit-product-pres-weight">Peso por Funda (kg)</Label>
                            <Input
                                id="edit-product-pres-weight"
                                type="number"
                                value={presentationWeight}
                                onChange={(e) => setPresentationWeight(Number(e.target.value))}
                                step="0.1"
                            />
                        </div>
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

function ProductListItem({ product, categoryName, onEdit, onToggleStatus }: { product: ProductDefinition, categoryName: string, onEdit: (product: ProductDefinition) => void, onToggleStatus: (product: ProductDefinition) => void }) {
  
    return (
      <li className={cn("border p-3 rounded-md bg-muted/50 flex items-center justify-between transition-colors", !product.isActive && "bg-slate-100 text-muted-foreground")}>
        <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="h-4 w-4 rounded-full" style={{ backgroundColor: product.color || '#ccc' }}></span>
              {product.productName}
              <span className="text-xs text-muted-foreground">({product.presentationWeight || 1}kg / {product.sackWeight || 50}kg)</span>
            </div>
        </div>
        <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{categoryName}</span>
            <span className="text-xs px-2 py-0.5 rounded-full">{product.isActive ? 'Activo' : 'Archivado'}</span>
            <Switch checked={product.isActive} onCheckedChange={() => onToggleStatus(product)} />
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
  const [newCategoryIsPlanned, setNewCategoryIsPlanned] = React.useState(true);
  const [editingProduct, setEditingProduct] = React.useState<ProductDefinition | null>(null);
  const [isSyncing, setIsSyncing] = React.useState(false);
  const [showInfoOnStartup, setShowInfoOnStartup] = React.useState(true);
  const { toast } = useToast();

  // --- States for Access Management ---
  const [accessProfiles, setAccessProfiles] = React.useState<AccessProfile[]>([]);
  const [newProfileName, setNewProfileName] = React.useState('');

  React.useEffect(() => {
    const fetchInitialData = async () => {
        try {
            const [categoriesSnapshot, productsSnapshot] = await Promise.all([
                getDocs(query(collection(db, 'categories'), orderBy('name'))),
                getDocs(query(collection(db, 'products'), orderBy('order'))),
            ]);

            const categoriesList = categoriesSnapshot.docs.map(doc => ({ id: doc.id, isPlanned: true, ...doc.data() } as CategoryDefinition));
            setCategories(categoriesList);

            if (categoriesList.length > 0 && !newProductCategoryId) {
              setNewProductCategoryId(categoriesList[0].id);
            }

            const productsList = productsSnapshot.docs.map(doc => ({ id: doc.id, isActive: true, sackWeight: 50, presentationWeight: 1, ...doc.data() } as ProductDefinition));
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

    const loadStartupPreference = () => {
        const pref = localStorage.getItem('showInfoDialogOnStartup');
        setShowInfoOnStartup(pref === null || pref === 'true');
    };

    // Fetch access profiles
    const unsubscribeAccess = onSnapshot(collection(db, 'accessProfiles'), (snapshot) => {
        const profilesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AccessProfile));
        setAccessProfiles(profilesData);
    });
    
    fetchInitialData();
    loadStartupPreference();
  
    return () => {
        unsubscribeAccess();
    }
  }, [toast]);

  const handleToggleShowInfoOnStartup = (checked: boolean) => {
    setShowInfoOnStartup(checked);
    localStorage.setItem('showInfoDialogOnStartup', String(checked));
    toast({
        title: 'Preferencia Guardada',
        description: checked 
            ? 'El diálogo de bienvenida se mostrará al iniciar.'
            : 'El diálogo de bienvenida no se mostrará al iniciar.',
    });
  };

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
            color: '#cccccc', // Default color
            isActive: true,
            sackWeight: 50, // Default weight
            presentationWeight: 1, // Default presentation weight
        };
        const newProduct = await addProductAction(newProductData);

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
      const newCategoryData = { 
          name: newCategoryName.trim(),
          isPlanned: newCategoryIsPlanned 
      };
      const newCategory = await addCategoryAction(newCategoryData);
      setCategories(prev => [...prev, newCategory].sort((a,b) => a.name.localeCompare(b.name)));
      setNewCategoryName('');
      setNewCategoryIsPlanned(true);
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
        await deleteCategoryAction(categoryId);
        setCategories(prev => prev.filter(c => c.id !== categoryId));
        if (newProductCategoryId === categoryId) {
            setNewProductCategoryId(categories.length > 1 ? categories.find(c => c.id !== categoryId)!.id : '');
        }
        toast({ title: 'Categoría Eliminada' });
    } catch (error) {
        toast({ title: 'Error al eliminar categoría', variant: 'destructive' });
    }
  }

  const handleToggleCategoryIsPlanned = async (category: CategoryDefinition) => {
      try {
          await toggleCategoryIsPlannedAction(category);
          const updatedCategory = { ...category, isPlanned: !category.isPlanned };
          setCategories(prev => prev.map(c => c.id === category.id ? updatedCategory : c));
          toast({
              title: `Categoría "${category.name}" actualizada`,
              description: `Ahora es ${updatedCategory.isPlanned ? 'Planificada' : 'No Planificada'}.`,
          });
      } catch (error) {
          toast({ title: 'Error al actualizar categoría', variant: 'destructive' });
      }
  };

  const handleSaveProduct = async (updatedProduct: ProductDefinition) => {
      try {
          await updateProductAction(updatedProduct);
          
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

  const handleToggleProductStatus = async (product: ProductDefinition) => {
      try {
          await toggleProductStatusAction(product);
          const updatedProduct = { ...product, isActive: !product.isActive };
          setProducts(prev => prev.map(p => p.id === product.id ? updatedProduct : p));
          toast({
              title: `Producto "${product.productName}" actualizado`,
              description: `Ahora está ${updatedProduct.isActive ? 'Activo' : 'Archivado'}.`,
          });
      } catch (error) {
          toast({ title: 'Error al actualizar el estado del producto', variant: 'destructive' });
      }
  };
  
  const getCategoryName = (categoryId: string) => {
    return categories.find(c => c.id === categoryId)?.name || 'Sin categoría';
  };

  const handleSyncHistoricalData = async () => {
    setIsSyncing(true);
    toast({
        title: 'Iniciando Sincronización',
        description: 'Actualizando los datos de productos en todos los planes guardados. Esto puede tardar unos momentos...',
    });

    try {
        const productsSnapshot = await getDocs(query(collection(db, 'products'), orderBy('order')));
        const latestProducts = productsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ProductDefinition));
        const productsMap = new Map(latestProducts.map(p => [p.id, p]));

        const categoriesSnapshot = await getDocs(query(collection(db, 'categories'), orderBy('name')));
        const latestCategories = categoriesSnapshot.docs.map(doc => ({ id: doc.id, isPlanned: true, ...doc.data() } as CategoryDefinition));
        const categoryMap = new Map(latestCategories.map(c => [c.id, c]));

        const plansSnapshot = await getDocs(collection(db, 'productionPlans'));
        
        const batch = writeBatch(db);
        let updatedPlans = 0;

        plansSnapshot.forEach(planDoc => {
            const planData = planDoc.data();
            let needsUpdate = false;
            
            const updatedProductsList = planData.products.map((product: ProductData) => {
                const latestProduct = productsMap.get(product.id);
                if (latestProduct) {
                    const latestCategory = categoryMap.get(latestProduct.categoryId);
                    const latestCategoryName = latestCategory?.name || 'Sin Categoría';
                    const latestCategoryIsPlanned = latestCategory?.isPlanned ?? true;
                    
                    if (product.productName !== latestProduct.productName || 
                        product.categoryId !== latestProduct.categoryId || 
                        product.color !== latestProduct.color ||
                        product.categoryName !== latestCategoryName ||
                        product.categoryIsPlanned !== latestCategoryIsPlanned ||
                        product.sackWeight !== (latestProduct.sackWeight || 50) ||
                        product.presentationWeight !== (latestProduct.presentationWeight || 1)
                        ) {
                        needsUpdate = true;
                        return {
                            ...product,
                            productName: latestProduct.productName,
                            categoryId: latestProduct.categoryId,
                            color: latestProduct.color,
                            categoryName: latestCategoryName,
                            categoryIsPlanned: latestCategoryIsPlanned,
                            sackWeight: latestProduct.sackWeight || 50,
                            presentationWeight: latestProduct.presentationWeight || 1,
                        };
                    }
                }
                return product;
            });

            if (needsUpdate) {
                const planRef = doc(db, 'productionPlans', planDoc.id);
                batch.update(planRef, { products: updatedProductsList });
                updatedPlans++;
            }
        });

        if (updatedPlans > 0) {
            await batch.commit();
            toast({
                title: 'Sincronización Completada',
                description: `Se han actualizado ${updatedPlans} planes con la información más reciente de los productos.`,
            });
        } else {
            toast({
                title: 'Todo al día',
                description: 'No se encontraron planes que necesitaran ser actualizados.',
            });
        }

    } catch (error) {
        console.error("Error syncing historical data:", error);
        toast({
            title: 'Error de Sincronización',
            description: 'No se pudo completar la actualización de los datos históricos.',
            variant: 'destructive',
        });
    } finally {
        setIsSyncing(false);
    }
  };

  // --- Functions for Access Management ---
  const handleCreateProfile = async () => {
    if (!newProfileName.trim()) {
        toast({ title: 'Error', description: 'El nombre del perfil no puede estar vacío.', variant: 'destructive' });
        return;
    }
    try {
        const newProfile: Omit<AccessProfile, 'id'> = {
            name: newProfileName.trim(),
            permissions: {}
        };
        await addDoc(collection(db, 'accessProfiles'), newProfile);
        setNewProfileName('');
        toast({ title: 'Perfil Creado', description: `Se ha creado el perfil "${newProfileName}".` });
    } catch (error) {
        console.error("Error creating profile: ", error);
        toast({ title: 'Error', description: 'No se pudo crear el perfil.', variant: 'destructive' });
    }
  };

  const handlePermissionChange = async (profileId: string, moduleId: string, checked: boolean) => {
    const profile = accessProfiles.find(p => p.id === profileId);
    if (!profile) return;
    const updatedPermissions = { ...profile.permissions, [moduleId]: checked };
    try {
        await setDoc(doc(db, 'accessProfiles', profileId), { permissions: updatedPermissions }, { merge: true });
        toast({ title: 'Permiso Actualizado', description: `Se ha actualizado el permiso para "${profile.name}".` });
    } catch (error) {
        console.error("Error updating permission: ", error);
        toast({ title: 'Error', description: 'No se pudo actualizar el permiso.', variant: 'destructive' });
    }
  };
    
  const handleDeleteProfile = async (profileId: string, profileName: string) => {
      if (!confirm(`¿Estás seguro de que quieres eliminar el perfil "${profileName}"? Esta acción no se puede deshacer.`)) {
          return;
      }
      try {
          await deleteDoc(doc(db, 'accessProfiles', profileId));
          toast({ title: 'Perfil Eliminado', description: `Se ha eliminado el perfil "${profileName}".` });
      } catch (error) {
          console.error("Error deleting profile: ", error);
          toast({ title: 'Error', description: 'No se pudo eliminar el perfil.', variant: 'destructive' });
      }
  };

  const handleShare = (profileName: string, profileId: string) => {
      if (typeof window !== "undefined") {
        const url = `${window.location.origin}/?profileId=${profileId}`;
        const message = encodeURIComponent(`Hola, aquí tienes tu enlace de acceso para Control 7 con el perfil "${profileName}":\n\n${url}`);
        window.open(`https://api.whatsapp.com/send?text=${message}`, '_blank');
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
      <main className="p-4 md:p-8">
        <Tabs defaultValue="catalogs">
            <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="catalogs">Catálogos</TabsTrigger>
                <TabsTrigger value="access">Gestión de Acceso</TabsTrigger>
            </TabsList>
            <TabsContent value="catalogs" className="space-y-6 mt-6">
                 <Card>
                    <CardHeader>
                        <CardTitle>Gestionar Productos y Categorías</CardTitle>
                        <CardDescription>Añade, edita y organiza tus productos y categorías.</CardDescription>
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
                                Añadir
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
                                <div className="flex flex-col items-start gap-1.5">
                                    <Label htmlFor="is-planned-switch">Planificada</Label>
                                    <Switch 
                                        id="is-planned-switch"
                                        checked={newCategoryIsPlanned}
                                        onCheckedChange={setNewCategoryIsPlanned}
                                    />
                                </div>
                                <Button onClick={handleAddCategory}>
                                    <PlusCircle className="mr-2 h-4 w-4" />
                                    Añadir
                                </Button>
                            </div>
                            <div className="space-y-2 mt-4">
                                <Label>Categorías existentes</Label>
                                {categories.length > 0 ? (
                                    <ul className="space-y-2 max-h-40 overflow-y-auto pr-2">
                                        {categories.map(cat => (
                                            <li key={cat.id} className="border p-2 rounded-md flex justify-between items-center text-sm">
                                                <div className="flex items-center gap-2">
                                                    <span>{cat.name}</span>
                                                    <span className={`text-xs px-2 py-0.5 rounded-full ${cat.isPlanned ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                                                        {cat.isPlanned ? 'Planificada' : 'No Planificada'}
                                                    </span>
                                                </div>
                                                <div className='flex items-center gap-2'>
                                                    <Switch 
                                                        checked={cat.isPlanned}
                                                        onCheckedChange={() => handleToggleCategoryIsPlanned(cat)}
                                                    />
                                                    <Button variant="ghost" size="icon" onClick={() => handleDeleteCategory(cat.id)} className="text-destructive hover:text-destructive">
                                                        <X className="h-4 w-4" />
                                                    </Button>
                                                </div>
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
                
                <Card>
                    <CardHeader>
                        <CardTitle>Lista de Productos Actual</CardTitle>
                        <CardDescription>Usa el interruptor para archivar o activar un producto.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {products.length > 0 ? (
                            <ul className="space-y-2">
                                {products.map((product) => (
                                    <ProductListItem 
                                        key={product.id} 
                                        product={product} 
                                        categoryName={getCategoryName(product.categoryId)} 
                                        onEdit={setEditingProduct}
                                        onToggleStatus={handleToggleProductStatus}
                                    />
                                ))}
                            </ul>
                        ) : (
                            <p className="text-muted-foreground text-center py-4">No hay productos definidos. Comienza añadiendo una categoría y luego un producto.</p>
                        )}
                    </CardContent>
                </Card>
                
                <div className="grid md:grid-cols-2 gap-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Mantenimiento de Datos</CardTitle>
                            <CardDescription>
                                Si cambias un producto, esta información no se actualiza automáticamente en los planes antiguos. 
                                Usa este botón para sincronizar todos los planes históricos con los datos más recientes de tus productos y categorías.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Button onClick={handleSyncHistoricalData} disabled={isSyncing}>
                                <RefreshCw className={`mr-2 h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
                                {isSyncing ? 'Sincronizando...' : 'Sincronizar Datos en Historial'}
                            </Button>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Info className="h-5 w-5" />
                                Preferencias de Interfaz
                            </CardTitle>
                            <CardDescription>
                                Gestiona cómo se comporta la aplicación.
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center space-x-2">
                                <Switch
                                    id="info-dialog-switch"
                                    checked={showInfoOnStartup}
                                    onCheckedChange={handleToggleShowInfoOnStartup}
                                />
                                <Label htmlFor="info-dialog-switch">Mostrar diálogo de bienvenida al iniciar</Label>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </TabsContent>
            <TabsContent value="access" className="space-y-6 mt-6">
                 <Card>
                    <CardHeader>
                        <CardTitle>Crear Nuevo Perfil de Acceso</CardTitle>
                        <CardDescription>Define un nuevo rol, como "Operador" o "Supervisor", para asignarle permisos específicos.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-end gap-2">
                            <div className="flex-grow space-y-1.5">
                                <Label htmlFor="new-profile-name">Nombre del Perfil</Label>
                                <Input
                                    id="new-profile-name"
                                    value={newProfileName}
                                    onChange={(e) => setNewProfileName(e.target.value)}
                                    placeholder="Ej: Operador de Planta"
                                />
                            </div>
                            <Button onClick={handleCreateProfile}>
                                <PlusCircle className="mr-2 h-4 w-4" />
                                Crear Perfil
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {accessProfiles.map(profile => (
                        <Card key={profile.id} className="flex flex-col">
                            <CardHeader className="flex flex-row items-center justify-between">
                                <CardTitle>{profile.name}</CardTitle>
                                <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => handleDeleteProfile(profile.id, profile.name)}>
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </CardHeader>
                            <CardContent className="flex-grow">
                                <div className="space-y-3">
                                    <h4 className="text-sm font-medium text-muted-foreground">Permisos de Módulos</h4>
                                    {availableModules.map(module => (
                                        <div key={module.id} className="flex items-center space-x-2">
                                            <Checkbox
                                                id={`${profile.id}-${module.id}`}
                                                checked={profile.permissions?.[module.id] || false}
                                                onCheckedChange={(checked) => handlePermissionChange(profile.id, module.id, !!checked)}
                                            />
                                            <Label htmlFor={`${profile.id}-${module.id}`} className="text-sm font-normal">
                                                {module.label}
                                            </Label>
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                            <CardFooter>
                                <Dialog>
                                    <DialogTrigger asChild>
                                        <Button className="w-full">
                                            <QrCode className="mr-2 h-4 w-4" />
                                            Generar QR de Acceso
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent className="sm:max-w-md">
                                        <DialogHeader>
                                            <DialogTitle>Código QR para {profile.name}</DialogTitle>
                                        </DialogHeader>
                                        <div className="flex items-center justify-center p-4">
                                            <div className="bg-white p-4 rounded-lg">
                                                <QRCodeSVG
                                                    value={`${typeof window !== "undefined" ? window.location.origin : ''}/?profileId=${profile.id}`}
                                                    size={256}
                                                    includeMargin={true}
                                                />
                                            </div>
                                        </div>
                                        <div className="flex flex-col sm:flex-row gap-2 mt-2">
                                            <Button
                                                variant="outline"
                                                className="w-full flex items-center gap-2"
                                                onClick={() => handleShare(profile.name, profile.id)}
                                            >
                                                <Share2 className="h-4 w-4" />
                                                Compartir por WhatsApp
                                            </Button>
                                            <DialogClose asChild>
                                                <Button type="button" variant="secondary" className="w-full">
                                                    Cerrar
                                                </Button>
                                            </DialogClose>
                                        </div>
                                    </DialogContent>
                                </Dialog>
                            </CardFooter>
                        </Card>
                    ))}
                </div>
            </TabsContent>
        </Tabs>
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
