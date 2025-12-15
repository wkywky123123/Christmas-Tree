import React, { useEffect, useRef, useState } from 'react';
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
  const lastStateRef = useRef<AppState>(AppState.TREE);
  const frameIdRef = useRef<number>(0);
  
  // Ref for callbacks to avoid stale closures
  const onStateChangeRef = useRef(onStateChange);
  const onHandMoveRef = useRef(onHandMove);
  const onGrabRef = useRef(onGrab);

  useEffect(() => {
    onStateChangeRef.current = onStateChange;
    onHandMoveRef.current = onHandMove;
    onGrabRef.current = onGrab;
  }, [onStateChange, onHandMove, onGrab]);

  // Hysteresis refs
  const wasPinchingRef = useRef(false);

  // Debug Data refs
  const debugDataRef = useRef({
    x: 0, y: 0, z: 0,
    dist: 0,
    pinching: false,
    state: AppState.TREE
  });

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
      
      if (video.videoWidth > 0 && video.videoHeight > 0) {
        const results = handLandmarker.detectForVideo(video, performance.now());
        drawDebug(results);
        processGestures(results);
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

      // --- Draw Skeleton ---
      if (result.landmarks && result.landmarks.length > 0) {
        const landmarks = result.landmarks[0];
        const connections = HandLandmarker.HAND_CONNECTIONS;

        ctx.lineWidth = 3;
        ctx.strokeStyle = debugDataRef.current.pinching ? "#ffff00" : "#00ff00";
        ctx.fillStyle = "#ff0000";

        const getX = (val: number) => (1 - val) * canvas.width;
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

      const distSq = (p1: any, p2: any) => (p1.x - p2.x)**2 + (p1.y - p2.y)**2 + (p1.z - p2.z)**2;

      // 1. Calculate Hand Position & Zoom
      const centerX = (landmarks[0].x + landmarks[9].x) / 2;
      const centerY = (landmarks[0].y + landmarks[9].y) / 2;
      
      const palmX = (0.5 - centerX) * 2; 
      const palmY = (0.5 - centerY) * 2;

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
      
      // Hysteresis Settings
      const PINCH_ENTER = 0.06; // Trigger pinch
      const PINCH_EXIT = 0.10;  // Release pinch

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
        // [FIST] -> TREE State
        if (lastStateRef.current !== AppState.TREE) {
          lastStateRef.current = AppState.TREE;
          onStateChangeRef.current(AppState.TREE);
        }
        // Force release grab if making a fist
        onGrabRef.current(false);
        wasPinchingRef.current = false; // Reset pinch memory
      } else {
        // [OPEN HAND] -> SCATTERED State logic
        
        // If we were in TREE, we definitely switch to SCATTERED now
        if (lastStateRef.current === AppState.TREE) {
           lastStateRef.current = AppState.SCATTERED;
           onStateChangeRef.current(AppState.SCATTERED);
        }

        // Handle Grab / Pinch
        // This is valid in SCATTERED or PHOTO_VIEW states
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
    <div className="absolute top-4 right-4 w-64 h-48 bg-black/50 rounded-lg overflow-hidden border border-amber-500/30 shadow-lg z-50">
      <video 
        ref={videoRef} 
        className={`absolute inset-0 w-full h-full object-cover transform -scale-x-100 ${loaded ? 'opacity-60' : 'opacity-0'}`} 
        playsInline 
        muted
      />
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full object-cover pointer-events-none"
      />
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center text-amber-500 text-xs">
          启动相机中...
        </div>
      )}
    </div>
  );
};