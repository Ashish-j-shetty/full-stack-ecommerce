import { renderHook, act } from "@testing-library/react";
import { useDebounce } from "./useDebounce";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("useDebounce", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns initial value immediately", () => {
    const { result } = renderHook(() => useDebounce("hello", 300));
    expect(result.current).toBe("hello");
  });

  it("does not update value before delay", () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: "hello", delay: 300 } },
    );

    rerender({ value: "world", delay: 300 });

    // Value should not have changed yet
    expect(result.current).toBe("hello");
  });

  it("updates value after delay", () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: "hello", delay: 300 } },
    );

    rerender({ value: "world", delay: 300 });

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(result.current).toBe("world");
  });

  it("resets timer on new value before delay", () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      { initialProps: { value: "a", delay: 300 } },
    );

    rerender({ value: "ab", delay: 300 });

    act(() => {
      vi.advanceTimersByTime(200); // 200ms, not yet 300
    });

    rerender({ value: "abc", delay: 300 });

    act(() => {
      vi.advanceTimersByTime(200); // 400ms total, but timer reset at 200ms
    });

    // Should still be original because timer restarted
    expect(result.current).toBe("a");

    act(() => {
      vi.advanceTimersByTime(100); // Now 300ms since last change
    });

    expect(result.current).toBe("abc");
  });
});
