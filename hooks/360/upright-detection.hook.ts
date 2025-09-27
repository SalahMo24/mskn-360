import {
  useAnimatedSensor,
  SensorType,
  useDerivedValue,
  runOnJS,
} from "react-native-reanimated";
import { useState, useEffect } from "react";

const useUprightDetection = (thresholdDegrees = 25) => {
  const thresholdRadians = thresholdDegrees * (Math.PI / 180);
  const sensor = useAnimatedSensor(SensorType.ROTATION, { interval: "auto" });
  const [isUpright, setIsUpright] = useState(true);

  // Create a shared value to track the upright state
  const isUprightReanimated = useDerivedValue(() => {
    const { roll } = sensor.sensor.value;

    return Math.abs(roll) > 1;
  }, [thresholdRadians]);

  useEffect(() => {
    // This will run whenever the reanimated value changes
    const id = setInterval(() => {
      runOnJS(setIsUpright)(isUprightReanimated.value);
    }, 16); // ~60fps

    return () => clearInterval(id);
  }, []);

  const currentRollDegrees = () => {
    const { roll } = sensor.sensor.value;
    return roll * (180 / Math.PI);
  };

  return {
    isUpright,
    currentRollDegrees,
  };
};

export default useUprightDetection;
