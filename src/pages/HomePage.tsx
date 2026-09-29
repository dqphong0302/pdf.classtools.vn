import { useState } from 'react';
import { ToolShell } from '../components/ToolShell';
import { usePreferences } from '../hooks/usePreferences';
import { CATEGORIES, TOOLS, type ToolCategory } from '../lib/tools';
import './home.css';

export function HomePage() {
  const { theme, locale, toggleTheme, toggleLocale } = usePreferences();
  const vi = locale === 'vi';
  // Deep links from breadcrumbs (/#security) preselect the category.
  const [active, setActive] = useState<ToolCategory | 'all'>(() => {
    const hash = window.location.hash.replace('#', '');
    return CATEGORIES.find((category) => category.id === hash)?.id ?? 'all';
  });
  const tools = TOOLS.filter((tool) => active === 'all' || tool.category === active);

  return (
    <ToolShell theme={theme} locale={locale} onThemeToggle={toggleTheme} onLocaleToggle={toggleLocale}>
      <section className="home-hero" aria-labelledby="home-title">
        <h1 id="home-title">{vi ? 'Mọi công cụ PDF bạn cần, ở một nơi' : 'Every tool you need to work with PDFs'}</h1>
        <p>
          {vi
            ? 'Miễn phí và dễ dùng. Tệp được xử lý ngay trên máy bạn, không tải lên máy chủ.'
            : 'Free and easy to use. Files are processed on your device and never uploaded.'}
        </p>
      </section>

      <div className="home-tabs" role="group" aria-label={vi ? 'Lọc theo nhóm' : 'Filter by category'}>
        <button type="button" className={`home-tab${active === 'all' ? ' is-active' : ''}`} aria-pressed={active === 'all'} onClick={() => setActive('all')}>
          {vi ? 'Tất cả' : 'All'}
        </button>
        {CATEGORIES.map((category) => (
          <button
            key={category.id}
            type="button"
            className={`home-tab${active === category.id ? ' is-active' : ''}`}
            aria-pressed={active === category.id}
            onClick={() => setActive(category.id)}
          >
            {category.title[locale]}
          </button>
        ))}
      </div>

      <div className="tool-grid">
        {tools.map(({ to, icon: Icon, accent, title, description }) => (
          <a key={to} className="tool-card" href={to}>
            <span className="tool-card__icon" style={{ background: accent }} aria-hidden="true">
              <Icon size={30} />
            </span>
            <strong>{title[locale]}</strong>
            <span className="tool-card__desc">{description[locale]}</span>
          </a>
        ))}
      </div>
    </ToolShell>
  );
}
