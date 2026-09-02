import {
  isPoolerSocketError,
  isUniqueViolation,
  mapProductSaveError,
  POOLER_INTERRUPTED_MESSAGE,
  PRODUCT_SAVE_MAY_EXIST_MESSAGE,
} from "./pooler-errors";

describe("pooler-errors", () => {
  it("detects pooler socket crashes", () => {
    expect(
      isPoolerSocketError(
        new Error("Cannot read properties of undefined (reading 'queue')"),
      ),
    ).toBe(true);
    expect(
      isPoolerSocketError(new Error("connection closed via onclose")),
    ).toBe(true);
    expect(isPoolerSocketError(new Error("validation failed"))).toBe(false);
  });

  it("detects unique violations", () => {
    expect(isUniqueViolation({ code: "23505" })).toBe(true);
    expect(isUniqueViolation({ code: "23503" })).toBe(false);
  });

  it("maps pooler errors to retry message", () => {
    expect(mapProductSaveError(new Error("reading 'queue'")).message).toBe(
      POOLER_INTERRUPTED_MESSAGE,
    );
  });

  it("maps unique violations to may-exist message", () => {
    expect(mapProductSaveError({ code: "23505" }).message).toBe(
      PRODUCT_SAVE_MAY_EXIST_MESSAGE,
    );
  });

  it("preserves validation errors", () => {
    expect(mapProductSaveError(new Error("Name is required.")).message).toBe(
      "Name is required.",
    );
  });
});
