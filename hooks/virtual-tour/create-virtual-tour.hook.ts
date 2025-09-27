import Constants from "expo-constants";
import { useState } from "react";
import { VirtualTourCreate } from "../../types/virtual-tour.type";
import useCoordinates from "./coordinates.hook";

const createVirtualTourUrl = `${Constants.expoConfig?.extra?.API_URL}/virtual-tour`;
console.log("createVirtualTourUrl", createVirtualTourUrl);
const useCreateVirtualTour = () => {
  const {
    coordinates,
    loading: coordinatesLoading,
    error: coordinatesError,
  } = useCoordinates();
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  const createVirtualTour = async (virtualTour: VirtualTourCreate) => {
    setIsCreating(true);
    setError(null);
    const EMPLOYEE_ID = 2;
    const STORE_ID = 16;
    const CREATED_BY = "Kaladin";

    console.log("coordinates", coordinates);
    console.log("coordinatesLoading", coordinatesLoading);
    console.log("coordinatesError", coordinatesError);

    // Validate coordinates before proceeding
    if (coordinates.latitude === 0 && coordinates.longitude === 0) {
      const errorMsg =
        coordinatesError ||
        "Unable to get current location. Please check your location permissions and try again.";
      setError(new Error(errorMsg));
      setIsCreating(false);
      return;
    }

    try {
      const response = await fetch(createVirtualTourUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...virtualTour,
          coordinates: coordinates,
          employee_id: EMPLOYEE_ID,
          store_id: STORE_ID,
          created_by: CREATED_BY,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create virtual tour");
      }

      const data = await response.json();
      return data;
    } catch (error) {
      setError(error as Error);
    } finally {
      setIsCreating(false);
    }
  };

  return { isCreating, error, createVirtualTour };
};
export default useCreateVirtualTour;
