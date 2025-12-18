
import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useProgress } from '@react-three/drei';
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import { Scene } from './components/Scene';
import { HandController } from './components/HandController';
import { Onboarding } from './components/Onboarding';
import { AppState } from './types';
import { getCookie, setCookie } from './utils/cookies';

// 测试图片集：确保即便 1.png 加载失败，也会平滑跳过
const INITIAL_PHOTOS = [
  "/1.png",
  "/1.png",
  "/1.png"
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
  loadingItem,
  loadedCount,
  totalCount,
  hasStarted
}: { 
  isReady: boolean; 
  onStart: () => void; 
  phase1Progress: number;
  phase2Progress: number;
  loadingItem: string;
  loadedCount: number;
  totalCount: number;
  hasStarted: boolean;
}) => {
  const [activePhase, setActivePhase] = useState(1);
  const [smoothProgress, setSmoothProgress] = useState(0);

  // 核心逻辑：监听阶段切换
  useEffect(() => {
    if (phase1Progress >= 100 && activePhase === 1) {
      setTimeout(() => setActivePhase(2), 500);
    }
  }, [phase1Progress, activePhase]);

  // 平滑动画控制：确保进度条丝滑推进
  useEffect(() => {
    let frame: number;
    const target = activePhase === 1 ? phase1Progress : phase2Progress;
    
    const update = () => {
      setSmoothProgress(prev => {
        const diff = target - prev;
        if (Math.abs(diff) < 0.1) return target;
        const speed = activePhase === 2 ? 0.2 : 0.1;
        return prev + diff * speed;
      });
      frame = requestAnimationFrame(update);
    };
    frame = requestAnimationFrame(update);
    return () => cancelAnimationFrame(frame);
  }, [phase1Progress, phase2Progress, activePhase]);

  if (hasStarted) return null;

  const isComplete = isReady && smoothProgress >= 99.9;

  return (
    <div className="absolute inset-0 z-[100] flex flex-col items-center justify-center bg-black text-white p-8 text-center bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-indigo-950/30 via-black to-black">
      <div className="relative z-10 flex flex-col items-center w-full max-w-md">
        <h1 className="text-5xl md:text-6xl font-serif text-transparent bg-clip-text bg-gradient-to-b from-amber-200 to-amber-500 mb-2 animate-reveal">
          魔法圣诞树
        </h1>
        <p className="text-amber-500/40 font-mono text-[9px] tracking-[0.4em] uppercase mb-12">
          Real-time Computer Vision Experience
        </p>
        
        <div className="w-full space-y-8">
          <div className="relative">
            <div className="flex justify-between items-end mb-3">
              <span className="text-[10px] font-mono text-amber-400 tracking-widest uppercase">
                {activePhase === 1 ? "● [01] 引擎初始化" : "● [02] 视觉资产同步"}
              </span>
              <span className="text-[10px] font-mono text-gray-500">{smoothProgress.toFixed(1)}%</span>
            </div>
            <div className="h-[2px] w-full bg-white/5 rounded-full overflow-hidden">
               <div 
                 className="h-full bg-gradient-to-r from-amber-600 to-amber-300 transition-all duration-100 ease-out" 
                 style={{ width: `${smoothProgress}%` }} 
               />
            </div>
          </div>

          <div className="h-8 flex flex-col items-center justify-center">
            {activePhase === 2 && !isComplete && (
              <div className="text-[9px] font-mono text-gray-500 animate-fade-in truncate w-full">
                LOADING: {loadingItem || 'PREPARING ASSETS...'} ({loadedCount}/{totalCount})
              </div>
            )}
          </div>

          <div className="bg-amber-500/5 border border-amber-500/10 p-4 rounded-sm animate-fade-in">
             <p className="text-amber-200/60 text-[10px] leading-relaxed italic">
               温馨提示：首次加载需要同步魔法核心与高精度模型，可能需要 <span className="text-amber-400 font-bold">10分钟以上</span>，请保持页面开启，静待奇迹发生。
             </p>
          </div>

          <div className={`transition-all duration-1000 transform ${isComplete ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8 pointer-events-none'}`}>
            <button 
              onClick={onStart} 
              className="group relative px-16 py-4 bg-transparent border border-amber-500/20 hover:border-amber-400 hover:shadow-[0_0_40px_rgba(255,215,0,0.2)] active:scale-95 transition-all"
            >
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
      current += Math.random() * 2;
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
        const vision = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm");
        const lm = await HandLandmarker.createFromOptions(vision, {
          baseOptions: { 
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task", 
            delegate: "GPU" 
          },
          runningMode: "VIDEO",
          numHands: 1
        });
        setLandmarker(lm);
      } catch (error) { 
        console.error("MediaPipe load error:", error); 
      }
    };
    initMediaPipe();
  }, [phase1Progress]);

  const combinedPhase2Progress = useMemo(() => {
    const modelProgress = landmarker ? 100 : 0;
    return (textureProgress * 0.8) + (modelProgress * 0.2);
  }, [textureProgress, landmarker]);

  const targetHandPosRef = useRef({ x: 0, y: 0, z: 0 });
  const smoothedHandPosRef = useRef({ x: 0, y: 0, z: 0 });
  const cursorRef = useRef<HTMLDivElement>(null);
  const [isGrabbing, setIsGrabbing] = useState(false);

  const handleStart = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      setCameraStream(stream);
      getCookie('magic_onboarding_seen') ? setHasStarted(true) : setShowOnboarding(true);
    } catch (err) { 
      alert("请授权摄像头访问，以体验手势魔法。"); 
    }
  };

  const handleOnboardingComplete = () => {
    setCookie('magic_onboarding_seen', 'true', 365);
    setShowOnboarding(false);
    setHasStarted(true);
  };

  // 手势平滑插值及光标同步更新
  useEffect(() => {
    let rAF = 0;
    const loop = () => {
      const target = targetHandPosRef.current;
      const current = smoothedHandPosRef.current;
      
      // 平滑移动计算
      current.x += (target.x - current.x) * 0.15;
      current.y += (target.y - current.y) * 0.15;
      current.z += (target.z - current.z) * 0.15;

      // 重要：同步更新光标 DOM 元素的样式
      if (cursorRef.current) {
        // 将归一化坐标 (-1 到 1) 映射到屏幕百分比 (0 到 100)
        const left = (current.x + 1) * 50;
        const top = (-current.y + 1) * 50; // Y坐标通常需要反转

        cursorRef.current.style.left = `${left}%`;
        cursorRef.current.style.top = `${top}%`;
        
        // 只有当手部在视野内（非默认0点）时才显示光标
        const isVisible = Math.abs(current.x) > 0.001 || Math.abs(current.y) > 0.001;
        cursorRef.current.style.opacity = isVisible ? '1' : '0';
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
        phase2Progress={combinedPhase2Progress}
        loadingItem={item}
        loadedCount={loaded}
        totalCount={total}
        hasStarted={hasStarted || showOnboarding}
      />
      
      {showOnboarding && <Onboarding onComplete={handleOnboardingComplete} />}
      
      {hasStarted && (
        <div className="absolute top-12 left-0 w-full flex flex-col items-center pointer-events-none z-10">
           <h1 className="text-4xl font-serif text-transparent bg-clip-text bg-gradient-to-b from-amber-200/80 to-amber-500/80 tracking-widest animate-fade-in">魔法圣诞树</h1>
           <div className="w-12 h-[1px] bg-amber-500/30 mt-2"></div>
        </div>
      )}

      <Scene 
        appState={appState} 
        photos={photos} 
        handPosRef={smoothedHandPosRef}
        isGrabbing={isGrabbing} 
        onPhotoSelect={(idx) => {
          if (appState === AppState.SCATTERED) setAppState(AppState.PHOTO_VIEW);
        }}
      />

      {cameraStream && landmarker && hasStarted && (
        <HandController 
          cameraStream={cameraStream} 
          landmarker={landmarker}
          onStateChange={handleStateChange} 
          onHandMove={(x,y,z) => targetHandPosRef.current = {x,y,z}} 
          onGrab={(g) => {
            setIsGrabbing(g); 
            if(!g && appState === AppState.PHOTO_VIEW) setAppState(AppState.SCATTERED);
          }}
        />
      )}

      <div className={`absolute top-1/3 left-0 w-full flex justify-center pointer-events-none transition-all duration-1000 ${magicMessage ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
        <h2 className="text-2xl md:text-4xl font-serif text-amber-200 drop-shadow-[0_0_15px_rgba(255,215,0,0.5)] italic">{magicMessage}</h2>
      </div>

      {hasStarted && (
        <div className="absolute bottom-8 left-8 bg-black/40 backdrop-blur-xl border-l-2 border-amber-500/50 p-6 max-w-sm animate-fade-in">
           <h3 className="text-amber-400 font-bold uppercase text-[10px] tracking-widest mb-4">手势指南</h3>
           <div className="space-y-4 text-xs font-light">
                <div className={`flex items-center gap-4 ${appState === AppState.TREE ? 'text-amber-400' : 'text-gray-500'}`}><span>✊</span><span><b>握拳:</b> 凝聚圣诞树</span></div>
                <div className={`flex items-center gap-4 ${appState === AppState.SCATTERED ? 'text-amber-400' : 'text-gray-500'}`}><span>🖐</span><span><b>张开:</b> 释放魔法粒子</span></div>
                <div className={`flex items-center gap-4 ${appState === AppState.PHOTO_VIEW ? 'text-amber-400' : 'text-gray-500'}`}><span>👌</span><span><b>捏合:</b> 捕捉记忆切片</span></div>
           </div>
        </div>
      )}

      {/* 视觉反馈光标 */}
      <div 
        ref={cursorRef} 
        className={`fixed w-8 h-8 rounded-full border border-amber-400/50 pointer-events-none transform -translate-x-1/2 -translate-y-1/2 z-[60] transition-transform duration-200 ${isGrabbing ? 'scale-75 bg-amber-400/20' : 'scale-100'}`} 
        style={{ opacity: 0 }}
      >
        <div className="w-1 h-1 bg-amber-400 rounded-full m-auto mt-[14px] animate-ping"></div>
      </div>
    </div>
  );
}

export default App;
