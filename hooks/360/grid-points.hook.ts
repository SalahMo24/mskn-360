import * as THREE from "three";

export type CapturePoint = {
  id: string;
  quat: THREE.Quaternion;
  position: THREE.Vector3;
  captured: boolean;
  neighbors: string[]; // all neighbors
  unlockParents: string[]; // only these unlock the point
};

export type SphereGrid = {
  bands: Record<string, CapturePoint[]>;
  allPoints: Map<string, CapturePoint>;
};

export const useGridPoints = () => {
  const generateSphereGrid = (firstQuat: THREE.Quaternion): SphereGrid => {
    const middleCount = 11;
    const upperCount = 8;
    const lowerCount = 8;

    const bandAngles = {
      middle: 0,
      upper: 45,
      lower: -45,
      north: 90,
      south: -90,
    };

    const forward = new THREE.Vector3(0, 0, -1);

    const makePoint = (id: string, quat: THREE.Quaternion): CapturePoint => {
      const dir = forward.clone().applyQuaternion(quat).normalize();
      return {
        id,
        quat: quat.clone(),
        position: dir.clone().multiplyScalar(2),
        captured: false,
        neighbors: [],
        unlockParents: [], // who can unlock this point
      };
    };

    const bands: Record<string, CapturePoint[]> = {
      middle: [],
      upper: [],
      lower: [],
      north: [],
      south: [],
    };

    // ---------- Middle band ----------
    for (let i = 0; i < middleCount; i++) {
      const azimuth = (i / middleCount) * Math.PI * 2;
      const spin = new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(0, 1, 0),
        azimuth
      );
      const quat = firstQuat.clone().multiply(spin);
      bands.middle.push(makePoint(`middle:${i}`, quat));
    }

    // ---------- Upper band ----------
    for (let i = 0; i < upperCount; i++) {
      const azimuth = (i / upperCount) * Math.PI * 2;
      const spin = new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(0, 1, 0),
        azimuth
      );
      const tilt = new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(1, 0, 0),
        THREE.MathUtils.degToRad(bandAngles.upper)
      );
      const quat = firstQuat.clone().multiply(spin).multiply(tilt);
      bands.upper.push(makePoint(`upper:${i}`, quat));
    }

    // ---------- Lower band ----------
    for (let i = 0; i < lowerCount; i++) {
      const azimuth = (i / lowerCount) * Math.PI * 2;
      const spin = new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(0, 1, 0),
        azimuth
      );
      const tilt = new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(1, 0, 0),
        THREE.MathUtils.degToRad(bandAngles.lower)
      );
      const quat = firstQuat.clone().multiply(spin).multiply(tilt);
      bands.lower.push(makePoint(`lower:${i}`, quat));
    }

    // ---------- Poles ----------
    {
      const tiltNorth = new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(1, 0, 0),
        THREE.MathUtils.degToRad(bandAngles.north)
      );
      const tiltSouth = new THREE.Quaternion().setFromAxisAngle(
        new THREE.Vector3(1, 0, 0),
        THREE.MathUtils.degToRad(bandAngles.south)
      );
      bands.north.push(
        makePoint("north:0", firstQuat.clone().multiply(tiltNorth))
      );
      bands.south.push(
        makePoint("south:0", firstQuat.clone().multiply(tiltSouth))
      );
    }

    // ---------- Neighbor + unlock graph ----------
    const allPoints = new Map<string, CapturePoint>();
    for (const bandName in bands) {
      for (const p of bands[bandName]) {
        allPoints.set(p.id, p);
      }
    }

    // Horizontal neighbors in each ring (wrap-around)
    const linkHorizontals = (ring: CapturePoint[]) => {
      for (let i = 0; i < ring.length; i++) {
        const left = ring[(i - 1 + ring.length) % ring.length];
        const right = ring[(i + 1) % ring.length];
        ring[i].neighbors.push(left.id, right.id);
        ring[i].unlockParents.push(left.id, right.id); // horizontal captures allowed
      }
    };
    linkHorizontals(bands.middle);
    linkHorizontals(bands.upper);
    linkHorizontals(bands.lower);

    // Vertical neighbors (but restrict unlocking rules)
    const linkVerticals = (
      parentRing: CapturePoint[],
      childRing: CapturePoint[],
      childUnlocksOnlyFromParent: boolean
    ) => {
      for (let i = 0; i < parentRing.length; i++) {
        const j =
          Math.round((i / parentRing.length) * childRing.length) %
          childRing.length;
        const parent = parentRing[i];
        const child = childRing[j];

        // neighbor relationship (graph connectivity)
        parent.neighbors.push(child.id);
        child.neighbors.push(parent.id);

        // unlocking: only child can be unlocked by parent
        if (childUnlocksOnlyFromParent) {
          child.unlockParents.push(parent.id);
        } else {
          parent.unlockParents.push(child.id);
          child.unlockParents.push(parent.id);
        }
      }
    };

    // middle unlocks upper/lower
    linkVerticals(bands.middle, bands.upper, true);
    linkVerticals(bands.middle, bands.lower, true);

    // poles: unlocked by any in adjacent ring
    for (const up of bands.upper) {
      bands.north[0].neighbors.push(up.id);
      up.neighbors.push(bands.north[0].id);
      bands.north[0].unlockParents.push(up.id);
    }
    for (const down of bands.lower) {
      bands.south[0].neighbors.push(down.id);
      down.neighbors.push(bands.south[0].id);
      bands.south[0].unlockParents.push(down.id);
    }

    // mark very first point as captured
    bands.middle[0].captured = true;

    return { bands, allPoints };
  };

  function canCapture(
    p: CapturePoint,
    grid: Map<string, CapturePoint>
  ): boolean {
    if (p.captured) return false;
    return p.unlockParents.some((id) => grid.get(id)?.captured);
  }

  function getAvailablePoints(grid: SphereGrid): CapturePoint[] {
    const available: CapturePoint[] = [];
    for (const point of grid.allPoints.values()) {
      if (
        !point.captured &&
        point.unlockParents.some((id) => grid.allPoints.get(id)?.captured)
      ) {
        available.push(point);
      }
    }
    return available;
  }

  return { generateSphereGrid, canCapture, getAvailablePoints };
};
