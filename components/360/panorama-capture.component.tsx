import { useFrame, useThree } from "@react-three/fiber";
import React, { Suspense, useEffect, useRef } from "react";

import * as THREE from "three";
import useRotateObject from "../../rotation";

import { CameraView } from "expo-camera";
import {
  CameraType,
  PhotoPoint,
  TargetPointsType,
} from "../../hooks/360/capture-image.hook";
import CameraRingTarget from "./camera-ring-target.component";
import { ImageT } from "./image.component";

let isCapturing = false;
let capturingFirstPoint = true;
let targetPointClose = -1;
let currentTimingTarget = -1;
let startTime = 0;
const green = new THREE.Color("rgb(6,85,53)");
const red = new THREE.Color("rgb(245, 20, 20)");
const white = new THREE.Color("rgb(255,255,255)");

export default function PanoramaCapture(props: {
  points: PhotoPoint[];
  targetPoints: TargetPointsType[];
  targetPoint?: THREE.Vector3 | undefined;
  getClosestPoint: (
    camera: THREE.Camera,
    targetPoints?: TargetPointsType[],
    alignmentThreshold?: number
  ) => [number, number, boolean] | undefined;
  handleCapture: (
    camera: CameraType,
    capturedPointIndex: number
  ) => Promise<void>;
  cameraRef: React.RefObject<CameraView | null>;
  isAligned: (
    camera: THREE.Camera,
    targetPoint?: THREE.Vector3 | undefined,
    alignmentThreshold?: number
  ) => boolean;
  setTargetPoint: (
    value: React.SetStateAction<THREE.Vector3 | undefined>
  ) => void;
  setTargetPoints: React.Dispatch<React.SetStateAction<TargetPointsType[]>>;
}) {
  // const sensor = useAnimatedSensor(SensorType.ROTATION, { interval: "auto" });

  const { camera } = useThree();

  const {
    points,
    targetPoint,
    handleCapture,
    isAligned,
    setTargetPoint,
    targetPoints,
    getClosestPoint,
    setTargetPoints,
  } = props;

  const { getCameraVectors } = useRotateObject({ object: camera });

  function getInitialPoint(camera: any) {
    const currentDirection = new THREE.Vector3(0, 0, -1).applyQuaternion(
      camera.quaternion
    );
    const cameraUp = new THREE.Vector3(0, 1, 0).applyQuaternion(
      camera.quaternion
    ); // local up

    // Create a rotation of -X° around the camera's local up
    const zeroTurn = new THREE.Quaternion().setFromAxisAngle(
      cameraUp.normalize(),
      THREE.MathUtils.degToRad(0)
    );

    // Apply it to the current forward direction
    const nextDirection = currentDirection.clone().applyQuaternion(zeroTurn);
    const nextPoint = nextDirection.clone().normalize().multiplyScalar(2);
    return nextPoint;
  }

  const meshRefs = useRef<THREE.Mesh[]>([]);
  const materialRefs = useRef<THREE.MeshBasicMaterial[]>([]);

  // Reset module-scoped flags on mount so re-entering the screen starts fresh
  useEffect(() => {
    isCapturing = false;
    capturingFirstPoint = true;
    targetPointClose = -1;
    currentTimingTarget = -1;
    startTime = 0;
  }, []);

  // Initialize refs (optional, if you need to access them later)
  useEffect(() => {
    meshRefs.current = meshRefs.current.slice(0, targetPoints.length);
    materialRefs.current = materialRefs.current.slice(0, targetPoints.length);
  }, [targetPoints]);

  useFrame(({ camera }) => {
    const { forward, up } = getCameraVectors();

    // Option 1: Look in the direction
    const target = new THREE.Vector3().copy(camera.position).add(forward);
    camera.up.copy(up);
    camera.lookAt(target);

    const res = getClosestPoint(camera, targetPoints);

    if (res) {
      const [closeTarget, diff, isAligned] = res;
      if (closeTarget !== undefined && targetPointClose !== closeTarget) {
        if (targetPoints[closeTarget].captured) return;

        meshRefs.current[closeTarget].scale.set(1 * diff, 1 * diff, 1 * diff);

        // Reset timer when switching to a different target
        if (currentTimingTarget !== closeTarget) {
          startTime = 0;
          currentTimingTarget = closeTarget;
        }

        if (isAligned) {
          materialRefs.current[closeTarget].color.lerp(white, 0.1);

          if (startTime === 0) {
            startTime = performance.now();
          }

          if (
            !isCapturing &&
            startTime &&
            performance.now() - startTime >= 0.8
          ) {
            isCapturing = true;

            handleCapture(camera.clone(), closeTarget).then((_) => {
              isCapturing = false;
              targetPointClose = closeTarget;
              meshRefs.current[closeTarget].scale.set(0, 0, 0);
              materialRefs.current[closeTarget].color.lerp(green, 1);
              // Reset alignment state after capture
              startTime = 0;
              currentTimingTarget = -1;
            });
          }
        } else {
          // Not aligned: reset timer
          startTime = 0;
          currentTimingTarget = -1;
          materialRefs.current[closeTarget].color.lerp(green, 0.1);
        }
      }
      // Remove this line: startTime = 0; - This was causing the timer to reset every frame
    } else {
      // No target found, reset timer
      startTime = 0;
      currentTimingTarget = -1;
    }

    if (
      Math.abs(camera.rotation.x) <= 1.5 &&
      Math.abs(camera.rotation.x) >= 1.48 &&
      points.length === 0 &&
      capturingFirstPoint &&
      !targetPoint
    ) {
      capturingFirstPoint = false;
      const nextPoint = getInitialPoint(camera);
      setTargetPoints(() => [
        {
          id: "middle:0",
          position: nextPoint,
          captured: false,
          allowCaptureNext: true,
          quat: camera.quaternion.clone(),
        },
      ]);
    }

    // if (isAligned(camera, targetPoint) && targetPointRef.current?.color) {
    //   targetPointRef.current.color.lerp(
    //     new THREE.Color("rgb(255,255,255)"),
    //     0.1
    //   );
    //   if (!isCapturing) {
    //     isCapturing = true;
    //     console.log("capturing");
    //     handleCapture(camera).then((_) => {
    //       isCapturing = false;
    //     });
    //   }
    // } else {
    //   if (targetPointRef.current?.color)
    //     targetPointRef.current.color.lerp(new THREE.Color("rgb(6,85,53)"), 0.1);
    // }
  });

  return (
    <>
      <axesHelper position={[0, 0, -1]} args={[5]} />
      <mesh position={[0, 0, 0]}>
        <sphereGeometry args={[5, 32, 16]} />
        <meshBasicMaterial
          color="#ffff00"
          side={THREE.DoubleSide}
          transparent={true}
          opacity={0.9}
        />
      </mesh>
      {/* <BlendedPlane /> */}

      {/* <CameraController
        capturedPoints={capturedPoints}
        onReadyToCapture={setIsReadyToCapture}
        captureAngle={CAPTURE_ANGLE}
      /> */}
      {/* Add debug visualization */}
      {points.map((point, i) => (
        <mesh
          key={i}
          position={[point.position.x, point.position.y, point.position.z]}
        >
          <sphereGeometry args={[0.1]} />
          <meshBasicMaterial color="red" />
        </mesh>
      ))}
      {meshRefs.current &&
        targetPoints.map((point, i) => (
          <mesh
            scale={targetPoints.length === 1 ? [1, 1, 1] : [0, 0, 0]}
            ref={(el) => {
              if (el) {
                meshRefs.current[i] = el;
              }
            }}
            key={point.id}
            position={[point.position.x, point.position.y, point.position.z]}
          >
            <sphereGeometry args={[0.1]} />
            <meshBasicMaterial
              ref={(el) => {
                if (el) {
                  materialRefs.current[i] = el;
                }
              }}
              color="pink"
            />
          </mesh>
        ))}

      {/* {points.length === 0 && (
        <mesh position={targetPoint}>
          <sphereGeometry args={[0.1]} />
          <meshBasicMaterial ref={targetPointRef} color="green" />
        </mesh>
      )} */}

      {points.map((p) => (
        <Suspense key={p.key}>
          <group
            rotation={[p.euler.x, p.euler.y, p.euler.z]}
            position={[p.position.x, p.position.y, p.position.z]}
          >
            {p.imageUri && <ImageT src={p.imageUri as any} />}
          </group>
        </Suspense>
      ))}

      <CameraRingTarget distance={1.8} />
    </>
  );
}
