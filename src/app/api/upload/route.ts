// src/app/api/upload/route.ts
import { NextResponse } from 'next/server';
import admin from '@/lib/firebase-admin';

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const path = formData.get('path') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided', details: 'The file is missing from the request.' }, { status: 400 });
    }
    if (!path) {
      return NextResponse.json({ error: 'No path provided', details: 'The destination path is missing.' }, { status: 400 });
    }

    const bucket = admin.storage().bucket();
    const imagePath = `${path}/${Date.now()}_${file.name}`;
    
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const fileUpload = bucket.file(imagePath);
    await fileUpload.save(buffer, {
      metadata: {
        contentType: file.type,
      },
    });

    // Make the file public to get a predictable URL.
    // This is a common pattern for public assets like profile pictures or product images.
    await fileUpload.makePublic();

    // Construct the public URL manually.
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${imagePath}`;

    return NextResponse.json({ downloadURL: publicUrl });

  } catch (error: any) {
    console.error('Error uploading file to Firebase Admin:', error);
    return NextResponse.json(
      { error: 'Failed to upload file using Admin SDK', details: error.message || 'Unknown server error' },
      { status: 500 }
    );
  }
}
