import { describe, it, expect } from "vitest";
import { resolveCoverUrl } from "@/services/api";

describe("resolveCoverUrl", () => {
  it("loads locally saved covers from the API server", () => {
    expect(resolveCoverUrl("/covers/abc.jpg")).toBe("http://localhost:3001/covers/abc.jpg");
  });

  it("leaves remote, inline and placeholder covers unchanged", () => {
    expect(resolveCoverUrl("https://books.google.com/books/content?id=1")).toBe("https://books.google.com/books/content?id=1");
    expect(resolveCoverUrl("data:image/png;base64,AAAA")).toBe("data:image/png;base64,AAAA");
    expect(resolveCoverUrl("/placeholder.svg")).toBe("/placeholder.svg");
  });

  it("returns undefined for empty values", () => {
    expect(resolveCoverUrl("")).toBeUndefined();
    expect(resolveCoverUrl(null)).toBeUndefined();
    expect(resolveCoverUrl(undefined)).toBeUndefined();
  });
});
