// Descriptions only: approval matching and execution remain exclusively in Java.
export function actionDetails(action) {
  const args = action.arguments || {};
  switch (action.kind) {
    case 'windows_set_control': return { title: 'Change a device control', target: args.control, operation: args.enabled ? 'Turn on' : 'Turn off', scope: `Future changes to ${args.control}, both on and off, for this local profile.` };
    case 'workspace_write_file': return { title: 'Write a workspace file', target: args.path, operation: 'Create or replace file content', content: args.content, scope: 'Future writes to the same normalized workspace path, case-insensitive. Approval is not limited to this content.' };
    case 'browser_open_url': return { title: 'Open a website externally', target: args.url, operation: 'Launch the default browser', scope: 'Future opens of this normalized URL for this local profile.' };
    case 'windows_open_uri': return { title: 'Open Windows externally', target: args.uri, operation: 'Launch the approved Windows destination', scope: 'Future opens of this Windows URI, case-insensitive, for this local profile.' };
    case 'remember': return { title: 'Save a local memory', target: args.category, operation: 'Add a memory', content: args.content, scope: 'Future memories in this category, case-insensitive. Approval is not limited to this text.' };
    default: return { title: 'Unsupported action', target: action.kind || 'Unknown kind', operation: 'Details unavailable for this action kind', scope: 'This interface cannot describe this capability. Do not approve an action you cannot inspect.', unsupported: true };
  }
}
