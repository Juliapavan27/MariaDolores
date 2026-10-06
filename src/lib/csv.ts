export function toCSV(rows: Record<string, unknown>[]): string {
  if (!rows.length) return ''
  const cols = Array.from(new Set(rows.flatMap((r) => Object.keys(r))))
  const esc = (v: unknown) => {
    const s = v == null ? '' : Array.isArray(v) ? v.join(' | ') : String(v)
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  // ";" é o separador padrão do Excel em pt-BR
  return [cols.join(';'), ...rows.map((r) => cols.map((c) => esc(r[c])).join(';'))].join('\n')
}

export function download(filename: string, content: string, type = 'text/csv;charset=utf-8') {
  const blob = new Blob(['﻿' + content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function exportCSV(filename: string, rows: Record<string, unknown>[]) {
  download(filename, toCSV(rows))
}

/** Parser de CSV simples (aceita , ou ; e campos entre aspas). */
export function parseCSV(text: string): Record<string, string>[] {
  const clean = text.replace(/^﻿/, '')
  const firstLine = clean.split(/\r?\n/)[0] || ''
  const sep = (firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length ? ';' : ','
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i]
    if (quoted) {
      if (ch === '"' && clean[i + 1] === '"') { field += '"'; i++ }
      else if (ch === '"') quoted = false
      else field += ch
    } else if (ch === '"') quoted = true
    else if (ch === sep) { row.push(field); field = '' }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && clean[i + 1] === '\n') i++
      row.push(field); rows.push(row); row = []; field = ''
    } else field += ch
  }
  if (field || row.length) { row.push(field); rows.push(row) }
  const [header, ...body] = rows.filter((r) => r.some((c) => c.trim()))
  if (!header) return []
  return body.map((r) => Object.fromEntries(header.map((h, i) => [h.trim(), (r[i] || '').trim()])))
}
