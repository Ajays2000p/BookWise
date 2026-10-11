import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Returns the trimmed URL when it is a safe, well-formed http(s) URL,
 * otherwise null. Used to gate external purchase links so unsafe schemes
 * (javascript:, data:, file:, ...) or malformed values never become clickable.
 */
export function sanitizePurchaseUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === "https:" || parsed.protocol === "http:") {
      return trimmed;
    }
    return null;
  } catch {
    return null;
  }
}
