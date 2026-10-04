import { useRef, useEffect } from 'react';
import { useSortable, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  PanelLeftClose,
  Search,
  Star,
  Layers,
  Plus,
  Settings2,
  Command,
  MoreHorizontal,
  Folder,
  ArrowUpRight,
} from 'lucide-react';
import { run, state, setMetadata, useBoard, saveSettings } from '../stores/board';
import { edit, menu } from '../stores/ui';
import { remove } from '../services/actions';
import type { Space } from '../types';
import { DragHandle, IconButton } from './common';
function SpaceRow({ space }: { space: Space }) {
  const selected = useBoard((s) => s.selected),
    view = useBoard((s) => s.view),
    starred = useBoard((s) => s.metadata[space.metaKey]?.starred);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging, isOver } =
    useSortable({
      id: `space:${space.id}`,
      data: { type: 'space', id: space.id, title: space.title },
    });
  const items = [
    {
      label: starred ? '取消星號' : '加入星號',
      action: () => void run(() => setMetadata(space.metaKey, { starred: !starred })),
    },
    {
      label: '重新命名',
      action: () =>
        edit({
          kind: 'folder',
          id: space.id,
          parent: state().board.root!.id,
          title: space.title,
          label: 'Space',
        }),
    },
    { label: '刪除 Space', danger: true, action: () => void run(() => remove(space.id)) },
  ];
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.35 : 1,
      }}
      className={`space-row ${selected === space.id && view === 'space' ? 'selected' : ''} ${isOver ? 'drop-over' : ''}`}
      onPointerDown={(e) => {
        if ((e.target as Element).closest('.icon-button, .drag-handle')) return;
        listeners?.onPointerDown?.(e);
      }}
      onContextMenu={(e) => menu(e, items)}
    >
      <DragHandle label={`拖曳 Space ${space.title}`} {...attributes} {...listeners} />
      <button
        className="space-name"
        title={space.title}
        aria-label={`${space.title} ${space.collections.reduce((n, c) => n + c.bookmarks.length, 0)}`}
        onClick={() => state().set({ selected: space.id, view: 'space', query: '' })}
      >
        <Folder size={16} />
        <span>{space.title}</span>
        <span className="count">
          {space.collections.reduce((n, c) => n + c.bookmarks.length, 0)}
        </span>
      </button>
      <IconButton label={`${space.title} 選單`} onClick={(e) => menu(e, items)}>
        <MoreHorizontal size={15} />
      </IconButton>
    </div>
  );
}
export function Sidebar() {
  const { board, query, view, metadata, settings } = useBoard();
  const fontSize =
    settings.sidebarFontSize === 'inherit' ? settings.fontSize : settings.sidebarFontSize;
  const changeFont = (delta: number) =>
    void run(() =>
      saveSettings({
        sidebarFontSize: Math.max(16, Math.min(22, fontSize + delta)) as 16 | 18 | 20 | 22,
      }),
    );
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const focus = () => {
      if (state().settings.showSidebar) input.current?.focus();
      else
        void run(async () => {
          await saveSettings({ showSidebar: true });
          requestAnimationFrame(() => input.current?.focus());
        });
    };
    window.addEventListener('boardmarks-search', focus);
    return () => window.removeEventListener('boardmarks-search', focus);
  }, []);
  return (
    <aside className="sidebar" hidden={!settings.showSidebar} style={{ fontSize: `${fontSize}px` }}>
      <div className="brand">
        <IconButton
          label="收合左側面板"
          onClick={() => void run(() => saveSettings({ showSidebar: false }))}
        >
          <PanelLeftClose size={19} />
        </IconButton>
        <strong>
          boardmarks<span className="brand-dot">.</span>
        </strong>
      </div>
      <div className="sidebar-scroll">
        <div className="sidebar-font-controls" role="group" aria-label="左側側欄字體大小">
          <span>字級</span>
          <button
            type="button"
            title="縮小左側字體"
            aria-label="縮小左側字體"
            disabled={fontSize <= 16}
            onClick={() => changeFont(-2)}
          >
            A−
          </button>
          <output aria-live="polite" aria-label="目前左側字級">
            {fontSize}px
          </output>
          <button
            type="button"
            title="放大左側字體"
            aria-label="放大左側字體"
            disabled={fontSize >= 22}
            onClick={() => changeFont(2)}
          >
            A＋
          </button>
        </div>
        <div className="search-box">
          <Search size={15} />
          <input
            ref={input}
            aria-label="搜尋全部書籤"
            placeholder="搜尋書籤…"
            value={query}
            onChange={(e) => state().set({ query: e.target.value })}
          />
          <kbd>/</kbd>
        </div>
        <nav className="primary-nav" aria-label="主要導覽">
          <button
            title="所有收藏"
            aria-label={`所有收藏 ${board.spaces.reduce((n, s) => n + s.collections.length, 0)}`}
            className={view === 'all' && !query ? 'active' : ''}
            onClick={() => state().set({ view: 'all', query: '' })}
          >
            <Layers size={17} />
            <span className="nav-label">所有收藏</span>
            <span className="count">
              {board.spaces.reduce((n, s) => n + s.collections.length, 0)}
            </span>
          </button>
          <button
            title="星號收藏"
            aria-label={`星號收藏 ${Object.values(metadata).filter((m) => m.starred).length}`}
            className={view === 'starred' && !query ? 'active' : ''}
            onClick={() => state().set({ view: 'starred', query: '' })}
          >
            <Star size={17} />
            <span className="nav-label">星號收藏</span>
            <span className="count">{Object.values(metadata).filter((m) => m.starred).length}</span>
          </button>
        </nav>
        <div className="section-label">
          <span>SPACES</span>
          <IconButton
            label="新增 Space"
            disabled={!board.root}
            onClick={() => edit({ kind: 'folder', parent: board.root!.id, label: 'Space' })}
          >
            <Plus size={16} />
          </IconButton>
        </div>
        <nav className="spaces-nav" aria-label="Spaces">
          <SortableContext
            items={board.spaces.map((s) => `space:${s.id}`)}
            strategy={verticalListSortingStrategy}
          >
            {board.spaces.map((s) => (
              <SpaceRow key={s.id} space={s} />
            ))}
          </SortableContext>
          <button
            className="new-space"
            title="新增 Space"
            aria-label="新增 Space"
            disabled={!board.root}
            onClick={() => edit({ kind: 'folder', parent: board.root!.id, label: 'Space' })}
          >
            <Plus size={15} />
            新增 Space
          </button>
        </nav>
      </div>
      <div className="sidebar-bottom">
        <div className="local-note">
          <span className="status-dot" />
          <span>儲存於 Chrome 書籤</span>
          <ArrowUpRight size={12} />
        </div>
        <div className="bottom-actions">
          <button title="設定" aria-label="設定" onClick={() => edit({ kind: 'settings' })}>
            <Settings2 size={16} />
            設定
          </button>
          <IconButton label="命令選單 Ctrl / ⌘ K" onClick={() => edit({ kind: 'commands' })}>
            <Command size={16} />
          </IconButton>
        </div>
      </div>
    </aside>
  );
}
