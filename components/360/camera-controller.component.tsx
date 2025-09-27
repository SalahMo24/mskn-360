import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";

import * as THREE from "three";

function CameraController({
  capturedPoints,
  onReadyToCapture,
  captureAngle,
}: {
  capturedPoints: THREE.Vector3[];
  onReadyToCapture: (flag: boolean) => void;
  captureAngle: number;
}) {
  const { camera } = useThree();
  const lastPoint = capturedPoints[capturedPoints.length - 1];
  const prevAngle = useRef<number | null>(null);

  useFrame(() => {
    if (!lastPoint) return;

    const currentForward = new THREE.Vector3(0, 0, -1)
      .applyQuaternion(camera.quaternion)
      .normalize();

    const angle = lastPoint.angleTo(currentForward);

    const angleDelta =
      prevAngle.current !== null ? Math.abs(angle - prevAngle.current) : 0;

    // Dead zone check (ignore changes < 0.5°)
    if (angleDelta < 0.0087) return;

    prevAngle.current = angle;

    onReadyToCapture(Math.abs(angle - captureAngle) < 0.1); // ~5.7° tolerance
  });

  return null;
}

export default CameraController;
