import React, { useEffect, useRef } from "react";
import { Animated } from "react-native";
import useUprightDetection from "../../hooks/360/upright-detection.hook";

const RotateIcon = () => {
  const fadeAnim = useRef(new Animated.Value(0)).current; // Initial opacity: 0
  const { isUpright } = useUprightDetection();

  useEffect(() => {
    return () => {
      fadeAnim.stopAnimation(); // Cleanup
    };
  }, []);

  useEffect(() => {
    // Trigger fade in/out based on `show` prop
    Animated.timing(fadeAnim, {
      toValue: !isUpright ? 0 : 1, // Fade in if `show=true`, out if `show=false`
      duration: 500, // Animation duration (ms)
      useNativeDriver: true, // Better performance
    }).start();
  }, [isUpright]);

  return (
    <Animated.Image
      source={require("../../assets/images/rotate.png")} // Replace with your image source
      style={{
        position: "absolute",
        top: "10%",
        right: "10%",
        width: 42,
        height: 42,
        opacity: fadeAnim, // Bind opacity to animated value
      }}
    />
  );
};

export default RotateIcon;
