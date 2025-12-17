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

// Local "Magic" Messages to replace AI
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
  loadingProgress,
  hasStarted
}: { 
  isReady: boolean; 
  onStart: () => void; 
  loadingProgress: number;
  hasStarted: boolean;
}) => {
  const [displayProgress, setDisplayProgress] = useState(0);
  const progressRef = useRef(0);

  // Sync ref with prop
  useEffect(() => {
    progressRef.current = loadingProgress;
  }, [loadingProgress]);

  // Smooth progress interpolation loop
  useEffect(() => {
    let animFrame: number;
    const update = () => {
      setDisplayProgress(prev => {
        const target = progressRef.current;
        const diff = target - prev;
        
        // If we are very close, snap (unless target is increasing significantly)
        if (Math.abs(diff) < 0.1 && target >= prev) return target;
        
        // Smooth lerp: 0.08 provides a nice weight
        return prev + diff * 0.08;
      });
      animFrame = requestAnimationFrame(update);
    };
    update();
    return () => cancelAnimationFrame(animFrame);
  }, []);

  // Ensure we don't show the button until the visual progress catches up
  const showStartButton = isReady && displayProgress > 99;

  // If we have started, fade out
  if (hasStarted) {
    return null;
  }

  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black text-white p-8 text-center bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-gray-900 to-black">
      <h1 className="text-5xl font-serif text-amber-400 mb-6 drop-shadow-[0_0_15px_rgba(255,215,0,0.6)] animate-fade-in-up">
        圣诞手势魔法
      </h1>
      
      {!showStartButton ? (
        <div className="w-full max-w-md flex flex-col items-center">
          <p className="text-amber-500/80 text-xs font-mono tracking-widest uppercase mb-4 animate-pulse">
            正在加载资源... {Math.round(displayProgress)}%
          </p>
          <div className="w-64 h-1 bg-gray-800 rounded-full overflow-hidden relative">
            <div 
              className="h-full bg-amber-500 shadow-[0_0_15px_#f59e0b] transition-all duration-75 ease-out"
              style={{ width: `${displayProgress}%` }}
            />
          </div>
          <p className="text-gray-600 text-[10px] mt-4 font-mono">
            {displayProgress < 50 ? "初始化AI模型..." : "加载3D场景纹理..."}
          </p>
        </div>
      ) : (
        <div className="animate-fade-in">
           <p className="text-gray-300 mb-12 max-w-md leading-relaxed">
            资源加载完成。<br/>
            挥手成林，捏合取景。<br/>
            点击下方按钮开启体验。
          </p>
          <button 
            onClick={onStart}
            className="group relative px-10 py-4 bg-transparent border border-amber-500/50 rounded-full overflow-hidden transition-all hover:border-amber-400 hover:shadow-[0_0_30px_rgba(255,215,0,0.4)] active:scale-95"
          >
            <div className="absolute inset-0 bg-amber-500/10 group-hover:bg-amber-500/20 transition-all"></div>
            <span className="relative text-amber-400 font-bold tracking-widest uppercase text-sm flex items-center gap-2">
              开启魔法
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
  
  // App Logic State
  const [hasStarted, setHasStarted] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [landmarker, setLandmarker] = useState<HandLandmarker | null>(null);
  
  // Message State
  const [magicMessage, setMagicMessage] = useState<string>("");
  
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

  // Initialize MediaPipe immediately on mount
  useEffect(() => {
    const initMediaPipe = async () => {
      try {
        // Use local assets downloaded during build
        const vision = await FilesetResolver.forVisionTasks(
          "/models/wasm"
        );
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
  }, []);

  // Calculate Total Load Progress
  const [simulatedMlProgress, setSimulatedMlProgress] = useState(0);

  useEffect(() => {
    if (!landmarker) {
      // Faster, smoother updates for the simulated part
      const interval = setInterval(() => {
        setSimulatedMlProgress(prev => Math.min(prev + 0.5, 45));
      }, 20);
      return () => clearInterval(interval);
    } else {
      setSimulatedMlProgress(50);
    }
  }, [landmarker]);

  // Combine progresses
  const totalProgress = simulatedMlProgress + (textureProgress * 0.5);
  const isReady = !!landmarker && textureProgress >= 100;

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
  const handleStart = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: "user" 
        } 
      });
      setCameraStream(stream);
      setHasStarted(true);
    } catch (err) {
      console.error("Camera permission failed:", err);
      alert("无法访问摄像头。请确保您已在浏览器设置中授予权限。");
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
    
    // Trigger local "Magic Message" when scattered
    if (newState === AppState.SCATTERED) {
      const randomMsg = MAGIC_MESSAGES[Math.floor(Math.random() * MAGIC_MESSAGES.length)];
      setMagicMessage(randomMsg);
      // Clear message after 5 seconds
      setTimeout(() => setMagicMessage(""), 5000);
    }
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
        isReady={isReady} 
        onStart={handleStart}
        loadingProgress={totalProgress}
        hasStarted={hasStarted}
      />

      {/* 3D Scene Layer */}
      <Scene 
        appState={appState} 
        photos={photos} 
        handPosRef={smoothedHandPosRef}
        isGrabbing={isGrabbing}
        onPhotoSelect={handlePhotoSelect}
      />

      {/* Hand Tracking Layer - Active when stream & model are ready */}
      {cameraStream && landmarker && (
        <HandController 
          cameraStream={cameraStream}
          landmarker={landmarker}
          onStateChange={handleStateChange}
          onHandMove={handleHandMove}
          onGrab={handleGrab}
        />
      )}

      {/* Magic Message Overlay */}
      <div className={`absolute top-1/4 left-0 w-full flex justify-center pointer-events-none transition-opacity duration-1000 ${magicMessage ? 'opacity-100' : 'opacity-0'}`}>
         <div className="max-w-3xl text-center px-6">
            <h2 className="text-3xl md:text-5xl font-serif text-amber-300 text-shadow-glow animate-pulse leading-normal">
              {magicMessage}
            </h2>
         </div>
      </div>

      {/* UI Overlay - Only show when started */}
      {hasStarted && (
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
                  <span><span className="text-white">张开五指:</span> 释放魔法祝语</span>
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