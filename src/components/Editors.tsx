import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  Download,
  Upload,
  Search,
  Plus,
  Settings2,
  PanelRight,
  PanelLeft,
  Sun,
  ArrowUpRight,
} from 'lucide-react';
import { useBoard, state, run, notify, saveSettings } from '../stores/board';
import { useUI, edit, type Editor } from '../stores/ui';
import {
  createNamedFolder,
  rename,
  saveBookmark,
  editBookmark,
  saveTab,
  saveWindow,
  move,
  exportData,
  importData,
  remove,
} from '../services/actions';
import { backupCounts, downloadBackup } from '../services/backup';
import { parseImportText } from '../services/import';
import { Modal } from './common';
import { isExtension } from '../chrome/api';
import { searchBoard, searchSpaces } from '../utils/tree';
import { openUrl } from '../chrome/tabs';
function CollectionSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const spaces = useBoard((s) => s.board.spaces);
  return (
    <label>
      Collection
      <select value={value} onChange={(e) => onChange(e.target.value)} required>
        <option value="" disabled>
          選擇 Collection
        </option>
        {spaces.map((s) => (
          <optgroup label={s.title} key={s.id}>
            {s.collections.map((c) => (
              <option value={c.id} key={c.id}>
                {c.title}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </label>
  );
}
function SpaceSelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const spaces = useBoard((s) => s.board.spaces);
  return (
    <label>
      Space
      <select value={value} onChange={(e) => onChange(e.target.value)} required>
        <option value="" disabled>
          選擇 Space
        </option>
        {spaces.map((s) => (
          <option value={s.id} key={s.id}>
            {s.title}
          </option>
        ))}
      </select>
    </label>
  );
}
function FormEditor({
  editor,
}: {
  editor: Exclude<Editor, { kind: 'settings' | 'commands' | 'import' }>;
}) {
  const closeAfterSave = useBoard((s) => s.settings.closeAfterSave);
  const effectiveClose =
    editor.kind === 'save' && editor.windowId === undefined && (editor.close ?? closeAfterSave);
  const initialParent =
    'parent' in editor
      ? editor.parent
      : (state().board.spaces.find((s) => s.id === state().selected)?.collections[0]?.id ?? '');
  const [parent, setParent] = useState(initialParent),
    [title, setTitle] = useState(
      editor.kind === 'folder'
        ? (editor.title ?? '')
        : editor.kind === 'bookmark'
          ? (editor.bookmark?.title ?? '')
          : '',
    ),
    [url, setUrl] = useState(editor.kind === 'bookmark' ? (editor.bookmark?.url ?? '') : ''),
    [busy, setBusy] = useState(false),
    [newCollection, setNewCollection] = useState(false),
    [space, setSpace] = useState(state().selected),
    [newId, setNewId] = useState<string | null>(null);
  const heading =
    editor.kind === 'folder'
      ? `${editor.id ? '重新命名' : '新增'} ${editor.label}`
      : editor.kind === 'bookmark'
        ? `${editor.bookmark ? '編輯' : '新增'}書籤`
        : editor.kind === 'move'
          ? '移動收藏'
          : editor.windowId !== undefined
            ? '收藏整個視窗'
            : effectiveClose
              ? '收藏並關閉分頁'
              : '收藏分頁';
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    const ok = await run(async () => {
      if (editor.kind === 'folder') {
        if (editor.id) await rename(editor.id, title);
        else {
          const n = await createNamedFolder(parent, title);
          if (editor.label === 'Space') state().set({ selected: n.id, view: 'space', query: '' });
        }
        notify('已儲存分類');
      }
      if (editor.kind === 'bookmark') {
        if (editor.bookmark) await editBookmark(editor.bookmark, title, url, parent);
        else {
          const result = await saveBookmark(parent, title, url);
          if (!result) return;
          notify('已新增書籤');
        }
      }
      if (editor.kind === 'move') await move(editor.id, parent);
      if (editor.kind === 'save') {
        let dest = parent;
        if (newCollection) {
          if (newId) dest = newId;
          else {
            dest = (
              await createNamedFolder(
                space,
                title || `Saved ${new Date().toLocaleDateString('sv')}`,
              )
            ).id;
            setNewId(dest);
          }
        }
        if (editor.windowId !== undefined) await saveWindow(editor.windowId, dest);
        else if (editor.tab)
          await saveTab(editor.tab, dest, editor.close ?? state().settings.closeAfterSave);
      }
    });
    setBusy(false);
    if (ok) edit(null);
  };
  return (
    <Modal
      title={heading}
      busy={busy}
      onClose={() => {
        if (!busy) edit(null);
      }}
    >
      <form onSubmit={(e) => void submit(e)} className="editor-form">
        {editor.kind === 'folder' && (
          <label>
            名稱
            <input
              autoFocus
              required
              maxLength={500}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={
                editor.label === 'Space' ? '例如：Work、Personal' : '例如：Development、設計靈感'
              }
            />
          </label>
        )}
        {editor.kind === 'bookmark' && (
          <>
            <label>
              名稱
              <input
                autoFocus
                required
                maxLength={500}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="網站名稱"
              />
            </label>
            <label>
              網址
              <input
                required
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://example.com"
              />
            </label>
            <CollectionSelect value={parent} onChange={setParent} />
          </>
        )}
        {editor.kind === 'move' &&
          (editor.nodeType === 'collection' ? (
            <SpaceSelect value={parent} onChange={setParent} />
          ) : (
            <CollectionSelect value={parent} onChange={setParent} />
          ))}
        {editor.kind === 'save' && (
          <>
            {editor.tab && (
              <div className="save-preview">
                <strong>{editor.tab.title}</strong>
                <span>{editor.tab.url}</span>
              </div>
            )}
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={newCollection}
                onChange={(e) => setNewCollection(e.target.checked)}
              />
              建立新的 Collection
            </label>
            {newCollection ? (
              <>
                <SpaceSelect value={space} onChange={setSpace} />
                <label>
                  Collection 名稱
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder={`Saved ${new Date().toLocaleDateString('sv')}`}
                  />
                </label>
              </>
            ) : (
              <CollectionSelect value={parent} onChange={setParent} />
            )}
            <p className="muted">
              {effectiveClose
                ? '建立書籤成功後才會關閉原網址的分頁。'
                : '原分頁會保留；視窗收藏會略過重複及 Chrome 內部頁面。'}
            </p>
          </>
        )}
        <div className="modal-actions">
          {editor.kind === 'bookmark' && editor.bookmark && (
            <button
              type="button"
              className="danger delete-in-editor"
              title="刪除書籤"
              aria-label="刪除"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  await remove(editor.bookmark!.id);
                  edit(null);
                })
              }
            >
              刪除
            </button>
          )}
          <button
            type="button"
            className="secondary"
            title="取消"
            aria-label="取消"
            disabled={busy}
            onClick={() => edit(null)}
          >
            取消
          </button>
          <button
            type="submit"
            className="primary"
            title="儲存"
            aria-label={busy ? '儲存中…' : '儲存'}
            disabled={busy}
          >
            {busy ? '儲存中…' : '儲存'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
function SettingsEditor() {
  const { settings, board } = useBoard();
  const [draft, setDraft] = useState(settings),
    [busy, setBusy] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const update = (patch: Partial<typeof draft>) => setDraft({ ...draft, ...patch });
  return (
    <Modal
      title="設定"
      busy={busy}
      onClose={() => {
        if (!busy) edit(null);
      }}
      wide
    >
      <form
        className="settings-form"
        onSubmit={(e) => {
          e.preventDefault();
          setBusy(true);
          void run(() => saveSettings(draft)).then((ok) => {
            setBusy(false);
            if (ok) {
              notify('設定已儲存');
              edit(null);
            }
          });
        }}
      >
        <fieldset>
          <legend>
            外觀 <span>APPEARANCE</span>
          </legend>
          <div className="settings-grid">
            <label>
              字體大小
              <select
                value={draft.fontSize}
                onChange={(e) =>
                  update({ fontSize: Number(e.target.value) as typeof draft.fontSize })
                }
                aria-describedby="font-size-help"
              >
                <option value="14">較小 · 14px</option>
                <option value="16">標準 · 16px（預設）</option>
                <option value="18">較大 · 18px</option>
              </select>
            </label>
            <label>
              左側側欄字體
              <select
                value={draft.sidebarFontSize}
                onChange={(e) =>
                  update({
                    sidebarFontSize:
                      e.target.value === 'inherit'
                        ? 'inherit'
                        : (Number(e.target.value) as 16 | 18 | 20 | 22),
                  })
                }
              >
                <option value="inherit">跟隨整體字體大小</option>
                <option value="16">16px</option>
                <option value="18">18px（預設）</option>
                <option value="20">20px</option>
                <option value="22">22px</option>
              </select>
            </label>
            <label>
              右側分頁字體
              <select
                value={draft.tabsFontSize}
                onChange={(e) =>
                  update({
                    tabsFontSize:
                      e.target.value === 'inherit'
                        ? 'inherit'
                        : (Number(e.target.value) as 16 | 18 | 20 | 22),
                  })
                }
              >
                <option value="inherit">跟隨整體字體大小</option>
                <option value="16">16px</option>
                <option value="18">18px（預設）</option>
                <option value="20">20px</option>
                <option value="22">22px</option>
              </select>
            </label>
            <label>
              主題
              <select
                value={draft.theme}
                onChange={(e) => update({ theme: e.target.value as typeof draft.theme })}
              >
                <option value="system">跟隨系統</option>
                <option value="dark">深色</option>
                <option value="light">淺色</option>
              </select>
            </label>
            <label>
              卡片密度
              <select
                value={draft.density}
                onChange={(e) => update({ density: e.target.value as typeof draft.density })}
              >
                <option value="comfortable">舒適</option>
                <option value="compact">緊湊</option>
              </select>
            </label>
            <label>
              側邊欄寬度：{draft.sidebarWidth}px
              <input
                type="range"
                min="180"
                max="320"
                value={draft.sidebarWidth}
                onChange={(e) => update({ sidebarWidth: Number(e.target.value) })}
              />
            </label>
            <label>
              分頁面板寬度：{draft.tabsWidth}px
              <input
                type="range"
                min="240"
                max="440"
                value={draft.tabsWidth}
                onChange={(e) => update({ tabsWidth: Number(e.target.value) })}
              />
            </label>
          </div>
          <div
            className="font-preview"
            style={{ fontSize: `${draft.fontSize}px` }}
            aria-label="字體大小預覽"
          >
            <strong>工作收藏 Collection</strong>
            <span>常用書籤 · 每天都能輕鬆閱讀</span>
          </div>
          <p className="muted" id="font-size-help">
            儲存後套用。左右側欄可分別放大，或選擇跟隨整體字級。緊湊模式只縮小間距。
          </p>
          <div
            className="font-preview sidebar-font-preview"
            style={{
              fontSize: `${draft.sidebarFontSize === 'inherit' ? draft.fontSize : draft.sidebarFontSize}px`,
            }}
            aria-label="左側側欄字體預覽"
          >
            <span>所有收藏 · 我的工作空間</span>
          </div>
          <div
            className="font-preview tabs-font-preview"
            style={{
              fontSize: `${draft.tabsFontSize === 'inherit' ? draft.fontSize : draft.tabsFontSize}px`,
            }}
            aria-label="右側分頁字體預覽"
          >
            <span>分頁預覽 · 工作郵件與常用網站</span>
          </div>
        </fieldset>
        <fieldset>
          <legend>
            操作 <span>BEHAVIOR</span>
          </legend>
          <div className="settings-grid">
            <label>
              開啟書籤
              <select
                value={draft.openIn}
                onChange={(e) => update({ openIn: e.target.value as typeof draft.openIn })}
              >
                <option value="current">目前視窗的新分頁</option>
                <option value="window">新視窗</option>
              </select>
            </label>
            <label>
              儲存分頁
              <select
                value={draft.closeAfterSave ? 'close' : 'keep'}
                onChange={(e) => update({ closeAfterSave: e.target.value === 'close' })}
              >
                <option value="keep">保留分頁（預設）</option>
                <option value="close">成功收藏後關閉</option>
              </select>
            </label>
          </div>
          <p className="muted">拖曳收藏一律保留分頁。「收藏並關閉」可逐次指定。</p>
        </fieldset>
        <fieldset>
          <legend>
            資料與備份 <span>YOUR DATA</span>
          </legend>
          <div className="root-info">
            <span>Chrome Bookmarks / {board.root?.title ?? '尚未建立'}</span>
            <code>ID {board.root?.id ?? '—'}</code>
          </div>
          <p className="muted">
            網址儲存於 Chrome 書籤。跨裝置同步需在各裝置登入同一 Chrome
            帳號並啟用書籤與擴充功能同步。Boardmarks 不上傳資料到自建伺服器。
          </p>
          <div className="backup-actions">
            <button
              type="button"
              className="secondary"
              title="匯出 JSON"
              aria-label="匯出 JSON"
              onClick={() => void run(async () => downloadBackup(await exportData()))}
            >
              <Download size={15} />
              匯出 JSON
            </button>
            <button
              type="button"
              className="secondary"
              title="匯入 JSON"
              aria-label="匯入 JSON"
              onClick={() => file.current?.click()}
            >
              <Upload size={15} />
              匯入 JSON
            </button>
            <input
              hidden
              ref={file}
              type="file"
              accept=".json,application/json"
              aria-label="匯入備份檔"
              onChange={(e) => {
                const selected = e.target.files?.[0];
                e.target.value = '';
                if (selected)
                  void run(async () => {
                    if (selected.size > 20 * 1024 * 1024) throw new Error('備份檔上限為 20 MB。');
                    const preview = parseImportText(await selected.text());
                    edit({ kind: 'import', ...preview });
                  });
              }}
            />
          </div>
          <p className="muted">可匯入 Boardmarks 備份或 Toby JSON v3；選檔後可先預覽內容。</p>
        </fieldset>
        <div className="privacy-line">
          無追蹤 · 無廣告 · 無會員 ·{' '}
          {isExtension ? `Boardmarks v${chrome.runtime.getManifest().version}` : '獨立預覽資料'}
        </div>
        <div className="modal-actions">
          <button
            type="button"
            className="secondary"
            title="取消"
            aria-label="取消"
            disabled={busy}
            onClick={() => edit(null)}
          >
            取消
          </button>
          <button
            className="primary"
            title="儲存設定"
            aria-label={busy ? '儲存中…' : '儲存設定'}
            disabled={busy}
          >
            {busy ? '儲存中…' : '儲存設定'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
function ImportEditor({ editor }: { editor: Extract<Editor, { kind: 'import' }> }) {
  const counts = backupCounts(editor.backup);
  const [busy, setBusy] = useState(false);
  return (
    <Modal
      title="匯入備份預覽"
      wide
      busy={busy}
      onClose={() => {
        if (!busy) edit(null);
      }}
    >
      <div className="editor-form">
        <p>來源：{editor.source}</p>
        <div className="import-counts">
          <div>
            <strong>{counts.spaces}</strong>Spaces
          </div>
          <div>
            <strong>{counts.collections}</strong>Collections
          </div>
          <div>
            <strong>{counts.bookmarks}</strong>書籤
          </div>
        </div>
        <p>
          將新增以下 Spaces，既有資料不會被覆蓋。目前的外觀與行為設定保持不變。
          {editor.source === 'Boardmarks'
            ? '星號及摺疊設定會一起匯入。'
            : 'Toby 分類與書籤將依原順序保留，書籤優先使用自訂名稱。'}
        </p>
        {editor.notices.length > 0 && (
          <div className="import-notices" role="note" aria-label="匯入限制">
            <strong>以下內容不會匯入</strong>
            <ul>
              {editor.notices.map((notice) => (
                <li key={notice}>{notice}</li>
              ))}
            </ul>
            <p>請保留原始 Toby JSON，以保留完整內容。</p>
          </div>
        )}
        <ul className="import-list">
          {editor.backup.spaces.map((s, i) => (
            <li key={i}>
              {s.title}
              <span>{s.collections.length} Collections</span>
            </li>
          ))}
        </ul>
        <div className="modal-actions">
          <button
            className="secondary"
            title="取消"
            aria-label="取消"
            disabled={busy}
            onClick={() => edit(null)}
          >
            取消
          </button>
          <button
            className="primary"
            title="確認匯入"
            aria-label={busy ? '匯入中…請勿關閉頁面' : '確認匯入'}
            disabled={busy}
            onClick={() => {
              setBusy(true);
              void run(() => importData(editor.backup)).then((ok) => {
                setBusy(false);
                if (ok) edit(null);
              });
            }}
          >
            {busy ? '匯入中…請勿關閉頁面' : '確認匯入'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
function CommandPalette() {
  const [query, setQuery] = useState(''),
    [selected, setSelected] = useState(0);
  const board = useBoard((s) => s.board);
  const commands = [
    {
      label: '搜尋書籤',
      icon: Search,
      action: () => {
        edit(null);
        window.dispatchEvent(new Event('boardmarks-search'));
      },
    },
    {
      label: '新增 Collection',
      icon: Plus,
      action: () => {
        if (state().selected)
          edit({ kind: 'folder', parent: state().selected, label: 'Collection' });
      },
    },
    {
      label: '新增 Space',
      icon: Plus,
      action: () => {
        if (board.root) edit({ kind: 'folder', parent: board.root.id, label: 'Space' });
      },
    },
    { label: '開啟設定', icon: Settings2, action: () => edit({ kind: 'settings' }) },
    {
      label: '切換左側面板',
      icon: PanelLeft,
      action: () => {
        void run(() => saveSettings({ showSidebar: !state().settings.showSidebar }));
        edit(null);
      },
    },
    {
      label: '切換分頁面板',
      icon: PanelRight,
      action: () => {
        void run(() => saveSettings({ showTabs: !state().settings.showTabs }));
        edit(null);
      },
    },
    {
      label: '切換深色／淺色主題',
      icon: Sun,
      action: () => {
        void run(() =>
          saveSettings({
            theme: document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark',
          }),
        );
        edit(null);
      },
    },
  ].filter((c) => c.label.toLowerCase().includes(query.toLowerCase()));
  const matches = query
    ? searchBoard(board.spaces, query)
        .flatMap((g) =>
          g.bookmarks.map((b) => ({
            label: `${b.title} — ${g.space.title} / ${g.collection.title}`,
            id: b.id,
            icon: ArrowUpRight,
            action: () => {
              void run(() => openUrl(b.url));
              edit(null);
            },
          })),
        )
        .slice(0, 30)
    : [];
  const destinations = query.trim()
    ? [
        ...searchSpaces(board.spaces, query).map((space) => ({
          id: space.id,
          label: `Space · ${space.title || '未命名'}`,
          icon: PanelRight,
          action: () => {
            state().set({ selected: space.id, view: 'space', query: '' });
            edit(null);
          },
        })),
        ...board.spaces.flatMap((space) =>
          space.collections
            .filter((collection) =>
              collection.title.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
            )
            .map((collection) => ({
              id: collection.id,
              label: `Collection · ${space.title} / ${collection.title || '未命名'}`,
              icon: PanelRight,
              action: () => {
                state().set({ selected: space.id, view: 'space', query: '' });
                edit(null);
              },
            })),
        ),
      ].slice(0, 30)
    : [];
  const items = [
    ...commands.map((command) => ({ ...command, id: command.label })),
    ...destinations,
    ...matches,
  ];
  useEffect(() => setSelected(0), [query]);
  return (
    <Modal title="命令選單" onClose={() => edit(null)}>
      <div className="command-palette">
        <input
          autoFocus
          aria-label="搜尋命令或書籤"
          placeholder="搜尋命令或書籤…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setSelected((i) => Math.max(0, Math.min(items.length - 1, i + 1)));
            }
            if (e.key === 'ArrowUp') {
              e.preventDefault();
              setSelected((i) => Math.max(0, i - 1));
            }
            if (e.key === 'Enter') {
              e.preventDefault();
              items[selected]?.action();
            }
          }}
        />
        <div className="command-results">
          {items.map((item, i) => (
            <button
              key={item.id}
              title={item.label}
              aria-label={item.label}
              className={selected === i ? 'highlighted' : ''}
              onClick={item.action}
              onMouseEnter={() => setSelected(i)}
            >
              <item.icon size={16} />
              <span>{item.label}</span>
              {selected === i && <kbd>↵</kbd>}
            </button>
          ))}
          {!items.length && <p className="muted">沒有符合的命令或書籤</p>}
        </div>
      </div>
    </Modal>
  );
}
export function Editors() {
  const editor = useUI((s) => s.editor);
  if (!editor) return null;
  switch (editor.kind) {
    case 'settings':
      return <SettingsEditor />;
    case 'import':
      return <ImportEditor editor={editor} />;
    case 'commands':
      return <CommandPalette />;
    default:
      return <FormEditor key={JSON.stringify(editor)} editor={editor} />;
  }
}
