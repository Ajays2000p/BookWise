// Cover chosen in the admin add/edit book form: an uploaded file or an image URL

export type CoverMode = "upload" | "url";

export interface CoverChoice {
  mode: CoverMode;
  file: File | null;
  url: string;
}

export const emptyCoverChoice: CoverChoice = { mode: "upload", file: null, url: "" };

export const MAX_COVER_BYTES = 5 * 1024 * 1024;
const ALLOWED_COVER_TYPES = ["image/jpeg", "image/png", "image/webp"];

export function validateCoverFile(file: File): string | null {
  if (!ALLOWED_COVER_TYPES.includes(file.type)) return "Choose a JPG, PNG or WebP image.";
  if (file.size > MAX_COVER_BYTES) return "The image must be 5 MB or smaller.";
  return null;
}

export const isHttpUrl = (value: string) => /^https?:\/\/\S+$/i.test(value.trim());

/** The cover the admin chose in the active mode, if any. */
export function pendingCover(choice: CoverChoice): { file: File } | { url: string } | null {
  if (choice.mode === "upload") return choice.file ? { file: choice.file } : null;
  const url = choice.url.trim();
  return url ? { url } : null;
}
