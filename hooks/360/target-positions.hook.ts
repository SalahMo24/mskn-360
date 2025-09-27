import * as THREE from "three";
import { TargetPointsType } from "./capture-image.hook";

let polesPoints = true;
const useGetTargetPosition = () => {
  function getTarget(quaternion: any) {
    // Get camera's forward direction
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(quaternion);

    // Point 2 units forward
    const hitPoint = new THREE.Vector3()
      .copy(forward)
      .normalize()
      .multiplyScalar(2); // wall is 2 units away

    return hitPoint;
  }

  function getNextTarget(camera: any) {
    const currentDirection = new THREE.Vector3(0, 0, -1).applyQuaternion(
      camera.quaternion
    );
    const cameraUp = new THREE.Vector3(0, 1, 0).applyQuaternion(
      camera.quaternion
    ); // local up

    // Create a rotation of -X° around the camera's local up
    const leftTurn = new THREE.Quaternion().setFromAxisAngle(
      cameraUp.normalize(),
      THREE.MathUtils.degToRad(-30)
    );

    // Apply it to the current forward direction
    const nextDirection = currentDirection.clone().applyQuaternion(leftTurn);
    const nextPoint = nextDirection.clone().normalize().multiplyScalar(2);
    return nextPoint;
  }
  function getNextTargetVerticle(camera: any) {
    const currentDirection = new THREE.Vector3(0, 0, -1).applyQuaternion(
      camera.quaternion
    );
    const cameraUp = new THREE.Vector3(1, 0, 0).applyQuaternion(
      camera.quaternion
    ); // local up

    // Create a rotation of -X° around the camera's local up
    const leftTurn = new THREE.Quaternion().setFromAxisAngle(
      cameraUp.normalize(),
      THREE.MathUtils.degToRad(35)
    );

    // Apply it to the current forward direction
    const nextDirection = currentDirection.clone().applyQuaternion(leftTurn);
    const nextPoint = nextDirection.clone().normalize().multiplyScalar(2);
    return nextPoint;
  }

  const getQuaternionAngle = (
    q1: THREE.Quaternion,
    q2: THREE.Quaternion
  ): number => {
    const qd = q1.clone().invert().multiply(q2);
    return (
      2 * Math.atan2(Math.sqrt(qd.x * qd.x + qd.y * qd.y + qd.z * qd.z), qd.w)
    );
  };

  const getClosestPoint = (
    camera: THREE.Camera,
    targetPoints?: TargetPointsType[],
    alignmentThreshold = 10
  ): [number, number, boolean] | undefined => {
    if (!targetPoints) return;
    const secondAlignmentThreshold = 3;

    const cameraForward = new THREE.Vector3(0, 0, -1)
      .applyQuaternion(camera.quaternion)
      .normalize();

    let closestPoint = -1;
    let maxOverlapPercentage = 0;
    let secondMaxOverlapPercentage = 0;
    let isAligned = false;

    targetPoints.forEach((pnt, index) => {
      if (pnt.captured) return;
      const directionToTarget = pnt.position
        .clone()
        .sub(camera.position)
        .normalize();
      const cosThreshold = Math.cos(
        THREE.MathUtils.degToRad(alignmentThreshold)
      );
      const secondCosThreshold = Math.cos(
        THREE.MathUtils.degToRad(secondAlignmentThreshold)
      );
      const forward = cameraForward.dot(directionToTarget);

      // If within the threshold, compute overlap percentage
      if (forward > cosThreshold) {
        // Normalize `forward` to [0, 1] relative to the threshold
        const normalizedOverlap = (forward - cosThreshold) / (1 - cosThreshold);
        const secondNormalizedOverlap =
          (forward - secondCosThreshold) / (1 - secondCosThreshold);
        const overlapPercentage = Math.min(1, Math.max(0, normalizedOverlap));
        const secondOverlapPercentage = Math.min(
          1,
          Math.max(0, secondNormalizedOverlap)
        );

        if (overlapPercentage > maxOverlapPercentage) {
          maxOverlapPercentage = overlapPercentage;
          secondMaxOverlapPercentage = secondOverlapPercentage;
          closestPoint = index;

          isAligned = secondMaxOverlapPercentage > 0.99;
        }
      }
    });

    return closestPoint !== -1
      ? [closestPoint, maxOverlapPercentage, isAligned]
      : undefined;
  };

  // Hybrid approach: Direction-based with quaternion refinement
  const getClosestPointByOrientation = (
    camera: THREE.Camera,
    targetPoints?: TargetPointsType[],
    alignmentThreshold = 10
  ): [number, number, boolean] | undefined => {
    if (!targetPoints || targetPoints.length === 0) return;
    const secondAlignmentThreshold = 5;

    const cameraForward = new THREE.Vector3(0, 0, -1)
      .applyQuaternion(camera.quaternion)
      .normalize();

    let closestPoint = -1;
    let maxOverlapPercentage = 0;
    let secondMaxOverlapPercentage = 0;
    let isAligned = false;

    targetPoints.forEach((pnt, index) => {
      if (pnt.captured) return;

      // Primary filter: Direction-based (more forgiving for handheld use)
      const directionToTarget = pnt.position
        .clone()
        .sub(camera.position)
        .normalize();
      const cosThreshold = Math.cos(
        THREE.MathUtils.degToRad(alignmentThreshold)
      );
      const secondCosThreshold = Math.cos(
        THREE.MathUtils.degToRad(secondAlignmentThreshold)
      );
      const directionalAlignment = cameraForward.dot(directionToTarget);

      // If directionally aligned, check orientation similarity for refinement
      if (directionalAlignment > cosThreshold) {
        // Get target forward direction from quaternion for orientation refinement
        const targetForward = new THREE.Vector3(0, 0, -1)
          .applyQuaternion(pnt.quat)
          .normalize();

        // Compare forward directions (ignores roll, focuses on pointing direction)
        const orientationAlignment = cameraForward.dot(targetForward);

        // Combine directional and orientation alignment (weighted toward direction)
        const combinedAlignment =
          directionalAlignment * 0.7 + orientationAlignment * 0.3;

        const normalizedOverlap =
          (combinedAlignment - cosThreshold) / (1 - cosThreshold);
        const secondNormalizedOverlap =
          (combinedAlignment - secondCosThreshold) / (1 - secondCosThreshold);

        const overlapPercentage = Math.min(1, Math.max(0, normalizedOverlap));
        const secondOverlapPercentage = Math.min(
          1,
          Math.max(0, secondNormalizedOverlap)
        );

        if (overlapPercentage > maxOverlapPercentage) {
          maxOverlapPercentage = combinedAlignment;
          secondMaxOverlapPercentage = secondOverlapPercentage;
          closestPoint = index;

          isAligned = combinedAlignment > 0.97; // More achievable threshold
        }

        console.log(
          `Point ${index}: dir=${directionalAlignment.toFixed(
            3
          )}, orient=${orientationAlignment.toFixed(
            3
          )}, combined=${combinedAlignment.toFixed(
            3
          )}, score=${overlapPercentage.toFixed(3)}`,
          "isAligned",
          isAligned,
          "maxOverlapPercentage",
          maxOverlapPercentage
        );
      }
    });

    return closestPoint !== -1
      ? [closestPoint, maxOverlapPercentage, isAligned]
      : undefined;
  };

  const isAligned = (
    camera: THREE.Camera,
    targetPoint?: THREE.Vector3,
    alignmentThreshold = 2
  ): boolean => {
    if (!targetPoint) return false;
    const cameraForward = new THREE.Vector3(0, 0, -1)
      .applyQuaternion(camera.quaternion)
      .normalize();
    const directionToTarget = targetPoint
      .clone()
      .sub(camera.position)
      .normalize();
    const cosThreshold = Math.cos(THREE.MathUtils.degToRad(alignmentThreshold));
    return cameraForward.dot(directionToTarget) > cosThreshold;
  };

  const horizontalRotation = (quat: THREE.Quaternion) =>
    new THREE.Vector3(0, 1, 0).applyQuaternion(quat);
  const verticleRotation = (quat: THREE.Quaternion) =>
    new THREE.Vector3(1, 0, 0).applyQuaternion(quat);

  // Extract roll angle from quaternion (rotation around forward axis)
  const getRollFromQuaternion = (quat: THREE.Quaternion): number => {
    // Get camera's right vector (local X-axis) in world space
    const rightVector = new THREE.Vector3(1, 0, 0).applyQuaternion(quat);

    // Get camera's forward vector to project right vector onto correct plane
    const forwardVector = new THREE.Vector3(0, 0, -1).applyQuaternion(quat);

    // Project right vector onto the vertical plane perpendicular to forward
    const forwardDot = rightVector.dot(forwardVector);
    const rightProjected = rightVector
      .clone()
      .sub(forwardVector.clone().multiplyScalar(forwardDot))
      .normalize();

    // Compare with world right vector projected onto same plane
    const worldRight = new THREE.Vector3(1, 0, 0);
    const worldForwardDot = worldRight.dot(forwardVector);
    const worldRightProjected = worldRight
      .clone()
      .sub(forwardVector.clone().multiplyScalar(worldForwardDot))
      .normalize();

    // Calculate roll angle
    const cosAngle = Math.max(
      -1,
      Math.min(1, rightProjected.dot(worldRightProjected))
    );
    const rollRadians = Math.acos(cosAngle);

    // Determine sign using cross product
    const cross = rightProjected.clone().cross(worldRightProjected);
    const sign = cross.dot(forwardVector) > 0 ? 1 : -1;

    return sign * THREE.MathUtils.radToDeg(rollRadians);
  };

  // Check if current camera roll is aligned with target roll
  const isRollAligned = (
    currentQuat: THREE.Quaternion,
    targetQuat: THREE.Quaternion,
    rollThresholdDegrees: number = 10
  ): boolean => {
    const currentRoll = getRollFromQuaternion(currentQuat);
    const targetRoll = getRollFromQuaternion(targetQuat);

    const rollDifference = Math.abs(currentRoll - targetRoll);

    // Handle angle wrapping (e.g., -179° vs +179° should be considered close)
    const wrappedDifference = Math.min(rollDifference, 360 - rollDifference);

    return wrappedDifference <= rollThresholdDegrees;
  };

  // Get roll alignment score (0-1, where 1 is perfect alignment)
  const getRollAlignmentScore = (
    currentQuat: THREE.Quaternion,
    targetQuat: THREE.Quaternion,
    maxRollDifference: number = 15
  ): number => {
    const currentRoll = getRollFromQuaternion(currentQuat);
    const targetRoll = getRollFromQuaternion(targetQuat);

    const rollDifference = Math.abs(currentRoll - targetRoll);
    const wrappedDifference = Math.min(rollDifference, 360 - rollDifference);

    // Convert to 0-1 score (1 = perfect, 0 = max difference)
    return Math.max(0, 1 - wrappedDifference / maxRollDifference);
  };

  // Enhanced hybrid function with roll alignment
  const getClosestPointWithRollAlignment = (
    camera: THREE.Camera,
    targetPoints?: TargetPointsType[],
    alignmentThreshold = 15,
    rollThreshold = 10
  ): [number, number, boolean] | undefined => {
    if (!targetPoints || targetPoints.length === 0) return;
    const secondAlignmentThreshold = 5;

    const cameraForward = new THREE.Vector3(0, 0, -1)
      .applyQuaternion(camera.quaternion)
      .normalize();

    let closestPoint = -1;
    let maxOverlapPercentage = 0;
    let secondMaxOverlapPercentage = 0;
    let isAligned = false;

    targetPoints.forEach((pnt, index) => {
      if (pnt.captured) return;

      // Primary filter: Direction-based alignment
      const directionToTarget = pnt.position
        .clone()
        .sub(camera.position)
        .normalize();
      const cosThreshold = Math.cos(
        THREE.MathUtils.degToRad(alignmentThreshold)
      );
      const secondCosThreshold = Math.cos(
        THREE.MathUtils.degToRad(secondAlignmentThreshold)
      );
      const directionalAlignment = cameraForward.dot(directionToTarget);

      // If directionally aligned, check orientation and roll
      if (directionalAlignment > cosThreshold) {
        // Get target forward direction from quaternion
        const targetForward = new THREE.Vector3(0, 0, -1)
          .applyQuaternion(pnt.quat)
          .normalize();

        // Compare forward directions (ignores roll)
        const orientationAlignment = cameraForward.dot(targetForward);

        // Check roll alignment
        const rollScore = getRollAlignmentScore(
          camera.quaternion,
          pnt.quat,
          rollThreshold
        );
        const rollAligned = isRollAligned(
          camera.quaternion,
          pnt.quat,
          rollThreshold
        );

        // Combine all alignments: 50% direction, 30% orientation, 20% roll
        const combinedAlignment =
          directionalAlignment * 0.5 +
          orientationAlignment * 0.3 +
          rollScore * 0.2;

        const normalizedOverlap =
          (combinedAlignment - cosThreshold) / (1 - cosThreshold);
        const secondNormalizedOverlap =
          (combinedAlignment - secondCosThreshold) / (1 - secondCosThreshold);

        const overlapPercentage = Math.min(1, Math.max(0, normalizedOverlap));
        const secondOverlapPercentage = Math.min(
          1,
          Math.max(0, secondNormalizedOverlap)
        );

        if (overlapPercentage > maxOverlapPercentage) {
          maxOverlapPercentage = overlapPercentage;
          secondMaxOverlapPercentage = secondOverlapPercentage;
          closestPoint = index;

          // Require both alignment and roll alignment for capture
          isAligned = secondMaxOverlapPercentage > 0.95 && rollAligned;
        }

        console.log(
          `Point ${index}: dir=${directionalAlignment.toFixed(
            3
          )}, orient=${orientationAlignment.toFixed(
            3
          )}, roll=${rollScore.toFixed(
            3
          )}, combined=${combinedAlignment.toFixed(
            3
          )}, rollAligned=${rollAligned}`,
          "rollScore",
          rollScore,
          "quats",
          camera.quaternion,
          pnt.quat
        );
      }
    });

    return closestPoint !== -1
      ? [closestPoint, maxOverlapPercentage, isAligned]
      : undefined;
  };

  // Check if phone is tilted too much on Z-axis (excessive roll)
  const isPhoneTiltedTooMuch = (
    cameraQuat: THREE.Quaternion,
    maxTiltDegrees: number = 20
  ): boolean => {
    const rollAngle = Math.abs(getRollFromQuaternion(cameraQuat));
    return rollAngle > maxTiltDegrees;
  };

  // Get detailed tilt information for user feedback
  const getTiltInfo = (cameraQuat: THREE.Quaternion) => {
    const rollAngle = getRollFromQuaternion(cameraQuat);

    return {
      rollDegrees: rollAngle,
      isExcessivelyTilted: Math.abs(rollAngle) > 20,
      tiltDirection: rollAngle > 0 ? "clockwise" : "counterclockwise",
      tiltSeverity:
        Math.abs(rollAngle) > 30
          ? "severe"
          : Math.abs(rollAngle) > 15
          ? "moderate"
          : "slight",
    };
  };

  const getNextPoints = (
    capturedPointQuat: THREE.Quaternion
  ): {
    leftDirection: TargetPointsType;
    upDirection: TargetPointsType;
    downDirection: TargetPointsType;
    secondUpDirection: TargetPointsType;
    secondDownDirection: TargetPointsType;
  } => {
    const upwardRotation = 40;
    const downwardRotation = -40;
    const leftRotation = -28;
    const northPoleRotation = 90;
    const southPoleRotation = -90;

    const currentDirection = new THREE.Vector3(0, 0, -1).applyQuaternion(
      capturedPointQuat
    );

    const horizontalUp = horizontalRotation(capturedPointQuat);
    const verticalUp = verticleRotation(capturedPointQuat);

    // Create a rotation of -X° around the camera's local up
    const leftTurn = new THREE.Quaternion().setFromAxisAngle(
      horizontalUp.normalize(),
      THREE.MathUtils.degToRad(leftRotation)
    );
    const upTurn = new THREE.Quaternion().setFromAxisAngle(
      verticalUp.normalize(),
      THREE.MathUtils.degToRad(upwardRotation)
    );
    const secondUpTurn = new THREE.Quaternion().setFromAxisAngle(
      verticalUp.normalize(),
      THREE.MathUtils.degToRad(northPoleRotation)
    );
    const downTurn = new THREE.Quaternion().setFromAxisAngle(
      verticalUp.normalize(),
      THREE.MathUtils.degToRad(downwardRotation)
    );
    const secondDownTurn = new THREE.Quaternion().setFromAxisAngle(
      verticalUp.normalize(),
      THREE.MathUtils.degToRad(southPoleRotation)
    );

    // Apply it to the current forward direction
    const leftDirection = currentDirection
      .clone()
      .applyQuaternion(leftTurn)
      .normalize()
      .multiplyScalar(2);
    const upDirection = currentDirection
      .clone()
      .applyQuaternion(upTurn)
      .normalize()
      .multiplyScalar(2);
    const secondUpDirection = currentDirection
      .clone()
      .applyQuaternion(secondUpTurn)
      .normalize()
      .multiplyScalar(2);
    const downDirection = currentDirection
      .clone()
      .applyQuaternion(downTurn)
      .normalize()
      .multiplyScalar(2);
    const secondDownDirection = currentDirection
      .clone()
      .applyQuaternion(secondDownTurn)
      .normalize()
      .multiplyScalar(2);

    const points = {
      leftDirection: {
        id: "leftDirection",
        position: leftDirection,
        captured: false,
        allowCaptureNext: true,
        quat: capturedPointQuat.clone().multiply(leftTurn),
      },
      upDirection: {
        id: "upDirection",
        position: upDirection,
        captured: false,
        allowCaptureNext: false,
        quat: capturedPointQuat.clone().multiply(upTurn),
      },
      secondUpDirection: {
        id: "secondUpDirection",
        position: secondUpDirection,
        captured: true,
        allowCaptureNext: false,
        quat: capturedPointQuat.clone().multiply(secondUpTurn),
      },
      downDirection: {
        id: "downDirection",
        position: downDirection,
        captured: false,
        allowCaptureNext: false,
        quat: capturedPointQuat.clone().multiply(downTurn),
      },
      secondDownDirection: {
        id: "secondDownDirection",
        position: secondDownDirection,
        captured: true,
        allowCaptureNext: false,
        quat: capturedPointQuat.clone().multiply(secondDownTurn),
      },
    };

    if (polesPoints) {
      points.secondUpDirection.captured = false;
      points.secondDownDirection.captured = false;
      polesPoints = false;
    }

    return points;
  };

  // Assume TargetPointsType is defined elsewhere as before

  const getPoints = (camera: any) => {
    const hitPoint = getTarget(camera.quaternion);
    const nextPoint = getNextPoints(camera.quaternion);
    // const hitPoint = getTarget(camera);
    // const nextPoint = getNextPoints(camera);

    return { hitPoint, nextPoint };
  };
  return {
    getTarget,
    getNextTarget,
    getPoints,
    isAligned,
    getNextTargetVerticle,
    getClosestPoint,
    getClosestPointWithRollAlignment,
    getRollFromQuaternion,
    isRollAligned,
    getRollAlignmentScore,
    isPhoneTiltedTooMuch,
    getTiltInfo,
  };
};

export default useGetTargetPosition;
