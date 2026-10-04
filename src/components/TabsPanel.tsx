import { useDraggable } from '@dnd-kit/core';
import { PanelRightClose, Monitor, Plus, MoreHorizontal, ExternalLink } from 'lucide-react';
import { useBoard, run, saveSettings } from '../stores/board';
import { edit, menu } from '../stores/ui';
import { activateTab, closeTab } from '../chrome/tabs';
import { isSaveable } from '../utils/url';
import { DragHandle, Favicon, IconButton } from './common';
function TabRow({ tab }: { tab: chrome.tabs.Tab }) {
  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({
    id: `tab:${tab.id}`,
    data: { type: 'tab', id: String(tab.id), title: tab.title, tab },
    disabled: !isSaveable(tab.url),
  });
  const items = [
    { label: '切換至分頁', action: () => void run(() => activateTab(tab)) },
    ...(isSaveable(tab.url)
      ? [
          { label: '收藏至 Collection', action: () => edit({ kind: 'save', tab }) },
          { label: '收藏並關閉', action: () => edit({ kind: 'save', tab, close: true }) },
        ]
      : []),
    { label: '關閉分頁', danger: true, action: () => void run(() => closeTab(tab.id!)) },
  ];
  return (
    <div
      ref={setNodeRef}
      data-tab-id={tab.id}
      data-draggable={isSaveable(tab.url)}
      className={`tab-row ${tab.active ? 'active-tab' : ''}`}
      style={{ opacity: isDragging ? 0.3 : 1 }}
      onPointerDown={(e) => {
        if ((e.target as Element).closest('.icon-button, .drag-handle')) return;
        listeners?.onPointerDown?.(e);
      }}
      onContextMenu={(e) => menu(e, items)}
    >
      <DragHandle
        label={`拖曳分頁 ${tab.title}`}
        disabled={!isSaveable(tab.url)}
        {...attributes}
        {...listeners}
      />
      <button
        className="tab-link"
        title={tab.url}
        aria-label={tab.title || tab.url || '未命名分頁'}
        onClick={() => void run(() => activateTab(tab))}
      >
        <Favicon url={tab.url ?? ''} />
        <span>{tab.title || '未命名分頁'}</span>
        {tab.active && <span className="tab-active-dot" />}
      </button>
      <IconButton label={`分頁 ${tab.title} 選單`} onClick={(e) => menu(e, items)}>
        <MoreHorizontal size={14} />
      </IconButton>
    </div>
  );
}
export function TabsPanel() {
  const windows = useBoard((s) => s.windows);
  const settings = useBoard((s) => s.settings);
  const fontSize = settings.tabsFontSize === 'inherit' ? settings.fontSize : settings.tabsFontSize;
  const changeFont = (delta: number) =>
    void run(() =>
      saveSettings({
        tabsFontSize: Math.max(16, Math.min(22, fontSize + delta)) as 16 | 18 | 20 | 22,
      }),
    );
  return (
    <aside className="tabs-panel" style={{ fontSize: `${fontSize}px` }}>
      <header className="tabs-header">
        <div>
          <h2>開啟的分頁</h2>
          <span className="count">{windows.reduce((n, w) => n + (w.tabs?.length ?? 0), 0)}</span>
        </div>
        <IconButton
          label="收起分頁面板"
          onClick={() => void run(() => saveSettings({ showTabs: false }))}
        >
          <PanelRightClose size={17} />
        </IconButton>
      </header>
      <div className="tabs-font-controls" role="group" aria-label="分頁面板字體大小">
        <span>字體大小</span>
        <button
          type="button"
          title="縮小分頁字體"
          aria-label="縮小分頁字體"
          disabled={fontSize <= 16}
          onClick={() => changeFont(-2)}
        >
          A−
        </button>
        <output aria-live="polite" aria-label="目前分頁字級">
          {fontSize}px
        </output>
        <button
          type="button"
          title="放大分頁字體"
          aria-label="放大分頁字體"
          disabled={fontSize >= 22}
          onClick={() => changeFont(2)}
        >
          A＋
        </button>
      </div>
      <p className="tabs-description">把分頁拖入 Collection，留住靈感。</p>
      <div className="windows-list">
        {windows.map((win, i) => (
          <section className="window-section" key={win.id} data-window-id={win.id}>
            <header>
              <span>
                <Monitor size={14} />
                視窗 {i + 1}
                {win.focused && <small>目前</small>}
              </span>
              <IconButton
                label={`收藏視窗 ${i + 1}`}
                onClick={() => edit({ kind: 'save', windowId: win.id })}
              >
                <Plus size={16} />
              </IconButton>
            </header>
            {win.tabs?.map((tab) => (
              <TabRow tab={tab} key={tab.id} />
            ))}
          </section>
        ))}
        {!windows.length && <p className="muted">目前沒有可顯示的視窗。</p>}
      </div>
      <div className="tabs-footnote">
        <ExternalLink size={14} />
        <span>
          拖曳收藏後，原分頁會保留。
          <br />
          也可使用「收藏並關閉」。
        </span>
      </div>
    </aside>
  );
}
