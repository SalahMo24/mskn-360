import React from "react";

export function ImageT({ src }: { src: any }) {
  try {
    return (
      <mesh>
        <planeGeometry args={[1.9, 2.5]} />
        <meshBasicMaterial map={src} />
      </mesh>
    );
  } catch (e) {
    console.log(e);
    return null;
  }
}
