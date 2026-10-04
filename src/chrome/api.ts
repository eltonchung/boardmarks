import { previewApi } from './preview';
export const isExtension =
  typeof chrome !== 'undefined' && !!chrome.runtime?.id && !!chrome.bookmarks;
export const api: Pick<typeof chrome, 'bookmarks' | 'tabs' | 'windows' | 'storage'> = isExtension
  ? chrome
  : previewApi;
export async function exclusive<T>(action: () => Promise<T>): Promise<T> {
  return navigator.locks ? navigator.locks.request('boardmarks-write', action) : action();
}
