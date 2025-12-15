import React, { useMemo, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { InstancedMesh, Object3D, Vector3, TextureLoader, Mesh, Color, Euler, Quaternion, Raycaster, Vector2 } from 'three';
import { Sparkles } from '@react-three/drei';
import { CONFIG, COLORS } from '../constants';
import { AppState } from '../types';
import { generateTreePositions, randomVector } from '../utils/geometry';

interface MagicTreeProps {
  appState: AppState;
  photos: string[];
  handPos: { x: number; y: number; z: number };
  isGrabbing: boolean;
  onPhotoSelect: (index: number) => void;
}

export const MagicTree: React.FC<MagicTreeProps> = ({ 
  appState, 
  photos, 
  handPos, 
  isGrabbing, 
  onPhotoSelect 
}) => {
  const meshRef = useRef<InstancedMesh>(null);
  const dummy = useMemo(() => new Object3D(), []);
  const { camera, raycaster, scene } = useThree();

  // Generate static data for the tree shape
  const particles = useMemo(() => generateTreePositions(CONFIG.PARTICLE_COUNT), []);
  
  // Store random scattered positions
  const scatterPositions = useMemo(() => {
    return particles.map(() => ({
      pos: randomVector(CONFIG.SCATTER_BOUNDS),
      rot: randomVector(Math.PI),
    }));
  }, [particles]);

  // Photo Meshes Logic
  const photoRefs = useRef<(Mesh | null)[]>([]);
  const [activePhoto, setActivePhoto] = useState<number | null>(null);

  // Animation Refs
  const currentLerp = useRef(0); // 0 = Tree, 1 = Scattered

  useFrame((state, delta) => {
    if (!meshRef.current) return;

    // 1. Handle Global State Interpolation
    const targetLerp = appState === AppState.TREE ? 0 : 1;
    currentLerp.current += (targetLerp - currentLerp.current) * delta * 2; // Smooth transition

    // 2. Refined Camera Control (Spherical Orbit)
    if (appState === AppState.SCATTERED) {
      // Map hand X/Y to spherical angles
      // X maps to Theta (horizontal rotation)
      const theta = handPos.x * Math.PI; // -PI to PI
      
      // Y maps to Phi (vertical rotation). 
      // y is now -1 (Top) to 1 (Bottom).
      // Center (0) -> PI/2 (Horizon).
      // Top (-1) -> PI/2 - PI/3 = PI/6 (High Angle).
      // Bottom (1) -> PI/2 + PI/3 = 5PI/6 (Low Angle).
      const phi = Math.PI / 2 + (handPos.y * Math.PI / 3); 

      // Z maps to Radius (Zoom)
      const zoomRadius = CONFIG.CAMERA_Z - (handPos.z * 10); 

      const targetPos = new Vector3();
      targetPos.setFromSphericalCoords(zoomRadius, phi, theta);

      camera.position.lerp(targetPos, delta * 2);
      camera.lookAt(0, 0, 0);

    } else if (appState === AppState.TREE) {
      // Reset camera to front view
      const targetPos = new Vector3(0, 0, CONFIG.CAMERA_Z);
      camera.position.lerp(targetPos, delta * 2);
      camera.lookAt(0, 0, 0);
    }

    // 3. Update Particles
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

    // 4. Update Photos
    photoRefs.current.forEach((mesh, i) => {
      if (!mesh) return;
      
      const t = currentLerp.current;
      const slotIndex = i % particles.length; 
      
      const treePos = new Vector3(...particles[slotIndex].position).multiplyScalar(1.2);
      const scatterPos = new Vector3(...scatterPositions[slotIndex].pos).multiplyScalar(0.8);

      let targetPos = new Vector3().lerpVectors(treePos, scatterPos, t);
      let targetScale = t === 0 ? 0.8 : 1.5;
      let targetRot = new Quaternion().setFromEuler(new Euler(0, 0, 0));

      // Zoom State Handling
      if (activePhoto === i && appState === AppState.PHOTO_VIEW) {
        const camDir = new Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
        // Bring closer to camera
        targetPos = camera.position.clone().add(camDir.multiplyScalar(5));
        targetScale = 4.0;
        targetRot = camera.quaternion.clone();
      } else if (appState === AppState.SCATTERED) {
         targetRot = camera.quaternion.clone();
      }

      mesh.position.lerp(targetPos, delta * 3);
      mesh.scale.setScalar(mesh.scale.x + (targetScale - mesh.scale.x) * delta * 3);
      mesh.quaternion.slerp(targetRot, delta * 3);
    });

    // 5. Interaction Logic (Grabbing with Raycaster)
    // Only verify grab if we are scattered and trying to grab (or already viewing)
    if (appState === AppState.SCATTERED && isGrabbing && activePhoto === null) {
       // Convert handPos to NDC for Raycaster
       // handPos.x: -1 (Left) to 1 (Right) => Matches NDC x
       // handPos.y: -1 (Top) to 1 (Bottom) => Invert for NDC y (Top is 1)
       const ndc = new Vector2(handPos.x, -handPos.y);
       
       raycaster.setFromCamera(ndc, camera);
       
       // Filter out null refs
       const validMeshes = photoRefs.current.filter(m => m !== null) as Object3D[];
       const intersects = raycaster.intersectObjects(validMeshes, false);

       if (intersects.length > 0) {
         // Find the index of the intersected object
         const object = intersects[0].object;
         // Handle group or mesh hit
         // Note: object might be a child mesh of the group. We need to find the parent Group.
         let hitGroup = object;
         if (object.parent && object.parent.type === 'Group') {
            hitGroup = object.parent;
         }

         // We are comparing the Group ref, because setRef in PhotoMesh is on the Group
         const index = photoRefs.current.indexOf(hitGroup as Mesh);
         
         if (index !== -1) {
           setActivePhoto(index);
           onPhotoSelect(index); // Trigger state change in App
         }
       }
    } else if (!isGrabbing && appState === AppState.SCATTERED) {
      // Logic for releasing
      setActivePhoto(null);
    } else if (appState === AppState.PHOTO_VIEW && !isGrabbing) {
      // If we are in PHOTO_VIEW but not grabbing, we should release
      // This state usually handled by App switching state back to SCATTERED
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
  // Add a slightly larger invisible hit area or make the photo easier to grab
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
       {/* Hit Box for easier raycasting */}
       <mesh visible={false}>
         <sphereGeometry args={[0.8]} />
       </mesh>
    </group>
  );
};