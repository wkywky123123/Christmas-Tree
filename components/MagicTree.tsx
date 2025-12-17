
import React, { useMemo, useRef, useState, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import { InstancedMesh, Object3D, Vector3, Mesh, Color, Euler, Quaternion, Raycaster, Vector2 } from 'three';
import { Sparkles } from '@react-three/drei';
import { CONFIG, COLORS } from '../constants';
import { AppState } from '../types';
import { generateTreePositions, randomVector } from '../utils/geometry';

interface MagicTreeProps {
  appState: AppState;
  photos: string[];
  handPosRef: React.MutableRefObject<{ x: number; y: number; z: number }>;
  isGrabbing: boolean;
  onPhotoSelect: (index: number) => void;
}

export const MagicTree: React.FC<MagicTreeProps> = ({ 
  appState, 
  photos, 
  handPosRef, 
  isGrabbing, 
  onPhotoSelect 
}) => {
  const meshRef = useRef<InstancedMesh>(null);
  const dummy = useMemo(() => new Object3D(), []);
  const { camera, raycaster } = useThree();

  // Make sure we have enough particles for all photos + background
  const finalParticleCount = Math.max(CONFIG.PARTICLE_COUNT, photos.length + 50);
  const particles = useMemo(() => generateTreePositions(finalParticleCount), [finalParticleCount]);
  
  const scatterPositions = useMemo(() => {
    return particles.map((_, i) => ({
      pos: randomVector(CONFIG.SCATTER_BOUNDS * (i < photos.length ? 0.6 : 1)), 
      rot: randomVector(Math.PI),
    }));
  }, [particles, photos.length]);

  const photoRefs = useRef<(Object3D | null)[]>([]);
  const [activePhoto, setActivePhoto] = useState<number | null>(null);
  const currentLerp = useRef(0);

  useEffect(() => {
    if (appState === AppState.SCATTERED) setActivePhoto(null);
  }, [appState]);

  useFrame((state, delta) => {
    if (!meshRef.current) return;
    
    const handPos = handPosRef.current;
    const targetLerp = appState === AppState.TREE ? 0 : 1;
    currentLerp.current += (targetLerp - currentLerp.current) * delta * 2; 

    // Camera interaction in scattered mode
    if (appState === AppState.SCATTERED) {
      const zoomRadius = CONFIG.CAMERA_Z - (handPos.z * 6); 
      const targetPos = new Vector3();
      targetPos.setFromSphericalCoords(zoomRadius, Math.PI/2 - handPos.y * 0.3, handPos.x * 0.5);
      camera.position.lerp(targetPos, delta * 2);
      camera.lookAt(0, 0, 0);
    } else {
      camera.position.lerp(new Vector3(0, 0, CONFIG.CAMERA_Z), delta * 2);
      camera.lookAt(0, 0, 0);
    }

    const time = state.clock.elapsedTime;
    
    // Animate Particles
    particles.forEach((data, i) => {
      const t = currentLerp.current;
      const currentPos = new Vector3().lerpVectors(new Vector3(...data.position), new Vector3(...scatterPositions[i].pos), t);
      
      if (t > 0.8) {
        currentPos.y += Math.sin(time + i) * 0.05;
      }

      dummy.position.copy(currentPos);
      dummy.rotation.set(data.rotation[0] + time * 0.2, data.rotation[1] + time * 0.1, data.rotation[2]);
      dummy.scale.setScalar(data.scale * (appState === AppState.TREE ? 1 : 1.3));
      dummy.updateMatrix();
      meshRef.current!.setMatrixAt(i, dummy.matrix);
      
      const c = new Color(data.color).multiplyScalar(1 + Math.sin(time * 2 + i) * 0.5);
      meshRef.current!.setColorAt(i, c);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;

    // Animate Photos
    photoRefs.current.forEach((obj, i) => {
      if (!obj) return;
      const t = currentLerp.current;
      let targetPos = new Vector3().lerpVectors(new Vector3(...particles[i].position), new Vector3(...scatterPositions[i].pos), t);
      let targetScale = t < 0.2 ? 0.001 : 1.5;
      let targetRot = camera.quaternion.clone();

      if (activePhoto === i && appState === AppState.PHOTO_VIEW) {
        targetPos = camera.position.clone().add(new Vector3(0,0,-1).applyQuaternion(camera.quaternion).multiplyScalar(6));
        targetScale = 5;
      }

      obj.position.lerp(targetPos, delta * 4);
      obj.scale.setScalar(obj.scale.x + (targetScale - obj.scale.x) * delta * 4);
      obj.quaternion.slerp(targetRot, delta * 4);
    });

    // Interaction logic
    if (appState === AppState.SCATTERED && isGrabbing && activePhoto === null) {
       raycaster.setFromCamera(new Vector2(handPos.x, handPos.y), camera);
       const valid = photoRefs.current.filter(p => p) as Object3D[];
       const hits = raycaster.intersectObjects(valid, true);
       if (hits.length > 0) {
         let root = hits[0].object;
         while(root.parent && !root.userData.isPhoto) root = root.parent;
         if (root.userData.isPhoto) {
            setActivePhoto(root.userData.index);
            onPhotoSelect(root.userData.index);
         }
       }
    } else if (!isGrabbing && appState === AppState.PHOTO_VIEW) {
      setActivePhoto(null);
    }
  });

  return (
    <>
      <instancedMesh ref={meshRef} args={[undefined, undefined, finalParticleCount]}>
        <sphereGeometry args={[0.4, 8, 8]} />
        <meshStandardMaterial roughness={0.1} metalness={0.9} toneMapped={false} />
      </instancedMesh>
      
      <Sparkles count={200} scale={15} size={3} speed={0.3} color={COLORS.GOLD} />

      {photos.map((src, i) => (
        <PhotoItem 
          key={src + i} 
          src={src} 
          index={i} 
          onRef={(el) => {
            if (el) {
              el.userData = { isPhoto: true, index: i };
              photoRefs.current[i] = el;
            }
          }} 
        />
      ))}
    </>
  );
};

// Fix: added key to the props interface to satisfy TypeScript when used as a component in a list
const PhotoItem = ({ src, index, onRef }: { src: string, index: number, onRef: (el: any) => void, key?: React.Key }) => {
  const texture = useTexture(src);
  return (
    <group ref={onRef} scale={0.001}>
      <mesh>
        <planeGeometry args={[1, 1]} />
        <meshStandardMaterial map={texture} side={2} transparent />
      </mesh>
      <mesh position={[0,0,-0.02]}>
        <boxGeometry args={[1.05, 1.05, 0.02]} />
        <meshStandardMaterial color="white" />
      </mesh>
    </group>
  );
};
