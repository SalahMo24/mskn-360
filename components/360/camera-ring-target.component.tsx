import React, { useRef } from "react";
import { useFrame } from "@react-three/fiber";

import * as THREE from "three";

function CameraRingTarget({ distance = 1.8 }: { distance: number }) {
  const ringRef = useRef<THREE.Mesh>(null);

  useFrame(({ camera }) => {
    if (!ringRef.current) return;

    // Calculate position 2 units in front of the camera
    const forward = new THREE.Vector3(0, 0, -1)
      .applyQuaternion(camera.quaternion)
      .multiplyScalar(distance);

    ringRef.current.position.copy(camera.position).add(forward);

    // Match camera's rotation (optional)
    ringRef.current.quaternion.copy(camera.quaternion);
  });

  return (
    <mesh ref={ringRef}>
      <ringGeometry args={[0.12, 0.14, 32]} />
      <meshBasicMaterial color={"white"} side={THREE.DoubleSide} />
    </mesh>
  );
}

export default CameraRingTarget;
