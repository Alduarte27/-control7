
'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, doc, setDoc, deleteDoc, addDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent, CardFooter, CardDescription } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { PlusCircle, Trash2, ChevronLeft, Shield, QrCode, X, Share2, Download, History } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from '@/components/ui/dialog';
import { QRCodeSVG } from 'qrcode.react';
import { availableModules } from '@/lib/constants';

type Permissions = {
    [key: string]: boolean;
};

type AccessProfile = {
    id: string;
    name: string;
    permissions: Permissions;
};

const AccessClient = () => {
    const [profiles, setProfiles] = useState<AccessProfile[]>([]);
    const [newProfileName, setNewProfileName] = useState('');
    const { toast } = useToast();

    useEffect(() => {
        const unsubscribe = onSnapshot(collection(db, 'accessProfiles'), (snapshot) => {
            const profilesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AccessProfile));
            setProfiles(profilesData);
        });
        return () => unsubscribe();
    }, []);

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
        const profile = profiles.find(p => p.id === profileId);
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
        const url = `${window.location.origin}/?profileId=${profileId}`;
        const message = encodeURIComponent(`Hola, aquí tienes tu enlace de acceso para Control 7 con el perfil "${profileName}":\n\n${url}`);
        window.open(`https://api.whatsapp.com/send?text=${message}`, '_blank');
    };


    return (
        <div className="bg-background min-h-screen text-foreground">
            <header className="flex items-center justify-between p-4 border-b bg-card sticky top-0 z-10">
                <div className="flex items-center gap-3">
                    <Shield className="h-8 w-8 text-primary" />
                    <h1 className="text-2xl font-bold text-foreground">Gestión de Acceso</h1>
                </div>
                <Link href="/">
                    <Button variant="outline">
                        <ChevronLeft className="mr-2 h-4 w-4" />
                        Volver
                    </Button>
                </Link>
            </header>
            <main className="p-4 md:p-8 space-y-6">
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
                    {profiles.map(profile => (
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
                                                    value={`${window.location.origin}/?profileId=${profile.id}`}
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
            </main>
        </div>
    );
};

export default AccessClient;
