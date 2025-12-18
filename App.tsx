
import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useProgress } from '@react-three/drei';
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import { Scene } from './components/Scene';
import { HandController } from './components/HandController';
import { Onboarding } from './components/Onboarding';
import { AppState } from './types';
import { getCookie, setCookie } from './utils/cookies';

// 使用不同比例的测试图：包含 1:1, 16:9, 3:4 等
const INITIAL_PHOTOS = [
  "https://picsum.photos/id/1018/800/450", // 16:9
  "https://picsum.photos/id/1015/600/800", // 3:4
  "https://picsum.photos/id/1019/1000/1000", // 1:1
  "https://picsum.photos/id/1020/800/600", // 4:3
  "https://picsum.photos/id/1021/400/800", // 1:2
  "https://picsum.photos/id/1022/800/400", // 2:1
  "https://picsum.photos/id/1025/600/600", // 1:1
  "/1.png",
  "https://picsum.photos/id/1035/800/533"  // 3:2
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

const LoadingScreen = ({ 
  isReady, 
  onStart, 
  phase1Progress,
  phase2Data,
  hasStarted
}: { 
  isReady: boolean; 
  onStart: () => void; 
  phase1Progress: number;
  phase2Data: { progress: number; loaded: number; total: number; item: string };
  hasStarted: boolean;
}) => {
  const [activePhase, setActivePhase] = useState(1);
  const [transitioning, setTransitioning] = useState(false);
  const [smoothProgress, setSmoothProgress] = useState(0);

  useEffect(() => {
    let frame: number;
    const target = activePhase === 1 ? phase1Progress : phase2Data.progress;
    const update = () => {
      setSmoothProgress(prev => {
        const diff = target - prev;
        if (Math.abs(diff) < 0.01) return target;
        return prev + diff * 0.1;
      });
      frame = requestAnimationFrame(update);
    };
    frame = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frame);
  }, [phase1Progress, phase2Data.progress, activePhase]);

  useEffect(() => {
    if (phase1Progress >= 99.9 && activePhase === 1 && !transitioning) {
      setTransitioning(true);
      setTimeout(() => {
        setActivePhase(2);
        setSmoothProgress(0);
        setTransitioning(false);
      }, 800);
    }
  }, [phase1Progress, activePhase, transitioning]);

  if (hasStarted) return null;

  const isComplete = isReady && phase2Data.progress >= 100;
  const estimatedBytes = (phase2Data.progress / 100 * phase2Data.total * 1.2).toFixed(1);

  return (
    <div className="absolute inset-0 z-[100] flex flex-col items-center justify-center bg-black text-white p-8 text-center bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-indigo-950/30 via-black to-black">
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-30">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-amber-500/10 blur-[120px] rounded-full animate-pulse" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-red-500/10 blur-[120px] rounded-full animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      <div className="relative z-10 flex flex-col items-center w-full max-w-md">
        <div className="mb-2 overflow-hidden">
          <h1 className="text-5xl md:text-6xl font-serif text-transparent bg-clip-text bg-gradient-to-b from-amber-200 to-amber-500 drop-shadow-[0_0_20px_rgba(255,215,0,0.3)] animate-reveal">
            魔法圣诞树
          </h1>
        </div>
        <p className="text-amber-500/40 font-mono text-[9px] tracking-[0.4em] uppercase mb-16 opacity-0 animate-fade-in" style={{ animationDelay: '0.5s' }}>
          Real-time Computer Vision Experience
        </p>
        
        <div className="relative w-full h-40 flex items-center justify-center">
          <div className={`absolute w-full transition-all duration-700 ${activePhase === 1 && !transitioning ? 'opacity-100' : 'opacity-0 -translate-y-8 pointer-events-none'}`}>
            <div className="flex justify-between items-end mb-3">
              <span className="text-[10px] font-mono text-amber-400 tracking-widest uppercase">● [01] 初始化核心引擎</span>
              <span className="text-[10px] font-mono text-gray-500">{smoothProgress.toFixed(1)}%</span>
            </div>
            <div className="h-[2px] w-full bg-white/5 rounded-full overflow-hidden mb-2">
               <div className="h-full bg-gradient-to-r from-amber-600 to-amber-400" style={{ width: `${smoothProgress}%` }} />
            </div>
          </div>

          <div className={`absolute w-full transition-all duration-700 ${activePhase === 2 && !isComplete ? 'opacity-100' : 'opacity-0 translate-y-8 pointer-events-none'}`}>
            <div className="flex justify-between items-end mb-3">
              <span className="text-[10px] font-mono text-amber-400 tracking-widest uppercase animate-pulse">● [02] 加载视觉资产</span>
              <span className="text-[10px] font-mono text-gray-500">{smoothProgress.toFixed(1)}%</span>
            </div>
            <div className="h-[2px] w-full bg-white/5 rounded-full overflow-hidden mb-3">
               <div className="h-full bg-gradient-to-r from-amber-500 via-white to-amber-300" style={{ width: `${smoothProgress}%` }} />
            </div>
            <div className="flex justify-between text-[9px] font-mono text-gray-500">
               <div className="truncate w-2/3 text-left">FILE: {phase2Data.item || 'SYNCING...'}</div>
               <div>{phase2Data.loaded}/{phase2Data.total} ({estimatedBytes}MB)</div>
            </div>
          </div>

          <div className={`absolute flex flex-col items-center transition-all duration-1000 ${isComplete ? 'opacity-100 scale-100' : 'opacity-0 scale-90 pointer-events-none'}`}>
             <p className="text-amber-200/60 mb-8 text-[11px] font-light tracking-[0.2em] uppercase italic">Magic is synchronized</p>
            <button onClick={onStart} className="group relative px-16 py-4 bg-transparent border border-amber-500/20 hover:border-amber-400 hover:shadow-[0_0_40px_rgba(255,215,0,0.2)] active:scale-95 transition-all">
              <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-amber-400"></div>
              <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-amber-400"></div>
              <span className="text-amber-400 font-bold tracking-[0.6em] uppercase text-[10px]">开启魔法</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

function App() {
  const [appState, setAppState] = useState<AppState>(AppState.TREE);
  const [photos] = useState<string[]>(INITIAL_PHOTOS); 
  const [hasStarted, setHasStarted] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [landmarker, setLandmarker] = useState<HandLandmarker | null>(null);
  const [magicMessage, setMagicMessage] = useState<string>("");
  
  const { progress: textureProgress, loaded, total, item } = useProgress();
  const [phase1Progress, setPhase1Progress] = useState(0);

  useEffect(() => {
    let current = 0;
    const interval = setInterval(() => {
      const step = Math.max(0.2, (100 - current) * 0.08);
      current += Math.random() * step;
      if (current >= 100) {
        setPhase1Progress(100);
        clearInterval(interval);
      } else {
        setPhase1Progress(current);
      }
    }, 40);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (phase1Progress < 100) return;
    const initMediaPipe = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks("/models/wasm");
        const lm = await HandLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: "/models/hand_landmarker.task", delegate: "GPU" },
          runningMode: "VIDEO",
          numHands: 1
        });
        setLandmarker(lm);
      } catch (error) { console.error("MediaPipe load error:", error); }
    };
    initMediaPipe();
  }, [phase1Progress]);

  const phase2ProgressValue = useMemo(() => {
    if (phase1Progress < 100) return 0;
    const mlWeight = landmarker ? 30 : 0;
    const texWeight = (textureProgress / 100) * 70;
    return Math.min(100, mlWeight + texWeight);
  }, [landmarker, textureProgress, phase1Progress]);

  const targetHandPosRef = useRef({ x: 0, y: 0, z: 0 });
  const smoothedHandPosRef = useRef({ x: 0, y: 0, z: 0 });
  const cursorRef = useRef<HTMLDivElement>(null);
  const [isGrabbing, setIsGrabbing] = useState(false);
  const [isMobilePortrait, setIsMobilePortrait] = useState(false);

  useEffect(() => {
    const checkOrientation = () => setIsMobilePortrait(window.innerHeight > window.innerWidth && window.innerWidth < 768);
    window.addEventListener('resize', checkOrientation);
    checkOrientation();
    return () => window.removeEventListener('resize', checkOrientation);
  }, []);

  const handleStart = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      setCameraStream(stream);
      getCookie('magic_onboarding_seen') ? setHasStarted(true) : setShowOnboarding(true);
    } catch (err) { alert("摄像头授权失败"); }
  };

  const handleOnboardingComplete = () => {
    setCookie('magic_onboarding_seen', 'true', 365);
    setShowOnboarding(false);
    setHasStarted(true);
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
        cursorRef.current.style.left = `${(current.x + 1) * 50}%`;
        cursorRef.current.style.top = `${(-current.y + 1) * 50}%`;
        cursorRef.current.style.opacity = Math.abs(current.x) < 0.001 ? '0' : '1';
      }
      rAF = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(rAF);
  }, []);

  const handleStateChange = useCallback((newState: AppState) => {
    setAppState(newState);
    if (newState === AppState.SCATTERED) {
      setMagicMessage(MAGIC_MESSAGES[Math.floor(Math.random() * MAGIC_MESSAGES.length)]);
      setTimeout(() => setMagicMessage(""), 5000);
    }
  }, []);

  return (
    <div className="w-full h-full relative font-sans text-white bg-black">
      <LoadingScreen 
        isReady={!!landmarker && textureProgress >= 100} 
        onStart={handleStart}
        phase1Progress={phase1Progress}
        phase2Data={{ progress: phase2ProgressValue, loaded, total, item }}
        hasStarted={hasStarted || showOnboarding}
      />
      {showOnboarding && <Onboarding onComplete={handleOnboardingComplete} />}
      {hasStarted && (
        <div className="absolute top-12 left-0 w-full flex flex-col items-center pointer-events-none z-10">
           <h1 className="text-4xl font-serif text-transparent bg-clip-text bg-gradient-to-b from-amber-200/80 to-amber-500/80 tracking-widest drop-shadow-[0_0_15px_rgba(255,215,0,0.2)] animate-fade-in">魔法圣诞树</h1>
           <div className="w-12 h-[1px] bg-amber-500/30 mt-2"></div>
        </div>
      )}
      <Scene 
        appState={appState} photos={photos} handPosRef={smoothedHandPosRef}
        isGrabbing={isGrabbing} onPhotoSelect={() => appState === AppState.SCATTERED && setAppState(AppState.PHOTO_VIEW)}
      />
      {cameraStream && landmarker && hasStarted && (
        <HandController 
          cameraStream={cameraStream} landmarker={landmarker}
          onStateChange={handleStateChange} onHandMove={(x,y,z) => targetHandPosRef.current = {x,y,z}} onGrab={(g) => {setIsGrabbing(g); if(!g && appState === AppState.PHOTO_VIEW) setAppState(AppState.SCATTERED)}}
        />
      )}
      <div className={`absolute top-1/3 left-0 w-full flex justify-center pointer-events-none transition-all duration-1000 ${magicMessage ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
        <h2 className="text-2xl md:text-4xl font-serif text-amber-200 drop-shadow-[0_0_15px_rgba(255,215,0,0.5)] italic">{magicMessage}</h2>
      </div>
      {hasStarted && (
        <div className="absolute bottom-8 left-8 bg-black/40 backdrop-blur-xl border-l-2 border-amber-500/50 p-6 max-w-sm animate-fade-in">
           <h3 className="text-amber-400 font-bold uppercase text-[10px] tracking-widest mb-4">手势指南</h3>
           <div className="space-y-4 text-xs font-light">
                <div className={`flex items-center gap-4 ${appState === AppState.TREE ? 'text-amber-400' : 'text-gray-500'}`}><span>✊</span><span><b>握拳:</b> 聚拢圣诞树</span></div>
                <div className={`flex items-center gap-4 ${appState === AppState.SCATTERED ? 'text-amber-400' : 'text-gray-500'}`}><span>🖐</span><span><b>张开:</b> 释放魔法粒子</span></div>
                <div className={`flex items-center gap-4 ${appState === AppState.PHOTO_VIEW ? 'text-amber-400' : 'text-gray-500'}`}><span>👌</span><span><b>捏合:</b> 捕捉浮动记忆</span></div>
           </div>
        </div>
      )}
      <div ref={cursorRef} className={`fixed w-8 h-8 rounded-full border border-amber-400/50 pointer-events-none transform -translate-x-1/2 -translate-y-1/2 z-40 transition-transform ${isGrabbing ? 'scale-75 bg-amber-400/20' : 'scale-100'}`} style={{ opacity: 0 }}><div className="w-1 h-1 bg-amber-400 rounded-full m-auto mt-[14px] animate-ping"></div></div>
    </div>
  );
}

export default App;
