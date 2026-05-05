import { logger } from "../../src/utils/logger";

describe("logger", () => {
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it("logger.info calls console.log with [INFO] in the prefix", () => {
    logger.info("test message");
    expect(consoleSpy).toHaveBeenCalledTimes(1);
    expect(consoleSpy.mock.calls[0][0]).toContain("[INFO]");
  });

  it("logger.warn calls console.log with [WARN] in the prefix", () => {
    logger.warn("test message");
    expect(consoleSpy.mock.calls[0][0]).toContain("[WARN]");
  });

  it("logger.error calls console.log with [ERROR] in the prefix", () => {
    logger.error("test message");
    expect(consoleSpy.mock.calls[0][0]).toContain("[ERROR]");
  });

  it("output includes the log message", () => {
    logger.info("my message");
    expect(consoleSpy.mock.calls[0][0]).toContain("my message");
  });

  it("output includes an ISO timestamp", () => {
    logger.info("msg");
    expect(consoleSpy.mock.calls[0][0]).toMatch(
      /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,
    );
  });

  it("passes meta as second argument to console.log when provided", () => {
    const meta = { userId: 42 };
    logger.info("msg", meta);
    expect(consoleSpy.mock.calls[0][1]).toBe(meta);
  });

  it("does not pass a second argument when meta is undefined", () => {
    logger.info("msg");
    expect(consoleSpy.mock.calls[0]).toHaveLength(1);
  });

  describe("logger.debug", () => {
    const originalEnv = process.env.NODE_ENV;

    afterEach(() => {
      process.env.NODE_ENV = originalEnv;
    });

    it("calls console.log when NODE_ENV is not production", () => {
      process.env.NODE_ENV = "test";
      logger.debug("debug msg");
      expect(consoleSpy).toHaveBeenCalledTimes(1);
    });

    it("is a no-op when NODE_ENV is production", () => {
      process.env.NODE_ENV = "production";
      logger.debug("debug msg");
      expect(consoleSpy).not.toHaveBeenCalled();
    });
  });
});
