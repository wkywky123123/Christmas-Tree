import React, { useState, useCallback } from 'react';
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
  const [photos, setPhotos] = useState<string[]>(DEFAULT_PHOTOS);
  const [handPos, setHandPos] = useState({ x: 0, y: 0, z: 0 });
  const [isGrabbing, setIsGrabbing] = useState(false);

  // Handlers
  const handleStateChange = useCallback((newState: AppState) => {
    setAppState(newState);
  }, []);

  const handleHandMove = useCallback((x: number, y: number, z: number) => {
    setHandPos({ x, y, z });
  }, []);

  const handleGrab = useCallback((grab: boolean) => {
    setIsGrabbing(grab);
    // 逻辑变更：不要在这里直接切换到 PHOTO_VIEW。
    // 这里只记录抓取意图。具体的照片选中逻辑由 MagicTree 计算后触发 handlePhotoSelect。
    // 但是，如果是从 PHOTO_VIEW 释放（松开手指），则需要切回 SCATTERED。
    if (!grab && appState === AppState.PHOTO_VIEW) {
       setAppState(AppState.SCATTERED);
    }
  }, [appState]);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const url = URL.createObjectURL(e.target.files[0]);
      setPhotos(prev => [...prev, url]);
    }
  };

  const handlePhotoSelect = (index: number) => {
    // 当 MagicTree 确认抓到了某张照片时调用
    if (appState === AppState.SCATTERED) {
      setAppState(AppState.PHOTO_VIEW);
    }
  };

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

        {/* Upload Button */}
        <div className="pointer-events-auto">
          <label className="cursor-pointer bg-gradient-to-r from-red-800 to-red-600 hover:from-red-700 hover:to-red-500 text-white py-2 px-6 rounded-full shadow-lg border border-amber-500/50 flex items-center gap-2 transition-all transform hover:scale-105 active:scale-95">
            <span className="text-xl">+</span> 添加回忆
            <input type="file" accept="image/*" onChange={handlePhotoUpload} className="hidden" />
          </label>
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
          top: `${(handPos.y + 1) * 50}%`,
          opacity: handPos.x === 0 && handPos.y === 0 ? 0 : 1
        }}
      >
        <div className="w-1 h-1 bg-white rounded-full"></div>
      </div>
    </div>
  );
}

export default App;