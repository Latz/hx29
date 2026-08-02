import { describe, it, expect, vi } from "vitest";

vi.mock("./i18n/index.js", () => ({
  t: {
    error_timeout: "Connection timed out.",
    error_rate_limit: "Server busy (429).",
    error_server: (code) => `Server error (${code}).`,
    error_parse: "Server returned an invalid response.",
    error: (m) => `Error: ${m}`,
  },
}));

import { ApiError } from "./api/apiFetch.js";
import { fmtApiError } from "./apiError.js";

describe("fmtApiError", () => {
  it("formats a timeout ApiError", () => {
    expect(fmtApiError(new ApiError("timeout"))).toBe("Connection timed out.");
  });

  it("formats a rate_limit ApiError", () => {
    expect(fmtApiError(new ApiError("rate_limit"))).toBe("Server busy (429).");
  });

  it("formats a server ApiError with its status code", () => {
    expect(fmtApiError(new ApiError("server", 500))).toBe("Server error (500).");
  });

  it("formats a parse_error ApiError", () => {
    expect(fmtApiError(new ApiError("parse_error"))).toBe("Server returned an invalid response.");
  });

  it("falls back to the generic error message for an unrecognized ApiError type", () => {
    expect(fmtApiError(new ApiError("something_else"))).toBe("Error: something_else");
  });

  it("falls back to the generic error message for a plain Error", () => {
    expect(fmtApiError(new Error("boom"))).toBe("Error: boom");
  });
});
