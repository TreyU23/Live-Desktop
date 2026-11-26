// Descriptions only: approval matching and execution remain exclusively in Java.
export function actionDetails(action) {
  const details = describe(action);
  return { ...details, how: howItRuns(action) };
}

// Plain-language execution path for the approval sheet. Settings launches never claim to change a setting.
function howItRuns(action) {
  const args = action.arguments || {};
  switch (action.kind) {
    case 'windows_set_control': return 'Direct change by Live Desktop';
    case 'windows_open_uri': return String(args.uri || '').toLowerCase().startsWith('ms-settings:') ? 'Opens Windows Settings — Live Desktop doesn’t change the setting' : 'Opens a Windows app externally';
    case 'browser_open_url': return 'Opens your default browser externally';
    case 'workspace_write_file': return 'Writes a file in the workspace folder';
    case 'remember': return 'Saves a memory in this local profile';
    default: return 'Unknown';
  }
}

function describe(action) {
  const args = action.arguments || {};
  switch (action.kind) {
    case 'windows_set_control': return { title: 'Change a device control', target: args.control, operation: args.enabled ? 'Turn on' : 'Turn off', scope: `Future changes to ${args.control}, both on and off, for this local profile.` };
    case 'workspace_write_file': return { title: 'Write a workspace file', target: args.path, operation: 'Create or replace file content', content: args.content, scope: 'Future writes of this exact content to the same normalized workspace path, case-insensitive. A write with different content asks again. Only plain-text files (.txt, .md, .json, .csv, .yaml, .ics and similar) inside a folder can be written; Live Desktop’s own folders, root files, dot-files and dot-folders, and build, editor and agent files are never writable.' };
    case 'browser_open_url': return { title: 'Open a website externally', target: args.url, operation: 'Launch the default browser', scope: 'Future opens of this normalized URL for this local profile.' };
    case 'windows_open_uri': return { title: 'Open Windows externally', target: args.uri, operation: 'Launch the approved Windows destination', scope: 'Future opens of this Windows URI, case-insensitive, for this local profile.' };
    case 'remember': return { title: 'Save a local memory', target: args.category, operation: 'Add a memory', content: args.content, scope: 'Future memories with this exact text in this category, case-insensitive. A memory with different text asks again.' };
    default: return { title: 'Unsupported action', target: action.kind || 'Unknown kind', operation: 'Details unavailable for this action kind', scope: 'This interface cannot describe this capability. Do not approve an action you cannot inspect.', unsupported: true };
  }
}
