
'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import jsQR from 'jsqr';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Camera, AlertTriangle, Zap } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Button } from './ui/button';
import { cn } from '@/lib/utils';

interface ScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (code: string) => void;
}

const isBarcodeDetectorSupported = (): boolean => typeof window !== 'undefined' && 'BarcodeDetector' in window;

export default function ScannerModal({ isOpen, onClose, onScanSuccess }: ScannerModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const { toast } = useToast();
  const animationFrameId = useRef<number>();
  const streamRef = useRef<MediaStream | null>(null);

  const [isTorchOn, setIsTorchOn] = useState(false);
  const [isTorchSupported, setIsTorchSupported] = useState(false);
  const [isScanningActive, setIsScanningActive] = useState(false);
  const startupTimeoutRef = useRef<NodeJS.Timeout | null>(null);


  const scanWithJsQR = useCallback(() => {
    if (!isScanningActive) {
      animationFrameId.current = requestAnimationFrame(scanWithJsQR);
      return;
    }
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
            return; // Stop scanning
          }
        }
      }
    }
    // Continue scanning if no code found or video not ready
    animationFrameId.current = requestAnimationFrame(scanWithJsQR);
  }, [onScanSuccess, isScanningActive]);

  const scanWithBarcodeDetector = useCallback(async (video: HTMLVideoElement, detector: any) => {
    if (!isScanningActive) {
      animationFrameId.current = requestAnimationFrame(() => scanWithBarcodeDetector(video, detector));
      return;
    }
    try {
        const barcodes = await detector.detect(video);
        if (barcodes.length > 0) {
            onScanSuccess(barcodes[0].rawValue);
            return; // Stop scanning
        }
    } catch (error) {
        console.error("Barcode Detector error, falling back to jsQR:", error);
        animationFrameId.current = requestAnimationFrame(scanWithJsQR);
        return; // Stop this loop
    }
    // Continue scanning
    animationFrameId.current = requestAnimationFrame(() => scanWithBarcodeDetector(video, detector));
  }, [onScanSuccess, scanWithJsQR, isScanningActive]);
  
  const toggleTorch = async () => {
    if (!streamRef.current || !isTorchSupported) return;
    
    const videoTrack = streamRef.current.getVideoTracks()[0];
    try {
        await videoTrack.applyConstraints({
            advanced: [{ torch: !isTorchOn }]
        });
        setIsTorchOn(prev => !prev);
    } catch (error) {
        console.error("Error toggling torch:", error);
        toast({
            title: "Error de Linterna",
            description: "No se pudo cambiar el estado de la linterna.",
            variant: "destructive",
        });
    }
  };


  useEffect(() => {
    if (!isOpen) {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
      if (startupTimeoutRef.current) {
        clearTimeout(startupTimeoutRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      // Reset state when closing
      setIsTorchOn(false);
      setIsTorchSupported(false);
      setHasCameraPermission(null);
      setIsScanningActive(false);
      return;
    }

    let barcodeDetector: any | null = null;

    const startScan = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        streamRef.current = stream;
        setHasCameraPermission(true);
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();

          // Check for torch support after stream is active
          const videoTrack = stream.getVideoTracks()[0];
          // @ts-ignore
          const capabilities = videoTrack.getCapabilities ? videoTrack.getCapabilities() : {};
          // @ts-ignore
          if (capabilities.torch) {
              setIsTorchSupported(true);
          }

          // Delay before starting the scan
          startupTimeoutRef.current = setTimeout(() => {
            setIsScanningActive(true);
          }, 1500); // 1.5 second delay

          if (isBarcodeDetectorSupported()) {
            try {
              // @ts-ignore
              barcodeDetector = new window.BarcodeDetector({ formats: ['qr_code', 'code_128', 'ean_13', 'code_39'] });
              animationFrameId.current = requestAnimationFrame(() => scanWithBarcodeDetector(videoRef.current!, barcodeDetector));
            } catch (detectorError) {
                console.error("Failed to create BarcodeDetector, falling back to jsQR:", detectorError);
                animationFrameId.current = requestAnimationFrame(scanWithJsQR);
            }
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
      if (startupTimeoutRef.current) {
        clearTimeout(startupTimeoutRef.current);
      }
       if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => {
          if (track.readyState === 'live' && isTorchOn) {
             // @ts-ignore
             track.applyConstraints({ advanced: [{ torch: false }]});
          }
          track.stop()
        });
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

          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-3/4 h-1/2 border-4 border-dashed border-white/50 rounded-lg" />
          </div>

          {!isScanningActive && hasCameraPermission && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white font-bold text-lg">
              <p>Preparando escáner...</p>
            </div>
          )}

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
         <DialogFooter>
            {isTorchSupported && (
                 <Button
                    variant="outline"
                    onClick={toggleTorch}
                    className={cn("flex items-center gap-2", isTorchOn && "bg-yellow-400 hover:bg-yellow-500 text-black")}
                >
                    <Zap className="h-4 w-4" />
                    {isTorchOn ? 'Apagar Luz' : 'Encender Luz'}
                </Button>
            )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
