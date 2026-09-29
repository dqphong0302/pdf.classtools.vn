import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ChevronRight, FileText, Languages, LayoutGrid, Moon, Search, ShieldCheck, Sun, X } from 'lucide-react';
import type { Locale } from '../hooks/usePreferences';
import { CATEGORIES, CATEGORY_TONE, TOOLS, searchTools, toolForPath, type ToolInfo } from '../lib/tools';
import { rememberTool } from '../lib/recentTools';

interface ToolShellProps {
  theme: 'light' | 'dark';
  locale: Locale;
  onThemeToggle: () => void;
  onLocaleToggle: () => void;
  children: ReactNode;
  footerNote?: string;
}

function ToolLink({ tool, locale, onNavigate }: { tool: ToolInfo; locale: Locale; onNavigate?: () => void }) {
  const Icon = tool.icon;
  return (
    <a className={`menu-tool tone-${CATEGORY_TONE[tool.category]}`} href={tool.to} onClick={onNavigate}>
      <span className="menu-tool__icon" aria-hidden="true">
        <Icon size={16} strokeWidth={1.75} />
      </span>
      <span className="menu-tool__text">
        <strong>{tool.title[locale]}</strong>
      </span>
    </a>
  );
}

function ToolsMenu({ locale, currentPath, onClose }: { locale: Locale; currentPath: string; onClose: () => void }) {
  const vi = locale === 'vi';
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const results = useMemo(() => searchTools(query), [query]);

  useEffect(() => {
    inputRef.current?.focus();
    const opener = document.activeElement as HTMLElement | null;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !panelRef.current) return;
      // Keep keyboard focus inside the dialog.
      const focusable = panelRef.current.querySelectorAll<HTMLElement>('input, button, a[href]');
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
      opener?.focus?.();
    };
  }, [onClose]);

  return (
    <div className="menu-layer" role="dialog" aria-modal="true" aria-label={vi ? 'Tất cả công cụ' : 'All tools'}>
      <button type="button" className="menu-backdrop" aria-label={vi ? 'Đóng' : 'Close'} onClick={onClose} tabIndex={-1} />
      <div className="menu-panel" ref={panelRef}>
        <div className="menu-search">
          <Search size={18} aria-hidden="true" />
          <input
            ref={inputRef}
            type="search"
            value={query}
            placeholder={vi ? 'Tìm công cụ: nén, ghép, ký, Excel…' : 'Find a tool: compress, merge, sign, Excel…'}
            aria-label={vi ? 'Tìm công cụ' : 'Search tools'}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && results[0]) window.location.assign(results[0].to);
            }}
          />
          <button type="button" className="menu-close" onClick={onClose} aria-label={vi ? 'Đóng' : 'Close'}>
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div className="menu-body">
          {query.trim() ? (
            results.length ? (
              <div className="menu-grid menu-grid--flat">
                {results.map((tool) => (
                  <ToolLink key={tool.to} tool={tool} locale={locale} />
                ))}
              </div>
            ) : (
              <p className="menu-empty">{vi ? 'Không tìm thấy công cụ phù hợp.' : 'No matching tools.'}</p>
            )
          ) : (
            <div className="menu-columns">
              {CATEGORIES.map((category) => (
                <section key={category.id} className="menu-group" aria-label={category.title[locale]}>
                  <h3>{category.title[locale]}</h3>
                  {TOOLS.filter((tool) => tool.category === category.id).map((tool) => (
                    <a
                      key={tool.to}
                      className={`menu-link${tool.to === currentPath ? ' is-current' : ''}`}
                      href={tool.to}
                      aria-current={tool.to === currentPath ? 'page' : undefined}
                    >
                      <tool.icon size={15} aria-hidden="true" />
                      {tool.title[locale]}
                    </a>
                  ))}
                </section>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function ToolShell({ theme, locale, onThemeToggle, onLocaleToggle, children, footerNote }: ToolShellProps) {
  const vi = locale === 'vi';
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  const currentPath = typeof window !== 'undefined' ? window.location.pathname.replace(/\/+$/, '') || '/' : '/';
  const currentTool = toolForPath(currentPath);
  const category = currentTool ? CATEGORIES.find((item) => item.id === currentTool.category) : undefined;

  useEffect(() => {
    if (currentTool) rememberTool(currentTool.to);
  }, [currentTool]);

  // "/" or Ctrl/Cmd+K opens the tool finder from anywhere.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
      if ((event.key === 'k' && (event.metaKey || event.ctrlKey)) || (event.key === '/' && !typing)) {
        event.preventDefault();
        setMenuOpen(true);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const related = currentTool
    ? TOOLS.filter((tool) => tool.category === currentTool.category && tool.to !== currentTool.to).slice(0, 4)
    : [];

  return (
    <div className="tool-app">
      <a className="ct-skip-link" href="#pdf-main">{vi ? 'Bỏ qua đến nội dung' : 'Skip to content'}</a>
      <header className="tool-app-header">
        <div className="ct-container tool-app-header__inner">
          <a className="brand" href="/">
            <span className="brand__mark" aria-hidden="true"><FileText size={19} /></span>
            <span className="brand__name">ClassTools <strong>PDF</strong></span>
          </a>
          <div className="tool-app-header__actions">
            <button
              className="header-action header-action--primary"
              type="button"
              aria-haspopup="dialog"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen(true)}
            >
              <LayoutGrid size={16} aria-hidden="true" />
              <span>{vi ? 'Tất cả công cụ' : 'All tools'}</span>
              <kbd className="header-kbd" aria-hidden="true">/</kbd>
            </button>
            <button className="header-action" type="button" onClick={onLocaleToggle} aria-label={vi ? 'Switch to English' : 'Chuyển sang tiếng Việt'}>
              <Languages size={17} aria-hidden="true" />
              <span>{locale.toUpperCase()}</span>
            </button>
            <button className="ct-icon-button" type="button" onClick={onThemeToggle} aria-label={vi ? 'Đổi giao diện' : 'Toggle theme'}>
              {theme === 'light' ? <Moon size={19} aria-hidden="true" /> : <Sun size={19} aria-hidden="true" />}
            </button>
          </div>
        </div>
      </header>

      {menuOpen && <ToolsMenu locale={locale} currentPath={currentPath} onClose={closeMenu} />}

      <main id="pdf-main" className="ct-container tool-app-main">
        {currentTool && category && (
          <nav className="breadcrumb" aria-label={vi ? 'Đường dẫn' : 'Breadcrumb'}>
            <a href="/">{vi ? 'Trang chủ' : 'Home'}</a>
            <ChevronRight size={14} aria-hidden="true" />
            <a href={`/#${category.id}`}>{category.title[locale]}</a>
            <ChevronRight size={14} aria-hidden="true" />
            <span aria-current="page">{currentTool.title[locale]}</span>
          </nav>
        )}

        {children}

        {related.length > 0 && (
          <section className="related" aria-label={vi ? 'Công cụ liên quan' : 'Related tools'}>
            <h2>{vi ? 'Có thể bạn cũng cần' : 'You might also need'}</h2>
            <div className="menu-grid">
              {related.map((tool) => (
                <ToolLink key={tool.to} tool={tool} locale={locale} />
              ))}
            </div>
          </section>
        )}
      </main>

      <footer className="tool-app-footer">
        <p className="pd-eco-line">Hệ sinh thái của ThS. Đặng Quốc Phong: <a href="https://phongdang.io.vn" target="_blank" rel="noopener noreferrer">phongdang.io.vn</a> · <a href="https://classtools.vn" target="_blank" rel="noopener noreferrer">classtools.vn</a></p>
        <div className="ct-container">
          <span>ClassTools.vn</span>
          <span className="footer-privacy">
            <ShieldCheck size={14} aria-hidden="true" />
            {footerNote ?? (vi ? 'Tệp của bạn chỉ được xử lý ngay trên thiết bị này.' : 'Your files are processed on this device only.')}
          </span>
        </div>
      </footer>
    </div>
  );
}
