
'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import jsQR from 'jsqr';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Camera, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (code: string) => void;
}

// Type guard to check if BarcodeDetector is available
const isBarcodeDetectorSupported = (): boolean => 'BarcodeDetector' in window;

export default function ScannerModal({ isOpen, onClose, onScanSuccess }: ScannerModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null); // For jsQR fallback
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const { toast } = useToast();
  const animationFrameId = useRef<number>();

  const scanWithBarcodeDetector = useCallback(async (video: HTMLVideoElement, detector: any) => {
    try {
        const barcodes = await detector.detect(video);
        if (barcodes.length > 0) {
            onScanSuccess(barcodes[0].rawValue);
        } else {
            animationFrameId.current = requestAnimationFrame(() => scanWithBarcodeDetector(video, detector));
        }
    } catch (error) {
        console.error("Barcode Detector error:", error);
        // Fallback to jsQR if BarcodeDetector fails unexpectedly
        animationFrameId.current = requestAnimationFrame(scanWithJsQR);
    }
  }, [onScanSuccess]);

  const scanWithJsQR = useCallback(() => {
    if (videoRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      if (canvas && video) {
        const context = canvas.getContext('2d', { willReadFrequently: true });
        if (context) {
          canvas.height = video.videoHeight;
          canvas.width = video.videoWidth;
          context.drawImage(video, 0, 0, canvas.width, canvas.height);
          const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: "dontInvert",
          });

          if (code) {
            onScanSuccess(code.data);
          } else {
            animationFrameId.current = requestAnimationFrame(scanWithJsQR);
          }
        }
      }
    } else {
       animationFrameId.current = requestAnimationFrame(scanWithJsQR);
    }
  }, [onScanSuccess]);

  useEffect(() => {
    if (!isOpen) {
      if (videoRef.current?.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
        videoRef.current.srcObject = null;
      }
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
      return;
    }

    let barcodeDetector: any | null = null;

    const startScan = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        setHasCameraPermission(true);

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          
          if (isBarcodeDetectorSupported()) {
            // @ts-ignore
            barcodeDetector = new window.BarcodeDetector({ formats: ['qr_code', 'code_128', 'ean_13'] });
            animationFrameId.current = requestAnimationFrame(() => scanWithBarcodeDetector(videoRef.current!, barcodeDetector));
          } else {
            console.log("BarcodeDetector not supported, falling back to jsQR.");
            animationFrameId.current = requestAnimationFrame(scanWithJsQR);
          }
        }
      } catch (error) {
        console.error('Error accessing camera:', error);
        setHasCameraPermission(false);
        toast({
          variant: 'destructive',
          title: 'Acceso a la Cámara Denegado',
          description: 'Por favor, habilita los permisos de la cámara en tu navegador para usar el escáner.',
        });
      }
    };

    startScan();

    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
       if (videoRef.current?.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Camera /> Escanear Código de Material</DialogTitle>
          <DialogDescription>
            Apunta la cámara al código de barras o QR del material. La lectura será automática.
          </DialogDescription>
        </DialogHeader>
        <div className="relative aspect-video bg-black rounded-md overflow-hidden">
          <video ref={videoRef} className="w-full h-full" autoPlay playsInline muted />
          <canvas ref={canvasRef} style={{ display: 'none' }} />

          {/* Scanner Overlay */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-3/4 h-1/2 border-4 border-dashed border-white/50 rounded-lg" />
          </div>

          {hasCameraPermission === false && (
            <div className="absolute inset-0 bg-black/80 flex items-center justify-center">
                 <Alert variant="destructive" className="max-w-sm">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Acceso a Cámara Requerido</AlertTitle>
                    <AlertDescription>
                        Por favor, permite el acceso a la cámara para usar esta función.
                    </AlertDescription>
                </Alert>
            </div>
          )}
           {hasCameraPermission === null && (
            <div className="absolute inset-0 bg-black/80 flex items-center justify-center text-white">
                <p>Iniciando cámara...</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
