
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useProgress } from '@react-three/drei';
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import { Scene } from './components/Scene';
import { HandController } from './components/HandController';
import { Onboarding } from './components/Onboarding';
import { AppState } from './types';
import { getCookie, setCookie } from './utils/cookies';

const INITIAL_PHOTOS = [
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
  const [activePhase, setActivePhase] = useState(1);
  const [transitioning, setTransitioning] = useState(false);

  useEffect(() => {
    if (phase1Progress >= 99.9 && activePhase === 1 && !transitioning) {
      setTransitioning(true);
      setTimeout(() => {
        setActivePhase(2);
        setTransitioning(false);
      }, 800);
    }
  }, [phase1Progress, activePhase, transitioning]);

  if (hasStarted) return null;

  const isComplete = isReady && phase2Progress > 99;

  return (
    <div className="absolute inset-0 z-[100] flex flex-col items-center justify-center bg-black text-white p-8 text-center bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-indigo-950/20 via-black to-black">
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-30">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-amber-500/10 blur-[120px] rounded-full animate-pulse" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-red-500/10 blur-[120px] rounded-full animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      <div className="relative z-10 flex flex-col items-center w-full max-w-md">
        <h1 className="text-5xl md:text-6xl font-serif text-transparent bg-clip-text bg-gradient-to-b from-amber-200 to-amber-500 mb-2 drop-shadow-[0_0_20px_rgba(255,215,0,0.3)]">
          圣诞魔法
        </h1>
        <p className="text-amber-500/40 font-mono text-[10px] tracking-[0.3em] uppercase mb-16">Hand Gesture Magic Experience</p>
        
        <div className="relative w-full h-32 flex items-center justify-center overflow-hidden">
          <div 
            className={`absolute w-full transition-all duration-700 ease-in-out ${
              activePhase === 1 && !transitioning 
                ? 'opacity-100 translate-y-0' 
                : 'opacity-0 -translate-y-8 pointer-events-none'
            }`}
          >
            <div className="flex justify-between items-end mb-3">
              <span className="text-[11px] font-mono text-amber-400 tracking-wider">
                ● PHASE I: 载入节日记忆
              </span>
              <span className="text-[11px] font-mono text-gray-500">{Math.round(phase1Progress)}%</span>
            </div>
            <div className="h-1 w-full bg-gray-900 rounded-full overflow-hidden">
               <div 
                 className="h-full bg-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.6)] transition-all duration-500 ease-out"
                 style={{ width: `${phase1Progress}%` }}
               />
            </div>
          </div>

          <div 
            className={`absolute w-full transition-all duration-700 ease-in-out ${
              activePhase === 2 && !isComplete
                ? 'opacity-100 translate-y-0' 
                : 'opacity-0 translate-y-8 pointer-events-none'
            }`}
          >
            <div className="flex justify-between items-end mb-3">
              <span className="text-[11px] font-mono text-amber-400 tracking-wider animate-pulse">
                ● PHASE II: 注入构筑魔法
              </span>
              <span className="text-[11px] font-mono text-gray-500">{Math.round(phase2Progress)}%</span>
            </div>
            <div className="h-1 w-full bg-gray-900 rounded-full overflow-hidden">
               <div 
                 className="h-full bg-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.7)] transition-all duration-500 ease-out"
                 style={{ width: `${phase2Progress}%` }}
               />
            </div>
          </div>

          <div 
            className={`absolute flex flex-col items-center transition-all duration-1000 ease-out ${
              isComplete ? 'opacity-100 scale-100' : 'opacity-0 scale-90 pointer-events-none'
            }`}
          >
             <p className="text-gray-400 mb-8 max-w-sm leading-loose text-sm font-light tracking-wide italic">
              “光影已就绪，魔法在指尖”
            </p>
            <button 
              onClick={onStart}
              className="group relative px-14 py-4 bg-transparent border border-amber-500/30 rounded-none overflow-hidden transition-all hover:border-amber-400 hover:shadow-[0_0_50px_rgba(255,215,0,0.25)] active:scale-95"
            >
              <div className="absolute inset-0 bg-amber-500/5 group-hover:bg-amber-500/10 transition-all"></div>
              <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-amber-500"></div>
              <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-amber-500"></div>
              <span className="relative text-amber-400 font-bold tracking-[0.5em] uppercase text-xs flex items-center gap-2">
                开启魔法
              </span>
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
  
  const { progress: textureProgress } = useProgress();
  const [phase1Progress, setPhase1Progress] = useState(0);
  const [phase2Progress, setPhase2Progress] = useState(0);

  useEffect(() => {
    let current = 0;
    const interval = setInterval(() => {
      const step = Math.max(0.5, (100 - current) * 0.05);
      current += Math.random() * step;
      if (current >= 100) {
        setPhase1Progress(100);
        clearInterval(interval);
      } else {
        setPhase1Progress(current);
      }
    }, 50);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (phase1Progress < 100) return;
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

  useEffect(() => {
    if (phase1Progress < 100) return;
    const mlContribution = landmarker ? 40 : (landmarker === null ? 0 : 20);
    const texContribution = (textureProgress / 100) * 60;
    setPhase2Progress(Math.min(100, mlContribution + texContribution));
  }, [landmarker, textureProgress, phase1Progress]);

  const targetHandPosRef = useRef({ x: 0, y: 0, z: 0 });
  const smoothedHandPosRef = useRef({ x: 0, y: 0, z: 0 });
  const cursorRef = useRef<HTMLDivElement>(null);
  const [isGrabbing, setIsGrabbing] = useState(false);
  const [isMobilePortrait, setIsMobilePortrait] = useState(false);

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

      // Check if user has seen onboarding
      const seenOnboarding = getCookie('magic_onboarding_seen');
      if (!seenOnboarding) {
        setShowOnboarding(true);
      } else {
        setHasStarted(true);
      }
    } catch (err) {
      alert("无法访问摄像头。请确保授予权限。");
    }
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
        hasStarted={hasStarted || showOnboarding}
      />

      {showOnboarding && <Onboarding onComplete={handleOnboardingComplete} />}

      {/* --- 主界面大标题 --- */}
      {hasStarted && (
        <div className="absolute top-12 left-0 w-full flex flex-col items-center pointer-events-none z-10 animate-fade-in">
           <h1 className="text-4xl font-serif text-transparent bg-clip-text bg-gradient-to-b from-amber-200/80 to-amber-500/80 tracking-widest drop-shadow-[0_0_15px_rgba(255,215,0,0.2)]">
            魔法圣诞树
          </h1>
          <div className="w-12 h-[1px] bg-amber-500/30 mt-2"></div>
        </div>
      )}

      <Scene 
        appState={appState} 
        photos={photos} 
        handPosRef={smoothedHandPosRef}
        isGrabbing={isGrabbing}
        onPhotoSelect={() => appState === AppState.SCATTERED && setAppState(AppState.PHOTO_VIEW)}
      />

      {cameraStream && landmarker && hasStarted && (
        <HandController 
          cameraStream={cameraStream} landmarker={landmarker}
          onStateChange={handleStateChange} onHandMove={handleHandMove} onGrab={handleGrab}
        />
      )}

      {/* --- 魔法祝福信息 --- */}
      <div className={`absolute top-1/3 left-0 w-full flex justify-center pointer-events-none transition-all duration-1000 ${magicMessage ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
        <h2 className="text-2xl md:text-4xl font-serif text-amber-200 drop-shadow-[0_0_15px_rgba(255,215,0,0.5)] italic">
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
