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
  const starRef = useRef<Mesh>(null);
  const dummy = useMemo(() => new Object3D(), []);
  const { camera, raycaster } = useThree();

  const particles = useMemo(() => generateTreePositions(CONFIG.PARTICLE_COUNT), []);
  const scatterPositions = useMemo(() => {
    return particles.map(() => ({
      pos: randomVector(CONFIG.SCATTER_BOUNDS), 
      rot: randomVector(Math.PI),
    })).map((item, i) => {
      if (i < photos.length) return { pos: randomVector(CONFIG.SCATTER_BOUNDS * 0.6), rot: item.rot };
      return item;
    });
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

    if (appState === AppState.SCATTERED) {
      const theta = handPos.x * (Math.PI * 0.15); 
      const phi = Math.PI / 2 - (handPos.y * Math.PI / 12); 
      const zoomRadius = CONFIG.CAMERA_Z - (handPos.z * 5); 
      const targetPos = new Vector3();
      targetPos.setFromSphericalCoords(zoomRadius, phi, theta);
      camera.position.lerp(targetPos, delta * 0.8);
      camera.lookAt(0, 0, 0);
    } else if (appState === AppState.TREE) {
      camera.position.lerp(new Vector3(0, 0, CONFIG.CAMERA_Z), delta * 2);
      camera.lookAt(0, 0, 0);
    }

    const time = state.clock.elapsedTime;
    if (starRef.current) {
      const starScale = (appState === AppState.TREE ? 1.5 : 0.5) * (Math.sin(time * 3) * 0.1 + 1);
      starRef.current.position.lerp(new Vector3(0, CONFIG.TREE_HEIGHT/2 + 1 + (appState === AppState.SCATTERED ? 5 : 0), 0), delta * 2);
      starRef.current.rotation.y += delta * 0.5;
      starRef.current.scale.lerp(new Vector3(starScale, starScale, starScale), delta * 2);
    }

    particles.forEach((data, i) => {
      const t = currentLerp.current;
      const treePos = new Vector3(...data.position);
      const scatterPos = new Vector3(...scatterPositions[i].pos);
      if (t > 0.5) {
         scatterPos.y += Math.sin(time + i) * 0.02;
         scatterPos.x += Math.cos(time * 0.5 + i) * 0.02;
      }
      dummy.position.lerpVectors(treePos, scatterPos, t);
      dummy.rotation.set(data.rotation[0]*(1-t), data.rotation[1]*(1-t) + time*0.1, data.rotation[2]*(1-t));
      dummy.scale.setScalar(data.scale * (appState === AppState.TREE ? 1 : 1.5)); 
      dummy.updateMatrix();
      meshRef.current!.setMatrixAt(i, dummy.matrix);
      const baseColor = new Color(data.color).multiplyScalar(1 + Math.sin(time * 2 + i * 13) * 0.5 + 0.5);
      meshRef.current!.setColorAt(i, baseColor);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;

    photoRefs.current.forEach((obj, i) => {
      if (!obj) return;
      const t = currentLerp.current;
      const slotIdx = i % particles.length;
      const treePos = new Vector3(...particles[slotIdx].position).multiplyScalar(1.2);
      const scatterPos = new Vector3(...scatterPositions[slotIdx].pos).multiplyScalar(0.8);
      let targetPos = new Vector3().lerpVectors(treePos, scatterPos, t);
      let targetScale = t === 0 ? 0.8 : 1.5;
      let targetRot = new Quaternion().setFromEuler(new Euler(0, 0, 0));

      if (activePhoto === i && appState === AppState.PHOTO_VIEW) {
        const camDir = new Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
        targetPos = camera.position.clone().add(camDir.multiplyScalar(5)).add(new Vector3(0,1,0).applyQuaternion(camera.quaternion).multiplyScalar(2));
        targetScale = 4.0;
        targetRot = camera.quaternion.clone();
      } else if (appState === AppState.SCATTERED) {
        targetRot = camera.quaternion.clone();
      }
      obj.position.lerp(targetPos, delta * 3);
      obj.scale.lerp(new Vector3(targetScale, targetScale, targetScale), delta * 3);
      obj.quaternion.slerp(targetRot, delta * 3);
    });

    if (appState === AppState.SCATTERED && isGrabbing && activePhoto === null) {
       raycaster.setFromCamera(new Vector2(handPos.x, handPos.y), camera);
       const validMeshes = photoRefs.current.filter(m => !!m) as Object3D[];
       const intersects = raycaster.intersectObjects(validMeshes, true);
       if (intersects.length > 0) {
         let hit = intersects[0].object;
         while (hit && !photoRefs.current.includes(hit)) hit = hit.parent!;
         if (hit) {
            const idx = photoRefs.current.indexOf(hit);
            if (idx !== -1) { setActivePhoto(idx); onPhotoSelect(idx); }
         }
       }
    }
  });

  return (
    <>
      <instancedMesh ref={meshRef} args={[undefined, undefined, CONFIG.PARTICLE_COUNT]}>
        <sphereGeometry args={[0.5, 16, 16]} />
        <meshStandardMaterial roughness={0.2} metalness={0.8} toneMapped={false} />
      </instancedMesh>
      <mesh ref={starRef} position={[0, CONFIG.TREE_HEIGHT/2 + 1, 0]}>
        <octahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color="#FFD700" emissive="#FFD700" emissiveIntensity={2} toneMapped={false} metalness={1} />
        <pointLight color="#FFD700" intensity={2} distance={10} />
      </mesh>
      <Sparkles count={150} scale={12} size={4} speed={0.4} color={COLORS.GOLD} />
      {photos.map((src, i) => (
        <PhotoMesh key={i} src={src} index={i} setRef={(el) => (photoRefs.current[i] = el)} />
      ))}
    </>
  );
};

const PhotoMesh: React.FC<{ src: string; index: number; setRef: (el: Object3D | null) => void }> = ({ src, setRef }) => {
  // 增加基础错误拦截，避免因 404 导致 Suspense 崩溃
  const texture = useTexture(src);
  
  // 核心逻辑：计算图片原比例
  // Fixed: Cast texture.image to any to avoid "unknown" type errors when accessing width/height in TypeScript
  const { width, height } = useMemo(() => {
    const img = texture?.image as any;
    if (img && img.width && img.height) {
      const aspect = img.width / img.height;
      return { width: aspect, height: 1 };
    }
    return { width: 1, height: 1 };
  }, [texture]);

  return (
    <group ref={setRef}>
       <mesh>
        <planeGeometry args={[width, height]} />
        <meshStandardMaterial map={texture} side={2} transparent roughness={0.4} />
       </mesh>
       {/* 动态适配背景框 */}
       <mesh position={[0, 0, -0.05]}>
         <boxGeometry args={[width + 0.1, height + 0.1, 0.05]} />
         <meshStandardMaterial color="#ffffff" roughness={0.1} metalness={0.3} />
       </mesh>
       {/* 透明碰撞层 */}
       <mesh visible={false}>
         <sphereGeometry args={[Math.max(width, height) * 0.7]} />
       </mesh>
    </group>
  );
};