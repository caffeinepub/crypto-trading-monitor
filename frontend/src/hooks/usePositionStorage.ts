import { useState, useEffect } from 'react';
import { Position } from '../types/position';

const STORAGE_KEY = 'crypto-positions';

export function usePositionStorage() {
  const [positions, setPositions] = useState<Position[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setPositions(parsed);
      } catch (error) {
        console.error('Error loading positions from localStorage:', error);
      }
    }
  }, []);

  const savePositions = (newPositions: Position[]) => {
    setPositions(newPositions);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newPositions));
  };

  const addPosition = (position: Position) => {
    savePositions([...positions, position]);
  };

  const updatePosition = (id: string, updates: Partial<Position>) => {
    savePositions(
      positions.map(p => (p.id === id ? { ...p, ...updates } : p))
    );
  };

  const deletePosition = (id: string) => {
    savePositions(positions.filter(p => p.id !== id));
  };

  return {
    positions,
    addPosition,
    updatePosition,
    deletePosition,
  };
}
