import { CameraView } from "expo-camera";
import { useRef } from "react";

import * as ImageManipulator from "expo-image-manipulator";
import { Asset } from "expo-asset";
import * as ExpoTHREE from "expo-three";

const useCamera = () => {
  const cameraRef = useRef<CameraView>(null);

  const loadAndProcessAsset = async (uri: string) => {
    try {
      // Get asset for the texture
      const asset = Asset.fromModule(uri);
      if (!asset.localUri) {
        // Download the asset if it doesn't have a local URI
        await asset.downloadAsync();
      }
      // Get the dimensions directly from the Asset object
      const { width, height } = asset;

      // Check if the file exists
      const resized = await ImageManipulator.ImageManipulator.manipulate(
        asset?.localUri || ""
      )
        .resize({ width: 900, height: 1200 })
        .renderAsync();
      // Create a new Asset using the file URI
      const img = await resized.saveAsync();

      const copiedAsset = Asset.fromURI(img.uri);

      copiedAsset.height = height;
      copiedAsset.width = width;

      // Continue with loading or processing the asset
      const texture = await ExpoTHREE.loadAsync(copiedAsset);
      return texture;
    } catch (e) {
      console.log(e);
    }
  };

  // Later in your button:
  const captureImage = async () => {
    if (cameraRef.current) {
      const photo = await cameraRef.current.takePictureAsync({
        base64: false,
        shutterSound: false,
        skipProcessing: false,
        exif: true,
      });
      // const path = await move(photo?.uri);

      // console.log(path);
      // const resized = await ImageManipulator.ImageManipulator.manipulate(
      //   photo?.uri || ""
      // )
      //   .resize({ width: 1024 })
      //   .renderAsync();
      // const img = (await resized.saveAsync());
      // console.log(photo?.uri);
      // const asset = Asset.fromURI(photo?.uri || "");
      // await asset.downloadAsync();
      const texture = await loadAndProcessAsset(photo?.uri || "");
      return {
        texture,
        uri: photo?.uri,
        exif: photo?.exif,
      };
    }
  };

  return { captureImage, cameraRef };
};

export default useCamera;
