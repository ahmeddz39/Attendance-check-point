const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')

// A column can be a plain string label, or { label, kind } to render its
// cells as a colored chip -- 'checkin' | 'checkout' | 'hours'. This keeps
// CSV (plain labels, no styling) and the HTML-based PDF/Excel exports
// working off the same column list.
const normalizeColumns = (columns) => columns.map((c) => (typeof c === 'string' ? { label: c } : c))

export const tableHtml = (title, columns, rows, branding = {}) => {
  const cols = normalizeColumns(columns)
  const dir = branding.dir === 'rtl' ? 'rtl' : 'ltr'
  const align = dir === 'rtl' ? 'right' : 'left'

  const cell = (value, kind) => {
    const text = escapeHtml(value)
    if (!kind || value === undefined || value === null || value === '' || value === '-') return text
    return `<span class="chip chip-${kind}">${text}</span>`
  }

  return `
  <!doctype html>
  <html dir="${dir}">
    <head>
      <meta charset="utf-8" />
      <title>${escapeHtml(title)}</title>
      <style>
        @page { size: landscape; margin: 24px 28px; }
        @page Section1 { size: 842pt 595pt; mso-page-orientation: landscape; }
        div.Section1 { page: Section1; }
        * { box-sizing: border-box; }
        html, body { -webkit-print-color-adjust: exact; print-color-adjust: exact; color-adjust: exact; }
        body {
          font-family: 'Segoe UI', Tahoma, Arial, sans-serif;
          color: #1f2937; margin: 0; padding: 30px 36px; background: #ffffff;
        }
        .report-header {
          display: flex; align-items: center; justify-content: space-between; gap: 16px;
          padding-bottom: 18px; margin-bottom: 20px; border-bottom: 1px solid #e5e7eb;
        }
        .brand { display: flex; align-items: center; gap: 10px; }
        .brand img { width: 34px; height: 34px; object-fit: cover; border-radius: 8px; }
        .brand-name { font-size: 14px; font-weight: 700; color: #111827; letter-spacing: 0.01em; }
        .meta { text-align: ${dir === 'rtl' ? 'left' : 'right'}; font-size: 11px; color: #6b7280; line-height: 1.6; }
        .title-row { display: flex; align-items: baseline; gap: 10px; margin-bottom: 4px; }
        .title-bar { width: 5px; height: 20px; border-radius: 3px; background: linear-gradient(180deg, #4f7f1e, #7fb238); flex-shrink: 0; }
        .report-title { font-size: 20px; font-weight: 700; margin: 0; color: #111827; }
        .report-sub {
          display: inline-flex; align-items: center; font-size: 11px; font-weight: 600;
          color: #3f6b18; background: #eef6e2; border: 1px solid #d9ecc4;
          border-radius: 999px; padding: 3px 12px; margin: 8px 0 18px;
        }
        table { border-collapse: separate; border-spacing: 0; width: 100%; font-size: 11px; }
        thead th {
          background-color: #4f7f1e;
          background-image: linear-gradient(135deg, #3f6b18, #5c9124);
          color: #ffffff; text-transform: uppercase;
          font-size: 9.5px; letter-spacing: 0.05em; font-weight: 700;
          padding: 10px 12px; text-align: ${align}; white-space: nowrap;
        }
        thead th:first-child { border-radius: 8px 0 0 0; }
        thead th:last-child { border-radius: 0 8px 0 0; }
        tbody td {
          padding: 8px 12px; border-bottom: 1px solid #eef0f2; text-align: ${align};
          font-variant-numeric: tabular-nums;
        }
        tbody tr:nth-child(even) { background: #f7f9f4; }
        tbody tr:hover { background: #eef6e2; }
        .chip {
          display: inline-block; padding: 3px 10px; border-radius: 6px;
          font-weight: 700; font-family: 'Consolas', 'Courier New', monospace; font-size: 10.5px;
          letter-spacing: 0.01em; white-space: nowrap;
        }
        .chip-checkin { background: #e0f2fe; color: #075985; }
        .chip-checkout { background: #dcfce7; color: #166534; }
        .chip-hours { background: #fef3c7; color: #92400e; }
        .report-footer {
          margin-top: 20px; padding-top: 12px; border-top: 1px solid #e5e7eb;
          font-size: 10px; color: #9ca3af; display: flex; justify-content: space-between; gap: 16px;
        }
        @media print {
          body { padding: 0; }
          thead { display: table-header-group; }
          tr { page-break-inside: avoid; }
        }
      </style>
    </head>
    <body>
      <div class="Section1">
        <div class="report-header">
          <div class="brand">
            ${branding.logoUrl ? `<img src="${escapeHtml(branding.logoUrl)}" alt="" />` : ''}
            ${branding.companyName ? `<span class="brand-name">${escapeHtml(branding.companyName)}</span>` : ''}
          </div>
          ${branding.generatedLabel ? `<div class="meta">${escapeHtml(branding.generatedLabel)}</div>` : ''}
        </div>
        <div class="title-row">
          <span class="title-bar"></span>
          <h1 class="report-title">${escapeHtml(title)}</h1>
        </div>
        ${branding.recordsLabel ? `<div><span class="report-sub">${escapeHtml(branding.recordsLabel)}</span></div>` : ''}
        <table>
          <thead><tr>${cols.map((c) => `<th>${escapeHtml(c.label)}</th>`).join('')}</tr></thead>
          <tbody>${rows.map((row) => `<tr>${row.map((value, i) => `<td>${cell(value, cols[i]?.kind)}</td>`).join('')}</tr>`).join('')}</tbody>
        </table>
        <div class="report-footer">
          <span>${escapeHtml(branding.companyName || '')}</span>
          ${branding.generatedLabel ? `<span>${escapeHtml(branding.generatedLabel)}</span>` : ''}
        </div>
      </div>
    </body>
  </html>`
}

export const downloadBlob = (content, filename, type) => {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export const exportPdf = (html) => {
  const win = window.open('', '_blank')
  if (!win) return
  win.document.write(html)
  win.document.close()
  win.focus()
  win.print()
}

const csvEscape = (value) => {
  const s = String(value ?? '')
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
export const toCsv = (columns, rows) => {
  const labels = normalizeColumns(columns).map((c) => c.label)
  return [labels, ...rows].map((r) => r.map(csvEscape).join(',')).join('\r\n')
}
