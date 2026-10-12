import { describe, it, expect, vi } from "vitest";

describe("One-time rating submission workflow", () => {
  interface BookState {
    id: string;
    title: string;
    ratingCount: number;
    averageRating: number;
  }

  interface RatingWidgetState {
    book: BookState;
    userRating: number;
    submitted: boolean;
    checkingRating: boolean;
  }

  // Simulates BookDetails.tsx rating workflow
  class BookRatingWorkflow {
    state: RatingWidgetState;
    ratingApiSubmit: (id: string, rating: number) => Promise<any>;
    bookApiGetById: (id: string) => Promise<any>;
    ratingApiGetUserRating: (id: string) => Promise<any>;

    constructor(
      initialBook: BookState,
      apis: {
        ratingApiSubmit: (id: string, rating: number) => Promise<any>;
        bookApiGetById: (id: string) => Promise<any>;
        ratingApiGetUserRating: (id: string) => Promise<any>;
      },
      isAuthenticated = true
    ) {
      this.state = {
        book: { ...initialBook },
        userRating: 0,
        submitted: false,
        checkingRating: isAuthenticated,
      };
      this.ratingApiSubmit = apis.ratingApiSubmit;
      this.bookApiGetById = apis.bookApiGetById;
      this.ratingApiGetUserRating = apis.ratingApiGetUserRating;
    }

    // Called on mount / page refresh
    async initPage(bookId: string) {
      if (this.state.checkingRating) {
        try {
          const res = await this.ratingApiGetUserRating(bookId);
          if (res.data && res.data.value > 0) {
            this.state.userRating = res.data.value;
            this.state.submitted = true;
          }
        } finally {
          this.state.checkingRating = false;
        }
      }
    }

    // Called when user clicks "Submit Rating"
    async submitRating(bookId: string, value: number) {
      if (value === 0) throw new Error("Select a rating first");

      const ratingRes = await this.ratingApiSubmit(bookId, value);
      this.state.submitted = true;
      this.state.userRating = value;

      // Apply server-verified stats immediately
      if (ratingRes.data?.ratingCount !== undefined && ratingRes.data?.averageRating !== undefined) {
        this.state.book.ratingCount = ratingRes.data.ratingCount;
        this.state.book.averageRating = ratingRes.data.averageRating;
      }

      // Sync with refetched book
      const bookRes = await this.bookApiGetById(bookId);
      if (bookRes.data) {
        this.state.book.ratingCount = bookRes.data.ratingCount;
        this.state.book.averageRating = bookRes.data.rating;
      }

      return ratingRes;
    }

    // Evaluates what UI should be rendered
    getRenderedUI() {
      if (this.state.checkingRating) return "LOADING_CHECK";
      if (this.state.submitted) return "CONFIRMATION_MESSAGE"; // "Thank you for rating this book!"
      return "RATING_FORM"; // Star selector + "Submit Rating" button
    }
  }

  it("before rating, displays star selector and Submit Rating button", async () => {
    const book: BookState = { id: "book-1", title: "Test Book", ratingCount: 24, averageRating: 4.2 };
    const workflow = new BookRatingWorkflow(book, {
      ratingApiSubmit: vi.fn(),
      bookApiGetById: vi.fn(),
      ratingApiGetUserRating: vi.fn().mockResolvedValue({ data: { value: 0 } }),
    });

    await workflow.initPage("book-1");

    expect(workflow.state.submitted).toBe(false);
    expect(workflow.getRenderedUI()).toBe("RATING_FORM");
  });

  it("after successful first-time rating, hides rating form, displays confirmation message, and increments count", async () => {
    const book: BookState = { id: "book-1", title: "Test Book", ratingCount: 24, averageRating: 4.0 };
    const ratingApiSubmit = vi.fn().mockResolvedValue({
      data: { _id: "r1", ratingCount: 25, averageRating: 4.04 },
    });
    const bookApiGetById = vi.fn().mockResolvedValue({
      data: { _id: "book-1", ratingCount: 25, rating: 4.0 },
    });
    const ratingApiGetUserRating = vi.fn().mockResolvedValue({ data: { value: 0 } });

    const workflow = new BookRatingWorkflow(book, {
      ratingApiSubmit,
      bookApiGetById,
      ratingApiGetUserRating,
    });

    await workflow.initPage("book-1");
    expect(workflow.getRenderedUI()).toBe("RATING_FORM");

    // User submits 5 stars
    await workflow.submitRating("book-1", 5);

    // Form is now locked to one-time completion
    expect(workflow.state.submitted).toBe(true);
    expect(workflow.getRenderedUI()).toBe("CONFIRMATION_MESSAGE");
    expect(workflow.state.book.ratingCount).toBe(25);
    expect(workflow.state.book.averageRating).toBe(4.0);
  });

  it("when same user revisits or refreshes, checks existing rating and displays confirmation message without showing form or incrementing count", async () => {
    const book: BookState = { id: "book-1", title: "Test Book", ratingCount: 25, averageRating: 4.0 };
    const ratingApiGetUserRating = vi.fn().mockResolvedValue({
      data: { _id: "r1", value: 5 },
    });

    const workflow = new BookRatingWorkflow(book, {
      ratingApiSubmit: vi.fn(),
      bookApiGetById: vi.fn(),
      ratingApiGetUserRating,
    });

    // Simulating page refresh / revisit
    await workflow.initPage("book-1");

    expect(ratingApiGetUserRating).toHaveBeenCalledWith("book-1");
    expect(workflow.state.submitted).toBe(true);
    expect(workflow.state.userRating).toBe(5);
    expect(workflow.getRenderedUI()).toBe("CONFIRMATION_MESSAGE");
    // Distinct rating count must not be incremented
    expect(workflow.state.book.ratingCount).toBe(25);
  });

  it("does not update count or hide form if API request fails", async () => {
    const book: BookState = { id: "book-1", title: "Test Book", ratingCount: 24, averageRating: 4.0 };
    const ratingApiSubmit = vi.fn().mockRejectedValue(new Error("Network Error"));
    const bookApiGetById = vi.fn();
    const ratingApiGetUserRating = vi.fn().mockResolvedValue({ data: { value: 0 } });

    const workflow = new BookRatingWorkflow(book, {
      ratingApiSubmit,
      bookApiGetById,
      ratingApiGetUserRating,
    });

    await workflow.initPage("book-1");

    await expect(workflow.submitRating("book-1", 5)).rejects.toThrow("Network Error");

    expect(workflow.state.submitted).toBe(false);
    expect(workflow.getRenderedUI()).toBe("RATING_FORM");
    expect(workflow.state.book.ratingCount).toBe(24);
  });
});
