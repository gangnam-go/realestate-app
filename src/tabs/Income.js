import React, { useState, useEffect } from 'react';
import { formatNumber, parseNumber } from '../utils';

const emptyApt   = () => ({ type: '', units: '', excl_m2: '', wall_m2: '', core_m2: '', mgmt_m2: '', comm_m2: '', park_m2: '', tel_m2: '', elec_m2: '', py_price: '' });

const calcRow = (row, mode = 'apt') => {
  const excl    = parseFloat(parseNumber(row.excl_m2))  || 0;
  const wall    = parseFloat(parseNumber(row.wall_m2))  || 0;
  const core    = parseFloat(parseNumber(row.core_m2))  || 0;
  const mgmt    = parseFloat(parseNumber(row.mgmt_m2))  || 0;
  const comm    = parseFloat(parseNumber(row.comm_m2))  || 0;
  const park    = parseFloat(parseNumber(row.park_m2))  || 0;
  const tel     = parseFloat(parseNumber(row.tel_m2))   || 0;
  const elec    = parseFloat(parseNumber(row.elec_m2))  || 0;
  const units   = parseFloat(parseNumber(row.units))    || 0;
  const pyPrice = parseFloat(parseNumber(row.py_price)) || 0;

  const etc_m2  = mgmt + comm + park + tel + elec;
  const sup_m2  = excl + wall + core;
  const cont_m2 = sup_m2 + etc_m2;
  const excl_py  = excl   * 0.3025;
  const sup_py   = sup_m2  * 0.3025;
  const cont_py  = cont_m2 * 0.3025;

  let u_price = 0, total = 0;
  if (mode === 'apt') {
    u_price = pyPrice * sup_py;
    total   = u_price * units;
  } else {
    u_price = pyPrice * cont_py;
    total   = u_price * units;
  }

  const excl_rate = mode === 'apt'
    ? (sup_m2  > 0 ? (excl / sup_m2  * 100) : 0)
    : (cont_m2 > 0 ? (excl / cont_m2 * 100) : 0);

  const vat_free = (mode === 'apt' && excl <= 85);

  return { excl_py, sup_m2, sup_py, cont_m2, cont_py, etc_m2, u_price, total, excl_rate, vat_free };
};

const COLORS = {
  apt:     { main: '#4a7fb5', light: '#eaf1f8', header: '#3d6a99' },
  public:  { main: '#1a7a4a', light: '#e8f8f0', header: '#15623c' },
  balcony: { main: '#7d6b9e', light: '#f3f0f8', header: '#6a5a8a' },
  offi:    { main: '#3d8f7c', light: '#eaf5f2', header: '#347a6a' },
  store:   { main: '#b06030', light: '#f8f0ea', header: '#965228' },
  pubfac:  { main: '#b7770d', light: '#fef9e7', header: '#9a6309' },
};

function UnitToggle({ unit, setUnit }) {
  return (
    <div style={{ display: 'flex', gap: '4px', backgroundColor: '#f0f0f0', borderRadius: '6px', padding: '3px' }}>
      {['㎡', '평'].map(u => (
        <button key={u} onClick={() => setUnit(u)}
          style={{ padding: '3px 12px', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold',
            backgroundColor: unit === u ? '#4a7fb5' : 'transparent',
            color: unit === u ? 'white' : '#666' }}>
          {u}
        </button>
      ))}
    </div>
  );
}

function TypeModal({ title, init, onConfirm, onClose, mode = 'apt' }) {
  const [row, setRow] = useState(init);
  const calc = calcRow(row, mode);

  const numInput = (label, key) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
      <label style={{ width: '80px', fontSize: '13px', fontWeight: 'bold', flexShrink: 0 }}>{label}</label>
      <input value={row[key] || ''}
        onChange={e => setRow({ ...row, [key]: formatNumber(parseNumber(e.target.value)) })}
        style={{ flex: 1, padding: '5px 10px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '13px', textAlign: 'right' }} />
    </div>
  );

  const autoInput = (label, value) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
      <label style={{ width: '80px', fontSize: '13px', fontWeight: 'bold', flexShrink: 0, color: '#666' }}>{label}</label>
      <input value={value} readOnly
        style={{ flex: 1, padding: '5px 10px', border: '1px solid #b8cfe8', borderRadius: '4px', fontSize: '13px', textAlign: 'right', backgroundColor: '#eaf1f8', color: '#1a5276', fontWeight: 'bold' }} />
    </div>
  );

  const sectionBar = (t) => (
    <div style={{ backgroundColor: '#546e7a', color: 'white', padding: '5px 12px', borderRadius: '4px', marginBottom: '10px', marginTop: '14px', fontSize: '13px', fontWeight: 'bold' }}>{t}</div>
  );

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ backgroundColor: 'white', borderRadius: '8px', padding: '24px', width: '620px', maxHeight: '88vh', overflowY: 'auto' }}>
        <h4 style={{ margin: '0 0 16px 0', color: '#2c3e50', fontSize: '15px' }}>{title}</h4>

        {sectionBar('기본 정보')}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <label style={{ width: '80px', fontSize: '13px', fontWeight: 'bold', flexShrink: 0 }}>타입명</label>
            <input value={row.type || ''} onChange={e => setRow({ ...row, type: e.target.value })}
              style={{ flex: 1, padding: '5px 10px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '13px' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <label style={{ width: '80px', fontSize: '13px', fontWeight: 'bold', flexShrink: 0 }}>세대/호수</label>
            <input value={row.units || ''} onChange={e => setRow({ ...row, units: formatNumber(parseNumber(e.target.value)) })}
              style={{ flex: 1, padding: '5px 10px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '13px', textAlign: 'right' }} />
          </div>
          <div>{numInput('평당분양가', 'py_price')}</div>
          <div>{autoInput('단가(자동)', formatNumber(calc.u_price.toFixed(0)))}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          {autoInput('매출액(자동)', formatNumber(calc.total.toFixed(0)))}
          <span style={{ fontSize: '12px', padding: '3px 10px', borderRadius: '12px', fontWeight: 'bold', whiteSpace: 'nowrap',
            backgroundColor: calc.vat_free ? '#d5f5e3' : '#fde8d8',
            color: calc.vat_free ? '#1e8449' : '#935116' }}>
            {calc.vat_free ? '부가세 면제' : '부가세 과세'}
          </span>
        </div>

        {sectionBar('면적 정보 (㎡ 입력)')}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' }}>
          <div>{numInput('전용(㎡)', 'excl_m2')}</div>
          <div>{numInput('벽체(㎡)', 'wall_m2')}</div>
          <div>{numInput('코아(㎡)', 'core_m2')}</div>
          <div>{autoInput('공급(자동)', formatNumber(calc.sup_m2.toFixed(2)))}</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <label style={{ width: '80px', fontSize: '13px', fontWeight: 'bold', color: '#c0392b' }}>전용율(%)</label>
              <input value={calc.excl_rate.toFixed(2)} readOnly
                style={{ flex: 1, padding: '5px 10px', border: '1px solid #f1a9a0', borderRadius: '4px', fontSize: '13px', textAlign: 'right', backgroundColor: '#fdf2f0', color: '#c0392b', fontWeight: 'bold' }} />
            </div>
          </div>
          <div>{autoInput('계약(자동)', formatNumber(calc.cont_m2.toFixed(2)))}</div>
        </div>

        {sectionBar('기타공유 (㎡)')}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' }}>
          {[['관리', 'mgmt_m2'], ['커뮤', 'comm_m2'], ['통신', 'tel_m2'], ['전기', 'elec_m2']].map(([label, key]) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
              <label style={{ width: '36px', fontSize: '13px', fontWeight: 'bold', flexShrink: 0 }}>{label}</label>
              <input value={row[key] || ''} onChange={e => setRow({ ...row, [key]: formatNumber(parseNumber(e.target.value)) })}
                style={{ flex: 1, padding: '5px 8px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '13px', textAlign: 'right' }} />
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <label style={{ width: '80px', fontSize: '13px', fontWeight: 'bold', flexShrink: 0 }}>주차(㎡)</label>
          <input value={row.park_m2 || ''} onChange={e => setRow({ ...row, park_m2: formatNumber(parseNumber(e.target.value)) })}
            style={{ flex: 1, padding: '5px 10px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '13px', textAlign: 'right' }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' }}>
          <div>{autoInput('기타합계', formatNumber(calc.etc_m2.toFixed(2)))}</div>
          <div>{autoInput('계약(자동)', formatNumber(calc.cont_m2.toFixed(2)))}</div>
        </div>

        <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
          <button onClick={() => onConfirm(row)}
            style={{ flex: 1, padding: '9px', backgroundColor: '#4a7fb5', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' }}>확인</button>
          <button onClick={onClose}
            style={{ flex: 1, padding: '9px', backgroundColor: '#95a5a6', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '14px' }}>취소</button>
        </div>
      </div>
    </div>
  );
}

function IncomeSection({ title, color, rows, onAdd, onEdit, onRemove, mode = 'apt', unit }) {
  const total    = rows.reduce((s, r) => s + calcRow(r, mode).total, 0);
  const vatTotal = rows.reduce((s, r) => {
    const c = calcRow(r, mode);
    return s + (c.vat_free ? 0 : Math.round(c.total * 0.1));
  }, 0);
  const isPy  = unit === '평';

  const th  = { padding: '7px 10px', backgroundColor: color.header, color: 'white', fontSize: '12px', textAlign: 'center', whiteSpace: 'nowrap' };
  const td  = { padding: '6px 10px', borderBottom: '1px solid #eee', fontSize: '12px', textAlign: 'right' };
  const tdL = { ...td, textAlign: 'left' };

  const areaLabel = (m2, py) => isPy ? formatNumber(py.toFixed(2)) : formatNumber(m2.toFixed(2));

  // 합계 면적 계산
  const totalUnits   = rows.reduce((s, r) => s + (parseFloat(parseNumber(r.units)) || 0), 0);
  const totalExclM2  = rows.reduce((s, r) => {
    const excl  = parseFloat(parseNumber(r.excl_m2)) || 0;
    const units = parseFloat(parseNumber(r.units))   || 0;
    return s + excl * units;
  }, 0);
  const totalSupM2   = rows.reduce((s, r) => {
    const c     = calcRow(r, mode);
    const units = parseFloat(parseNumber(r.units)) || 0;
    return s + c.sup_m2 * units;
  }, 0);
  const totalContM2  = rows.reduce((s, r) => {
    const c     = calcRow(r, mode);
    const units = parseFloat(parseNumber(r.units)) || 0;
    return s + c.cont_m2 * units;
  }, 0);

  return (
    <div style={{ marginBottom: '28px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <div style={{ fontWeight: 'bold', fontSize: '14px', color: color.main }}>{title}</div>
        <button onClick={onAdd}
          style={{ padding: '5px 14px', backgroundColor: color.main, color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>
          + 타입 추가
        </button>
      </div>
      <div style={{ overflowX: 'auto', borderRadius: '6px', border: '1px solid #e0e0e0' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
          <thead>
            <tr>
              <th style={th}>타입</th>
              <th style={th}>세대/호수</th>
              <th style={th}>평당분양가</th>
              <th style={th}>전용({isPy ? '평' : '㎡'})</th>
              <th style={th}>공급({isPy ? '평' : '㎡'})</th>
              <th style={th}>계약({isPy ? '평' : '㎡'})</th>
              <th style={th}>전용율(%)</th>
              <th style={th}>매출액(천원)</th>
              <th style={th}>부가세</th>
              <th style={th}>수정/삭제</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={10} style={{ textAlign: 'center', padding: '20px', color: '#aaa', fontSize: '13px' }}>타입을 추가하세요</td></tr>
            )}
            {rows.map((r, i) => {
              const c = calcRow(r, mode);
              const exclVal = parseFloat(parseNumber(r.excl_m2)) || 0;
              return (
                <tr key={i} style={{ backgroundColor: i % 2 === 0 ? 'white' : color.light }}>
                  <td style={tdL}>{r.type}</td>
                  <td style={td}>{formatNumber(r.units)}</td>
                  <td style={td}>{formatNumber(r.py_price)}</td>
                  <td style={td}>{areaLabel(exclVal, exclVal * 0.3025)}</td>
                  <td style={td}>{areaLabel(c.sup_m2, c.sup_py)}</td>
                  <td style={td}>{areaLabel(c.cont_m2, c.cont_py)}</td>
                  <td style={td}>{c.excl_rate.toFixed(2)}%</td>
                  <td style={{ ...td, fontWeight: 'bold', color: color.header }}>{formatNumber(c.total.toFixed(0))}</td>
                  <td style={{ ...td, textAlign: 'center' }}>
                    <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '10px', fontWeight: 'bold',
                      backgroundColor: c.vat_free ? '#d5f5e3' : '#fde8d8',
                      color: c.vat_free ? '#1e8449' : '#935116' }}>
                      {c.vat_free ? '면세' : '과세'}
                    </span>
                  </td>
                  <td style={{ ...td, textAlign: 'center' }}>
                    <button onClick={() => onEdit(i)}
                      style={{ padding: '2px 8px', backgroundColor: '#5d8aa8', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer', marginRight: '4px', fontSize: '11px' }}>수정</button>
                    <button onClick={() => onRemove(i)}
                      style={{ padding: '2px 8px', backgroundColor: '#c0392b', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer', fontSize: '11px' }}>삭제</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr style={{ backgroundColor: '#f0f0f0', fontWeight: 'bold' }}>
                <td style={{ padding: '7px 10px', fontSize: '12px', textAlign: 'left', color: '#555' }}>합계</td>
                <td style={{ padding: '7px 10px', fontSize: '12px', textAlign: 'right' }}>
                  {formatNumber(totalUnits)}
                </td>
                <td></td>
                <td style={{ padding: '7px 10px', fontSize: '11px', textAlign: 'right', color: '#555' }}>
                  {areaLabel(totalExclM2, totalExclM2 * 0.3025)}
                </td>
                <td style={{ padding: '7px 10px', fontSize: '11px', textAlign: 'right', color: '#555' }}>
                  {areaLabel(totalSupM2, totalSupM2 * 0.3025)}
                </td>
                <td style={{ padding: '7px 10px', fontSize: '11px', textAlign: 'right', color: '#555' }}>
                  {areaLabel(totalContM2, totalContM2 * 0.3025)}
                </td>
                <td></td>
                <td style={{ padding: '7px 10px', fontSize: '12px', textAlign: 'right', color: color.header }}>
                  {formatNumber(total.toFixed(0))}
                </td>
                <td style={{ padding: '7px 10px', fontSize: '12px', textAlign: 'right' }}>
                  {vatTotal > 0
                    ? <span style={{ color:'#e67e22', fontWeight:'bold' }}>VAT {formatNumber(vatTotal.toFixed(0))}</span>
                    : <span style={{ color:'#aaa', fontSize:'11px' }}>면세</span>}
                </td>
                <td></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

function BalconySection({ aptRows, publicRows, balcony, onChange, burden, setBurden, balIncludePublic, setBalIncludePublic }) {
  const color = COLORS.balcony;
  const displayRows = balIncludePublic ? [...aptRows, ...publicRows] : aptRows;
  const total = displayRows.reduce((s, r) => {
    const units = parseFloat(parseNumber(r.units)) || 0;
    const price = parseFloat(parseNumber(balcony[r.type] || '0')) || 0;
    return s + units * price;
  }, 0);

  const th = { padding: '7px 10px', backgroundColor: color.header, color: 'white', fontSize: '12px', textAlign: 'center' };
  const td = { padding: '6px 10px', borderBottom: '1px solid #eee', fontSize: '12px', textAlign: 'right' };

  return (
    <div style={{ marginBottom: '28px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ fontWeight: 'bold', fontSize: '14px', color: color.main }}>발코니확장</div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', fontSize: '12px', color: '#555' }}>
            <input type="checkbox" checked={!!balIncludePublic}
              onChange={e => setBalIncludePublic(e.target.checked)}
              style={{ cursor: 'pointer' }} />
            공공주택 포함
          </label>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '12px', color: '#555', fontWeight: 'bold' }}>비용 부담:</span>
          {['분양자 부담', '시행사 부담'].map(v => (
            <button key={v} onClick={() => setBurden(v)}
              style={{ padding: '4px 12px', border: '1px solid #ddd', borderRadius: '4px', cursor: 'pointer', fontSize: '12px',
                backgroundColor: (burden || '분양자 부담') === v ? color.main : 'white',
                color: (burden || '분양자 부담') === v ? 'white' : '#333' }}>
              {v}
            </button>
          ))}
          {(burden || '분양자 부담') === '시행사 부담' && (
            <span style={{ fontSize: '11px', color: '#e74c3c', fontWeight: 'bold' }}>
              → 매출 없음 (사업비 처리)
            </span>
          )}
        </div>
      </div>

      <div style={{ borderRadius: '6px', border: '1px solid #e0e0e0', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
          <thead>
            <tr>{['타입', '세대수', '세대당단가(천원)', '매출액(천원)', '부가세'].map(h => <th key={h} style={th}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {displayRows.length === 0 && (
              <tr><td colSpan={5} style={{ textAlign: 'center', padding: '20px', color: '#aaa', fontSize: '13px' }}>공동주택 타입을 먼저 추가하세요</td></tr>
            )}
            {displayRows.map((r, i) => {
              const units  = parseFloat(parseNumber(r.units)) || 0;
              const price  = parseFloat(parseNumber(balcony[r.type] || '')) || 0;
              const amt    = (burden || '분양자 부담') === '분양자 부담' ? units * price : 0;
              const excl   = parseFloat(parseNumber(r.excl_m2)) || 0;
              const vatFree = excl <= 85;
              return (
                <tr key={i} style={{ backgroundColor: i % 2 === 0 ? 'white' : color.light }}>
                  <td style={{ ...td, textAlign: 'left' }}>{r.type}</td>
                  <td style={td}>{formatNumber(r.units)}</td>
                  <td style={{ padding: '4px 8px', borderBottom: '1px solid #eee' }}>
                    <input value={balcony[r.type] || ''}
                      onChange={e => onChange({ ...balcony, [r.type]: formatNumber(parseNumber(e.target.value)) })}
                      style={{ width: '100%', padding: '4px 8px', border: '1px solid #ccc', borderRadius: '3px', fontSize: '12px', textAlign: 'right' }} />
                  </td>
                  <td style={{ ...td, fontWeight: 'bold',
                    color: (burden || '분양자 부담') === '시행사 부담' ? '#aaa' : color.header }}>
                    {(burden || '분양자 부담') === '시행사 부담' ? '-' : formatNumber(amt.toFixed(0))}
                  </td>
                  <td style={{ ...td, textAlign: 'center' }}>
                    {(burden || '분양자 부담') === '시행사 부담' ? (
                      <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '10px', fontWeight: 'bold', backgroundColor: '#f0f0f0', color: '#aaa' }}>-</span>
                    ) : (
                      <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '10px', fontWeight: 'bold',
                        backgroundColor: vatFree ? '#d5f5e3' : '#fde8d8',
                        color: vatFree ? '#1e8449' : '#935116' }}>
                        {vatFree ? '면세' : '과세'}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
          {displayRows.length > 0 && (
            <tfoot>
              <tr style={{ backgroundColor: '#f0f0f0', fontWeight: 'bold' }}>
                <td colSpan={3} style={{ padding: '7px 10px', fontSize: '12px', textAlign: 'right' }}>합계</td>
                <td style={{ padding: '7px 10px', fontSize: '12px', textAlign: 'right', color: (burden||'분양자 부담')==='시행사 부담' ? '#aaa' : color.header }}>
                  {(burden || '분양자 부담') === '시행사 부담' ? '-' : formatNumber(total.toFixed(0))}
                </td>
                <td></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

function Income({ data, onChange, onSave, saving, salesData }) {
  const aptRows        = data.aptRows    || [];
  const publicRows     = data.publicRows || [];
  const offiRows       = data.offiRows   || [];
  const storeRows      = data.storeRows  || [];
  const pubfacRows     = data.pubfacRows || [];
  const balcony        = data.balcony    || {};
  const balIncludePublic = data.balIncludePublic || false;
  const [modal, setModal] = useState(null);
  const [unit,  setUnit]  = useState('㎡');

  const update = (key, val) => onChange({ ...data, [key]: val });

  const sectionKey = (section) => ({
    apt: 'aptRows', public: 'publicRows', offi: 'offiRows',
    store: 'storeRows', pubfac: 'pubfacRows'
  }[section] || 'aptRows');

  const openAdd  = (section) => setModal({ section, index: null, init: emptyApt() });
  const openEdit = (section, index) => {
    const rows = data[sectionKey(section)] || [];
    setModal({ section, index, init: { ...rows[index] } });
  };
  const handleConfirm = (row) => {
    const { section, index } = modal;
    const key  = sectionKey(section);
    const rows = data[key] || [];
    if (index === null) update(key, [...rows, row]);
    else update(key, rows.map((r, i) => i === index ? row : r));
    setModal(null);
  };
  const handleRemove = (section, index) => {
    if (!window.confirm('삭제하시겠습니까?')) return;
    const key  = sectionKey(section);
    const rows = data[key] || [];
    update(key, rows.filter((_, i) => i !== index));
  };

  const [showCrossCheck, setShowCrossCheck] = useState(false);

  const aptTotal    = aptRows.reduce((s, r)    => s + calcRow(r, 'apt').total,   0);
  const publicTotal = publicRows.reduce((s, r) => s + calcRow(r, 'apt').total,   0);
  const balBaseRows = balIncludePublic ? [...aptRows, ...publicRows] : aptRows;
  const balTotal    = (data.balconyBurden || '분양자 부담') === '분양자 부담'
    ? balBaseRows.reduce((s, r) => s + (parseFloat(parseNumber(r.units))||0)*(parseFloat(parseNumber(balcony[r.type]||'0'))||0), 0)
    : 0;
  const offiTotal   = offiRows.reduce((s, r)   => s + calcRow(r, 'offi').total,  0);
  const storeTotal  = storeRows.reduce((s, r)  => s + calcRow(r, 'store').total, 0);
  const pubfacTotal = pubfacRows.reduce((s, r) => s + calcRow(r, 'store').total, 0);
  const grandTotal  = aptTotal + publicTotal + balTotal + offiTotal + storeTotal + pubfacTotal;

  const aptVatTotal = aptRows.reduce((s, r) => {
    const c = calcRow(r, 'apt');
    return s + (c.vat_free ? 0 : Math.round(c.total * 0.1));
  }, 0);
  const publicVatTotal = publicRows.reduce((s, r) => {
    const c = calcRow(r, 'apt');
    return s + (c.vat_free ? 0 : Math.round(c.total * 0.1));
  }, 0);
  const offiVatTotal   = offiRows.reduce((s, r) => s + Math.round(calcRow(r, 'offi').total * 0.1), 0);
  const storeVatTotal  = storeRows.reduce((s, r) => s + Math.round(calcRow(r, 'store').total * 0.1), 0);
  const pubfacVatTotal = pubfacRows.reduce((s, r) => s + Math.round(calcRow(r, 'store').total * 0.1), 0);
  const grandVatTotal  = aptVatTotal + publicVatTotal + offiVatTotal + storeVatTotal + pubfacVatTotal;

  return (
    <div>
      {modal && (
        <TypeModal
          title={modal.section === 'apt' ? '공동주택 타입 입력' : modal.section === 'offi' ? '오피스텔 타입 입력' : '근린상가 입력'}
          init={modal.init} mode={modal.section}
          onConfirm={handleConfirm} onClose={() => setModal(null)}
        />
      )}

      {showCrossCheck && (() => {
        const fmtCC = (v) => v === null ? '—' : Math.round(v).toLocaleString('ko-KR');
        const chk3 = (a, b, c) => Math.abs(a-b)<2 && Math.abs(b-c)<2 && Math.abs(a-c)<2 ? '✅' : '❌';
        const sd = salesData || {};
        const salApt   = sd.salesSumApt   || 0;
        const salBal   = sd.salesSumBal   || 0;
        const salOffi  = sd.salesSumOffi  || 0;
        const salStore = sd.salesSumStore || 0;
        const salAptVat   = sd.salesSumAptVat   || 0;
        const salOffiVat  = sd.salesSumOffiVat  || 0;
        const salStoreVat = sd.salesSumStoreVat || 0;
        const tlApt   = sd.timelineApt   || 0;
        const tlBal   = sd.timelineBal   || 0;
        const tlOffi  = sd.timelineOffi  || 0;
        const tlStore = sd.timelineStore || 0;
        const tlAptVat   = sd.timelineAptVat   || 0;
        const tlOffiVat  = sd.timelineOffiVat  || 0;
        const tlStoreVat = sd.timelineStoreVat || 0;
        const cats = [
          { label:'공동주택', incomeA:aptTotal,   salB:salApt,   tlC:tlApt,   incomeVat:aptVatTotal, salVat:salAptVat, tlVat:tlAptVat },
          ...(balTotal>0||salBal>0 ? [{ label:'발코니확장', incomeA:balTotal, salB:salBal, tlC:tlBal, incomeVat:0, salVat:0, tlVat:0 }] : []),
          { label:'오피스텔', incomeA:offiTotal,  salB:salOffi,  tlC:tlOffi,  incomeVat:offiVatTotal, salVat:salOffiVat, tlVat:tlOffiVat },
          { label:'근린상가', incomeA:storeTotal, salB:salStore, tlC:tlStore, incomeVat:storeVatTotal, salVat:salStoreVat, tlVat:tlStoreVat },
        ];
        const totA=aptTotal+balTotal+offiTotal+storeTotal;
        const totB=salApt+salBal+salOffi+salStore;
        const totC=tlApt+tlBal+tlOffi+tlStore;
        const vatA=grandVatTotal, vatB=salAptVat+salOffiVat+salStoreVat, vatC=tlAptVat+tlOffiVat+tlStoreVat;
        const supOk=chk3(totA,totB,totC), vatOk=chk3(vatA,vatB,vatC);
        const overallOk=supOk==='✅'&&vatOk==='✅'?'✅':'❌';
        const thS=(bg)=>({padding:'7px 10px',textAlign:'right',fontWeight:'bold',color:'white',backgroundColor:bg||'#2c3e50',fontSize:'11px',whiteSpace:'nowrap'});
        const tdS={padding:'6px 10px',textAlign:'right',fontSize:'12px',borderBottom:'1px solid #eee',whiteSpace:'nowrap'};
        const secTitle=(title,color)=>(
          <tr><td colSpan={5} style={{padding:'10px 10px 4px',fontWeight:'bold',fontSize:'13px',color,borderTop:'2px solid '+color,backgroundColor:color+'11'}}>{title}</td></tr>
        );
        return (
          <div style={{position:'fixed',top:0,left:0,width:'100vw',height:'100vh',backgroundColor:'rgba(0,0,0,0.5)',zIndex:3000,display:'flex',alignItems:'center',justifyContent:'center'}}>
            <div style={{backgroundColor:'white',borderRadius:'10px',width:'96%',maxWidth:'860px',maxHeight:'90vh',overflowY:'auto',padding:'24px'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'16px'}}>
                <div>
                  <h3 style={{margin:0,color:'#8e44ad'}}>🔍 수입 크로스체크</h3>
                  <div style={{fontSize:'11px',color:'#888',marginTop:'4px'}}>수입탭 ↔ 분양율 수입요약 ↔ 분양율 타임라인 — 허용오차 ±2천원</div>
                </div>
                <div style={{display:'flex',alignItems:'center',gap:'12px'}}>
                  <span style={{fontSize:'24px'}}>{overallOk}</span>
                  <button onClick={()=>setShowCrossCheck(false)} style={{padding:'6px 14px',border:'1px solid #ddd',borderRadius:'6px',cursor:'pointer'}}>✕ 닫기</button>
                </div>
              </div>
              <table style={{borderCollapse:'collapse',width:'100%',fontSize:'12px'}}>
                <thead>
                  <tr>
                    <th style={{...thS(),textAlign:'left',minWidth:'100px'}}>카테고리</th>
                    <th style={thS('#2980b9')}>수입탭(원천)</th>
                    <th style={thS('#27ae60')}>분양율 수입요약</th>
                    <th style={thS('#8e44ad')}>분양율 타임라인</th>
                    <th style={thS('#e65100')}>일치</th>
                  </tr>
                </thead>
                <tbody>
                  {secTitle('💰 공급금액', '#2980b9')}
                  {cats.map((cat,i)=>{
                    const ok=chk3(cat.incomeA,cat.salB,cat.tlC);
                    const bg=ok==='✅'?(i%2===0?'white':'#f8f9fa'):'#fdecea';
                    return (
                      <tr key={cat.label} style={{backgroundColor:bg}}>
                        <td style={{...tdS,textAlign:'left',fontWeight:'bold',color:'#2c3e50'}}>{cat.label}</td>
                        <td style={{...tdS,color:'#2980b9',fontWeight:'bold'}}>{fmtCC(cat.incomeA)}</td>
                        <td style={{...tdS,color:'#27ae60'}}>{fmtCC(cat.salB)}</td>
                        <td style={{...tdS,color:'#8e44ad'}}>{fmtCC(cat.tlC)}</td>
                        <td style={{...tdS,textAlign:'center',fontSize:'15px'}}>{ok}</td>
                      </tr>
                    );
                  })}
                  <tr style={{backgroundColor:'#1a5276'}}>
                    <td style={{padding:'8px 10px',color:'white',fontWeight:'bold',textAlign:'left'}}>전체 합계</td>
                    <td style={{padding:'8px 10px',color:'#74b9ff',fontWeight:'bold',textAlign:'right'}}>{fmtCC(totA)}</td>
                    <td style={{padding:'8px 10px',color:'#55efc4',fontWeight:'bold',textAlign:'right'}}>{fmtCC(totB)}</td>
                    <td style={{padding:'8px 10px',color:'#a29bfe',fontWeight:'bold',textAlign:'right'}}>{fmtCC(totC)}</td>
                    <td style={{padding:'8px 10px',textAlign:'center',fontSize:'18px'}}>{supOk}</td>
                  </tr>
                  {secTitle('🧾 부가세 (VAT)', '#e67e22')}
                  {cats.map((cat,i)=>{
                    if(cat.incomeVat===0) return (
                      <tr key={cat.label+'_vat'} style={{backgroundColor:i%2===0?'white':'#f8f9fa'}}>
                        <td style={{...tdS,textAlign:'left',color:'#999'}}>{cat.label}</td>
                        <td style={{...tdS,color:'#ddd',textAlign:'center'}} colSpan={3}>면세</td>
                        <td style={{...tdS,textAlign:'center'}}>—</td>
                      </tr>
                    );
                    const ok=chk3(cat.incomeVat,cat.salVat,cat.tlVat);
                    const bg=ok==='✅'?(i%2===0?'white':'#f8f9fa'):'#fdecea';
                    return (
                      <tr key={cat.label+'_vat'} style={{backgroundColor:bg}}>
                        <td style={{...tdS,textAlign:'left',fontWeight:'bold',color:'#2c3e50'}}>{cat.label}</td>
                        <td style={{...tdS,color:'#2980b9',fontWeight:'bold'}}>{fmtCC(cat.incomeVat)}</td>
                        <td style={{...tdS,color:'#27ae60'}}>{fmtCC(cat.salVat)}</td>
                        <td style={{...tdS,color:'#aaa',textAlign:'center'}}>—</td>
                        <td style={{...tdS,textAlign:'center',fontSize:'15px'}}>{ok}</td>
                      </tr>
                    );
                  })}
                  <tr style={{backgroundColor:'#7d3c00'}}>
                    <td style={{padding:'8px 10px',color:'white',fontWeight:'bold',textAlign:'left'}}>전체 합계</td>
                    <td style={{padding:'8px 10px',color:'#fad7a0',fontWeight:'bold',textAlign:'right'}}>{fmtCC(vatA)}</td>
                    <td style={{padding:'8px 10px',color:'#a9dfbf',fontWeight:'bold',textAlign:'right'}}>{fmtCC(vatB)}</td>
                    <td style={{padding:'8px 10px',color:'#d2b4de',fontWeight:'bold',textAlign:'right'}}>{fmtCC(vatC)}</td>
                    <td style={{padding:'8px 10px',textAlign:'center',fontSize:'18px'}}>{vatOk}</td>
                  </tr>
                </tbody>
              </table>
              <div style={{marginTop:'12px',fontSize:'11px',color:'#888',display:'flex',gap:'16px',flexWrap:'wrap'}}>
                <span style={{color:'#2980b9'}}>■ 수입탭: 각 타입 직접 계산값</span>
                <span style={{color:'#27ae60'}}>■ 분양율 수입요약: catRows 합계</span>
                <span style={{color:'#8e44ad'}}>■ 분양율 타임라인: monthly 합산</span>
                <span>※ 타임라인VAT는 전체합계만 비교</span>
              </div>
            </div>
          </div>
        );
      })()}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h3 style={{ margin: 0 }}>수입</h3>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <UnitToggle unit={unit} setUnit={setUnit} />
          <button onClick={() => setShowCrossCheck(true)}
            style={{ padding:'6px 14px', backgroundColor:'#8e44ad', color:'white', border:'none', borderRadius:'4px', cursor:'pointer', fontSize:'12px' }}>
            🔍 크로스체크
          </button>
          <button onClick={onSave}
            style={{ padding: '6px 16px', backgroundColor: '#27ae60', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
            {saving ? '저장 중...' : 'Firestore 저장'}
          </button>
        </div>
      </div>

      <IncomeSection title="공동주택" color={COLORS.apt} mode="apt" unit={unit}
        rows={aptRows} onAdd={() => openAdd('apt')} onEdit={i => openEdit('apt', i)} onRemove={i => handleRemove('apt', i)} />

      <IncomeSection title="공공주택" color={COLORS.public} mode="apt" unit={unit}
        rows={publicRows} onAdd={() => openAdd('public')} onEdit={i => openEdit('public', i)} onRemove={i => handleRemove('public', i)} />

      <BalconySection aptRows={aptRows} publicRows={publicRows}
        balcony={balcony} onChange={val => update('balcony', val)}
        burden={data.balconyBurden || '분양자 부담'}
        setBurden={val => onChange({...data, balconyBurden: val})}
        balIncludePublic={balIncludePublic}
        setBalIncludePublic={val => update('balIncludePublic', val)} />

      <IncomeSection title="오피스텔" color={COLORS.offi} mode="offi" unit={unit}
        rows={offiRows} onAdd={() => openAdd('offi')} onEdit={i => openEdit('offi', i)} onRemove={i => handleRemove('offi', i)} />

      <IncomeSection title="근린상가" color={COLORS.store} mode="store" unit={unit}
        rows={storeRows} onAdd={() => openAdd('store')} onEdit={i => openEdit('store', i)} onRemove={i => handleRemove('store', i)} />

      <IncomeSection title="공공시설" color={COLORS.pubfac} mode="store" unit={unit}
        rows={pubfacRows} onAdd={() => openAdd('pubfac')} onEdit={i => openEdit('pubfac', i)} onRemove={i => handleRemove('pubfac', i)} />

      <div style={{ backgroundColor: '#2c3e50', color: 'white', borderRadius: '8px', padding: '16px 20px', marginTop: '8px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '12px', fontSize: '13px', marginBottom: '14px' }}>
          {[
            { label: '공동주택',  supply: aptTotal,    vat: aptVatTotal    },
            { label: '공공주택',  supply: publicTotal, vat: publicVatTotal },
            { label: '발코니확장',supply: balTotal,    vat: 0              },
            { label: '오피스텔', supply: offiTotal,   vat: offiVatTotal   },
            { label: '근린상가', supply: storeTotal,  vat: storeVatTotal  },
            { label: '공공시설', supply: pubfacTotal, vat: pubfacVatTotal },
          ].filter(({ supply, vat }) => supply > 0 || vat > 0).map(({ label, supply, vat }) => (
            <div key={label}>
              <div style={{ opacity: 0.65, marginBottom: '6px', fontSize: '12px', fontWeight: 'bold' }}>{label}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                <span style={{ opacity: 0.7, fontSize: '11px' }}>공급가</span>
                <span style={{ fontWeight: 'bold', fontSize: '12px' }}>{formatNumber(Math.round(supply))} 천</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                <span style={{ opacity: 0.7, fontSize: '11px' }}>부가세</span>
                <span style={{ fontWeight: 'bold', fontSize: '12px', color: vat > 0 ? '#f39c12' : 'rgba(255,255,255,0.35)' }}>
                  {vat > 0 ? `${formatNumber(Math.round(vat))} 천` : '면세'}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.2)', paddingTop: '4px' }}>
                <span style={{ opacity: 0.7, fontSize: '11px' }}>총액</span>
                <span style={{ fontWeight: 'bold', fontSize: '12px', color: '#a9dfbf' }}>{formatNumber(Math.round(supply + vat))} 천</span>
              </div>
            </div>
          ))}
          <div style={{ borderLeft: '1px solid rgba(255,255,255,0.2)', paddingLeft: '16px' }}>
            <div style={{ opacity: 0.65, marginBottom: '6px', fontSize: '12px', fontWeight: 'bold' }}>전체 합계</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
              <span style={{ opacity: 0.7, fontSize: '11px' }}>공급가</span>
              <span style={{ fontWeight: 'bold', fontSize: '13px' }}>{formatNumber(Math.round(grandTotal))} 천</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
              <span style={{ opacity: 0.7, fontSize: '11px' }}>부가세</span>
              <span style={{ fontWeight: 'bold', fontSize: '13px', color: '#f39c12' }}>{formatNumber(Math.round(grandVatTotal))} 천</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.2)', paddingTop: '4px' }}>
              <span style={{ opacity: 0.7, fontSize: '11px' }}>총 매출액</span>
              <span style={{ fontWeight: 'bold', fontSize: '16px', color: '#f1c40f' }}>{formatNumber(Math.round(grandTotal + grandVatTotal))} 천</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Income;
