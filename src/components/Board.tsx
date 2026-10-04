import { memo } from 'react';
import {
  useSortable,
  SortableContext,
  rectSortingStrategy,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useDroppable, useDndContext } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import {
  ChevronDown,
  ChevronRight,
  Star,
  Plus,
  MoreHorizontal,
  ExternalLink,
  FolderOpen,
  ArrowUpRight,
  Layers,
} from 'lucide-react';
import type { Bookmark, Collection, Space } from '../types';
import { useBoard, state, run, setMetadata, notify, choose } from '../stores/board';
import { edit, menu } from '../stores/ui';
import { remove, openCollection } from '../services/actions';
import { openUrl } from '../chrome/tabs';
import { DragHandle, Favicon, IconButton } from './common';
import { searchBoard, searchSpaces } from '../utils/tree';
export const BookmarkCard = memo(function BookmarkCard({ bookmark }: { bookmark: Bookmark }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging, isOver } =
    useSortable({
      id: `bookmark:${bookmark.id}`,
      data: {
        type: 'bookmark',
        id: bookmark.id,
        parent: bookmark.parentId,
        title: bookmark.title,
        index: bookmark.index,
      },
    });
  const { active } = useDndContext();
  const insertAfter =
    active?.data.current?.type === 'bookmark' &&
    active.data.current.parent === bookmark.parentId &&
    active.data.current.index < bookmark.index;
  const open = (background = false, newWindow = state().settings.openIn === 'window') =>
    void run(() => openUrl(bookmark.url, background, newWindow && !background));
  const items = [
    { label: '開啟', action: () => open() },
    { label: '在新視窗開啟', action: () => open(false, true) },
    {
      label: '編輯',
      action: () => edit({ kind: 'bookmark', parent: bookmark.parentId, bookmark }),
    },
    {
      label: '移動',
      action: () =>
        edit({ kind: 'move', id: bookmark.id, nodeType: 'bookmark', parent: bookmark.parentId }),
    },
    {
      label: '複製網址',
      action: () =>
        void run(async () => {
          await navigator.clipboard.writeText(bookmark.url);
          notify('已複製網址');
        }),
    },
    { label: '刪除書籤', danger: true, action: () => void run(() => remove(bookmark.id)) },
  ];
  return (
    <article
      ref={setNodeRef}
      className={`bookmark-card ${isOver ? (insertAfter ? 'insertion insertion-after' : 'insertion') : ''}`}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.3 : 1,
      }}
      onContextMenu={(e) => menu(e, items)}
    >
      <DragHandle label={`拖曳書籤 ${bookmark.title}`} {...attributes} {...listeners} />
      <button
        className="bookmark-link"
        title={bookmark.url}
        aria-label={bookmark.title || bookmark.url}
        onPointerDown={(e) => listeners?.onPointerDown?.(e)}
        onClick={(e) => open(e.metaKey || e.ctrlKey)}
        onAuxClick={(e) => {
          if (e.button === 1) {
            e.preventDefault();
            open(true);
          }
        }}
        onKeyDown={(e) => {
          if (e.key === 'Delete' && !e.repeat) {
            e.preventDefault();
            void run(async () => {
              if (
                (await choose('刪除這個書籤？', bookmark.title, [
                  { label: '取消', value: 'cancel' },
                  { label: '刪除', value: 'delete', danger: true },
                ])) === 'delete'
              )
                await remove(bookmark.id);
            });
          }
        }}
      >
        <Favicon url={bookmark.url} />
        <span>{bookmark.title || bookmark.url}</span>
        <ArrowUpRight size={12} className="open-arrow" />
      </button>
      <IconButton label={`${bookmark.title} 選單`} onClick={(e) => menu(e, items)}>
        <MoreHorizontal size={15} />
      </IconButton>
    </article>
  );
});
function CollectionBlock({
  collection,
  space,
  bookmarks = collection.bookmarks,
  searching = false,
}: {
  collection: Collection;
  space: Space;
  bookmarks?: Bookmark[];
  searching?: boolean;
}) {
  const meta = useBoard((s) => s.metadata[collection.metaKey] ?? {});
  const collapsed = meta.collapsed && !searching;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging, isOver } =
    useSortable({
      id: `collection:${collection.id}`,
      data: {
        type: 'collection',
        id: collection.id,
        parent: space.id,
        title: collection.title,
        index: collection.index,
      },
      disabled: searching,
    });
  const drop = useDroppable({
    id: `drop:${collection.id}`,
    data: { type: 'collection-drop', id: collection.id, parent: space.id, title: collection.title },
  });
  const { active } = useDndContext();
  const sorting =
    isOver &&
    active?.data.current?.type === 'collection' &&
    active.id !== `collection:${collection.id}`;
  const insertAfter =
    active?.data.current?.parent === space.id && active.data.current.index < collection.index;
  const items = [
    {
      label: '全部開啟',
      action: () => void run(() => openCollection(collection.bookmarks.map((b) => b.url))),
    },
    {
      label: '重新命名',
      action: () =>
        edit({
          kind: 'folder',
          id: collection.id,
          parent: space.id,
          title: collection.title,
          label: 'Collection',
        }),
    },
    {
      label: collapsed ? '展開' : '摺疊',
      action: () => void run(() => setMetadata(collection.metaKey, { collapsed: !collapsed })),
    },
    {
      label: '移動到其他 Space',
      action: () =>
        edit({ kind: 'move', id: collection.id, nodeType: 'collection', parent: space.id }),
    },
    { label: '刪除 Collection', danger: true, action: () => void run(() => remove(collection.id)) },
  ];
  return (
    <section
      ref={setNodeRef}
      className={`collection ${drop.isOver || isOver ? 'drop-over' : ''} ${sorting ? (insertAfter ? 'sort-after' : 'sort-before') : ''}`}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.3 : 1,
      }}
      data-collection={collection.id}
    >
      <div ref={drop.setNodeRef} className="collection-drop-zone">
        <header className="collection-header" onContextMenu={(e) => menu(e, items)}>
          <DragHandle
            label={`拖曳 Collection ${collection.title}`}
            {...attributes}
            {...listeners}
          />
          <button
            className="collection-title"
            title={`${collapsed ? '展開' : '摺疊'} ${collection.title}`}
            aria-label={`${collection.title} ${collection.bookmarks.length}`}
            onPointerDown={(e) => listeners?.onPointerDown?.(e)}
            onClick={() =>
              void run(() => setMetadata(collection.metaKey, { collapsed: !collapsed }))
            }
            aria-expanded={!collapsed}
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
            <h2>{collection.title}</h2>
            <span className="count">{collection.bookmarks.length}</span>
          </button>
          <div className="collection-actions">
            <IconButton
              label={meta.starred ? `取消星號 ${collection.title}` : `加上星號 ${collection.title}`}
              className={`icon-button ${meta.starred ? 'is-starred' : ''}`}
              onClick={() =>
                void run(() => setMetadata(collection.metaKey, { starred: !meta.starred }))
              }
            >
              <Star size={15} fill={meta.starred ? 'currentColor' : 'none'} />
            </IconButton>
            <IconButton
              label={`開啟 ${collection.title} 所有書籤`}
              onClick={() => void run(() => openCollection(collection.bookmarks.map((b) => b.url)))}
            >
              <ExternalLink size={15} />
            </IconButton>
            <IconButton
              label={`新增書籤至 ${collection.title}`}
              onClick={() => edit({ kind: 'bookmark', parent: collection.id })}
            >
              <Plus size={17} />
            </IconButton>
            <IconButton label={`${collection.title} 選單`} onClick={(e) => menu(e, items)}>
              <MoreHorizontal size={17} />
            </IconButton>
          </div>
        </header>
        {searching && (
          <p className="search-path">
            {space.title} <ChevronRight size={11} /> {collection.title}
          </p>
        )}
        {!collapsed && (
          <SortableContext
            items={bookmarks.map((b) => `bookmark:${b.id}`)}
            strategy={rectSortingStrategy}
          >
            <div className="card-grid">
              {bookmarks.map((b) => (
                <BookmarkCard key={b.id} bookmark={b} />
              ))}
              {!bookmarks.length && (
                <button
                  className="empty-collection"
                  title="新增書籤"
                  aria-label="拖曳右側分頁到這裡，或新增書籤"
                  onClick={() => edit({ kind: 'bookmark', parent: collection.id })}
                >
                  <Plus size={17} />
                  拖曳右側分頁到這裡，或新增書籤
                </button>
              )}
            </div>
          </SortableContext>
        )}
      </div>
    </section>
  );
}
export function Board() {
  const { board, selected, view, query, metadata } = useBoard();
  const spaceResults = query.trim()
    ? searchSpaces(board.spaces, query)
    : view === 'starred'
      ? board.spaces.filter((s) => metadata[s.metaKey]?.starred)
      : [];
  const groups = query.trim()
    ? searchBoard(board.spaces, query)
    : board.spaces
        .filter((s) => view !== 'space' || s.id === selected)
        .flatMap((space) =>
          space.collections
            .filter(
              (c) =>
                view !== 'starred' ||
                metadata[space.metaKey]?.starred ||
                metadata[c.metaKey]?.starred,
            )
            .map((collection) => ({ space, collection, bookmarks: collection.bookmarks })),
        );
  const current = board.spaces.find((s) => s.id === selected);
  const title = query.trim()
    ? '搜尋結果'
    : view === 'all'
      ? '所有收藏'
      : view === 'starred'
        ? '星號收藏'
        : (current?.title ?? '你的工作台');
  return (
    <main className="main-board">
      <header className="board-heading">
        <div>
          <div className="title-line">
            <span className="space-symbol">
              {view === 'starred' ? <Star size={25} /> : <Layers size={25} />}
            </span>
            <h1>{title}</h1>
          </div>
          <p>
            {query ? `「${query}」 · ` : ''}
            {spaceResults.length > 0 && (
              <>
                {spaceResults.length} Spaces <span>·</span>{' '}
              </>
            )}
            {groups.length} Collections <span>·</span>{' '}
            {groups.reduce((n, g) => n + g.bookmarks.length, 0)} 個書籤
          </p>
        </div>
        <button
          className="primary"
          title="新增 Collection"
          aria-label="新增 Collection"
          disabled={!current}
          onClick={() => edit({ kind: 'folder', parent: current!.id, label: 'Collection' })}
        >
          <Plus size={16} />
          新增 Collection
        </button>
      </header>
      {board.irregularCount > 0 && (
        <p className="notice">
          有 {board.irregularCount} 個項目不符合 Space → Collection → Bookmark
          結構，已安全保留。可在 Chrome 書籤管理員整理。
        </p>
      )}
      <div className="collections">
        {spaceResults.length > 0 && (
          <nav className="space-results" aria-label="符合的 Spaces">
            {spaceResults.map((space) => (
              <button
                className="secondary"
                key={space.id}
                title={space.title || '未命名 Space'}
                aria-label={`${space.title || '未命名 Space'} ${space.collections.length} Collections`}
                onClick={() => state().set({ selected: space.id, view: 'space', query: '' })}
              >
                <FolderOpen size={16} />
                <span>{space.title || '未命名 Space'}</span>
                <span className="count">{space.collections.length} Collections</span>
              </button>
            ))}
          </nav>
        )}
        <SortableContext
          items={groups.map((g) => `collection:${g.collection.id}`)}
          strategy={verticalListSortingStrategy}
        >
          {groups.map((g) => (
            <CollectionBlock key={g.collection.id} {...g} searching={!!query} />
          ))}
        </SortableContext>
        {!groups.length && !spaceResults.length && (
          <div className="empty-board">
            <FolderOpen size={42} />
            <h2>
              {query
                ? '找不到相符的收藏'
                : view === 'starred'
                  ? '將常用的收藏加上星號'
                  : '讓每個好連結，都有自己的位置'}
            </h2>
            <p>
              {query
                ? '試試書籤名稱、網址，或 Space 名稱。'
                : '建立 Collection，開始整理你的網站與分頁。'}
            </p>
            {!query && view !== 'starred' && (
              <button
                className="secondary"
                title={`建立第一個 ${current ? 'Collection' : 'Space'}`}
                aria-label={`建立第一個 ${current ? 'Collection' : 'Space'}`}
                onClick={() =>
                  current
                    ? edit({ kind: 'folder', parent: current.id, label: 'Collection' })
                    : edit({ kind: 'folder', parent: board.root!.id, label: 'Space' })
                }
              >
                <Plus size={16} />
                建立第一個 {current ? 'Collection' : 'Space'}
              </button>
            )}
          </div>
        )}
      </div>
      <footer className="board-footer">
        <span>一個清晰的工作台，留給重要的事。</span>
        <span>
          <kbd>/</kbd> 搜尋 <kbd>⌘ K</kbd> 命令
        </span>
      </footer>
    </main>
  );
}
