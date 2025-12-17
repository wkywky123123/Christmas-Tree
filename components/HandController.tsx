import React, { useEffect, useRef, useState } from 'react';
import { HandLandmarker, HandLandmarkerResult } from '@mediapipe/tasks-vision';
import { AppState } from '../types';

interface HandControllerProps {
  onStateChange: (state: AppState) => void;
  onHandMove: (x: number, y: number, z: number) => void;
  onGrab: (isGrabbing: boolean) => void;
  cameraStream: MediaStream;
  landmarker: HandLandmarker; // Preloaded instance
}

export const HandController: React.FC<HandControllerProps> = ({ 
  onStateChange, 
  onHandMove, 
  onGrab, 
  cameraStream,
  landmarker
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isMirrored, setIsMirrored] = useState(true);
  
  // Dragging State
  const [position, setPosition] = useState({ x: window.innerWidth - 280, y: 16 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const initialPosRef = useRef({ x: 0, y: 0 });

  const lastStateRef = useRef<AppState>(AppState.TREE);
  const frameIdRef = useRef<number>(0);
  const lastVideoTimeRef = useRef<number>(-1);
  const lastPredictionTimeRef = useRef<number>(0);
  
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

  // Drag Handlers
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
      e.preventDefault();
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      setPosition({
        x: initialPosRef.current.x + (clientX - dragStartRef.current.x),
        y: initialPosRef.current.y + (clientY - dragStartRef.current.y)
      });
    };
    const handleMouseUp = () => setIsDragging(false);

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

  // Prediction Loop
  useEffect(() => {
    let video: HTMLVideoElement | null = null;

    const startPrediction = async () => {
      video = videoRef.current;
      if (!video) return;

      video.srcObject = cameraStream;
      await new Promise((resolve) => {
        video!.onloadedmetadata = () => {
          video!.play();
          resolve(true);
        };
      });

      predict();
    };

    const predict = () => {
      if (!landmarker || !video) return;
      
      const now = performance.now();
      // Throttle to 30FPS for performance
      if (now - lastPredictionTimeRef.current < 32) {
         frameIdRef.current = requestAnimationFrame(predict);
         return;
      }
      lastPredictionTimeRef.current = now;

      if (video.videoWidth > 0 && video.videoHeight > 0) {
        if (video.currentTime !== lastVideoTimeRef.current) {
            lastVideoTimeRef.current = video.currentTime;
            const results = landmarker.detectForVideo(video, now);
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

      if (result.landmarks && result.landmarks.length > 0) {
        const landmarks = result.landmarks[0];
        const connections = HandLandmarker.HAND_CONNECTIONS;

        ctx.lineWidth = 3;
        ctx.strokeStyle = debugDataRef.current.pinching ? "#ffff00" : "#00ff00";
        ctx.fillStyle = "#ff0000";

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
      
      // Draw Stats
      const barHeight = 40; 
      const yPos = canvas.height - barHeight;
      ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
      ctx.fillRect(0, yPos, canvas.width, barHeight);
      ctx.textBaseline = "middle";
      const { dist, pinching, state } = debugDataRef.current;
      
      ctx.font = "bold 14px monospace";
      ctx.fillStyle = "#00ff00"; 
      ctx.fillText(`D:${dist.toFixed(2)}`, 10, yPos + barHeight/2);
      ctx.fillText(state, 80, yPos + barHeight/2);
      ctx.fillStyle = pinching ? "#ffff00" : "#aaa"; 
      ctx.fillText(pinching ? "GRAB" : "FREE", canvas.width - 60, yPos + barHeight/2);
    };

    const processGestures = (result: HandLandmarkerResult) => {
      if (!result.landmarks || result.landmarks.length === 0) return;

      const landmarks = result.landmarks[0]; 
      const isMirroredNow = isMirroredRef.current;
      const distSq = (p1: any, p2: any) => (p1.x - p2.x)**2 + (p1.y - p2.y)**2 + (p1.z - p2.z)**2;

      // 1. Position
      const centerX = (landmarks[0].x + landmarks[9].x) / 2;
      const centerY = (landmarks[0].y + landmarks[9].y) / 2;
      
      let palmX = isMirroredNow ? (0.5 - centerX) * 2 : (centerX - 0.5) * 2;
      const palmY = (0.5 - centerY) * 2;
      const palmSize = Math.sqrt(distSq(landmarks[0], landmarks[9]));
      const zoomFactor = Math.min(Math.max((palmSize - 0.1) * 3.33, 0), 1);

      onHandMoveRef.current(palmX, palmY, zoomFactor);
      
      debugDataRef.current.x = palmX;
      debugDataRef.current.y = palmY;
      debugDataRef.current.z = zoomFactor;

      // 2. Gesture Logic (Fist Detection)
      const wrist = landmarks[0];
      const thumbTip = landmarks[4];
      const indexTip = landmarks[8];
      
      // Helper to check if finger is curled
      // We compare Tip distance to Wrist vs PIP (middle joint) distance to Wrist for better sensitivity
      // Tip Indices: 8, 12, 16, 20
      // PIP Indices (Middle Joint): 6, 10, 14, 18
      const isFingerCurled = (tipIdx: number, pipIdx: number) => {
        // If Tip is closer to wrist than the middle joint, it's curled
        return distSq(landmarks[tipIdx], wrist) < distSq(landmarks[pipIdx], wrist);
      };

      // Check Index, Middle, Ring, Pinky
      const fingersFolded = 
        isFingerCurled(8, 6) &&   // Index
        isFingerCurled(12, 10) && // Middle
        isFingerCurled(16, 14) && // Ring
        isFingerCurled(20, 18);   // Pinky

      // Pinch Detection
      const pinchDist = Math.sqrt(distSq(thumbTip, indexTip));
      debugDataRef.current.dist = pinchDist;
      
      // Hysteresis for stability
      let isPinching = wasPinchingRef.current;
      if (isPinching) {
        if (pinchDist > 0.10) isPinching = false;
      } else {
        if (pinchDist < 0.05) isPinching = true;
      }
      
      wasPinchingRef.current = isPinching;
      debugDataRef.current.pinching = isPinching;

      // State Machine
      if (fingersFolded) {
        // FIST -> TREE
        if (lastStateRef.current !== AppState.TREE) {
          lastStateRef.current = AppState.TREE;
          onStateChangeRef.current(AppState.TREE);
        }
        onGrabRef.current(false);
        wasPinchingRef.current = false; 
      } else {
        // OPEN PALM -> SCATTERED
        if (lastStateRef.current === AppState.TREE) {
           lastStateRef.current = AppState.SCATTERED;
           onStateChangeRef.current(AppState.SCATTERED);
        }
        onGrabRef.current(isPinching);
      }
      debugDataRef.current.state = lastStateRef.current;
    };

    if (cameraStream) {
      startPrediction();
    }

    return () => {
      cancelAnimationFrame(frameIdRef.current);
    };
  }, [cameraStream, landmarker]);

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
      <div 
        className="absolute inset-0 z-10"
        onMouseDown={handleMouseDown}
        onTouchStart={handleMouseDown}
      />
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
        className={`absolute inset-0 w-full h-full object-cover pointer-events-none ${isMirrored ? 'transform -scale-x-100' : ''}`} 
        playsInline 
        muted
      />
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full object-cover pointer-events-none"
      />
    </div>
  );
};