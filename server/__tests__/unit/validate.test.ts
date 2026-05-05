import {
  isNonEmptyString,
  isValidEmail,
  isPositiveNumber,
  isPositiveInteger,
  sanitizeString,
  validateRequired,
} from "../../src/middleware/validate";
import { AppError } from "../../src/types";

describe("isNonEmptyString", () => {
  it("returns true for a non-empty string", () => {
    expect(isNonEmptyString("hello")).toBe(true);
  });

  it("returns false for an empty string", () => {
    expect(isNonEmptyString("")).toBe(false);
  });

  it("returns false for a whitespace-only string", () => {
    expect(isNonEmptyString("   ")).toBe(false);
  });

  it("returns false for a number", () => {
    expect(isNonEmptyString(42)).toBe(false);
  });

  it("returns false for null", () => {
    expect(isNonEmptyString(null)).toBe(false);
  });

  it("returns false for undefined", () => {
    expect(isNonEmptyString(undefined)).toBe(false);
  });

  it("returns false for an object", () => {
    expect(isNonEmptyString({})).toBe(false);
  });
});

describe("isValidEmail", () => {
  it("returns true for a standard email", () => {
    expect(isValidEmail("user@example.com")).toBe(true);
  });

  it("returns true for an email with plus sign and subdomain", () => {
    expect(isValidEmail("a+b@x.co.uk")).toBe(true);
  });

  it("returns false for a string missing @", () => {
    expect(isValidEmail("notanemail")).toBe(false);
  });

  it("returns false for a string with missing domain after @", () => {
    expect(isValidEmail("user@")).toBe(false);
  });

  it("returns false when user part is missing", () => {
    expect(isValidEmail("@no-user.com")).toBe(false);
  });

  it("returns false when there is a space before @", () => {
    expect(isValidEmail("user @example.com")).toBe(false);
  });
});

describe("isPositiveNumber", () => {
  it("returns true for a positive integer", () => {
    expect(isPositiveNumber(1)).toBe(true);
  });

  it("returns true for a positive decimal", () => {
    expect(isPositiveNumber(0.1)).toBe(true);
  });

  it("returns true for a large price value", () => {
    expect(isPositiveNumber(99.99)).toBe(true);
  });

  it("returns false for zero", () => {
    expect(isPositiveNumber(0)).toBe(false);
  });

  it("returns false for a negative number", () => {
    expect(isPositiveNumber(-1)).toBe(false);
  });

  it("returns false for NaN", () => {
    expect(isPositiveNumber(NaN)).toBe(false);
  });

  it("returns false for Infinity", () => {
    expect(isPositiveNumber(Infinity)).toBe(false);
  });

  it("returns false for a numeric string", () => {
    expect(isPositiveNumber("5")).toBe(false);
  });

  it("returns false for null", () => {
    expect(isPositiveNumber(null)).toBe(false);
  });
});

describe("isPositiveInteger", () => {
  it("returns true for 1", () => {
    expect(isPositiveInteger(1)).toBe(true);
  });

  it("returns true for a large integer", () => {
    expect(isPositiveInteger(100)).toBe(true);
  });

  it("returns false for zero", () => {
    expect(isPositiveInteger(0)).toBe(false);
  });

  it("returns false for a negative integer", () => {
    expect(isPositiveInteger(-1)).toBe(false);
  });

  it("returns false for a float", () => {
    expect(isPositiveInteger(1.5)).toBe(false);
  });

  it("returns false for NaN", () => {
    expect(isPositiveInteger(NaN)).toBe(false);
  });

  it("returns false for a numeric string", () => {
    expect(isPositiveInteger("1")).toBe(false);
  });
});

describe("sanitizeString", () => {
  it("returns the same string when no special characters", () => {
    expect(sanitizeString("hello")).toBe("hello");
  });

  it("escapes < and >", () => {
    expect(sanitizeString("<script>")).toBe("&lt;script&gt;");
  });

  it("escapes &", () => {
    expect(sanitizeString("Tom & Jerry")).toBe("Tom &amp; Jerry");
  });

  it("escapes double quotes", () => {
    expect(sanitizeString('say "hi"')).toBe("say &quot;hi&quot;");
  });

  it("escapes single quotes", () => {
    expect(sanitizeString("it's")).toBe("it&#x27;s");
  });

  it("escapes all special characters combined", () => {
    expect(sanitizeString('<b>Tom & "Jerry"\'s</b>')).toBe(
      "&lt;b&gt;Tom &amp; &quot;Jerry&quot;&#x27;s&lt;/b&gt;",
    );
  });

  it("trims leading and trailing whitespace", () => {
    expect(sanitizeString("  hello  ")).toBe("hello");
  });
});

describe("validateRequired", () => {
  it("does not throw when all required fields are present", () => {
    expect(() =>
      validateRequired({ name: "Alice", age: 30 }, ["name", "age"]),
    ).not.toThrow();
  });

  it("throws AppError when a required field is missing", () => {
    expect(() =>
      validateRequired({ name: "Alice" }, ["name", "email"]),
    ).toThrow(AppError);
  });

  it("thrown AppError has statusCode 400", () => {
    expect(() => validateRequired({}, ["username"])).toThrow(
      expect.objectContaining({ statusCode: 400 }),
    );
  });

  it("error message names the missing field", () => {
    expect(() => validateRequired({}, ["email"])).toThrow("email is required");
  });

  it("throws when field value is an empty string", () => {
    expect(() => validateRequired({ name: "" }, ["name"])).toThrow(AppError);
  });

  it("throws when field value is whitespace only", () => {
    expect(() => validateRequired({ name: "   " }, ["name"])).toThrow(AppError);
  });

  it("accepts a positive number as a valid field value", () => {
    expect(() => validateRequired({ price: 9.99 }, ["price"])).not.toThrow();
  });

  it("throws when field value is null", () => {
    expect(() => validateRequired({ field: null }, ["field"])).toThrow(AppError);
  });

  it("throws when field value is undefined", () => {
    expect(() => validateRequired({ field: undefined }, ["field"])).toThrow(
      AppError,
    );
  });
});
