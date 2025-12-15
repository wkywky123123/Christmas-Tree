import React, { useState, useCallback, useEffect, useRef } from 'react';
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

function App() {
  const [appState, setAppState] = useState<AppState>(AppState.TREE);
  const [photos] = useState<string[]>(DEFAULT_PHOTOS);
  
  // RAW Data from MediaPipe (updates at ~30fps)
  const targetHandPosRef = useRef({ x: 0, y: 0, z: 0 });
  
  // SMOOTHED Data for Rendering (updates at 60+fps)
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

  // --- SMOOTHING LOOP ---
  // This runs at the monitor's refresh rate (60/120/144hz)
  // It linearly interpolates (Lerp) the current position towards the latest ML target
  useEffect(() => {
    let rAF = 0;
    
    const loop = () => {
      const target = targetHandPosRef.current;
      const current = smoothedHandPosRef.current;
      
      // Interpolation factor (0.1 = slow/smooth, 0.3 = fast/responsive)
      const lerpFactor = 0.15;

      // Smooth X, Y, Z
      current.x += (target.x - current.x) * lerpFactor;
      current.y += (target.y - current.y) * lerpFactor;
      current.z += (target.z - current.z) * lerpFactor;

      // 1. Update Cursor DOM directly
      if (cursorRef.current) {
        const cursor = cursorRef.current;
        const left = (current.x + 1) * 50;
        const top = (-current.y + 1) * 50;
        
        cursor.style.left = `${left}%`;
        cursor.style.top = `${top}%`;
        
        // Hide cursor if it's dead center (initial state)
        // Using a small epsilon because float lerp rarely hits exact 0
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
    // Only update the TARGET. The loop above handles the smoothing.
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
      {/* 3D Scene Layer - Passing smoothedHandPosRef */}
      <Scene 
        appState={appState} 
        photos={photos} 
        handPosRef={smoothedHandPosRef}
        isGrabbing={isGrabbing}
        onPhotoSelect={handlePhotoSelect}
      />

      {/* Hand Tracking Layer - Updates targetHandPosRef */}
      <HandController 
        onStateChange={handleStateChange}
        onHandMove={handleHandMove}
        onGrab={handleGrab}
      />

      {/* UI Overlay */}
      <div className="absolute top-0 left-0 p-6 pointer-events-none w-full flex justify-between">
        <div>
          <h1 className="text-4xl font-serif text-amber-400 tracking-wider drop-shadow-[0_0_10px_rgba(255,215,0,0.5)]">
            圣诞手势魔法
          </h1>
          <p className="text-sm text-gray-300 mt-2 opacity-80 max-w-md">
            挥手成林，捏合取景。用手势体验3D节日奇迹。
          </p>
        </div>
      </div>

      {/* Instructions / Status Panel */}
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
            
            {/* Hand Cursor Visualization */}
            {appState === AppState.SCATTERED && (
              <div className="mt-4 pt-2 border-t border-white/10 text-xs text-gray-500">
                移动手掌旋转视角，靠近屏幕放大。对准照片稳住捏合查看。
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Cursor Follower (Updated by Loop) */}
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