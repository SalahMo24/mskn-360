import { useState } from "react";
import * as THREE from "three";

interface StitchImagesResponse {
  stitchImages: (
    imageUrls: {
      url: string;
      quat: THREE.QuaternionTuple;
      euler: THREE.EulerTuple;
    }[]
  ) => Promise<string>;
  isStitching: boolean;
  error: Error | null;
}

export default function useStitchImages(
  stitchingServiceUrl: string
): StitchImagesResponse {
  const [isStitching, setIsStitching] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const stitchImages = async (
    imageUrls: {
      url: string;
      quat: THREE.QuaternionTuple;
      euler: THREE.EulerTuple;
    }[]
  ): Promise<string> => {
    setIsStitching(true);
    setError(null);

    /**
     * {"euler": {"_order": "XYZ", "_x": -1.3984792473463348, "_y": -1.5056040464499754, "_z": -2.9758428788731903, "isEuler": true}, "quat": [Array], "url": undefined}, {"euler": {"_order": "XYZ", "_x": -1.5605459610760701, "_y": -0.9928422312295603, "_z": -3.07002052708264, "isEuler": true}, "quat": [Array], "url": undefined}, {"euler": {"_order": "XYZ", "_x": -1.6072384027582256, "_y": -0.47841782700760477, "_z": -3.1148736637402057, "isEuler": true}, "quat": [Array], "url": undefined}, {"euler": {"_order": "XYZ", "_x": -1.6320160999845303, "_y": 0.049428065144048856, "_z": 3.075323057597023, "isEuler": true}, "quat": [Array], "url": undefined}
     */

    try {
      console.log("stitching service url", stitchingServiceUrl);
      const response = await fetch(stitchingServiceUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          image_data: imageUrls.map((url) => ({
            url: url.url,
            quat: url.quat,
            euler: url.euler,
          })),
        }),
      });
      console.log("stitching response", response);

      if (!response.ok) {
        throw new Error("Failed to stitch images");
      }

      const data = await response.json();
      return data.stitchedImageUrl;
    } catch (err) {
      console.log(" error", JSON.stringify(err, null, 2));
      setError(
        err instanceof Error ? err : new Error("Failed to stitch images")
      );
      throw err;
    } finally {
      setIsStitching(false);
    }
  };

  return {
    stitchImages,
    isStitching,
    error,
  };
}
