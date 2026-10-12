import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { BookMetadata } from "@/components/BookMetadata";

describe("BookMetadata component", () => {
  it("renders distinct user rating count correctly", () => {
    render(<BookMetadata views={100} ratingCount={24} averageRating={4.5} />);
    expect(screen.getByText("Rated by 24 users")).toBeTruthy();
    expect(screen.getByText("4.5")).toBeTruthy();
  });

  it("handles 0 rating count properly", () => {
    render(<BookMetadata views={50} ratingCount={0} averageRating={0} />);
    expect(screen.getByText("Rated by 0 users")).toBeTruthy();
    // Should not display average rating if ratingCount is 0
    expect(screen.queryByText("0.0")).toBeNull();
  });

  it("updates average rating when provided with new rating value", () => {
    const { rerender } = render(<BookMetadata views={100} ratingCount={24} averageRating={4.2} />);
    expect(screen.getByText("Rated by 24 users")).toBeTruthy();
    expect(screen.getByText("4.2")).toBeTruthy();

    // Existing user updates rating: count stays 24, average increases to 4.3
    rerender(<BookMetadata views={100} ratingCount={24} averageRating={4.3} />);
    expect(screen.getByText("Rated by 24 users")).toBeTruthy();
    expect(screen.getByText("4.3")).toBeTruthy();

    // First-time user rates: count increases to 25, average changes to 4.4
    rerender(<BookMetadata views={100} ratingCount={25} averageRating={4.4} />);
    expect(screen.getByText("Rated by 25 users")).toBeTruthy();
    expect(screen.getByText("4.4")).toBeTruthy();
  });

  it("displays view count for most popular books", () => {
    render(<BookMetadata views={1600} ratingCount={110} averageRating={4.8} />);
    expect(screen.getByText("1600 views")).toBeTruthy();
    expect(screen.getByText("Rated by 110 users")).toBeTruthy();
    expect(screen.getByText("4.8")).toBeTruthy();
  });
});
