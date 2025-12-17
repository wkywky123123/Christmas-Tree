
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useProgress } from '@react-three/drei';
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import { Scene } from './components/Scene';
import { HandController } from './components/HandController';
import { AppState } from './types';

// Dynamic Image Loading from /public/img
// Vite utility to find all images in the public folder (or specific path)
const getDynamicImages = () => {
  try {
    // We assume the user puts their files in /public/img/
    // Since glob is a build-time feature, we'll try to use a convention or a fallback
    // In a real environment, we'd use Vite's glob on src/assets/img, 
    // but for /public we use a list or check the folder.
    // Let's provide a robust fallback if no images are found.
    // Fix: cast import.meta to any to access Vite-specific 'glob' which may not be in standard ImportMeta types
    const globbed = (import.meta as any).glob('/public/img/*.{png,jpg,jpeg,webp}', { eager: true, as: 'url' });
    // Fix: cast url to string to allow calling string methods like 'replace'
    const urls = Object.values(globbed).map(url => (url as string).replace('/public', ''));
    return urls.length > 0 ? urls : [
      "https://picsum.photos/id/10/400/400",
      "https://picsum.photos/id/15/400/400",
      "https://picsum.photos/id/20/400/400"
    ];
  } catch (e) {
    return ["https://picsum.photos/id/10/400/400"];
  }
};

const MAGIC_MESSAGES = ["✨ 愿你的圣诞充满奇迹 ✨", "🎄 温暖、爱与和平 🎄", "❄️ 每一片雪花都是冬天的亲吻 ❄️"];

const fetchWithProgress = async (url: string, onProgress: (loaded: number, total: number) => void) => {
  const response = await fetch(url);
  const reader = response.body?.getReader();
  const contentLength = +(response.headers.get('Content-Length') ?? 0);
  
  let receivedLength = 0;
  while(reader) {
    const {done, value} = await reader.read();
    if (done) break;
    receivedLength += value.length;
    onProgress(receivedLength, contentLength);
  }
  return url;
};

const LoadingScreen = ({ 
  phase1, phase2, onStart, hasStarted 
}: { 
  phase1: number; phase2: number; onStart: () => void; hasStarted: boolean 
}) => {
  const [smoothP1, setSmoothP1] = useState(0);
  const [smoothP2, setSmoothP2] = useState(0);

  useEffect(() => {
    let frame: number;
    const lerp = () => {
      setSmoothP1(p => p + (phase1 - p) * 0.1);
      setSmoothP2(p => p + (phase2 - p) * 0.1);
      frame = requestAnimationFrame(lerp);
    };
    lerp();
    return () => cancelAnimationFrame(frame);
  }, [phase1, phase2]);

  if (hasStarted) return null;

  const isComplete = smoothP2 > 99;

  return (
    <div className="absolute inset-0 z-[100] bg-black flex flex-col items-center justify-center p-6 text-white font-serif">
      <h1 className="text-4xl md:text-6xl text-amber-400 mb-12 drop-shadow-[0_0_20px_rgba(255,215,0,0.5)]">
        圣诞魔法加载中
      </h1>

      <div className="w-full max-w-sm space-y-10">
        {/* Phase 1: Core Assets */}
        <div className="space-y-2">
          <div className="flex justify-between text-[10px] uppercase tracking-[0.2em] text-blue-400">
            <span>基础资源初始化</span>
            <span>{Math.round(smoothP1)}%</span>
          </div>
          <div className="h-[2px] w-full bg-blue-900/30 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 shadow-[0_0_10px_#3b82f6]" style={{ width: `${smoothP1}%` }} />
          </div>
        </div>

        {/* Phase 2: Magic Engine */}
        <div className={`space-y-2 transition-opacity duration-500 ${smoothP1 > 90 ? 'opacity-100' : 'opacity-20'}`}>
          <div className="flex justify-between text-[10px] uppercase tracking-[0.2em] text-amber-400">
            <span>正在注入 3D 魔法引擎</span>
            <span>{Math.round(smoothP2)}%</span>
          </div>
          <div className="h-[2px] w-full bg-amber-900/30 rounded-full overflow-hidden">
            <div className="h-full bg-amber-500 shadow-[0_0_10px_#f59e0b]" style={{ width: `${smoothP2}%` }} />
          </div>
        </div>
      </div>

      {isComplete && (
        <button 
          onClick={onStart}
          className="mt-16 px-12 py-4 border border-amber-500/50 rounded-full text-amber-400 uppercase tracking-widest hover:bg-amber-500/10 hover:shadow-[0_0_30px_rgba(255,215,0,0.3)] transition-all animate-fade-in"
        >
          进入魔法世界
        </button>
      )}
      
      <p className="mt-8 text-gray-600 text-[10px] uppercase tracking-tighter">
        建议横屏获得最佳沉浸感
      </p>
    </div>
  );
};

export default function App() {
  const [appState, setAppState] = useState<AppState>(AppState.TREE);
  const [photos] = useState<string[]>(getDynamicImages());
  const [hasStarted, setHasStarted] = useState(false);
  const [landmarker, setLandmarker] = useState<HandLandmarker | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  
  const [phase1Progress, setPhase1Progress] = useState(0);
  const [phase2Progress, setPhase2Progress] = useState(0);

  const handPosRef = useRef({ x: 0, y: 0, z: 0 });
  const [isGrabbing, setIsGrabbing] = useState(false);
  const [magicMsg, setMagicMsg] = useState("");

  // Step 1: Initialize Stage 1 (Fake progress for UI assets, but linked to image loading)
  useEffect(() => {
    let progress = 0;
    const interval = setInterval(() => {
      progress += (Math.random() * 5);
      if (progress >= 100) {
        setPhase1Progress(100);
        clearInterval(interval);
      } else {
        setPhase1Progress(progress);
      }
    }, 40);
  }, []);

  // Step 2: Initialize Stage 2 (Actual Large File Fetching)
  useEffect(() => {
    if (phase1Progress < 100) return;

    const loadHeavyAssets = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks("/models/wasm");
        
        // Track the model task file specifically
        const modelUrl = "/models/hand_landmarker.task";
        let modelPercent = 0;
        let hdrPercent = 0;

        await Promise.all([
          // We don't actually need to "await" the bytes here, just ensure they are fetching
          // but we do it to track real-time progress
          fetchWithProgress(modelUrl, (loaded, total) => {
             modelPercent = (loaded / total) * 100;
             setPhase2Progress(modelPercent * 0.7 + hdrPercent * 0.3);
          }),
          fetchWithProgress("/models/potsdamer_platz_1k.hdr", (loaded, total) => {
             hdrPercent = (loaded / total) * 100;
             setPhase2Progress(modelPercent * 0.7 + hdrPercent * 0.3);
          })
        ]);

        const lm = await HandLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: modelUrl, delegate: "GPU" },
          runningMode: "VIDEO", numHands: 1
        });
        
        setLandmarker(lm);
        setPhase2Progress(100);
      } catch (err) {
        console.error(err);
      }
    };

    loadHeavyAssets();
  }, [phase1Progress]);

  const handleStart = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
      setCameraStream(stream);
      setHasStarted(true);
    } catch (e) { alert("需要摄像头权限开启魔法"); }
  };

  return (
    <div className="w-full h-full relative overflow-hidden bg-black">
      <LoadingScreen 
        phase1={phase1Progress} 
        phase2={phase2Progress} 
        onStart={handleStart} 
        hasStarted={hasStarted} 
      />

      <Scene 
        appState={appState} 
        photos={photos} 
        handPosRef={handPosRef} 
        isGrabbing={isGrabbing} 
        onPhotoSelect={() => setAppState(AppState.PHOTO_VIEW)}
      />

      {cameraStream && landmarker && (
        <HandController 
          cameraStream={cameraStream} 
          landmarker={landmarker}
          onStateChange={setAppState}
          onHandMove={(x,y,z) => { handPosRef.current = {x,y,z} }}
          onGrab={setIsGrabbing}
        />
      )}

      {/* Logic for random messages */}
      <div className={`absolute top-1/3 left-0 w-full text-center pointer-events-none transition-opacity duration-1000 ${appState === AppState.SCATTERED ? 'opacity-100' : 'opacity-0'}`}>
         <h2 className="text-3xl text-amber-200 font-serif drop-shadow-glow">
           {MAGIC_MESSAGES[0]}
         </h2>
      </div>
    </div>
  );
}
