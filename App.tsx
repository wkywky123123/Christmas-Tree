
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useProgress } from '@react-three/drei';
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import { Scene } from './components/Scene';
import { HandController } from './components/HandController';
import { AppState } from './types';

// Placeholder images
const DEFAULT_PHOTOS = [
  "https://picsum.photos/id/10/400/400",
  "https://picsum.photos/id/15/400/400",
  "https://picsum.photos/id/20/400/400",
  "https://picsum.photos/id/25/400/400",
  "https://picsum.photos/id/30/400/400"
];

const MAGIC_MESSAGES = [
  "✨ 愿你的圣诞充满奇迹与光芒 ✨",
  "🎄 温暖、爱与和平常伴你左右 🎄",
  "❄️ 每一片雪花都是冬天的亲吻 ❄️",
  "🎁 最好的礼物是彼此的陪伴 🎁",
  "⭐ 星光照亮你前行的道路 ⭐",
  "🔔 铃声响起，好运将至 🔔",
  "🦌 快乐如驯鹿般奔跑而来 🦌"
];

// --- LOADING SCREEN COMPONENT ---
const LoadingScreen = ({ 
  isReady, 
  onStart, 
  phase1Progress,
  phase2Progress,
  hasStarted
}: { 
  isReady: boolean; 
  onStart: () => void; 
  phase1Progress: number;
  phase2Progress: number;
  hasStarted: boolean;
}) => {
  const [displayP1, setDisplayP1] = useState(0);
  const [displayP2, setDisplayP2] = useState(0);
  const [activePhase, setActivePhase] = useState(1);

  // Smooth Interpolation
  useEffect(() => {
    let animFrame: number;
    const update = () => {
      setDisplayP1(prev => prev + (phase1Progress - prev) * 0.1);
      setDisplayP2(prev => prev + (phase2Progress - prev) * 0.1);
      
      if (phase1Progress >= 99 && activePhase === 1) {
        setActivePhase(2);
      }
      animFrame = requestAnimationFrame(update);
    };
    update();
    return () => cancelAnimationFrame(animFrame);
  }, [phase1Progress, phase2Progress, activePhase]);

  if (hasStarted) return null;

  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black text-white p-8 text-center bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-indigo-950/20 via-black to-black">
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-30">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-amber-500/10 blur-[120px] rounded-full animate-pulse" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-red-500/10 blur-[120px] rounded-full animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      <h1 className="text-5xl md:text-6xl font-serif text-transparent bg-clip-text bg-gradient-to-b from-amber-200 to-amber-500 mb-2 drop-shadow-[0_0_20px_rgba(255,215,0,0.3)]">
        圣诞魔法
      </h1>
      <p className="text-amber-500/40 font-mono text-[10px] tracking-[0.3em] uppercase mb-12">Hand Gesture Magic Experience</p>
      
      {!isReady || displayP2 < 99 ? (
        <div className="w-full max-w-md flex flex-col items-center">
          {/* Phase 1 Indicator */}
          <div className="w-full mb-8 relative">
            <div className="flex justify-between items-end mb-2">
              <span className={`text-[10px] font-mono transition-colors duration-500 ${activePhase === 1 ? 'text-amber-400' : 'text-gray-600'}`}>
                {activePhase === 1 ? "● PHASE I: 载入节日记忆" : "✓ PHASE I: 记忆就绪"}
              </span>
              <span className="text-[10px] font-mono text-gray-500">{Math.round(displayP1)}%</span>
            </div>
            <div className="h-[2px] w-full bg-gray-900 rounded-full overflow-hidden">
               <div 
                 className={`h-full transition-all duration-300 ${activePhase === 1 ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]' : 'bg-green-500/50'}`}
                 style={{ width: `${displayP1}%` }}
               />
            </div>
          </div>

          {/* Connection Animation */}
          <div className={`w-0.5 h-8 mb-8 transition-all duration-700 ${activePhase === 2 ? 'bg-gradient-to-b from-green-500 to-amber-500 scale-y-100' : 'bg-gray-800 scale-y-50'}`} />

          {/* Phase 2 Indicator */}
          <div className="w-full relative">
            <div className="flex justify-between items-end mb-2">
              <span className={`text-[10px] font-mono transition-colors duration-500 ${activePhase === 2 ? 'text-amber-400 animate-pulse' : 'text-gray-600'}`}>
                {activePhase === 2 ? "● PHASE II: 注入构筑魔法" : "WAITING FOR ENGINE..."}
              </span>
              <span className="text-[10px] font-mono text-gray-500">{Math.round(displayP2)}%</span>
            </div>
            <div className="h-[2px] w-full bg-gray-900 rounded-full overflow-hidden">
               <div 
                 className="h-full bg-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.6)]"
                 style={{ width: `${displayP2}%` }}
               />
            </div>
          </div>

          <div className="mt-12 h-4">
             <p className="text-gray-500 text-[9px] font-mono italic tracking-widest animate-fade-in">
               {activePhase === 1 ? "FETCHING ASSETS & TEXTURES..." : "INITIALIZING VISION ENGINE & SHADERS..."}
             </p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center animate-fade-in">
           <p className="text-gray-400 mb-12 max-w-sm leading-loose text-sm font-light tracking-wide">
            光影已就绪，魔法在指尖。<br/>
            请伸出双手，开启这段节日旅程。
          </p>
          <button 
            onClick={onStart}
            className="group relative px-12 py-4 bg-transparent border border-amber-500/30 rounded-none overflow-hidden transition-all hover:border-amber-400 hover:shadow-[0_0_40px_rgba(255,215,0,0.2)] active:scale-95"
          >
            <div className="absolute inset-0 bg-amber-500/5 group-hover:bg-amber-500/10 transition-all"></div>
            <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-amber-500"></div>
            <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-amber-500"></div>
            <span className="relative text-amber-400 font-bold tracking-[0.4em] uppercase text-xs flex items-center gap-2">
              进入领域
            </span>
          </button>
        </div>
      )}
    </div>
  );
};

function App() {
  const [appState, setAppState] = useState<AppState>(AppState.TREE);
  const [photos] = useState<string[]>(DEFAULT_PHOTOS);
  const [hasStarted, setHasStarted] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [landmarker, setLandmarker] = useState<HandLandmarker | null>(null);
  const [magicMessage, setMagicMessage] = useState<string>("");
  
  // Progress Logic
  const { progress: textureProgress } = useProgress();
  const [phase1Progress, setPhase1Progress] = useState(0);
  const [phase2Progress, setPhase2Progress] = useState(0);

  // Phase 1: Miscellaneous (Images, UI, etc.)
  useEffect(() => {
    let start = 0;
    const interval = setInterval(() => {
      start += Math.random() * 5;
      if (start >= 100) {
        setPhase1Progress(100);
        clearInterval(interval);
      } else {
        setPhase1Progress(start);
      }
    }, 40);
    return () => clearInterval(interval);
  }, []);

  // Phase 2: Engine & Heavy Assets
  useEffect(() => {
    if (phase1Progress < 90) return; // Wait for phase 1

    const initMediaPipe = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks("/models/wasm");
        const lm = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: "/models/hand_landmarker.task",
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numHands: 1
        });
        setLandmarker(lm);
      } catch (error) {
        console.error("Failed to load MediaPipe:", error);
      }
    };
    initMediaPipe();
  }, [phase1Progress]);

  // Phase 2 calculation (MediaPipe + Textures)
  useEffect(() => {
    if (phase1Progress < 100) return;
    
    // MediaPipe counts for 40%, Textures count for 60%
    const mlContribution = landmarker ? 40 : 0;
    const texContribution = (textureProgress / 100) * 60;
    setPhase2Progress(mlContribution + texContribution);
  }, [landmarker, textureProgress, phase1Progress]);

  const targetHandPosRef = useRef({ x: 0, y: 0, z: 0 });
  const smoothedHandPosRef = useRef({ x: 0, y: 0, z: 0 });
  const cursorRef = useRef<HTMLDivElement>(null);
  
  const [isGrabbing, setIsGrabbing] = useState(false);
  const [isMobilePortrait, setIsMobilePortrait] = useState(false);
  const [isInstructionsOpen, setIsInstructionsOpen] = useState(true);

  useEffect(() => {
    const checkOrientation = () => {
      setIsMobilePortrait(window.innerHeight > window.innerWidth && window.innerWidth < 768);
    };
    window.addEventListener('resize', checkOrientation);
    checkOrientation();
    return () => window.removeEventListener('resize', checkOrientation);
  }, []);

  const handleStart = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" } 
      });
      setCameraStream(stream);
      setHasStarted(true);
    } catch (err) {
      alert("无法访问摄像头。请确保授予权限。");
    }
  };

  useEffect(() => {
    let rAF = 0;
    const loop = () => {
      const target = targetHandPosRef.current;
      const current = smoothedHandPosRef.current;
      current.x += (target.x - current.x) * 0.15;
      current.y += (target.y - current.y) * 0.15;
      current.z += (target.z - current.z) * 0.15;

      if (cursorRef.current) {
        const left = (current.x + 1) * 50;
        const top = (-current.y + 1) * 50;
        cursorRef.current.style.left = `${left}%`;
        cursorRef.current.style.top = `${top}%`;
        cursorRef.current.style.opacity = (Math.abs(current.x) < 0.001) ? '0' : '1';
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
      setMagicMessage(randomMsg);
      setTimeout(() => setMagicMessage(""), 5000);
    }
  }, []);

  const handleHandMove = useCallback((x: number, y: number, z: number) => {
    targetHandPosRef.current = { x, y, z };
  }, []);

  const handleGrab = useCallback((grab: boolean) => {
    setIsGrabbing(grab);
    if (!grab && appState === AppState.PHOTO_VIEW) setAppState(AppState.SCATTERED);
  }, [appState]);

  if (isMobilePortrait) {
    return (
      <div className="w-full h-full bg-black flex flex-col items-center justify-center p-8 text-center text-white">
        <h1 className="text-2xl font-serif text-amber-400 mb-4">请横屏使用</h1>
        <p className="text-gray-400">为了魔法的最佳施展效果，请旋转您的设备。</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full relative font-sans text-white bg-black">
      <LoadingScreen 
        isReady={!!landmarker && textureProgress >= 100} 
        onStart={handleStart}
        phase1Progress={phase1Progress}
        phase2Progress={phase2Progress}
        hasStarted={hasStarted}
      />

      <Scene 
        appState={appState} 
        photos={photos} 
        handPosRef={smoothedHandPosRef}
        isGrabbing={isGrabbing}
        onPhotoSelect={() => appState === AppState.SCATTERED && setAppState(AppState.PHOTO_VIEW)}
      />

      {cameraStream && landmarker && (
        <HandController 
          cameraStream={cameraStream} landmarker={landmarker}
          onStateChange={handleStateChange} onHandMove={handleHandMove} onGrab={handleGrab}
        />
      )}

      <div className={`absolute top-1/4 left-0 w-full flex justify-center pointer-events-none transition-opacity duration-1000 ${magicMessage ? 'opacity-100' : 'opacity-0'}`}>
        <h2 className="text-3xl md:text-5xl font-serif text-amber-300 drop-shadow-[0_0_15px_rgba(255,215,0,0.6)] animate-pulse">
          {magicMessage}
        </h2>
      </div>

      {hasStarted && (
        <div className="absolute bottom-8 left-8 bg-black/40 backdrop-blur-xl rounded-none border-l-2 border-amber-500/50 p-6 max-w-sm pointer-events-auto animate-fade-in">
           <h3 className="text-amber-400 font-bold uppercase text-[10px] tracking-widest mb-4">手势指南 / GESTURE GUIDE</h3>
           <div className="space-y-4 text-xs font-light tracking-wide">
                <div className={`flex items-center gap-4 ${appState === AppState.TREE ? 'text-amber-400' : 'text-gray-500'}`}>
                  <span className="text-lg">✊</span>
                  <span><b className="text-white">握拳:</b> 聚拢圣诞树</span>
                </div>
                <div className={`flex items-center gap-4 ${appState === AppState.SCATTERED ? 'text-amber-400' : 'text-gray-500'}`}>
                  <span className="text-lg">🖐</span>
                  <span><b className="text-white">张开:</b> 释放魔法粒子</span>
                </div>
                <div className={`flex items-center gap-4 ${appState === AppState.PHOTO_VIEW ? 'text-amber-400' : 'text-gray-500'}`}>
                  <span className="text-lg">👌</span>
                  <span><b className="text-white">捏合:</b> 捕捉浮动记忆</span>
                </div>
           </div>
        </div>
      )}

      <div 
        ref={cursorRef}
        className={`absolute w-8 h-8 rounded-full border border-amber-400/50 transition-transform duration-75 pointer-events-none transform -translate-x-1/2 -translate-y-1/2 shadow-[0_0_20px_rgba(255,215,0,0.3)] z-40 flex items-center justify-center ${isGrabbing ? 'scale-75 bg-amber-400/20' : 'scale-100'}`}
        style={{ left: '50%', top: '50%', opacity: 0, willChange: 'left, top' }}
      >
        <div className="w-1 h-1 bg-amber-400 rounded-full animate-ping"></div>
      </div>
    </div>
  );
}

export default App;
