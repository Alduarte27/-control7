
'use client';

import React from 'react';
import Link from 'next/link';
import { Factory, ChevronLeft, PlusCircle, Edit, RefreshCw, Info, X, Shield, Trash2, QrCode, Share2, Package } from 'lucide-react';
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
import { availableModules } from '@/lib/constants';

// --- Access Management Types ---
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
    const selectedCategory = categories.find(c => c.id === categoryId);
    const categoryNameLowerCase = selectedCategory?.name.toLowerCase() || '';
    const isFamiliar = categoryNameLowerCase.includes('familiar');
    const isGranel = categoryNameLowerCase.includes('granel');
    const isNoConformes = categoryNameLowerCase.includes('no conforme') || categoryNameLowerCase.includes('reproceso');

    const [sackWeight, setSackWeight] = React.useState(product.sackWeight || 50);
    const [bundleWeight, setBundleWeight] = React.useState<number | "">(product.bundleWeight || "");
    const [presentationWeight, setPresentationWeight] = React.useState(product.presentationWeight || 1);
    const [unitsPerPallet, setUnitsPerPallet] = React.useState<number | "">(product.unitsPerPallet || "");
    
    // Explicit primary packaging selector
    const [primaryPackaging, setPrimaryPackaging] = React.useState<'saco'|'fardo'|'granel'>(
        product.primaryPackaging || (product.bundleWeight ? 'fardo' : 'saco')
    );

    // Auto-update primary packaging if category changes
    React.useEffect(() => {
        if (isGranel) setPrimaryPackaging('granel');
        else if (isNoConformes) setPrimaryPackaging('saco');
        else if (primaryPackaging === 'granel') setPrimaryPackaging('saco'); // Reset if changed from granel to familiar
    }, [categoryId, isGranel, isNoConformes]);

    const handleSave = () => {
        onSave({
            ...product,
            productName,
            categoryId,
            color,
            sackWeight: Number(sackWeight),
            bundleWeight: (isFamiliar && primaryPackaging === 'fardo') ? (bundleWeight ? Number(bundleWeight) : null) : null,
            presentationWeight: (isGranel || isNoConformes) ? null : Number(presentationWeight),
            primaryPackaging: primaryPackaging,
            unitsPerPallet: unitsPerPallet ? Number(unitsPerPallet) : null,
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

                    {isFamiliar && (
                        <>
                            <div className="space-y-2">
                                <Label>Empaque Final (Línea de Envasadora)</Label>
                                <Select value={primaryPackaging} onValueChange={(v: 'saco'|'fardo') => setPrimaryPackaging(v)}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Seleccionar empaque final" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="saco">Empacado en Sacos</SelectItem>
                                        <SelectItem value="fardo">Empacado en Fardos</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            
                            <div className="grid grid-cols-3 gap-4">
                                <div className={primaryPackaging === 'fardo' ? "opacity-50" : ""}>
                                    <Label htmlFor="edit-product-sack-weight">Peso por Saco (kg)</Label>
                                    <Input
                                        id="edit-product-sack-weight"
                                        type="number"
                                        value={sackWeight}
                                        onChange={(e) => setSackWeight(Number(e.target.value))}
                                    />
                                </div>
                                <div className={primaryPackaging === 'saco' ? "opacity-50" : ""}>
                                    <Label htmlFor="edit-product-weight">Peso por Fardo (kg)</Label>
                                    <Input
                                        id="edit-product-weight"
                                        type="number"
                                        placeholder="Ej: 12"
                                        value={bundleWeight}
                                        onChange={(e) => setBundleWeight(e.target.value ? Number(e.target.value) : "")}
                                    />
                                </div>
                                <div>
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
                        </>
                    )}

                    {(isGranel || isNoConformes) && (
                        <div className="space-y-2">
                            <Label htmlFor="edit-product-sack-weight">Peso por Saco (kg)</Label>
                            <Input
                                id="edit-product-sack-weight"
                                type="number"
                                value={sackWeight}
                                onChange={(e) => setSackWeight(Number(e.target.value))}
                            />
                            <p className="text-xs text-muted-foreground">
                                {isGranel ? "Este producto se maneja directo al saco." : "Producto de reproceso/no conforme."}
                            </p>
                        </div>
                    )}
                    
                    <div className="space-y-2 border-t pt-4">
                        <Label htmlFor="edit-product-units-pallet">Unidades (Sacos/Fardos) por Pallet</Label>
                        <Input
                            id="edit-product-units-pallet"
                            type="number"
                            placeholder="Ej: 35, 72 o 165"
                            value={unitsPerPallet}
                            onChange={(e) => setUnitsPerPallet(e.target.value ? Number(e.target.value) : "")}
                        />
                        <p className="text-xs text-muted-foreground mt-1">Configura la cantidad de sacos o fardos (según el empaque final) que conforman un pallet completo.</p>
                    </div>

                     <div className="space-y-2 border-t pt-4">
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
    const isGranel = product.primaryPackaging === 'granel' || (product.sackWeight === product.presentationWeight);
    const packagingLabel = product.primaryPackaging 
      ? (product.primaryPackaging === 'granel' ? `${product.sackWeight}kg -Saco` : (product.primaryPackaging === 'fardo' ? `${product.bundleWeight}kg Fardo` : `${product.sackWeight}kg Saco`)) 
      : (product.bundleWeight ? `${product.bundleWeight}kg Fardo` : `${product.sackWeight || 50}kg Saco`);

    return (
        <li className={cn("group flex flex-col md:flex-row items-start md:items-center justify-between p-3.5 rounded-xl border bg-card hover:border-primary/50 hover:shadow-sm transition-all gap-4", !product.isActive && "bg-muted/30 opacity-70")}>
            <div className="flex items-center gap-3.5 flex-1 overflow-hidden">
                 <div className="h-9 w-9 rounded-full border shadow-sm flex-shrink-0" style={{ backgroundColor: product.color || '#ccc' }} />
                 <div className="min-w-0 flex flex-col justify-center">
                     <p className="font-semibold text-sm truncate text-foreground leading-tight tracking-tight">{product.productName}</p>
                     <p className="text-xs text-muted-foreground truncate font-medium mt-0.5">
                         {categoryName} <span className="opacity-50 mx-1">•</span> {isGranel ? packagingLabel : `${product.presentationWeight || 1}kg / ${packagingLabel}`}
                         {product.unitsPerPallet ? <span className="ml-1 opacity-75">({product.unitsPerPallet}/Pallet)</span> : null}
                     </p>
                 </div>
            </div>
            
            <div className="flex items-center gap-3 shrink-0">
                <div className="flex items-center gap-2 mr-2">
                    <span className={cn("text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full border", product.isActive ? "bg-green-100/50 text-green-700 border-green-200" : "bg-slate-100 text-slate-500 border-slate-200")}>
                        {product.isActive ? 'Activo' : 'Archivado'}
                    </span>
                    <Switch checked={product.isActive} onCheckedChange={() => onToggleStatus(product)} className="scale-75 origin-right" />
                </div>
                <div className="w-px h-6 bg-border mx-1 hidden md:block"></div>
                <Button variant="outline" size="sm" className="h-8 shadow-none text-xs px-3" onClick={() => onEdit(product)}>
                    <Edit className="h-3.5 w-3.5 mr-1.5" />
                    Editar
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
            bundleWeight: undefined,
            presentationWeight: 1, // Default presentation weight
            primaryPackaging: undefined,
            unitsPerPallet: undefined,
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
                        product.bundleWeight !== latestProduct.bundleWeight ||
                        product.presentationWeight !== latestProduct.presentationWeight ||
                        product.primaryPackaging !== latestProduct.primaryPackaging ||
                        product.unitsPerPallet !== latestProduct.unitsPerPallet
                        ) {
                        needsUpdate = true;
                        const newProd = {
                            ...product,
                            productName: latestProduct.productName,
                            categoryId: latestProduct.categoryId,
                            color: latestProduct.color ?? null,
                            categoryName: latestCategoryName,
                            categoryIsPlanned: latestCategoryIsPlanned,
                            sackWeight: latestProduct.sackWeight || 50,
                            bundleWeight: latestProduct.bundleWeight ?? null,
                            presentationWeight: latestProduct.presentationWeight ?? null,
                            primaryPackaging: latestProduct.primaryPackaging ?? null,
                            unitsPerPallet: latestProduct.unitsPerPallet ?? null,
                        };
                        return JSON.parse(JSON.stringify(newProd));
                    }
                }
                return JSON.parse(JSON.stringify(product));
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
            <TabsContent value="catalogs" className="mt-6">
                <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
                    {/* LEFT COLUMN: Categories & Config */}
                    <div className="xl:col-span-4 space-y-6">
                        <Card className="shadow-sm">
                            <CardHeader className="pb-4">
                                <CardTitle className="text-lg">Gestionar Categorías</CardTitle>
                                <CardDescription>Administra las familias de productos.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    <div className="grid gap-3">
                                        <Label htmlFor="new-category" className="text-xs uppercase text-muted-foreground font-semibold tracking-wider">Nueva Categoría</Label>
                                        <Input 
                                            id="new-category"
                                            value={newCategoryName}
                                            onChange={(e) => setNewCategoryName(e.target.value)}
                                            placeholder="Ej: Familiar"
                                        />
                                        <div className="flex items-center justify-between bg-muted/30 p-2 rounded-md border">
                                            <Label htmlFor="is-planned-switch" className="text-sm cursor-pointer ml-1">Planificada (Se muestra en Plan)</Label>
                                            <Switch 
                                                id="is-planned-switch"
                                                checked={newCategoryIsPlanned}
                                                onCheckedChange={setNewCategoryIsPlanned}
                                            />
                                        </div>
                                        <Button onClick={handleAddCategory} className="w-full">
                                            <PlusCircle className="mr-2 h-4 w-4" />
                                            Añadir Categoría
                                        </Button>
                                    </div>

                                    <div className="pt-4 border-t">
                                        <Label className="text-xs uppercase text-muted-foreground font-semibold tracking-wider mb-3 block">Categorías Existentes</Label>
                                        {categories.length > 0 ? (
                                            <ul className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                                                {categories.map(cat => (
                                                    <li key={cat.id} className="group flex items-center justify-between p-2.5 rounded-lg border bg-card hover:border-primary/40 transition-colors">
                                                        <div className="flex items-center gap-3">
                                                            <div className={cn("w-2.5 h-2.5 rounded-full shadow-sm", cat.isPlanned ? "bg-green-500" : "bg-yellow-500")} />
                                                            <div className="flex flex-col">
                                                                <span className="text-sm font-semibold leading-none">{cat.name}</span>
                                                                <span className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wider">{cat.isPlanned ? 'Planificada' : 'No Planificada'}</span>
                                                            </div>
                                                        </div>
                                                        <div className='flex items-center gap-2 opacity-60 group-hover:opacity-100 transition-opacity'>
                                                            <Switch 
                                                                checked={cat.isPlanned}
                                                                onCheckedChange={() => handleToggleCategoryIsPlanned(cat)}
                                                                className="scale-[0.8]"
                                                            />
                                                            <Button variant="ghost" size="icon" onClick={() => handleDeleteCategory(cat.id)} className="text-destructive hover:bg-destructive/10 h-7 w-7">
                                                                <X className="h-3.5 w-3.5" />
                                                            </Button>
                                                        </div>
                                                    </li>
                                                ))}
                                            </ul>
                                        ) : (
                                            <p className="text-sm text-muted-foreground text-center py-6 bg-muted/20 rounded-md border border-dashed">No hay categorías. Añade una para empezar.</p>
                                        )}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="shadow-sm border-orange-100 dark:border-orange-900/30">
                            <CardHeader className="pb-3 bg-orange-50/50 dark:bg-orange-950/10 rounded-t-xl">
                                <CardTitle className="text-md flex items-center gap-2 text-orange-800 dark:text-orange-400">
                                    <RefreshCw className="h-4 w-4" />
                                    Mantenimiento
                                </CardTitle>
                                <CardDescription className="text-xs">Sincroniza propiedades de productos hacia los planes históricos.</CardDescription>
                            </CardHeader>
                            <CardContent className="pt-4 space-y-4">
                                <Button onClick={handleSyncHistoricalData} disabled={isSyncing} variant="outline" className="w-full justify-start text-left normal-case h-auto py-3">
                                    <RefreshCw className={`mr-3 h-4 w-4 shrink-0 text-muted-foreground ${isSyncing ? 'animate-spin' : ''}`} />
                                    <div className="flex flex-col items-start gap-1">
                                        <span className="font-semibold">{isSyncing ? 'Sincronizando...' : 'Sincronizar Historiales'}</span>
                                        <span className="text-xs font-normal text-muted-foreground">Aplica la configuración técnica actual en todas las semanas guardadas.</span>
                                    </div>
                                </Button>

                                <div className="flex items-center justify-between p-3 bg-muted/30 rounded-md border">
                                    <Label htmlFor="info-dialog-switch" className="text-sm cursor-pointer cursor-pointer">Mostrar Bienvenida App</Label>
                                    <Switch
                                        id="info-dialog-switch"
                                        checked={showInfoOnStartup}
                                        onCheckedChange={handleToggleShowInfoOnStartup}
                                    />
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* RIGHT COLUMN: Products */}
                    <div className="xl:col-span-8 space-y-6">
                        <Card className="shadow-sm">
                            <CardHeader className="pb-4">
                                <CardTitle>Catálogo de Productos</CardTitle>
                                <CardDescription>Gestiona el inventario de empaques técnicos y referencias activas.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="bg-muted/30 p-4 rounded-xl border border-dashed">
                                    <Label className="text-sm font-semibold mb-3 block">Nuevo Producto</Label>
                                    <div className="grid md:grid-cols-12 gap-3 items-end">
                                        <div className="md:col-span-6">
                                            <Label htmlFor="new-product" className="text-xs">Nombre Completo</Label>
                                            <Input 
                                                id="new-product"
                                                value={newProductName}
                                                onChange={(e) => setNewProductName(e.target.value)}
                                                placeholder="Ej: Azúcar 1kg Blanca"
                                                className="bg-background"
                                            />
                                        </div>
                                        <div className="md:col-span-4">
                                            <Label htmlFor="new-product-category" className="text-xs">Categoría Asignada</Label>
                                            <Select value={newProductCategoryId} onValueChange={setNewProductCategoryId} disabled={categories.length === 0}>
                                                <SelectTrigger id="new-product-category" className="bg-background">
                                                    <SelectValue placeholder="Seleccionar..." />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {categories.map(cat => (
                                                        <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="md:col-span-2">
                                            <Button onClick={handleAddProduct} className="w-full" disabled={!newProductName || !newProductCategoryId}>
                                                <PlusCircle className="h-4 w-4 md:mr-2" />
                                                <span className="hidden md:inline">Crear</span>
                                            </Button>
                                        </div>
                                    </div>
                                </div>

                                <Separator />

                                <div>
                                    <Label className="text-sm font-semibold mb-4 block flex justify-between items-center">
                                        <span>Productos Actuales</span>
                                        <span className="bg-primary/10 text-primary text-xs px-2 py-0.5 rounded-full">{products.length} registrados</span>
                                    </Label>
                                    {products.length > 0 ? (
                                        <ul className="space-y-2.5">
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
                                        <div className="py-12 flex flex-col items-center justify-center bg-muted/10 border border-dashed rounded-xl">
                                            <div className="bg-muted p-3 rounded-full mb-3">
                                                <Package className="h-6 w-6 text-muted-foreground" />
                                            </div>
                                            <p className="text-sm font-medium text-muted-foreground text-center">No hay productos definidos.</p>
                                            <p className="text-xs text-muted-foreground text-center">Asegúrate de tener al menos una categoría seleccionada y añade tu primer producto.</p>
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
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
