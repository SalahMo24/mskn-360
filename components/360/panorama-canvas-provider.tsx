import React, { createContext, useContext, ReactNode } from "react";
import { Canvas } from "@react-three/fiber/native";

interface PanoramaCanvasContextType {
  isCanvasReady: boolean;
}

const PanoramaCanvasContext = createContext<PanoramaCanvasContextType>({
  isCanvasReady: false,
});

interface PanoramaCanvasProviderProps {
  children: ReactNode;
}

/**
 * Provides a shared Canvas context for panorama components to avoid
 * the "multiple renderers" warning. This should wrap your app or the
 * section where you use panorama components.
 */
export const PanoramaCanvasProvider: React.FC<PanoramaCanvasProviderProps> = ({
  children,
}) => {
  return (
    <Canvas
      style={{
        position: "absolute",
        top: -10000,
        left: -10000,
        width: 1,
        height: 1,
      }}
      gl={{ preserveDrawingBuffer: true, alpha: true }}
    >
      {/* Hidden canvas for WebGL context - components will use useThree() */}
      <PanoramaCanvasContext.Provider value={{ isCanvasReady: true }}>
        {children}
      </PanoramaCanvasContext.Provider>
    </Canvas>
  );
};

export const usePanoramaCanvas = () => {
  const context = useContext(PanoramaCanvasContext);
  if (!context) {
    throw new Error(
      "usePanoramaCanvas must be used within a PanoramaCanvasProvider"
    );
  }
  return context;
};

export default PanoramaCanvasProvider;
