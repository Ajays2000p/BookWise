import { describe, it, expect } from "vitest";
import { validateCoverFile, pendingCover, isHttpUrl, emptyCoverChoice, MAX_COVER_BYTES } from "@/lib/coverChoice";

const fileOf = (type: string, size: number) => {
  const file = new File(["x"], "cover", { type });
  Object.defineProperty(file, "size", { value: size });
  return file;
};

describe("validateCoverFile", () => {
  it("accepts JPG, PNG and WebP up to 5 MB", () => {
    expect(validateCoverFile(fileOf("image/jpeg", 1000))).toBeNull();
    expect(validateCoverFile(fileOf("image/png", MAX_COVER_BYTES))).toBeNull();
    expect(validateCoverFile(fileOf("image/webp", 1000))).toBeNull();
  });

  it("rejects other types and files over 5 MB", () => {
    expect(validateCoverFile(fileOf("image/gif", 1000))).toMatch(/JPG, PNG or WebP/);
    expect(validateCoverFile(fileOf("application/pdf", 1000))).toMatch(/JPG, PNG or WebP/);
    expect(validateCoverFile(fileOf("image/jpeg", MAX_COVER_BYTES + 1))).toMatch(/5 MB/);
  });
});

describe("pendingCover", () => {
  it("uses only the active mode", () => {
    const file = fileOf("image/png", 10);
    expect(pendingCover({ mode: "upload", file, url: "https://x.com/a.jpg" })).toEqual({ file });
    expect(pendingCover({ mode: "url", file, url: " https://x.com/a.jpg " })).toEqual({ url: "https://x.com/a.jpg" });
  });

  it("returns null when no cover was given, so the generated cover is used", () => {
    expect(pendingCover(emptyCoverChoice)).toBeNull();
    expect(pendingCover({ mode: "url", file: null, url: "   " })).toBeNull();
  });
});

describe("isHttpUrl", () => {
  it("accepts only http(s) URLs", () => {
    expect(isHttpUrl("https://books.google.com/x")).toBe(true);
    expect(isHttpUrl("http://example.com/a.png")).toBe(true);
    expect(isHttpUrl("ftp://example.com/a.png")).toBe(false);
    expect(isHttpUrl("example.com/a.png")).toBe(false);
  });
});
