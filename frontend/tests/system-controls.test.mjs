import test from "node:test";
import assert from "node:assert/strict";
import { applyCompletedControlAction, upsertAction } from "../src/systemControls.js";

test("completed radio actions update only the affected control immediately", () => {
  const system = {
    controls: [
      { id: "wifi", enabled: true, available: true, detail: "On" },
      { id: "bluetooth", enabled: true, available: true, detail: "On" },
    ],
  };
  const updated = applyCompletedControlAction(system, {
    kind: "windows_set_control",
    status: "completed",
    arguments: { control: "wifi", enabled: false },
    result: { control: "wifi", available: true, enabled: false, state: "Off" },
  });

  assert.deepEqual(updated.controls[0], { id: "wifi", enabled: false, available: true, detail: "Off" });
  assert.equal(updated.controls[1], system.controls[1]);
});

test("pending actions do not optimistically change a radio", () => {
  const system = { controls: [{ id: "wifi", enabled: true, available: true, detail: "On" }] };
  const updated = applyCompletedControlAction(system, {
    kind: "windows_set_control",
    status: "pending",
    arguments: { control: "wifi", enabled: false },
  });

  assert.equal(updated, system);
});

test("action updates replace an existing row without disturbing its order", () => {
  const actions = [{ id: "one", status: "pending" }, { id: "two", status: "pending" }];
  assert.deepEqual(upsertAction(actions, { id: "one", status: "completed" }), [
    { id: "one", status: "completed" },
    { id: "two", status: "pending" },
  ]);
});
