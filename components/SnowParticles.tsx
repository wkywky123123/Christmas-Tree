import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import '../types';

export const SnowParticles: React.FC<{ count?: number }> = ({ count = 200 }) => {
  const mesh = useRef<THREE.Points>(null!);
  
  const [positions, speeds] = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const spd = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 60; // x
      pos[i * 3 + 1] = Math.random() * 60 - 30; // y
      pos[i * 3 + 2] = (Math.random() - 0.5) * 40 - 10; // z background bias
      spd[i] = 0.02 + Math.random() * 0.05;
    }
    return [pos, spd];
  }, [count]);

  useFrame(() => {
    if (!mesh.current) return;
    const pos = mesh.current.geometry.attributes.position.array as Float32Array;
    
    for (let i = 0; i < count; i++) {
      // Move down
      pos[i * 3 + 1] -= speeds[i];
      
      // Reset if too low
      if (pos[i * 3 + 1] < -30) {
        pos[i * 3 + 1] = 30;
        pos[i * 3] = (Math.random() - 0.5) * 60; // Randomize X on reset
      }
    }
    mesh.current.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={mesh}>
      <bufferGeometry>
        <bufferAttribute 
          attach="attributes-position" 
          count={count} 
          array={positions} 
          itemSize={3} 
        />
      </bufferGeometry>
      <pointsMaterial 
        size={0.15} 
        color="#ffffff" 
        transparent 
        opacity={0.4} 
        sizeAttenuation 
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
};