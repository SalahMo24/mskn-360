import { Camera } from "@react-three/fiber";
import { useEffect, useState } from "react";
import * as THREE from "three";
import useCamera from "./camera.hook";
import { SphereGrid, useGridPoints } from "./grid-points.hook";
import useGetTargetPosition from "./target-positions.hook";

export type PhotoPoint = {
  position: THREE.Vector3;
  direction: THREE.Vector3;
  imageUri?: string;
  texture?: THREE.Texture;
  euler: THREE.Euler;
  quat: THREE.Quaternion;
  localUri?: string;
  index: number;
  key: string;
  exif: any;
  id?: string; // id of the grid point captured (e.g., "middle:0")
};

export type CapturePoint = {
  position: {
    hitPoint: THREE.Vector3;
    nextPoint:
      | {
          leftDirection: TargetPointsType;
          upDirection: TargetPointsType;
          downDirection: TargetPointsType;
          secondUpDirection: TargetPointsType;
          secondDownDirection: TargetPointsType;
        }
      | undefined;
  };
  direction: THREE.Vector3;
  imageUri: string | undefined;
  localUri?: string;
  texture?: THREE.Texture;
  euler: THREE.Euler;
  quat: THREE.Quaternion;
  exif: any;
};

export type TargetPointsType = {
  id: string;
  position: THREE.Vector3;
  allowCaptureNext: boolean;
  captured: boolean;
  quat: THREE.Quaternion;
};

export type CameraType = Camera & {
  manual?: boolean | undefined;
};

let grid: SphereGrid | null = null;

const useCaptureImage = () => {
  const [points, setPoints] = useState<PhotoPoint[]>([]);
  const [targetPoint, setTargetPoint] = useState<THREE.Vector3>();
  const [targetPoints, setTargetPoints] = useState<TargetPointsType[]>([]);
  const { getPoints, isAligned, getClosestPoint } = useGetTargetPosition();
  const { captureImage, cameraRef } = useCamera();
  const TOTAL_POINTS_TO_CAPTURE = 29;

  const { generateSphereGrid, canCapture, getAvailablePoints } =
    useGridPoints();

  // const gridRef = useRef<SphereGrid | null>(null);

  useEffect(() => {
    grid = null;
  }, []);

  const refreshAvailable = (capturedPointIndex: number) => {
    try {
      if (!grid) return;
      const avail = getAvailablePoints(grid);

      const newTargets = targetPoints.map((pnt, i) => {
        if (i === capturedPointIndex) {
          return { ...pnt, captured: true };
        }
        return pnt;
      });

      for (const p of avail) {
        if (newTargets.some((itm) => itm.id === p.id)) continue;
        newTargets.push({
          id: p.id,
          position: p.position.clone(),
          captured: p.captured,
          allowCaptureNext: true,
          quat: p.quat.clone(),
        });
      }

      setTargetPoints(() => newTargets);
    } catch (error) {
      console.log("error", error);
    }
  };

  const capture = async (camera: CameraType) => {
    const quat = camera.quaternion.clone();
    const direction = new THREE.Vector3(0, 0, -1)
      .applyQuaternion(quat)
      .normalize();
    const euler = new THREE.Euler().setFromQuaternion(quat);

    const res = await captureImage(); // from Expo Camera

    return {
      position: getPoints(camera),
      direction,
      imageUri: res?.texture,
      euler,
      quat,
      localUri: res?.uri,
      exif: res?.exif,
    };
  };

  const handleCapturePoint = (
    captureFn: (camera: CameraType) => Promise<CapturePoint>
  ) => {
    return async (camera: CameraType, capturedPointIndex: number) => {
      // if (!isAligned(camera, targetPoint)) return;
      const {
        position,
        direction,
        imageUri,
        texture,
        euler,
        quat,
        localUri,
        exif,
      } = await captureFn(camera);
      // if (!isAligned(camera, targetPoint)) return;
      const key = `${new Date().getTime()}-index-${capturedPointIndex}`;
      // Determine id of the captured grid point if available
      const capturedId =
        targetPoints && targetPoints[capturedPointIndex]
          ? targetPoints[capturedPointIndex].id
          : undefined;

      setPoints((prev) => [
        ...prev,
        {
          position: position.hitPoint,
          direction,
          imageUri,
          texture,
          euler,
          quat,
          localUri,
          exif,
          index: capturedPointIndex,
          key,
          id: capturedId,
        },
      ]);

      if (!grid) {
        grid = generateSphereGrid(quat);
      } else {
        const id = targetPoints[capturedPointIndex].id;

        if (id) {
          const p = grid.allPoints.get(id);

          if (p) p.captured = true;
        }
      }
      refreshAvailable(capturedPointIndex);

      // const newTargetPoints = targetPoints.map((itm, i) => {
      //   if (i === capturedPointIndex)
      //     return {
      //       position: itm.position,
      //       captured: true,
      //       allowCaptureNext: itm.allowCaptureNext,
      //       quat: itm.quat,
      //     };
      //   return itm;
      // });

      // if (
      //   targetPoints[capturedPointIndex].allowCaptureNext &&
      //   position.nextPoint
      // ) {
      //   newTargetPoints.push(
      //     position.nextPoint.upDirection,
      //     position.nextPoint.secondUpDirection,
      //     position.nextPoint.downDirection,
      //     position.nextPoint.secondDownDirection,
      //     position.nextPoint.leftDirection
      //   );
      // }

      // setTargetPoints(() => [...newTargetPoints]);
    };
  };

  const handleCapture = async (
    camera: CameraType,
    capturedPointIndex: number
  ) => {
    const captureFn =
      // points.length > 0
      handleCapturePoint(capture);
    // : handleCaptureFirstPoint(capture);

    await captureFn(camera, capturedPointIndex);
  };

  const recomputeTargets = () => {
    try {
      if (!grid) {
        setTargetPoints([]);
        return;
      }
      const newTargets: TargetPointsType[] = [];
      // Keep all captured points for visualization/prevention
      for (const point of grid.allPoints.values()) {
        if (point.captured) {
          newTargets.push({
            id: point.id,
            position: point.position.clone(),
            captured: true,
            allowCaptureNext: true,
            quat: point.quat.clone(),
          });
        }
      }

      // Add currently available (unlocked) points
      const avail = getAvailablePoints(grid);
      for (const p of avail) {
        if (!newTargets.some((t) => t.id === p.id)) {
          newTargets.push({
            id: p.id,
            position: p.position.clone(),
            captured: false,
            allowCaptureNext: true,
            quat: p.quat.clone(),
          });
        }
      }

      setTargetPoints(() => newTargets);
    } catch (error) {
      console.log("recomputeTargets error", error);
    }
  };

  const undoLastPoint = () => {
    setPoints((prev) => {
      if (!prev || prev.length === 0) return prev;
      const newPoints = prev.slice(0, -1);
      const removedPoint = prev[prev.length - 1];

      // If there will be no points left, reset grid to allow reseeding on next frame
      if (newPoints.length === 0) {
        if (grid) {
          // Attempt to unmark the last captured point for cleanliness
          const lastId = removedPoint?.id;
          if (lastId) {
            const gp = grid.allPoints.get(lastId);
            if (gp) gp.captured = false;
          }
        }
        grid = null;
        setTargetPoints([]);
        return newPoints;
      }

      // Unmark the corresponding grid point as not captured
      if (grid) {
        let idToUncapture = removedPoint?.id;
        // Fallback: try to resolve via current targetPoints index if id is missing
        if (!idToUncapture && targetPoints && removedPoint) {
          const maybe = targetPoints[removedPoint.index];
          if (maybe) idToUncapture = maybe.id;
        }
        if (idToUncapture) {
          const p = grid.allPoints.get(idToUncapture);
          if (p) p.captured = false;
        }
      }

      // Recompute available/captured target points after the change
      recomputeTargets();

      return newPoints;
    });
  };

  return {
    points,
    targetPoint,
    handleCapture,
    cameraRef,
    isAligned,
    setTargetPoint,
    targetPoints,
    setTargetPoints,
    getClosestPoint,

    undoLastPoint,
    TOTAL_POINTS_TO_CAPTURE,
  };
};

export default useCaptureImage;
