import React, { useEffect, useRef, useState, useCallback } from 'react';
import { FilesetResolver, HandLandmarker, HandLandmarkerResult } from '@mediapipe/tasks-vision';
import { AppState } from '../types';

interface HandControllerProps {
  onStateChange: (state: AppState) => void;
  onHandMove: (x: number, y: number, z: number) => void;
  onGrab: (isGrabbing: boolean) => void;
}

export const HandController: React.FC<HandControllerProps> = ({ onStateChange, onHandMove, onGrab }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loaded, setLoaded] = useState(false);
  const [isMirrored, setIsMirrored] = useState(true); // Default to mirrored (selfie mode)
  
  // Dragging State
  const [position, setPosition] = useState({ x: window.innerWidth - 280, y: 16 }); // Initial top-rightish
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const initialPosRef = useRef({ x: 0, y: 0 });

  const lastStateRef = useRef<AppState>(AppState.TREE);
  const frameIdRef = useRef<number>(0);
  const lastVideoTimeRef = useRef<number>(-1);
  const lastPredictionTimeRef = useRef<number>(0);
  
  // Refs for callbacks
  const onStateChangeRef = useRef(onStateChange);
  const onHandMoveRef = useRef(onHandMove);
  const onGrabRef = useRef(onGrab);
  const isMirroredRef = useRef(isMirrored);

  useEffect(() => {
    onStateChangeRef.current = onStateChange;
    onHandMoveRef.current = onHandMove;
    onGrabRef.current = onGrab;
    isMirroredRef.current = isMirrored;
  }, [onStateChange, onHandMove, onGrab, isMirrored]);

  const wasPinchingRef = useRef(false);

  const debugDataRef = useRef({
    x: 0, y: 0, z: 0,
    dist: 0,
    pinching: false,
    state: AppState.TREE
  });

  // Drag Event Handlers
  const handleMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDragging(true);
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    dragStartRef.current = { x: clientX, y: clientY };
    initialPosRef.current = { x: position.x, y: position.y };
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent | TouchEvent) => {
      if (!isDragging) return;
      e.preventDefault(); // Prevent scrolling on touch
      
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

      const deltaX = clientX - dragStartRef.current.x;
      const deltaY = clientY - dragStartRef.current.y;

      setPosition({
        x: initialPosRef.current.x + deltaX,
        y: initialPosRef.current.y + deltaY
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('touchmove', handleMouseMove, { passive: false });
      window.addEventListener('touchend', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleMouseMove);
      window.removeEventListener('touchend', handleMouseUp);
    };
  }, [isDragging]);

  useEffect(() => {
    let handLandmarker: HandLandmarker | null = null;
    let video: HTMLVideoElement | null = null;

    const setup = async () => {
      const vision = await FilesetResolver.forVisionTasks(
        "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
      );
      
      handLandmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
          delegate: "GPU"
        },
        runningMode: "VIDEO",
        numHands: 1
      });

      video = videoRef.current;
      if (!video) return;

      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: 640, height: 480 } 
      });
      video.srcObject = stream;
      await new Promise((resolve) => {
        video!.onloadedmetadata = () => {
          video!.play();
          resolve(true);
        };
      });

      setLoaded(true);
      predict();
    };

    const predict = () => {
      if (!handLandmarker || !video) return;
      
      const now = performance.now();
      // Throttle to ~30FPS (32ms)
      // This is VITAL. Running ML at 60fps on Main Thread kills rendering performance.
      // We rely on the Interpolation in App.tsx to make it LOOK like 60fps.
      if (now - lastPredictionTimeRef.current < 32) {
         frameIdRef.current = requestAnimationFrame(predict);
         return;
      }
      lastPredictionTimeRef.current = now;

      if (video.videoWidth > 0 && video.videoHeight > 0) {
        if (video.currentTime !== lastVideoTimeRef.current) {
            lastVideoTimeRef.current = video.currentTime;
            const results = handLandmarker.detectForVideo(video, now);
            drawDebug(results);
            processGestures(results);
        }
      }
      
      frameIdRef.current = requestAnimationFrame(predict);
    };

    const drawDebug = (result: HandLandmarkerResult) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      if (videoRef.current) {
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const isMirroredNow = isMirroredRef.current;

      // --- Draw Skeleton ---
      if (result.landmarks && result.landmarks.length > 0) {
        const landmarks = result.landmarks[0];
        const connections = HandLandmarker.HAND_CONNECTIONS;

        ctx.lineWidth = 3;
        ctx.strokeStyle = debugDataRef.current.pinching ? "#ffff00" : "#00ff00";
        ctx.fillStyle = "#ff0000";

        // If mirrored: x = (1 - val) * w
        // If not mirrored: x = val * w
        const getX = (val: number) => (isMirroredNow ? (1 - val) : val) * canvas.width;
        const getY = (val: number) => val * canvas.height;

        for (const conn of connections) {
          const p1 = landmarks[conn.start];
          const p2 = landmarks[conn.end];
          ctx.beginPath();
          ctx.moveTo(getX(p1.x), getY(p1.y));
          ctx.lineTo(getX(p2.x), getY(p2.y));
          ctx.stroke();
        }

        for (const p of landmarks) {
          ctx.beginPath();
          ctx.arc(getX(p.x), getY(p.y), 5, 0, 2 * Math.PI);
          ctx.fill();
        }
      }

      // --- Draw Stats Bar ---
      const barHeight = 60; 
      const yPos = canvas.height - barHeight;

      ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
      ctx.fillRect(0, yPos, canvas.width, barHeight);

      ctx.textBaseline = "middle";
      const { dist, pinching } = debugDataRef.current;
      
      const padding = 20;
      const colWidth = canvas.width / 2;

      const distStr = `Dist:${dist.toFixed(3)}`;
      
      ctx.font = "bold 20px monospace";
      ctx.fillStyle = "#00ff00"; 
      ctx.fillText(distStr, padding, yPos + barHeight/2);

      const pinchText = pinching ? "GRAB: ON" : "GRAB: OFF";
      ctx.fillStyle = pinching ? "#ffff00" : "#888"; 
      ctx.fillText(pinchText, colWidth, yPos + barHeight/2);
    };

    const processGestures = (result: HandLandmarkerResult) => {
      if (!result.landmarks || result.landmarks.length === 0) return;

      const landmarks = result.landmarks[0]; 
      const isMirroredNow = isMirroredRef.current;

      const distSq = (p1: any, p2: any) => (p1.x - p2.x)**2 + (p1.y - p2.y)**2 + (p1.z - p2.z)**2;

      // 1. Calculate Hand Position & Zoom
      const centerX = (landmarks[0].x + landmarks[9].x) / 2;
      const centerY = (landmarks[0].y + landmarks[9].y) / 2;
      
      // Coordinate Mapping:
      // MediaPipe x: 0 (Left of Image) -> 1 (Right of Image)
      // Screen x: -1 (Left) -> 1 (Right)
      
      let palmX = 0;
      if (isMirroredNow) {
        // Mirrored Mode (Selfie):
        // Physical Right Hand -> Appears on Image Left (x ~ 0) -> We want Cursor Right (val > 0)
        // So Low X -> High Output
        palmX = (0.5 - centerX) * 2; 
      } else {
        // Normal Mode (Webcam):
        // Physical Right Hand -> Appears on Image Right (x ~ 1) -> We want Cursor Right (val > 0)
        // So High X -> High Output
        palmX = (centerX - 0.5) * 2;
      }

      const palmY = (0.5 - centerY) * 2; // Y is usually consistent (Top=0)

      const palmSize = Math.sqrt(distSq(landmarks[0], landmarks[9]));
      const zoomFactor = Math.min(Math.max((palmSize - 0.1) * 3.33, 0), 1);

      onHandMoveRef.current(palmX, palmY, zoomFactor);
      
      debugDataRef.current.x = palmX;
      debugDataRef.current.y = palmY;
      debugDataRef.current.z = zoomFactor;

      // 2. Gesture Recognition
      const thumbTip = landmarks[4];
      const indexTip = landmarks[8];
      const wrist = landmarks[0];

      const isFingerCurled = (tipIdx: number, pipIdx: number) => {
        return distSq(landmarks[tipIdx], wrist) < distSq(landmarks[pipIdx], wrist);
      };

      const fingersFolded = 
        isFingerCurled(8, 5) && 
        isFingerCurled(12, 9) && 
        isFingerCurled(16, 13) && 
        isFingerCurled(20, 17);

      // --- PINCH CALCULATION ---
      const pinchDist = Math.sqrt(distSq(thumbTip, indexTip));
      debugDataRef.current.dist = pinchDist;
      
      const PINCH_ENTER = 0.06; 
      const PINCH_EXIT = 0.10;  

      let isPinching = wasPinchingRef.current;
      if (isPinching) {
        if (pinchDist > PINCH_EXIT) isPinching = false;
      } else {
        if (pinchDist < PINCH_ENTER) isPinching = true;
      }
      
      wasPinchingRef.current = isPinching;
      debugDataRef.current.pinching = isPinching;

      // --- STATE MACHINE ---
      if (fingersFolded) {
        if (lastStateRef.current !== AppState.TREE) {
          lastStateRef.current = AppState.TREE;
          onStateChangeRef.current(AppState.TREE);
        }
        onGrabRef.current(false);
        wasPinchingRef.current = false; 
      } else {
        if (lastStateRef.current === AppState.TREE) {
           lastStateRef.current = AppState.SCATTERED;
           onStateChangeRef.current(AppState.SCATTERED);
        }
        onGrabRef.current(isPinching);
      }

      debugDataRef.current.state = lastStateRef.current;
    };

    setup();

    return () => {
      cancelAnimationFrame(frameIdRef.current);
      if (video && video.srcObject) {
        const stream = video.srcObject as MediaStream;
        stream.getTracks().forEach(t => t.stop());
      }
      if (handLandmarker) handLandmarker.close();
    };
  }, []);

  return (
    <div 
      className="fixed z-50 rounded-lg overflow-hidden border border-amber-500/30 shadow-lg select-none"
      style={{ 
        width: '256px', 
        height: '192px',
        left: `${position.x}px`,
        top: `${position.y}px`,
        cursor: isDragging ? 'grabbing' : 'grab'
      }}
    >
      {/* Draggable Header / Overlay */}
      <div 
        className="absolute inset-0 z-10"
        onMouseDown={handleMouseDown}
        onTouchStart={handleMouseDown}
      />
      
      {/* Controls Overlay */}
      <div className="absolute top-2 right-2 z-20 flex gap-2">
         <button 
           onClick={(e) => { e.stopPropagation(); setIsMirrored(!isMirrored); }}
           className="bg-black/60 hover:bg-black/80 text-amber-500 text-xs px-2 py-1 rounded border border-amber-500/30 backdrop-blur-sm transition-colors"
         >
           {isMirrored ? "镜像:开" : "镜像:关"}
         </button>
      </div>

      <video 
        ref={videoRef} 
        className={`absolute inset-0 w-full h-full object-cover pointer-events-none ${isMirrored ? 'transform -scale-x-100' : ''} ${loaded ? 'opacity-60' : 'opacity-0'}`} 
        playsInline 
        muted
      />
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full object-cover pointer-events-none"
      />
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center text-amber-500 text-xs pointer-events-none">
          启动相机中...
        </div>
      )}
    </div>
  );
};