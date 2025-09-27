import { useFrame, useThree } from "@react-three/fiber";
import * as React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import useRotateObject from "../../hooks/360/rotate-object.hook";

/**
 * Types
 */
export type ExifIntrinsics = {
  /** Horizontal/vertical field of view in radians */
  XResolution: number;
  YResolution: number;
};

export type PhotoPoint = {
  position: THREE.Vector3;
  direction: THREE.Vector3;
  imageUri?: string;

  euler: THREE.Euler;
  quat: THREE.Quaternion;
  localUri?: string;
  index: number;
  key: string;
  exif: ExifIntrinsics;
};

/**
 * Options to control baking & viewing
 */
export type PanoramaBakeOptions = {
  width?: number;
  height?: number;
  thetaMinDeg?: number;
  thetaMaxDeg?: number;
  seamWidth?: number;
  clearColor?: number;
  useHDR?: boolean;
  gamma?: number;
  centerBias?: number;
  anglePower?: number;
  priorityMaxBoost?: number;
  priorityPower?: number;
  horizontalYThreshold?: number;
  priorityThresholdY?: number;
  fovOverscan?: number;
  uvBleed?: number;
  // Optional final orientation correction (degrees). Applied during export readback.
  yawOffsetDeg?: number;
  pitchOffsetDeg?: number;
  rollOffsetDeg?: number;
};

/**
 * Utility: build a Matrix3 that is camFromWorld (inverse of worldFromCam).
 * We treat the quaternion as worldFromCam (camera orientation in world),
 * so camFromWorld = transpose(worldFromCam) because it's pure rotation.
 */
function camFromWorldMatrix3(q: THREE.Quaternion) {
  const m4 = new THREE.Matrix4().makeRotationFromQuaternion(q);
  const m3 = new THREE.Matrix3().setFromMatrix4(m4);
  return m3.transpose(); // inverse for rotation-only
}

function worldForwardFromQuat(q: THREE.Quaternion) {
  return new THREE.Vector3(0, 0, 1).applyQuaternion(q).normalize();
}

/**
 * Shader sources
 */
const fsColorAccum = `
precision highp float;
varying vec2 vUv;

uniform sampler2D photoTex;        // source photo in sRGB
uniform mat3 camFromWorld;         // transforms world dir -> cam dir
uniform vec2 panoSize;             // (W,H)
uniform float tanHalfFovX;
uniform float tanHalfFovY;
uniform float feather;
uniform float gamma;
uniform float centerBias;
uniform float anglePower;
uniform float thetaMin;
uniform float thetaMax;
uniform float fovOverscan;
uniform float uvBleed;

// Priority uniforms
uniform vec3 photoForward;
uniform float priority;
uniform float priorityPower;
uniform float priorityMaxBoost;

const float PI = 3.14159265359;

vec3 srgbToLinear(vec3 c) {
    vec3 bLess = step(c, vec3(0.04045));
    vec3 linLow = c / 12.92;
    vec3 linHigh = pow((c + 0.055) / 1.055, vec3(2.4));
    return mix(linHigh, linLow, bLess);
}

void main() {
    // --- Pano direction
    vec2 pix = vUv * panoSize;
    float u = (pix.x + 0.5) / panoSize.x;
    float v = (pix.y + 0.5) / panoSize.y;

    float lon = u * 2.0 * PI - PI;
    float lat = v * PI - 0.5 * PI;

    vec3 d = vec3(cos(lat) * cos(lon), sin(lat), cos(lat) * sin(lon));

    // --- Camera projection
    vec3 d_cam = camFromWorld * d;
    float denom = -d_cam.z;
    if (denom <= 0.0) discard;

    float nx = d_cam.x / denom;
    float ny = d_cam.y / denom;
    // FOV with small overscan and smooth fade to guarantee seam overlap
    float tanFovX = tanHalfFovX * (1.0 + fovOverscan);
    float tanFovY = tanHalfFovY * (1.0 + fovOverscan);
    float ax = abs(nx);
    float ay = abs(ny);
    float fovFadeX = 1.0 - smoothstep(tanHalfFovX, tanFovX, ax);
    float fovFadeY = 1.0 - smoothstep(tanHalfFovY, tanFovY, ay);
    float wFov = clamp(fovFadeX * fovFadeY, 0.0, 1.0);

    float u_img = 0.5 + nx / (2.0 * tanHalfFovX);
    float v_img = 0.5 + ny / (2.0 * tanHalfFovY);

    vec2 uvImg = vec2(u_img, v_img);
    vec2 uvClamped = clamp(uvImg, 0.0, 1.0);

    // --- Sample in linear space
    vec3 c = srgbToLinear(texture2D(photoTex, uvClamped).rgb);

    // --- Low/high frequency separation (using mipmap for blur)
    vec3 low = srgbToLinear(texture2D(photoTex, uvClamped, 2.0).rgb);
    vec3 high = c - low;

    // --- Compute base feathering (separable to avoid diamond/X artifacts)
    float edgeX = min(uvClamped.x, 1.0 - uvClamped.x) / feather;
    float edgeY = min(uvClamped.y, 1.0 - uvClamped.y) / feather;
    float wEdgeX = clamp(edgeX, 0.0, 1.0);
    float wEdgeY = clamp(edgeY, 0.0, 1.0);
    float wBase = wEdgeX * wEdgeY;

    // Apply FOV fade so weights taper near frustum edges rather than cutting
    wBase *= wFov;

    // Additional fade outside [0,1] to bleed edges instead of creating holes
    vec2 outsideNeg = -uvImg;
    vec2 outsidePos = uvImg - 1.0;
    vec2 outsideAmt = max(max(outsideNeg, outsidePos), vec2(0.0));
    float wOutside = 1.0 - smoothstep(0.0, uvBleed, max(outsideAmt.x, outsideAmt.y));
    wBase *= wOutside;

    // --- Center bias in image plane (favor center over edges)
    // float ru = abs(nx) / tanHalfFovX; // 0 at center, 1 at edge
    // float rv = abs(ny) / tanHalfFovY;
    // float r = clamp(length(vec2(ru, rv)), 0.0, 1.0); // circular falloff
    // float wCenter = pow(max(0.0, cos(r * 0.5 * PI)), centerBias);

    float ru = clamp(abs(nx) / tanHalfFovX, 0.0, 1.0);
    float rv = clamp(abs(ny) / tanHalfFovY, 0.0, 1.0);
    float wCenterX = pow(max(0.0, cos(ru * 0.5 * PI)), centerBias);
    float wCenterY = pow(max(0.0, cos(rv * 0.5 * PI)), centerBias);
    float wCenter = wCenterX * wCenterY;


    // --- Angle-of-incidence (favor front-facing contributions)
    float cosTheta = clamp(-d_cam.z / length(d_cam), 0.0, 1.0);
    float wAngle = pow(cosTheta, anglePower);

    // --- Upper-bound theta preference (no lower cutoff to avoid center holes)
    float theta = acos(cosTheta);
    float eps = 0.15; // soft edge near thetaMax
    float wBand = 1.0 - smoothstep(thetaMax - eps, thetaMax + eps, theta);

    // --- Multi-band weighting
    float wLow = pow(cos((1.0 - wBase) * 0.5 * PI), gamma);   // wide smooth
    float wHigh = pow(wLow, 4.0);                             // sharp

    // Combine selectivity terms
    float wSelect = wCenter * wAngle * wBand;
    wLow *= wSelect;
    wHigh *= wSelect;

    // --- Priority boost based on angle between pano direction 'd' and photo forward
    float affinity = max(dot(normalize(photoForward), normalize(d)), 0.0);
    float affinityMask = pow(affinity, priorityPower);
    float boost = 1.0 + priority * priorityMaxBoost * affinityMask;

    wLow *= boost;
    wHigh *= boost;

    // --- Blend
    vec3 blended = low * wLow + high * wHigh;
    float w = max(wLow, wHigh);
    w = max(w, 1e-4); // avoid zero-weight holes

    gl_FragColor = vec4(blended, w);
}
`;

const fsWeightAccum = `
precision highp float;
varying vec2 vUv;

uniform mat3 camFromWorld;
uniform vec2 panoSize;
uniform float tanHalfFovX;
uniform float tanHalfFovY;
uniform float feather;
uniform float gamma;
uniform float centerBias;
uniform float anglePower;
uniform float thetaMin;
uniform float thetaMax;
uniform float fovOverscan;
uniform float uvBleed;

// Priority uniforms
uniform vec3 photoForward;
uniform float priority;
uniform float priorityPower;
uniform float priorityMaxBoost;

const float PI = 3.14159265359;

void main() {
    // --- Pano direction
    vec2 pix = vUv * panoSize;
    float u = (pix.x + 0.5) / panoSize.x;
    float v = (pix.y + 0.5) / panoSize.y;

    float lon = u * 2.0 * PI - PI;
    float lat = v * PI - 0.5 * PI;

    vec3 d = vec3(cos(lat) * cos(lon), sin(lat), cos(lat) * sin(lon));

    // --- Camera projection
    vec3 d_cam = camFromWorld * d;
    float denom = -d_cam.z;
    if (denom <= 0.0) discard;

    float nx = d_cam.x / denom;
    float ny = d_cam.y / denom;
    // FOV with small overscan and smooth fade to guarantee seam overlap
    float tanFovX = tanHalfFovX * (1.0 + fovOverscan);
    float tanFovY = tanHalfFovY * (1.0 + fovOverscan);
    float ax = abs(nx);
    float ay = abs(ny);
    float fovFadeX = 1.0 - smoothstep(tanHalfFovX, tanFovX, ax);
    float fovFadeY = 1.0 - smoothstep(tanHalfFovY, tanFovY, ay);
    float wFov = clamp(fovFadeX * fovFadeY, 0.0, 1.0);

    float u_img = 0.5 + nx / (2.0 * tanHalfFovX);
    float v_img = 0.5 + ny / (2.0 * tanHalfFovY);

    vec2 uvImg = vec2(u_img, v_img);
    vec2 uvClamped = clamp(uvImg, 0.0, 1.0);

    // --- Feather (separable to avoid diamond/X artifacts)
    float edgeX = min(uvClamped.x, 1.0 - uvClamped.x) / feather;
    float edgeY = min(uvClamped.y, 1.0 - uvClamped.y) / feather;
    float wEdgeX = clamp(edgeX, 0.0, 1.0);
    float wEdgeY = clamp(edgeY, 0.0, 1.0);
    float wBase = wEdgeX * wEdgeY;

    // Apply FOV fade so weights taper near frustum edges rather than cutting
    wBase *= wFov;

    // Fade outside [0,1] using uvBleed to avoid holes
    vec2 outsideNeg = -uvImg;
    vec2 outsidePos = uvImg - 1.0;
    vec2 outsideAmt = max(max(outsideNeg, outsidePos), vec2(0.0));
    float wOutside = 1.0 - smoothstep(0.0, uvBleed, max(outsideAmt.x, outsideAmt.y));
    wBase *= wOutside;

    // --- Center bias in image plane (favor center over edges)
    // float ru = abs(nx) / tanHalfFovX;
    // float rv = abs(ny) / tanHalfFovY;
    // float r = clamp(length(vec2(ru, rv)), 0.0, 1.0);
    // float wCenter = pow(max(0.0, cos(r * 0.5 * PI)), centerBias);

    float ru = clamp(abs(nx) / tanHalfFovX, 0.0, 1.0);
    float rv = clamp(abs(ny) / tanHalfFovY, 0.0, 1.0);
    float wCenterX = pow(max(0.0, cos(ru * 0.5 * PI)), centerBias);
    float wCenterY = pow(max(0.0, cos(rv * 0.5 * PI)), centerBias);
    float wCenter = wCenterX * wCenterY;



    // --- Angle-of-incidence (favor front-facing contributions)
    float cosTheta = clamp(-d_cam.z / length(d_cam), 0.0, 1.0);
    float wAngle = pow(cosTheta, anglePower);

    // --- Upper-bound theta preference
    float theta = acos(cosTheta);
    float eps = 0.15;
    float wBand = 1.0 - smoothstep(thetaMax - eps, thetaMax + eps, theta);

    // --- Multi-band weighting
    float wLow = pow(cos((1.0 - wBase) * 0.5 * PI), gamma);
    float wHigh = pow(wLow, 4.0);

    float w = max(wLow, wHigh) * (wCenter * wAngle * wBand);
    w = max(w, 1e-4);

    // --- Priority boost
    float affinity = max(dot(normalize(photoForward), normalize(d)), 0.0);
    float affinityMask = pow(affinity, priorityPower);
    float boost = 1.0 + priority * priorityMaxBoost * affinityMask;
    w *= boost;

    gl_FragColor = vec4(w, w, w, 1.0);
}
`;

const vsFullScreen = `
attribute vec3 position;
varying vec2 vUv;

void main(){
  vUv = position.xy * 0.5 + 0.5; // NDC [-1,1] -> [0,1]
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

const fsNormalize8bit = `
precision highp float;
varying vec2 vUv;

uniform sampler2D accumColorTex; // RGBA16F linear (RGB = sum(w*C))
uniform sampler2D accumWeightTex; // R16F linear (R = sum(w))
uniform float epsilon;

vec3 linearToSRGB(vec3 c){
  vec3 cutoff = step(c, vec3(0.0031308));
  vec3 low = c * 12.92;
  vec3 high = 1.055 * pow(c, vec3(1.0/2.4)) - 0.055;
  return mix(high, low, cutoff);
}

float rand(vec2 co) {
  return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453);
}

void main(){
  vec3 sumC = texture2D(accumColorTex, vUv).rgb;
  float sumW = texture2D(accumWeightTex, vUv).r;
  vec3 lin = (sumW > epsilon) ? (sumC / max(sumW, epsilon)) : vec3(0.0);

   vec3 srgb = linearToSRGB(lin);

  // optional dithering before 8-bit quantization
  if (true) {
    float d = (rand(gl_FragCoord.xy) - 0.5) / 255.0; // ±0.5 LSB
    srgb += vec3(d);
  }

  gl_FragColor = vec4(clamp(srgb, 0.0, 1.0), 1.0);
}
`;

const fsNormalize16F = `
precision highp float;
varying vec2 vUv;

uniform sampler2D accumColorTex;
uniform sampler2D accumWeightTex;
uniform float epsilon;

void main(){
  vec3 sumC = texture2D(accumColorTex, vUv).rgb;
  float sumW = texture2D(accumWeightTex, vUv).r;
  vec3 lin = (sumW > epsilon) ? (sumC / max(sumW, epsilon)) : vec3(0.0);
  gl_FragColor = vec4(lin, 1.0);
}
`;

const fsRotateEquirect = `
precision highp float;
varying vec2 vUv;

uniform sampler2D srcTex;   // equirect input
uniform float yaw;          // radians (Y axis)
uniform float pitch;        // radians (X axis)
uniform float roll;         // radians (Z axis)

const float PI = 3.14159265359;

mat3 rotX(float a){
  float c = cos(a), s = sin(a);
  return mat3(
    1.0, 0.0, 0.0,
    0.0,   c,  -s,
    0.0,   s,   c
  );
}

mat3 rotY(float a){
  float c = cos(a), s = sin(a);
  return mat3(
      c, 0.0,  s,
    0.0, 1.0, 0.0,
     -s, 0.0,  c
  );
}

mat3 rotZ(float a){
  float c = cos(a), s = sin(a);
  return mat3(
      c,  -s, 0.0,
      s,   c, 0.0,
    0.0, 0.0, 1.0
  );
}

void main(){
  // Direction for current equirect pixel
  float u = vUv.x;
  float v = vUv.y;
  float lon = u * 2.0 * PI - PI;
  float lat = v * PI - 0.5 * PI;
  vec3 d = vec3(cos(lat) * cos(lon), sin(lat), cos(lat) * sin(lon));

  // Apply inverse rotation to sample source so output appears rotated
  // WebGL1/GLSL ES 1.00 doesn't have transpose(mat3);
  // For rotation-only, inverse is rotation by negative angles in reverse order
  mat3 Rinv = rotZ(-roll) * rotX(-pitch) * rotY(-yaw);
  vec3 ds = Rinv * d;

  float lonS = atan(ds.z, ds.x);
  float latS = asin(clamp(ds.y, -1.0, 1.0));
  float uS = (lonS + PI) / (2.0 * PI);
  float vS = (latS + 0.5 * PI) / PI;
  vec2 uvS = vec2(fract(uS), clamp(vS, 0.0, 1.0));

  gl_FragColor = texture2D(srcTex, uvS);
}
`;
const fsGhostReduceMedian = `
precision highp float;
varying vec2 vUv;

uniform sampler2D inputTex;
uniform vec2 pixelSize;   // (1.0/width, 1.0/height)
uniform float threshold;
uniform float blendFactor;

float luminance(vec3 c) {
  return dot(c, vec3(0.2126, 0.7152, 0.0722));
}

void main() {
  vec3 samples[9];
  int i = 0;

  for (int dy = -1; dy <= 1; dy++) {
    for (int dx = -1; dx <= 1; dx++) {
      vec2 offset = vec2(float(dx), float(dy)) * pixelSize;
      samples[i] = texture2D(inputTex, vUv + offset).rgb;
      i++;
    }
  }

  // Sort by luminance (naive bubble sort for 9 elements)
  for (int a = 0; a < 9; a++) {
    for (int b = a + 1; b < 9; b++) {
      if (luminance(samples[b]) < luminance(samples[a])) {
        vec3 tmp = samples[a];
        samples[a] = samples[b];
        samples[b] = tmp;
      }
    }
  }

  vec3 median = samples[4]; // middle of sorted 9

  vec3 c = texture2D(inputTex, vUv).rgb;
  float diff = length(median - c);

  float t = smoothstep(threshold, 2.0 * threshold, diff);
  vec3 result = mix(c, median, blendFactor * t);

  gl_FragColor = vec4(result, 1.0);
}
`;

const fsGhostReduce = `
precision highp float;
varying vec2 vUv;

uniform sampler2D inputTex;   // normalized pano
uniform float pixelSize;      // 1.0 / width
uniform float threshold;      // sensitivity
uniform float blendFactor;    // correction strength

void main() {
  vec3 c = texture2D(inputTex, vUv).rgb;

  // Sample 4-neighborhood (fast, but effective)
  vec2 offX = vec2(pixelSize, 0.0);
  vec2 offY = vec2(0.0, pixelSize);

  vec3 n0 = texture2D(inputTex, vUv - offX).rgb;
  vec3 n1 = texture2D(inputTex, vUv + offX).rgb;
  vec3 n2 = texture2D(inputTex, vUv - offY).rgb;
  vec3 n3 = texture2D(inputTex, vUv + offY).rgb;

  vec3 avg = (n0 + n1 + n2 + n3) * 0.25;

  float diff = length(c - avg);

  float t = smoothstep(threshold, threshold * 2.0, diff);

  vec3 result = mix(c, mix(c, avg, blendFactor), t);

  gl_FragColor = vec4(result, 1.0);
}
`;

/**
 * Build a RawShaderMaterial for a given fragment shader
 */
function makeMaterial(fs: string, uniforms: Record<string, any>) {
  return new THREE.RawShaderMaterial({
    vertexShader: vsFullScreen,
    fragmentShader: fs,
    uniforms: Object.fromEntries(
      Object.entries(uniforms).map(([k, v]) => [k, { value: v }])
    ),
    depthTest: false,
    depthWrite: false,
    transparent: true,
  });
}

/**
 * Hook: Bake photos into a single equirect texture. Returns the baked texture (THREE.Texture) or null while baking.
 */
export function useEquirectPanoramaBake(
  photos: PhotoPoint[],
  opts: PanoramaBakeOptions = {}
) {
  const { gl, size } = useThree();
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  const [isBaking, setIsBaking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const params = useMemo(() => {
    const width = opts.width ?? 4096;
    const height = opts.height ?? Math.floor((opts.width ?? 4096) / 2);
    return {
      W: width,
      H: height,
      thetaMin: THREE.MathUtils.degToRad(opts.thetaMinDeg ?? 5),
      thetaMax: THREE.MathUtils.degToRad(opts.thetaMaxDeg ?? 65),
      seamWidth: Math.max(0.001, opts.seamWidth ?? 0.06),
      clearColor: opts.clearColor ?? "gray",
      useHDR: opts.useHDR ?? false,
      gamma: opts.gamma ?? 1.5,
      centerBias: opts.centerBias ?? 1.1,
      anglePower: opts.anglePower ?? 0.5,

      // Priority params
      priorityMaxBoost: opts.priorityMaxBoost ?? 70.0,
      priorityPower: opts.priorityPower ?? 60.0,
      horizontalYThreshold: opts.horizontalYThreshold ?? 0.25,
      fovOverscan: opts.fovOverscan ?? 0.01,
      uvBleed: opts.uvBleed ?? opts.seamWidth ?? 0.03,
    };
  }, [
    opts.width,
    opts.height,
    opts.thetaMinDeg,
    opts.thetaMaxDeg,
    opts.seamWidth,
    opts.clearColor,
    opts.useHDR,
    opts.gamma,
    opts.centerBias,
    opts.anglePower,
    opts.priorityPower,
    opts.priorityMaxBoost,
    opts.horizontalYThreshold,
    opts.fovOverscan,
    opts.uvBleed,
  ]);

  useEffect(() => {
    let mounted = true;
    async function bake() {
      try {
        const isWebGL2 = gl.capabilities.isWebGL2;
        const hasColorBufferFloat = gl.extensions.get("EXT_color_buffer_float");
        const hasColorBufferHalfFloat = gl.extensions.get(
          "EXT_color_buffer_half_float"
        );

        // Choose render target type based on capabilities
        const rtType = hasColorBufferHalfFloat
          ? THREE.HalfFloatType
          : hasColorBufferFloat
          ? THREE.FloatType
          : THREE.UnsignedByteType;

        setIsBaking(true);
        setError(null);

        // Prepare render targets
        const accumTarget = new THREE.WebGLRenderTarget(params.W, params.H, {
          type: rtType,
          format: THREE.RGBAFormat,
          depthBuffer: false,
          stencilBuffer: false,
        });
        (accumTarget.texture as any).colorSpace = THREE.LinearSRGBColorSpace;

        const weightTarget = new THREE.WebGLRenderTarget(params.W, params.H, {
          type: rtType,
          format: isWebGL2 ? THREE.RedFormat : THREE.RGBAFormat,
          depthBuffer: false,
          stencilBuffer: false,
        });
        (weightTarget.texture as any).colorSpace = THREE.LinearSRGBColorSpace;

        const bakedTarget = new THREE.WebGLRenderTarget(params.W, params.H, {
          type: params.useHDR ? THREE.HalfFloatType : THREE.UnsignedByteType,
          format: THREE.RGBAFormat,
          depthBuffer: false,
          stencilBuffer: false,
        });
        (bakedTarget.texture as any).colorSpace = params.useHDR
          ? THREE.LinearSRGBColorSpace
          : THREE.SRGBColorSpace;

        const ghostTarget = new THREE.WebGLRenderTarget(params.W, params.H, {
          type: params.useHDR ? THREE.HalfFloatType : THREE.UnsignedByteType,
          format: THREE.RGBAFormat,
          depthBuffer: false,
          stencilBuffer: false,
        });
        (ghostTarget.texture as any).colorSpace = params.useHDR
          ? THREE.LinearSRGBColorSpace
          : THREE.SRGBColorSpace;

        // Fullscreen quad scene/camera
        const quadGeo = new THREE.BufferGeometry();
        const positions = new Float32Array([
          -1, -1, 0, 1, -1, 0, -1, 1, 0, 1, 1, 0,
        ]);
        quadGeo.setAttribute(
          "position",
          new THREE.BufferAttribute(positions, 3)
        );
        quadGeo.setIndex([0, 1, 2, 2, 1, 3]);
        const orthoCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
        const scene = new THREE.Scene();
        const mesh = new THREE.Mesh(quadGeo, new THREE.MeshBasicMaterial());
        scene.add(mesh);

        const prevRT = gl.getRenderTarget();
        const prevAutoClear = gl.autoClear;
        gl.autoClear = false;

        // Clear accumulators
        gl.setRenderTarget(accumTarget);
        gl.setClearColor(params.clearColor, 0);
        gl.clear(true, true, true);

        gl.setRenderTarget(weightTarget);
        gl.setClearColor(0x000000, 0);
        gl.clear(true, true, true);

        // Build reusable materials (we update uniforms per photo)
        const colorMat = makeMaterial(fsColorAccum, {
          photoTex: null,
          camFromWorld: new THREE.Matrix3(),
          panoSize: new THREE.Vector2(params.W, params.H),
          tanHalfFovX: 0,
          tanHalfFovY: 0,
          feather: params.seamWidth,
          gamma: params.gamma,
          centerBias: params.centerBias,
          anglePower: params.anglePower,
          thetaMin: params.thetaMin,
          thetaMax: params.thetaMax,
          // priority defaults (will be overwritten per-photo)
          photoForward: new THREE.Vector3(0, 0, 1),
          priority: 0.0,
          priorityPower: params.priorityPower,
          priorityMaxBoost: params.priorityMaxBoost,
          fovOverscan: params.fovOverscan,
          uvBleed: params.uvBleed,
        });
        colorMat.transparent = true;
        colorMat.depthWrite = false;
        colorMat.depthTest = false;
        colorMat.blending = THREE.AdditiveBlending;

        const weightMat = makeMaterial(fsWeightAccum, {
          camFromWorld: new THREE.Matrix3(),
          panoSize: new THREE.Vector2(params.W, params.H),
          tanHalfFovX: 0,
          tanHalfFovY: 0,
          feather: params.seamWidth,
          gamma: params.gamma,
          centerBias: params.centerBias,
          anglePower: params.anglePower,
          thetaMin: params.thetaMin,
          thetaMax: params.thetaMax,
          // priority defaults (will be overwritten per-photo)
          photoForward: new THREE.Vector3(0, 0, 1),
          priority: 0.0,
          priorityPower: params.priorityPower,
          priorityMaxBoost: params.priorityMaxBoost,
          fovOverscan: params.fovOverscan,
          uvBleed: params.uvBleed,
        });
        weightMat.transparent = true;
        weightMat.depthWrite = false;
        weightMat.depthTest = false;
        weightMat.blending = THREE.AdditiveBlending;

        // Render each photo into accumulators
        for (const p of photos) {
          const tex = p.imageUri as unknown as THREE.Texture;
          if (!tex) {
            console.warn("Skipping photo - no texture available");
            continue;
          }
          // Ensure texture sampling is ready
          tex.colorSpace = THREE.SRGBColorSpace;
          tex.minFilter = THREE.LinearFilter;
          tex.magFilter = THREE.LinearFilter;
          tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;

          const camFromWorld = camFromWorldMatrix3(p.quat);
          const forward = worldForwardFromQuat(p.quat);

          const isHorizontalBand =
            Math.abs(forward.y) < params.horizontalYThreshold;

          const priorityVal = isHorizontalBand ? 1.0 : 0.0;
          const usePriority = priorityVal;

          // Color pass
          (colorMat.uniforms.photoTex as any).value = tex;
          (colorMat.uniforms.camFromWorld as any).value = camFromWorld;
          (colorMat.uniforms.tanHalfFovX as any).value = Math.tan(
            p.exif["XResolution"] * 0.5
          );
          (colorMat.uniforms.tanHalfFovY as any).value = Math.tan(
            p.exif["YResolution"] * 0.5
          );
          (colorMat.uniforms.photoForward as any).value.copy(forward);
          (colorMat.uniforms.priority as any).value = usePriority;
          (colorMat.uniforms.priorityPower as any).value = params.priorityPower;
          (colorMat.uniforms.priorityMaxBoost as any).value =
            params.priorityMaxBoost;

          mesh.material = colorMat as any;
          gl.setRenderTarget(accumTarget);
          gl.render(scene, orthoCam);

          // Weight pass
          (weightMat.uniforms.camFromWorld as any).value = camFromWorld;
          (weightMat.uniforms.tanHalfFovX as any).value = Math.tan(
            p.exif["XResolution"] * 0.5
          );
          (weightMat.uniforms.tanHalfFovY as any).value = Math.tan(
            p.exif["YResolution"] * 0.5
          );
          (weightMat.uniforms.photoForward as any).value.copy(forward);
          (weightMat.uniforms.priority as any).value = usePriority;
          (weightMat.uniforms.priorityPower as any).value =
            params.priorityPower;
          (weightMat.uniforms.priorityMaxBoost as any).value =
            params.priorityMaxBoost;

          mesh.material = weightMat as any;
          gl.setRenderTarget(weightTarget);
          gl.render(scene, orthoCam);
        }

        // Normalize pass
        const normalizeMat = makeMaterial(
          params.useHDR ? fsNormalize16F : fsNormalize8bit,
          {
            accumColorTex: accumTarget.texture,
            accumWeightTex: weightTarget.texture,
            epsilon: 1e-6,
          }
        );
        mesh.material = normalizeMat as any;
        gl.setRenderTarget(bakedTarget);
        gl.render(scene, orthoCam);

        // Ghost-reduction pass
        const ghostReduceMat = makeMaterial(fsGhostReduceMedian, {
          inputTex: bakedTarget.texture,
          // pixelSize: 1.0 / params.W,
          pixelSize: new THREE.Vector2(1.0 / params.W, 1.0 / params.H),
          threshold: 0.05,
          blendFactor: 0.5,
        });
        mesh.material = ghostReduceMat as any;
        gl.setRenderTarget(ghostTarget);
        gl.render(scene, orthoCam);

        // Restore
        gl.setRenderTarget(prevRT);
        gl.autoClear = prevAutoClear;

        // Cleanup temp objects
        quadGeo.dispose();
        colorMat.dispose();
        weightMat.dispose();
        normalizeMat.dispose();
        ghostReduceMat.dispose();
        scene.remove(mesh);
        (mesh.geometry as any).dispose?.();
        (mesh.material as any).dispose?.();

        // Expose the final ghost-reduced texture
        if (mounted) {
          ghostTarget.texture.needsUpdate = true;
          setTexture(ghostTarget.texture);
        } else {
          bakedTarget.dispose();
          ghostTarget.dispose();
          weightTarget.dispose();
          accumTarget.dispose();
        }
      } catch (e: any) {
        console.error(e);
        if (mounted) setError(e?.message ?? "Panorama baking failed");
      } finally {
        mounted && setIsBaking(false);
      }
    }

    // Only start if we have any textures
    const hasAny = photos.some((p) => !!p.imageUri);
    console.log("Baking check:", {
      photosCount: photos.length,
      hasAny,
      photosWithTextures: photos.filter((p) => !!p.imageUri).length,
      firstPhotoImageUri: photos[0]?.imageUri ? "exists" : "missing",
    });

    if (hasAny) {
      if (mounted) {
        bake();
      }
    }
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    gl,
    photos,
    params.W,
    params.H,
    params.thetaMin,
    params.thetaMax,
    params.seamWidth,
    params.useHDR,
    params.clearColor,
    params.fovOverscan,
    params.uvBleed,
  ]);

  return { texture, isBaking, error, size };
}

/**
 * A sphere that displays the baked panorama texture. Uses BackSide so we look from inside.
 */
function BakedPanoramaSphere({ texture }: { texture: THREE.Texture }) {
  const matRef = useRef<THREE.MeshBasicMaterial>(null);
  const sphereGeom = useMemo(() => new THREE.SphereGeometry(5, 32, 16), []);
  useEffect(() => () => sphereGeom.dispose(), [sphereGeom]);

  return (
    <mesh position={[0, 0, 0]} geometry={sphereGeom} scale={[1, 1, -1]}>
      <meshBasicMaterial
        ref={matRef}
        map={texture}
        side={THREE.DoubleSide}
        transparent={true}
        toneMapped={false}
      />
    </mesh>
  );
}

export function SceneContent({
  photos,
  options,
  setTextureBuffer,
  exportPanorama,
}: {
  photos: PhotoPoint[];
  options?: PanoramaBakeOptions;
  setTextureBuffer?: (buffer: Uint8Array) => void;
  exportPanorama: boolean;
}) {
  const { camera, gl } = useThree();
  const { getCameraVectors } = useRotateObject({ object: camera });

  function getFovFromExif(exif: any) {
    // --- Step 1: Define your camera's physical properties ---
    // Found by looking up the phone model: Samsung SM-A525F (Galaxy A52)
    const SENSOR_WIDTH_MM = 7.6;
    const SENSOR_HEIGHT_MM = 5.7;

    // --- Step 2: Get data from EXIF ---
    const focalLength = exif.FocalLength; // e.g., 5.23
    const orientation = exif.Orientation || 1;

    if (!focalLength) {
      // Return a reasonable default if focal length is missing
      return {
        XResolution: THREE.MathUtils.degToRad(60),
        YResolution: THREE.MathUtils.degToRad(45),
      };
    }

    let dimensionX = SENSOR_HEIGHT_MM;
    let dimensionY = SENSOR_WIDTH_MM;

    // --- Step 3: Check orientation and assign correct sensor dimension ---
    // Tags 5, 6, 7, 8 indicate a portrait-style orientation.
    if (orientation >= 5 && orientation <= 8) {
      // Photo is TALLER than it is WIDE (Portrait)
      // Horizontal FOV uses the shorter sensor dimension
      // Vertical FOV uses the longer sensor dimension
      dimensionX = SENSOR_HEIGHT_MM; // e.g., 5.7mm
      dimensionY = SENSOR_WIDTH_MM; // e.g., 7.6mm
    } else {
      // Photo is WIDER than it is TALL (Landscape)
      // Horizontal FOV uses the longer sensor dimension
      // Vertical FOV uses the shorter sensor dimension
      dimensionX = SENSOR_WIDTH_MM; // e.g., 7.6mm
      dimensionY = SENSOR_HEIGHT_MM; // e.g., 5.7mm
    }

    // --- Step 4: Calculate FOV in radians ---
    const fovX = 2 * Math.atan(dimensionX / (2 * focalLength));
    const fovY = 2 * Math.atan(dimensionY / (2 * focalLength));

    return {
      XResolution: fovX, // This is your horizontal FOV in radians
      YResolution: fovY, // This is your vertical FOV in radians
    };
  }

  useFrame(({ camera }) => {
    const { forward, up } = getCameraVectors();

    // Option 1: Look in the direction
    const target = new THREE.Vector3().copy(camera.position).add(forward);
    camera.up.copy(up);
    camera.lookAt(target);
  });
  const processedPhotos = useMemo(() => {
    return photos.map((photo) => {
      const rawExif = photo.exif as any; // Use any to access dynamic EXIF properties
      const processedExif: ExifIntrinsics = {
        XResolution: rawExif?.FocalLength
          ? 2 *
            Math.atan(
              (rawExif.ImageWidth || 4032) / (2 * (rawExif.FocalLength || 5.23))
            )
          : Math.PI / 3, // Default ~60 degrees horizontal FOV
        YResolution: rawExif?.FocalLength
          ? 2 *
            Math.atan(
              (rawExif.ImageLength || 3024) /
                (2 * (rawExif.FocalLength || 5.23))
            )
          : Math.PI / 4, // Default ~45 degrees vertical FOV
      };

      const imgW = 900;
      const imgH = 1200;
      const aspect = imgW / imgH;
      // const fovX = THREE.MathUtils.degToRad(50);
      // const fovY = THREE.MathUtils.degToRad(75);
      const { XResolution, YResolution } = getFovFromExif(rawExif);
      return {
        ...photo,

        exif: {
          XResolution,
          YResolution,
        },
      };
    });
  }, [photos]);

  const { texture, isBaking, error } = useEquirectPanoramaBake(
    processedPhotos,
    options
  );

  const handleExportPanorama = async () => {
    if (!texture) {
      console.log("No texture");
      return;
    }
    if (!gl || !texture) throw new Error("Renderer and texture are required");

    // Render into FBO
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const quad = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.MeshBasicMaterial()
    );

    scene.add(quad);

    // Optional final orientation correction (yaw/pitch/roll)
    const yaw = THREE.MathUtils.degToRad(options?.yawOffsetDeg ?? 0);
    const pitch = THREE.MathUtils.degToRad(options?.pitchOffsetDeg ?? -90);
    const roll = THREE.MathUtils.degToRad(options?.rollOffsetDeg ?? 0);

    // Build spherical rotation material
    const rotateMat = makeMaterial(fsRotateEquirect, {
      srcTex: texture,
      yaw,
      pitch,
      roll,
    });
    quad.material = rotateMat as any;

    const target = new THREE.WebGLRenderTarget(4096, 2048);
    gl.setRenderTarget(target);
    gl.render(scene, camera);
    gl.setRenderTarget(null);

    const buffer = new Uint8Array(4096 * 2048 * 4);
    gl.readRenderTargetPixels(target, 0, 0, 4096, 2048, buffer);
    if (!setTextureBuffer) {
      console.log("No handleExportPanoramaWithWebView");
      return;
    }
    setTextureBuffer(buffer);

    // Cleanup
    (rotateMat as any).dispose?.();
    (quad.geometry as any).dispose?.();
    target.dispose();
  };

  useEffect(() => {
    if (exportPanorama) {
      handleExportPanorama();
    }
  }, [exportPanorama]);

  return (
    <>
      {error && (
        // Render a small dev HUD if baking fails
        <group position={[0, 0, -0.5]}>
          <mesh>
            <boxGeometry args={[0.1, 0.1, 0.1]} />
            <meshBasicMaterial color="red" />
          </mesh>
        </group>
      )}

      {/* <group position={[0, 0, -0.5]}>
        <mesh onClick={handleExportPanorama}>
          <boxGeometry args={[0.1, 0.1, 0.1]} />
          <meshBasicMaterial color="gray" />
        </mesh>
      </group> */}

      {!isBaking && texture && (
        <>
          <BakedPanoramaSphere texture={texture} />
        </>
      )}
      {!isBaking && !texture && !error && processedPhotos.length === 0 && (
        // Show indicator when no photos provided
        <group position={[0, 0, -0.5]}>
          <mesh>
            <boxGeometry args={[0.1, 0.1, 0.1]} />
            <meshBasicMaterial color="blue" />
          </mesh>
        </group>
      )}
    </>
  );
}

/**
 * Example usage (pseudo):
 *
 * <PanoramaBakedSphere
 *   photos={photoPointsArray} // ensure each has .texture, .quat, .exif.fovX/Y
 *   options={{ width: 4096, thetaMinDeg: 5, thetaMaxDeg: 35, seamWidth: 0.02 }}
 * />
 *
 * Notes:
 * - Provide textures with photo.texture.colorSpace = sRGB (default) & set p.exif FOVs.
 * - This is Option A (single optical center assumption). Parallax is ignored.
 * - For very large panos or low-VRAM devices, consider tiling the bake.
 */
