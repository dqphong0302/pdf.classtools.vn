import type { ReactNode } from 'react';
import { FileText, Languages, Moon, Sun } from 'lucide-react';
import type { Locale } from '../hooks/usePreferences';

interface ToolShellProps {
  theme: 'light' | 'dark';
  locale: Locale;
  onThemeToggle: () => void;
  onLocaleToggle: () => void;
  children: ReactNode;
  footerNote?: string;
}

export function ToolShell({ theme, locale, onThemeToggle, onLocaleToggle, children, footerNote }: ToolShellProps) {
  const vi = locale === 'vi';
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

      <main id="pdf-main" className="ct-container tool-app-main">{children}</main>

      <footer className="tool-app-footer">
      <p className="pd-eco-line">Hệ sinh thái của ThS. Đặng Quốc Phong: <a href="https://phongdang.io.vn" target="_blank" rel="noopener noreferrer">phongdang.io.vn</a> · <a href="https://classtools.vn" target="_blank" rel="noopener noreferrer">classtools.vn</a></p>
        <div className="ct-container">
          <span>ClassTools.vn</span>
          <span>{footerNote ?? (vi ? 'Tệp của bạn chỉ được xử lý ngay trên thiết bị này.' : 'Your files are processed on this device only.')}</span>
        </div>
      </footer>
    </div>
  );
}
