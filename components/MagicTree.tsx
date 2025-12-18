
import React, { useMemo, useRef, useState, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import { InstancedMesh, Object3D, Vector3, Mesh, Color, Euler, Quaternion, Raycaster, Vector2, Group } from 'three';
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
      // 粒子散开逻辑
      if (i < photos.length) {
         return {
           pos: randomVector(CONFIG.SCATTER_BOUNDS * 0.6), 
           rot: item.rot
         };
      }
      return item;
    });
  }, [particles, photos.length]);

  const photoRefs = useRef<(Object3D | null)[]>([]);
  const [activePhoto, setActivePhoto] = useState<number | null>(null);

  const currentLerp = useRef(0);

  useEffect(() => {
    if (appState === AppState.SCATTERED) {
       setActivePhoto(null);
    }
  }, [appState]);

  useFrame((state, delta) => {
    if (!meshRef.current) return;
    
    const handPos = handPosRef.current;
    const targetLerp = appState === AppState.TREE ? 0 : 1;
    currentLerp.current += (targetLerp - currentLerp.current) * delta * 2; 

    // --- Camera Logic ---
    if (appState === AppState.SCATTERED) {
      const theta = handPos.x * (Math.PI * 0.15); 
      const phi = Math.PI / 2 - (handPos.y * Math.PI / 12); 
      const zoomRadius = CONFIG.CAMERA_Z - (handPos.z * 5); 

      const targetPos = new Vector3();
      targetPos.setFromSphericalCoords(zoomRadius, phi, theta);
      camera.position.lerp(targetPos, delta * 0.8);
      camera.lookAt(0, 0, 0);

    } else if (appState === AppState.TREE) {
      const targetPos = new Vector3(0, 0, CONFIG.CAMERA_Z);
      camera.position.lerp(targetPos, delta * 2);
      camera.lookAt(0, 0, 0);
    }

    const time = state.clock.elapsedTime;
    
    // --- Star Animation ---
    if (starRef.current) {
      const starScaleBase = appState === AppState.TREE ? 1.5 : 0.5;
      const starPulse = Math.sin(time * 3) * 0.2 + 1;
      const starY = CONFIG.TREE_HEIGHT / 2 + 1 + (appState === AppState.SCATTERED ? 5 : 0);
      
      starRef.current.position.lerp(new Vector3(0, starY, 0), delta * 2);
      starRef.current.rotation.y += delta * 0.5;
      starRef.current.scale.lerp(new Vector3(starScaleBase, starScaleBase, starScaleBase).multiplyScalar(starPulse), delta * 2);
    }

    // --- Particles Animation ---
    particles.forEach((data, i) => {
      const t = currentLerp.current;
      
      const treePos = new Vector3(...data.position);
      const scatterPos = new Vector3(...scatterPositions[i].pos);
      
      if (t > 0.5) {
         scatterPos.y += Math.sin(time + i) * 0.02;
         scatterPos.x += Math.cos(time * 0.5 + i) * 0.02;
      }

      const currentPos = new Vector3().lerpVectors(treePos, scatterPos, t);
      const treeRot = new Euler(...data.rotation);
      const scatterRot = new Euler(...scatterPositions[i].rot);
      
      dummy.rotation.set(
        treeRot.x * (1-t) + scatterRot.x * t,
        treeRot.y * (1-t) + scatterRot.y * t + time * 0.1,
        treeRot.z * (1-t) + scatterRot.z * t
      );

      dummy.position.copy(currentPos);
      dummy.scale.setScalar(data.scale * (appState === AppState.TREE ? 1 : 1.5)); 
      dummy.updateMatrix();
      
      meshRef.current!.setMatrixAt(i, dummy.matrix);
      
      const baseColor = new Color(data.color);
      const pulse = Math.sin(time * 2 + i * 13) * 0.5 + 0.5; 
      const intensity = 1 + pulse; 
      baseColor.multiplyScalar(intensity); 
      meshRef.current!.setColorAt(i, baseColor);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;

    // --- Photo Update Logic ---
    photoRefs.current.forEach((obj, i) => {
      if (!obj) return;
      
      const t = currentLerp.current;
      const slotIndex = i % particles.length; 
      
      const treePos = new Vector3(...particles[slotIndex].position).multiplyScalar(1.2);
      const scatterPos = new Vector3(...scatterPositions[slotIndex].pos).multiplyScalar(0.8);

      let targetPos = new Vector3().lerpVectors(treePos, scatterPos, t);
      let targetScale = t === 0 ? 0.8 : 1.5;
      let targetRot = new Quaternion().setFromEuler(new Euler(0, 0, 0));

      if (activePhoto === i && appState === AppState.PHOTO_VIEW) {
        const camDir = new Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
        targetPos = camera.position.clone().add(camDir.multiplyScalar(5));
        
        const camUp = new Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
        targetPos.add(camUp.multiplyScalar(2.0));

        targetScale = 4.0;
        targetRot = camera.quaternion.clone();
      } else if (appState === AppState.SCATTERED) {
         targetRot = camera.quaternion.clone();
      }

      obj.position.lerp(targetPos, delta * 3);
      obj.scale.setScalar(obj.scale.x + (targetScale - obj.scale.x) * delta * 3);
      obj.quaternion.slerp(targetRot, delta * 3);
    });

    if (appState === AppState.SCATTERED && isGrabbing && activePhoto === null) {
       const ndc = new Vector2(handPos.x, handPos.y); 
       raycaster.setFromCamera(ndc, camera);
       
       const validMeshes = photoRefs.current.filter(m => m !== null) as Object3D[];
       const intersects = raycaster.intersectObjects(validMeshes, true);

       if (intersects.length > 0) {
         let hitObject: Object3D | null = intersects[0].object;
         while (hitObject && !photoRefs.current.includes(hitObject as Object3D)) {
            hitObject = hitObject.parent;
         }
         if (hitObject) {
            const index = photoRefs.current.indexOf(hitObject as Object3D);
            if (index !== -1) {
                setActivePhoto(index);
                onPhotoSelect(index); 
            }
         }
       }
    } else if (appState === AppState.PHOTO_VIEW && !isGrabbing) {
      setActivePhoto(null);
    }
  });

  return (
    <>
      <instancedMesh ref={meshRef} args={[undefined, undefined, CONFIG.PARTICLE_COUNT]}>
        <sphereGeometry args={[0.5, 16, 16]} />
        <meshStandardMaterial 
          roughness={0.2} 
          metalness={0.8} 
          toneMapped={false}
        />
      </instancedMesh>
      
      <mesh ref={starRef} position={[0, CONFIG.TREE_HEIGHT/2 + 1, 0]}>
        <octahedronGeometry args={[1, 0]} />
        <meshStandardMaterial 
          color="#FFD700" 
          emissive="#FFD700"
          emissiveIntensity={2}
          toneMapped={false}
          roughness={0.2}
          metalness={1}
        />
        <pointLight color="#FFD700" intensity={2} distance={10} decay={2} />
      </mesh>

      <Sparkles 
        count={150} 
        scale={12} 
        size={4} 
        speed={0.4} 
        opacity={0.7} 
        color={COLORS.GOLD}
        noise={0.2}
      />

      {photos.map((src, i) => (
        <PhotoMesh 
          key={i} 
          src={src} 
          index={i}
          setRef={(el) => (photoRefs.current[i] = el)}
        />
      ))}
    </>
  );
};

interface PhotoMeshProps {
  src: string;
  index: number;
  setRef: (el: Object3D | null) => void;
}

const PhotoMesh: React.FC<PhotoMeshProps> = ({ src, index, setRef }) => {
  const texture = useTexture(src);
  
  // 计算原始宽高比，防止图片拉伸
  // useTexture 在 Suspense 环境下工作，加载完成后 texture.image 必然存在
  const aspect = useMemo(() => {
    if (texture.image) {
      return texture.image.width / texture.image.height;
    }
    return 1;
  }, [texture]);

  // 以高度 1 为基准计算宽度
  const width = aspect;
  const height = 1;

  return (
    <group ref={setRef}>
       {/* 核心照片平面 */}
       <mesh>
        <planeGeometry args={[width, height]} />
        <meshStandardMaterial 
            map={texture} 
            side={2} 
            transparent 
            roughness={0.4}
            metalness={0.1}
        />
       </mesh>
       {/* 照片白底背板（拍立得效果） */}
       <mesh position={[0, 0, -0.05]}>
         <boxGeometry args={[width + 0.1, height + 0.1, 0.05]} />
         <meshStandardMaterial color="#ffffff" roughness={0.1} metalness={0.3} />
       </mesh>
       {/* 扩大的透明交互层，使手势更容易捕捉 */}
       <mesh visible={false}>
         <sphereGeometry args={[Math.max(width, height) * 0.8]} />
       </mesh>
    </group>
  );
};
