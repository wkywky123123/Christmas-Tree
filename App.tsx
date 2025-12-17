
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useProgress } from '@react-three/drei';
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import { Scene } from './components/Scene';
import { HandController } from './components/HandController';
import { AppState } from './types';

// Dynamic Image Loading from /public/img
const getDynamicImages = () => {
  try {
    const globbed = (import.meta as any).glob('/public/img/*.{png,jpg,jpeg,webp}', { eager: true, as: 'url' });
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

const MAGIC_MESSAGES = [
  "✨ 愿你的圣诞充满奇迹 ✨",
  "🎄 温暖、爱与和平常伴 🎄",
  "❄️ 每一片雪花都是冬天的亲吻 ❄️",
  "🎁 最好的礼物是彼此的陪伴 🎁",
  "⭐ 星光照亮你前行的道路 ⭐"
];

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
        <div className="space-y-2">
          <div className="flex justify-between text-[10px] uppercase tracking-[0.2em] text-blue-400">
            <span>基础资源初始化</span>
            <span>{Math.round(smoothP1)}%</span>
          </div>
          <div className="h-[2px] w-full bg-blue-900/30 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 shadow-[0_0_10px_#3b82f6]" style={{ width: `${smoothP1}%` }} />
          </div>
        </div>

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
  const smoothedHandPosRef = useRef({ x: 0, y: 0, z: 0 });
  const cursorRef = useRef<HTMLDivElement>(null);
  const [isGrabbing, setIsGrabbing] = useState(false);
  const [magicMsg, setMagicMsg] = useState("");
  const [isInstructionsOpen, setIsInstructionsOpen] = useState(true);

  // Phase 1 Progress Simulation
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

  // Phase 2 Real Loading
  useEffect(() => {
    if (phase1Progress < 100) return;

    const loadHeavyAssets = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks("/models/wasm");
        const modelUrl = "/models/hand_landmarker.task";
        let modelPercent = 0;
        let hdrPercent = 0;

        await Promise.all([
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

  // Smoothed Cursor & Hand Pos Logic
  useEffect(() => {
    let rAF = 0;
    const loop = () => {
      const target = handPosRef.current;
      const current = smoothedHandPosRef.current;
      const lerpFactor = 0.15;

      current.x += (target.x - current.x) * lerpFactor;
      current.y += (target.y - current.y) * lerpFactor;
      current.z += (target.z - current.z) * lerpFactor;

      if (cursorRef.current) {
        // Convert normalized (-1 to 1) to viewport %
        const left = (current.x + 1) * 50;
        const top = (-current.y + 1) * 50;
        cursorRef.current.style.left = `${left}%`;
        cursorRef.current.style.top = `${top}%`;
        
        // Hide if near zero (no hand)
        const isCenter = Math.abs(current.x) < 0.001 && Math.abs(current.y) < 0.001;
        cursorRef.current.style.opacity = isCenter ? '0' : '1';
      }
      rAF = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(rAF);
  }, []);

  const handleStateChange = useCallback((newState: AppState) => {
    setAppState(newState);
    if (newState === AppState.SCATTERED) {
      const randomMsg = MAGIC_MESSAGES[Math.floor(Math.random() * MAGIC_MESSAGES.length)];
      setMagicMsg(randomMsg);
      setTimeout(() => setMagicMsg(""), 4000);
    }
  }, []);

  const handleStart = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
      setCameraStream(stream);
      setHasStarted(true);
    } catch (e) { alert("需要摄像头权限开启魔法"); }
  };

  return (
    <div className="w-full h-full relative overflow-hidden bg-black text-white">
      {/* 1. LOADING OVERLAY */}
      <LoadingScreen 
        phase1={phase1Progress} 
        phase2={phase2Progress} 
        onStart={handleStart} 
        hasStarted={hasStarted} 
      />

      {/* 2. 3D SCENE */}
      <Scene 
        appState={appState} 
        photos={photos} 
        handPosRef={smoothedHandPosRef} 
        isGrabbing={isGrabbing} 
        onPhotoSelect={() => setAppState(AppState.PHOTO_VIEW)}
      />

      {/* 3. HAND CONTROLLER */}
      {cameraStream && landmarker && (
        <HandController 
          cameraStream={cameraStream} 
          landmarker={landmarker}
          onStateChange={handleStateChange}
          onHandMove={(x,y,z) => { handPosRef.current = {x,y,z} }}
          onGrab={setIsGrabbing}
        />
      )}

      {/* 4. UI OVERLAYS (THE MISSING STUFF) */}
      {hasStarted && (
        <>
          {/* Top Title */}
          <div className="absolute top-0 left-0 p-8 pointer-events-none animate-fade-in-down">
            <h1 className="text-4xl md:text-5xl font-serif text-amber-400 tracking-widest drop-shadow-glow">
              圣诞手势魔法
            </h1>
            <p className="text-sm text-amber-200/60 mt-2 font-light tracking-[0.3em] uppercase">
              Gesture & Particle Christmas Experience
            </p>
          </div>

          {/* Magic Message Display */}
          <div className={`absolute inset-0 flex items-center justify-center pointer-events-none transition-all duration-1000 ${magicMsg ? 'opacity-100 scale-110' : 'opacity-0 scale-90'}`}>
             <h2 className="text-4xl md:text-6xl text-amber-300 font-serif text-shadow-glow text-center px-10">
               {magicMsg}
             </h2>
          </div>

          {/* Gesture Guide Panel */}
          <div className="absolute bottom-8 left-8 w-72 pointer-events-auto transition-all duration-500">
            <div 
              className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl"
            >
              <button 
                onClick={() => setIsInstructionsOpen(!isInstructionsOpen)}
                className="w-full p-4 flex items-center justify-between hover:bg-white/5 transition-colors group"
              >
                <span className="text-xs font-bold tracking-[0.2em] text-amber-400 uppercase">手势指南</span>
                <span className={`text-[10px] transition-transform duration-300 ${isInstructionsOpen ? 'rotate-180' : ''}`}>▼</span>
              </button>
              
              <div className={`transition-all duration-500 ease-in-out ${isInstructionsOpen ? 'max-h-64 opacity-100' : 'max-h-0 opacity-0'}`}>
                <div className="px-6 pb-6 space-y-4 text-xs">
                  <div className={`flex items-center gap-4 transition-colors ${appState === AppState.TREE ? 'text-amber-400' : 'text-white/40'}`}>
                    <div className="w-8 h-8 rounded-full border border-current flex items-center justify-center text-lg">✊</div>
                    <div>
                      <div className="font-bold">握拳</div>
                      <div className="opacity-60 text-[10px]">聚合圣诞树粒子</div>
                    </div>
                  </div>
                  <div className={`flex items-center gap-4 transition-colors ${appState === AppState.SCATTERED ? 'text-amber-400' : 'text-white/40'}`}>
                    <div className="w-8 h-8 rounded-full border border-current flex items-center justify-center text-lg">🖐</div>
                    <div>
                      <div className="font-bold">张开</div>
                      <div className="opacity-60 text-[10px]">释放魔法祝福粒子</div>
                    </div>
                  </div>
                  <div className={`flex items-center gap-4 transition-colors ${appState === AppState.PHOTO_VIEW ? 'text-amber-400' : 'text-white/40'}`}>
                    <div className="w-8 h-8 rounded-full border border-current flex items-center justify-center text-lg">👌</div>
                    <div>
                      <div className="font-bold">捏合</div>
                      <div className="opacity-60 text-[10px]">抓取并放大照片</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Custom Cursor Follower */}
          <div 
            ref={cursorRef}
            className={`absolute w-12 h-12 rounded-full border-2 border-amber-400/50 transition-transform duration-75 pointer-events-none transform -translate-x-1/2 -translate-y-1/2 z-40 flex items-center justify-center ${isGrabbing ? 'scale-75 bg-amber-400/20' : 'scale-100'}`}
            style={{ 
              boxShadow: '0 0 20px rgba(255, 215, 0, 0.3), inset 0 0 10px rgba(255, 215, 0, 0.2)',
              willChange: 'left, top'
            }}
          >
            <div className={`w-2 h-2 bg-amber-400 rounded-full transition-all duration-300 ${isGrabbing ? 'scale-150 shadow-[0_0_15px_#f59e0b]' : 'scale-100'}`}></div>
          </div>
        </>
      )}
    </div>
  );
}
