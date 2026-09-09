const { contextBridge, ipcRenderer } = require('electron');
const call = channel => async input => {
  const result = await ipcRenderer.invoke(channel, input);
  if (!result.ok) throw new Error(result.error);
  return result.data;
};
contextBridge.exposeInMainWorld('calculator', {
  equationMenu: call('equation:menu'),
  load: call('library:load'), save: call('library:save'), remove: call('library:delete'),
  import: call('library:import'), export: call('library:export'),
  inspect: call('equation:inspect'), solve: call('equation:solve'), cancel: call('equation:cancel'),
});
