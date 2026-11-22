import { describe, expect, it } from "vitest";
import { displayLogin, toAuthEmail } from "./login";

describe("username sign-in", () => {
  it("maps the admin username to its internal sign-in address", () => {
    expect(toAuthEmail(" admin_burkaharbu ")).toBe("admin_burkaharbu@burkaharbu-sss.local");
  });
  it("keeps real emails unchanged", () => {
    expect(toAuthEmail("Teacher@Example.com")).toBe("teacher@example.com");
  });
  it("shows the username instead of the internal address", () => {
    expect(displayLogin("admin_burkaharbu@burkaharbu-sss.local")).toBe("admin_burkaharbu");
    expect(displayLogin("teacher@example.com")).toBe("teacher@example.com");
  });
});
