import type { Article } from '../../data/portfolioData';

type Table = NonNullable<Article['content']['sections'][number]['table']>;

export function ArticleTableEditor({ table, onChange }: {
  table: Table | undefined;
  onChange: (table: Table | undefined) => void;
}) {
  if (!table) return <button type="button" className="admin-btn admin-btn-secondary admin-btn-sm"
    onClick={() => onChange({ headers: ['', ''], rows: [['', '']] })}>Add Table</button>;

  return <fieldset className="admin-section-block">
    <legend>Table Block</legend>
    <div className="admin-table-container">
      <table className="admin-table"><thead><tr>
        {table.headers.map((header, column) => <th key={column}>
          <input className="admin-input" aria-label={`表头 ${column + 1}`} value={header}
            onChange={e => onChange({ ...table, headers: table.headers.map((h, c) => c === column ? e.target.value : h) })} />
          <button type="button" className="admin-btn admin-btn-secondary admin-btn-sm" disabled={table.headers.length === 1}
            onClick={() => onChange({ headers: table.headers.filter((_, c) => c !== column), rows: table.rows.map(row => row.filter((_, c) => c !== column)) })}>删除列 {column + 1}</button>
        </th>)}<th>操作</th>
      </tr></thead><tbody>
        {table.rows.map((row, index) => <tr key={index}>
          {table.headers.map((_, column) => <td key={column}>
            <input className="admin-input" aria-label={`单元格 ${index + 1}, ${column + 1}`} value={row[column] || ''}
              onChange={e => onChange({ ...table, rows: table.rows.map((r, i) => i === index ? table.headers.map((_, c) => c === column ? e.target.value : r[c] || '') : r) })} />
          </td>)}
          <td><button type="button" className="admin-btn admin-btn-secondary admin-btn-sm"
            onClick={() => onChange({ ...table, rows: table.rows.filter((_, i) => i !== index) })}>删除行 {index + 1}</button></td>
        </tr>)}
      </tbody></table>
    </div>
    <button type="button" className="admin-btn admin-btn-secondary admin-btn-sm" onClick={() => onChange({ headers: [...table.headers, ''], rows: table.rows.map(row => [...row, '']) })}>新增列</button>
    <button type="button" className="admin-btn admin-btn-secondary admin-btn-sm" onClick={() => onChange({ ...table, rows: [...table.rows, table.headers.map(() => '')] })}>新增行</button>
    <button type="button" className="admin-btn admin-btn-danger admin-btn-sm" onClick={() => onChange(undefined)}>Remove Table</button>
  </fieldset>;
}
