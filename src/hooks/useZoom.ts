import { useState, useEffect } from 'react';

export const ZOOM_STEPS = [2, 4, 6, 8, 12, 16, 24, 32, 48, 64, 80];

export const ZOOM_PRESETS = {
  MES: 2,
  SEMANA: 8,
  DIA: 32,
};

export function useZoom() {
  const [zoomLevel, setZoomLevel] = useState<number>(ZOOM_PRESETS.DIA);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('maxima:gantt-zoom');
      if (saved) {
        try {
          const parsed = parseInt(saved, 10);
          if (ZOOM_STEPS.includes(parsed)) {
            setZoomLevel(parsed);
          }
        } catch (e) {}
      }
    }
  }, []);

  const handleZoomChange = (newZoom: number) => {
    setZoomLevel(newZoom);
    localStorage.setItem('maxima:gantt-zoom', newZoom.toString());
  };

  const zoomIn = () => {
    const currentIndex = ZOOM_STEPS.indexOf(zoomLevel);
    if (currentIndex < ZOOM_STEPS.length - 1) {
      handleZoomChange(ZOOM_STEPS[currentIndex + 1]);
    }
  };

  const zoomOut = () => {
    const currentIndex = ZOOM_STEPS.indexOf(zoomLevel);
    if (currentIndex > 0) {
      handleZoomChange(ZOOM_STEPS[currentIndex - 1]);
    }
  };

  const setPreset = (preset: 'DIA' | 'SEMANA' | 'MES') => {
    handleZoomChange(ZOOM_PRESETS[preset]);
  };

  return {
    zoomLevel,
    zoomIn,
    zoomOut,
    setPreset,
    canZoomIn: zoomLevel < ZOOM_STEPS[ZOOM_STEPS.length - 1],
    canZoomOut: zoomLevel > ZOOM_STEPS[0]
  };
}
