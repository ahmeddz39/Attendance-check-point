const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')

// A single-record printable leave authorization form -- same visual language
// (letterhead, colors, @media print) as utils/exportTable.js's tableHtml,
// but a form layout with signature lines instead of a data table.
export const leaveFormHtml = (leave, labels, branding = {}) => {
  const dir = branding.dir === 'rtl' ? 'rtl' : 'ltr'

  const field = (label, value) => `
    <div class="field">
      <div class="field-label">${escapeHtml(label)}</div>
      <div class="field-value">${escapeHtml(value ?? '-')}</div>
    </div>`

  const signatureBlock = (label) => `
    <div class="sig-block">
      <div class="sig-line"></div>
      <div class="sig-label">${escapeHtml(label)}</div>
      <div class="sig-date">${escapeHtml(labels.dateLabel)}: ______________</div>
    </div>`

  return `
  <!doctype html>
  <html dir="${dir}">
    <head>
      <meta charset="utf-8" />
      <title>${escapeHtml(labels.title)}</title>
      <style>
        @page { size: portrait; margin: 28px 32px; }
        * { box-sizing: border-box; }
        html, body { -webkit-print-color-adjust: exact; print-color-adjust: exact; color-adjust: exact; }
        body {
          font-family: 'Segoe UI', Tahoma, Arial, sans-serif;
          color: #1f2937; margin: 0; padding: 34px 40px; background: #ffffff;
        }
        .report-header {
          display: flex; align-items: center; gap: 16px;
          padding-bottom: 18px; margin-bottom: 24px; border-bottom: 1px solid #e5e7eb;
        }
        .brand { display: flex; align-items: center; gap: 10px; }
        .brand img { width: 34px; height: 34px; object-fit: cover; border-radius: 8px; }
        .brand-name { font-size: 14px; font-weight: 700; color: #111827; }
        .title-row { display: flex; align-items: baseline; gap: 10px; margin-bottom: 26px; }
        .title-bar { width: 5px; height: 20px; border-radius: 3px; background: linear-gradient(180deg, #4f7f1e, #7fb238); flex-shrink: 0; }
        .doc-title { font-size: 20px; font-weight: 700; margin: 0; color: #111827; }
        .field-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 18px 28px; margin-bottom: 30px; }
        .field { border-bottom: 1px solid #e5e7eb; padding-bottom: 8px; }
        .field-label { font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280; margin-bottom: 4px; }
        .field-value { font-size: 14px; font-weight: 600; color: #111827; }
        .sig-row { display: flex; gap: 32px; margin-top: 60px; flex-wrap: wrap; }
        .sig-block { flex: 1; min-width: 170px; }
        .sig-line { border-bottom: 1px solid #111827; height: 48px; }
        .sig-label { font-size: 11px; color: #6b7280; margin-top: 6px; }
        .sig-date { font-size: 11px; color: #6b7280; margin-top: 10px; }
        @media print { body { padding: 0 40px; } }
      </style>
    </head>
    <body>
      <div class="report-header">
        <div class="brand">
          ${branding.logoUrl ? `<img src="${escapeHtml(branding.logoUrl)}" alt="" />` : ''}
          ${branding.companyName ? `<span class="brand-name">${escapeHtml(branding.companyName)}</span>` : ''}
        </div>
      </div>
      <div class="title-row">
        <span class="title-bar"></span>
        <h1 class="doc-title">${escapeHtml(labels.title)}</h1>
      </div>
      <div class="field-grid">
        ${field(labels.employeeLabel, leave.employeeName)}
        ${field(labels.codeLabel, leave.employeeCode)}
        ${field(labels.departmentLabel, leave.department)}
        ${field(labels.periodLabel, leave.periodText)}
        ${field(labels.daysLabel, leave.daysCount)}
        ${field(labels.coveringLabel, leave.coveringName)}
      </div>
      <div class="sig-row">
        ${signatureBlock(labels.signatureEmployee)}
        ${signatureBlock(labels.signatureCovering)}
        ${signatureBlock(labels.approvedBy)}
      </div>
    </body>
  </html>`
}
