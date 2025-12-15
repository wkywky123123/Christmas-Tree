import React, { useState, useCallback, useEffect, useRef, Suspense } from 'react';
import { useProgress } from '@react-three/drei';
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

// --- LOADING SCREEN COMPONENT ---
const LoadingScreen = ({ 
  started, 
  onStart, 
  mlLoaded, 
  textureProgress 
}: { 
  started: boolean; 
  onStart: () => void; 
  mlLoaded: boolean;
  textureProgress: number;
}) => {
  const [dots, setDots] = useState('');

  // Total Progress Calculation: 
  // We give MediaPipe initialization 30% weight, and Textures 70% weight (or wait for both)
  // Simple logic: If ML not loaded, cap at 90%. When everything ready, 100%.
  
  const totalProgress = Math.min(
    (mlLoaded ? 30 : 10) + (textureProgress * 0.7),
    mlLoaded && textureProgress >= 100 ? 100 : 95
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => prev.length >= 3 ? '' : prev + '.');
    }, 500);
    return () => clearInterval(interval);
  }, []);

  if (!started) {
    return (
      <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black text-white p-8 text-center bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-gray-900 to-black">
        <h1 className="text-5xl font-serif text-amber-400 mb-6 drop-shadow-[0_0_15px_rgba(255,215,0,0.6)]">
          圣诞手势魔法
        </h1>
        <p className="text-gray-300 mb-12 max-w-md leading-relaxed">
          挥手成林，捏合取景。<br/>请允许使用摄像头以开启魔法体验。
        </p>
        <button 
          onClick={onStart}
          className="group relative px-8 py-4 bg-transparent border border-amber-500/50 rounded-full overflow-hidden transition-all hover:border-amber-400 hover:shadow-[0_0_30px_rgba(255,215,0,0.3)]"
        >
          <div className="absolute inset-0 bg-amber-500/10 group-hover:bg-amber-500/20 transition-all"></div>
          <span className="relative text-amber-400 font-bold tracking-widest uppercase text-sm flex items-center gap-2">
            开启体验 {dots}
          </span>
        </button>
      </div>
    );
  }

  // Loading State
  return (
    <div className={`absolute inset-0 z-50 flex flex-col items-center justify-center bg-black transition-opacity duration-1000 ${totalProgress >= 100 ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
      <div className="w-64 mb-4">
        <div className="h-1 w-full bg-gray-800 rounded-full overflow-hidden">
          <div 
            className="h-full bg-amber-500 transition-all duration-300 ease-out box-shadow-[0_0_10px_#f59e0b]"
            style={{ width: `${totalProgress}%` }}
          />
        </div>
      </div>
      <p className="text-amber-500/80 text-xs font-mono tracking-widest uppercase">
        Loading Assets... {Math.round(totalProgress)}%
      </p>
      <p className="text-gray-600 text-[10px] mt-2">
        {!mlLoaded ? "正在初始化手势识别模型..." : "正在加载3D场景..."}
      </p>
    </div>
  );
};

function App() {
  const [appState, setAppState] = useState<AppState>(AppState.TREE);
  const [photos] = useState<string[]>(DEFAULT_PHOTOS);
  
  // App Logic State
  const [hasStarted, setHasStarted] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [mlLoaded, setMlLoaded] = useState(false);
  
  // 3D Loading Progress
  const { progress: textureProgress } = useProgress();

  // RAW Data from MediaPipe (updates at ~30fps)
  const targetHandPosRef = useRef({ x: 0, y: 0, z: 0 });
  // SMOOTHED Data for Rendering
  const smoothedHandPosRef = useRef({ x: 0, y: 0, z: 0 });
  const cursorRef = useRef<HTMLDivElement>(null);
  
  const [isGrabbing, setIsGrabbing] = useState(false);
  const [isMobilePortrait, setIsMobilePortrait] = useState(false);
  const [isInstructionsOpen, setIsInstructionsOpen] = useState(true);

  // Check screen size
  useEffect(() => {
    const checkOrientation = () => {
      const isPortrait = window.innerHeight > window.innerWidth;
      const isNarrow = window.innerWidth < 768;
      setIsMobilePortrait(isNarrow && isPortrait);
    };
    window.addEventListener('resize', checkOrientation);
    checkOrientation();
    return () => window.removeEventListener('resize', checkOrientation);
  }, []);

  // --- START HANDLER ---
  // This MUST be called by a user interaction (click) to satisfy mobile browser policies
  const handleStart = async () => {
    try {
      setHasStarted(true);
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: "user" 
        } 
      });
      setCameraStream(stream);
    } catch (err) {
      console.error("Camera permission failed:", err);
      alert("无法访问摄像头。请确保您已在浏览器设置中授予权限。");
      setHasStarted(false);
    }
  };

  // --- SMOOTHING LOOP ---
  useEffect(() => {
    let rAF = 0;
    const loop = () => {
      const target = targetHandPosRef.current;
      const current = smoothedHandPosRef.current;
      const lerpFactor = 0.15;

      current.x += (target.x - current.x) * lerpFactor;
      current.y += (target.y - current.y) * lerpFactor;
      current.z += (target.z - current.z) * lerpFactor;

      if (cursorRef.current) {
        const cursor = cursorRef.current;
        const left = (current.x + 1) * 50;
        const top = (-current.y + 1) * 50;
        cursor.style.left = `${left}%`;
        cursor.style.top = `${top}%`;
        
        const isCenter = Math.abs(current.x) < 0.001 && Math.abs(current.y) < 0.001;
        cursor.style.opacity = isCenter ? '0' : '1';
      }
      rAF = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(rAF);
  }, []);

  // Handlers
  const handleStateChange = useCallback((newState: AppState) => {
    setAppState(newState);
  }, []);

  const handleHandMove = useCallback((x: number, y: number, z: number) => {
    targetHandPosRef.current = { x, y, z };
  }, []);

  const handleGrab = useCallback((grab: boolean) => {
    setIsGrabbing(grab);
    if (!grab && appState === AppState.PHOTO_VIEW) {
       setAppState(AppState.SCATTERED);
    }
  }, [appState]);

  const handlePhotoSelect = (index: number) => {
    if (appState === AppState.SCATTERED) {
      setAppState(AppState.PHOTO_VIEW);
    }
  };

  if (isMobilePortrait) {
    return (
      <div className="w-full h-full bg-black flex flex-col items-center justify-center p-8 text-center">
        <div className="w-16 h-16 border-2 border-amber-500 rounded-lg mb-6 animate-pulse flex items-center justify-center">
           <div className="w-12 h-0.5 bg-amber-500 transform rotate-90"></div>
        </div>
        <h1 className="text-2xl font-serif text-amber-400 mb-4">请旋转屏幕</h1>
        <p className="text-gray-300">为了获得最佳的3D手势体验，<br/>建议横屏使用或使用宽屏设备（电脑/平板）。</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full relative font-sans text-white">
      {/* LOADING & ENTRY OVERLAY */}
      <LoadingScreen 
        started={hasStarted} 
        onStart={handleStart}
        mlLoaded={mlLoaded}
        textureProgress={textureProgress}
      />

      {/* 3D Scene Layer */}
      <Scene 
        appState={appState} 
        photos={photos} 
        handPosRef={smoothedHandPosRef}
        isGrabbing={isGrabbing}
        onPhotoSelect={handlePhotoSelect}
      />

      {/* Hand Tracking Layer - Only active when stream is ready */}
      {cameraStream && (
        <HandController 
          cameraStream={cameraStream}
          onStateChange={handleStateChange}
          onHandMove={handleHandMove}
          onGrab={handleGrab}
          onMlLoaded={() => setMlLoaded(true)}
        />
      )}

      {/* UI Overlay - Only show when loaded */}
      {mlLoaded && textureProgress >= 100 && (
        <>
          <div className="absolute top-0 left-0 p-6 pointer-events-none w-full flex justify-between animate-fade-in">
            <div>
              <h1 className="text-4xl font-serif text-amber-400 tracking-wider drop-shadow-[0_0_10px_rgba(255,215,0,0.5)]">
                圣诞手势魔法
              </h1>
              <p className="text-sm text-gray-300 mt-2 opacity-80 max-w-md">
                挥手成林，捏合取景。
              </p>
            </div>
          </div>

          <div className="absolute bottom-8 left-8 bg-black/40 backdrop-blur-md rounded-xl border border-white/10 max-w-sm pointer-events-auto transition-all duration-300 overflow-hidden">
            <div 
              onClick={() => setIsInstructionsOpen(!isInstructionsOpen)}
              className="p-4 flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors"
            >
              <h3 className="text-amber-400 font-bold uppercase text-xs tracking-widest flex items-center gap-2">
                手势指南
                <span className={`text-[10px] text-gray-500 transition-transform duration-300 ${isInstructionsOpen ? 'rotate-180' : ''}`}>▼</span>
              </h3>
            </div>
            
            <div className={`transition-all duration-300 ease-in-out ${isInstructionsOpen ? 'max-h-64 opacity-100' : 'max-h-0 opacity-0'}`}>
              <div className="px-6 pb-6 pt-0 space-y-3 text-sm">
                <div className={`flex items-center gap-3 ${appState === AppState.TREE ? 'text-green-400 font-bold' : 'text-gray-400'}`}>
                  <div className="w-6 h-6 rounded-full border border-current flex items-center justify-center">✊</div>
                  <span><span className="text-white">握拳:</span> 聚合圣诞树</span>
                </div>
                <div className={`flex items-center gap-3 ${appState === AppState.SCATTERED ? 'text-green-400 font-bold' : 'text-gray-400'}`}>
                  <div className="w-6 h-6 rounded-full border border-current flex items-center justify-center">🖐</div>
                  <span><span className="text-white">张开五指:</span> 打散粒子 / 旋转视角</span>
                </div>
                <div className={`flex items-center gap-3 ${appState === AppState.PHOTO_VIEW ? 'text-green-400 font-bold' : 'text-gray-400'}`}>
                  <div className="w-6 h-6 rounded-full border border-current flex items-center justify-center">👌</div>
                  <span><span className="text-white">捏合:</span> 抓取并放大照片</span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Cursor Follower */}
      <div 
        ref={cursorRef}
        className={`absolute w-8 h-8 rounded-full border-2 border-amber-400 transition-transform duration-75 pointer-events-none transform -translate-x-1/2 -translate-y-1/2 shadow-[0_0_15px_rgba(255,215,0,0.8)] z-40 flex items-center justify-center ${isGrabbing ? 'scale-75 bg-amber-400/50' : 'scale-100'}`}
        style={{ 
          left: '50%', 
          top: '50%',
          opacity: 0,
          willChange: 'left, top'
        }}
      >
        <div className="w-1 h-1 bg-white rounded-full"></div>
      </div>
    </div>
  );
}

export default App;