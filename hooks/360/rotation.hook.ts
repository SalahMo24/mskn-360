import * as THREE from "three";
import { useState, useRef } from "react";

export const useRotatingPath = ({
  stepAngle = -30,
  stepDistance = 2,
  alignmentThreshold = 5, // degrees
} = {}) => {
  const [path, setPath] = useState<THREE.Vector3[]>([]);
  const lastDirection = useRef<THREE.Vector3 | null>(null);
  const nextDirection = useRef<THREE.Vector3 | null>(null);
  const nextPoint = useRef<THREE.Vector3 | null>(null);

  const addNextPoint = (camera: THREE.Camera) => {
    const forward = new THREE.Vector3(0, 0, -1)
      .applyQuaternion(camera.quaternion)
      .normalize();
    const up = new THREE.Vector3(0, 1, 0)
      .applyQuaternion(camera.quaternion)
      .normalize();

    let baseDirection: THREE.Vector3;

    if (!lastDirection.current) {
      baseDirection = forward.clone();
    } else {
      baseDirection = lastDirection.current.clone();
    }

    const rotation = new THREE.Quaternion().setFromAxisAngle(
      up,
      THREE.MathUtils.degToRad(stepAngle)
    );
    const newDirection = baseDirection
      .clone()
      .applyQuaternion(rotation)
      .normalize();
    const point = new THREE.Vector3()
      .copy(camera.position)
      .add(newDirection.clone().multiplyScalar(stepDistance));

    lastDirection.current = newDirection;
    nextDirection.current = newDirection;
    nextPoint.current = point;

    setPath((prev) => [...prev, point]);
  };

  const isAligned = (camera: THREE.Camera): boolean => {
    if (!nextDirection.current) return false;

    const cameraForward = new THREE.Vector3(0, 0, -1)
      .applyQuaternion(camera.quaternion)
      .normalize();
    const angle = cameraForward.angleTo(nextDirection.current); // radians
    const angleDeg = THREE.MathUtils.radToDeg(angle);

    return angleDeg < alignmentThreshold;
  };

  return {
    path,
    addNextPoint,
    isAligned,
    currentTarget: nextPoint.current, // you can show this in the scene
  };
};
