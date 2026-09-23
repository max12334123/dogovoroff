import assert from "node:assert/strict";
import test from "node:test";
import {
  getDocumentsSideAction,
  getTimelineStagePresentation,
  getVisibleTimelineStages,
} from "../features/cabinet/cabinet-view-domain.mjs";

const actionableRequest = {
  id: "request-a",
  status: "requested",
  requiresClientAction: true,
};

test("an actionable managed request owns Documents even with a generic next action", () => {
  assert.equal(
    getDocumentsSideAction({
      clientPrimaryDocumentRequest: actionableRequest,
      nextAction: { title: "Загрузить общий документ" },
    }),
    "managed_request",
  );
});

test("an actionable managed request owns Documents without a generic next action", () => {
  assert.equal(
    getDocumentsSideAction({
      clientPrimaryDocumentRequest: {
        ...actionableRequest,
        status: "changes_requested",
      },
      nextAction: null,
    }),
    "managed_request",
  );
});

test("Documents keeps the generic upload and quiet branches when no request is actionable", () => {
  assert.equal(
    getDocumentsSideAction({
      clientPrimaryDocumentRequest: null,
      nextAction: { title: "Загрузить общий документ" },
    }),
    "generic_upload",
  );
  assert.equal(
    getDocumentsSideAction({ clientPrimaryDocumentRequest: null, nextAction: null }),
    "quiet",
  );
});

test("timeline keeps every stage in My Matters and only the current stage in overview", () => {
  const stages = [
    { id: "complete", status: "complete" },
    { id: "current", status: "current" },
    { id: "future", status: "future" },
  ];
  const matter = { stages, currentStage: 1 };

  assert.deepEqual(getVisibleTimelineStages(matter), stages);
  assert.deepEqual(getVisibleTimelineStages(matter, { condensed: true }), [stages[1]]);
});

test("timeline expands details only for the selected current stage", () => {
  assert.deepEqual(
    getTimelineStagePresentation({ status: "complete", detail: "20 августа" }, { isCurrent: false }),
    { statusLabel: "Завершён", detail: null },
  );
  assert.deepEqual(
    getTimelineStagePresentation({ status: "current", detail: "В работе" }, { isCurrent: true }),
    { statusLabel: "Текущий этап", detail: "В работе" },
  );
  assert.deepEqual(
    getTimelineStagePresentation({ status: "future", detail: "Ожидает начала" }, { isCurrent: false }),
    { statusLabel: "Предстоит", detail: null },
  );
});
