import { api } from './api';
import { validUrl } from '../utils/url';
export async function readWindows() {
  return (await api.windows.getAll({ populate: true })).filter((w) => !w.incognito);
}
export async function activateTab(tab: chrome.tabs.Tab) {
  if (tab.id === undefined) return;
  await api.windows.update(tab.windowId, { focused: true });
  await api.tabs.update(tab.id, { active: true });
}
export async function closeTab(id: number) {
  await api.tabs.remove(id);
}
export async function openUrl(url: string, background = false, newWindow = false) {
  const clean = validUrl(url);
  if (newWindow) {
    await api.windows.create({ url: clean });
  } else {
    const current = await api.windows.getCurrent();
    await api.tabs.create({ url: clean, active: !background, windowId: current.id });
  }
}
export async function openAll(urls: string[], newWindow = false) {
  const clean = urls.map(validUrl);
  if (!clean.length) return;
  if (newWindow) await api.windows.create({ url: clean });
  else {
    const current = await api.windows.getCurrent();
    for (const url of clean) await api.tabs.create({ url, active: false, windowId: current.id });
  }
}
