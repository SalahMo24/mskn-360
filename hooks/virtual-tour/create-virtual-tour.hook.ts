import Constants from "expo-constants";
import { useState } from "react";
import {
  VirtualTourCreate,
  VirtualTourResponse,
  VirtualTourSceneType,
  VirtualTourWithScene,
} from "../../types/virtual-tour.type";
import useCoordinates from "./coordinates.hook";

const createVirtualTourUrl = `${Constants.expoConfig?.extra?.API_URL}/virtual-tour`;

const useCreateVirtualTour = () => {
  const { coordinates, error: coordinatesError } = useCoordinates();
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const [isAddingScene, setIsAddingScene] = useState<boolean>(false);
  const [addSceneError, setAddSceneError] = useState<Error | null>(null);
  const EMPLOYEE_ID = 2;
  const STORE_ID = 16;
  const CREATED_BY = "Kaladin";

  const createVirtualTour = async (virtualTour: VirtualTourCreate) => {
    setIsCreating(true);
    setError(null);

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

      console.log("response", response);
      if (!response.ok) {
        throw new Error("Failed to create virtual tour");
      }

      const data: {
        data?: VirtualTourResponse;
        message: string;
        error?: Error;
      } = await response.json();

      console.log("data", data);
      return data;
    } catch (error) {
      setError(error as Error);
    } finally {
      setIsCreating(false);
    }
  };

  const getVirtualTours = async (): Promise<VirtualTourWithScene[]> => {
    console.log("getVirtualTours", createVirtualTourUrl);
    const response = await fetch(
      `${createVirtualTourUrl}?storeId=${STORE_ID}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      throw new Error("Failed to get virtual tours");
    }

    const data = await response.json();
    return data;
  };

  const getVirtualTour = async (
    virtualTourId: string
  ): Promise<VirtualTourWithScene> => {
    const response = await fetch(
      `${createVirtualTourUrl}/${virtualTourId}/scenes`
    );
    const data = await response.json();
    return data;
  };
  const addSceneToVirtualTour = async (
    virtualTourId: string,
    scenes: { image: string; scene: VirtualTourSceneType }[]
  ): Promise<{ data: VirtualTourWithScene; message: string }> => {
    setIsAddingScene(true);
    setAddSceneError(null);
    const response = await fetch(
      `${createVirtualTourUrl}/${virtualTourId}/scenes`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          scenes: scenes,
        }),
      }
    );
    const data = await response.json();
    setIsAddingScene(false);
    setAddSceneError(null);
    return data;
  };

  return {
    isCreating,
    isAddingScene,
    addSceneError,
    error,
    createVirtualTour,
    getVirtualTour,
    getVirtualTours,
    addSceneToVirtualTour,
  };
};
export default useCreateVirtualTour;
