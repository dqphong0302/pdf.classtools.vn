import { useState } from 'react';
import { ArrowLeft, FileCode, Printer } from 'lucide-react';
import { ToolShell } from '../components/ToolShell';
import { usePreferences } from '../hooks/usePreferences';
import './html-to-pdf.css';

const DEFAULT_HTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; line-height: 1.6; padding: 30px; color: #1e293b; }
    h1 { color: #1e40af; border-bottom: 2px solid #3b82f6; padding-bottom: 8px; }
    p { margin-bottom: 12px; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th, td { border: 1px solid #cbd5e1; padding: 10px; text-align: left; }
    th { background: #f1f5f9; color: #0f172a; }
    .badge { display: inline-block; background: #e0e7ff; color: #3730a3; padding: 4px 8px; border-radius: 4px; font-weight: 600; font-size: 12px; }
  </style>
</head>
<body>
  <h1>Tài liệu Báo cáo & Hợp đồng mẫu</h1>
  <p>Đây là nội dung được chuyển đổi trực tiếp từ định dạng HTML sang PDF với độ sắc nét tuyệt đối.</p>
  <span class="badge">ClassTools PDF • 100% Client-Side</span>
  <table>
    <tr><th>Hạng mục</th><th>Số lượng</th><th>Trạng thái</th></tr>
    <tr><td>Tài liệu số hóa</td><td>15</td><td>Đã hoàn thành</td></tr>
    <tr><td>Bản ký điện tử</td><td>3</td><td>Đang chờ xử lý</td></tr>
  </table>
</body>
</html>`;

export function HtmlToPdfPage() {
  const { theme, locale, toggleTheme, toggleLocale } = usePreferences();
  const [htmlContent, setHtmlContent] = useState(DEFAULT_HTML);
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');

  const isVi = locale === 'vi';

  const handlePrint = () => {
    // Print from a hidden sandboxed iframe: no popup to be blocked, and the pasted
    // HTML cannot run scripts (no allow-scripts) even though we can reach its window.
    const pageRule = `<style>@page { size: A4 ${orientation}; margin: 15mm; }</style>`;
    const html = /<\/head>/i.test(htmlContent)
      ? htmlContent.replace(/<\/head>/i, `${pageRule}</head>`)
      : `<!DOCTYPE html><html><head><meta charset="utf-8">${pageRule}</head><body>${htmlContent}</body></html>`;

    document.querySelectorAll('iframe[data-html-print]').forEach((frame) => frame.remove());
    const frame = document.createElement('iframe');
    frame.dataset.htmlPrint = '';
    frame.setAttribute('sandbox', 'allow-same-origin allow-modals');
    frame.setAttribute('aria-hidden', 'true');
    frame.tabIndex = -1;
    Object.assign(frame.style, { position: 'fixed', right: '0', bottom: '0', width: '0', height: '0', border: '0' });
    frame.onload = () => {
      const target = frame.contentWindow;
      if (!target) return;
      target.focus();
      target.print();
    };
    frame.srcdoc = html;
    document.body.appendChild(frame);
  };

  return (
    <ToolShell theme={theme} locale={locale} onThemeToggle={toggleTheme} onLocaleToggle={toggleLocale}>
      <div className="html-pdf-container">
        <div className="tool-page-heading tool-page-heading--compact">
          <a className="tool-page-heading__back" href="/">
            <ArrowLeft size={16} />
            {isVi ? 'Trang chủ' : 'Home'}
          </a>
          <span className="ct-eyebrow">ClassTools PDF</span>
          <h1>{isVi ? 'HTML sang PDF (HTML to PDF)' : 'HTML to PDF'}</h1>
          <p>
            {isVi
              ? 'Soạn thảo hoặc dán mã HTML/CSS bất kỳ, xem trước trực quan và in xuất PDF chuẩn A4 sắc nét theo chuẩn trình duyệt.'
              : 'Compose or paste any HTML/CSS code, preview live and export crisp A4 PDFs using native high-fidelity print engines.'}
          </p>
        </div>

        <div className="html-pdf-layout">
          {/* Editor Side */}
          <div className="editor-card">
            <div className="editor-header">
              <span className="editor-title">
                <FileCode size={18} />
                {isVi ? 'Mã HTML & CSS' : 'HTML & CSS Code'}
              </span>
              <div className="editor-opts">
                <select
                  value={orientation}
                  onChange={(e) => setOrientation(e.target.value as 'portrait' | 'landscape')}
                  className="select-input select-sm"
                >
                  <option value="portrait">{isVi ? 'Khổ dọc (Portrait)' : 'Portrait'}</option>
                  <option value="landscape">{isVi ? 'Khổ ngang (Landscape)' : 'Landscape'}</option>
                </select>
                <button type="button" className="btn btn-primary btn-sm" onClick={handlePrint}>
                  <Printer size={16} />
                  {isVi ? 'In / Lưu PDF' : 'Print / Save PDF'}
                </button>
              </div>
            </div>

            <textarea
              className="code-textarea"
              value={htmlContent}
              onChange={(e) => setHtmlContent(e.target.value)}
              placeholder="<html><body>...</body></html>"
              spellCheck={false}
            />
          </div>

          {/* Live Preview Side */}
          <div className="preview-card">
            <span className="preview-title">{isVi ? 'Xem trước nội dung (Live Preview)' : 'Live Preview'}</span>
            <div className="iframe-wrapper">
              <iframe title="html-preview" srcDoc={htmlContent} sandbox="allow-same-origin" />
            </div>
          </div>
        </div>
      </div>
    </ToolShell>
  );
}
