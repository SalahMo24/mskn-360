import * as Location from "expo-location";
import { useEffect, useState } from "react";
import { Coordinates } from "../../types/virtual-tour.type";

const useCoordinates = () => {
  const [coordinates, setCoordinates] = useState<Coordinates>({
    longitude: 0,
    latitude: 0,
  });
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    try {
      setLoading(true);
      setError(null);
      console.log("Requesting location permissions...");

      const { status } = await Location.requestForegroundPermissionsAsync();
      console.log("Location permission status:", status);

      if (status !== "granted") {
        const errorMsg = "Location permission not granted";
        setError(errorMsg);
        console.error(errorMsg);
        return;
      }

      console.log("Getting current position...");
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Highest,
        mayShowUserSettingsDialog: true,
      });

      console.log("Position received:", position.coords);
      setCoordinates({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });
    } catch (e) {
      const errorMsg =
        e instanceof Error ? e.message : "Failed to get location";
      setError(errorMsg);
      console.error("Location error:", errorMsg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Fetch once on mount
    refresh();
  }, []);

  return { coordinates, loading, error, refresh } as const;
};

export default useCoordinates;
