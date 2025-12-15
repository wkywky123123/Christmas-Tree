import React, { useMemo, useRef, useState, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { InstancedMesh, Object3D, Vector3, TextureLoader, Mesh, Color, Euler, Quaternion, Raycaster, Vector2 } from 'three';
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

  const particles = useMemo(() => generateTreePositions(CONFIG.PARTICLE_COUNT), []);
  
  const scatterPositions = useMemo(() => {
    return particles.map(() => ({
      pos: randomVector(CONFIG.SCATTER_BOUNDS),
      rot: randomVector(Math.PI),
    }));
  }, [particles]);

  const photoRefs = useRef<(Mesh | null)[]>([]);
  const [activePhoto, setActivePhoto] = useState<number | null>(null);

  const currentLerp = useRef(0);

  useEffect(() => {
    if (appState === AppState.SCATTERED) {
       setActivePhoto(null);
    }
  }, [appState]);

  useFrame((state, delta) => {
    if (!meshRef.current) return;
    
    // Read hand position from ref
    const handPos = handPosRef.current;

    const targetLerp = appState === AppState.TREE ? 0 : 1;
    currentLerp.current += (targetLerp - currentLerp.current) * delta * 2; 

    if (appState === AppState.SCATTERED) {
      // Adjusted sensitivity for more deliberate movement
      // Reduced multipliers to make rotation less extreme
      const theta = handPos.x * (Math.PI * 0.15); // Reduced from 0.2
      const phi = Math.PI / 2 - (handPos.y * Math.PI / 12); // Reduced from pi/8
      const zoomRadius = CONFIG.CAMERA_Z - (handPos.z * 5); 

      const targetPos = new Vector3();
      targetPos.setFromSphericalCoords(zoomRadius, phi, theta);

      // Lower lerp factor (from 2 to 0.8) adds 'weight' and smoothness
      camera.position.lerp(targetPos, delta * 0.8);
      camera.lookAt(0, 0, 0);

    } else if (appState === AppState.TREE) {
      const targetPos = new Vector3(0, 0, CONFIG.CAMERA_Z);
      camera.position.lerp(targetPos, delta * 2);
      camera.lookAt(0, 0, 0);
    }

    const time = state.clock.elapsedTime;
    
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
    photoRefs.current.forEach((mesh, i) => {
      if (!mesh) return;
      
      const t = currentLerp.current;
      const slotIndex = i % particles.length; 
      
      const treePos = new Vector3(...particles[slotIndex].position).multiplyScalar(1.2);
      const scatterPos = new Vector3(...scatterPositions[slotIndex].pos).multiplyScalar(0.8);

      let targetPos = new Vector3().lerpVectors(treePos, scatterPos, t);
      let targetScale = t === 0 ? 0.8 : 1.5;
      let targetRot = new Quaternion().setFromEuler(new Euler(0, 0, 0));

      if (activePhoto === i && appState === AppState.PHOTO_VIEW) {
        const camDir = new Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
        // Position photo 5 units in front of camera
        targetPos = camera.position.clone().add(camDir.multiplyScalar(5));
        
        // Offset UP in screen space (Y axis relative to camera)
        // Increased to 2.0 to ensure it's comfortably in the top half
        const camUp = new Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
        targetPos.add(camUp.multiplyScalar(2.0));

        targetScale = 4.0;
        targetRot = camera.quaternion.clone();
      } else if (appState === AppState.SCATTERED) {
         targetRot = camera.quaternion.clone();
      }

      mesh.position.lerp(targetPos, delta * 3);
      mesh.scale.setScalar(mesh.scale.x + (targetScale - mesh.scale.x) * delta * 3);
      mesh.quaternion.slerp(targetRot, delta * 3);
    });

    if (appState === AppState.SCATTERED && isGrabbing && activePhoto === null) {
       const ndc = new Vector2(handPos.x, handPos.y); 
       raycaster.setFromCamera(ndc, camera);
       
       const validMeshes = photoRefs.current.filter(m => m !== null) as Object3D[];
       
       const intersects = raycaster.intersectObjects(validMeshes, true);

       if (intersects.length > 0) {
         let hitObject: Object3D | null = intersects[0].object;
         while (hitObject && !photoRefs.current.includes(hitObject as Mesh)) {
            hitObject = hitObject.parent;
         }

         if (hitObject) {
            const index = photoRefs.current.indexOf(hitObject as Mesh);
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

const PhotoMesh = ({ src, index, setRef }: { src: string, index: number, setRef: (el: Mesh | null) => void }) => {
  const texture = useMemo(() => new TextureLoader().load(src), [src]);
  return (
    <group ref={setRef}>
       <mesh>
        <planeGeometry args={[1, 1]} />
        <meshStandardMaterial 
            map={texture} 
            side={2} 
            transparent 
            roughness={0.4}
            metalness={0.1}
        />
       </mesh>
       <mesh position={[0,0,-0.05]}>
         <boxGeometry args={[1.05, 1.05, 0.05]} />
         <meshStandardMaterial color="#fff" roughness={0.1} metalness={0.5} />
       </mesh>
       <mesh visible={false}>
         <sphereGeometry args={[1.5]} />
       </mesh>
    </group>
  );
};