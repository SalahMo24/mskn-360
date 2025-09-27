import { Canvas } from "@react-three/fiber/native";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Pressable,
  Text,
  View,
} from "react-native";

import { CameraView } from "expo-camera";
import useCaptureImage from "../../hooks/360/capture-image.hook";

import RotateIcon from "../../components/360/rotate-icon.component";

import useUploadToS3 from "../../hooks/360/upload-to-s3.hook";

import { Suspense } from "react";
import PanoramaCapture from "./panorama-capture.component";

import * as THREE from "three";

import useCreateVirtualTour from "@/hooks/virtual-tour/create-virtual-tour.hook";
import { VirtualTourSceneType } from "@/types/virtual-tour.type";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SceneContent } from "./pbs";
import { useTextureToPNGWebView } from "./web-view-bridge.component";

export default function Capture360() {
  const { width, height } = Dimensions.get("window");
  const { cameraRef, points, handleCapture, ...rest } = useCaptureImage();

  const { uploadImages, isUploading, getPresignedUrl } = useUploadToS3();
  const { addSceneToVirtualTour, isAddingScene, addSceneError } =
    useCreateVirtualTour();
  const params = useLocalSearchParams();
  const router = useRouter();
  const id = params.id as string;
  const scene = params.scene as VirtualTourSceneType;

  const [project, setProject] = useState(false);

  const { convertBuffer, WebViewBridge } = useTextureToPNGWebView();
  const [preview, setPreview] = useState<string>();
  const [textureBuffer, setTextureBuffer] = useState<Uint8Array>();
  const [exportPanorama, setExportPanorama] = useState(false);

  const handleExportPanoramaWithWebView = async (buffer: Uint8Array) => {
    if (!buffer) return;
    try {
      console.log("[Capture360] convertBuffer call start", {
        len: buffer?.length,
        w: 4096,
        h: 2048,
      });
      // Orientation correction: flip horizontally (mirror fix) and allow yaw tweak if needed
      const res = await convertBuffer(buffer, 4096, 2048, "panorama.png", {
        // WebGL read pixels returns bottom-to-top; flip vertically for canvas/ImageData
        flipX: true,
        flipY: false,
        // Keep yaw as-is to preserve baked texture rotation
        yawOffsetDeg: 0,
      });
      setPreview(res);
      console.log("[Capture360] convertBuffer resolved", res);
      const presignedUrl = await getPresignedUrl("image/png", `${Date.now()}`);
      const url = await uploadImages([res], [presignedUrl.url]);
      console.log("[Capture360] uploadImages resolved", url);
      const data = await addSceneToVirtualTour(id, [
        { image: url[0], scene: scene },
      ]);
      console.log("[Capture360] addSceneToVirtualTour resolved", data);
      console.log(
        "[Capture360] Scene added successfully, navigating back to project details"
      );
      router.replace(`/project-details/${id}` as any);
    } catch (e) {
      console.error("[Capture360] convertBuffer failed", e);
      throw e;
    }
  };

  useEffect(() => {
    if (textureBuffer) {
      handleExportPanoramaWithWebView(textureBuffer);
    }
  }, [textureBuffer]);

  return (
    <>
      <Canvas
        camera={{ position: [0, 0, 0], fov: 90, aspect: width / height }}
        style={{ flex: 1 }}
        gl={{ powerPreference: "default", antialias: false }}
        onCreated={({ gl }) => {
          // Keep color management consistent
          gl.outputColorSpace = THREE.SRGBColorSpace;
          gl.toneMapping = THREE.NoToneMapping;
          // Avoid calling getProgramInfoLog().trim() on platforms where it may return null
          // See error: three.cjs getProgramInfoLog(...).trim() TypeError
          try {
            const anyGl: any = gl as any;
            if (anyGl.debug) {
              anyGl.debug.checkShaderErrors = false;
            } else {
              anyGl.debug = { checkShaderErrors: false };
            }
          } catch {}
        }}
      >
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} />

        {project && (
          <Suspense fallback={null}>
            <SceneContent
              exportPanorama={exportPanorama}
              setTextureBuffer={setTextureBuffer}
              options={{
                thetaMinDeg: 5,
                thetaMaxDeg: 75,
                seamWidth: 0.01,
                useHDR: false,
              }}
              photos={points}
            />
          </Suspense>
        )}

        {!project && (
          <PanoramaCapture
            handleCapture={handleCapture}
            points={points}
            cameraRef={cameraRef}
            {...rest}
          />
        )}
      </Canvas>
      <RotateIcon />
      {preview && (
        <Image source={{ uri: preview }} style={{ width: 100, height: 100 }} />
      )}
      <View
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: -1000,
        }}
      >
        <WebViewBridge />
      </View>

      <CameraView
        ratio="4:3"
        animateShutter={false}
        style={{
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          position: "absolute",
          flex: 1,
          zIndex: -1,
        }}
        ref={(r) => {
          (cameraRef as any).current = r;
        }}
      />

      {points && (
        <View
          style={{
            position: "absolute",
            bottom: 30,
            left: 0,
            right: 0,
            alignItems: "center",
            gap: 10,
          }}
        >
          <Pressable
            style={{
              backgroundColor: "lightblue",
              width: 200,
              height: 64,
              justifyContent: "center",
              alignItems: "center",
              borderRadius: 8,
              opacity: isUploading ? 0.5 : 1,
            }}
            disabled={isUploading}
            onPress={() => {
              setProject(!project);
            }}
          >
            <Text style={{ fontSize: 16, fontWeight: "600" }}>
              {!project ? `Preview ${points.length} images` : `Go back`}
            </Text>
          </Pressable>

          <Pressable
            style={{
              backgroundColor: "pink",
              width: 200,
              height: 64,
              justifyContent: "center",
              alignItems: "center",
              borderRadius: 8,
              opacity: isUploading ? 0.5 : 1,
            }}
            disabled={isUploading}
            onPress={() => {
              setExportPanorama(true);
            }}
          >
            {isUploading ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text style={{ fontSize: 16, fontWeight: "600" }}>
                Save & Process
              </Text>
            )}
          </Pressable>
        </View>
      )}
    </>
  );
}
