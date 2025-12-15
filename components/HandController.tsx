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
  
  // Hysteresis refs
  const wasPinchingRef = useRef(false);

  // Debug Data refs for drawing
  const debugDataRef = useRef({
    x: 0, y: 0, z: 0,
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
        
        // Draw Debug info
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

      // Match canvas size to video size
      if (videoRef.current) {
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // --- Draw Skeleton (Needs to be flipped) ---
      ctx.save();
      ctx.scale(-1, 1);
      ctx.translate(-canvas.width, 0);

      if (result.landmarks && result.landmarks.length > 0) {
        const landmarks = result.landmarks[0];
        const connections = HandLandmarker.HAND_CONNECTIONS;

        ctx.lineWidth = 3;
        ctx.strokeStyle = debugDataRef.current.pinching ? "#ffff00" : "#00ff00";
        ctx.fillStyle = "#ff0000";

        // Draw connectors
        for (const conn of connections) {
          const p1 = landmarks[conn.start];
          const p2 = landmarks[conn.end];
          ctx.beginPath();
          ctx.moveTo(p1.x * canvas.width, p1.y * canvas.height);
          ctx.lineTo(p2.x * canvas.width, p2.y * canvas.height);
          ctx.stroke();
        }

        // Draw points
        for (const p of landmarks) {
          ctx.beginPath();
          ctx.arc(p.x * canvas.width, p.y * canvas.height, 5, 0, 2 * Math.PI);
          ctx.fill();
        }
      }
      ctx.restore();

      // --- Draw Stats Bar (Bottom, Unflipped Text) ---
      // Increased height and font size for visibility
      const barHeight = 60; 
      const yPos = canvas.height - barHeight;

      // Background
      ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
      ctx.fillRect(0, yPos, canvas.width, barHeight);

      // Text Settings
      ctx.textBaseline = "middle";
      const { x, y, pinching } = debugDataRef.current;
      
      // Layout
      const padding = 20;
      const colWidth = canvas.width / 2;

      // Column 1: Coords
      const xStr = `X:${x.toFixed(2)}`;
      const yStr = `Y:${y.toFixed(2)}`;
      ctx.font = "bold 24px monospace";
      ctx.fillStyle = "#00ff00"; 
      ctx.fillText(`${xStr}  ${yStr}`, padding, yPos + barHeight/2);

      // Column 2: Pinch Status
      const pinchText = pinching ? "GRAB: ON" : "GRAB: OFF";
      ctx.fillStyle = pinching ? "#ffff00" : "#888"; 
      ctx.fillText(pinchText, colWidth + padding, yPos + barHeight/2);
    };

    const processGestures = (result: HandLandmarkerResult) => {
      if (!result.landmarks || result.landmarks.length === 0) return;

      const landmarks = result.landmarks[0]; 

      // Helper: Distance squared
      const distSq = (p1: any, p2: any) => (p1.x - p2.x)**2 + (p1.y - p2.y)**2 + (p1.z - p2.z)**2;

      // 1. Calculate Hand Position & Zoom
      const centerX = (landmarks[0].x + landmarks[9].x) / 2;
      const centerY = (landmarks[0].y + landmarks[9].y) / 2;
      
      const palmX = (0.5 - centerX) * 2; 
      const palmY = (0.5 - centerY) * 2;

      const palmSize = Math.sqrt(distSq(landmarks[0], landmarks[9]));
      const zoomFactor = Math.min(Math.max((palmSize - 0.1) * 3.33, 0), 1);

      onHandMove(palmX, palmY, zoomFactor);
      
      // Update debug ref
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

      const pinchDist = Math.sqrt(distSq(thumbTip, indexTip));
      
      // --- HYSTERESIS LOGIC ---
      // Use different thresholds for entering and exiting pinch state
      // This prevents "flickering" or snapping back when near the boundary.
      const PINCH_ENTER_THRESHOLD = 0.05; // Needs to be close to start
      const PINCH_EXIT_THRESHOLD = 0.10;  // Needs to move apart to stop

      let isPinching = wasPinchingRef.current;
      
      if (isPinching) {
        // Currently pinching, check if we should stop
        if (pinchDist > PINCH_EXIT_THRESHOLD) {
          isPinching = false;
        }
      } else {
        // Not pinching, check if we should start
        if (pinchDist < PINCH_ENTER_THRESHOLD) {
          isPinching = true;
        }
      }
      
      wasPinchingRef.current = isPinching;

      const isOpen = !fingersFolded && !isPinching;

      // Update debug ref
      debugDataRef.current.pinching = isPinching;

      // State Machine Transitions
      if (fingersFolded && lastStateRef.current !== AppState.TREE) {
        lastStateRef.current = AppState.TREE;
        onStateChange(AppState.TREE);
        onGrab(false); // Force grab release
      } else if (isOpen) {
        // If hand is fully open, ensure we are in SCATTERED state
        // and force grab to false. This fixes the "stuck in pinch" issue.
        if (lastStateRef.current !== AppState.SCATTERED) {
            lastStateRef.current = AppState.SCATTERED;
            onStateChange(AppState.SCATTERED);
        }
        // Always force release if hand is detected as Open
        if (isPinching) {
            // Edge case: pinch logic says yes, but open logic says yes (unlikely but possible if thumb is close)
            // Prioritize Open Hand for navigation
            isPinching = false; 
            wasPinchingRef.current = false;
        }
        onGrab(false);
      }

      debugDataRef.current.state = lastStateRef.current;

      // Only allow grabbing if we aren't in Tree mode and not forcing open
      if (isPinching && !fingersFolded) {
        if (lastStateRef.current === AppState.SCATTERED || lastStateRef.current === AppState.PHOTO_VIEW) {
           onGrab(true);
        }
      } else if (!isPinching) {
        onGrab(false);
      }
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
      {/* Canvas for drawing skeleton, also mirrored to match video */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full object-cover transform -scale-x-100 pointer-events-none"
      />
      
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center text-amber-500 text-xs">
          启动相机中...
        </div>
      )}
    </div>
  );
};