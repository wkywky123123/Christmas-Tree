import React, { useState, useCallback, useEffect } from 'react';
import { Scene } from './components/Scene';
import { HandController } from './components/HandController';
import { AppState } from './types';
import { COLORS } from './constants';

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
  const [handPos, setHandPos] = useState({ x: 0, y: 0, z: 0 });
  const [isGrabbing, setIsGrabbing] = useState(false);
  const [isMobilePortrait, setIsMobilePortrait] = useState(false);

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

  // Handlers
  const handleStateChange = useCallback((newState: AppState) => {
    setAppState(newState);
  }, []);

  const handleHandMove = useCallback((x: number, y: number, z: number) => {
    setHandPos({ x, y, z });
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
      {/* 3D Scene Layer */}
      <Scene 
        appState={appState} 
        photos={photos} 
        handPos={handPos}
        isGrabbing={isGrabbing}
        onPhotoSelect={handlePhotoSelect}
      />

      {/* Hand Tracking & Logic Layer */}
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
      <div className="absolute bottom-8 left-8 p-6 bg-black/40 backdrop-blur-md rounded-xl border border-white/10 max-w-sm pointer-events-none">
        <h3 className="text-amber-400 font-bold mb-3 uppercase text-xs tracking-widest border-b border-white/10 pb-2">
          手势指南
        </h3>
        <div className="space-y-3 text-sm">
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
        
        {/* Hand Cursor Visualization (Simple dot) */}
        {appState === AppState.SCATTERED && (
           <div className="mt-4 pt-2 border-t border-white/10 text-xs text-gray-500">
             移动手掌旋转视角，靠近屏幕放大。对准照片稳住捏合查看。
           </div>
        )}
      </div>

      {/* Cursor Follower */}
      <div 
        className={`absolute w-8 h-8 rounded-full border-2 border-amber-400 transition-all duration-75 pointer-events-none transform -translate-x-1/2 -translate-y-1/2 shadow-[0_0_15px_rgba(255,215,0,0.8)] z-40 flex items-center justify-center ${isGrabbing ? 'scale-75 bg-amber-400/50' : 'scale-100'}`}
        style={{ 
          left: `${(handPos.x + 1) * 50}%`, 
          top: `${(-handPos.y + 1) * 50}%`, /* Visual cursor Y needs inversion from NDC */
          opacity: handPos.x === 0 && handPos.y === 0 ? 0 : 1
        }}
      >
        <div className="w-1 h-1 bg-white rounded-full"></div>
      </div>
    </div>
  );
}

export default App;