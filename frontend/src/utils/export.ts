export type ExportFormat = 'json' | 'csv';

const escapeCSV = (val: unknown): string => {
  const str = val === null || val === undefined ? '' : String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

export const exportData = (
  data: unknown,
  filename: string,
  format: ExportFormat = 'json'
): void => {
  let blob: Blob;
  let ext: string;

  if (format === 'csv') {
    const rows = Array.isArray(data) ? data : [data];
    if (rows.length === 0) return;

    const headers = Object.keys(rows[0] as Record<string, unknown>);
    const csvLines = [
      headers.map(escapeCSV).join(','),
      ...rows.map(row => {
        const obj = row as Record<string, unknown>;
        return headers.map(h => escapeCSV(obj[h])).join(',');
      }),
    ];
    blob = new Blob(['\uFEFF' + csvLines.join('\n')], { type: 'text/csv;charset=utf-8' });
    ext = 'csv';
  } else {
    blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    ext = 'json';
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}-${new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-')}.${ext}`;
  a.click();
  URL.revokeObjectURL(url);
};
