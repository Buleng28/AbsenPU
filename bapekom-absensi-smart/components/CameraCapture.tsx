import React, { useRef, useEffect, useState, useCallback } from 'react';

interface CameraCaptureProps {
  onCapture: (imageData: string) => void;
  onClose: () => void;
}

const CameraCapture: React.FC<CameraCaptureProps> = ({ onCapture, onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string>('');
  const [flashAvailable, setFlashAvailable] = useState(false);
  const [flashOn, setFlashOn] = useState(false);

  const startCamera = useCallback(async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: false
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }

      // Check for flash (torch) capability
      const track = mediaStream.getVideoTracks()[0];
      const capabilities = track.getCapabilities ? track.getCapabilities() : {};
      
      // 'torch' property existence check
      if ('torch' in capabilities) {
        setFlashAvailable(true);
      }

    } catch (err) {
      setError('Gagal mengakses kamera. Pastikan izin diberikan.');
      console.error(err);
    }
  }, []);

  const toggleFlash = async () => {
    if (!stream) return;
    const track = stream.getVideoTracks()[0];
    try {
      await track.applyConstraints({
        advanced: [{ torch: !flashOn } as any]
      });
      setFlashOn(!flashOn);
    } catch (err) {
      console.error('Failed to toggle flash', err);
    }
  };

  useEffect(() => {
    startCamera();
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => {
          track.stop(); // Stop the track
        });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCapture = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');

      if (context) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        const imageData = canvas.toDataURL('image/jpeg', 0.8);
        
        // Stop stream before finishing
        if (stream) {
          stream.getTracks().forEach(track => track.stop());
        }
        
        onCapture(imageData);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-90 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-xl overflow-hidden shadow-2xl relative">
        <div className="p-4 bg-bapekom-900 text-white flex justify-between items-center">
          <h3 className="font-semibold">Ambil Foto Selfie</h3>
          <div className="flex items-center gap-4">
            {flashAvailable && (
              <button 
                onClick={toggleFlash} 
                className={`transition-colors ${flashOn ? 'text-yellow-400' : 'text-white/70 hover:text-white'}`}
                title="Toggle Flash"
              >
                <i className={`fas fa-bolt ${flashOn ? 'animate-pulse' : ''}`}></i>
              </button>
            )}
            <button onClick={onClose} className="text-white hover:text-gray-300">
              <i className="fas fa-times text-xl"></i>
            </button>
          </div>
        </div>
        
        <div className="relative aspect-[3/4] bg-black">
           {error ? (
             <div className="flex h-full items-center justify-center text-white p-4 text-center">
               {error}
             </div>
           ) : (
             <video 
               ref={videoRef} 
               autoPlay 
               playsInline 
               className="w-full h-full object-cover transform -scale-x-100" 
             />
           )}
           <canvas ref={canvasRef} className="hidden" />
        </div>

        <div className="p-6 flex justify-center bg-gray-50">
          {!error && (
            <button 
              onClick={handleCapture}
              className="w-16 h-16 rounded-full border-4 border-bapekom-600 bg-white flex items-center justify-center hover:bg-gray-100 transition-colors focus:outline-none focus:ring-4 focus:ring-bapekom-300"
            >
              <div className="w-12 h-12 rounded-full bg-bapekom-600"></div>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default CameraCapture;