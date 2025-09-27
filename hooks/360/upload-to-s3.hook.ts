import { useState } from "react";
// import { S3Client, PutObjectCommand, S3 } from "@aws-sdk/client-s3";
import Constants from "expo-constants";

import { Credentials } from "aws-sdk";
import S3 from "aws-sdk/clients/s3";
import { Asset } from "expo-asset";
import * as ImageManipulator from "expo-image-manipulator";

interface UploadToS3Response {
  uploadImages: (
    images: string[],
    presignedUrls: string[]
  ) => Promise<string[]>;
  isUploading: boolean;
  error: Error | null;
  getPresignedUrl: (
    fileType: string,
    key: string
  ) => Promise<{ url: string; key: string }>;
}

const access = new Credentials({
  accessKeyId:
    Constants.expoConfig?.extra?.awsAccessKeyId ||
    (process.env.EXPO_PUBLIC_AWS_ACCESS_KEY_ID as string | undefined),
  secretAccessKey:
    Constants.expoConfig?.extra?.awsSecretAccessKey ||
    (process.env.EXPO_PUBLIC_AWS_SECRET_ACCESS_KEY as string | undefined),
});

const s3 = new S3({
  credentials: access,
  region:
    Constants.expoConfig?.extra?.awsRegion ||
    (process.env.EXPO_PUBLIC_AWS_REGION as string | undefined),
  signatureVersion: "v4",
});

export default function useUploadToS3(): UploadToS3Response {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const getPresignedUrl = async (fileType: string, key: string) => {
    try {
      const ex = fileType.split("/")[1];
      const Key = `panorama-images/${key}.${ex}`;

      const Bucket =
        Constants.expoConfig?.extra?.awsBucketName ||
        (process.env.EXPO_PUBLIC_AWS_BUCKET as string | undefined);
      if (!Bucket) {
        throw new Error(
          "Missing S3 bucket. Set expo.extra.awsBucketName or EXPO_PUBLIC_AWS_BUCKET"
        );
      }

      const url = await s3.getSignedUrlPromise("putObject", {
        Bucket,
        Key,
        ContentType: fileType,
        Expires: 6000,
        ACL: "public-read",
      });
      return { url, key: Key };
    } catch (error) {
      console.log("error", error);
      setError(
        error instanceof Error
          ? error
          : new Error("Failed to get presigned URL")
      );
      throw error;
    }
  };

  const uploadImages = async (
    images: string[],
    presignedUrls: string[],
    fileType?: string
  ): Promise<string[]> => {
    if (images.length !== presignedUrls.length) {
      throw new Error("Number of images and presigned URLs must match");
    }

    setIsUploading(true);
    setError(null);

    try {
      const uploadPromises = images.map(async (imageUri, index) => {
        // Remove 'file://' prefix if present

        const asset = Asset.fromURI(imageUri);
        if (!asset.localUri) {
          // Download the asset if it doesn't have a local URI
          await asset.downloadAsync();
        }
        // console.log("asset", asset);

        const resized = await ImageManipulator.ImageManipulator.manipulate(
          asset?.uri || ""
        ).renderAsync();

        const base64Data = await resized.saveAsync({
          compress: 0.9,
          format: ImageManipulator.SaveFormat.JPEG,
        });

        const response = await fetch(base64Data.uri);
        const blob = await response.blob();
        // console.log("base64Data", base64Data.base64);

        // const base64Data = await resized.saveAsync();

        // Convert base64 to blob
        // const byteArray = new Uint8Array(
        //   base64Data.base64 || "",
        //   "base64"
        // ).buffer;

        const res = await fetch(presignedUrls[index], {
          method: "PUT",
          body: blob,
          headers: {
            "Content-Type": fileType || "image/png",
            "x-amz-acl": "public-read",
            // "Content-Length": base64Data?.base64?.length.toString() || "0",
          },
        });

        // Return the S3 URL (removing the query parameters from presigned URL)
        return presignedUrls[index].split("?")[0];
      });

      const uploadedUrls = await Promise.all(uploadPromises);
      return uploadedUrls;
    } catch (err) {
      console.log("error", err);
      setError(
        err instanceof Error ? err : new Error("Failed to upload images")
      );
      throw err;
    } finally {
      setIsUploading(false);
    }
  };

  return {
    uploadImages,
    isUploading,
    getPresignedUrl,
    error,
  };
}
