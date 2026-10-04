import { useEffect, useRef, useState, type CSSProperties } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  pointerWithin,
  closestCenter,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
} from '@dnd-kit/core';
import { boardKeyboardCoordinates } from '../utils/drag';
import {
  Bookmark,
  ArrowRight,
  PanelRightOpen,
  PanelLeftOpen,
  Search,
  Settings2,
  ShieldCheck,
  Layers,
  MousePointer2,
} from 'lucide-react';
import { Sidebar } from '../components/Sidebar';
import { Board } from '../components/Board';
import { TabsPanel } from '../components/TabsPanel';
import { Editors } from '../components/Editors';
import { Overlays } from '../components/Overlays';
import { IconButton } from '../components/common';
import { useBoard, state, subscribe, run, saveSettings, choose } from '../stores/board';
import { edit, useUI } from '../stores/ui';
import { createWorkspace, move, saveTab } from '../services/actions';
import { isExtension } from '../chrome/api';
type DragData = {
  type: 'space' | 'collection' | 'collection-drop' | 'bookmark' | 'tab';
  id: string;
  parent?: string;
  title: string;
  tab?: chrome.tabs.Tab;
};
const collision: CollisionDetection = (args) => {
  const active = args.active.data.current as DragData | undefined;
  const targets = args.droppableContainers.filter((c) => {
    const data = c.data.current as DragData | undefined;
    if (!data) return false;
    if (active?.type === 'space') return data.type === 'space';
    if (active?.type === 'collection') return data.type === 'collection' || data.type === 'space';
    return ['bookmark', 'collection-drop', 'space'].includes(data.type);
  });
  const scoped = { ...args, droppableContainers: targets };
  const hits = pointerWithin(scoped);
  return hits.length ? hits : closestCenter(scoped);
};
function ResizeHandle({ side }: { side: 'left' | 'right' }) {
  const settings = useBoard((s) => s.settings);
  const key = side === 'left' ? 'sidebarWidth' : 'tabsWidth';
  const min = side === 'left' ? 180 : 240,
    max = side === 'left' ? 320 : 440;
  const start = useRef({ x: 0, width: 0 });
  return (
    <div
      role="separator"
      tabIndex={0}
      aria-label={side === 'left' ? '調整側邊欄寬度' : '調整分頁面板寬度'}
      aria-orientation="vertical"
      aria-valuenow={settings[key]}
      aria-valuemin={min}
      aria-valuemax={max}
      className={`resize-handle ${side}`}
      onPointerDown={(e) => {
        start.current = { x: e.clientX, width: settings[key] };
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
        const value = Math.round(
          Math.max(
            min,
            Math.min(
              max,
              start.current.width + (e.clientX - start.current.x) * (side === 'left' ? 1 : -1),
            ),
          ),
        );
        state().set({ settings: { ...state().settings, [key]: value } });
      }}
      onPointerUp={(e) => {
        e.currentTarget.releasePointerCapture(e.pointerId);
        void run(() => saveSettings({ [key]: state().settings[key] }));
      }}
      onKeyDown={(e) => {
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          e.preventDefault();
          void run(() =>
            saveSettings({
              [key]: Math.max(
                min,
                Math.min(max, settings[key] + (e.key === 'ArrowRight' ? 10 : -10)),
              ),
            }),
          );
        }
      }}
    />
  );
}
export function App() {
  const { ready, error, board, settings } = useBoard();
  const [creating, setCreating] = useState(false);
  const [drag, setDrag] = useState<DragData | null>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: boardKeyboardCoordinates }),
  );
  useEffect(() => subscribe(), []);
  useEffect(() => {
    document.documentElement.style.fontSize = `${settings.fontSize}px`;
  }, [settings.fontSize]);
  useEffect(() => {
    const system = matchMedia('(prefers-color-scheme: dark)');
    const apply = () => {
      document.documentElement.dataset.theme =
        settings.theme === 'system' ? (system.matches ? 'dark' : 'light') : settings.theme;
      document.documentElement.style.colorScheme = document.documentElement.dataset.theme;
    };
    apply();
    system.addEventListener('change', apply);
    return () => system.removeEventListener('change', apply);
  }, [settings.theme]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      const target = e.target as HTMLElement;
      const typing =
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (document.querySelector('[role="dialog"][aria-busy="true"]')) return;
        if (!state().choice)
          edit(useUI.getState().editor?.kind === 'commands' ? null : { kind: 'commands' });
      } else if (e.key === '/' && !typing && !useUI.getState().editor) {
        e.preventDefault();
        window.dispatchEvent(new Event('boardmarks-search'));
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, []);
  const over = (event: DragOverEvent) => {
    clearTimeout(hoverTimer.current);
    const data = event.over?.data.current as DragData | undefined;
    if (data?.type === 'space' && (drag?.type === 'bookmark' || drag?.type === 'tab'))
      hoverTimer.current = setTimeout(
        () => state().set({ selected: data.id, view: 'space', query: '' }),
        650,
      );
  };
  const end = (event: DragEndEvent) => {
    clearTimeout(hoverTimer.current);
    const source = drag;
    setDrag(null);
    const target = event.over?.data.current as DragData | undefined;
    if (!source || !target || event.active.id === event.over?.id) return;
    void run(async () => {
      const spaces = state().board.spaces;
      const collections = spaces.flatMap((s) => s.collections);
      if (source.type === 'space' && target.type === 'space') {
        const index = spaces.find((s) => s.id === target.id)?.index;
        if (index !== undefined) await move(source.id, state().board.root!.id, index);
        return;
      }
      if (source.type === 'collection') {
        if (target.type === 'space') {
          await move(source.id, target.id);
          return;
        }
        if (target.type === 'collection') {
          const c = collections.find((c) => c.id === target.id);
          if (c) await move(source.id, c.spaceId, c.index);
        }
        return;
      }
      let collection =
        target.type === 'bookmark'
          ? collections.find((c) => c.id === target.parent)
          : collections.find((c) => c.id === target.id);
      let index =
        target.type === 'bookmark'
          ? collection?.bookmarks.find((b) => b.id === target.id)?.index
          : undefined;
      if (target.type === 'space') {
        const space = spaces.find((s) => s.id === target.id);
        if (!space?.collections.length) throw new Error('請先在此 Space 建立 Collection。');
        const choice = await choose('選擇 Collection', `收藏至 ${space.title}`, [
          { label: '取消', value: 'cancel' },
          ...space.collections.map((c) => ({ label: c.title, value: c.id })),
        ]);
        if (choice === 'cancel') return;
        collection = space.collections.find((c) => c.id === choice);
        index = undefined;
      }
      if (!collection) return;
      if (source.type === 'tab' && source.tab)
        await saveTab(source.tab, collection.id, false, index);
      else if (source.type === 'bookmark') await move(source.id, collection.id, index);
    });
  };
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collision}
      onDragStart={(e) => setDrag(e.active.data.current as DragData)}
      onDragOver={over}
      onDragEnd={end}
      onDragCancel={() => {
        clearTimeout(hoverTimer.current);
        setDrag(null);
      }}
      autoScroll
    >
      <div
        className={`app ${settings.density} ${settings.showTabs ? 'with-tabs' : 'without-tabs'} ${settings.showSidebar ? 'with-sidebar' : 'without-sidebar'}`}
        style={
          {
            '--sidebar-width': `${settings.sidebarWidth}px`,
            '--tabs-width': `${settings.tabsWidth}px`,
          } as CSSProperties
        }
      >
        {!isExtension && (
          <div className="preview-banner">
            開發預覽 · 使用獨立示範資料，不會存取 Chrome 書籤或分頁
          </div>
        )}
        <div className="workspace">
          <Sidebar />
          {settings.showSidebar ? (
            <ResizeHandle side="left" />
          ) : (
            <nav className="sidebar-rail" aria-label="已收合的左側面板">
              <IconButton
                label="展開左側面板"
                onClick={() => void run(() => saveSettings({ showSidebar: true }))}
              >
                <PanelLeftOpen size={19} />
              </IconButton>
              <IconButton
                label="搜尋書籤"
                onClick={() => window.dispatchEvent(new Event('boardmarks-search'))}
              >
                <Search size={19} />
              </IconButton>
              <IconButton label="設定" onClick={() => edit({ kind: 'settings' })}>
                <Settings2 size={19} />
              </IconButton>
            </nav>
          )}
          {!ready ? (
            <main className="loading-state">
              <div className="loading-line" />
              <p>開啟你的工作台…</p>
            </main>
          ) : error ? (
            <main className="empty-board">
              <h1>暫時無法讀取資料</h1>
              <p>{error}</p>
              <button
                className="primary"
                title="重新載入"
                aria-label="重新載入"
                onClick={() => location.reload()}
              >
                重新載入
              </button>
            </main>
          ) : !board.root ? (
            <main className="welcome">
              <span className="welcome-eyebrow">A LITTLE SPACE. A CLEARER MIND.</span>
              <div className="welcome-logo">
                <Bookmark size={36} />
              </div>
              <h1>
                你的連結，
                <br />
                <span>井然有序。</span>
              </h1>
              <p>
                Welcome to Boardmarks
                <br />
                把散落的分頁，整理成專注的工作空間。
              </p>
              <button
                className="primary welcome-cta"
                title="建立我的工作區"
                aria-label={creating ? '建立中…' : '建立我的工作區'}
                disabled={creating}
                onClick={() => {
                  setCreating(true);
                  void run(createWorkspace).finally(() => setCreating(false));
                }}
              >
                {creating ? '建立中…' : '建立我的工作區'}
                <ArrowRight size={17} />
              </button>
              <div className="welcome-features">
                <span>
                  <Layers size={16} />
                  依主題分類
                </span>
                <span>
                  <MousePointer2 size={16} />
                  拖曳即可收藏
                </span>
                <span>
                  <ShieldCheck size={16} />
                  書籤由你保管
                </span>
              </div>
              <small>
                建立 Boardmarks / Personal / Favorites
                <br />
                你的既有書籤會保持原樣。
              </small>
            </main>
          ) : (
            <Board />
          )}
          {settings.showTabs && (
            <>
              <ResizeHandle side="right" />
              <TabsPanel />
            </>
          )}
          {!settings.showTabs && (
            <div className="restore-panel">
              <IconButton
                label="顯示開啟的分頁"
                onClick={() => void run(() => saveSettings({ showTabs: true }))}
              >
                <PanelRightOpen size={19} />
              </IconButton>
            </div>
          )}
        </div>
      </div>
      <DragOverlay dropAnimation={null}>
        {drag && (
          <div className="drag-overlay">
            <Bookmark size={16} />
            <span>{drag.title}</span>
          </div>
        )}
      </DragOverlay>
      <Editors />
      <Overlays />
    </DndContext>
  );
}
