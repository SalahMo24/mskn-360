/**
 * JWT utility functions for token validation and decoding
 */

/**
 * Decodes a base64url string to a regular string
 */
function base64UrlDecode(str: string): string {
  // Replace base64url characters with base64 characters
  str = str.replace(/-/g, "+").replace(/_/g, "/");

  // Add padding if needed
  while (str.length % 4 !== 0) {
    str += "=";
  }

  try {
    return atob(str);
  } catch (error) {
    throw new Error("Invalid base64url string");
  }
}

/**
 * Decodes a JWT token payload without verification
 * Note: This is for client-side validation only. Server-side verification is still required.
 */
export function decodeJWT(token: string): any {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) {
      throw new Error("Invalid JWT format");
    }

    const payload = parts[1];
    const decodedPayload = base64UrlDecode(payload);

    return JSON.parse(decodedPayload);
  } catch (error) {
    throw new Error(
      `Failed to decode JWT: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

/**
 * Validates if a JWT token is expired
 */
export function isTokenExpired(token: string): boolean {
  try {
    const payload = decodeJWT(token);

    // Check if the token has an expiration time
    if (!payload.exp) {
      // If no expiration is set, consider it valid
      return false;
    }

    // Convert expiration time to milliseconds and compare with current time
    const expirationTime = payload.exp * 1000; // JWT exp is in seconds
    const currentTime = Date.now();

    return currentTime >= expirationTime;
  } catch (error) {
    // If we can't decode the token, consider it expired/invalid
    console.warn("Token validation failed:", error);
    return true;
  }
}

/**
 * Validates if a JWT token is valid (not expired and properly formatted)
 */
export function isTokenValid(token: string): boolean {
  try {
    if (!token || typeof token !== "string") {
      return false;
    }

    return !isTokenExpired(token);
  } catch (error) {
    console.warn("Token validation failed:", error);
    return false;
  }
}
