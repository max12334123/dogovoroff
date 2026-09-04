import assert from "node:assert/strict";
import test from "node:test";
import {
  buildStaffHref,
  getStaffNavigation,
  parseStaffLocation,
} from "../features/staff/staff-navigation-domain.mjs";

const matters = [{ id: "matter-a" }, { id: "matter-b" }];

test("staff navigation groups daily and rare work", () => {
  assert.deepEqual(
    getStaffNavigation({ intakeEnabled: true, canViewAudit: true, canManageTrash: true }),
    {
      primary: ["today", "inbox", "matters", "clients", "more"],
      more: ["documents", "messages", "audit", "trash"],
    },
  );
  assert.deepEqual(
    getStaffNavigation({ intakeEnabled: false, canViewAudit: false, canManageTrash: false }),
    { primary: ["today", "matters", "clients", "more"], more: ["documents", "messages"] },
  );
});

test("staff location rejects foreign matters and unknown tabs", () => {
  assert.deepEqual(parseStaffLocation("?view=matter&matter=matter-b&tab=documents&from=today", matters), {
    view: "matter",
    matterId: "matter-b",
    tab: "documents",
    from: "today",
  });
  assert.deepEqual(parseStaffLocation("?view=matter&matter=foreign&tab=delete&from=audit", matters), {
    view: "today",
    matterId: null,
    tab: "overview",
    from: "today",
  });
});

test("staff href carries identifiers but no client text", () => {
  assert.equal(
    buildStaffHref({ view: "matter", matterId: "matter-a", tab: "messages", from: "inbox" }),
    "/staff?view=matter&matter=matter-a&tab=messages&from=inbox",
  );
  assert.equal(buildStaffHref({ view: "matter", matterId: "client@example.com", tab: "messages" }), "/staff");
  assert.equal(buildStaffHref({ view: "matter", matterId: "contract.pdf", tab: "messages" }), "/staff");
});

test("staff location hides capability-gated views and origins", () => {
  const capabilities = { intakeEnabled: false, canViewAudit: false, canManageTrash: false };
  assert.deepEqual(parseStaffLocation("?view=audit", matters, capabilities), {
    view: "today", matterId: null, tab: "overview", from: "today",
  });
  assert.deepEqual(parseStaffLocation("?view=trash", matters, capabilities), {
    view: "today", matterId: null, tab: "overview", from: "today",
  });
  assert.deepEqual(parseStaffLocation("?view=matter&matter=matter-a&from=audit", matters, capabilities), {
    view: "matter", matterId: "matter-a", tab: "overview", from: "today",
  });
});
