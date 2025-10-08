// src/app/api/upload/route.ts
import { NextResponse } from 'next/server';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebase'; // Usamos la instancia de storage ya configurada

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const path = formData.get('path') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }
    if (!path) {
        return NextResponse.json({ error: 'No path provided' }, { status: 400 });
    }

    const imagePath = `${path}/${Date.now()}_${file.name}`;
    const storageRef = ref(storage, imagePath);
    
    // Subir el archivo
    const snapshot = await uploadBytes(storageRef, file, {
      contentType: file.type,
    });

    // Obtener la URL de descarga
    const downloadURL = await getDownloadURL(snapshot.ref);
    
    return NextResponse.json({ downloadURL });

  } catch (error: any) {
    console.error('Error uploading file:', error);
    // Devuelve un mensaje de error más detallado
    return NextResponse.json(
      { error: 'Failed to upload file', details: error.message },
      { status: 500 }
    );
  }
}
