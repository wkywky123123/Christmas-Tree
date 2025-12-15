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
  const [loaded, setLoaded] = useState(false);
  const lastStateRef = useRef<AppState>(AppState.TREE);
  const frameIdRef = useRef<number>(0);

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
      
      // Only process if video has enough data
      if (video.videoWidth > 0 && video.videoHeight > 0) {
        const results = handLandmarker.detectForVideo(video, performance.now());
        processGestures(results);
      }
      
      frameIdRef.current = requestAnimationFrame(predict);
    };

    const processGestures = (result: HandLandmarkerResult) => {
      if (!result.landmarks || result.landmarks.length === 0) return;

      const landmarks = result.landmarks[0]; // First hand

      // Helper: Distance squared
      const distSq = (p1: any, p2: any) => (p1.x - p2.x)**2 + (p1.y - p2.y)**2 + (p1.z - p2.z)**2;

      // 1. Calculate Hand Position & Zoom
      // X/Y: Center of palm (Average of wrist 0 and Middle Finger MCP 9)
      // Normalize to -1 to 1 (inverted X because of mirror effect)
      const centerX = (landmarks[0].x + landmarks[9].x) / 2;
      const centerY = (landmarks[0].y + landmarks[9].y) / 2;
      
      const palmX = -(centerX - 0.5) * 2; 
      // MediaPipe中 y=0 是顶部，y=1 是底部。
      // 我们希望 手在顶部(y小) -> 输出负值(-1) -> 对应3D中的上方/仰角
      const palmY = (centerY - 0.5) * 2;

      // Z: Estimate based on palm size (distance between wrist and middle finger MCP)
      // Typical size in frame: 0.1 (far) to 0.4 (close)
      const palmSize = Math.sqrt(distSq(landmarks[0], landmarks[9]));
      // Map 0.1->0.4 to 0->1 approximately
      const zoomFactor = Math.min(Math.max((palmSize - 0.1) * 3.33, 0), 1);

      onHandMove(palmX, palmY, zoomFactor);

      // 2. Gesture Recognition
      
      const thumbTip = landmarks[4];
      const indexTip = landmarks[8];
      const wrist = landmarks[0];

      // Check for Fist (All fingers curled towards wrist/palm)
      // Simple heuristic: Tips are close to wrist or lower than PIP joints
      const isFingerCurled = (tipIdx: number, pipIdx: number) => {
        return distSq(landmarks[tipIdx], wrist) < distSq(landmarks[pipIdx], wrist);
      };

      const fingersFolded = 
        isFingerCurled(8, 5) && 
        isFingerCurled(12, 9) && 
        isFingerCurled(16, 13) && 
        isFingerCurled(20, 17);

      // Check for Pinch (Thumb and Index close)
      const pinchDist = Math.sqrt(distSq(thumbTip, indexTip));
      // 调整灵敏度：0.06 (比0.08略低，比0.05高，平衡稳定性)
      const isPinching = pinchDist < 0.06;

      // Check for Open Palm (Fingers extended)
      const isOpen = !fingersFolded && !isPinching;

      // State Machine Logic
      if (fingersFolded && lastStateRef.current !== AppState.TREE) {
        lastStateRef.current = AppState.TREE;
        onStateChange(AppState.TREE);
        onGrab(false);
      } else if (isOpen && lastStateRef.current !== AppState.SCATTERED) {
        // If we were viewing a photo, open palm releases it back to scattered
        lastStateRef.current = AppState.SCATTERED;
        onStateChange(AppState.SCATTERED);
        onGrab(false);
      }

      // Grab Logic (Independent trigger or state modifier)
      if (isPinching) {
        // 只在打散或查看照片状态下允许抓取
        if (lastStateRef.current === AppState.SCATTERED || lastStateRef.current === AppState.PHOTO_VIEW) {
           onGrab(true);
        }
      } else {
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
    <div className="absolute top-4 right-4 w-48 h-36 bg-black/50 rounded-lg overflow-hidden border border-amber-500/30 shadow-lg z-50">
      <video 
        ref={videoRef} 
        className={`w-full h-full object-cover transform -scale-x-100 ${loaded ? 'opacity-80' : 'opacity-0'}`} 
        playsInline 
        muted
      />
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center text-amber-500 text-xs">
          启动相机中...
        </div>
      )}
      <div className="absolute bottom-1 left-2 text-[10px] text-white font-mono">
        状态: {loaded ? "追踪中" : "初始化"}
      </div>
    </div>
  );
};