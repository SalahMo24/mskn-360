import * as MediaLibrary from "expo-media-library";
import { Asset } from "expo-asset";

const useSaveImages = () => {
  const saveImages = async (uris?: string[]) => {
    if (!uris) return;

    console.log(uris);
    // return saveImage(uris[0]);
    const res = uris.map(async (uri) => {
      const id = await saveImage(uri);
      return id;
    });
    return Promise.all(res);
  };
  const saveImage = async (img: string) => {
    console.log(typeof img == "string");
    try {
      console.log(img);
      const asset = Asset.fromModule(img);
      if (!asset.localUri) {
        // Download the asset if it doesn't have a local URI
        await asset.downloadAsync();
      }
      console.log(asset.localUri);
      if (!asset.localUri) return;
      const res = await MediaLibrary.createAssetAsync(asset.localUri);
      console.log(res);
      return res.id;
    } catch (error) {
      console.log("sss", error);
    }
  };

  return { saveImages };
};

export default useSaveImages;
