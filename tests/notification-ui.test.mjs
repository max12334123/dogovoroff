import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [centerSource, actionsSource, cabinetPageSource, cabinetClientSource, staffPageSource, staffClientSource, cssSource] = await Promise.all([
  readFile(new URL("../features/notifications/notification-center.jsx", import.meta.url), "utf8"),
  readFile(new URL("../features/notifications/notification-actions.js", import.meta.url), "utf8"),
  readFile(new URL("../app/cabinet/page.jsx", import.meta.url), "utf8"),
  readFile(new URL("../features/cabinet/cabinet-client.jsx", import.meta.url), "utf8"),
  readFile(new URL("../app/staff/page.jsx", import.meta.url), "utf8"),
  readFile(new URL("../features/staff/staff-client.jsx", import.meta.url), "utf8"),
  readFile(new URL("../features/notifications/notification-center.module.css", import.meta.url), "utf8"),
]);

test("client and staff views receive the same privacy-safe notification feed", () => {
  assert.match(cabinetPageSource, /buildNotificationFeed/);
  assert.match(staffPageSource, /buildNotificationFeed/);
  assert.match(cabinetClientSource, /<NotificationCenter/);
  assert.match(staffClientSource, /<NotificationCenter/);
  assert.match(cabinetClientSource, /selectView\(notification\.targetView, notification\.matterId\)/);
  assert.match(staffClientSource, /openNotification/);
});

test("notification center is accessible and contains no sensitive activity fields", () => {
  assert.match(centerSource, /aria-label={`Уведомления/);
  assert.match(centerSource, /aria-live="polite"/);
  assert.match(centerSource, /dateTime={notification\.createdAt}/);
  assert.match(centerSource, /Без названий дел, имён файлов и текста сообщений/);
  assert.doesNotMatch(centerSource, /notification\.(body|originalName|matterTitle|messageText)/);
  assert.match(cssSource, /@media \(max-width: 680px\)/);
  assert.match(cssSource, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(cssSource, /var\(--cabinet-control-font-size, 10\.5px\)/);
  assert.match(cssSource, /var\(--cabinet-control-font-weight, 650\)/);
});

test("cabinet keeps notification and profile panels mutually exclusive", () => {
  assert.match(centerSource, /typeof open === "boolean"/);
  assert.match(centerSource, /onOpenChange\?\.\(event\.currentTarget\.open\)/);
  assert.match(cabinetClientSource, /const \[headerPanel, setHeaderPanel\] = useState\(null\)/);
  assert.match(cabinetClientSource, /open=\{headerPanel === "notifications"\}/);
  assert.match(cabinetClientSource, /open=\{headerPanel === "profile"\}/);
});

test("read marker action authenticates and updates only the current profile", () => {
  assert.match(actionsSource, /auth\.getClaims\(\)/);
  assert.match(actionsSource, /notifications_read_at/);
  assert.match(actionsSource, /\.eq\("id", userId\)/);
  assert.match(actionsSource, /revalidatePath\("\/cabinet"\)/);
  assert.match(actionsSource, /revalidatePath\("\/staff"\)/);
  assert.doesNotMatch(actionsSource, /service_role|SUPABASE_SERVICE/);
});
