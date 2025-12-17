import { ThreeElements } from '@react-three/fiber';

export enum AppState {
  TREE = 'TREE',           // Fist: Collapsed into a tree
  SCATTERED = 'SCATTERED', // Open Palm: Floating particles
  PHOTO_VIEW = 'PHOTO_VIEW' // Pinch: Focused on a single photo
}

export interface DecorationData {
  position: [number, number, number]; // Final tree position
  rotation: [number, number, number];
  scale: number;
  type: 'sphere' | 'cube' | 'cane';
  color: string;
}

export interface HandLandmark {
  x: number;
  y: number;
  z: number;
}

export interface GestureContextType {
  state: AppState;
  setState: (s: AppState) => void;
  handPosition: { x: number; y: number }; // Normalized -1 to 1
  isGrabbing: boolean;
  activePhotoIndex: number | null;
  setActivePhotoIndex: (n: number | null) => void;
}

declare global {
  namespace JSX {
    interface IntrinsicElements {
      [elemName: string]: any;
    }
  }
}
