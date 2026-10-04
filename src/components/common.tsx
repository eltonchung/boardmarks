import {
  Component,
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ErrorInfo,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { Globe2, X, GripVertical } from 'lucide-react';
import { isExtension } from '../chrome/api';
import { logger } from '../utils/logger';
export function IconButton({
  label,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button type="button" className="icon-button" aria-label={label} title={label} {...props}>
      {children}
    </button>
  );
}
export function Favicon({ url }: { url: string }) {
  const [failed, setFailed] = useState(false);
  if (!isExtension || failed) return <Globe2 size={16} className="favicon-fallback" />;
  const favicon = new URL(chrome.runtime.getURL('/_favicon/'));
  favicon.searchParams.set('pageUrl', url);
  favicon.searchParams.set('size', '32');
  return (
    <img
      className="favicon"
      src={favicon.href}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}
export function DragHandle({
  label,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button type="button" className="drag-handle" title={label} aria-label={label} {...props}>
      <GripVertical size={14} />
    </button>
  );
}
export function Modal({
  title,
  children,
  onClose,
  wide = false,
  busy = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
  busy?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  close.current = () => {
    if (!busy) onClose();
  };
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const root = ref.current;
    const focusable = () =>
      Array.from(
        root?.querySelectorAll<HTMLElement>(
          'button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]',
        ) ?? [],
      ).filter(
        (el) =>
          !el.closest('[hidden],[inert]') &&
          !el.matches('input[type="hidden"]') &&
          getComputedStyle(el).display !== 'none' &&
          getComputedStyle(el).visibility !== 'hidden',
      );
    const items = focusable();
    const input = items.find((el) => el.matches('input,select,textarea')) ?? items[0];
    input?.focus();
    const key = (e: KeyboardEvent) => {
      const modals = document.querySelectorAll('[role="dialog"]');
      if (modals[modals.length - 1] !== root) return;
      if (e.key === 'Escape') {
        e.stopPropagation();
        close.current();
      }
      if (e.key === 'Tab') {
        const items = focusable();
        const first = items[0],
          last = items[items.length - 1];
        if (!items.length) {
          e.preventDefault();
          root?.focus();
        } else if (!items.includes(document.activeElement as HTMLElement)) {
          e.preventDefault();
          first?.focus();
        } else if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener('keydown', key, true);
    return () => {
      document.removeEventListener('keydown', key, true);
      previous?.focus();
    };
  }, []);
  return createPortal(
    <div
      className="modal-scrim"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close.current();
      }}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-busy={busy}
        tabIndex={-1}
        aria-label={title}
        className={`modal ${wide ? 'wide' : ''}`}
      >
        <div className="modal-header">
          <h2>{title}</h2>
          <IconButton label="關閉對話框" disabled={busy} onClick={() => close.current()}>
            <X size={18} />
          </IconButton>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}
export interface MenuItem {
  label: string;
  action: () => void;
  danger?: boolean;
}
export function Menu({ items, children }: { items: MenuItem[]; children: ReactNode }) {
  return (
    <div className="menu-items">
      {children}
      {items.map((item) => (
        <button
          key={item.label}
          title={item.label}
          aria-label={item.label}
          type="button"
          className={item.danger ? 'danger' : ''}
          onClick={item.action}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: boolean }> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    logger.error(error, info.componentStack);
  }
  render() {
    return this.state.error ? (
      <div className="fatal">
        <h1>Boardmarks 暫時無法顯示</h1>
        <p>Chrome 書籤資料不受影響。</p>
        <button title="重新載入" aria-label="重新載入" onClick={() => location.reload()}>
          重新載入
        </button>
      </div>
    ) : (
      this.props.children
    );
  }
}
