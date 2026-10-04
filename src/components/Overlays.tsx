import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, AlertCircle, X } from 'lucide-react';
import { answer, run, state, useBoard } from '../stores/board';
import { useUI } from '../stores/ui';
import { IconButton, Modal } from './common';
export function Overlays() {
  const { toast, choice } = useBoard();
  const menu = useUI((s) => s.menu);
  const menuRef = useRef<HTMLDivElement>(null);
  const [undoBusy, setUndoBusy] = useState(false);
  useLayoutEffect(() => {
    const element = menuRef.current;
    if (!menu || !element) return;
    const place = () => {
      const { width, height } = element.getBoundingClientRect();
      element.style.left = `${Math.max(8, Math.min(menu.x, window.innerWidth - width - 8))}px`;
      element.style.top = `${Math.max(8, Math.min(menu.y, window.innerHeight - height - 8))}px`;
    };
    place();
    const observer = new ResizeObserver(place);
    observer.observe(element);
    window.addEventListener('resize', place);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', place);
    };
  }, [menu]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(
      () => state().set({ toast: null }),
      Math.max(0, toast.expires - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    if (!menu) return;
    const previous = document.activeElement as HTMLElement | null;
    menuRef.current?.querySelector('button')?.focus();
    const close = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) useUI.setState({ menu: null });
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        useUI.setState({ menu: null });
        previous?.focus();
      }
      if (e.key === 'Tab') {
        useUI.setState({ menu: null });
        previous?.focus();
      }
      if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) {
        e.preventDefault();
        const items = Array.from(menuRef.current?.querySelectorAll('button') ?? []);
        const index = items.indexOf(document.activeElement as HTMLButtonElement);
        const next =
          e.key === 'Home'
            ? 0
            : e.key === 'End'
              ? items.length - 1
              : (index + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
        items[next]?.focus();
      }
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', key);
    };
  }, [menu]);
  return (
    <>
      {toast && (
        <div
          className={`toast ${toast.error ? 'error' : ''}`}
          role={toast.error ? 'alert' : 'status'}
        >
          {toast.error ? <AlertCircle size={18} /> : <Check size={18} />}
          <span>{toast.text}</span>
          {toast.undo && (
            <button
              title="復原"
              aria-label="復原"
              disabled={undoBusy}
              onClick={() => {
                if (Date.now() > toast.expires) return;
                setUndoBusy(true);
                void run(toast.undo!).finally(() => setUndoBusy(false));
              }}
            >
              復原
            </button>
          )}
          <IconButton label="關閉通知" onClick={() => state().set({ toast: null })}>
            <X size={15} />
          </IconButton>
        </div>
      )}
      {menu &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            className="context-menu"
            style={{
              left: 8,
              top: 8,
            }}
          >
            {menu.items.map((item) => (
              <button
                key={item.label}
                role="menuitem"
                title={item.label}
                aria-label={item.label}
                className={item.danger ? 'danger' : ''}
                onClick={() => {
                  useUI.setState({ menu: null });
                  item.action();
                }}
              >
                {item.label}
              </button>
            ))}
          </div>,
          document.body,
        )}
      {choice && (
        <Modal title={choice.title} onClose={() => answer('cancel')}>
          <div className="editor-form">
            <p>{choice.body}</p>
            <div className="modal-actions">
              {choice.options.map((o, i) => (
                <button
                  key={o.value}
                  title={o.label}
                  aria-label={o.label}
                  className={
                    o.danger
                      ? 'danger-button'
                      : i === choice.options.length - 1
                        ? 'primary'
                        : 'secondary'
                  }
                  onClick={() => answer(o.value)}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
