export function upsertAction(actions, action) {
  if (!action?.id) return actions;
  const index = actions.findIndex((item) => item.id === action.id);
  if (index < 0) return [...actions, action];
  return actions.map((item, itemIndex) => itemIndex === index ? action : item);
}

export function applyCompletedControlAction(system, action) {
  if (action?.status !== "completed" || action.kind !== "windows_set_control") return system;
  const controlId = action.result?.control || action.arguments?.control;
  if (!controlId || typeof action.result?.enabled !== "boolean") return system;
  return {
    ...system,
    controls: system.controls.map((control) => control.id === controlId
      ? {
          ...control,
          available: action.result.available !== false,
          enabled: action.result.enabled,
          detail: action.result.enabled ? "On" : "Off",
        }
      : control),
  };
}
