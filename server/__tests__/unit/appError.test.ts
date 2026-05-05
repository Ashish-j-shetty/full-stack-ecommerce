import { AppError } from "../../src/types";

describe("AppError", () => {
  it("sets message correctly", () => {
    const err = new AppError("Not found", 404);
    expect(err.message).toBe("Not found");
  });

  it("sets statusCode correctly", () => {
    const err = new AppError("Not found", 404);
    expect(err.statusCode).toBe(404);
  });

  it("is an instance of Error", () => {
    const err = new AppError("Bad request", 400);
    expect(err).toBeInstanceOf(Error);
  });

  it("is an instance of AppError", () => {
    const err = new AppError("Bad request", 400);
    expect(err).toBeInstanceOf(AppError);
  });

  it("has name set to AppError", () => {
    const err = new AppError("Forbidden", 403);
    expect(err.name).toBe("AppError");
  });

  it.each([400, 401, 403, 404, 409, 429, 500])(
    "preserves statusCode %i",
    (code) => {
      const err = new AppError("error", code);
      expect(err.statusCode).toBe(code);
    },
  );
});
