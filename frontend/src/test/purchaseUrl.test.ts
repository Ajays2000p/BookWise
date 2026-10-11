import { describe, it, expect } from "vitest";
import { sanitizePurchaseUrl } from "@/lib/utils";

describe("sanitizePurchaseUrl", () => {
  it("accepts a valid https URL", () => {
    expect(sanitizePurchaseUrl("https://www.retailer.com/book/12345")).toBe(
      "https://www.retailer.com/book/12345"
    );
  });

  it("accepts a valid http URL", () => {
    expect(sanitizePurchaseUrl("http://example.com/product/1")).toBe(
      "http://example.com/product/1"
    );
  });

  it("trims surrounding whitespace", () => {
    expect(sanitizePurchaseUrl("  https://example.com/book  ")).toBe(
      "https://example.com/book"
    );
  });

  it("returns null for empty and whitespace-only values", () => {
    expect(sanitizePurchaseUrl("")).toBeNull();
    expect(sanitizePurchaseUrl("   ")).toBeNull();
  });

  it("rejects unsafe URL schemes", () => {
    expect(sanitizePurchaseUrl("javascript:alert(1)")).toBeNull();
    expect(sanitizePurchaseUrl("data:text/html,<script></script>")).toBeNull();
    expect(sanitizePurchaseUrl("file:///etc/passwd")).toBeNull();
    expect(sanitizePurchaseUrl("vbscript:msgbox(1)")).toBeNull();
  });

  it("rejects malformed URLs", () => {
    expect(sanitizePurchaseUrl("not a url")).toBeNull();
    expect(sanitizePurchaseUrl("htp://example.com")).toBeNull();
    expect(sanitizePurchaseUrl("https://")).toBeNull();
    expect(sanitizePurchaseUrl("//example.com/page")).toBeNull();
  });

  it("rejects non-string values", () => {
    expect(sanitizePurchaseUrl(undefined)).toBeNull();
    expect(sanitizePurchaseUrl(null)).toBeNull();
    expect(sanitizePurchaseUrl(42)).toBeNull();
    expect(sanitizePurchaseUrl({ href: "https://example.com" })).toBeNull();
  });
});
