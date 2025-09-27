import { SensorType, useAnimatedSensor } from "react-native-reanimated";
import * as THREE from "three";

const useRotateObject = ({ object }: { object: any }) => {
  const sensor = useAnimatedSensor(SensorType.ROTATION, {
    interval: "auto",
    adjustToInterfaceOrientation: true,
  });
  let alpha = 0;
  let alphaOffsetAngle = 0;

  const setObjectQuaternion = (function () {
    let zee = new THREE.Vector3(0, 0, 1);

    let euler = new THREE.Euler();

    let q0 = new THREE.Quaternion();

    let q1 = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5)); // - PI/2 around the x-axis

    return function (
      quaternion: THREE.Quaternion,
      alpha: number,
      beta: number,
      gamma: number,
      orient: number
    ) {
      //   object.rotation.order = "YXZ";

      euler.set(beta, alpha, -gamma, "YXZ"); // 'ZXY' for the device, but 'YXZ' for us

      quaternion.setFromEuler(euler); // orient the device

      quaternion.multiply(q1); // camera looks out the back of the device, not the top

      quaternion.multiply(q0.setFromAxisAngle(zee, -orient)); // adjust for screen orientation
    };
  })();

  const update = () => {
    let alphaLocale = sensor.sensor.value.roll
      ? sensor.sensor.value.roll + alphaOffsetAngle
      : 0; // Z

    let beta = sensor.sensor.value.pitch ? sensor.sensor.value.pitch : 0; // X'
    let gamma = sensor.sensor.value.yaw ? sensor.sensor.value.yaw : 0; // Y''
    let orient = sensor.sensor.value.interfaceOrientation
      ? THREE.MathUtils.degToRad(sensor.sensor.value.interfaceOrientation)
      : 0; // O

    setObjectQuaternion(object.quaternion, alphaLocale, beta, gamma, orient);
    alpha = alphaLocale;
  };

  function getCameraVectors() {
    const { qx, qy, qz, qw } = sensor.sensor.value;
    const q = new THREE.Quaternion(qx, qy, qz, qw);

    // Extract forward and up vectors
    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(q); // Camera forward
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(q);

    return { forward, up };
  }

  return {
    getCameraVectors,
  };
};

export default useRotateObject;
