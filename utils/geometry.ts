import { CONFIG, COLORS } from '../constants';
import { DecorationData } from '../types';

export const generateTreePositions = (count: number): DecorationData[] => {
  const data: DecorationData[] = [];
  
  for (let i = 0; i < count; i++) {
    // Cone distribution
    const y = (i / count) * CONFIG.TREE_HEIGHT - (CONFIG.TREE_HEIGHT / 2);
    const radius = ((CONFIG.TREE_HEIGHT / 2 - y) / CONFIG.TREE_HEIGHT) * CONFIG.TREE_RADIUS;
    
    // Golden angle spiral
    const theta = i * 2.39996; 
    const x = radius * Math.cos(theta);
    const z = radius * Math.sin(theta);
    
    // Randomize type and color
    const rand = Math.random();
    let type: DecorationData['type'] = 'sphere';
    let color = COLORS.GOLD;
    
    if (rand < 0.5) {
      type = 'sphere';
      color = Math.random() > 0.5 ? COLORS.GOLD : COLORS.RED;
    } else if (rand < 0.8) {
      type = 'cube';
      color = COLORS.GREEN;
    } else {
      type = 'cane';
      color = COLORS.WHITE;
    }

    data.push({
      position: [x, y, z],
      rotation: [Math.random() * Math.PI, Math.random() * Math.PI, 0],
      scale: 0.2 + Math.random() * 0.3,
      type,
      color
    });
  }
  return data;
};

export const randomVector = (scale: number): [number, number, number] => {
  return [
    (Math.random() - 0.5) * scale,
    (Math.random() - 0.5) * scale,
    (Math.random() - 0.5) * scale
  ];
};