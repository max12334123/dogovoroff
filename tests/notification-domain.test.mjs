import assert from "node:assert/strict";
import test from "node:test";

import {
  NOTIFICATION_LIMIT,
  buildNotificationFeed,
  createSafeNotification,
} from "../features/notifications/notification-domain.mjs";

const MATTER_ID = "11111111-1111-4111-8111-111111111111";

test("safe notifications use allowlisted copy and discard arbitrary payload fields", () => {
  const notification = createSafeNotification({
    id: "22222222-2222-4222-8222-222222222222",
    matterId: MATTER_ID,
    type: "message.created",
    createdAt: "2026-08-30T05:00:00.000Z",
    title: "Секретное дело",
    body: "Текст сообщения",
    originalName: "Паспорт.pdf",
  });

  assert.deepEqual(Object.keys(notification).sort(), [
    "createdAt",
    "dateLabel",
    "description",
    "id",
    "matterId",
    "targetView",
    "title",
    "type",
  ]);
  assert.equal(notification.title, "Новое сообщение");
  assert.equal(notification.description, "В личном кабинете появилось новое сообщение.");
  assert.equal(notification.targetView, "messages");
  assert.doesNotMatch(JSON.stringify(notification), /Секретное дело|Текст сообщения|Паспорт/);
});

test("notification feed sorts activity, applies the read marker, and enforces the limit", () => {
  const notifications = Array.from({ length: NOTIFICATION_LIMIT + 5 }, (_, index) => createSafeNotification({
    id: `event-${index}`,
    matterId: MATTER_ID,
    type: "matter.event.created",
    createdAt: new Date(Date.UTC(2026, 7, 30, 5, index)).toISOString(),
  }));
  const feed = buildNotificationFeed(
    [{ id: MATTER_ID, notifications }],
    "2026-08-30T05:20:00.000Z",
    100,
  );

  assert.equal(feed.length, NOTIFICATION_LIMIT);
  assert.equal(feed[0].createdAt, "2026-08-30T05:24:00.000Z");
  assert.equal(feed[0].unread, true);
  assert.equal(feed.at(-1).createdAt, "2026-08-30T05:05:00.000Z");
  assert.equal(feed.at(-1).unread, false);
});

test("notification feed re-sanitizes nested activity before returning it to the UI", () => {
  const feed = buildNotificationFeed([{
    id: MATTER_ID,
    notifications: [{
      id: "message.created:source-1",
      matterId: MATTER_ID,
      type: "message.created",
      createdAt: "2026-08-30T05:00:00.000Z",
      title: "Подменённый заголовок",
      body: "Секретный текст",
    }],
  }]);

  assert.equal(feed[0].id, "message.created:source-1");
  assert.equal(feed[0].title, "Новое сообщение");
  assert.doesNotMatch(JSON.stringify(feed[0]), /Подменённый|Секретный/);
});

test("unknown notification kinds and invalid timestamps are ignored", () => {
  assert.equal(createSafeNotification({ id: "1", matterId: MATTER_ID, type: "secret.created", createdAt: new Date().toISOString() }), null);
  assert.equal(createSafeNotification({ id: "1", matterId: MATTER_ID, type: "message.created", createdAt: "wrong" }), null);
});
