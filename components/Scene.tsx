import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import { Environment, Stars } from '@react-three/drei';
import { MagicTree } from './MagicTree';
import { SnowParticles } from './SnowParticles';
import { AppState } from '../types';

interface SceneProps {
  appState: AppState;
  photos: string[];
  handPos: { x: number; y: number; z: number };
  isGrabbing: boolean;
  onPhotoSelect: (index: number) => void;
}

export const Scene: React.FC<SceneProps> = (props) => {
  return (
    <div className="w-full h-full relative z-0">
      <Canvas
        camera={{ position: [0, 0, 22], fov: 45 }}
        gl={{ antialias: false, alpha: false }}
        dpr={[1, 1.5]}
      >
        <color attach="background" args={['#050505']} />
        
        <Suspense fallback={null}>
          <group position={[0, -2, 0]}>
             <MagicTree {...props} />
          </group>

          {/* Environmental Effects */}
          <SnowParticles count={300} />
          <Environment preset="city" />
          <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
        </Suspense>

        {/* Cinematic Lighting */}
        <ambientLight intensity={0.2} color="#ffffff" />
        <pointLight position={[10, 10, 10]} intensity={1.5} color="#FFD700" distance={50} />
        <pointLight position={[-10, 5, 10]} intensity={1} color="#D42426" distance={50} />
        <spotLight 
          position={[0, 20, 0]} 
          angle={0.5} 
          penumbra={1} 
          intensity={2} 
          color="#FFF" 
          castShadow
        />

        {/* Post Processing for Glow */}
        <EffectComposer disableNormalPass>
          <Bloom 
            luminanceThreshold={0.5} 
            mipmapBlur 
            intensity={1.5} 
            radius={0.6}
          />
          <Vignette eskil={false} offset={0.1} darkness={1.1} />
        </EffectComposer>
      </Canvas>
    </div>
  );
};