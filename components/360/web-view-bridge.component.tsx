import * as FileSystemLegacy from "expo-file-system/legacy";
import React, { useCallback, useRef } from "react";
import { WebView } from "react-native-webview";

export function useTextureToPNGWebView() {
  const webviewRef = useRef<any>(null);
  const pendingRequestsRef = useRef(
    new Map<
      string,
      {
        resolve: (uri: string) => void;
        reject: (e: any) => void;
        timeoutId: any;
        fileName: string;
      }
    >()
  );
  const readyPromiseRef = useRef<Promise<void> | null>(null);
  const readyResolveRef = useRef<(() => void) | null>(null);

  if (!readyPromiseRef.current) {
    readyPromiseRef.current = new Promise<void>((resolve) => {
      readyResolveRef.current = resolve;
    });
  }

  const awaitReady = async (timeoutMs = 10000) => {
    let to: any;
    try {
      await Promise.race([
        readyPromiseRef.current as Promise<void>,
        new Promise(
          (_, rej) =>
            (to = setTimeout(
              () => rej(new Error("WebView not loaded in time")),
              timeoutMs
            ))
        ),
      ]);
    } finally {
      if (to) clearTimeout(to);
    }
  };

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <body>
        <canvas id="canvas"></canvas>
        <script>
          const canvas = document.getElementById("canvas");
          const ctx = canvas.getContext("2d");

          function post(type, data) {
            try {
              window.ReactNativeWebView.postMessage(JSON.stringify({ type, ...(data || {}) }));
            } catch (e) {}
          }

          document.addEventListener("message", async (event) => {
            try {
              try {
                const probe = JSON.parse(event.data);
                post("LOG", { step: "RECEIVED_MESSAGE", requestId: probe?.requestId });
              } catch (_) { post("LOG", { step: "RECEIVED_MESSAGE" }); }
              const payload = JSON.parse(event.data);
              if (payload.type === "DRAW_TEXTURE") {
                const { buffer, width, height, requestId, options } = payload;
                post("LOG", { step: "DRAW_TEXTURE_START", width, height, bufferLength: buffer?.length, requestId });

                if (!buffer || !width || !height) {
                  post("ERROR", { step: "VALIDATION", message: "Missing buffer/width/height", requestId });
                  return;
                }

                if (buffer.length !== width * height * 4) {
                  post("LOG", {
                    step: "BUFFER_LENGTH_MISMATCH",
                    expected: width * height * 4,
                    actual: buffer.length,
                    requestId
                  });
                }

                // Build a source canvas from raw pixels
                const srcCanvas = document.createElement('canvas');
                srcCanvas.width = width;
                srcCanvas.height = height;
                const srcCtx = srcCanvas.getContext('2d');
                const imageData = new ImageData(new Uint8ClampedArray(buffer), width, height);
                srcCtx.putImageData(imageData, 0, 0);
                post("LOG", { step: "PUT_IMAGE_DATA_DONE", requestId });

                // Apply orientation fixes
                const flipX = !!(options && options.flipX);
                const flipY = !!(options && options.flipY);
                const yawOffsetDeg = ((options && typeof options.yawOffsetDeg === 'number') ? options.yawOffsetDeg : 0) || 0;

                let working = srcCanvas;

                if (flipX || flipY) {
                  const flippedCanvas = document.createElement('canvas');
                  flippedCanvas.width = width;
                  flippedCanvas.height = height;
                  const fctx = flippedCanvas.getContext('2d');
                  fctx.save();
                  fctx.translate(flipX ? width : 0, flipY ? height : 0);
                  fctx.scale(flipX ? -1 : 1, flipY ? -1 : 1);
                  fctx.drawImage(working, 0, 0);
                  fctx.restore();
                  working = flippedCanvas;
                  post("LOG", { step: "FLIP_APPLIED", flipX, flipY, requestId });
                }

                const normYaw = ((yawOffsetDeg % 360) + 360) % 360;
                const shiftPx = Math.round(normYaw / 360 * width);
                if (shiftPx) {
                  const shiftedCanvas = document.createElement('canvas');
                  shiftedCanvas.width = width;
                  shiftedCanvas.height = height;
                  const sctx = shiftedCanvas.getContext('2d');
                  
                  // Calculate the width of the part that doesn't wrap around.
                  const rightPartWidth = width - shiftPx;

                  // 1. Draw the right part of the source image onto the left part of the destination.
                  sctx.drawImage(working, shiftPx, 0, rightPartWidth, height, 0, 0, rightPartWidth, height);
                  
                  // 2. Draw the left part of the source image (the part that wraps) onto the right part of the destination.
                  sctx.drawImage(working, 0, 0, shiftPx, height, rightPartWidth, 0, shiftPx, height);

                  working = shiftedCanvas;
                  post("LOG", { step: "YAW_SHIFT_APPLIED", yawOffsetDeg: normYaw, shiftPx, direction: "right" });
                }

                // Draw to output canvas for encoding
                canvas.width = width;
                canvas.height = height;
                ctx.clearRect(0, 0, width, height);
                ctx.drawImage(working, 0, 0);

                const useDataURL = !canvas.toBlob;
                if (useDataURL) {
                  try {
                    const dataURL = canvas.toDataURL("image/png");
                    const base64 = dataURL.split(",")[1];
                    post("PNG_READY", { data: base64, requestId });
                    post("LOG", { step: "DATA_URL_DONE", size: base64.length, requestId });
                  } catch (e) {
                    post("ERROR", { step: "DATA_URL_ERROR", message: String(e), requestId });
                  }
                  return;
                }

                try {
                  canvas.toBlob((blob) => {
                    if (!blob) {
                      post("LOG", { step: "TO_BLOB_NULL", fallback: true, requestId });
                      try {
                        const dataURL = canvas.toDataURL("image/png");
                        const base64 = dataURL.split(",")[1];
                        post("PNG_READY", { data: base64, requestId });
                        post("LOG", { step: "DATA_URL_DONE_AFTER_NULL", size: base64.length, requestId });
                      } catch (e2) {
                        post("ERROR", { step: "DATA_URL_ERROR_AFTER_NULL", message: String(e2), requestId });
                      }
                      return;
                    }
                    const reader = new FileReader();
                    reader.onerror = (err) => {
                      post("ERROR", { step: "FILE_READER_ERROR", message: String(err), requestId });
                    };
                    reader.onloadend = () => {
                      try {
                        const base64 = reader.result.split(",")[1];
                        post("PNG_READY", { data: base64, requestId });
                        post("LOG", { step: "PNG_READY_POSTED", size: base64.length, requestId });
                      } catch (e3) {
                        post("ERROR", { step: "ONLOADEND_PARSE_ERROR", message: String(e3), requestId });
                      }
                    };
                    reader.readAsDataURL(blob);
                    post("LOG", { step: "READ_AS_DATA_URL_CALLED", blobSize: blob.size, requestId });
                  }, "image/png");
                  post("LOG", { step: "TO_BLOB_CALLED", requestId });
                } catch (errToBlob) {
                  post("ERROR", { step: "TO_BLOB_THROW", message: String(errToBlob), requestId });
                }
              } else {
                post("LOG", { step: "IGNORED_MESSAGE", payloadType: payload.type, requestId: payload.requestId });
              }
            } catch (parseErr) {
              post("ERROR", { step: "MESSAGE_PARSE_ERROR", message: String(parseErr), requestId: undefined });
            }
          });
        </script>
      </body>
    </html>
  `;

  const convertBuffer = useCallback(
    async (
      buffer: Uint8Array,
      width: number,
      height: number,
      fileName = "texture.png",
      options?: { flipX?: boolean; flipY?: boolean; yawOffsetDeg?: number }
    ) => {
      await awaitReady().catch((e) => {
        console.error("[convertBuffer] WebView not ready", e);
        throw e;
      });
      console.log("[convertBuffer] start", {
        width,
        height,
        bufferLength: buffer?.length,
        fileName,
        options,
      });

      return new Promise<string>((resolve, reject) => {
        const requestId = `${Date.now()}-${Math.random()
          .toString(36)
          .slice(2)}`;
        const resolveOnce = (v: string) => {
          const entry = pendingRequestsRef.current.get(requestId);
          if (!entry) return;
          clearTimeout(entry.timeoutId);
          pendingRequestsRef.current.delete(requestId);
          resolve(v);
        };
        const rejectOnce = (e: any) => {
          const entry = pendingRequestsRef.current.get(requestId);
          if (!entry) return;
          clearTimeout(entry.timeoutId);
          pendingRequestsRef.current.delete(requestId);
          reject(e);
        };

        const timeoutId = setTimeout(() => {
          console.warn("[convertBuffer] timeout waiting for PNG");
          rejectOnce(new Error("Timed out waiting for PNG_READY"));
        }, 120000);

        // Track this request
        pendingRequestsRef.current.set(requestId, {
          resolve: resolveOnce,
          reject: rejectOnce,
          timeoutId,
          fileName,
        });

        if (
          webviewRef.current &&
          typeof webviewRef.current.injectJavaScript === "function"
        ) {
          console.log("[convertBuffer] injecting", {
            width,
            height,
            bufferLength: buffer?.length,
          });
          try {
            webviewRef.current.injectJavaScript(`
              document.dispatchEvent(new MessageEvent("message", {
                data: '${JSON.stringify({
                  type: "DRAW_TEXTURE",
                  buffer: Array.from(buffer || []),
                  width,
                  height,
                  requestId,
                  options: options || {},
                })}'
              }));
            `);
            console.log("[convertBuffer] injected");
          } catch (injErr) {
            console.error("[convertBuffer] inject error", injErr);
            rejectOnce(injErr);
          }
        } else {
          rejectOnce(
            new Error("WebView not ready or injectJavaScript not available")
          );
        }
      });
    },
    []
  );

  // Return hook API + hidden WebView component
  const WebViewBridge = () => (
    <WebView
      ref={webviewRef}
      originWhitelist={["*"]}
      source={{ html: htmlContent }}
      style={{ display: "none" }} // invisible
      onLoad={() => {
        console.log("[WebView] loaded");
        try {
          readyResolveRef.current && readyResolveRef.current();
        } catch {}
      }}
      onError={(e) => console.error("[WebView] error", e.nativeEvent)}
      onMessage={(event) => {
        try {
          const parsed = JSON.parse(event?.nativeEvent?.data || "{}");
          const { type, requestId, data, ...rest } = parsed || {};
          if (!type) return;
          if (type === "LOG") {
            console.log("[WebView]", rest);
            return;
          }
          if (type === "ERROR") {
            console.error("[WebView ERROR]", rest);
            const entry = requestId
              ? pendingRequestsRef.current.get(requestId)
              : undefined;
            if (entry)
              entry.reject(new Error(rest?.message || "WebView error"));
            return;
          }
          if (type === "PNG_READY") {
            const entry = requestId
              ? pendingRequestsRef.current.get(requestId)
              : undefined;
            if (!entry) {
              console.warn(
                "[WebView] PNG_READY with no pending entry",
                requestId
              );
              return;
            }
            const fileUri =
              (FileSystemLegacy.documentDirectory || "") + entry.fileName;
            FileSystemLegacy.writeAsStringAsync(fileUri, data, {
              encoding: FileSystemLegacy.EncodingType.Base64,
            })
              .then(() => {
                console.log("[convertBuffer] file written", fileUri);
                entry.resolve(fileUri);
              })
              .catch((fsErr) => {
                console.error("[convertBuffer] write error", fsErr);
                entry.reject(fsErr);
              });
            return;
          }
          console.log("[WebView] unknown message type", type);
        } catch (e2) {
          console.error("[WebView] onMessage error", e2);
        }
      }}
    />
  );

  return { convertBuffer, WebViewBridge };
}
