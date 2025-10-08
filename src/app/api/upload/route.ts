// src/app/api/upload/route.ts
import { NextResponse } from 'next/server';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebase';

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
    
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const snapshot = await uploadBytes(storageRef, buffer, {
      contentType: file.type,
    });

    const downloadURL = await getDownloadURL(snapshot.ref);
    
    return NextResponse.json({ downloadURL });

  } catch (error: any) {
    console.error('Error uploading file:', error);
    return NextResponse.json(
      { error: 'Failed to upload file', details: error.message || 'Unknown server error' },
      { status: 500 }
    );
  }
}
