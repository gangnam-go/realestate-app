import React, { useState, useEffect } from 'react';
import { formatNumber, parseNumber } from '../utils';
import { db } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { FundingModal, FinanceCostSection } from './Finance';

// ─────────────────────────────────────────────
// 상수
// ─────────────────────────────────────────────
const FUNDING_KEYS = ['equity', 'pf', 'sale'];
const FUNDING_LABELS = { equity: '에쿼티', pf: '필수사업비', sale: '분양불' };
const FUNDING_COLORS = {
  equity: { bg: '#eaf5fb', color: '#1a6a8a', border: '#aad4e8' },
  pf:     { bg: '#fef9e7', color: '#7d6608', border: '#f9e79f' },
  sale:   { bg: '#eafaf1', color: '#1a6a3a', border: '#a9dfbf' },
};

// funding 객체 → 활성 항목 요약 텍스트 (예: "에쿼티 60% · PF 40%")
const fundingSummary = (funding) => {
  if (!funding) return '에쿼티 100%';
  return FUNDING_KEYS
    .map(k => ({ label: FUNDING_LABELS[k], pct: parseFloat(funding[k]) || 0 }))
    .filter(x => x.pct > 0)
    .map(x => `${x.label} ${x.pct}%`)
    .join(' · ') || '미설정';
};

// 비율 합계
const fundingTotal = (funding) =>
  FUNDING_KEYS.reduce((s, k) => s + (parseFloat(funding?.[k]) || 0), 0);

// ─────────────────────────────────────────────
// 공통 스타일
// ─────────────────────────────────────────────
const sectionTitle = (title) => (
  <div style={{
    backgroundColor: '#c0392b', color: 'white',
    padding: '6px 12px', borderRadius: '4px',
    marginBottom: '12px', marginTop: '20px',
    fontWeight: 'bold', fontSize: '13px',
  }}>{title}</div>
);

// ─────────────────────────────────────────────
// 과세 체크박스
// ─────────────────────────────────────────────
const TaxBadge = ({ checked, onChange }) => (
  <label style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', cursor: 'pointer', marginTop: '4px' }}>
    <input type="checkbox" checked={!!checked} onChange={e => onChange(e.target.checked)}
      style={{ cursor: 'pointer', width: '13px', height: '13px' }} />
    <span style={{
      fontSize: '11px', fontWeight: 'bold',
      color: checked ? '#e74c3c' : '#aaa',
      padding: '1px 6px', borderRadius: '8px',
      backgroundColor: checked ? '#fde8d8' : '#f5f5f5',
      border: `1px solid ${checked ? '#f0a07a' : '#ddd'}`,
    }}>
      {checked ? '과세' : '면세'}
    </span>
  </label>
);

const colHeader = (label, width, align = 'center') => (
  <th style={{
    padding: '7px 8px', backgroundColor: '#f0f0f0',
    fontWeight: 'bold', fontSize: '12px',
    borderBottom: '2px solid #ddd', textAlign: align,
    width,
  }}>{label}</th>
);

// ─────────────────────────────────────────────
// 재원조달 셀 (접기/펼치기 + 비율 입력 + 100% 검증)
// ─────────────────────────────────────────────
function FundingCell({ funding, onChange, totalAmt }) {
  const [open, setOpen] = useState(false);
  const f = funding || { equity: '0', pf: '100', sale: '0' };
  const total = fundingTotal(f);
  const over = total > 100;
  const under = total < 100;
  const ok = total === 100;

  const update = (key, val) => {
    const next = { ...f, [key]: val };
    // 에쿼티 또는 분양불 변경 시 PF가 나머지를 자동으로 채움
    if (key === 'equity' || key === 'sale') {
      const eq   = parseFloat(key === 'equity' ? val : next.equity) || 0;
      const sale = parseFloat(key === 'sale'   ? val : next.sale)   || 0;
      const pf   = Math.max(0, 100 - eq - sale);
      next.pf = String(pf % 1 === 0 ? pf : pf.toFixed(1));
    }
    onChange(next);
  };

  // 요약 뱃지들 (0%인 항목 숨김)
  const badges = FUNDING_KEYS.filter(k => (parseFloat(f[k]) || 0) > 0);

  return (
    <div style={{ fontSize: '12px' }}>
      {/* 접힌 상태: 요약 + 펼치기 버튼 */}
      <div
        onClick={() => setOpen(!open)}
        style={{
          cursor: 'pointer', display: 'flex', flexWrap: 'wrap',
          gap: '3px', alignItems: 'center',
          padding: '4px 6px',
          border: `1px solid ${ok ? '#c8e6c9' : over ? '#ffcdd2' : '#ffe0b2'}`,
          borderRadius: '6px',
          backgroundColor: ok ? '#f1f8e9' : over ? '#ffebee' : '#fff8e1',
        }}
      >
        {badges.length === 0
          ? <span style={{ color: '#aaa', fontSize: '11px' }}>미설정</span>
          : badges.map(k => {
              const c = FUNDING_COLORS[k];
              const pct = parseFloat(f[k]) || 0;
              const amt = totalAmt ? Math.round(totalAmt * pct / 100) : null;
              return (
                <span key={k} style={{
                  fontSize: '11px', padding: '1px 7px', borderRadius: '10px',
                  fontWeight: 'bold', backgroundColor: c.bg,
                  color: c.color, border: `1px solid ${c.border}`,
                }}>
                  {FUNDING_LABELS[k]} {pct}%
                  {amt !== null && <span style={{ fontWeight: 'normal', marginLeft: '3px' }}>({formatNumber(amt)})</span>}
                </span>
              );
            })
        }
        <span style={{ marginLeft: 'auto', color: '#aaa', fontSize: '11px' }}>{open ? '▲' : '▼'}</span>
      </div>

      {/* 펼친 상태: 비율 입력 */}
      {open && (
        <div style={{
          marginTop: '4px', padding: '8px',
          border: '1px solid #ddd', borderRadius: '6px',
          backgroundColor: '#fafafa',
        }}>
          {FUNDING_KEYS.map(k => {
            const c = FUNDING_COLORS[k];
            const pct = parseFloat(f[k]) || 0;
            const amt = totalAmt ? Math.round(totalAmt * pct / 100) : null;
            return (
              <div key={k} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '5px' }}>
                <span style={{
                  width: '44px', fontSize: '11px', fontWeight: 'bold',
                  color: c.color, flexShrink: 0,
                }}>{FUNDING_LABELS[k]}</span>
                <input
                  type="number" min="0" max="100"
                  value={f[k] || ''}
                  onChange={e => update(k, e.target.value)}
                  placeholder="0"
                  style={{
                    width: '52px', padding: '3px 6px',
                    border: `1px solid ${c.border}`, borderRadius: '3px',
                    fontSize: '12px', textAlign: 'right',
                    backgroundColor: pct > 0 ? c.bg : 'white',
                  }}
                />
                <span style={{ fontSize: '11px', color: '#888' }}>%</span>
                {amt !== null && pct > 0 && (
                  <span style={{ fontSize: '11px', color: '#555' }}>{formatNumber(amt)} 천원</span>
                )}
              </div>
            );
          })}

          {/* 합계 검증 */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            borderTop: '1px solid #eee', paddingTop: '5px', marginTop: '3px',
          }}>
            <span style={{ fontSize: '11px', color: '#888' }}>합계</span>
            <span style={{
              fontSize: '12px', fontWeight: 'bold',
              color: ok ? '#27ae60' : over ? '#e74c3c' : '#e67e22',
            }}>
              {total}% {ok ? '✓' : over ? '▲초과' : '▼부족'}
            </span>
          </div>
          {!ok && (
            <div style={{ fontSize: '10px', color: over ? '#e74c3c' : '#e67e22', marginTop: '3px' }}>
              {over ? `${total - 100}% 초과 — 합계를 100%로 맞춰주세요` : `${100 - total}% 부족 — 합계를 100%로 맞춰주세요`}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// 읽기전용 금액 셀
// ─────────────────────────────────────────────
const roCell = (value) => (
  <input readOnly value={value}
    style={{
      width: '100%', padding: '5px 8px',
      border: '1px solid #bee3f8', borderRadius: '3px',
      fontSize: '12px', textAlign: 'right',
      backgroundColor: '#ebf5fb', color: '#1a5276', fontWeight: 'bold',
    }}
  />
);

// 부가세 포함 금액 셀 (과세 항목용)
// taxable=true이면 공급가 아래 부가세 표시, totalAmt는 공급가+VAT 반환
const vatCell = (amt, taxable) => ({
  cell: taxable ? (
    <div>
      {roCell(formatNumber(amt))}
      <div style={{ fontSize:'10px', color:'#e67e22', textAlign:'right', marginTop:'2px', fontWeight:'bold' }}>
        VAT {formatNumber(Math.round(amt * 0.1))}
      </div>
    </div>
  ) : roCell(formatNumber(amt)),
  totalAmt: taxable ? Math.round(amt * 1.1) : amt,
});

// ─────────────────────────────────────────────
// 입력 셀 (숫자)
// ─────────────────────────────────────────────
const numInput = (value, onChange, placeholder = '') => (
  <input
    value={value || ''}
    onChange={e => onChange(formatNumber(parseNumber(e.target.value)))}
    placeholder={placeholder}
    style={{
      width: '100%', padding: '5px 8px',
      border: '1px solid #ddd', borderRadius: '3px',
      fontSize: '12px', textAlign: 'right',
    }}
  />
);

// ─────────────────────────────────────────────
// 토지관련비용 섹션
// ─────────────────────────────────────────────
function LandCostSection({ data, onChange, archData }) {
  // archData에서 대지면적 가져오기
  const plots = archData?.plots || [];
  const totalM2 = plots.reduce((s, p) => s + (parseFloat(parseNumber(p.areaM2)) || 0), 0);
  const totalPy = (totalM2 * 0.3025).toFixed(2);

  const d = data || {};

  const update = (key, val) => onChange({ ...d, [key]: val });
  const updateFunding = (key, val) => onChange({ ...d, [`${key}_funding`]: val });

  // ── 그룹별 면적 계산 ──
  const groups = ['A','B','C','D'];
  const groupPlots = {};
  const groupPy = {};
  groups.forEach(g => {
    groupPlots[g] = plots.filter(p => (p.group || 'A') === g);
    const gM2 = groupPlots[g].reduce((s, p) => s + (parseFloat(parseNumber(p.areaM2)) || 0), 0);
    groupPy[g] = gM2 * 0.3025;
  });
  const activeGroups = groups.filter(g => groupPy[g] > 0);

  // ── 토지매입비 (그룹별) ──
  const landGroupData = d.landGroups || {};
  const groupLandAmts = {};
  activeGroups.forEach(g => {
    const gd = landGroupData[g] || {};
    const gPyPrice = parseFloat(parseNumber(gd.pyPrice)) || 0;
    const gCalcAmt = Math.round(gPyPrice * groupPy[g]);
    const gOverride = parseFloat(parseNumber(gd.override));
    groupLandAmts[g] = gOverride > 0 ? gOverride : gCalcAmt;
  });

  // ── 토지매입비 합계 ──
  const pyPrice     = parseFloat(parseNumber(d.landPyPrice)) || 0;
  const calcLand    = Math.round(pyPrice * parseFloat(totalPy));
  const overrideAmt = parseFloat(parseNumber(d.landOverride));
  const landAmt = activeGroups.length > 0
    ? activeGroups.reduce((s, g) => s + groupLandAmts[g], 0)
    : (overrideAmt > 0 ? overrideAmt : calcLand);

  // ── 취득세 ──
  const acqRate   = parseFloat(d.acqTaxRate ?? '4.6') || 0;
  const acqAmt    = d.acqTaxOverride
    ? parseFloat(parseNumber(d.acqTaxOverride)) || 0
    : Math.round(landAmt * acqRate / 100);

  // ── 국민주택채권할인 (토지매입) ──
  const totalPublicPrice = plots.reduce((s, p) => s + (parseFloat(parseNumber(p.totalPrice)) || 0), 0);
  const bondBuyRate    = parseFloat(d.bondBuyRate  ?? '50')   || 0;
  const bondDiscRate   = parseFloat(d.bondDiscRate ?? '13.5') || 0;
  const bondBuyAmt     = Math.round(totalPublicPrice * bondBuyRate / 1000);
  const bondAmt        = d.bondOverride
    ? parseFloat(parseNumber(d.bondOverride)) || 0
    : Math.round(bondBuyAmt * bondDiscRate / 100 / 1000);

  // ── 법무사/등기비 ──
  const legalMode = d.legalMode || 'rate';
  const legalRate = parseFloat(d.legalRate ?? '0.3') || 0;
  const legalAmt  = legalMode === 'rate'
    ? Math.round(landAmt * legalRate / 100)
    : parseFloat(parseNumber(d.legalDirect)) || 0;

  // ── 중개수수료 (그룹별 토지매입비 기준) ──
  const agentMode = d.agentMode || 'rate';
  const agentGroupRates = d.agentGroupRates || {};
  const agentAmt = agentMode === 'rate'
    ? activeGroups.reduce((s, g) => {
        const rate = parseFloat(agentGroupRates[g] ?? '0.5') || 0;
        return s + Math.round(groupLandAmts[g] * rate / 100);
      }, 0)
    : parseFloat(parseNumber(d.agentDirect)) || 0;

  // ── 기타 항목 ──
  const etcItems  = d.etcItems || [];
  const etcTotal  = etcItems.reduce((s, it) => s + (parseFloat(parseNumber(it.amt)) || 0), 0);

  // ── 합계 ──
  const total = landAmt + acqAmt + bondAmt + legalAmt + agentAmt + etcTotal;
  const vatTotal = Math.round(
    (!!d.land_taxable ? landAmt*0.1 : 0) + (!!d.acq_taxable ? acqAmt*0.1 : 0) +
    (!!d.bond_taxable ? bondAmt*0.1 : 0) + (!!d.legal_taxable ? legalAmt*0.1 : 0) +
    (!!d.agent_taxable ? agentAmt*0.1 : 0) +
    etcItems.reduce((s,it)=>s+(!!it.taxable?(parseFloat(parseNumber(it.amt))||0)*0.1:0),0));

  const tdStyle = { padding: '6px 8px', borderBottom: '1px solid #eee', verticalAlign: 'middle' };
  const labelStyle = { fontWeight: 'bold', fontSize: '13px', color: '#2c3e50' };

  const addEtc = () => update('etcItems', [...etcItems, { name: '', amt: '', funding: { equity: '0', pf: '100', sale: '0' } }]);
  const removeEtc = (i) => update('etcItems', etcItems.filter((_, idx) => idx !== i));
  const updateEtc = (i, key, val) => {
    const arr = etcItems.map((it, idx) => idx === i ? { ...it, [key]: val } : it);
    update('etcItems', arr);
  };

  return (
    <div>
      {sectionTitle('토지관련비용')}

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
        <thead>
          <tr>
            {colHeader('항목', '160px', 'left')}
            {colHeader('근거기준', '200px')}
            {colHeader('기준/단가', '160px')}
            {colHeader('금액 (천원)', '160px')}
            {colHeader('재원조달', '140px')}
          </tr>
        </thead>
        <tbody>

          {/* ① 토지매입비 (그룹별) */}
          <tr style={{ backgroundColor: 'white' }}>
            <td style={tdStyle}>
              <span style={labelStyle}>① 토지매입비</span>
              <TaxBadge checked={!!d.land_taxable} onChange={v => update('land_taxable', v)} />
              <div style={{ fontSize: '11px', color: '#888', marginTop: '2px' }}>
                대지면적: {formatNumber(parseFloat(totalPy).toFixed(2))}평 (자동연동)
              </div>
            </td>
            <td style={tdStyle}>
              <div style={{ fontSize: '11px', color: '#555' }}>매매계약 기준</div>
            </td>
            <td style={tdStyle}>
              {activeGroups.length === 0 ? (
                <div style={{ fontSize: '11px', color: '#aaa' }}>토지조서에 필지를 추가하세요</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {activeGroups.map(g => {
                    const gColor = {'A':'#2980b9','B':'#1a7a4a','C':'#b7770d','D':'#c0392b'}[g] || '#333';
                    const gBg   = {'A':'#eaf1f8','B':'#eaf8f0','C':'#fef9e7','D':'#fdecea'}[g] || 'white';
                    const gd    = landGroupData[g] || {};
                    const py    = groupPy[g];
                    const amt   = groupLandAmts[g];
                    return (
                      <div key={g} style={{ backgroundColor: gBg, borderRadius: '6px', padding: '6px 8px', border: `1px solid ${gColor}33` }}>
                        <div style={{ fontSize: '11px', fontWeight: 'bold', color: gColor, marginBottom: '4px' }}>
                          {g}그룹 — {formatNumber(py.toFixed(2))}평
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            {numInput(gd.pyPrice || '', v => {
                              update('landGroups', { ...landGroupData, [g]: { ...gd, pyPrice: v, override: '' } });
                            }, '평당단가')}
                            <span style={{ fontSize: '11px', color: '#888', whiteSpace: 'nowrap' }}>천원/평</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <input
                              value={gd.override || ''}
                              onChange={e => {
                                const raw = parseNumber(e.target.value);
                                const totalAmt = parseFloat(raw) || 0;
                                const pyCalc = py > 0 ? formatNumber(Math.round(totalAmt / py)) : gd.pyPrice;
                                update('landGroups', { ...landGroupData, [g]: { ...gd, override: formatNumber(raw), pyPrice: pyCalc } });
                              }}
                              placeholder="총액 직접입력 (천원)"
                              style={{ flex: 1, padding: '4px 8px', border: `1px solid ${gd.override ? gColor : '#ddd'}`, borderRadius: '3px', fontSize: '11px', textAlign: 'right', backgroundColor: gd.override ? gBg : 'white' }}
                            />
                            {gd.override && (
                              <button onClick={() => update('landGroups', { ...landGroupData, [g]: { ...gd, override: '' } })}
                                style={{ padding: '3px 6px', fontSize: '11px', backgroundColor: gColor, color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer' }}>✕</button>
                            )}
                          </div>
                          <div style={{ fontSize: '11px', fontWeight: 'bold', color: gColor, textAlign: 'right' }}>
                            = {formatNumber(amt)} 천원
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#2c3e50', textAlign: 'right', borderTop: '1px solid #ddd', paddingTop: '4px' }}>
                    합계: {formatNumber(landAmt)} 천원
                  </div>
                </div>
              )}
            </td>
            {(() => { const vc = vatCell(landAmt, !!d.land_taxable); return <td style={tdStyle}>{vc.cell}</td>; })()}
            <td style={tdStyle}>
              <FundingCell
                funding={d.land_funding || { equity: '0', pf: '100', sale: '0' }}
                onChange={v => updateFunding('land', v)}
                totalAmt={!!d.land_taxable ? Math.round(landAmt*1.1) : landAmt}
              />
            </td>
          </tr>

          {/* ② 취득세 */}
          <tr style={{ backgroundColor: '#fafafa' }}>
            <td style={tdStyle}><span style={labelStyle}>② 취득세</span><br/><TaxBadge checked={!!d.acq_taxable} onChange={v => update('acq_taxable', v)} /></td>
            <td style={tdStyle}>
              <div style={{ fontSize:'11px', color:'#555', lineHeight:'1.7' }}>
                <div style={{ fontWeight:'bold', color:'#2c3e50' }}>지방세법 제10조 제11조</div>
                <div>취득세 4% + 농특세 0.2%</div>
                <div>+ 지방교육세 0.4% = 4.6%</div>
              </div>
            </td>
            <td style={tdStyle}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <input
                    value={d.acqTaxRate ?? '4.6'}
                    onChange={e => update('acqTaxRate', e.target.value)}
                    style={{ width: '60px', padding: '5px 8px', border: '1px solid #ddd', borderRadius: '3px', fontSize: '12px', textAlign: 'right' }}
                  />
                  <span style={{ fontSize: '11px', color: '#888' }}>%</span>
                  <span style={{ fontSize: '10px', color: '#aaa', marginLeft: '4px' }}>토지매입비 기준</span>
                </div>
                <input
                  value={d.acqTaxOverride || ''}
                  onChange={e => update('acqTaxOverride', formatNumber(parseNumber(e.target.value)))}
                  placeholder="직접입력 (선택)"
                  style={{
                    padding: '4px 8px', border: `1px solid ${d.acqTaxOverride ? '#e74c3c' : '#ddd'}`,
                    borderRadius: '3px', fontSize: '11px', textAlign: 'right', width: '100%',
                    backgroundColor: d.acqTaxOverride ? '#fdf2f0' : 'white',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
            </td>
            {(() => { const vc = vatCell(acqAmt, !!d.acq_taxable); return <td style={tdStyle}>{vc.cell}</td>; })()}
            <td style={tdStyle}>
              <FundingCell
                funding={d.acq_funding || { equity: '0', pf: '100', sale: '0' }}
                onChange={v => updateFunding('acq', v)}
                totalAmt={!!d.acq_taxable ? Math.round(acqAmt*1.1) : acqAmt}
              />
            </td>
          </tr>

          {/* ③ 국민주택채권할인 (토지매입) */}
          <tr style={{ backgroundColor: 'white' }}>
            <td style={tdStyle}>
              <span style={labelStyle}>③ 국민주택채권할인</span>
              <TaxBadge checked={!!d.bond_taxable} onChange={v => update('bond_taxable', v)} />
            </td>
            <td style={tdStyle}>
              <div style={{ fontSize:'11px', color:'#1a237e', fontWeight:'bold', marginBottom:'4px' }}>
                주택도시기금법 시행령 별표 1
              </div>
              <div style={{ fontSize:'11px', color:'#555', lineHeight:'1.8' }}>
                <div>개별공시지가 × {bondBuyRate}/1,000 × {bondDiscRate}%</div>
                {totalPublicPrice > 0
                  ? <div style={{ fontSize:'10px', color:'#2980b9' }}>개별공시지가: {formatNumber(Math.round(totalPublicPrice/1000))}천원</div>
                  : <div style={{ fontSize:'10px', color:'#e74c3c' }}>※ 토지조서에 개별공시지가금액 입력 필요</div>}
                <div style={{ fontSize:'10px', color:'#888' }}>채권매입금액: {formatNumber(Math.round(bondBuyAmt/1000))}천원</div>
                <div style={{ fontSize:'10px', color:'#888' }}>※ 상세기준: 기준정보(⚙) → 국민주택채권</div>
              </div>
            </td>
            <td style={tdStyle}>
              <div style={{ display:'flex', flexDirection:'column', gap:'4px' }}>
                <div style={{ display:'flex', alignItems:'center', gap:'4px' }}>
                  <span style={{ fontSize:'11px', color:'#555', whiteSpace:'nowrap' }}>매입요율</span>
                  <input value={d.bondBuyRate??'50'} onChange={e=>update('bondBuyRate',e.target.value)}
                    style={{ width:'50px', padding:'4px 6px', border:'1px solid #ddd', borderRadius:'3px', fontSize:'12px', textAlign:'right' }} />
                  <span style={{ fontSize:'11px', color:'#888' }}>/1,000</span>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:'4px' }}>
                  <span style={{ fontSize:'11px', color:'#555', whiteSpace:'nowrap' }}>즉시배도율</span>
                  <input value={d.bondDiscRate??'13.5'} onChange={e=>update('bondDiscRate',e.target.value)}
                    style={{ width:'50px', padding:'4px 6px', border:'1px solid #ddd', borderRadius:'3px', fontSize:'12px', textAlign:'right' }} />
                  <span style={{ fontSize:'11px', color:'#888' }}>%</span>
                </div>
                <input value={d.bondOverride||''} onChange={e=>update('bondOverride',formatNumber(parseNumber(e.target.value)))}
                  placeholder="직접입력 (선택)"
                  style={{ padding:'4px 8px', border:`1px solid ${d.bondOverride?'#e74c3c':'#ddd'}`, borderRadius:'3px', fontSize:'11px', textAlign:'right', width:'100%', backgroundColor:d.bondOverride?'#fdf2f0':'white', boxSizing:'border-box' }} />
              </div>
            </td>
            {(() => { const vc = vatCell(bondAmt, !!d.bond_taxable); return <td style={tdStyle}>{vc.cell}</td>; })()}
            <td style={tdStyle}>
              <FundingCell funding={d.bond_funding||{equity:'0',pf:'100',sale:'0'}} onChange={v=>updateFunding('bond',v)} totalAmt={!!d.bond_taxable ? Math.round(bondAmt*1.1) : bondAmt} />
            </td>
          </tr>

          {/* ④ 법무사/등기비 */}
          <tr style={{ backgroundColor: 'white' }}>
            <td style={tdStyle}><span style={labelStyle}>④ 법무사/등기비</span><br/><TaxBadge checked={!!d.legal_taxable} onChange={v => update('legal_taxable', v)} /></td>
            <td style={{ ...tdStyle, textAlign: 'center' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', alignItems: 'center' }}>
                {['rate', 'direct'].map(m => (
                  <label key={m} style={{ fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px' }}>
                    <input type="radio" name="legalMode" value={m}
                      checked={(d.legalMode || 'rate') === m}
                      onChange={() => update('legalMode', m)} />
                    {m === 'rate' ? '요율' : '직접입력'}
                  </label>
                ))}
              </div>
            </td>
            <td style={tdStyle}>
              {(d.legalMode || 'rate') === 'rate' ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <input value={d.legalRate ?? '0.3'} onChange={e => update('legalRate', e.target.value)}
                    style={{ width: '60px', padding: '5px 8px', border: '1px solid #ddd', borderRadius: '3px', fontSize: '12px', textAlign: 'right' }} />
                  <span style={{ fontSize: '11px', color: '#888' }}>%</span>
                  <span style={{ fontSize: '10px', color: '#aaa', marginLeft: '4px' }}>토지매입비 기준</span>
                </div>
              ) : (
                numInput(d.legalDirect, v => update('legalDirect', v), '금액 입력')
              )}
            </td>
            {(() => { const vc = vatCell(legalAmt, !!d.legal_taxable); return <td style={tdStyle}>{vc.cell}</td>; })()}
            <td style={tdStyle}>
              <FundingCell
                funding={d.legal_funding || { equity: '0', pf: '100', sale: '0' }}
                onChange={v => updateFunding('legal', v)}
                totalAmt={!!d.legal_taxable ? Math.round(legalAmt*1.1) : legalAmt}
              />
            </td>
          </tr>

          {/* ⑤ 중개수수료 (그룹별) */}
          <tr style={{ backgroundColor: '#fafafa' }}>
            <td style={tdStyle}><span style={labelStyle}>⑤ 중개수수료</span><br/><TaxBadge checked={!!d.agent_taxable} onChange={v => update('agent_taxable', v)} /></td>
            <td style={{ ...tdStyle, textAlign: 'center' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', alignItems: 'center' }}>
                {['rate', 'direct'].map(m => (
                  <label key={m} style={{ fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px' }}>
                    <input type="radio" name="agentMode" value={m}
                      checked={(d.agentMode || 'rate') === m}
                      onChange={() => update('agentMode', m)} />
                    {m === 'rate' ? '요율' : '직접입력'}
                  </label>
                ))}
              </div>
            </td>
            <td style={tdStyle}>
              {(d.agentMode || 'rate') === 'rate' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {activeGroups.length === 0 ? (
                    <span style={{ fontSize: '11px', color: '#aaa' }}>토지조서에 필지를 추가하세요</span>
                  ) : activeGroups.map(g => {
                    const gColor = {'A':'#2980b9','B':'#1a7a4a','C':'#b7770d','D':'#c0392b'}[g] || '#333';
                    const gBg   = {'A':'#eaf1f8','B':'#eaf8f0','C':'#fef9e7','D':'#fdecea'}[g] || 'white';
                    const rate  = agentGroupRates[g] ?? '0.5';
                    const amt   = Math.round(groupLandAmts[g] * (parseFloat(rate)||0) / 100);
                    return (
                      <div key={g} style={{ display:'flex', alignItems:'center', gap:'4px', backgroundColor:gBg, borderRadius:'4px', padding:'3px 6px' }}>
                        <span style={{ fontSize:'11px', fontWeight:'bold', color:gColor, minWidth:'30px' }}>{g}그룹</span>
                        <input value={rate}
                          onChange={e => update('agentGroupRates', { ...agentGroupRates, [g]: e.target.value })}
                          style={{ width:'50px', padding:'3px 6px', border:'1px solid #ddd', borderRadius:'3px', fontSize:'11px', textAlign:'right' }} />
                        <span style={{ fontSize:'11px', color:'#888' }}>%</span>
                        <span style={{ fontSize:'11px', color:'#aaa', marginLeft:'2px' }}>× {formatNumber(groupLandAmts[g])}천</span>
                        <span style={{ fontSize:'11px', color:gColor, fontWeight:'bold', marginLeft:'4px' }}>= {(Math.round(groupLandAmts[g] * (parseFloat(rate)||0) / 100)).toLocaleString('ko-KR')} 천</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                numInput(d.agentDirect, v => update('agentDirect', v), '금액 입력')
              )}
            </td>
            {(() => { const vc = vatCell(agentAmt, !!d.agent_taxable); return <td style={tdStyle}>{vc.cell}</td>; })()}
            <td style={tdStyle}>
              <FundingCell
                funding={d.agent_funding || { equity: '0', pf: '100', sale: '0' }}
                onChange={v => updateFunding('agent', v)}
                totalAmt={!!d.agent_taxable ? Math.round(agentAmt*1.1) : agentAmt}
              />
            </td>
          </tr>

          {/* ⑤ 기타 토지비용 (동적) */}
          {etcItems.map((it, i) => (
            <tr key={i} style={{ backgroundColor: i % 2 === 0 ? 'white' : '#fafafa' }}>
              <td style={tdStyle}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <input
                    value={it.name}
                    onChange={e => updateEtc(i, 'name', e.target.value)}
                    placeholder={`기타항목 ${i + 1}`}
                    style={{ flex: 1, padding: '5px 8px', border: '1px solid #ddd', borderRadius: '3px', fontSize: '12px' }}
                  />
                  <button onClick={() => removeEtc(i)}
                    style={{ padding: '3px 7px', backgroundColor: '#e74c3c', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer', fontSize: '11px' }}>
                    ✕
                  </button>
                </div>
                <TaxBadge checked={!!it.taxable} onChange={v => updateEtc(i, 'taxable', v)} />
              </td>
              <td style={{ ...tdStyle, textAlign: 'center' }}>
                <span style={{ fontSize: '11px', color: '#888' }}>직접입력</span>
              </td>
              <td style={tdStyle}>
                {numInput(it.amt, v => updateEtc(i, 'amt', v), '금액 입력')}
              </td>
              <td style={tdStyle}>{roCell(formatNumber(parseFloat(parseNumber(it.amt)) || 0))}</td>
              <td style={tdStyle}>
                <FundingCell
                  funding={it.funding || { equity: '0', pf: '100', sale: '0' }}
                  onChange={v => updateEtc(i, 'funding', v)}
                  totalAmt={!!it.taxable ? Math.round((parseFloat(parseNumber(it.amt))||0)*1.1) : (parseFloat(parseNumber(it.amt))||0)}
                />
              </td>
            </tr>
          ))}

          {/* 기타 추가 버튼 행 */}
          <tr>
            <td colSpan={5} style={{ padding: '8px' }}>
              <button onClick={addEtc}
                style={{
                  padding: '6px 14px', backgroundColor: '#ecf0f1',
                  border: '1px dashed #bbb', borderRadius: '4px',
                  cursor: 'pointer', fontSize: '12px', color: '#555',
                }}>
                + 기타 토지비용 추가
              </button>
            </td>
          </tr>
        </tbody>

        {/* 합계 */}
        <tfoot>
          <tr style={{ backgroundColor: '#c0392b' }}>
            <td colSpan={3} style={{ padding: '8px 12px', color: 'white', fontWeight: 'bold', fontSize: '13px' }}>
              토지관련비용 합계
            </td>
            <td style={{ padding: '8px 12px', color: 'white', fontWeight: 'bold', fontSize: '14px', textAlign: 'right' }}>
              {formatNumber(total)} 천원
              {vatTotal > 0 && <div style={{ fontSize:'11px', color:'#f39c12', marginTop:'2px' }}>VAT {formatNumber(vatTotal)} 천원 / 합계 {formatNumber(total+vatTotal)} 천원</div>}
            </td>
            <td style={{ padding: '8px 12px' }}>
              {/* 재원별 소계 */}
              {(() => {
                const rows = [
                  { funding: d.land_funding,  amt: landAmt },
                  { funding: d.acq_funding,   amt: acqAmt },
                  { funding: d.legal_funding, amt: legalAmt },
                  { funding: d.agent_funding, amt: agentAmt },
                  ...etcItems.map(it => ({ funding: it.funding, amt: parseFloat(parseNumber(it.amt)) || 0 })),
                ];
                const summary = { equity: 0, pf: 0, sale: 0 };
                rows.forEach(({ funding: f, amt }) => {
                  const ff = f || { equity: '0', pf: '100', sale: '0' };
                  FUNDING_KEYS.forEach(k => {
                    summary[k] += amt * (parseFloat(ff[k]) || 0) / 100;
                  });
                });
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    {FUNDING_KEYS.filter(k => summary[k] > 0).map(k => {
                      const c = FUNDING_COLORS[k];
                      return (
                        <span key={k} style={{
                          fontSize: '11px', padding: '2px 7px', borderRadius: '8px',
                          backgroundColor: c.bg, color: c.color,
                          border: `1px solid ${c.border}`, fontWeight: 'bold',
                        }}>
                          {FUNDING_LABELS[k]} {formatNumber(Math.round(summary[k]))}
                        </span>
                      );
                    })}
                  </div>
                );
              })()}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

// ─────────────────────────────────────────────
// 재원 소계 계산 헬퍼 (합계탭에서 사용)
// ─────────────────────────────────────────────
const calcFundingSummary = (rows) => {
  const summary = { equity: 0, pf: 0, sale: 0 };
  rows.forEach(({ funding: f, amt }) => {
    const ff = f || { equity: '0', pf: '100', sale: '0' };
    FUNDING_KEYS.forEach(k => { summary[k] += amt * (parseFloat(ff[k]) || 0) / 100; });
  });
  return summary;
};

// ─────────────────────────────────────────────
// ㎡/평 단위 토글 버튼
// ─────────────────────────────────────────────
function UnitToggle({ unit, setUnit }) {
  return (
    <div style={{ display: 'flex', gap: '2px', backgroundColor: '#f0f0f0', borderRadius: '5px', padding: '2px' }}>
      {['㎡', '평'].map(u => (
        <button key={u} onClick={() => setUnit(u)}
          style={{
            padding: '2px 10px', border: 'none', borderRadius: '4px',
            cursor: 'pointer', fontSize: '11px', fontWeight: 'bold',
            backgroundColor: unit === u ? '#2980b9' : 'transparent',
            color: unit === u ? 'white' : '#666',
          }}>
          {u}
        </button>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────
// 직접공사비 섹션
// ─────────────────────────────────────────────
function DirectCostSection({ data, onChange, archData }) {
  const d = data || {};
  const update = (key, val) => onChange({ ...d, [key]: val });

  const updateFunding = (key, val) => onChange({ ...d, [`${key}_funding`]: val });

  // 건축개요에서 전체연면적 자동연동
  const aboveM2 = parseFloat(parseNumber(archData?.floorAboveM2)) || 0;
  const underM2 = parseFloat(parseNumber(archData?.floorUnderM2)) || 0;
  const totalFloorM2 = aboveM2 + underM2;
  const totalFloorPy = totalFloorM2 * 0.3025;

  // ── ㎡/평 단위 (건축공사비, 기본값 평) ──
  const constUnit    = d.constUnit || '평';
  const setConstUnit = (u) => update('constUnit', u);

  // ── 건축공사비 계산 — 선택 단위 기준 면적 × 단가 ──
  const constUnitRaw  = parseFloat(parseNumber(d.constUnitPrice)) || 0;
  const areaForConst  = constUnit === '평' ? totalFloorPy : totalFloorM2;
  const calcConst     = Math.round(constUnitRaw * areaForConst);
  const overrideAmt   = parseFloat(parseNumber(d.constOverride));
  const constAmt      = overrideAmt > 0 ? overrideAmt : calcConst;
  // 참고용 반대 단위 환산
  const constUnitInM2 = constUnit === '평' ? (constUnitRaw / 0.3025) : constUnitRaw;
  const constUnitInPy = constUnit === '㎡' ? (constUnitRaw * 0.3025) : constUnitRaw;

  // ── 기타 직접공사비 ──
  const etcItems = d.etcItems || [];
  const etcTotal = etcItems.reduce((s, it) => s + (parseFloat(parseNumber(it.amt)) || 0), 0);

  // ── 합계 ──
  const total = constAmt + etcTotal;
  const vatTotal = Math.round((!!d.const_taxable ? constAmt * 0.1 : 0) +
    etcItems.reduce((s,it) => s + (!!it.taxable ? (parseFloat(parseNumber(it.amt))||0)*0.1 : 0), 0));

  const tdStyle    = { padding: '6px 8px', borderBottom: '1px solid #eee', verticalAlign: 'middle' };
  const labelStyle = { fontWeight: 'bold', fontSize: '13px', color: '#2c3e50' };

  const addEtc    = () => update('etcItems', [...etcItems, { name: '', amt: '', funding: { equity: '0', pf: '100', sale: '0' } }]);
  const removeEtc = (i) => update('etcItems', etcItems.filter((_, idx) => idx !== i));
  const updateEtc = (i, key, val) => update('etcItems', etcItems.map((it, idx) => idx === i ? { ...it, [key]: val } : it));

  return (
    <div>
      {sectionTitle('직접공사비')}

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
        <thead>
          <tr>
            {colHeader('항목', '160px', 'left')}
            {colHeader('근거기준', '160px')}
            {colHeader('단가 (천원)', '160px')}
            {colHeader('금액 (천원)', '160px')}
            {colHeader('재원조달', '140px')}
          </tr>
        </thead>
        <tbody>

          {/* ① 건축공사비 */}
          <tr style={{ backgroundColor: 'white' }}>
            <td style={tdStyle}>
              <span style={labelStyle}>① 건축공사비</span>
              <TaxBadge checked={!!d.const_taxable} onChange={v => update('const_taxable', v)} />
            </td>
            <td style={tdStyle}>
              <div style={{ fontSize: '11px', color: '#888', marginBottom: '3px' }}>
                📐 전체연면적 = 지상연면적 + 지하연면적
                <span style={{ fontSize: '10px', color: '#aaa', marginLeft: '4px' }}>(건축개요 자동연동)</span>
              </div>
              <div style={{ display: 'flex', gap: '6px', fontSize: '12px', color: '#888', alignItems: 'center' }}>
                <span>{formatNumber(aboveM2.toFixed(0))}㎡ (지상)</span>
                <span style={{ color: '#ccc' }}>+</span>
                <span>{formatNumber(underM2.toFixed(0))}㎡ (지하)</span>
              </div>
              <div style={{ fontSize: '13px', color: '#2980b9', marginTop: '3px', fontWeight: 'bold' }}>
                = {formatNumber(totalFloorM2.toFixed(0))}㎡ ({formatNumber(totalFloorPy.toFixed(2))}평)
              </div>
            </td>
            <td style={tdStyle}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  {numInput(d.constUnitPrice, v => update('constUnitPrice', v), `단가`)}
                  <UnitToggle unit={constUnit} setUnit={setConstUnit} />
                </div>
                <div style={{ fontSize: '10px', color: '#888' }}>
                  {constUnit === '평'
                    ? `≈ ${formatNumber(constUnitInM2.toFixed(0))} 천원/㎡`
                    : totalFloorPy > 0 ? `≈ ${formatNumber(constUnitInPy.toFixed(0))} 천원/평` : ''}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <input
                    value={d.constOverride || ''}
                    onChange={e => update('constOverride', formatNumber(parseNumber(e.target.value)))}
                    placeholder="총액 직접입력"
                    style={{
                      flex: 1, padding: '4px 8px',
                      border: `1px solid ${d.constOverride ? '#e74c3c' : '#ddd'}`,
                      borderRadius: '3px', fontSize: '11px', textAlign: 'right',
                      backgroundColor: d.constOverride ? '#fdf2f0' : 'white',
                    }}
                  />
                  {d.constOverride && (
                    <button onClick={() => update('constOverride', '')}
                      style={{ padding: '3px 6px', fontSize: '11px', backgroundColor: '#e74c3c', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer' }}>
                      ✕
                    </button>
                  )}
                </div>
                {d.constOverride && (
                  <div style={{ fontSize: '10px', color: '#e74c3c' }}>⚠ 총액 직접입력 적용 중</div>
                )}
              </div>
            </td>
            {(() => { const vc = vatCell(constAmt, !!d.const_taxable); return (<>
              <td style={tdStyle}>{vc.cell}</td>
              <td style={tdStyle}>
                <FundingCell
                  funding={d.const_funding || { equity: '0', pf: '100', sale: '0' }}
                  onChange={v => updateFunding('const', v)}
                  totalAmt={vc.totalAmt}
                />
              </td>
            </>); })()}
          </tr>

          {/* ② 기타 직접공사비 (동적) */}
          {etcItems.map((it, i) => (
            <tr key={i} style={{ backgroundColor: i % 2 === 0 ? '#fafafa' : 'white' }}>
              <td style={tdStyle}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <input
                    value={it.name}
                    onChange={e => updateEtc(i, 'name', e.target.value)}
                    placeholder={`기타항목 ${i + 1}`}
                    style={{ flex: 1, padding: '5px 8px', border: '1px solid #ddd', borderRadius: '3px', fontSize: '12px' }}
                  />
                  <button onClick={() => removeEtc(i)}
                    style={{ padding: '3px 7px', backgroundColor: '#e74c3c', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer', fontSize: '11px' }}>
                    ✕
                  </button>
                </div>
                <TaxBadge checked={!!it.taxable} onChange={v => updateEtc(i, 'taxable', v)} />
              </td>
              <td style={{ ...tdStyle, textAlign: 'center' }}>
                <span style={{ fontSize: '11px', color: '#888' }}>—</span>
              </td>
              <td style={{ ...tdStyle, textAlign: 'center' }}>
                <span style={{ fontSize: '11px', color: '#888' }}>직접입력</span>
              </td>
              <td style={tdStyle}>
                {numInput(it.amt, v => updateEtc(i, 'amt', v), '금액 입력')}
              </td>
              <td style={tdStyle}>
                <FundingCell
                  funding={it.funding || { equity: '0', pf: '100', sale: '0' }}
                  onChange={v => updateEtc(i, 'funding', v)}
                  totalAmt={!!it.taxable ? Math.round((parseFloat(parseNumber(it.amt))||0)*1.1) : (parseFloat(parseNumber(it.amt))||0)}
                />
              </td>
            </tr>
          ))}

          {/* 추가 버튼 */}
          <tr>
            <td colSpan={5} style={{ padding: '8px' }}>
              <button onClick={addEtc}
                style={{
                  padding: '6px 14px', backgroundColor: '#ecf0f1',
                  border: '1px dashed #bbb', borderRadius: '4px',
                  cursor: 'pointer', fontSize: '12px', color: '#555',
                }}>
                + 기타 직접공사비 추가
              </button>
            </td>
          </tr>
        </tbody>

        {/* 합계 */}
        <tfoot>
          <tr style={{ backgroundColor: '#1a6a99' }}>
            <td colSpan={3} style={{ padding: '8px 12px', color: 'white', fontWeight: 'bold', fontSize: '13px' }}>
              직접공사비 합계
              <span style={{ fontSize: '11px', fontWeight: 'normal', marginLeft: '12px', opacity: 0.8 }}>
                (건축공사비 {formatNumber(constAmt)} 천원 기준)
              </span>
            </td>
            <td style={{ padding: '8px 12px', color: 'white', fontWeight: 'bold', fontSize: '14px', textAlign: 'right' }}>
              {formatNumber(total)} 천원
              {vatTotal > 0 && <div style={{ fontSize:'11px', color:'#e67e22', marginTop:'2px' }}>VAT {formatNumber(vatTotal)} 천원 / 합계 {formatNumber(total+vatTotal)} 천원</div>}
            </td>
            <td style={{ padding: '8px 12px' }}>
              {(() => {
                const rows = [
                  { funding: d.const_funding, amt: constAmt },
                  ...etcItems.map(it => ({ funding: it.funding, amt: parseFloat(parseNumber(it.amt)) || 0 })),
                ];
                const summary = { equity: 0, pf: 0, sale: 0 };
                rows.forEach(({ funding: f, amt }) => {
                  const ff = f || { equity: '0', pf: '100', sale: '0' };
                  FUNDING_KEYS.forEach(k => { summary[k] += amt * (parseFloat(ff[k]) || 0) / 100; });
                });
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    {FUNDING_KEYS.filter(k => summary[k] > 0).map(k => {
                      const c = FUNDING_COLORS[k];
                      return (
                        <span key={k} style={{
                          fontSize: '11px', padding: '2px 7px', borderRadius: '8px',
                          backgroundColor: c.bg, color: c.color,
                          border: `1px solid ${c.border}`, fontWeight: 'bold',
                        }}>
                          {FUNDING_LABELS[k]} {formatNumber(Math.round(summary[k]))}
                        </span>
                      );
                    })}
                  </div>
                );
              })()}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

// ─────────────────────────────────────────────
// 공통 면적/단가 계산 헬퍼 (간접공사비 항목용)
// ─────────────────────────────────────────────
const calcAreaAmt = (unitPrice, unit, areaM2) => {
  const price = parseFloat(String(unitPrice).replace(/,/g, '')) || 0;
  const area  = unit === '평' ? areaM2 * 0.3025 : areaM2;
  return Math.round(price * area);
};

// ─────────────────────────────────────────────
// 미술작품설치비 계산기 모달
// ─────────────────────────────────────────────
function ArtInstallModal({ onClose, onApply, archData, incomeData, settingsData, data, onChange }) {
  const d = data || {};
  const update = (key, val) => onChange({ ...d, [key]: val });

  // ── STEP 1: 표준건축비 ──
  const stdCostItems = settingsData?.stdCosts || [];
  const latestStdCost = stdCostItems.length > 0
    ? stdCostItems.reduce((a, b) => (parseInt(a.year) > parseInt(b.year) ? a : b))
    : { year: '2026', cost: '2392000', note: '국토부 고시' };
  const selectedYear = d.stdCostYear || latestStdCost.year;
  const selectedStd  = stdCostItems.find(s => s.year === selectedYear) || latestStdCost;
  const stdCost      = parseFloat(String(selectedStd?.cost || '2392000').replace(/,/g, '')) || 0;

  // ── artRateItems (기준정보에서 가져오기) ──
  const artRateItems   = settingsData?.artRates || [
    { region: '부산광역시', ordinance: '부산광역시 건축물 미술작품 설치 및 관리에 관한 조례 제5조', residRate: '0.1', nonResidRate1: '0.5', nonResidRate2: '0.5' },
    { region: '서울특별시', ordinance: '서울특별시 공공미술의 설치 및 관리에 관한 조례 제25조 + 시행령 별표2 나목', residRate: '0.1', nonResidRate1: '0.7', nonResidRate2: '0.5' },
  ];
  const selectedArtRate = artRateItems.find(r => r.region === (d.region || artRateItems[0]?.region)) || artRateItems[0];

  // ── STEP 3 요율 (선택된 지역 기준) ──
  const residRate     = parseFloat(d.residRate     ?? selectedArtRate?.residRate     ?? '0.1') || 0;
  const nonResidRate1 = parseFloat(d.nonResidRate1 ?? selectedArtRate?.nonResidRate1 ?? '0.7') || 0;
  const nonResidRate2 = parseFloat(d.nonResidRate2 ?? selectedArtRate?.nonResidRate2 ?? '0.5') || 0;

  // ── STEP 2: 면적 ──
  const aboveM2 = parseFloat(String(archData?.floorAboveM2 || '').replace(/,/g, '')) || 0;

  // 주거면적 = 공동주택 공급㎡×세대 + 오피스텔 공급㎡×세대
  const aptRows    = incomeData?.aptRows    || [];
  const offiRows   = incomeData?.offiRows   || [];
  const publicRows = incomeData?.publicRows || [];  // 공공주택 — 면제
  const pubfacRows = incomeData?.pubfacRows || [];  // 공공시설 — 면제

  const calcSupM2 = (rows) => rows.reduce((s, r) => {
    const excl  = parseFloat(String(r.excl_m2||'').replace(/,/g,''))||0;
    const wall  = parseFloat(String(r.wall_m2||'').replace(/,/g,''))||0;
    const core  = parseFloat(String(r.core_m2||'').replace(/,/g,''))||0;
    const units = parseFloat(String(r.units||'').replace(/,/g,''))||0;
    return s + (excl + wall + core) * units;
  }, 0);

  const aptResidM2  = calcSupM2(aptRows);
  const offiResidM2 = calcSupM2(offiRows);
  const publicM2    = calcSupM2(publicRows);  // 공공주택 공급면적 합계
  const pubfacM2    = calcSupM2(pubfacRows);  // 공공시설 공급면적 합계
  const residM2     = aptResidM2 + offiResidM2;
  // 과세대상 비주거 = 지상연면적 - 주거 - 공공주택 - 공공시설
  const taxNonResidM2 = Math.max(0, aboveM2 - residM2 - publicM2 - pubfacM2);
  const residRatio    = aboveM2 > 0 ? (residM2 / aboveM2 * 100).toFixed(1) : '0.0';

  // ── STEP 4: 계산결과 (시행령 나목 누진 구조) ──
  const residAmt = Math.round(residM2 * stdCost * residRate / 100 / 1000);
  const THRESHOLD1 = 10000; // 1만㎡ 미만 면제
  const THRESHOLD2 = 20000; // 2만㎡ 초과분 누진
  let nonResidAmt = 0;
  let nonResidCalcNote = '';
  if (taxNonResidM2 < THRESHOLD1) {
    nonResidAmt = 0;
    nonResidCalcNote = `${formatNumber(taxNonResidM2.toFixed(2))}㎡ < 1만㎡ → 면제`;
  } else if (taxNonResidM2 <= THRESHOLD2) {
    nonResidAmt = Math.round(taxNonResidM2 * stdCost * nonResidRate1 / 100 / 1000);
    nonResidCalcNote = `${formatNumber(taxNonResidM2.toFixed(2))}㎡ × ${formatNumber(stdCost)}원 × ${nonResidRate1}% ÷ 1,000`;
  } else {
    const amt1 = Math.round(THRESHOLD2 * stdCost * nonResidRate1 / 100 / 1000);
    const amt2 = Math.round((taxNonResidM2 - THRESHOLD2) * stdCost * nonResidRate2 / 100 / 1000);
    nonResidAmt = amt1 + amt2;
    nonResidCalcNote = `(20,000㎡ × ${nonResidRate1}%) + (${formatNumber((taxNonResidM2-THRESHOLD2).toFixed(2))}㎡ × ${nonResidRate2}%)`;
  }
  const totalAmt = residAmt + nonResidAmt;

  // 스타일
  const boxStyle = {
    border: '1px solid #e0e0e0', borderRadius: '8px',
    padding: '16px 20px', marginBottom: '16px',
  };
  const stepHeader = (step, title, color = '#2c3e50') => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
      <span style={{
        backgroundColor: color, color: 'white',
        borderRadius: '50%', width: '24px', height: '24px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '12px', fontWeight: 'bold', flexShrink: 0,
      }}>{step}</span>
      <span style={{ fontWeight: 'bold', fontSize: '14px', color }}>{title}</span>
    </div>
  );
  const formula = (text) => (
    <div style={{
      backgroundColor: '#f8f9fa', border: '1px solid #e9ecef',
      borderRadius: '4px', padding: '8px 12px',
      fontFamily: 'monospace', fontSize: '12px', color: '#495057',
      margin: '8px 0',
    }}>{text}</div>
  );
  const calcRow = (label, val, highlight = false) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 0', borderBottom: '1px solid #f0f0f0' }}>
      <span style={{ fontSize: '12px', color: '#555' }}>{label}</span>
      <span style={{ fontSize: highlight ? '14px' : '13px', fontWeight: highlight ? 'bold' : 'normal', color: highlight ? '#e74c3c' : '#2c3e50' }}>
        {val}
      </span>
    </div>
  );

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
      backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 2000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        backgroundColor: 'white', borderRadius: '10px',
        width: '92%', maxWidth: '680px', maxHeight: '90vh',
        overflowY: 'auto', padding: '24px',
      }}>
        {/* 모달 헤더 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <h3 style={{ margin: 0, color: '#2c3e50' }}>미술작품설치비 계산기</h3>
            <div style={{ fontSize: '12px', color: '#888', marginTop: '3px' }}>단계별 계산식 확인 후 사업비에 반영하세요</div>
          </div>
          <button onClick={onClose}
            style={{ padding: '6px 14px', border: '1px solid #ddd', borderRadius: '6px', cursor: 'pointer', backgroundColor: 'white', fontSize: '13px' }}>
            ✕ 닫기
          </button>
        </div>

        {/* 근거법령 박스 */}
        <div style={{ ...boxStyle, backgroundColor: '#fff8e1', borderColor: '#ffe082' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <span style={{ fontSize: '16px' }}>📋</span>
            <span style={{ fontWeight: 'bold', fontSize: '13px', color: '#e65100' }}>근거법령</span>
          </div>
          <div style={{ fontSize: '13px', color: '#5d4037', fontWeight: 'bold', marginBottom: '6px' }}>
            문화예술진흥법 시행령 제12조 (건축물에 대한 미술작품의 설치)
          </div>
          {formula('설치비 = (주거 연면적 × 표준건축비 × 주거요율) + (비주거 연면적 × 표준건축비 × 비주거요율)')}
          <div style={{ fontSize: '11px', color: '#888', marginTop: '6px' }}>
            ※ 면적은 <strong>지상면적만</strong> 적용 (지하면적 제외)<br/>
            ※ 표준건축비는 <strong>과밀부담금 산정용</strong> 표준건축비 적용 (일반 표준건축비와 다름)<br/>
            ※ 요율은 지자체 조례로 별도 정함 (부산시: 주거 0.1%, 비주거 0.5%)
          </div>
        </div>

        {/* STEP 1: 표준건축비 */}
        <div style={boxStyle}>
          {stepHeader('1', '표준건축비 (과밀부담금 산정용)', '#1565c0')}
          <div style={{ fontSize: '12px', color: '#888', marginBottom: '10px' }}>
            ※ 국토교통부 매년 고시 — 과밀부담금을 위한 표준건축비 적용 (일반 표준건축비와 다름)
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <label style={{ fontSize: '13px', fontWeight: 'bold', color: '#333', whiteSpace: 'nowrap' }}>연도 선택</label>
            <select
              value={selectedYear}
              onChange={e => update('stdCostYear', e.target.value)}
              style={{ padding: '6px 10px', border: '1px solid #1565c0', borderRadius: '4px', fontSize: '13px', color: '#1565c0', fontWeight: 'bold' }}
            >
              {stdCostItems.map(s => (
                <option key={s.year} value={s.year}>{s.year}년</option>
              ))}
            </select>
            <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#1565c0' }}>
              {formatNumber(stdCost)} 원/㎡
            </div>
            <div style={{ fontSize: '11px', color: '#888' }}>{selectedStd?.note}</div>
          </div>
          <div style={{ fontSize: '11px', color: '#888', marginTop: '8px' }}>
            💡 연도별 표준건축비는 사업비 탭 상단 <strong>⚙ 기준정보</strong>에서 관리하세요
          </div>
        </div>

        {/* STEP 2: 면적 구분 */}
        <div style={boxStyle}>
          {stepHeader('2', '면적 구분 (지상면적 기준)', '#2e7d32')}
          <div style={{ fontSize: '12px', color: '#888', marginBottom: '10px' }}>
            ※ 건축개요 + 수입탭 데이터 자동연동
          </div>

          {/* 지상연면적 */}
          {calcRow('지상연면적 (건축개요 자동연동)', `${formatNumber(aboveM2.toFixed(2))} ㎡`)}

          {/* 주거면적 */}
          <div style={{ backgroundColor: '#e8f5e9', borderRadius: '6px', padding: '10px 12px', margin: '8px 0' }}>
            <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#2e7d32', marginBottom: '6px' }}>
              주거면적 = 공동주택 공급㎡×세대 + 오피스텔 공급㎡×세대
            </div>
            {aptRows.length > 0 && (
              <div style={{ fontSize: '11px', color: '#555', marginBottom: '4px' }}>
                <strong>공동주택(apt):</strong>
                {aptRows.map((r, i) => {
                  const sup = (parseFloat(String(r.excl_m2||'').replace(/,/g,''))||0)
                            + (parseFloat(String(r.wall_m2||'').replace(/,/g,''))||0)
                            + (parseFloat(String(r.core_m2||'').replace(/,/g,''))||0);
                  const units = parseFloat(String(r.units||'').replace(/,/g,''))||0;
                  return (
                    <span key={i} style={{ marginLeft: '8px' }}>
                      {r.type||`타입${i+1}`}: {sup.toFixed(2)}㎡ × {units}세대 = {formatNumber((sup*units).toFixed(2))}㎡
                    </span>
                  );
                })}
              </div>
            )}
            {offiRows.length > 0 && (
              <div style={{ fontSize: '11px', color: '#555', marginBottom: '4px' }}>
                <strong>오피스텔(offi):</strong>
                {offiRows.map((r, i) => {
                  const sup = (parseFloat(String(r.excl_m2||'').replace(/,/g,''))||0)
                            + (parseFloat(String(r.wall_m2||'').replace(/,/g,''))||0)
                            + (parseFloat(String(r.core_m2||'').replace(/,/g,''))||0);
                  const units = parseFloat(String(r.units||'').replace(/,/g,''))||0;
                  return (
                    <span key={i} style={{ marginLeft: '8px' }}>
                      {r.type||`타입${i+1}`}: {sup.toFixed(2)}㎡ × {units}세대 = {formatNumber((sup*units).toFixed(2))}㎡
                    </span>
                  );
                })}
              </div>
            )}
            <div style={{ borderTop: '1px solid #a5d6a7', paddingTop: '6px', marginTop: '4px' }}>
              {calcRow('주거면적 합계', `${formatNumber(residM2.toFixed(2))} ㎡ (${residRatio}%)`)}
            </div>
          </div>

          {/* 공공주택/공공시설 차감 */}
          {(publicM2 > 0 || pubfacM2 > 0) && (
            <div style={{ backgroundColor: '#e8f0fe', borderRadius: '6px', padding: '10px 12px', margin: '8px 0', border: '1px solid #c5cae9' }}>
              <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#1a237e', marginBottom: '6px' }}>
                ✂ 면제 면적 (공공기여 — 미술작품 부과 제외)
              </div>
              {publicM2 > 0 && calcRow(`공공주택 (${publicRows.length}개 타입)`, `${formatNumber(publicM2.toFixed(2))} ㎡`)}
              {pubfacM2 > 0 && calcRow(`공공시설 (${pubfacRows.length}개 타입)`, `${formatNumber(pubfacM2.toFixed(2))} ㎡`)}
              {calcRow('면제 합계', `${formatNumber((publicM2+pubfacM2).toFixed(2))} ㎡`, true)}
            </div>
          )}

          {/* 과세대상 비주거면적 */}
          <div style={{ backgroundColor: '#fce4ec', borderRadius: '6px', padding: '10px 12px', margin: '8px 0' }}>
            <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#c62828', marginBottom: '6px' }}>
              과세대상 비주거면적 = 지상연면적 - 주거 - 공공주택 - 공공시설
            </div>
            {formula(`${formatNumber(aboveM2.toFixed(2))} - ${formatNumber(residM2.toFixed(2))} - ${formatNumber(publicM2.toFixed(2))} - ${formatNumber(pubfacM2.toFixed(2))} = ${formatNumber(taxNonResidM2.toFixed(2))} ㎡`)}
            {taxNonResidM2 < 10000 && (
              <div style={{ marginTop: '6px', padding: '4px 8px', backgroundColor: '#fff3e0', borderRadius: '4px', fontSize: '11px', color: '#e65100', fontWeight: 'bold' }}>
                ⚠ 1만㎡ 미만 → 비주거 미술작품설치비 면제
              </div>
            )}
          </div>
        </div>

        {/* STEP 3: 요율 */}
        <div style={boxStyle}>
          {stepHeader('3', '적용 요율 (지자체 조례)', '#6a1b9a')}

          {/* 지역 선택 */}
          <div style={{ marginBottom: '14px' }}>
            <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '6px' }}>
              적용 지역 — 기준정보에 등록된 지역 자동 표시
            </label>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              <select
                value={d.region || (artRateItems[0]?.region || '직접입력')}
                onChange={e => {
                  const region = e.target.value;
                  const found = artRateItems.find(r => r.region === region);
                  if (found) onChange({ ...d, region, residRate: found.residRate, nonResidRate1: found.nonResidRate1, nonResidRate2: found.nonResidRate2 });
                  else onChange({ ...d, region, residRate: '', nonResidRate1: '', nonResidRate2: '' });
                }}
                style={{ padding: '6px 10px', border: '1px solid #6a1b9a', borderRadius: '4px', fontSize: '13px', color: '#6a1b9a', fontWeight: 'bold', cursor: 'pointer' }}
              >
                {artRateItems.map(r => (
                  <option key={r.region} value={r.region}>{r.region}</option>
                ))}
                <option value="직접입력">직접입력</option>
              </select>
              {selectedArtRate && (
                <span style={{ fontSize: '11px', color: '#7b1fa2' }}>
                  📄 {selectedArtRate.ordinance}
                </span>
              )}
            </div>
          </div>

          {/* STEP 1 표준건축비 연도 선택 (여기서도 보이게) */}
          <div style={{ marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '10px', backgroundColor: '#e8f4fc', padding: '8px 12px', borderRadius: '6px' }}>
            <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#1565c0' }}>🏗 적용 표준건축비</span>
            <select
              value={selectedYear}
              onChange={e => update('stdCostYear', e.target.value)}
              style={{ padding: '4px 8px', border: '1px solid #1565c0', borderRadius: '4px', fontSize: '12px', color: '#1565c0' }}
            >
              {stdCostItems.map(s => (
                <option key={s.year} value={s.year}>{s.year}년 — {formatNumber(s.cost)}원/㎡ ({s.note})</option>
              ))}
            </select>
          </div>

          {/* 요율 표시/입력 */}
          <div style={{ backgroundColor: '#f8f0fc', padding: '12px 16px', borderRadius: '6px', border: '1px solid #e1bee7' }}>
            <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', marginBottom: '8px' }}>
              {/* 주거요율 */}
              <div>
                <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#2e7d32', display: 'block', marginBottom: '4px' }}>주거요율</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <input value={d.residRate || selectedArtRate?.residRate || '0.1'}
                    onChange={e => update('residRate', e.target.value)}
                    readOnly={(d.region || '') !== '직접입력'}
                    style={{ width: '70px', padding: '5px 8px', border: '1px solid #2e7d32', borderRadius: '4px', fontSize: '13px', textAlign: 'right',
                      backgroundColor: (d.region||'')!=='직접입력'?'#e8f5e9':'white', color: '#2e7d32', fontWeight: 'bold' }} />
                  <span style={{ fontSize: '12px', color: '#888' }}>%</span>
                </div>
              </div>
              {/* 비주거 1구간 */}
              <div>
                <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#6a1b9a', display: 'block', marginBottom: '4px' }}>
                  비주거 1구간 (1만~2만㎡)
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <input value={d.nonResidRate1 || selectedArtRate?.nonResidRate1 || '0.7'}
                    onChange={e => update('nonResidRate1', e.target.value)}
                    readOnly={(d.region || '') !== '직접입력'}
                    style={{ width: '70px', padding: '5px 8px', border: '1px solid #6a1b9a', borderRadius: '4px', fontSize: '13px', textAlign: 'right',
                      backgroundColor: (d.region||'')!=='직접입력'?'#ede7f6':'white', color: '#6a1b9a', fontWeight: 'bold' }} />
                  <span style={{ fontSize: '12px', color: '#888' }}>%</span>
                </div>
              </div>
              {/* 비주거 2구간 */}
              <div>
                <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#c62828', display: 'block', marginBottom: '4px' }}>
                  비주거 2구간 (2만㎡ 초과분)
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <input value={d.nonResidRate2 || selectedArtRate?.nonResidRate2 || '0.5'}
                    onChange={e => update('nonResidRate2', e.target.value)}
                    readOnly={(d.region || '') !== '직접입력'}
                    style={{ width: '70px', padding: '5px 8px', border: '1px solid #c62828', borderRadius: '4px', fontSize: '13px', textAlign: 'right',
                      backgroundColor: (d.region||'')!=='직접입력'?'#fce4ec':'white', color: '#c62828', fontWeight: 'bold' }} />
                  <span style={{ fontSize: '12px', color: '#888' }}>%</span>
                </div>
              </div>
            </div>
            {(d.region || '') !== '직접입력' && (
              <div style={{ fontSize: '11px', color: '#888' }}>
                ※ 기준정보에서 관리 (수정하려면 "직접입력" 선택)
              </div>
            )}
          </div>
        </div>

        {/* STEP 4: 계산결과 */}
        <div style={{ ...boxStyle, borderColor: '#e74c3c', backgroundColor: '#fff5f5' }}>
          {stepHeader('4', '계산 결과', '#c62828')}

          <div style={{ marginBottom: '12px' }}>
            <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#2e7d32', marginBottom: '4px' }}>주거분</div>
            {formula(`${formatNumber(residM2.toFixed(2))}㎡ × ${formatNumber(stdCost)}원 × ${residRate}% ÷ 1,000 = ${formatNumber(residAmt)} 천원`)}
          </div>

          <div style={{ marginBottom: '12px' }}>
            <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#c62828', marginBottom: '4px' }}>
              비주거분 (과세대상: {formatNumber(taxNonResidM2.toFixed(2))}㎡)
            </div>
            {taxNonResidM2 < 10000 ? (
              <div style={{ padding: '8px 12px', backgroundColor: '#fff3e0', borderRadius: '4px', fontSize: '12px', color: '#e65100', fontWeight: 'bold' }}>
                ⚠ 1만㎡ 미만 → 면제 (0 천원)
              </div>
            ) : taxNonResidM2 <= 20000 ? (
              formula(`${formatNumber(taxNonResidM2.toFixed(2))}㎡ × ${formatNumber(stdCost)}원 × ${nonResidRate1}% ÷ 1,000 = ${formatNumber(nonResidAmt)} 천원`)
            ) : (
              <div>
                {formula(`2만㎡ × ${formatNumber(stdCost)}원 × ${nonResidRate1}% ÷ 1,000 = ${formatNumber(Math.round(20000*stdCost*nonResidRate1/100/1000))} 천원`)}
                {formula(`${formatNumber((taxNonResidM2-20000).toFixed(2))}㎡(초과분) × ${formatNumber(stdCost)}원 × ${nonResidRate2}% ÷ 1,000 = ${formatNumber(Math.round((taxNonResidM2-20000)*stdCost*nonResidRate2/100/1000))} 천원`)}
                <div style={{ textAlign: 'right', fontSize: '12px', color: '#c62828', fontWeight: 'bold', marginTop: '4px' }}>
                  합계: {formatNumber(nonResidAmt)} 천원
                </div>
              </div>
            )}
          </div>

          <div style={{
            backgroundColor: '#c62828', color: 'white',
            borderRadius: '6px', padding: '12px 16px',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <span style={{ fontSize: '14px', fontWeight: 'bold' }}>총 합계</span>
            <span style={{ fontSize: '18px', fontWeight: 'bold' }}>{formatNumber(totalAmt)} 천원</span>
          </div>
        </div>

        {/* 사업비 반영 버튼 */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
          <button onClick={onClose}
            style={{ padding: '8px 20px', border: '1px solid #ddd', borderRadius: '6px', cursor: 'pointer', backgroundColor: 'white', fontSize: '13px' }}>
            취소
          </button>
          <button onClick={() => { onApply(totalAmt, d); onClose(); }}
            style={{ padding: '8px 24px', backgroundColor: '#27ae60', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }}>
            사업비 반영 ({formatNumber(totalAmt)} 천원)
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// 간접공사비 섹션
// ─────────────────────────────────────────────
function IndirectCostSection({ data, onChange, archData, directData, incomeData, settingsData }) {
  const [showArtModal, setShowArtModal] = useState(false);
  const d = data || {};
  const update = (key, val) => onChange({ ...d, [key]: val });
  const updateFunding = (key, val) => onChange({ ...d, [`${key}_funding`]: val });

  // 건축개요 면적 연동
  const plots       = archData?.plots || [];
  const landM2      = plots.reduce((s, p) => s + (parseFloat(String(p.areaM2).replace(/,/g, '')) || 0), 0);
  const farM2       = parseFloat(String(archData?.farAreaM2  || '').replace(/,/g, '')) || 0;
  const aboveM2     = parseFloat(String(archData?.floorAboveM2 || '').replace(/,/g, '')) || 0;
  const underM2     = parseFloat(String(archData?.floorUnderM2 || '').replace(/,/g, '')) || 0;
  const totalFloorM2 = aboveM2 + underM2;

  // 건축공사비 (직접공사비 탭에서 연동)
  const directConstUnit    = directData?.constUnit || '평';
  const directConstUnitRaw = parseFloat(String(directData?.constUnitPrice || '').replace(/,/g, '')) || 0;
  const directConstArea    = directConstUnit === '평' ? totalFloorM2 * 0.3025 : totalFloorM2;
  const directConstCalc    = Math.round(directConstUnitRaw * directConstArea);
  const directConstOv      = parseFloat(String(directData?.constOverride || '').replace(/,/g, '')) || 0;
  const constAmt           = directConstOv > 0 ? directConstOv : directConstCalc;

  // 각 항목 단위 (기본값 평)
  const permitUnit = d.permitUnit || '평';
  const demolUnit  = d.demolUnit  || '평';
  const utilUnit   = d.utilUnit   || '평';

  // 각 항목 계산
  const permitAmt = calcAreaAmt(d.permitPrice, permitUnit, farM2);
  const demolAmt  = calcAreaAmt(d.demolPrice,  demolUnit,  landM2);
  const utilAmt   = calcAreaAmt(d.utilPrice,   utilUnit,   totalFloorM2);

  // 미술작품설치비 (모달에서 반영된 값)
  const artAmt   = parseFloat(String(d.artAmt || '').replace(/,/g, '')) || 0;
  const artData  = d.artData || {};

  // 기타 항목
  const etcItems = d.etcItems || [];
  const etcTotal = etcItems.reduce((s, it) => s + (parseFloat(String(it.amt || '').replace(/,/g, '')) || 0), 0);

  const total = permitAmt + demolAmt + utilAmt + artAmt + etcTotal;
  const vatTotal = Math.round(
    (!!d.permit_taxable?permitAmt*0.1:0)+(!!d.demol_taxable?demolAmt*0.1:0)+
    (!!d.util_taxable?utilAmt*0.1:0)+(!!d.art_taxable?artAmt*0.1:0)+
    etcItems.reduce((s,it)=>s+(!!it.taxable?(parseFloat(String(it.amt||'').replace(/,/g,''))||0)*0.1:0),0));

  const tdStyle    = { padding: '6px 8px', borderBottom: '1px solid #eee', verticalAlign: 'middle' };
  const labelStyle = { fontWeight: 'bold', fontSize: '13px', color: '#2c3e50' };

  const addEtc    = () => update('etcItems', [...etcItems, { name: '', amt: '', funding: { equity: '0', pf: '100', sale: '0' } }]);
  const removeEtc = (i) => update('etcItems', etcItems.filter((_, idx) => idx !== i));
  const updateEtc = (i, key, val) => update('etcItems', etcItems.map((it, idx) => idx === i ? { ...it, [key]: val } : it));

  // 면적 표시 헬퍼
  const areaDisplay = (areaM2, unit) => {
    const py = areaM2 * 0.3025;
    return unit === '평'
      ? `${formatNumber(py.toFixed(2))}평 (${formatNumber(areaM2.toFixed(0))}㎡)`
      : `${formatNumber(areaM2.toFixed(0))}㎡ (${formatNumber(py.toFixed(2))}평)`;
  };

  // 공통 면적×단가 행 렌더러
  const renderAreaRow = (num, label, fundKey, areaM2, unitKey, priceKey, amt, bg, areaLabel, taxKey) => {
    const unit = d[unitKey] || '평';
    return (
      <tr style={{ backgroundColor: bg }}>
        <td style={tdStyle}>
          <span style={labelStyle}>{num} {label}</span>
          {taxKey && <TaxBadge checked={!!d[taxKey]} onChange={v => update(taxKey, v)} />}
        </td>
        <td style={tdStyle}>
          <div style={{ fontSize: '11px', color: '#888', marginBottom: '3px' }}>
            📐 {areaLabel}
            <span style={{ fontSize: '10px', color: '#aaa', marginLeft: '4px' }}>(건축개요 자동연동)</span>
          </div>
          <div style={{ fontSize: '13px', color: '#2980b9', fontWeight: 'bold' }}>
            {areaDisplay(areaM2, unit)}
          </div>
          <div style={{ fontSize: '10px', color: '#888', marginTop: '2px' }}>
            {unit === '평'
              ? `= ${formatNumber((areaM2 * 0.3025).toFixed(2))}평`
              : `= ${formatNumber(areaM2.toFixed(0))}㎡`}
          </div>
        </td>
        <td style={tdStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            {numInput(d[priceKey], v => update(priceKey, v), '단가')}
            <UnitToggle unit={unit} setUnit={u => update(unitKey, u)} />
          </div>
          <div style={{ fontSize: '10px', color: '#888', marginTop: '3px' }}>
            {unit === '평'
              ? `≈ ${formatNumber((parseFloat(String(d[priceKey]||'').replace(/,/g,''))||0) / 0.3025 < 1 ? 0 : ((parseFloat(String(d[priceKey]||'').replace(/,/g,''))||0) / 0.3025).toFixed(0))} 천원/㎡`
              : `≈ ${formatNumber(((parseFloat(String(d[priceKey]||'').replace(/,/g,''))||0) * 0.3025).toFixed(0))} 천원/평`}
          </div>
        </td>
        {(() => { const vc = vatCell(amt, !!d[taxKey]); return (<>
          <td style={tdStyle}>{vc.cell}</td>
          <td style={tdStyle}>
            <FundingCell
              funding={d[`${fundKey}_funding`] || { equity: '0', pf: '100', sale: '0' }}
              onChange={v => updateFunding(fundKey, v)}
              totalAmt={vc.totalAmt}
            />
          </td>
        </>); })()}
      </tr>
    );
  };

  return (
    <div>
      {sectionTitle('간접공사비')}

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
        <thead>
          <tr>
            {colHeader('항목', '160px', 'left')}
            {colHeader('근거기준', '170px')}
            {colHeader('단가 (천원)', '160px')}
            {colHeader('금액 (천원)', '150px')}
            {colHeader('재원조달', '140px')}
          </tr>
        </thead>
        <tbody>
          {renderAreaRow('①', '인허가조건공사비', 'permit', farM2,       'permitUnit', 'permitPrice', permitAmt, 'white',   '용적률산정면적 (건축개요 > 면적)', 'permit_taxable')}
          {renderAreaRow('②', '철거공사비',       'demol',  landM2,      'demolUnit',  'demolPrice',  demolAmt,  '#fafafa', '대지면적 (건축개요 > 토지조서 합계)', 'demol_taxable')}
          {renderAreaRow('③', '각종인입비',       'util',   totalFloorM2,'utilUnit',   'utilPrice',   utilAmt,   'white',   '전체연면적 = 지상연면적 + 지하연면적', 'util_taxable')}

          {/* ④ 미술작품설치비 */}
          {showArtModal && (
            <ArtInstallModal
              onClose={() => setShowArtModal(false)}
              onApply={(amt, artD) => { onChange({ ...d, artAmt: String(amt), artData: artD }); }}
              archData={archData}
              incomeData={incomeData}
              settingsData={settingsData || { stdCosts: [], artRates: [] }}
              data={artData}
              onChange={v => update('artData', v)}
            />
          )}
          <tr style={{ backgroundColor: '#fafafa' }}>
            <td style={tdStyle}>
              <span style={labelStyle}>④ 미술작품설치비</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', fontSize: '12px' }}>
                  <input type="checkbox"
                    checked={d.art_taxable === true || d.art_taxable === undefined ? false : d.art_taxable ?? false}
                    onChange={e => update('art_taxable', e.target.checked)}
                  />
                  <span style={{ color: d.art_taxable ? '#e74c3c' : '#888', fontWeight: d.art_taxable ? 'bold' : 'normal' }}>
                    과세
                  </span>
                </label>
              </div>
            </td>
            <td style={tdStyle}>
              <div style={{ fontSize: '11px', color: '#7b1fa2', fontWeight: 'bold', marginBottom: '3px' }}>
                📋 문화예술진흥법 시행령 제12조
              </div>
              <div style={{ fontSize: '11px', color: '#555' }}>
                주거: apt+offi 공급㎡×세대<br/>
                비주거: 지상연면적 - 주거
              </div>
              <div style={{ fontSize: '10px', color: '#888', marginTop: '2px' }}>수입탭 자동연동</div>
            </td>
            <td style={{ ...tdStyle, textAlign: 'center' }}>
              <button onClick={() => setShowArtModal(true)}
                style={{
                  padding: '5px 14px', backgroundColor: '#7b1fa2', color: 'white',
                  border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold',
                }}>
                🧮 계산기 열기
              </button>
            </td>
            <td style={tdStyle}>
              {artAmt > 0
                ? (vatCell(artAmt, !!d.art_taxable).cell)
                : <input readOnly value="—" style={{ width: '100%', padding: '5px 8px', border: '1px solid #eee', borderRadius: '3px', fontSize: '12px', textAlign: 'right', backgroundColor: '#f8f8f8', color: '#aaa' }} />
              }
            </td>
            <td style={tdStyle}>
              {artAmt > 0
                ? <FundingCell
                    funding={d.art_funding || { equity: '0', pf: '100', sale: '0' }}
                    onChange={v => updateFunding('art', v)}
                    totalAmt={!!d.art_taxable ? Math.round(artAmt*1.1) : artAmt}
                  />
                : <span style={{ fontSize: '11px', color: '#aaa' }}>계산 후 활성화</span>
              }
            </td>
          </tr>

          {/* ⑤ 기타 (동적) */}
          {etcItems.map((it, i) => (
            <tr key={i} style={{ backgroundColor: i % 2 === 0 ? 'white' : '#fafafa' }}>
              <td style={tdStyle}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <input value={it.name} onChange={e => updateEtc(i, 'name', e.target.value)}
                    placeholder={`기타항목 ${i + 1}`}
                    style={{ flex: 1, padding: '5px 8px', border: '1px solid #ddd', borderRadius: '3px', fontSize: '12px' }} />
                  <button onClick={() => removeEtc(i)}
                    style={{ padding: '3px 7px', backgroundColor: '#e74c3c', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer', fontSize: '11px' }}>✕</button>
                </div>
                <TaxBadge checked={!!it.taxable} onChange={v => updateEtc(i, 'taxable', v)} />
              </td>
              <td style={{ ...tdStyle, textAlign: 'center' }}><span style={{ fontSize: '11px', color: '#888' }}>—</span></td>
              <td style={{ ...tdStyle, textAlign: 'center' }}><span style={{ fontSize: '11px', color: '#888' }}>직접입력</span></td>
              <td style={tdStyle}>{numInput(it.amt, v => updateEtc(i, 'amt', v), '금액 입력')}</td>
              <td style={tdStyle}>
                <FundingCell
                  funding={it.funding || { equity: '0', pf: '100', sale: '0' }}
                  onChange={v => updateEtc(i, 'funding', v)}
                  totalAmt={!!it.taxable ? Math.round((parseFloat(String(it.amt||'').replace(/,/g,''))||0)*1.1) : (parseFloat(String(it.amt||'').replace(/,/g,''))||0)}
                />
              </td>
            </tr>
          ))}

          <tr>
            <td colSpan={5} style={{ padding: '8px' }}>
              <button onClick={addEtc}
                style={{ padding: '6px 14px', backgroundColor: '#ecf0f1', border: '1px dashed #bbb', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', color: '#555' }}>
                + 기타 간접공사비 추가
              </button>
            </td>
          </tr>
        </tbody>

        <tfoot>
          <tr style={{ backgroundColor: '#2e6da4' }}>
            <td colSpan={3} style={{ padding: '8px 12px', color: 'white', fontWeight: 'bold', fontSize: '13px' }}>
              간접공사비 합계
            </td>
            <td style={{ padding: '8px 12px', color: 'white', fontWeight: 'bold', fontSize: '14px', textAlign: 'right' }}>
              {formatNumber(total)} 천원
              {vatTotal > 0 && <div style={{ fontSize:'11px', color:'#e67e22', marginTop:'2px' }}>VAT {formatNumber(vatTotal)} 천원 / 합계 {formatNumber(total+vatTotal)} 천원</div>}
            </td>
            <td style={{ padding: '8px 12px' }}>
              {(() => {
                const rows = [
                  { funding: d.permit_funding, amt: permitAmt },
                  { funding: d.demol_funding,  amt: demolAmt  },
                  { funding: d.util_funding,   amt: utilAmt   },
                  { funding: d.art_funding,    amt: artAmt    },
                  ...etcItems.map(it => ({ funding: it.funding, amt: parseFloat(String(it.amt||'').replace(/,/g,'')) || 0 })),
                ];
                const summary = calcFundingSummary(rows);
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    {FUNDING_KEYS.filter(k => summary[k] > 0).map(k => {
                      const c = FUNDING_COLORS[k];
                      return (
                        <span key={k} style={{ fontSize: '11px', padding: '2px 7px', borderRadius: '8px', backgroundColor: c.bg, color: c.color, border: `1px solid ${c.border}`, fontWeight: 'bold' }}>
                          {FUNDING_LABELS[k]} {formatNumber(Math.round(summary[k]))}
                        </span>
                      );
                    })}
                  </div>
                );
              })()}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

// ─────────────────────────────────────────────
// 기준정보 관리 모달
// ─────────────────────────────────────────────
const SETTINGS_TABS = [
  { key: 'bondTab',    label: '국민주택채권',   icon: '🏦' },
  { key: 'progressTab', label: '공정율',        icon: '📊' },
  { key: 'artInstall', label: '미술작품설치비', icon: '🎨' },
  { key: 'vatCalc',    label: '부가세안분',     icon: '🏛' },
  { key: 'taxFee',     label: '제세금',         icon: '📋' },
];

function GasRateSettings({ gasRates, setGasRates, thStyle, tdStyle }) {
  const years = [...new Set(gasRates.map(r => r.year))].filter(Boolean).sort((a,b) => b-a);
  const [selYear, setSelYear] = useState(years[0] || '');
  const activeYear = selYear || years[0] || '';
  const yearItems  = gasRates.filter(r => r.year === activeYear);

  const addYear = () => {
    const input = window.prompt('추가할 연도를 입력하세요 (예: 2027)');
    if (!input?.trim()) return;
    const newYear = input.trim();
    if (years.includes(newYear)) { alert(`${newYear}년은 이미 있어요.`); return; }
    setGasRates([...gasRates, { year: newYear, city: '부산', rate: '22169', note: '' }]);
    setSelYear(newYear);
  };
  const updateRow = (i, key, val) => {
    let cnt = 0;
    setGasRates(gasRates.map(r => {
      if (r.year !== activeYear) return r;
      return cnt++ === i ? { ...r, [key]: val } : r;
    }));
  };
  const addRow = () => setGasRates([...gasRates, { year: activeYear, city: '', rate: '', note: '' }]);
  const removeRow = (i) => {
    let cnt = 0;
    setGasRates(gasRates.filter(r => {
      if (r.year !== activeYear) return true;
      return cnt++ !== i;
    }));
  };
  const deleteYear = (yr) => {
    if (!window.confirm(`${yr}년 데이터를 삭제할까요?`)) return;
    setGasRates(gasRates.filter(r => r.year !== yr));
    setSelYear(years.find(y => y !== yr) || '');
  };

  return (
    <div>
      <div style={{ marginBottom: '14px' }}>
        <div style={{ fontWeight: 'bold', fontSize: '14px' }}>🔥 도시가스 시설분담금 기준단가</div>
        <div style={{ fontSize: '11px', color: '#888', marginTop: '3px' }}>※ 도시별 도시가스 공급규정 — 매년 고시</div>
        <div style={{ fontSize: '11px', color: '#888', marginTop: '2px' }}>※ 일반시설분담금 기준단가 (취사전용/수요가부담 별도)</div>
      </div>
      <div style={{ display: 'flex', gap: '6px', marginBottom: '16px', alignItems: 'center', flexWrap: 'wrap', borderBottom: '2px solid #eee', paddingBottom: '12px' }}>
        {years.map(yr => (
          <div key={yr} style={{ display: 'flex', alignItems: 'center' }}>
            <button onClick={() => setSelYear(yr)}
              style={{ padding: '6px 16px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold',
                backgroundColor: activeYear === yr ? '#e65100' : '#ecf0f1',
                color: activeYear === yr ? 'white' : '#555', borderRadius: '4px 0 0 4px' }}>
              {yr}년
            </button>
            <button onClick={() => deleteYear(yr)}
              style={{ padding: '6px 8px', border: 'none', cursor: 'pointer', fontSize: '11px',
                backgroundColor: activeYear === yr ? '#bf360c' : '#ddd',
                color: activeYear === yr ? 'white' : '#999', borderRadius: '0 4px 4px 0' }}>✕</button>
          </div>
        ))}
        <button onClick={addYear}
          style={{ padding: '6px 14px', backgroundColor: '#e65100', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>
          + 연도 추가
        </button>
      </div>
      {activeYear ? (
        <div>
          <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#e65100', marginBottom: '10px' }}>{activeYear}년 도시별 기준단가</div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ ...thStyle, textAlign: 'left' }}>도시</th>
                <th style={{ ...thStyle, width: '160px' }}>기준단가 (원/㎥)</th>
                <th style={{ ...thStyle, width: '200px' }}>비고</th>
                <th style={{ ...thStyle, width: '60px' }}></th>
              </tr>
            </thead>
            <tbody>
              {yearItems.map((item, i) => (
                <tr key={i} style={{ backgroundColor: i%2===0?'white':'#fafafa' }}>
                  <td style={tdStyle}>
                    <input value={item.city} onChange={e => updateRow(i,'city',e.target.value)}
                      placeholder="부산" style={{ width: '100%', padding:'4px 8px', border:'1px solid #ddd', borderRadius:'3px', fontSize:'12px' }} />
                  </td>
                  <td style={tdStyle}>
                    <input value={item.rate || ''} onChange={e => updateRow(i,'rate',e.target.value)}
                      placeholder="22169" style={{ width:'130px', padding:'4px 8px', border:'1px solid #e65100', borderRadius:'3px', fontSize:'13px', textAlign:'right', color:'#e65100', fontWeight:'bold' }} />
                  </td>
                  <td style={tdStyle}>
                    <input value={item.note||''} onChange={e => updateRow(i,'note',e.target.value)}
                      placeholder="도시가스 공급규정" style={{ width:'100%', padding:'4px 8px', border:'1px solid #ddd', borderRadius:'3px', fontSize:'12px' }} />
                  </td>
                  <td style={{ ...tdStyle, textAlign:'center' }}>
                    <button onClick={() => removeRow(i)}
                      style={{ padding:'3px 8px', backgroundColor:'#e74c3c', color:'white', border:'none', borderRadius:'3px', cursor:'pointer', fontSize:'11px' }}>삭제</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button onClick={addRow}
            style={{ marginTop:'8px', padding:'5px 14px', backgroundColor:'#ecf0f1', border:'1px dashed #bbb', borderRadius:'4px', cursor:'pointer', fontSize:'12px', color:'#555' }}>
            + 도시 추가
          </button>
        </div>
      ) : (
        <div style={{ textAlign:'center', color:'#aaa', padding:'40px' }}>+ 연도 추가 버튼으로 연도를 추가하세요</div>
      )}
    </div>
  );
}


function WaterRateSettings({ waterRates, setWaterRates, thStyle, tdStyle }) {
  const PIPE_SIZES  = ['15','20','25','32','40','50','80','100','150','200','250','300'];
  const SMALL_SIZES = ['15','20','25','32','40','50'];
  const DEFAULT_MEDIUM = {'15':'749','20':'1663','25':'2972','32':'6050','40':'8349','50':'16234','80':'39437','100':'76411','150':'359302','200':'570082','250':'780861','300':'2316751'};
  const DEFAULT_SMALL  = {'15':'310','20':'838','25':'1490','32':'2700','40':'4559','50':'7266'};

  // 연도×지역 조합 목록
  const entries = waterRates?.entries || [{
    year:'2026', city:'부산', ordinance:'부산광역시 상수도 원인자부담금 징수 조례 제5조·제6조',
    large:'926000', medium:'744000', dailyUse:'196', peakRate:'1.0', avgPerson:'2.38',
    mediumPipes: DEFAULT_MEDIUM, smallPipes: DEFAULT_SMALL,
  }];

  const years   = [...new Set(entries.map(e=>e.year))].filter(Boolean).sort((a,b)=>b-a);
  const [selYear, setSelYear] = useState(years[0]||'');
  const activeYear = selYear || years[0] || '';
  const yearEntries = entries.filter(e=>e.year===activeYear);
  const cities = yearEntries.map(e=>e.city);
  const [selCity, setSelCity] = useState(cities[0]||'');
  const activeCity = selCity || cities[0] || '';
  const activeEntry = yearEntries.find(e=>e.city===activeCity) || yearEntries[0] || {};

  const updateEntry = (key, val) => {
    setWaterRates({ ...waterRates, entries: entries.map(e =>
      e.year===activeYear && e.city===activeCity ? {...e,[key]:val} : e
    )});
  };
  const updateMedPipe = (size, val) => updateEntry('mediumPipes', {...(activeEntry.mediumPipes||DEFAULT_MEDIUM), [size]:val});
  const updateSmPipe  = (size, val) => updateEntry('smallPipes',  {...(activeEntry.smallPipes||DEFAULT_SMALL),  [size]:val});

  const addYear = () => {
    const yr = window.prompt('추가할 연도를 입력하세요 (예: 2027)');
    if (!yr?.trim()) return;
    const city = window.prompt('도시명을 입력하세요 (예: 부산)') || '부산';
    const key = yr.trim()+city.trim();
    if (entries.find(e=>e.year===yr.trim()&&e.city===city.trim())) { alert('이미 있어요.'); return; }
    setWaterRates({ ...waterRates, entries: [...entries, {
      year:yr.trim(), city:city.trim(), ordinance:`${city.trim()} 상수도 원인자부담금 징수 조례`,
      large:'926000', medium:'744000', dailyUse:'196', peakRate:'1.0', avgPerson:'2.38',
      mediumPipes:{...DEFAULT_MEDIUM}, smallPipes:{...DEFAULT_SMALL},
    }]});
    setSelYear(yr.trim()); setSelCity(city.trim());
  };
  const addCity = () => {
    const city = window.prompt(`${activeYear}년에 추가할 도시명을 입력하세요`);
    if (!city?.trim()) return;
    if (cities.includes(city.trim())) { alert('이미 있어요.'); return; }
    setWaterRates({ ...waterRates, entries: [...entries, {
      year:activeYear, city:city.trim(), ordinance:`${city.trim()} 상수도 원인자부담금 징수 조례`,
      large:'926000', medium:'744000', dailyUse:'196', peakRate:'1.0', avgPerson:'2.38',
      mediumPipes:{...DEFAULT_MEDIUM}, smallPipes:{...DEFAULT_SMALL},
    }]});
    setSelCity(city.trim());
  };
  const deleteEntry = () => {
    if (!window.confirm(`${activeYear}년 ${activeCity} 데이터를 삭제할까요?`)) return;
    const newEntries = entries.filter(e=>!(e.year===activeYear&&e.city===activeCity));
    setWaterRates({ ...waterRates, entries: newEntries });
    const remaining = newEntries.filter(e=>e.year===activeYear);
    setSelCity(remaining[0]?.city || '');
  };

  const medPipes = activeEntry.mediumPipes || DEFAULT_MEDIUM;
  const smPipes  = activeEntry.smallPipes  || DEFAULT_SMALL;

  return (
    <div>
      <div style={{ marginBottom:'14px' }}>
        <div style={{ fontWeight:'bold', fontSize:'14px' }}>💧 상수도 원인자부담금 기준단가</div>
        <div style={{ fontSize:'11px', color:'#888', marginTop:'3px' }}>※ 지역별 상수도 원인자부담금 징수 조례 — 매년 고시</div>
      </div>

      {/* 연도 탭 */}
      <div style={{ display:'flex', gap:'6px', marginBottom:'12px', alignItems:'center', flexWrap:'wrap', borderBottom:'2px solid #eee', paddingBottom:'10px' }}>
        {years.map(yr => (
          <button key={yr} onClick={() => { setSelYear(yr); setSelCity(entries.find(e=>e.year===yr)?.city||''); }}
            style={{ padding:'6px 16px', border:'none', cursor:'pointer', fontSize:'13px', fontWeight:'bold',
              backgroundColor: activeYear===yr ? '#1565c0' : '#ecf0f1',
              color: activeYear===yr ? 'white' : '#555', borderRadius:'4px' }}>
            {yr}년
          </button>
        ))}
        <button onClick={addYear}
          style={{ padding:'6px 14px', backgroundColor:'#1565c0', color:'white', border:'none', borderRadius:'4px', cursor:'pointer', fontSize:'12px', fontWeight:'bold' }}>
          + 연도/지역 추가
        </button>
      </div>

      {/* 지역 탭 */}
      {activeYear && (
        <div style={{ display:'flex', gap:'4px', marginBottom:'16px', alignItems:'center', flexWrap:'wrap' }}>
          {cities.map(c => (
            <button key={c} onClick={() => setSelCity(c)}
              style={{ padding:'5px 14px', border:'none', cursor:'pointer', fontSize:'12px',
                backgroundColor: activeCity===c ? '#0d47a1' : '#e3f2fd',
                color: activeCity===c ? 'white' : '#1565c0',
                fontWeight: activeCity===c ? 'bold' : 'normal', borderRadius:'4px' }}>
              {c}
            </button>
          ))}
          <button onClick={addCity}
            style={{ padding:'5px 10px', backgroundColor:'#e3f2fd', border:'1px dashed #90caf9', borderRadius:'4px', cursor:'pointer', fontSize:'11px', color:'#1565c0' }}>
            + 도시 추가
          </button>
          <button onClick={deleteEntry}
            style={{ padding:'5px 10px', backgroundColor:'#ffebee', border:'1px solid #ef9a9a', borderRadius:'4px', cursor:'pointer', fontSize:'11px', color:'#c62828' }}>
            🗑 삭제
          </button>
        </div>
      )}

      {activeEntry.year ? (
        <div>
          {/* 조례명 */}
          <div style={{ marginBottom:'12px' }}>
            <label style={{ fontSize:'12px', fontWeight:'bold', color:'#555', display:'block', marginBottom:'4px' }}>근거 조례명</label>
            <input value={activeEntry.ordinance||''} onChange={e=>updateEntry('ordinance',e.target.value)}
              style={{ width:'100%', padding:'6px 10px', border:'1px solid #90caf9', borderRadius:'4px', fontSize:'12px' }}
              placeholder="예: 부산광역시 상수도 원인자부담금 징수 조례 제5조·제6조" />
          </div>

          {/* 기준값 */}
          <div style={{ marginBottom:'16px' }}>
            <div style={{ fontWeight:'bold', fontSize:'13px', color:'#1565c0', marginBottom:'8px' }}>{activeYear}년 {activeCity} 기준값</div>
            <div style={{ display:'flex', gap:'10px', flexWrap:'wrap' }}>
              {[
                {key:'large',       label:'대규모 단위사업비(원/㎥)', val:activeEntry.large||'926000'},
                {key:'medium',      label:'중규모 단위사업비(원/㎥)', val:activeEntry.medium||'744000'},
                {key:'dailyUse',    label:'1인1일 최대급수량(L)',     val:activeEntry.dailyUse||'196'},
                {key:'peakRate',    label:'첨두부하율',               val:activeEntry.peakRate||'1.0'},
                {key:'avgPerson',   label:'평균가구원수',             val:activeEntry.avgPerson||'2.38'},
              ].map(({key,label,val})=>(
                <div key={key}>
                  <label style={{ fontSize:'11px', color:'#555', display:'block', marginBottom:'3px' }}>{label}</label>
                  <input value={val} onChange={e=>updateEntry(key,e.target.value)}
                    style={{width:'120px',padding:'5px 8px',border:'1px solid #1565c0',borderRadius:'3px',fontSize:'12px',textAlign:'right',color:'#1565c0',fontWeight:'bold'}}/>
                </div>
              ))}
            </div>
          </div>

          {/* 중규모 구경별 */}
          <div style={{ marginBottom:'16px' }}>
            <div style={{ fontWeight:'bold', fontSize:'13px', color:'#1565c0', marginBottom:'8px' }}>중규모 구경별 원인자부담금 (천원)</div>
            <div style={{ overflowX:'auto' }}>
              <table style={{ borderCollapse:'collapse', fontSize:'12px' }}>
                <thead><tr style={{ backgroundColor:'#1565c0', color:'white' }}>
                  <td style={{ padding:'5px 8px', fontWeight:'bold' }}>구분</td>
                  {PIPE_SIZES.map(s=><th key={s} style={{padding:'5px 8px',whiteSpace:'nowrap'}}>{s}㎜</th>)}
                </tr></thead>
                <tbody><tr style={{ backgroundColor:'white' }}>
                  <td style={{ padding:'4px 8px', fontWeight:'bold', fontSize:'11px', color:'#555', whiteSpace:'nowrap' }}>일반용(천원)</td>
                  {PIPE_SIZES.map(s=>(
                    <td key={s} style={{padding:'3px 4px'}}>
                      <input value={medPipes[s]||''} onChange={e=>updateMedPipe(s,e.target.value)}
                        style={{width:'70px',padding:'3px 5px',border:'1px solid #90caf9',borderRadius:'3px',fontSize:'11px',textAlign:'right'}}/>
                    </td>
                  ))}
                </tr></tbody>
              </table>
            </div>
          </div>

          {/* 소규모 구경별 */}
          <div>
            <div style={{ fontWeight:'bold', fontSize:'13px', color:'#7b1fa2', marginBottom:'8px' }}>소규모 구경별 원인자부담금 50㎜이하 (천원)</div>
            <div style={{ display:'flex', gap:'12px', flexWrap:'wrap' }}>
              {SMALL_SIZES.map(s=>(
                <div key={s} style={{ display:'flex', alignItems:'center', gap:'4px' }}>
                  <span style={{ fontSize:'12px', fontWeight:'bold', color:'#555', whiteSpace:'nowrap' }}>{s}㎜</span>
                  <input value={smPipes[s]||''} onChange={e=>updateSmPipe(s,e.target.value)}
                    style={{width:'70px',padding:'4px 6px',border:'1px solid #ce93d8',borderRadius:'3px',fontSize:'12px',textAlign:'right'}}/>
                  <span style={{ fontSize:'11px', color:'#888' }}>천원</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div style={{ textAlign:'center', color:'#aaa', padding:'40px' }}>+ 연도/지역 추가 버튼으로 추가하세요</div>
      )}
    </div>
  );
}

function TaxFeeTabPanel({ taxTables, setTaxTables, gasRates, setGasRates, waterRates, setWaterRates, sewerRates, setSewerRates, thStyle, tdStyle }) {
  const [subTab, setSubTab] = useState('trans');
  const TAX_SUB_TABS = [
    { key: 'trans',  label: '🚌 광역교통부담금' },
    { key: 'gas',    label: '🔥 도시가스' },
    { key: 'water',  label: '💧 상수도' },
    { key: 'sewer',  label: '🚿 하수도' },
  ];
  return (
    <div>
      {/* 하위탭 */}
      <div style={{ display:'flex', gap:'4px', marginBottom:'20px', borderBottom:'2px solid #eee', flexWrap:'wrap' }}>
        {TAX_SUB_TABS.map(t => (
          <button key={t.key} onClick={() => setSubTab(t.key)}
            style={{
              padding:'6px 14px', border:'none', cursor:'pointer', fontSize:'12px',
              backgroundColor: subTab===t.key ? '#1a237e' : '#ecf0f1',
              color: subTab===t.key ? 'white' : '#555',
              fontWeight: subTab===t.key ? 'bold' : 'normal',
              borderRadius:'4px 4px 0 0',
              borderBottom: subTab===t.key ? '3px solid #0d47a1' : '3px solid transparent',
            }}>
            {t.label}
          </button>
        ))}
      </div>
      {subTab === 'trans' && <TaxFeeSettings taxTables={taxTables} setTaxTables={setTaxTables} thStyle={thStyle} tdStyle={tdStyle} />}
      {subTab === 'gas'   && <GasRateSettings gasRates={gasRates} setGasRates={setGasRates} thStyle={thStyle} tdStyle={tdStyle} />}
      {subTab === 'water' && <WaterRateSettings waterRates={waterRates} setWaterRates={setWaterRates} thStyle={thStyle} tdStyle={tdStyle} />}
      {subTab === 'sewer' && <SewerRateSettings sewerRates={sewerRates} setSewerRates={setSewerRates} thStyle={thStyle} tdStyle={tdStyle} />}
    </div>
  );
}

function TaxFeeSettings({ taxTables, setTaxTables, thStyle, tdStyle }) {
  const FLOOR_LABELS = ['5층이하', '6~10층이하', '11~20층이하', '21층이상'];
  const COL_LABELS   = ['40㎡이하', '40㎡초과~50㎡이하', '50㎡초과~60㎡이하', '60㎡초과'];
  const COL_KEYS     = ['v40', 'v45', 'v55', 'v60'];
  const transStd     = taxTables?.transStd || [];
  const stdYears     = transStd.map(t => t.year).sort((a,b) => b-a);
  const [selStdYear, setSelStdYear] = useState(stdYears[0] || '');
  const activeYear   = selStdYear || stdYears[0] || '';
  const activeStd    = transStd.find(t => t.year === activeYear);
  const activeData   = activeStd?.data || FLOOR_LABELS.map(floor => ({ floor, v40:'', v45:'', v55:'', v60:'' }));

  const updateCell = (fi, key, val) => {
    const newData = activeData.map((r, i) => i === fi ? { ...r, [key]: val } : r);
    const newTransStd = transStd.map(t =>
      t.year === activeYear ? { ...t, data: newData } : t
    );
    setTaxTables({ ...taxTables, transStd: newTransStd });
  };

  const addYear = () => {
    const input = window.prompt('추가할 연도를 입력하세요 (예: 2027)');
    if (!input?.trim()) return;
    const newYear = input.trim();
    if (stdYears.includes(newYear)) { alert(`${newYear}년은 이미 있어요.`); return; }
    const newData = FLOOR_LABELS.map(floor => ({ floor, v40:'', v45:'', v55:'', v60:'' }));
    setTaxTables({ ...taxTables, transStd: [...transStd, { year: newYear, data: newData }] });
    setSelStdYear(newYear);
  };

  const deleteYear = (yr) => {
    if (!window.confirm(`${yr}년 데이터를 삭제할까요?`)) return;
    setTaxTables({ ...taxTables, transStd: transStd.filter(t => t.year !== yr) });
    setSelStdYear(stdYears.find(y => y !== yr) || '');
  };

  return (
    <div>
      <div style={{ marginBottom: '14px' }}>
        <div style={{ fontWeight: 'bold', fontSize: '14px' }}>🚌 공공건설임대주택 표준건축비</div>
        <div style={{ fontSize: '11px', color: '#888', marginTop: '3px' }}>※ 광역교통시설부담금 계산에 사용 — 국토교통부 매년 고시</div>
        <div style={{ fontSize: '11px', color: '#e74c3c', marginTop: '2px' }}>※ 과밀부담금용/행안부 표준건축비와 다름 (원/㎡)</div>
      </div>

      {/* 연도 선택 바 */}
      <div style={{ display: 'flex', gap: '6px', marginBottom: '16px', alignItems: 'center', flexWrap: 'wrap', borderBottom: '2px solid #eee', paddingBottom: '12px' }}>
        {stdYears.map(yr => (
          <div key={yr} style={{ display: 'flex', alignItems: 'center' }}>
            <button onClick={() => setSelStdYear(yr)}
              style={{ padding: '6px 16px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold',
                backgroundColor: activeYear === yr ? '#1565c0' : '#ecf0f1',
                color: activeYear === yr ? 'white' : '#555', borderRadius: '4px 0 0 4px' }}>
              {yr}년
            </button>
            <button onClick={() => deleteYear(yr)}
              style={{ padding: '6px 8px', border: 'none', cursor: 'pointer', fontSize: '11px',
                backgroundColor: activeYear === yr ? '#1976d2' : '#ddd',
                color: activeYear === yr ? 'white' : '#999', borderRadius: '0 4px 4px 0' }}>✕</button>
          </div>
        ))}
        <button onClick={addYear}
          style={{ padding: '6px 14px', backgroundColor: '#1565c0', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>
          + 연도 추가
        </button>
      </div>

      {/* 매트릭스 테이블 */}
      {activeData.length > 0 ? (
        <div>
          <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#1565c0', marginBottom: '10px' }}>
            {activeYear}년 층수별 표준건축비 (원/㎡)
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr>
                  <th style={{ ...thStyle, textAlign: 'left', width: '120px' }}>층수/건용면적</th>
                  {COL_LABELS.map(c => <th key={c} style={{ ...thStyle, width: '150px' }}>{c}</th>)}
                </tr>
              </thead>
              <tbody>
                {activeData.map((row, fi) => (
                  <tr key={fi} style={{ backgroundColor: fi % 2 === 0 ? 'white' : '#fafafa' }}>
                    <td style={{ ...tdStyle, fontWeight: 'bold', color: '#555' }}>{row.floor}</td>
                    {COL_KEYS.map(key => (
                      <td key={key} style={tdStyle}>
                        <input value={row[key] || ''} onChange={e => updateCell(fi, key, e.target.value)}
                          placeholder="예: 1226100"
                          style={{ width: '120px', padding: '4px 8px', border: '1px solid #1565c0', borderRadius: '3px', fontSize: '12px', textAlign: 'right', color: '#1565c0', fontWeight: 'bold' }} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ fontSize: '11px', color: '#888', marginTop: '10px', padding: '8px', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
            💡 광역교통시설부담금 계산기에서 최고단가가 자동 적용됩니다.
          </div>
        </div>
      ) : (
        <div style={{ textAlign: 'center', color: '#aaa', padding: '40px' }}>
          "+ 연도 추가" 버튼으로 연도를 추가하세요
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// 국민주택채권 기준정보
// ─────────────────────────────────────────────
// 건축허가 시 — 주거전용건축물 (공동주택) 전용면적 구간별
const BOND_HOUSING_BANDS = [
  { range: '국민주택규모 초과 ~ 100㎡ 미만',   rate: 300   },
  { range: '100㎡ 이상 ~ 132㎡ 미만 (공동주택)', rate: 1000  },
  { range: '132㎡ 이상 ~ 165㎡ 미만 (공동주택)', rate: 2000  },
  { range: '165㎡ 이상 ~ 231㎡ 미만 (공동주택)', rate: 4000  },
  { range: '231㎡ 이상 ~ 330㎡ 미만',            rate: 10000 },
  { range: '330㎡ 이상 ~ 660㎡ 미만',            rate: 17000 },
  { range: '660㎡ 이상',                          rate: 28000 },
];
// 건축허가 시 — 주거전용 외 건축물 (근린상가)
const BOND_NONHOUSING_BANDS = [
  { range: '극장·영화관·유흥주점·단란주점·게임장·테마파크', rate: 4000 },
  { range: '그 밖의 철근 및 철골조 건축물',                 rate: 1300 },
  { range: '연와조 및 석조 건축물',                         rate: 1000 },
  { range: '시멘트벽돌 및 블록조 건축물',                   rate: 600  },
  { range: '관광진흥법 적용 관광숙박시설',                  rate: 500  },
];
// 부동산등기 시 — 주택 소유권 보존/이전 (시가표준액 기준)
const BOND_REG_HOUSING = [
  { range: '2천만원 이상 ~ 5천만원 미만',          metro: 13, other: 13 },
  { range: '5천만원 이상 ~ 1억원 미만',            metro: 19, other: 14 },
  { range: '1억원 이상 ~ 1억6천만원 미만',         metro: 21, other: 16 },
  { range: '1억6천만원 이상 ~ 2억6천만원 미만',    metro: 23, other: 18 },
  { range: '2억6천만원 이상 ~ 6억원 미만',         metro: 26, other: 21 },
  { range: '6억원 이상',                           metro: 31, other: 26 },
];
// 부동산등기 시 — 토지 소유권 보존/이전
const BOND_REG_LAND = [
  { range: '5백만원 이상 ~ 5천만원 미만',  metro: 25, other: 20 },
  { range: '5천만원 이상 ~ 1억원 미만',    metro: 40, other: 35 },
  { range: '1억원 이상',                   metro: 50, other: 45 },
];

function BondRateSettings({ bondRates, setBondRates, thStyle, tdStyle }) {
  const [subTab, setSubTab] = useState('permit');  // permit=건축허가, reg=부동산등기, calc=계산기준
  const SUB_TABS = [
    { key: 'permit', label: '🏗 건축허가 시' },
    { key: 'reg',    label: '🏠 부동산등기 시' },
    { key: 'calc',   label: '⚙ 계산 기준값' },
  ];

  const buyRate  = bondRates?.buyRate  || '50';
  const discRate = bondRates?.discRate || '13.5';

  const hdrStyle = { backgroundColor: '#1a237e', color: 'white', padding: '6px 10px', fontSize: '12px', fontWeight: 'bold' };
  const cellStyle = { padding: '5px 10px', borderBottom: '1px solid #eee', fontSize: '12px' };

  return (
    <div>
      <div style={{ marginBottom: '14px' }}>
        <div style={{ fontWeight: 'bold', fontSize: '14px' }}>🏦 국민주택채권 매입 기준</div>
        <div style={{ fontSize: '11px', color: '#888', marginTop: '3px' }}>※ 근거: 주택도시기금법 시행령 별표 1 (개정 2025. 8. 26.)</div>
        <div style={{ fontSize: '11px', color: '#888', marginTop: '2px' }}>※ 매입 후 즉시 배도 시 할인 비용이 실제 사업비로 발생</div>
      </div>

      {/* 하위탭 */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '16px', borderBottom: '2px solid #eee', flexWrap: 'wrap' }}>
        {SUB_TABS.map(t => (
          <button key={t.key} onClick={() => setSubTab(t.key)}
            style={{ padding: '6px 14px', border: 'none', cursor: 'pointer', fontSize: '12px',
              backgroundColor: subTab === t.key ? '#1a237e' : '#ecf0f1',
              color: subTab === t.key ? 'white' : '#555',
              fontWeight: subTab === t.key ? 'bold' : 'normal',
              borderRadius: '4px 4px 0 0' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* 건축허가 시 */}
      {subTab === 'permit' && (
        <div>
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontWeight: 'bold', fontSize: '13px', color: '#1a237e', marginBottom: '8px' }}>
              가. 주거전용건축물 (공동주택) — 전용면적 기준 (원/㎡)
            </div>
            <div style={{ fontSize: '11px', color: '#888', marginBottom: '8px' }}>
              ※ 주거전용면적이 국민주택규모(85㎡)를 초과하는 경우에 한정
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr style={{ backgroundColor: '#1a237e', color: 'white' }}>
                <th style={{ padding: '6px 10px', textAlign: 'left', fontSize: '12px' }}>적용범위</th>
                <th style={{ padding: '6px 10px', textAlign: 'right', fontSize: '12px', width: '150px' }}>매입금액 (원/㎡)</th>
              </tr></thead>
              <tbody>
                {BOND_HOUSING_BANDS.map((b, i) => (
                  <tr key={i} style={{ backgroundColor: i % 2 === 0 ? 'white' : '#fafafa' }}>
                    <td style={cellStyle}>{b.range}</td>
                    <td style={{ ...cellStyle, textAlign: 'right', fontWeight: 'bold', color: '#1a237e' }}>{formatNumber(b.rate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div>
            <div style={{ fontWeight: 'bold', fontSize: '13px', color: '#1a237e', marginBottom: '8px' }}>
              나. 주거전용 외 건축물 (근린상가) — 연면적 기준 (원/㎡)
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr style={{ backgroundColor: '#1a237e', color: 'white' }}>
                <th style={{ padding: '6px 10px', textAlign: 'left', fontSize: '12px' }}>적용범위</th>
                <th style={{ padding: '6px 10px', textAlign: 'right', fontSize: '12px', width: '150px' }}>매입금액 (원/㎡)</th>
              </tr></thead>
              <tbody>
                {BOND_NONHOUSING_BANDS.map((b, i) => (
                  <tr key={i} style={{ backgroundColor: i % 2 === 0 ? 'white' : '#fafafa' }}>
                    <td style={cellStyle}>{b.range}</td>
                    <td style={{ ...cellStyle, textAlign: 'right', fontWeight: 'bold', color: '#1a237e' }}>{formatNumber(b.rate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 부동산등기 시 */}
      {subTab === 'reg' && (
        <div>
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontWeight: 'bold', fontSize: '13px', color: '#1a237e', marginBottom: '8px' }}>
              가. 주택 소유권 보존·이전 — 시가표준액 기준 (/1,000)
            </div>
            <div style={{ fontSize: '11px', color: '#888', marginBottom: '6px' }}>
              ※ 신규 분양 공동주택: 지방세법 제10조의3에 따른 취득당시가액을 시가표준액으로 함
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr style={{ backgroundColor: '#1a237e', color: 'white' }}>
                <th style={{ padding: '6px 10px', textAlign: 'left', fontSize: '12px' }}>시가표준액</th>
                <th style={{ padding: '6px 10px', textAlign: 'right', fontSize: '12px' }}>특별시·광역시 (/1,000)</th>
                <th style={{ padding: '6px 10px', textAlign: 'right', fontSize: '12px' }}>그 밖의 지역 (/1,000)</th>
              </tr></thead>
              <tbody>
                {BOND_REG_HOUSING.map((b, i) => (
                  <tr key={i} style={{ backgroundColor: i % 2 === 0 ? 'white' : '#fafafa' }}>
                    <td style={cellStyle}>{b.range}</td>
                    <td style={{ ...cellStyle, textAlign: 'right', fontWeight: 'bold', color: '#1a237e' }}>{b.metro}</td>
                    <td style={{ ...cellStyle, textAlign: 'right', color: '#555' }}>{b.other}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div>
            <div style={{ fontWeight: 'bold', fontSize: '13px', color: '#1a237e', marginBottom: '8px' }}>
              나. 토지 소유권 보존·이전 — 시가표준액 기준 (/1,000)
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr style={{ backgroundColor: '#1a237e', color: 'white' }}>
                <th style={{ padding: '6px 10px', textAlign: 'left', fontSize: '12px' }}>시가표준액</th>
                <th style={{ padding: '6px 10px', textAlign: 'right', fontSize: '12px' }}>특별시·광역시 (/1,000)</th>
                <th style={{ padding: '6px 10px', textAlign: 'right', fontSize: '12px' }}>그 밖의 지역 (/1,000)</th>
              </tr></thead>
              <tbody>
                {BOND_REG_LAND.map((b, i) => (
                  <tr key={i} style={{ backgroundColor: i % 2 === 0 ? 'white' : '#fafafa' }}>
                    <td style={cellStyle}>{b.range}</td>
                    <td style={{ ...cellStyle, textAlign: 'right', fontWeight: 'bold', color: '#1a237e' }}>{b.metro}</td>
                    <td style={{ ...cellStyle, textAlign: 'right', color: '#555' }}>{b.other}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ fontSize: '11px', color: '#888', marginTop: '6px' }}>
              ※ 다. 저당권 설정: 설정금액의 10/1,000 (매입액 10억원 초과 시 10억원으로 한정)
            </div>
          </div>
        </div>
      )}

      {/* 계산 기준값 */}
      {subTab === 'calc' && (
        <div>
          <div style={{ marginBottom: '16px', backgroundColor: '#e8eaf6', padding: '14px', borderRadius: '8px' }}>
            <div style={{ fontWeight: 'bold', fontSize: '13px', color: '#1a237e', marginBottom: '12px' }}>
              토지매입 시 국민주택채권할인 기준값
            </div>
            <div style={{ fontSize: '11px', color: '#555', marginBottom: '12px', lineHeight: '1.8' }}>
              <div>① 토지 개별공시지가 합계 × 매입요율 = <strong>채권매입금액</strong></div>
              <div>② 채권매입금액 × 즉시배도율 = <strong>본인부담금 (실제 사업비)</strong></div>
              <div style={{ color: '#888', marginTop: '4px' }}>※ 즉시배도율은 당일 시장 배도단가에 따라 변동 (주택도시기금 사이트 조회)</div>
            </div>
            <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '4px' }}>
                  매입요율 (/1,000)
                  <span style={{ fontSize: '10px', color: '#888', fontWeight: 'normal', marginLeft: '6px' }}>토지 1억↑ 광역시 기준</span>
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <input value={buyRate} onChange={e => setBondRates({ ...bondRates, buyRate: e.target.value })}
                    style={{ width: '80px', padding: '6px 10px', border: '1px solid #3f51b5', borderRadius: '4px', fontSize: '14px', textAlign: 'right', color: '#1a237e', fontWeight: 'bold' }} />
                  <span style={{ fontSize: '12px', color: '#888' }}>/1,000</span>
                  <span style={{ fontSize: '11px', color: '#888' }}>= {parseFloat(buyRate||0)/10}%</span>
                </div>
              </div>
              <div>
                <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '4px' }}>
                  즉시배도율 (%)
                  <span style={{ fontSize: '10px', color: '#888', fontWeight: 'normal', marginLeft: '6px' }}>기본값, 실제 배도단가로 수정 가능</span>
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <input value={discRate} onChange={e => setBondRates({ ...bondRates, discRate: e.target.value })}
                    style={{ width: '80px', padding: '6px 10px', border: '1px solid #3f51b5', borderRadius: '4px', fontSize: '14px', textAlign: 'right', color: '#1a237e', fontWeight: 'bold' }} />
                  <span style={{ fontSize: '12px', color: '#888' }}>%</span>
                </div>
              </div>
            </div>
          </div>
          <div style={{ fontSize: '11px', color: '#888', padding: '8px', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
            💡 여기서 설정한 매입요율/즉시배도율이 토지관련비용 → 국민주택채권할인 항목의 기본값으로 적용됩니다.
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// 공정율 기본 테이블 (엑셀 데이터)
// ─────────────────────────────────────────────
const DEFAULT_PROGRESS_TABLE = {
  12: [0.0083,0.0333,0.0583,0.0833,0.0966,0.1099,0.1232,0.1365,0.1169,0.0974,0.0779,0.0584],
  13: [0.022,0.031,0.031,0.0558,0.059,0.056,0.074,0.113,0.142,0.143,0.125,0.104,0.045],
  14: [0.0071,0.0232,0.0393,0.0554,0.0714,0.081,0.0905,0.1,0.1095,0.119,0.1018,0.0845,0.0673,0.05],
  15: [0.017,0.03,0.022,0.039,0.052,0.049,0.049,0.064,0.093,0.119,0.127,0.117,0.104,0.083,0.035],
  16: [0.0063,0.0203,0.0344,0.0484,0.0625,0.0685,0.0744,0.0804,0.0864,0.0923,0.0983,0.0874,0.0765,0.0656,0.0547,0.0436],
  17: [0.014,0.027,0.019,0.027,0.041,0.047,0.043,0.043,0.056,0.08,0.101,0.111,0.109,0.098,0.088,0.068,0.028],
  18: [0.0056,0.0156,0.0256,0.0356,0.0456,0.0556,0.0613,0.0671,0.0729,0.0787,0.0845,0.0903,0.0817,0.0731,0.0646,0.056,0.0475,0.0387],
  19: [0.0053,0.0147,0.0242,0.0337,0.0432,0.0526,0.057,0.0613,0.0656,0.07,0.0743,0.0787,0.083,0.0753,0.0676,0.0599,0.0522,0.0445,0.0369],
  20: [0.005,0.0125,0.02,0.0275,0.035,0.0425,0.05,0.0546,0.0592,0.0638,0.0685,0.0731,0.0777,0.0823,0.0744,0.0665,0.0587,0.0508,0.0429,0.035],
  21: [0.0048,0.0119,0.019,0.0262,0.0333,0.0405,0.0476,0.0518,0.0561,0.0603,0.0645,0.0688,0.073,0.0772,0.0709,0.0647,0.0584,0.0521,0.0459,0.0396,0.0334],
  22: [0.0045,0.0114,0.0182,0.025,0.0318,0.0386,0.0455,0.0488,0.052,0.0553,0.0586,0.0619,0.0652,0.0685,0.0718,0.0661,0.0604,0.0547,0.049,0.0432,0.0375,0.032],
  23: [0.011,0.016,0.019,0.014,0.017,0.027,0.032,0.035,0.032,0.031,0.033,0.042,0.054,0.067,0.077,0.083,0.081,0.078,0.071,0.066,0.057,0.041,0.016],
  24: [0.0042,0.0095,0.0149,0.0202,0.0256,0.031,0.0363,0.0417,0.0449,0.0481,0.0513,0.0546,0.0578,0.061,0.0642,0.0674,0.0627,0.0579,0.0531,0.0483,0.0435,0.0387,0.034,0.0291],
  25: [0.011,0.013,0.018,0.013,0.014,0.021,0.028,0.031,0.031,0.029,0.029,0.031,0.038,0.048,0.06,0.07,0.075,0.076,0.073,0.069,0.064,0.059,0.05,0.036,0.013],
  26: [0.0038,0.0082,0.0125,0.0168,0.0212,0.0255,0.0298,0.0341,0.0385,0.0416,0.0447,0.0479,0.051,0.0542,0.0573,0.0604,0.0636,0.0595,0.0554,0.0514,0.0473,0.0432,0.0391,0.0351,0.031,0.0269],
  27: [0.0037,0.0079,0.012,0.0162,0.0204,0.0245,0.0287,0.0329,0.037,0.0396,0.0421,0.0447,0.0472,0.0497,0.0523,0.0548,0.0573,0.0599,0.0561,0.0523,0.0486,0.0448,0.041,0.0372,0.0335,0.0297,0.0259],
  28: [0.0036,0.0076,0.0116,0.0156,0.0196,0.0237,0.0277,0.0317,0.0357,0.0378,0.0399,0.042,0.0441,0.0461,0.0482,0.0503,0.0524,0.0545,0.0566,0.0531,0.0496,0.0461,0.0425,0.039,0.0355,0.032,0.0285,0.025],
  29: [0.0034,0.0069,0.0103,0.0138,0.0172,0.0207,0.0241,0.0276,0.031,0.0345,0.037,0.0394,0.0419,0.0444,0.0469,0.0494,0.0518,0.0543,0.0568,0.0535,0.0503,0.047,0.0437,0.0405,0.0372,0.0339,0.0307,0.0274,0.0244],
  30: [0.0067,0.0096,0.0126,0.0156,0.0185,0.0215,0.0244,0.0274,0.0304,0.0333,0.0352,0.0371,0.039,0.0409,0.0428,0.0446,0.0465,0.0484,0.0503,0.0522,0.0493,0.0464,0.0435,0.0406,0.0378,0.0349,0.032,0.0291,0.0262,0.0232],
  31: [0.0064,0.0093,0.0122,0.0151,0.0179,0.0208,0.0237,0.0265,0.0294,0.0323,0.0338,0.0354,0.037,0.0386,0.0401,0.0417,0.0433,0.0449,0.0465,0.048,0.0496,0.0469,0.0442,0.0415,0.0388,0.0361,0.0334,0.0307,0.028,0.0253,0.0226],
  32: [0.0063,0.0088,0.0113,0.0138,0.0163,0.0188,0.0213,0.0238,0.0263,0.0288,0.0313,0.0331,0.0349,0.0368,0.0386,0.0405,0.0423,0.0442,0.046,0.0479,0.0497,0.0472,0.0446,0.0421,0.0396,0.0371,0.0344,0.0319,0.0291,0.0268,0.0243,0.0221],
  33: [0.014,0.001,0.014,0.014,0.01,0.009,0.013,0.016,0.021,0.023,0.025,0.023,0.022,0.021,0.022,0.025,0.029,0.035,0.041,0.047,0.053,0.056,0.058,0.058,0.055,0.053,0.05,0.047,0.044,0.04,0.032,0.021,0.008],
  34: [0.0059,0.0082,0.0106,0.0129,0.0153,0.0176,0.02,0.0224,0.0247,0.0271,0.0294,0.0307,0.0321,0.0334,0.0347,0.036,0.0373,0.0387,0.04,0.0413,0.0426,0.0439,0.0453,0.043,0.0408,0.0385,0.0363,0.0341,0.0318,0.0296,0.0273,0.0251,0.0228,0.0206],
  35: [0.0057,0.0078,0.0099,0.0119,0.014,0.0161,0.0182,0.0203,0.0223,0.0244,0.0265,0.0286,0.0301,0.0316,0.0331,0.0347,0.0362,0.0377,0.0392,0.0408,0.0423,0.0438,0.0453,0.0432,0.0411,0.039,0.0369,0.0348,0.0327,0.0306,0.0284,0.0263,0.0242,0.0221,0.0202],
  36: [0.0056,0.0076,0.0096,0.0116,0.0136,0.0157,0.0177,0.0197,0.0217,0.0237,0.0258,0.0278,0.0291,0.0304,0.0317,0.033,0.0343,0.0356,0.0369,0.0382,0.0395,0.0408,0.0421,0.0434,0.0414,0.0394,0.0374,0.0354,0.0334,0.0314,0.0294,0.0274,0.0254,0.0234,0.0214,0.0195],
  37: [0.0054,0.0074,0.0093,0.0113,0.0133,0.0152,0.0172,0.0192,0.0211,0.0231,0.0251,0.027,0.0281,0.0293,0.0304,0.0315,0.0326,0.0338,0.0349,0.036,0.0371,0.0383,0.0394,0.0405,0.0416,0.0397,0.0378,0.0359,0.0341,0.0322,0.0303,0.0284,0.0265,0.0246,0.0227,0.0208,0.0189],
  38: [0.0053,0.007,0.0088,0.0105,0.0123,0.014,0.0158,0.0175,0.0193,0.0211,0.0228,0.0246,0.0263,0.0276,0.0289,0.0302,0.0314,0.0327,0.034,0.0353,0.0366,0.0378,0.0391,0.0404,0.0417,0.0399,0.0381,0.0363,0.0345,0.0327,0.0309,0.0292,0.0274,0.0256,0.0238,0.022,0.0202,0.0184],
  39: [0.0051,0.0068,0.0085,0.0103,0.012,0.0137,0.0154,0.0171,0.0188,0.0205,0.0222,0.0239,0.0256,0.0267,0.0279,0.029,0.0301,0.0312,0.0323,0.0334,0.0345,0.0356,0.0367,0.0378,0.0389,0.04,0.0383,0.0366,0.0349,0.0332,0.0315,0.0298,0.0282,0.0265,0.0248,0.0231,0.0214,0.0197,0.018],
  40: [0.005,0.0067,0.0083,0.01,0.0117,0.0133,0.015,0.0167,0.0183,0.02,0.0217,0.0233,0.025,0.026,0.0269,0.0279,0.0289,0.0298,0.0308,0.0318,0.0327,0.0337,0.0347,0.0356,0.0366,0.0376,0.0385,0.0369,0.0353,0.0337,0.0321,0.0304,0.0288,0.0272,0.0256,0.024,0.0224,0.0207,0.019,0.0174],
  41: [0.003,0.008,0.009,0.013,0.01,0.008,0.008,0.008,0.011,0.014,0.017,0.018,0.02,0.019,0.019,0.017,0.018,0.017,0.018,0.021,0.023,0.027,0.031,0.035,0.039,0.043,0.045,0.046,0.047,0.046,0.044,0.043,0.041,0.039,0.038,0.035,0.032,0.029,0.022,0.013,0.006],
  42: [0.0048,0.0062,0.0077,0.0092,0.0106,0.0121,0.0136,0.015,0.0165,0.0179,0.0194,0.0209,0.0223,0.0238,0.0248,0.0257,0.0267,0.0276,0.0286,0.0295,0.0305,0.0314,0.0324,0.0333,0.0343,0.0353,0.0362,0.0372,0.0357,0.0342,0.0328,0.0313,0.0298,0.0284,0.0269,0.0254,0.024,0.0225,0.0211,0.0196,0.0181,0.0167],
  43: [0.0047,0.0061,0.0075,0.0089,0.0104,0.0118,0.0132,0.0147,0.0161,0.0175,0.019,0.0204,0.0218,0.0233,0.0241,0.0249,0.0258,0.0266,0.0275,0.0283,0.0291,0.03,0.0308,0.0316,0.0325,0.0333,0.0342,0.035,0.0358,0.0344,0.0331,0.0317,0.0303,0.0289,0.0275,0.0261,0.0247,0.0233,0.0219,0.0204,0.019,0.0176,0.0162],
  44: [0.0045,0.0058,0.0071,0.0084,0.0097,0.011,0.0123,0.0136,0.0149,0.0162,0.0175,0.0188,0.0201,0.0214,0.0227,0.0237,0.0246,0.0255,0.0265,0.0274,0.0284,0.0293,0.0303,0.0312,0.0321,0.0331,0.034,0.035,0.0359,0.0346,0.0332,0.0319,0.0306,0.0292,0.0279,0.0266,0.0252,0.0239,0.0226,0.0213,0.02,0.0187,0.0173,0.016],
  45: [0.001,0.01,0.006,0.011,0.011,0.008,0.007,0.007,0.008,0.011,0.013,0.015,0.016,0.018,0.018,0.017,0.016,0.016,0.016,0.016,0.017,0.019,0.021,0.024,0.028,0.031,0.034,0.038,0.04,0.041,0.043,0.042,0.042,0.04,0.039,0.038,0.036,0.035,0.033,0.031,0.028,0.024,0.019,0.011,0.005],
  46: [0.0043,0.0056,0.0068,0.0081,0.0093,0.0106,0.0118,0.013,0.0143,0.0155,0.0168,0.018,0.0193,0.0205,0.0217,0.0225,0.0232,0.0239,0.0247,0.0254,0.0262,0.0269,0.0276,0.0284,0.0291,0.0298,0.0306,0.0313,0.032,0.0328,0.0335,0.0323,0.0311,0.0299,0.0286,0.0274,0.0262,0.025,0.0238,0.0225,0.0213,0.0201,0.0189,0.0177,0.0164,0.0153],
  47: [0.0,0.011,0.005,0.011,0.01,0.008,0.007,0.006,0.008,0.009,0.011,0.014,0.015,0.016,0.017,0.017,0.016,0.016,0.015,0.015,0.016,0.016,0.018,0.02,0.023,0.026,0.03,0.032,0.036,0.038,0.039,0.04,0.041,0.04,0.04,0.038,0.037,0.035,0.034,0.033,0.031,0.029,0.026,0.023,0.017,0.011,0.004],
  48: [0.0042,0.0053,0.0064,0.0075,0.0086,0.0097,0.0108,0.0119,0.0131,0.0142,0.0153,0.0164,0.0175,0.0186,0.0197,0.0208,0.0216,0.0223,0.023,0.0237,0.0245,0.0252,0.0259,0.0267,0.0274,0.0281,0.0288,0.0296,0.0303,0.031,0.0318,0.0325,0.0314,0.0302,0.0291,0.028,0.0269,0.0258,0.0247,0.0235,0.0224,0.0213,0.0202,0.0191,0.0179,0.0168,0.0157,0.0146],
  49: [0.0,0.012,0.004,0.01,0.01,0.008,0.007,0.006,0.007,0.008,0.01,0.012,0.014,0.015,0.016,0.016,0.016,0.016,0.015,0.014,0.015,0.014,0.016,0.017,0.02,0.022,0.025,0.027,0.031,0.034,0.035,0.038,0.038,0.039,0.039,0.038,0.038,0.036,0.034,0.034,0.032,0.031,0.029,0.028,0.024,0.021,0.016,0.01,0.0],
  50: [0.004,0.005,0.006,0.007,0.008,0.009,0.01,0.011,0.012,0.013,0.014,0.015,0.016,0.017,0.018,0.019,0.02,0.0207,0.0214,0.0222,0.0229,0.0236,0.0243,0.025,0.0258,0.0265,0.0272,0.0279,0.0286,0.0294,0.0301,0.0308,0.0315,0.0305,0.0295,0.0284,0.0274,0.0264,0.0253,0.0243,0.0233,0.0222,0.0212,0.0202,0.0192,0.0181,0.0171,0.0161,0.0,0.0],
};

function ProgressRateSettings({ progressRates, setProgressRates, constructPeriod }) {
  // Firestore에 저장된 값이 있으면 사용, 없으면 DEFAULT 사용
  const getTable = () => {
    if (progressRates && Object.keys(progressRates).length > 0) return progressRates;
    return DEFAULT_PROGRESS_TABLE;
  };
  const table = getTable();

  // 건축개요 공사기간에 맞는 개월수로 초기값 설정
  const initMonths = (() => {
    const cp = Math.round(parseFloat(constructPeriod) || 31);
    return DEFAULT_PROGRESS_TABLE[cp] ? cp : 31;
  })();
  const [selMonths, setSelMonths] = useState(initMonths);
  const rates = table[selMonths] || DEFAULT_PROGRESS_TABLE[selMonths] || [];
  const total = rates.reduce((s, r) => s + r, 0);

  // 공정율 수정
  const updateRate = (i, val) => {
    const newRates = [...rates];
    newRates[i] = parseFloat(val) || 0;
    setProgressRates({ ...table, [selMonths]: newRates });
  };

  // 기본값 복원
  const resetToDefault = () => {
    setProgressRates({ ...table, [selMonths]: DEFAULT_PROGRESS_TABLE[selMonths] });
  };

  const thS = { padding:'5px 8px', backgroundColor:'#1a6a99', color:'white', fontSize:'11px', fontWeight:'bold', textAlign:'center' };
  const tdS = { padding:'4px 6px', borderBottom:'1px solid #eee', fontSize:'11px', textAlign:'right' };

  return (
    <div>
      <div style={{ marginBottom:'14px' }}>
        <div style={{ fontWeight:'bold', fontSize:'14px' }}>📊 공정율 기준 테이블</div>
        <div style={{ fontSize:'11px', color:'#888', marginTop:'3px' }}>
          ※ 공사기간별 월별 공정율 — 직접공사비 지급패턴에 자동 적용
        </div>
        <div style={{ fontSize:'11px', color:'#888' }}>
          ※ 기본값: 엑셀 표준 공정율 테이블 (12~50개월)
        </div>
      </div>

      {/* 개월수 선택 */}
      <div style={{ display:'flex', gap:'6px', flexWrap:'wrap', marginBottom:'16px' }}>
        {Object.keys(DEFAULT_PROGRESS_TABLE).map(m => {
          const mn = parseInt(m);
          const isModified = progressRates[mn] &&
            JSON.stringify(progressRates[mn]) !== JSON.stringify(DEFAULT_PROGRESS_TABLE[mn]);
          return (
            <button key={m} onClick={() => setSelMonths(mn)}
              style={{ padding:'4px 10px', border:`2px solid ${selMonths===mn?'#1a6a99':'#ddd'}`,
                borderRadius:'4px', cursor:'pointer', fontSize:'12px',
                backgroundColor: selMonths===mn ? '#1a6a99' : isModified ? '#fff9c4' : 'white',
                color: selMonths===mn ? 'white' : '#333',
                fontWeight: selMonths===mn ? 'bold' : 'normal' }}>
              {m}M {isModified ? '✎' : ''}
            </button>
          );
        })}
      </div>

      {/* 선택된 개월 공정율 */}
      <div style={{ border:'1px solid #e0e0e0', borderRadius:'8px', padding:'14px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'10px' }}>
          <div style={{ fontWeight:'bold', color:'#1a6a99', fontSize:'13px' }}>
            {selMonths}개월 공정율
            <span style={{ fontSize:'11px', color: Math.abs(total-1) < 0.001 ? '#27ae60' : '#e74c3c', marginLeft:'10px' }}>
              합계: {(total*100).toFixed(2)}% {Math.abs(total-1) < 0.001 ? '✓' : '⚠ 합계 오류'}
            </span>
          </div>
          <button onClick={resetToDefault}
            style={{ padding:'4px 10px', fontSize:'11px', backgroundColor:'#e74c3c', color:'white', border:'none', borderRadius:'3px', cursor:'pointer' }}>
            기본값 복원
          </button>
        </div>
        <div style={{ overflowX:'auto' }}>
          <table style={{ borderCollapse:'collapse', fontSize:'11px' }}>
            <thead>
              <tr>
                <th style={thS}>월</th>
                {rates.map((_,i) => <th key={i} style={{ ...thS, minWidth:'60px' }}>{i+1}월</th>)}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ ...tdS, fontWeight:'bold', color:'#1a6a99' }}>공정율(%)</td>
                {rates.map((r, i) => (
                  <td key={i} style={{ ...tdS, padding:'2px 3px' }}>
                    <input value={(r*100).toFixed(2)}
                      onChange={e => updateRate(i, parseFloat(e.target.value||0)/100)}
                      style={{ width:'55px', padding:'3px 4px', border:'1px solid #ddd', borderRadius:'2px',
                        fontSize:'11px', textAlign:'right' }} />
                  </td>
                ))}
              </tr>
              <tr>
                <td style={{ ...tdS, fontWeight:'bold', color:'#888' }}>누계(%)</td>
                {rates.reduce((acc, r, i) => {
                  const cum = (acc[i-1]?.val || 0) + r;
                  acc.push({ val: cum, i });
                  return acc;
                }, []).map((c, i) => (
                  <td key={i} style={{ ...tdS, color:'#888', fontSize:'10px' }}>{(c.val*100).toFixed(1)}</td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ marginTop:'10px', fontSize:'11px', color:'#2980b9', padding:'8px 12px', backgroundColor:'#ebf5fb', borderRadius:'4px' }}>
        💡 수정 후 기준정보 저장 버튼을 눌러야 Firestore에 저장됩니다. 노란색 버튼은 기본값에서 수정된 개월수입니다.
      </div>
    </div>
  );
}

export function SettingsModal({ onClose, constructPeriod }) {
  const [activeTab, setActiveTab]   = useState('bondTab');
  const [stdCosts,  setStdCosts]    = useState([]);
  const [artRates,  setArtRates]    = useState([]);
  const [moefCosts, setMoefCosts]           = useState([]);
  const [selectedMoefYear, setSelectedMoefYear] = useState('');
  const [bondRates, setBondRates]             = useState({});            // 국민주택채권 기준
  const [progressRates, setProgressRates]     = useState({});            // 공정율 테이블
  const [taxTables, setTaxTables]             = useState({ transStd: [] });  // 제세금 기준단가
  const [gasRates,   setGasRates]             = useState([]);  // 도시가스 기준단가
  const [waterRates, setWaterRates]           = useState({});  // 상수도 기준단가
  const [sewerRates, setSewerRates]           = useState({});  // 하수도 기준단가
  const [saving,    setSaving]      = useState(false);
  const [loading,   setLoading]     = useState(true);

  // Firestore에서 불러오기
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const stdSnap = await getDoc(doc(db, 'settings', 'stdCost'));
        if (stdSnap.exists()) setStdCosts(stdSnap.data().items || []);
        else setStdCosts([{ year: '2026', cost: '2392000', note: '국토부 고시 (과밀부담금용)' }]);

        const artSnap = await getDoc(doc(db, 'settings', 'artRates'));
        if (artSnap.exists()) {
          // 구버전 nonResidRate → nonResidRate1/nonResidRate2 마이그레이션
          const items = (artSnap.data().items || []).map(r => ({
            ...r,
            nonResidRate1: r.nonResidRate1 || r.nonResidRate || '0.7',
            nonResidRate2: r.nonResidRate2 || r.nonResidRate || '0.5',
          }));
          setArtRates(items);
        } else setArtRates([
          { region: '부산광역시', ordinance: '부산광역시 건축물 미술작품 설치 및 관리에 관한 조례 제5조', residRate: '0.1', nonResidRate1: '0.5', nonResidRate2: '0.5' },
          { region: '서울특별시', ordinance: '서울특별시 공공미술의 설치 및 관리에 관한 조례 제25조 + 시행령 별표2 나목', residRate: '0.1', nonResidRate1: '0.7', nonResidRate2: '0.5' },
        ]);

        const moefSnap = await getDoc(doc(db, 'settings', 'moefStdCost'));
        if (moefSnap.exists()) setMoefCosts(moefSnap.data().items || []);
        else setMoefCosts([
          { year: '2026', usage: '주거용(아파트 등)',  cost: '860000' },
          { year: '2026', usage: '상업용(상가 등)',    cost: '860000' },
          { year: '2026', usage: '공업용(공장 등)',    cost: '840000' },
          { year: '2026', usage: '농수산용',           cost: '640000' },
          { year: '2026', usage: '문화복지/교육',      cost: '860000' },
          { year: '2026', usage: '공공용',             cost: '850000' },
        ]);

        const waterSnap = await getDoc(doc(db, 'settings', 'waterRates'));
        if (waterSnap.exists()) setWaterRates(waterSnap.data() || {});
        else setWaterRates({
          unitCost: [{ year:'2026', large:'926000', medium:'744000', dailyUse:'196', 침두부하율:'1.0', 평균가구원수:'2.38' }],
          mediumPipes: {'15':'749','20':'1663','25':'2972','32':'6050','40':'8349','50':'16234','80':'39437','100':'76411','150':'359302','200':'570082','250':'780861','300':'2316751'},
          smallPipes:  {'15':'310','20':'838','25':'1490','32':'2700','40':'4559','50':'7266'},
        });

        const sewerSnap = await getDoc(doc(db, 'settings', 'sewerRates'));
        if (sewerSnap.exists()) setSewerRates(sewerSnap.data() || {});
        else setSewerRates({ entries: [{ year:'2025', city:'부산', ordinance:'부산광역시 하수도 사용 조례 제10조·제12조', unitCost:'1761000' }] });

        const gasSnap = await getDoc(doc(db, 'settings', 'gasRates'));
        if (gasSnap.exists()) setGasRates(gasSnap.data().items || []);
        else setGasRates([{ year: '2026', city: '부산', rate: '22169', note: '부산 도시가스 공급규정' }]);

        const progressSnap = await getDoc(doc(db, 'settings', 'progressRates'));
        if (progressSnap.exists()) setProgressRates(progressSnap.data() || {});

        const bondSnap = await getDoc(doc(db, 'settings', 'bondRates'));
        if (bondSnap.exists()) setBondRates(bondSnap.data() || {});
        else setBondRates({ buyRate: '50', discRate: '13.5' });

        const taxSnap = await getDoc(doc(db, 'settings', 'taxTables'));
        if (taxSnap.exists()) setTaxTables(taxSnap.data() || { transStd: [] });
        else setTaxTables({
          transStd: [
            { year: '2026', data: [
              { floor: '5층이하',    v40: '1126100', v45: '1145200', v55: '1109500', v60: '1120800' },
              { floor: '6~10층이하', v40: '1209800', v45: '1226100', v55: '1188500', v60: '1192300' },
              { floor: '11~20층이하',v40: '1143000', v45: '1154100', v55: '1119300', v60: '1118800' },
              { floor: '21층이상',   v40: '1162600', v45: '1173800', v55: '1139200', v60: '1138400' },
            ]}
          ]
        });
      } catch(e) { console.error(e); }
      setLoading(false);
    };
    load();
  }, []);

  // Firestore 저장
  const save = async () => {
    setSaving(true);
    try {
      await setDoc(doc(db, 'settings', 'stdCost'),   { items: stdCosts  });
      await setDoc(doc(db, 'settings', 'artRates'),  { items: artRates  });
      await setDoc(doc(db, 'settings', 'moefStdCost'), { items: moefCosts });
      await setDoc(doc(db, 'settings', 'bondRates'), bondRates);
      await setDoc(doc(db, 'settings', 'progressRates'), progressRates);
      await setDoc(doc(db, 'settings', 'taxTables'), taxTables);
      await setDoc(doc(db, 'settings', 'gasRates'),  { items: gasRates });
      await setDoc(doc(db, 'settings', 'waterRates'), waterRates);
      await setDoc(doc(db, 'settings', 'sewerRates'), sewerRates);
      window.dispatchEvent(new CustomEvent('settings-saved'));
      alert('저장됐어요!');
    } catch(e) { alert('저장 실패: ' + e.message); }
    setSaving(false);
  };

  const thStyle = { padding: '8px 12px', backgroundColor: '#f0f0f0', fontWeight: 'bold', fontSize: '12px', borderBottom: '2px solid #ddd', textAlign: 'left' };
  const tdStyle = { padding: '7px 10px', borderBottom: '1px solid #eee', fontSize: '13px', verticalAlign: 'middle' };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ backgroundColor: 'white', borderRadius: '10px', width: '92%', maxWidth: '780px', maxHeight: '88vh', overflowY: 'auto', padding: '24px' }}>

        {/* 헤더 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <h3 style={{ margin: 0 }}>⚙ 기준정보 관리</h3>
            <div style={{ fontSize: '12px', color: '#888', marginTop: '3px' }}>Firestore에 저장 — 모든 프로젝트에서 공유됩니다</div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={save} disabled={saving}
              style={{ padding: '7px 18px', backgroundColor: '#27ae60', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }}>
              {saving ? '저장 중...' : '💾 저장'}
            </button>
            <button onClick={onClose}
              style={{ padding: '7px 14px', border: '1px solid #ddd', borderRadius: '6px', cursor: 'pointer', backgroundColor: 'white', fontSize: '13px' }}>
              ✕ 닫기
            </button>
          </div>
        </div>

        {/* 서브탭 */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', borderBottom: '2px solid #eee' }}>
          {SETTINGS_TABS.map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              style={{
                padding: '7px 16px', border: 'none', cursor: 'pointer', fontSize: '13px',
                backgroundColor: activeTab === t.key ? '#2980b9' : '#ecf0f1',
                color: activeTab === t.key ? 'white' : '#555',
                fontWeight: activeTab === t.key ? 'bold' : 'normal',
                borderRadius: '4px 4px 0 0',
                borderBottom: activeTab === t.key ? '3px solid #1a5276' : '3px solid transparent',
              }}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#888' }}>불러오는 중...</div>
        ) : (
          <>
            {/* 미술작품설치비 탭 — 표준건축비 + 설치요율 */}
            {activeTab === 'progressTab' && (
              <ProgressRateSettings progressRates={progressRates} setProgressRates={setProgressRates} constructPeriod={constructPeriod} />
            )}
            {activeTab === 'bondTab' && (
              <BondRateSettings bondRates={bondRates} setBondRates={setBondRates} thStyle={thStyle} tdStyle={tdStyle} />
            )}

            {activeTab === 'artInstall' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <div>
                    <div style={{ fontWeight: 'bold', fontSize: '14px' }}>🏗 표준건축비 (과밀부담금 산정용)</div>
                    <div style={{ fontSize: '11px', color: '#e74c3c', marginTop: '3px' }}>※ 미술작품설치비 계산에 사용 — 일반 표준건축비와 다름</div>
                  </div>
                  <button onClick={() => setStdCosts([...stdCosts, { year: '', cost: '', note: '' }])}
                    style={{ padding: '6px 14px', backgroundColor: '#2980b9', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>
                    + 연도 추가
                  </button>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={{ ...thStyle, width: '90px' }}>연도</th>
                      <th style={{ ...thStyle, width: '160px' }}>금액 (원/㎡)</th>
                      <th style={thStyle}>비고</th>
                      <th style={{ ...thStyle, width: '60px' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {stdCosts.map((item, i) => (
                      <tr key={i} style={{ backgroundColor: i % 2 === 0 ? 'white' : '#fafafa' }}>
                        <td style={tdStyle}>
                          <input value={item.year} onChange={e => setStdCosts(stdCosts.map((s, idx) => idx === i ? { ...s, year: e.target.value } : s))}
                            placeholder="2026" style={{ width: '70px', padding: '4px 8px', border: '1px solid #ddd', borderRadius: '3px', fontSize: '12px', textAlign: 'right' }} />
                        </td>
                        <td style={tdStyle}>
                          <input value={item.cost} onChange={e => setStdCosts(stdCosts.map((s, idx) => idx === i ? { ...s, cost: e.target.value } : s))}
                            placeholder="2,392,000" style={{ width: '130px', padding: '4px 8px', border: '1px solid #ddd', borderRadius: '3px', fontSize: '12px', textAlign: 'right' }} />
                        </td>
                        <td style={tdStyle}>
                          <input value={item.note} onChange={e => setStdCosts(stdCosts.map((s, idx) => idx === i ? { ...s, note: e.target.value } : s))}
                            placeholder="국토부 고시" style={{ width: '100%', padding: '4px 8px', border: '1px solid #ddd', borderRadius: '3px', fontSize: '12px' }} />
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'center' }}>
                          <button onClick={() => setStdCosts(stdCosts.filter((_, idx) => idx !== i))}
                            style={{ padding: '3px 8px', backgroundColor: '#e74c3c', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer', fontSize: '11px' }}>삭제</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* 구분선 */}
            {activeTab === 'artInstall' && (
              <hr style={{ border: 'none', borderTop: '2px solid #eee', margin: '16px 0' }} />
            )}

            {/* 미술작품설치비 요율 */}
            {activeTab === 'artInstall' && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <div>
                    <div style={{ fontWeight: 'bold', fontSize: '14px' }}>🎨 미술작품설치비 요율 (지역별 조례)</div>
                    <div style={{ fontSize: '11px', color: '#888', marginTop: '3px' }}>※ 문화예술진흥법 시행령 제12조 — 지자체 조례로 별도 정함</div>
                  </div>
                  <button onClick={() => setArtRates([...artRates, { region: '', ordinance: '', residRate: '0.1', nonResidRate1: '0.7', nonResidRate2: '0.5' }])}
                    style={{ padding: '6px 14px', backgroundColor: '#7b1fa2', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>
                    + 지역 추가
                  </button>
                </div>
                {/* 나목 구조 안내 */}
                <div style={{ fontSize: '11px', color: '#555', marginBottom: '12px', padding: '8px 12px', backgroundColor: '#fff8e1', borderRadius: '6px', border: '1px solid #ffe082' }}>
                  📋 <strong>시행령 별표2 나목 (서울·부산 등 자치구 있는 시)</strong><br/>
                  1만㎡ 미만: 면제 | 1만~2만㎡: 전체 × 1구간 요율 | 2만㎡ 초과: (2만 × 1구간) + (초과분 × 2구간) 누진<br/>
                  <span style={{ color: '#888' }}>부산: 조례로 양 구간 0.5% 단일 | 서울: 조례 없음 → 시행령 적용 (1구간 0.7%, 2구간 0.5%)</span>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={{ ...thStyle, width: '100px' }}>지역명</th>
                      <th style={thStyle}>조례명</th>
                      <th style={{ ...thStyle, width: '70px' }}>주거(%)</th>
                      <th style={{ ...thStyle, width: '110px' }}>비주거 1구간(%)<br/><span style={{ fontSize:'10px', fontWeight:'normal', color:'#888' }}>1만~2만㎡</span></th>
                      <th style={{ ...thStyle, width: '110px' }}>비주거 2구간(%)<br/><span style={{ fontSize:'10px', fontWeight:'normal', color:'#888' }}>2만㎡ 초과분</span></th>
                      <th style={{ ...thStyle, width: '50px' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {artRates.map((item, i) => (
                      <tr key={i} style={{ backgroundColor: i % 2 === 0 ? 'white' : '#fafafa' }}>
                        <td style={tdStyle}>
                          <input value={item.region} onChange={e => setArtRates(artRates.map((r, idx) => idx === i ? { ...r, region: e.target.value } : r))}
                            placeholder="부산광역시" style={{ width: '85px', padding: '4px 8px', border: '1px solid #ddd', borderRadius: '3px', fontSize: '12px' }} />
                        </td>
                        <td style={tdStyle}>
                          <input value={item.ordinance} onChange={e => setArtRates(artRates.map((r, idx) => idx === i ? { ...r, ordinance: e.target.value } : r))}
                            placeholder="조례명 입력" style={{ width: '100%', padding: '4px 8px', border: '1px solid #ddd', borderRadius: '3px', fontSize: '12px' }} />
                        </td>
                        <td style={tdStyle}>
                          <input value={item.residRate} onChange={e => setArtRates(artRates.map((r, idx) => idx === i ? { ...r, residRate: e.target.value } : r))}
                            placeholder="0.1" style={{ width: '55px', padding: '4px 8px', border: '1px solid #ddd', borderRadius: '3px', fontSize: '12px', textAlign: 'right' }} />
                        </td>
                        <td style={tdStyle}>
                          <input value={item.nonResidRate1 ?? item.nonResidRate ?? ''} onChange={e => setArtRates(artRates.map((r, idx) => idx === i ? { ...r, nonResidRate1: e.target.value } : r))}
                            placeholder="0.7" style={{ width: '75px', padding: '4px 8px', border: '1px solid #7b1fa2', borderRadius: '3px', fontSize: '12px', textAlign: 'right', color: '#7b1fa2', fontWeight: 'bold' }} />
                        </td>
                        <td style={tdStyle}>
                          <input value={item.nonResidRate2 ?? item.nonResidRate ?? ''} onChange={e => setArtRates(artRates.map((r, idx) => idx === i ? { ...r, nonResidRate2: e.target.value } : r))}
                            placeholder="0.5" style={{ width: '75px', padding: '4px 8px', border: '1px solid #c62828', borderRadius: '3px', fontSize: '12px', textAlign: 'right', color: '#c62828', fontWeight: 'bold' }} />
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'center' }}>
                          <button onClick={() => setArtRates(artRates.filter((_, idx) => idx !== i))}
                            style={{ padding: '3px 8px', backgroundColor: '#e74c3c', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer', fontSize: '11px' }}>삭제</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div style={{ fontSize: '11px', color: '#888', marginTop: '12px', padding: '8px', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
                  💡 서울·부산 외 다른 지역은 "+ 지역 추가" 버튼으로 직접 추가하세요.
                </div>
              </div>
            )}

            {/* 제세금 탭 — 광역교통시설부담금 표준건축비 */}
            {activeTab === 'taxFee' && (
              <TaxFeeTabPanel
                taxTables={taxTables} setTaxTables={setTaxTables}
                gasRates={gasRates} setGasRates={setGasRates}
                waterRates={waterRates} setWaterRates={setWaterRates}
                sewerRates={sewerRates} setSewerRates={setSewerRates}
                thStyle={thStyle} tdStyle={tdStyle}
              />
            )}

                        {/* 부가세안분 탭 — 행안부 신축가격기준액 연도별 */}
            {activeTab === 'vatCalc' && (() => {
              const MOEF_USAGES = ['주거용(아파트 등)','상업용(상가 등)','공업용(공장 등)','농수산용','문화복지/교육','공공용'];
              const moefYears   = [...new Set(moefCosts.map(m => m.year))].filter(Boolean).sort((a,b) => b-a);
              const activeYear  = selectedMoefYear || moefYears[0] || '';
              const yearItems   = moefCosts.filter(m => m.year === activeYear);

              // 연도 추가: 연도 입력 → 기본 용도로 행 생성
              const addYear = () => {
                const input = window.prompt('추가할 연도를 입력하세요 (예: 2027)');
                if (!input || !input.trim()) return;
                const newYear = input.trim();
                if (moefYears.includes(newYear)) { alert(`${newYear}년은 이미 있어요.`); return; }
                const newItems = MOEF_USAGES.map(usage => ({ year: newYear, usage, cost: '' }));
                setMoefCosts([...moefCosts, ...newItems]);
                setSelectedMoefYear(newYear);
              };
              const updateCost = (i, val) => {
                let cnt = 0;
                setMoefCosts(moefCosts.map(m => {
                  if (m.year !== activeYear) return m;
                  return cnt++ === i ? { ...m, cost: val } : m;
                }));
              };
              const deleteYear = (yr) => {
                if (!window.confirm(`${yr}년 데이터를 삭제할까요?`)) return;
                setMoefCosts(moefCosts.filter(m => m.year !== yr));
                setSelectedMoefYear(moefYears.find(y => y !== yr) || '');
              };

              return (
                <div>
                  <div style={{ marginBottom: '14px' }}>
                    <div style={{ fontWeight: 'bold', fontSize: '14px' }}>🏛 행안부 신축가격기준액</div>
                    <div style={{ fontSize: '11px', color: '#888', marginTop: '3px' }}>※ 부가세 안분 계산에 사용 — 행정안전부 매년 고시</div>
                    <div style={{ fontSize: '11px', color: '#e74c3c', marginTop: '2px' }}>※ 과밀부담금용 표준건축비(국토부)와 다름</div>
                  </div>

                  {/* 연도 선택 바 */}
                  <div style={{ display: 'flex', gap: '6px', marginBottom: '16px', alignItems: 'center', flexWrap: 'wrap', borderBottom: '2px solid #eee', paddingBottom: '12px' }}>
                    {moefYears.map(yr => (
                      <div key={yr} style={{ display: 'flex', alignItems: 'center' }}>
                        <button onClick={() => setSelectedMoefYear(yr)}
                          style={{
                            padding: '6px 16px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold',
                            backgroundColor: activeYear === yr ? '#6a1b9a' : '#ecf0f1',
                            color: activeYear === yr ? 'white' : '#555',
                            borderRadius: '4px 0 0 4px',
                            borderBottom: activeYear === yr ? '3px solid #4a148c' : '3px solid transparent',
                          }}>
                          {yr}년
                        </button>
                        <button onClick={() => deleteYear(yr)}
                          style={{
                            padding: '6px 8px', border: 'none', cursor: 'pointer', fontSize: '11px',
                            backgroundColor: activeYear === yr ? '#7b1fa2' : '#ddd',
                            color: activeYear === yr ? 'white' : '#999',
                            borderRadius: '0 4px 4px 0',
                          }}>✕</button>
                      </div>
                    ))}
                    <button onClick={addYear}
                      style={{ padding: '6px 14px', backgroundColor: '#8e44ad', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>
                      + 연도 추가
                    </button>
                  </div>

                  {/* 선택된 연도의 기준가액 입력 */}
                  {activeYear ? (
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#6a1b9a', marginBottom: '10px' }}>
                        {activeYear}년 기준가액 (원/㎡)
                      </div>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr>
                            <th style={{ ...thStyle, textAlign: 'left' }}>용도</th>
                            <th style={{ ...thStyle, width: '180px' }}>기준가액 (원/㎡)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {yearItems.map((item, i) => (
                            <tr key={i} style={{ backgroundColor: i % 2 === 0 ? 'white' : '#fafafa' }}>
                              <td style={{ ...tdStyle, fontWeight: 'bold', color: '#555' }}>
                                {item.usage}
                              </td>
                              <td style={tdStyle}>
                                <input
                                  value={item.cost}
                                  onChange={e => updateCost(i, e.target.value)}
                                  placeholder="예: 860000"
                                  style={{ width: '150px', padding: '5px 8px', border: '1px solid #9c27b0', borderRadius: '3px', fontSize: '13px', textAlign: 'right', color: '#6a1b9a', fontWeight: 'bold' }}
                                />
                                <span style={{ fontSize: '11px', color: '#888', marginLeft: '4px' }}>원/㎡</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', color: '#aaa', padding: '40px', fontSize: '13px' }}>
                      "+ 연도 추가" 버튼으로 연도를 추가하세요
                    </div>
                  )}
                  <div style={{ fontSize: '11px', color: '#888', marginTop: '14px', padding: '8px', backgroundColor: '#f8f9fa', borderRadius: '4px' }}>
                    💡 부가세안분 탭에서 연도/용도 콤보박스로 선택하면 이 값이 자동 적용됩니다.
                  </div>
                </div>
              );
            })()}
          </>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// 용역비 섹션
// ─────────────────────────────────────────────
function ConsultCostSection({ data, onChange, archData, incomeData }) {
  const d = data || {};
  const update = (key, val) => onChange({ ...d, [key]: val });
  const updateFunding = (key, val) => onChange({ ...d, [`${key}_funding`]: val });

  // 건축개요 전체연면적
  const aboveM2      = parseFloat(String(archData?.floorAboveM2 || '').replace(/,/g,'')) || 0;
  const underM2      = parseFloat(String(archData?.floorUnderM2 || '').replace(/,/g,'')) || 0;
  const totalFloorM2 = aboveM2 + underM2;
  const totalFloorPy = totalFloorM2 * 0.3025;

  // 수입탭 apt+offi 전용면적 합계 (인테리어설계비 기준)
  const aptRows  = incomeData?.aptRows  || [];
  const offiRows = incomeData?.offiRows || [];
  const calcExclM2 = rows => rows.reduce((s, r) => {
    const excl  = parseFloat(String(r.excl_m2||'').replace(/,/g,''))||0;
    const units = parseFloat(String(r.units  ||'').replace(/,/g,''))||0;
    return s + excl * units;
  }, 0);
  const autoInteriorM2  = calcExclM2(aptRows) + calcExclM2(offiRows);
  // const autoInteriorPy  = autoInteriorM2 * 0.3025;
  // 수정 가능: d.interiorM2 있으면 그걸 사용
  const interiorM2Raw   = d.interiorM2Override
    ? parseFloat(String(d.interiorM2Override).replace(/,/g,'')) || autoInteriorM2
    : autoInteriorM2;
  const interiorUnit    = d.interiorUnit || '평';
  const interiorArea    = interiorUnit === '평' ? interiorM2Raw * 0.3025 : interiorM2Raw;

  // 각 항목 단위
  const designUnit = d.designUnit || '평';
  const superUnit  = d.superUnit  || '평';
  const cmUnit     = d.cmUnit     || '평';

  // 면적 계산 헬퍼
  const getArea = (unit) => unit === '평' ? totalFloorPy : totalFloorM2;

  // 각 항목 금액
  const designAmt   = (() => {
    const price = parseFloat(String(d.designPrice||'').replace(/,/g,''))||0;
    return Math.round(price * getArea(designUnit));
  })();
  const superAmt    = (() => {
    const price = parseFloat(String(d.superPrice||'').replace(/,/g,''))||0;
    return Math.round(price * getArea(superUnit));
  })();
  const cmAmt       = (() => {
    const price = parseFloat(String(d.cmPrice||'').replace(/,/g,''))||0;
    return Math.round(price * getArea(cmUnit));
  })();
  const assessAmt   = parseFloat(String(d.assessAmt||'').replace(/,/g,'')) || 0;
  const interiorAmt = (() => {
    const price = parseFloat(String(d.interiorPrice||'').replace(/,/g,''))||0;
    return Math.round(price * interiorArea);
  })();

  const etcItems = d.etcItems || [];
  const etcTotal = etcItems.reduce((s, it) => s + (parseFloat(String(it.amt||'').replace(/,/g,''))||0), 0);
  const total    = designAmt + superAmt + cmAmt + assessAmt + interiorAmt + etcTotal;
  const vatTotal = Math.round(
    (!!d.design_taxable?designAmt*0.1:0)+(!!d.super_taxable?superAmt*0.1:0)+
    (!!d.cm_taxable?cmAmt*0.1:0)+(!!d.assess_taxable?assessAmt*0.1:0)+(!!d.interior_taxable?interiorAmt*0.1:0)+
    etcItems.reduce((s,it)=>s+(!!it.taxable?(parseFloat(String(it.amt||'').replace(/,/g,''))||0)*0.1:0),0));

  const tdStyle    = { padding: '6px 8px', borderBottom: '1px solid #eee', verticalAlign: 'middle' };
  const labelStyle = { fontWeight: 'bold', fontSize: '13px', color: '#2c3e50' };
  const addEtc     = () => update('etcItems', [...etcItems, { name: '', amt: '', funding: { equity: '0', pf: '100', sale: '0' } }]);
  const removeEtc  = (i) => update('etcItems', etcItems.filter((_, idx) => idx !== i));
  const updateEtc  = (i, key, val) => update('etcItems', etcItems.map((it, idx) => idx === i ? { ...it, [key]: val } : it));

  // 전체연면적 행 렌더러 (설계비/감리비/CM비 공통)
  const renderFloorRow = (num, label, fundKey, unitKey, priceKey, amt, bg) => {
    const unit = d[unitKey] || '평';
    const price = parseFloat(String(d[priceKey]||'').replace(/,/g,''))||0;
    return (
      <tr style={{ backgroundColor: bg }}>
        <td style={tdStyle}>
          <span style={labelStyle}>{num} {label}</span>
          <TaxBadge checked={!!d[`${fundKey}_taxable`]} onChange={v => update(`${fundKey}_taxable`, v)} />
        </td>
        <td style={tdStyle}>
          <div style={{ fontSize: '11px', color: '#888', marginBottom: '3px' }}>
            📐 전체연면적 = 지상 + 지하
            <span style={{ fontSize: '10px', color: '#aaa', marginLeft: '4px' }}>(건축개요 자동연동)</span>
          </div>
          <div style={{ fontSize: '13px', color: '#2980b9', fontWeight: 'bold' }}>
            {unit === '평'
              ? `${formatNumber(totalFloorPy.toFixed(2))}평 (${formatNumber(totalFloorM2.toFixed(0))}㎡)`
              : `${formatNumber(totalFloorM2.toFixed(0))}㎡ (${formatNumber(totalFloorPy.toFixed(2))}평)`}
          </div>
        </td>
        <td style={tdStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            {numInput(d[priceKey], v => update(priceKey, v), '단가')}
            <UnitToggle unit={unit} setUnit={u => update(unitKey, u)} />
          </div>
          <div style={{ fontSize: '10px', color: '#888', marginTop: '3px' }}>
            {unit === '평'
              ? `≈ ${formatNumber((price/0.3025).toFixed(0))} 천원/㎡`
              : `≈ ${formatNumber((price*0.3025).toFixed(0))} 천원/평`}
          </div>
        </td>
        {(() => { const vc = vatCell(amt, !!d[`${fundKey}_taxable`]); return (<>
          <td style={tdStyle}>{vc.cell}</td>
          <td style={tdStyle}>
            <FundingCell
              funding={d[`${fundKey}_funding`] || { equity: '0', pf: '100', sale: '0' }}
              onChange={v => updateFunding(fundKey, v)}
              totalAmt={vc.totalAmt}
            />
          </td>
        </>); })()}
      </tr>
    );
  };

  return (
    <div>
      {sectionTitle('용역비')}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
        <thead>
          <tr>
            {colHeader('항목', '160px', 'left')}
            {colHeader('근거기준', '170px')}
            {colHeader('단가 (천원)', '160px')}
            {colHeader('금액 (천원)', '150px')}
            {colHeader('재원조달', '140px')}
          </tr>
        </thead>
        <tbody>

          {/* ① 설계비 */}
          {renderFloorRow('①', '설계비', 'design', 'designUnit', 'designPrice', designAmt, 'white')}

          {/* ② 감리비 */}
          {renderFloorRow('②', '감리비', 'super', 'superUnit', 'superPrice', superAmt, '#fafafa')}

          {/* ③ CM비 */}
          {renderFloorRow('③', 'CM비', 'cm', 'cmUnit', 'cmPrice', cmAmt, 'white')}

          {/* ④ 각종 영향평가비 */}
          <tr style={{ backgroundColor: '#fafafa' }}>
            <td style={tdStyle}>
              <span style={labelStyle}>④ 각종 영향평가비</span>
              <TaxBadge checked={!!d.assess_taxable} onChange={v => update('assess_taxable', v)} />
            </td>
            <td style={tdStyle}>
              <div style={{ fontSize: '11px', color: '#888' }}>
                📐 1식 총액 직접입력
              </div>
              <div style={{ fontSize: '10px', color: '#aaa', marginTop: '2px' }}>
                교통·환경·경관 등 합산
              </div>
            </td>
            <td style={{ ...tdStyle, textAlign: 'center' }}>
              <span style={{ fontSize: '11px', color: '#888' }}>—</span>
            </td>
            <td style={tdStyle}>
              {numInput(d.assessAmt, v => update('assessAmt', v), '총액 입력')}
              {!!d.assess_taxable && assessAmt > 0 && (
                <div style={{ fontSize:'10px', color:'#e67e22', textAlign:'right', marginTop:'2px', fontWeight:'bold' }}>
                  VAT {formatNumber(Math.round(assessAmt * 0.1))}
                </div>
              )}
            </td>
            <td style={tdStyle}>
              <FundingCell
                funding={d.assess_funding || { equity: '0', pf: '100', sale: '0' }}
                onChange={v => updateFunding('assess', v)}
                totalAmt={!!d.assess_taxable ? Math.round(assessAmt*1.1) : assessAmt}
              />
            </td>
          </tr>

          {/* ⑤ 인테리어설계비 */}
          <tr style={{ backgroundColor: 'white' }}>
            <td style={tdStyle}>
              <span style={labelStyle}>⑤ 인테리어설계비</span>
              <TaxBadge checked={!!d.interior_taxable} onChange={v => update('interior_taxable', v)} />
            </td>
            <td style={tdStyle}>
              <div style={{ fontSize: '11px', color: '#888', marginBottom: '4px' }}>
                📐 apt+offi 전용면적 합계
                <span style={{ fontSize: '10px', color: '#aaa', marginLeft: '4px' }}>(수입탭 연동)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <div style={{ fontSize: '12px', color: '#2980b9', fontWeight: 'bold' }}>
                  {interiorUnit === '평'
                    ? `${formatNumber((interiorM2Raw*0.3025).toFixed(2))}평`
                    : `${formatNumber(interiorM2Raw.toFixed(0))}㎡`}
                </div>
                <UnitToggle unit={interiorUnit} setUnit={u => update('interiorUnit', u)} />
              </div>
              {/* 수동 override */}
              <div style={{ marginTop: '5px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <input
                  value={d.interiorM2Override || ''}
                  onChange={e => update('interiorM2Override', e.target.value)}
                  placeholder={`자동: ${formatNumber(autoInteriorM2.toFixed(0))}㎡`}
                  style={{
                    width: '120px', padding: '3px 6px', fontSize: '11px',
                    border: `1px solid ${d.interiorM2Override ? '#e74c3c' : '#ddd'}`,
                    borderRadius: '3px', textAlign: 'right',
                    backgroundColor: d.interiorM2Override ? '#fdf2f0' : 'white',
                  }}
                />
                <span style={{ fontSize: '10px', color: '#888' }}>㎡ 직접입력</span>
                {d.interiorM2Override && (
                  <button onClick={() => update('interiorM2Override', '')}
                    style={{ padding: '2px 6px', fontSize: '10px', backgroundColor: '#e74c3c', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer' }}>✕</button>
                )}
              </div>
            </td>
            <td style={tdStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                {numInput(d.interiorPrice, v => update('interiorPrice', v), '단가')}
                <UnitToggle unit={interiorUnit} setUnit={u => update('interiorUnit', u)} />
              </div>
              <div style={{ fontSize: '10px', color: '#888', marginTop: '3px' }}>
                {interiorUnit === '평'
                  ? `≈ ${formatNumber(((parseFloat(String(d.interiorPrice||'').replace(/,/g,''))||0)/0.3025).toFixed(0))} 천원/㎡`
                  : `≈ ${formatNumber(((parseFloat(String(d.interiorPrice||'').replace(/,/g,''))||0)*0.3025).toFixed(0))} 천원/평`}
              </div>
            </td>
            {(() => { const vc = vatCell(interiorAmt, !!d.interior_taxable); return <td style={tdStyle}>{vc.cell}</td>; })()}
            <td style={tdStyle}>
              <FundingCell
                funding={d.interior_funding || { equity: '0', pf: '100', sale: '0' }}
                onChange={v => updateFunding('interior', v)}
                totalAmt={!!d.interior_taxable ? Math.round(interiorAmt*1.1) : interiorAmt}
              />
            </td>
          </tr>

          {/* ⑥ 기타 용역비 (동적) */}
          {etcItems.map((it, i) => (
            <tr key={i} style={{ backgroundColor: i % 2 === 0 ? '#fafafa' : 'white' }}>
              <td style={tdStyle}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <input value={it.name} onChange={e => updateEtc(i, 'name', e.target.value)}
                    placeholder={`기타항목 ${i+1}`}
                    style={{ flex: 1, padding: '5px 8px', border: '1px solid #ddd', borderRadius: '3px', fontSize: '12px' }} />
                  <button onClick={() => removeEtc(i)}
                    style={{ padding: '3px 7px', backgroundColor: '#e74c3c', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer', fontSize: '11px' }}>✕</button>
                </div>
                <TaxBadge checked={!!it.taxable} onChange={v => updateEtc(i, 'taxable', v)} />
              </td>
              <td style={{ ...tdStyle, textAlign: 'center' }}>
                <span style={{ fontSize: '11px', color: '#888' }}>—</span>
              </td>
              <td style={{ ...tdStyle, textAlign: 'center' }}>
                <span style={{ fontSize: '11px', color: '#888' }}>직접입력</span>
              </td>
              <td style={tdStyle}>{numInput(it.amt, v => updateEtc(i, 'amt', v), '금액 입력')}</td>
              <td style={tdStyle}>
                <FundingCell
                  funding={it.funding || { equity: '0', pf: '100', sale: '0' }}
                  onChange={v => updateEtc(i, 'funding', v)}
                  totalAmt={!!it.taxable ? Math.round((parseFloat(String(it.amt||'').replace(/,/g,''))||0)*1.1) : (parseFloat(String(it.amt||'').replace(/,/g,''))||0)}
                />
              </td>
            </tr>
          ))}

          <tr>
            <td colSpan={5} style={{ padding: '8px' }}>
              <button onClick={addEtc}
                style={{ padding: '6px 14px', backgroundColor: '#ecf0f1', border: '1px dashed #bbb', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', color: '#555' }}>
                + 기타 용역비 추가
              </button>
            </td>
          </tr>
        </tbody>

        <tfoot>
          <tr style={{ backgroundColor: '#16a085' }}>
            <td colSpan={3} style={{ padding: '8px 12px', color: 'white', fontWeight: 'bold', fontSize: '13px' }}>
              용역비 합계
            </td>
            <td style={{ padding: '8px 12px', color: 'white', fontWeight: 'bold', fontSize: '14px', textAlign: 'right' }}>
              {formatNumber(total)} 천원
              {vatTotal > 0 && <div style={{ fontSize:'11px', color:'#e67e22', marginTop:'2px' }}>VAT {formatNumber(vatTotal)} 천원 / 합계 {formatNumber(total+vatTotal)} 천원</div>}
            </td>
            <td style={{ padding: '8px 12px' }}>
              {(() => {
                const rows = [
                  { funding: d.design_funding,   amt: designAmt   },
                  { funding: d.super_funding,    amt: superAmt    },
                  { funding: d.cm_funding,       amt: cmAmt       },
                  { funding: d.assess_funding,   amt: assessAmt   },
                  { funding: d.interior_funding, amt: interiorAmt },
                  ...etcItems.map(it => ({ funding: it.funding, amt: parseFloat(String(it.amt||'').replace(/,/g,''))||0 })),
                ];
                const summary = calcFundingSummary(rows);
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    {FUNDING_KEYS.filter(k => summary[k] > 0).map(k => {
                      const c = FUNDING_COLORS[k];
                      return (
                        <span key={k} style={{ fontSize: '11px', padding: '2px 7px', borderRadius: '8px', backgroundColor: c.bg, color: c.color, border: `1px solid ${c.border}`, fontWeight: 'bold' }}>
                          {FUNDING_LABELS[k]} {formatNumber(Math.round(summary[k]))}
                        </span>
                      );
                    })}
                  </div>
                );
              })()}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

// ─────────────────────────────────────────────
// 광역교통시설부담금 계산기 모달
// ─────────────────────────────────────────────
const TRANS_BIZ_TYPES = [
  { key: 'A1', label: '① 택지개발촉진법에 따른 택지개발사업',          formula: 'A' },
  { key: 'A2', label: '② 도시개발법에 따른 도시개발사업',              formula: 'A' },
  { key: 'A3', label: '③ 주택법에 따른 대지조성사업',                  formula: 'A' },
  { key: 'B1', label: '④ 주택법에 따른 주택건설사업 (300세대↑)',       formula: 'B' },
  { key: 'B2', label: '⑤ 도시및주거환경정비법에 따른 재개발·재건축',   formula: 'B' },
  { key: 'C1', label: '⑥ 건축법 제11조 건축허가 (주택+20세대↑, 300세대↓)', formula: 'C' },
];

const TRANS_EXEMPTIONS = [
  { key: 'none',    label: '해당없음 (100% 부과)',         rate: 1.0  },
  { key: 'full',    label: '100% 면제',                   rate: 0.0  },
  { key: 'half',    label: '50% 경감',                    rate: 0.5  },
];

const TRANS_EXEMPTION_DETAIL = {
  full: ['국가/지방자치단체 시행', '공공임대주택 건설', '공익시설 건설'],
  half: ['공공분양주택 건설', '공공성 인정 개발사업'],
};

function TransportModal({ onClose, onApply, archData, incomeData, settingsData, data, onChange }) {
  const d = data || {};
  const update = (key, val) => onChange({ ...d, [key]: val });

  // ── 수입탭 연동 ──
  const aptRows   = incomeData?.aptRows   || [];
  const offiRows  = incomeData?.offiRows  || [];
  const storeRows = incomeData?.storeRows || [];
  const aptUnits  = aptRows.reduce((s, r) => s + (parseFloat(String(r.units||'').replace(/,/g,''))||0), 0);

  // ── 건축법 주상복합 계산식C: 주택인 시설의 건축연면적 합계
  // 오피스텔은 건축물대장상 업무시설(상업용) → 제외 (대법원 판례)
  // 근린상가 → 제외
  // 공동주택(아파트) 공급면적만 포함
  const aptSupplyM2 = aptRows.reduce((s, r) => {
    const excl = parseFloat(String(r.excl_m2||'').replace(/,/g,''))||0;
    const wall = parseFloat(String(r.wall_m2||'').replace(/,/g,''))||0;
    const core = parseFloat(String(r.core_m2||'').replace(/,/g,''))||0;
    const units = parseFloat(String(r.units||'').replace(/,/g,''))||0;
    return s + (excl+wall+core)*units;
  }, 0);
  const aptSupplyM2Real = aptSupplyM2; // 동일 (정리)
  // 주택법 계산식B: 전체 건축연면적 (공동주택+오피스텔+상가 모두)
  const allHousingM2 = [...aptRows, ...offiRows].reduce((s, r) => {
    const excl = parseFloat(String(r.excl_m2||'').replace(/,/g,''))||0;
    const wall = parseFloat(String(r.wall_m2||'').replace(/,/g,''))||0;
    const core = parseFloat(String(r.core_m2||'').replace(/,/g,''))||0;
    const units = parseFloat(String(r.units||'').replace(/,/g,''))||0;
    return s + (excl+wall+core)*units;
  }, 0);

  // ── 건축개요 연동 ──
  const aboveM2 = parseFloat(String(archData?.floorAboveM2||'').replace(/,/g,''))||0;
  const underM2 = parseFloat(String(archData?.floorUnderM2||'').replace(/,/g,''))||0;
  const totalM2 = aboveM2 + underM2;
  const farAreaM2 = parseFloat(String(archData?.farAreaM2||'').replace(/,/g,''))||0;
  const far = parseFloat(String(archData?.far||'').replace(/,/g,''))||0;

  // ── 비수익면적 (건축개요 연동) ──
  const nonRevItems = archData?.nonRevItems || [];
  const nonRevTotal = nonRevItems.reduce((s, it) => s + (parseFloat(it.m2 || '0') || 0), 0);

  // ── 선택값 ──
  const bizType   = d.bizType   || 'C1';
  const exemption = d.exemption || 'none';
  const region    = d.region    || 'local';  // local=지방2%, metro=수도권4%
  const selectedBiz = TRANS_BIZ_TYPES.find(b => b.key === bizType);
  const formula   = selectedBiz?.formula || 'C';
  const exemptRate = TRANS_EXEMPTIONS.find(e => e.key === exemption)?.rate ?? 1.0;
  // 부과율: 계산식A는 수도권30%/지방15%, 계산식B/C는 수도권4%/지방2%
  const chargeRate = formula === 'A'
    ? (region === 'metro' ? 0.30 : 0.15)
    : (region === 'metro' ? 0.04 : 0.02);

  // ── 표준건축비 (기준정보에서 최고단가 자동) ──
  const transStd    = settingsData?.taxTables?.transStd || [];
  const stdYears    = transStd.map(t => t.year).sort((a,b) => b-a);
  const selYear     = d.transStdYear || stdYears[0] || '2026';
  const stdData     = transStd.find(t => t.year === selYear)?.data || [];
  const allCosts    = stdData.flatMap(r => ['v40','v45','v55','v60'].map(k => parseFloat(r[k])||0));
  const maxStdCost  = allCosts.length > 0 ? Math.max(...allCosts) : 1226100;
  const stdCostVal  = d.stdCostOverride ? (parseFloat(String(d.stdCostOverride).replace(/,/g,''))||maxStdCost) : maxStdCost;

  // ── 면적 계산 ──
  const areaA = farAreaM2 * (far / 200);  // 계산식 A
  const areaB = allHousingM2;              // 계산식 B: 주택법 — 공동주택+오피스텔 연면적
  // 계산식 C: 공급면적 - 비수익면적 (건축개요 연동)
  // 계산식C 기준면적: 공동주택 공급면적 - 비수익면적(공동시설 등)
  const areaAutoC = Math.max(0, aptSupplyM2Real - nonRevTotal);
  const areaC = d.areaOverride ? (parseFloat(String(d.areaOverride).replace(/,/g,''))||areaAutoC) : areaAutoC;
  const area  = formula === 'A' ? areaA : formula === 'B' ? areaB : areaC;

  // ── 공제액 ──
  const deduction = parseFloat(String(d.deduction||'0').replace(/,/g,''))||0;

  // ── 최종 계산 ──
  const baseAmt  = Math.round(stdCostVal * chargeRate * area);
  const afterExempt = Math.round(baseAmt * exemptRate);
  const finalAmt = Math.max(0, afterExempt - deduction);

  // 스타일
  const boxStyle = { border: '1px solid #e0e0e0', borderRadius: '8px', padding: '14px 18px', marginBottom: '14px' };
  const stepHd   = (n, t, color='#1565c0') => (
    <div style={{ fontWeight: 'bold', fontSize: '13px', color, marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
      <span style={{ backgroundColor: color, color: 'white', borderRadius: '50%', width: '22px', height: '22px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 'bold', flexShrink: 0 }}>{n}</span>
      {t}
    </div>
  );
  const formula2 = (text) => (
    <div style={{ backgroundColor: '#f8f9fa', border: '1px solid #e9ecef', borderRadius: '4px', padding: '7px 12px', fontFamily: 'monospace', fontSize: '11px', color: '#495057', margin: '4px 0' }}>
      {text}
    </div>
  );

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ backgroundColor: 'white', borderRadius: '10px', width: '92%', maxWidth: '740px', maxHeight: '90vh', overflowY: 'auto', padding: '24px' }}>

        {/* 헤더 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
          <div>
            <h3 style={{ margin: 0, color: '#1565c0' }}>🚌 광역교통시설부담금 계산기</h3>
            <div style={{ fontSize: '11px', color: '#888', marginTop: '3px' }}>대도시권 광역교통 관리에 관한 특별법 제11조의3 (부담금의 산정기준)</div>
          </div>
          <button onClick={onClose} style={{ padding: '6px 14px', border: '1px solid #ddd', borderRadius: '6px', cursor: 'pointer', backgroundColor: 'white', fontSize: '13px' }}>✕ 닫기</button>
        </div>

        {/* 부담금 산출공식 */}
        <div style={{ ...boxStyle, backgroundColor: '#e3f2fd', borderColor: '#90caf9' }}>
          <div style={{ fontWeight: 'bold', fontSize: '13px', color: '#1565c0', marginBottom: '10px' }}>📋 부담금 산출 공식</div>
          {formula2('계산식 A (택지개발/도시개발/대지조성): 표준단가 × 부과율 × 개발면적×(용적율÷200) - 공제액')}
          {formula2('계산식 B (주택법 주택건설/재개발·재건축): 표준단가 × 부과율 × 전체건축연면적(공동주택+오피스텔) - 공제액')}
          {formula2('계산식 C (건축법 건축허가 주상복합): 표준단가 × 부과율 × 주택건축연면적(공동주택만, 오피스텔·상가 제외) - 공제액')}
          <div style={{ fontSize:'11px', color:'#e74c3c', marginTop:'4px' }}>
            ※ 건축법 주상복합: 오피스텔은 건축물대장상 업무시설(상업용)로 분류 → 주택 아님 → 제외 (대도시권광역교통관리특별법 §11의3)
          </div>
          <div style={{ fontSize: '11px', color: '#e74c3c', marginTop: '8px', backgroundColor: '#fff3e0', padding: '6px 10px', borderRadius: '4px' }}>
            💡 공동주택 300세대 이상 → 주택법에 따른 주택건설사업 (계산식 B) /
            300세대 미만 → 건축법 제11조 (계산식 C)<br/>
            현재 프로젝트 공동주택: <strong>{formatNumber(aptUnits)}세대</strong>
            <strong style={{ color: aptUnits >= 300 ? '#e74c3c' : '#27ae60', marginLeft: '6px' }}>
              → {aptUnits >= 300 ? '계산식 B 권장' : '계산식 C 해당'}
            </strong>
          </div>
        </div>

        {/* 납부시기 */}
        <div style={{ ...boxStyle, backgroundColor: '#fff8e1', borderColor: '#ffe082' }}>
          <div style={{ fontWeight: 'bold', fontSize: '13px', color: '#e65100', marginBottom: '8px' }}>⏰ 납부시기</div>
          <div style={{ fontSize: '12px', color: '#555', lineHeight: '1.8' }}>
            <div>• 6천만원 ~ 1억원: 2회 분납 가능 (1년차 50% / 2년차 50%, <strong>준공 전</strong> 납부)</div>
            <div>• 1억원 이상: 3회 분납 가능 (1년차 30% / 2년차 40% / 3년차 30%, <strong>준공 전</strong> 납부)</div>
          </div>
        </div>

        {/* STEP 1 - 사업방식 + 감면 */}
        <div style={boxStyle}>
          {stepHd('1', '사업방식 및 감면 조건 설정')}
          <div style={{ marginBottom: '12px' }}>
            <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '6px' }}>사업방식 선택</label>
            {TRANS_BIZ_TYPES.map(b => (
              <label key={b.key} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', cursor: 'pointer', fontSize: '12px' }}>
                <input type="radio" name="bizType" value={b.key} checked={bizType === b.key} onChange={() => update('bizType', b.key)} />
                <span style={{ color: bizType === b.key ? '#1565c0' : '#555', fontWeight: bizType === b.key ? 'bold' : 'normal' }}>
                  {b.label}
                  <span style={{ fontSize: '10px', color: '#888', marginLeft: '6px' }}>[계산식 {b.formula}]</span>
                </span>
              </label>
            ))}
          </div>
          <div style={{ borderTop: '1px solid #eee', paddingTop: '12px' }}>
            <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '6px' }}>감면 조건</label>
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              {TRANS_EXEMPTIONS.map(e => (
                <label key={e.key} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '12px' }}>
                  <input type="radio" name="exemption" value={e.key} checked={exemption === e.key} onChange={() => update('exemption', e.key)} />
                  <span style={{ color: exemption === e.key ? '#27ae60' : '#555', fontWeight: exemption === e.key ? 'bold' : 'normal' }}>{e.label}</span>
                </label>
              ))}
            </div>
            {exemption !== 'none' && (
              <div style={{ marginTop: '8px', fontSize: '11px', color: '#555', backgroundColor: '#f1f8e9', padding: '8px 12px', borderRadius: '4px' }}>
                <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>해당 조건:</div>
                {TRANS_EXEMPTION_DETAIL[exemption]?.map((item, i) => (
                  <div key={i}>• {item}</div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* STEP 2 - 표준건축비 */}
        <div style={boxStyle}>
          {stepHd('2', '표준단가 관리 (공공건설임대주택 표준건축비)')}
          <div style={{ fontSize: '11px', color: '#e74c3c', marginBottom: '10px' }}>※ 광역교통시설부담금은 「공공건설임대주택 표준건축비」를 적용합니다</div>

          {/* 연도 선택 */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap' }}>
            <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#555' }}>연도:</label>
            <select value={selYear} onChange={e => update('transStdYear', e.target.value)}
              style={{ padding: '5px 10px', border: '1px solid #1565c0', borderRadius: '4px', fontSize: '13px', color: '#1565c0', fontWeight: 'bold' }}>
              {stdYears.map(y => <option key={y} value={y}>{y}년</option>)}
            </select>
            <span style={{ fontSize: '11px', color: '#888' }}>기준정보(⚙)에서 연도별 단가 관리</span>
          </div>

          {/* 매트릭스 테이블 표시 */}
          {stdData.length > 0 && (
            <div style={{ overflowX: 'auto', marginBottom: '12px' }}>
              <table style={{ borderCollapse: 'collapse', fontSize: '11px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#1565c0', color: 'white' }}>
                    <th style={{ padding: '5px 8px', whiteSpace: 'nowrap' }}>층수/건용면적</th>
                    {['40㎡이하','40~50㎡','50~60㎡','60㎡초과'].map(c => (
                      <th key={c} style={{ padding: '5px 8px', whiteSpace: 'nowrap' }}>{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {stdData.map((row, i) => (
                    <tr key={i} style={{ backgroundColor: i%2===0 ? 'white' : '#f5f5f5' }}>
                      <td style={{ padding: '4px 8px', fontWeight: 'bold', fontSize: '11px' }}>{row.floor}</td>
                      {['v40','v45','v55','v60'].map(k => (
                        <td key={k} style={{ padding: '4px 8px', textAlign: 'right', color: parseFloat(row[k]||0) === maxStdCost ? '#e74c3c' : '#333', fontWeight: parseFloat(row[k]||0) === maxStdCost ? 'bold' : 'normal' }}>
                          {formatNumber(row[k])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* 적용단가 */}
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#555' }}>적용 단가(최고):</div>
            <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#e74c3c' }}>{formatNumber(maxStdCost)} 원/㎡</div>
            <input
              value={d.stdCostOverride || ''}
              onChange={e => update('stdCostOverride', e.target.value)}
              placeholder={`자동: ${formatNumber(maxStdCost)}`}
              style={{ width: '130px', padding: '5px 8px', border: `1px solid ${d.stdCostOverride ? '#e74c3c' : '#ddd'}`, borderRadius: '3px', fontSize: '12px', textAlign: 'right', backgroundColor: d.stdCostOverride ? '#fdf2f0' : 'white' }}
            />
            {d.stdCostOverride && <button onClick={() => update('stdCostOverride', '')} style={{ padding: '3px 8px', fontSize: '11px', backgroundColor: '#e74c3c', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer' }}>자동</button>}
            <div style={{ fontSize: '11px', color: '#888' }}>실제 적용: <strong style={{ color: '#1565c0' }}>{formatNumber(stdCostVal)} 원/㎡</strong></div>
          </div>
        </div>

        {/* STEP 3 - 지역/부과율 */}
        <div style={boxStyle}>
          {stepHd('3', '지역 선택 (부과율)', '#2e7d32')}
          <div style={{ fontSize: '11px', color: '#888', marginBottom: '10px' }}>대도시권 광역교통 관리에 관한 특별법 시행령 제16조의2 제8항</div>
          <div style={{ backgroundColor: '#fff3e0', padding: '8px 12px', borderRadius: '4px', marginBottom: '12px', fontSize: '12px', color: '#e65100' }}>
            {formula === 'A'
              ? '⚠ 계산식 A 적용: 수도권 30% / 지방 15% (시행령 제16조의2 제8항 제1호)'
              : '계산식 B/C 적용: 수도권 4% / 지방 2% (시행령 제16조의2 제8항 제2호)'}
          </div>
          <div style={{ display: 'flex', gap: '20px' }}>
            {(formula === 'A' ? [
              { key: 'metro', label: '수도권 (30%)', color: '#c62828' },
              { key: 'local', label: '지방 (15%)',   color: '#2e7d32' },
            ] : [
              { key: 'metro', label: '수도권 (4%)', color: '#c62828' },
              { key: 'local', label: '지방 (2%)',   color: '#2e7d32' },
            ]).map(r => (
              <label key={r.key} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold' }}>
                <input type="radio" name="region" value={r.key} checked={region === r.key} onChange={() => update('region', r.key)} />
                <span style={{ color: region === r.key ? r.color : '#555' }}>{r.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* STEP 4 - 수치 입력 */}
        <div style={boxStyle}>
          {stepHd('4', '수치 입력', '#6a1b9a')}

          {/* 면적 */}
          <div style={{ marginBottom: '12px' }}>
            <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#555', marginBottom: '6px' }}>
              면적 ({formula === 'A' ? '개발면적×(용적율÷200)' : formula === 'B' ? '건축연면적' : '공동주택 공급면적 합계'})
            </div>
            {formula === 'C' && (
              <div style={{ marginBottom: '6px' }}>
                <div style={{ fontSize: '11px', color: '#2980b9', fontWeight: 'bold' }}>
                  📐 수입탭 자동연동 — 공동주택 공급면적: {formatNumber(aptSupplyM2Real.toFixed(2))}㎡
                  <span style={{ color: '#888', fontWeight: 'normal', marginLeft: '8px' }}>({formatNumber(aptUnits)}세대)</span>
                </div>
                {nonRevTotal > 0 && (
                  <div style={{ fontSize: '11px', color: '#7b1fa2', marginTop: '3px', fontWeight: 'bold' }}>
                    📐 건축개요 비수익면적: - {formatNumber(nonRevTotal.toFixed(2))}㎡
                    → 적용면적: {formatNumber(areaAutoC.toFixed(2))}㎡
                  </div>
                )}
                <div style={{ fontSize: '10px', color: '#888', marginTop: '4px', backgroundColor: '#f8f9fa', padding: '6px 10px', borderRadius: '4px', lineHeight: '1.8' }}>
                  📋 시행령 제16조의2 제7항 — 건축연면적(주택인 시설)에서 제외되는 항목:<br/>
                  • 지하층(주거용 제외) + 건축물 내 주차장<br/>
                  • 부대시설 및 복리시설 (주택법 제2조제13·14호)<br/>
                  • 주민공동시설<br/>
                  • 국민주택규모 이하 임대주택 연면적<br/>
                  • 리모델링의 경우 종전 건축물 연면적<br/>
                  <span style={{ color: '#e74c3c' }}>※ 본 계산에서는 공급면적 그대로 적용</span>
                </div>
              </div>
            )}
            {formula === 'B' && (
              <div style={{ marginBottom: '6px' }}>
                <div style={{ fontSize: '11px', color: '#2980b9', fontWeight: 'bold' }}>
                  📐 수입탭 자동연동 — 공동주택 공급면적: {formatNumber(aptSupplyM2Real.toFixed(2))}㎡
                </div>
                <div style={{ fontSize: '10px', color: '#888', marginTop: '4px', backgroundColor: '#f8f9fa', padding: '6px 10px', borderRadius: '4px', lineHeight: '1.8' }}>
                  📋 시행령 제16조의2 제6항 — 건축연면적에서 제외되는 항목:<br/>
                  • 지하층(주거용 제외) + 건축물 내 주차장<br/>
                  • 공용 청사 + 각급학교<br/>
                  • 부대시설 및 복리시설 / 주민공동시설<br/>
                  • 국민주택규모 이하 임대주택 연면적<br/>
                  • 재개발·재건축·소규모정비·리모델링 종전 건축물 연면적<br/>
                  • 도심복합개발·공공주택복합·혁신지구재생 종전 건축물 연면적<br/>
                  <span style={{ color: '#e74c3c' }}>※ 본 계산에서는 공급면적 그대로 적용</span>
                </div>
              </div>
            )}
            {formula === 'A' && (
              <div style={{ marginBottom: '6px' }}>
                <div style={{ fontSize: '11px', color: '#2980b9', fontWeight: 'bold' }}>
                  📐 건축개요 자동연동: 용적률산정면적 {formatNumber(farAreaM2.toFixed(2))}㎡ × ({formatNumber(far)}÷200) = {formatNumber(areaA.toFixed(2))}㎡
                </div>
                <div style={{ fontSize: '10px', color: '#888', marginTop: '4px', backgroundColor: '#f8f9fa', padding: '6px 10px', borderRadius: '4px', lineHeight: '1.8' }}>
                  📋 시행령 제16조의2 제1항 — 개발면적에서 제외되는 용지:<br/>
                  • 국가/지자체 무상귀속 또는 기부채납 용지<br/>
                  • 임대주택 건설용지<br/>
                  • 이주대책에 따른 주택지/주택 건설용지<br/>
                  • 공용 청사용지 + 각급학교 용지<br/>
                  <span style={{ color: '#e74c3c' }}>※ 본 계산에서는 자동연동 면적 그대로 적용</span>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                value={formula === 'C' ? (d.areaOverride || '') : ''}
                onChange={e => formula === 'C' ? update('areaOverride', e.target.value) : null}
                readOnly={formula !== 'C'}
                placeholder={formula === 'C' ? `자동: ${formatNumber(aptSupplyM2Real.toFixed(0))}㎡` : '건축개요 자동연동'}
                style={{ width: '160px', padding: '6px 10px', border: `1px solid ${d.areaOverride && formula==='C' ? '#e74c3c' : '#ddd'}`, borderRadius: '4px', fontSize: '13px', textAlign: 'right', backgroundColor: formula !== 'C' ? '#f8f9fa' : 'white' }}
              />
              <span style={{ fontSize: '12px', color: '#888' }}>㎡</span>
              {d.areaOverride && formula === 'C' && (
                <button onClick={() => update('areaOverride', '')} style={{ padding: '4px 8px', fontSize: '11px', backgroundColor: '#e74c3c', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer' }}>자동</button>
              )}
              <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#1565c0' }}>실제 적용: {formatNumber(area.toFixed(2))}㎡</span>
            </div>
          </div>

          {/* 공제액 */}
          <div>
            <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '6px' }}>공제액 (원)</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <input value={d.deduction || '0'} onChange={e => update('deduction', e.target.value)}
                style={{ width: '160px', padding: '6px 10px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '13px', textAlign: 'right' }} />
              <span style={{ fontSize: '12px', color: '#888' }}>원</span>
            </div>
            <div style={{ fontSize: '11px', color: '#888', backgroundColor: '#f8f9fa', padding: '8px 12px', borderRadius: '4px', lineHeight: '1.8' }}>
              📋 공제 가능 항목 (시행령 제16조의2 제4항):<br/>
              • 도시철도/철도 건설비용 부담액<br/>
              • 고속국도·자동차전용도로·일반국도 등 설치비용<br/>
              • 주차장·공영차고지·BRT·환승센터 설치비용<br/>
              <span style={{ color: '#e74c3c' }}>※ 공제 인정 시 관할 시·도지사에게 증명서류 제출 필요</span>
            </div>
          </div>
        </div>

        {/* 계산 결과 */}
        <div style={{ backgroundColor: '#1565c0', borderRadius: '8px', padding: '16px 20px' }}>
          <div style={{ color: 'white', fontSize: '13px', marginBottom: '10px', fontWeight: 'bold' }}>계산 결과</div>
          <div style={{ backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '6px', padding: '10px 14px', fontFamily: 'monospace', fontSize: '12px', color: '#e3f2fd', marginBottom: '12px' }}>
            {formatNumber(stdCostVal)} × {(chargeRate*100).toFixed(0)}% × {formatNumber(area.toFixed(2))}㎡
            {exemption !== 'none' && ` × ${(exemptRate*100).toFixed(0)}%`}
            {deduction > 0 && ` - ${formatNumber(deduction)}`}
            {' = '}<strong style={{ color: '#fff59d' }}>{formatNumber(finalAmt)} 원</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ color: '#90caf9', fontSize: '12px' }}>= {formatNumber(Math.round(finalAmt/1000))} 천원</div>
              {exemption !== 'none' && <div style={{ color: '#a5d6a7', fontSize: '11px', marginTop: '2px' }}>감면 전: {formatNumber(baseAmt)}원 → {TRANS_EXEMPTIONS.find(e=>e.key===exemption)?.label}</div>}
            </div>
            <button onClick={() => { onApply(Math.round(finalAmt/1000), d); onClose(); }}
              style={{ padding: '10px 24px', backgroundColor: '#27ae60', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold' }}>
              💾 사업비 반영
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// 도시가스시설분담금 계산기 모달
// ─────────────────────────────────────────────
const GAS_METER_GRADES = [
  { grade: '2.5', consumption: 2.5, usage: '소형 빌라, 오피스텔 (취사+난방)' },
  { grade: '4',   consumption: 4.0, usage: '일반 아파트, 단독주택 (취사+난방)' },
  { grade: '6',   consumption: 6.0, usage: '대형 평수 주택, 소규모 식당' },
  { grade: '10',  consumption: 10.0, usage: '중형 식당, 영업용 시설' },
  { grade: '16',  consumption: 16.0, usage: '대형 식당, 상업 시설' },
  { grade: '25',  consumption: 25.0, usage: '대형 상업 시설' },
  { grade: '40',  consumption: 40.0, usage: '산업용' },
  { grade: '65',  consumption: 65.0, usage: '산업용' },
  { grade: '100', consumption: 100.0, usage: '산업용' },
];

const GAS_USAGE_TYPES = [
  { key: 'office',  label: '일반/클리닉',  defaultCoef: '0.05', desc: '사무실, 의원 등 (바닥난방+온수 정도)' },
  { key: 'mixed',   label: '복합상가',     defaultCoef: '0.15', desc: '카페, 미용실, 편의점 등 (온수+가벼운 화구)' },
  { key: 'food',    label: '전문식당가',   defaultCoef: '0.30', desc: '한식, 중식, 일식 등 (대형 화구+고화력 렌지)' },
];

function GasModal({ onClose, onApply, archData, incomeData, settingsData, data, onChange }) {
  const d = data || {};
  const update = (key, val) => onChange({ ...d, [key]: val });

  // 기준정보 연동
  const gasRates   = settingsData?.gasRates || [{ year: '2026', city: '부산', rate: '22169' }];
  const years      = [...new Set(gasRates.map(r => r.year))].sort((a,b) => b-a);
  const selYear    = d.gasYear || years[0] || '2026';
  const selCity    = d.gasCity || '부산';
  const cityItems  = gasRates.filter(r => r.year === selYear);
  const cityRate   = cityItems.find(r => r.city === selCity) || cityItems[0];
  const unitPrice  = d.unitPriceOverride
    ? parseFloat(String(d.unitPriceOverride).replace(/,/g,''))||0
    : parseFloat(cityRate?.rate)||22169;

  // 수입탭 연동
  const aptRows    = incomeData?.aptRows    || [];
  const offiRows   = incomeData?.offiRows   || [];
  const publicRows = incomeData?.publicRows || [];  // 공공주택
  const storeRows  = incomeData?.storeRows  || [];
  const pubfacRows = incomeData?.pubfacRows || [];  // 공공시설

  const aptUnits    = aptRows.reduce((s,r)    => s + (parseFloat(String(r.units||'').replace(/,/g,''))||0), 0);
  const offiUnits   = offiRows.reduce((s,r)   => s + (parseFloat(String(r.units||'').replace(/,/g,''))||0), 0);
  const publicUnits = publicRows.reduce((s,r) => s + (parseFloat(String(r.units||'').replace(/,/g,''))||0), 0);
  const resUnits    = aptUnits + offiUnits + publicUnits;

  // 주거용 타입별 등급 자동결정 (전용면적 평 기준)
  // 25평 이하 → 4등급(4), 26~39평 → 6등급(6), 40평 이상 → 10등급(10)
  const getResGrade = (exclM2) => {
    const py = exclM2 * 0.3025;
    if (py <= 25) return { grade: '4',  consumption: 4.0  };
    if (py <= 39) return { grade: '6',  consumption: 6.0  };
    return             { grade: '10', consumption: 10.0 };
  };

  // 타입별 소비량 계산 (공동주택 + 오피스텔 + 공공주택)
  const resTypeRows = [...aptRows, ...offiRows, ...publicRows].map(r => {
    const exclM2 = parseFloat(String(r.excl_m2||'').replace(/,/g,''))||0;
    const units  = parseFloat(String(r.units||'').replace(/,/g,''))||0;
    const grade  = getResGrade(exclM2);
    return { exclM2, exclPy: exclM2*0.3025, units, ...grade, consumption_total: grade.consumption * units };
  });
  const resConsumptionTotal = resTypeRows.reduce((s,r) => s + r.consumption_total, 0);

  // 계약면적 계산 헬퍼
  const calcContM2 = (rows) => rows.reduce((s,r) => {
    const excl=parseFloat(String(r.excl_m2||'').replace(/,/g,''))||0;
    const wall=parseFloat(String(r.wall_m2||'').replace(/,/g,''))||0;
    const core=parseFloat(String(r.core_m2||'').replace(/,/g,''))||0;
    const mgmt=parseFloat(String(r.mgmt_m2||'').replace(/,/g,''))||0;
    const comm=parseFloat(String(r.comm_m2||'').replace(/,/g,''))||0;
    const park=parseFloat(String(r.park_m2||'').replace(/,/g,''))||0;
    const tel=parseFloat(String(r.tel_m2||'').replace(/,/g,''))||0;
    const elec=parseFloat(String(r.elec_m2||'').replace(/,/g,''))||0;
    const units=parseFloat(String(r.units||'').replace(/,/g,''))||0;
    return s + (excl+wall+core+mgmt+comm+park+tel+elec)*units;
  }, 0);

  // 상가 + 공공시설 계약면적 (㎡ → 평)
  const storeM2Auto  = calcContM2(storeRows);
  const pubfacM2Auto = calcContM2(pubfacRows);
  const storeM2AutoTotal = storeM2Auto + pubfacM2Auto;  // 합산
  const hasPubfac = pubfacM2Auto > 0;

  const storeAreaM2 = d.storeAreaOverride
    ? parseFloat(String(d.storeAreaOverride).replace(/,/g,''))||storeM2AutoTotal
    : storeM2AutoTotal;
  const storeAreaPy = storeAreaM2 * 0.3025;

  // 주거용 계량기 등급 (테이블 하이라이트용)
  // const resMeterGrade = d.resMeterGrade || '4';

  // 업종별 비율/계수
  const getVal = (key, def) => parseFloat(String(d[key]||def).replace(/,/g,''))||parseFloat(def)||0;
  const officeRatio  = getVal('officeRatio',  '10');
  const mixedRatio   = getVal('mixedRatio',   '50');
  const foodRatio    = getVal('foodRatio',    '40');
  const pubfacRatio  = getVal('pubfacRatio',  '0');   // 공공시설 비율
  const ratioSum     = officeRatio + mixedRatio + foodRatio + pubfacRatio;

  const officeCoef   = getVal('officeCoef',  '0.05');
  const mixedCoef    = getVal('mixedCoef',   '0.15');
  const foodCoef     = getVal('foodCoef',    '0.30');
  const pubfacCoef   = getVal('pubfacCoef',  '0.05'); // 공공시설: 6등급 수준

  // 계산
  const resConsumption = resConsumptionTotal;
  const resFee         = Math.round(unitPrice * resConsumption);

  const weightedFactor = (officeRatio/100)*officeCoef + (mixedRatio/100)*mixedCoef + (foodRatio/100)*foodCoef + (pubfacRatio/100)*pubfacCoef;
  const storeCapacity  = storeAreaPy * weightedFactor;
  const storeFee       = Math.round(unitPrice * storeCapacity);

  const totalFee = resFee + storeFee;

  // 스타일
  const boxStyle = { border:'1px solid #e0e0e0', borderRadius:'8px', padding:'14px 18px', marginBottom:'14px' };
  const stepHd = (n, t, color='#e65100') => (
    <div style={{ fontWeight:'bold', fontSize:'13px', color, marginBottom:'10px', display:'flex', alignItems:'center', gap:'8px' }}>
      <span style={{ backgroundColor:color, color:'white', borderRadius:'50%', width:'22px', height:'22px', display:'inline-flex', alignItems:'center', justifyContent:'center', fontSize:'12px', flexShrink:0 }}>{n}</span>
      {t}
    </div>
  );
  const fmtN = (v) => formatNumber(Math.round(v));

  return (
    <div style={{ position:'fixed', top:0, left:0, width:'100vw', height:'100vh', backgroundColor:'rgba(0,0,0,0.5)', zIndex:2000, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ backgroundColor:'white', borderRadius:'10px', width:'92%', maxWidth:'720px', maxHeight:'90vh', overflowY:'auto', padding:'24px' }}>

        {/* 헤더 */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'18px' }}>
          <div>
            <h3 style={{ margin:0, color:'#e65100' }}>🔥 도시가스시설분담금 계산기</h3>
            <div style={{ fontSize:'11px', color:'#888', marginTop:'3px' }}>도시별 도시가스 공급규정 — 일반시설분담금</div>
            <div style={{ fontSize:'11px', color:'#888' }}>계산식: 기준단가(원/㎥) × 표준가스소비량(㎥/hr)</div>
          </div>
          <button onClick={onClose} style={{ padding:'6px 14px', border:'1px solid #ddd', borderRadius:'6px', cursor:'pointer', backgroundColor:'white', fontSize:'13px' }}>✕ 닫기</button>
        </div>

        {/* 납부시기 */}
        <div style={{ ...boxStyle, backgroundColor:'#fff8e1', borderColor:'#ffe082' }}>
          <div style={{ fontWeight:'bold', fontSize:'13px', color:'#e65100', marginBottom:'6px' }}>⏰ 납부시기</div>
          <div style={{ fontSize:'12px', color:'#555' }}>가스공급 계약체결 시 또는 시설본 공사 착수전</div>
        </div>

        {/* 공통설정 */}
        <div style={boxStyle}>
          {stepHd('1', '공통 설정 (기준정보 연동)')}
          <div style={{ display:'flex', gap:'16px', alignItems:'flex-end', flexWrap:'wrap' }}>
            <div>
              <label style={{ fontSize:'12px', fontWeight:'bold', color:'#555', display:'block', marginBottom:'4px' }}>기준연도</label>
              <select value={selYear} onChange={e => update('gasYear', e.target.value)}
                style={{ padding:'6px 10px', border:'1px solid #e65100', borderRadius:'4px', fontSize:'13px', color:'#e65100', fontWeight:'bold' }}>
                {years.map(y => <option key={y} value={y}>{y}년</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize:'12px', fontWeight:'bold', color:'#555', display:'block', marginBottom:'4px' }}>도시</label>
              <select value={selCity} onChange={e => update('gasCity', e.target.value)}
                style={{ padding:'6px 10px', border:'1px solid #e65100', borderRadius:'4px', fontSize:'13px' }}>
                {cityItems.map(c => <option key={c.city} value={c.city}>{c.city}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize:'12px', fontWeight:'bold', color:'#e65100', display:'block', marginBottom:'4px' }}>기준단가 (원/㎥)</label>
              <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
                <input value={d.unitPriceOverride || ''} onChange={e => update('unitPriceOverride', e.target.value)}
                  placeholder={formatNumber(parseFloat(cityRate?.rate)||22169)}
                  style={{ width:'110px', padding:'6px 8px', border:`1px solid ${d.unitPriceOverride?'#e74c3c':'#e65100'}`, borderRadius:'4px', fontSize:'13px', textAlign:'right', color:'#e65100', fontWeight:'bold', backgroundColor: d.unitPriceOverride?'#fdf2f0':'white' }} />
                {d.unitPriceOverride && <button onClick={() => update('unitPriceOverride','')} style={{ padding:'3px 8px', fontSize:'11px', backgroundColor:'#e74c3c', color:'white', border:'none', borderRadius:'3px', cursor:'pointer' }}>자동</button>}
                <span style={{ fontSize:'11px', color:'#888' }}>실제: {fmtN(unitPrice)}원</span>
              </div>
              <div style={{ fontSize:'10px', color:'#888', marginTop:'2px' }}>{cityRate?.note}</div>
            </div>
          </div>
        </div>

        {/* 계량기 등급 테이블 */}
        <div style={{ ...boxStyle, backgroundColor:'#f8f9fa' }}>
          {stepHd('2', '계량기 등급별 표준가스소비량 (별표1, 제6조제2항)')}
          <div style={{ overflowX:'auto' }}>
            <table style={{ borderCollapse:'collapse', fontSize:'12px', width:'100%' }}>
              <thead>
                <tr style={{ backgroundColor:'#e65100', color:'white' }}>
                  <th style={{ padding:'6px 10px', whiteSpace:'nowrap' }}>등급</th>
                  {GAS_METER_GRADES.map(m => (
                    <th key={m.grade} style={{ padding:'6px 10px', whiteSpace:'nowrap' }}>
                      {m.grade}등급
                    </th>
                  ))}
                </tr>
                <tr style={{ backgroundColor:'#fff3e0' }}>
                  <td style={{ padding:'5px 10px', fontWeight:'bold', fontSize:'11px' }}>소비량(N㎥/h)</td>
                  {GAS_METER_GRADES.map(m => (
                    <td key={m.grade} style={{ padding:'5px 10px', textAlign:'right' }}>
                      {m.consumption}
                    </td>
                  ))}
                </tr>
              </thead>
            </table>
          </div>
        </div>

        {/* 주거용 */}
        <div style={boxStyle}>
          {stepHd('3', publicRows.length > 0 ? '주거용 (공동주택 + 오피스텔 + 공공주택)' : '주거용 (공동주택 + 오피스텔)')}
          <div style={{ fontSize:'11px', color:'#888', marginBottom:'10px' }}>
            전용면적 기준 자동 등급 결정: 25평 이하→4등급(4N㎥/h) / 26~39평→6등급(6N㎥/h) / 40평↑→10등급(10N㎥/h)
          </div>

          {/* 타입별 상세 */}
          <div style={{ overflowX:'auto', marginBottom:'10px' }}>
            <table style={{ borderCollapse:'collapse', fontSize:'12px', width:'100%' }}>
              <thead>
                <tr style={{ backgroundColor:'#1565c0', color:'white' }}>
                  <th style={{ padding:'5px 10px', textAlign:'left' }}>타입 (전용㎡)</th>
                  <th style={{ padding:'5px 10px' }}>전용(평)</th>
                  <th style={{ padding:'5px 10px' }}>등급</th>
                  <th style={{ padding:'5px 10px' }}>소비량(N㎥/h)</th>
                  <th style={{ padding:'5px 10px' }}>세대수</th>
                  <th style={{ padding:'5px 10px' }}>소계(N㎥/h)</th>
                </tr>
              </thead>
              <tbody>
                {resTypeRows.map((r, i) => (
                  <tr key={i} style={{ backgroundColor: i%2===0?'white':'#f5f5f5' }}>
                    <td style={{ padding:'4px 10px' }}>{formatNumber(r.exclM2.toFixed(2))}㎡</td>
                    <td style={{ padding:'4px 10px', textAlign:'right' }}>{formatNumber(r.exclPy.toFixed(2))}평</td>
                    <td style={{ padding:'4px 10px', textAlign:'center', fontWeight:'bold', color:'#1565c0' }}>{r.grade}등급</td>
                    <td style={{ padding:'4px 10px', textAlign:'right' }}>{r.consumption}</td>
                    <td style={{ padding:'4px 10px', textAlign:'right' }}>{formatNumber(r.units)}세대</td>
                    <td style={{ padding:'4px 10px', textAlign:'right', fontWeight:'bold', color:'#1565c0' }}>{formatNumber(r.consumption_total.toFixed(1))}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ backgroundColor:'#e3f2fd', fontWeight:'bold' }}>
                  <td colSpan={4} style={{ padding:'5px 10px', fontSize:'12px' }}>합계 ({fmtN(resUnits)}세대)</td>
                  <td style={{ padding:'5px 10px', textAlign:'right' }}>{fmtN(resUnits)}</td>
                  <td style={{ padding:'5px 10px', textAlign:'right', color:'#1565c0' }}>{formatNumber(resConsumption.toFixed(1))}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div style={{ backgroundColor:'#e3f2fd', padding:'8px 12px', borderRadius:'4px', fontSize:'12px' }}>
            총 소비량: <strong style={{ color:'#1565c0' }}>{formatNumber(resConsumption.toFixed(1))} N㎥/h</strong>
            &nbsp;&nbsp;→&nbsp;&nbsp;
            분담금: <strong style={{ color:'#1565c0' }}>{fmtN(resFee)} 원</strong>
            <span style={{ color:'#888', marginLeft:'4px' }}>= {fmtN(resFee/1000)} 천원</span>
          </div>
        </div>

        {/* 상가용 */}
        <div style={boxStyle}>
          {stepHd('4', hasPubfac ? '상가용 (근린상가 + 공공시설)' : '상가용 (근린상가)')}

          {/* 면적 */}
          <div style={{ marginBottom:'14px' }}>
            <label style={{ fontSize:'12px', fontWeight:'bold', color:'#555', display:'block', marginBottom:'4px' }}>
              {hasPubfac ? '상가 + 공공시설 계약면적 (수입탭 자동연동)' : '상가 계약면적 (수입탭 자동연동)'}
            </label>
            <div style={{ fontSize:'11px', color:'#2980b9', marginBottom:'6px' }}>
              {hasPubfac ? (
                <>자동: 근린상가 {fmtN(storeM2Auto)}㎡ + 공공시설 {fmtN(pubfacM2Auto)}㎡ = {fmtN(storeM2AutoTotal)}㎡ = {formatNumber((storeM2AutoTotal*0.3025).toFixed(2))}평</>
              ) : (
                <>자동: {fmtN(storeM2Auto)}㎡ = {formatNumber((storeM2Auto*0.3025).toFixed(2))}평</>
              )}
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
              <input value={d.storeAreaOverride||''} onChange={e => update('storeAreaOverride', e.target.value)}
                placeholder={`자동: ${fmtN(storeM2AutoTotal)}㎡`}
                style={{ width:'140px', padding:'5px 8px', border:`1px solid ${d.storeAreaOverride?'#e74c3c':'#ddd'}`, borderRadius:'4px', fontSize:'13px', textAlign:'right', backgroundColor:d.storeAreaOverride?'#fdf2f0':'white' }} />
              <span style={{ fontSize:'12px', color:'#888' }}>㎡</span>
              {d.storeAreaOverride && <button onClick={() => update('storeAreaOverride','')} style={{ padding:'4px 8px', fontSize:'11px', backgroundColor:'#e74c3c', color:'white', border:'none', borderRadius:'3px', cursor:'pointer' }}>자동</button>}
              <span style={{ fontSize:'12px', fontWeight:'bold', color:'#e65100' }}>= {formatNumber(storeAreaPy.toFixed(2))}평 적용</span>
            </div>
          </div>

          {/* 업종별 비율/계수 */}
          <div style={{ fontSize:'12px', fontWeight:'bold', color:'#555', marginBottom:'8px' }}>업종별 구성 비율 및 평당 소비량 계수</div>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'12px', marginBottom:'10px' }}>
            <thead>
              <tr style={{ backgroundColor:'#e65100', color:'white' }}>
                <th style={{ padding:'6px 10px', textAlign:'left' }}>업종</th>
                <th style={{ padding:'6px 10px', textAlign:'left', fontSize:'11px' }}>특성</th>
                <th style={{ padding:'6px 10px', textAlign:'right', width:'100px' }}>비율 (%)</th>
                <th style={{ padding:'6px 10px', textAlign:'right', width:'130px' }}>계수 (㎥/hr·평)</th>
              </tr>
            </thead>
            <tbody>
              {[
                { key:'office', label:'일반/클리닉', desc:'사무실·의원 (6등급 수준, 바닥난방+온수)',    ratioKey:'officeRatio', coefKey:'officeCoef', defR:'10', defC:'0.05', val: officeRatio, coef: officeCoef },
                { key:'mixed',  label:'복합상가',    desc:'카페·미용실·편의점 (10등급 수준, 온수+화구)', ratioKey:'mixedRatio',  coefKey:'mixedCoef',  defR:'50', defC:'0.15', val: mixedRatio,  coef: mixedCoef  },
                { key:'food',   label:'전문식당가',  desc:'한·중·일식 (16등급 수준, 대형화구+고화력)',   ratioKey:'foodRatio',   coefKey:'foodCoef',   defR:'40', defC:'0.30', val: foodRatio,   coef: foodCoef   },
                ...(hasPubfac ? [
                  { key:'pubfac', label:'공공시설', desc:'사무·복지시설 (6등급 수준, 바닥난방+온수)',   ratioKey:'pubfacRatio', coefKey:'pubfacCoef', defR:'0',  defC:'0.05', val: pubfacRatio, coef: pubfacCoef },
                ] : []),
              ].map((row, i) => (
                <tr key={row.key} style={{ backgroundColor: row.key==='pubfac'?'#e8f4fd': i%2===0?'white':'#fafafa' }}>
                  <td style={{ padding:'6px 10px', fontWeight:'bold', color: row.key==='pubfac'?'#1a5276':undefined }}>{row.label}</td>
                  <td style={{ padding:'6px 10px', fontSize:'11px', color:'#888' }}>{row.desc}</td>
                  <td style={{ padding:'4px 8px', textAlign:'right' }}>
                    <input value={d[row.ratioKey]??row.defR} onChange={e => update(row.ratioKey, e.target.value)}
                      style={{ width:'70px', padding:'4px 8px', border:`1px solid ${ratioSum===100?'#ddd':'#e74c3c'}`, borderRadius:'3px', fontSize:'13px', textAlign:'right', fontWeight:'bold', color: ratioSum===100?'#333':'#e74c3c' }} />
                    <span style={{ marginLeft:'4px', fontSize:'11px', color:'#888' }}>%</span>
                  </td>
                  <td style={{ padding:'4px 8px', textAlign:'right' }}>
                    <input value={d[row.coefKey]??row.defC} onChange={e => update(row.coefKey, e.target.value)}
                      readOnly={row.key==='pubfac'}
                      style={{ width:'80px', padding:'4px 8px', border:'1px solid #e65100', borderRadius:'3px', fontSize:'13px', textAlign:'right', color:'#e65100', fontWeight:'bold', backgroundColor: row.key==='pubfac'?'#fff8e1':'white' }} />
                  </td>
                </tr>
              ))}
              <tr style={{ backgroundColor:'#fff3e0', fontWeight:'bold' }}>
                <td colSpan={2} style={{ padding:'6px 10px', fontSize:'12px' }}>합계 / 통합 가중계수</td>
                <td style={{ padding:'6px 10px', textAlign:'right', color: ratioSum===100?'#27ae60':'#e74c3c', fontWeight:'bold' }}>
                  {ratioSum}% {ratioSum!==100 && '⚠ 100% 아님'}
                </td>
                <td style={{ padding:'6px 10px', textAlign:'right', color:'#e65100', fontWeight:'bold' }}>
                  {weightedFactor.toFixed(4)} ㎥/hr·평
                </td>
              </tr>
            </tbody>
          </table>

          <div style={{ backgroundColor:'#fff3e0', padding:'8px 12px', borderRadius:'4px', fontSize:'12px' }}>
            권장용량: {formatNumber(storeAreaPy.toFixed(2))}평 × {weightedFactor.toFixed(4)} = <strong style={{ color:'#e65100' }}>{formatNumber(storeCapacity.toFixed(1))} N㎥/h</strong>
            &nbsp;&nbsp;→&nbsp;&nbsp;
            분담금: <strong style={{ color:'#e65100' }}>{fmtN(storeFee)} 원</strong>
            <span style={{ color:'#888', marginLeft:'4px' }}>= {fmtN(storeFee/1000)} 천원</span>
          </div>
        </div>

        {/* 합계 + 반영 */}
        <div style={{ backgroundColor:'#e65100', borderRadius:'8px', padding:'16px 20px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div>
            <div style={{ color:'white', fontSize:'13px', fontWeight:'bold' }}>도시가스시설분담금 합계</div>
            <div style={{ color:'#ffccbc', fontSize:'11px', marginTop:'3px' }}>
              주거분 {fmtN(resFee/1000)}천원 + 상가분 {fmtN(storeFee/1000)}천원
            </div>
          </div>
          <div style={{ display:'flex', gap:'10px', alignItems:'center' }}>
            <div style={{ fontSize:'20px', fontWeight:'bold', color:'white' }}>{fmtN(totalFee/1000)} 천원</div>
            <button
              onClick={() => { if (ratioSum!==100) { alert('업종 비율 합계가 100%가 되어야 합니다.'); return; } onApply(Math.round(totalFee/1000), d); onClose(); }}
              style={{ padding:'10px 24px', backgroundColor:'#27ae60', color:'white', border:'none', borderRadius:'6px', cursor:'pointer', fontSize:'14px', fontWeight:'bold' }}>
              💾 사업비 반영
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// 상수도원인자부담금 계산기 모달
// ─────────────────────────────────────────────
const WATER_PIPE_SIZES_MEDIUM = ['15','20','25','32','40','50','80','100','150','200','250','300'];
const WATER_PIPE_SIZES_SMALL  = ['15','20','25','32','40','50'];
const WATER_PIPE_USE = {
  '15':'1.01','20':'2.24','25':'4.00','32':'8.13','40':'11.22','50':'21.82',
  '80':'53.01','100':'102.70','150':'482.93','200':'766.24','250':'1049.54','300':'3113.91'
};

const WATER_BIZ_TYPES = [
  { key:'large',  label:'대규모 개발사업',
    desc:'가. 도시의 개발사업(주택법, 도시개발법 등)\n나. 산업입지 및 산업단지 조성사업\n다. 항만·공항·관광단지·특정지역 개발사업\n라. 국방·군사시설의 설치사업',
    formula:'단위사업비(총자산/시설용량) × 사업계획서 수돗물사용량' },
  { key:'medium', label:'중규모 개발사업',
    desc:'가. 주거시설(오피스텔 포함): 30세대 이상\n나. 숙박시설: 연면적 600㎡ 이상 또는 객실 15실 이상\n다. 판매·업무·의료·근생: 연면적 1,000㎡ 이상\n라. 공장시설: 연면적 1,500㎡ 이상\n마. 기타시설: 연면적 2,000㎡ 이상',
    formula:'주거: 349천원/세대 또는 단위사업비×사용량 / 비주거: 구경별 고정 또는 단위사업비×사용량' },
  { key:'small',  label:'소규모 개발사업',
    desc:'• 기준: 1일 수돗물 사용량 20㎥ 미만인 사업\n• 80㎜ 이상: 중규모 구경별 원인자부담금 적용\n• 50㎜ 이하: 별도 소규모 구경별 원인자부담금 적용\n※ 공동주택/오피스텔 30세대 미만: 15㎜ 구경 적용, 세대별 산정',
    formula:'구경별 고정금액 적용' },
];

function WaterModal({ onClose, onApply, archData, incomeData, settingsData, data, onChange }) {
  const d = data || {};
  const update = (key, val) => onChange({ ...d, [key]: val });

  // 기준정보 연동 (연도×지역 구조)
  const waterRates = settingsData?.waterRates || {};
  const entries    = waterRates?.entries || [{ year:'2026', city:'부산', ordinance:'부산광역시 상수도 원인자부담금 징수 조례 제5조·제6조', large:'926000', medium:'744000', dailyUse:'196', peakRate:'1.0', avgPerson:'2.38' }];
  const years      = [...new Set(entries.map(e=>e.year))].sort((a,b)=>b-a);
  const selYear    = d.waterYear || years[0] || '2026';
  const cities     = entries.filter(e=>e.year===selYear).map(e=>e.city);
  const selCity    = d.waterCity || cities[0] || '부산';
  const unitData   = entries.find(e=>e.year===selYear && e.city===selCity) || entries.find(e=>e.year===selYear) || {};
  const largeUnit  = parseFloat(unitData.large||'926000');
  const mediumUnit = parseFloat(unitData.medium||'744000');
  const dailyUse   = parseFloat(unitData.dailyUse||'196');
  const peakRate   = parseFloat(unitData.peakRate||'1.0');
  const avgPerson  = parseFloat(unitData.avgPerson||'2.38');
  const ordinance  = unitData.ordinance || '상수도 원인자부담금 징수 조례';
  const DEFAULT_MED = {'15':'749','20':'1663','25':'2972','32':'6050','40':'8349','50':'16234','80':'39437','100':'76411','150':'359302','200':'570082','250':'780861','300':'2316751'};
  const DEFAULT_SM  = {'15':'310','20':'838','25':'1490','32':'2700','40':'4559','50':'7266'};
  const medPipes   = unitData.mediumPipes || DEFAULT_MED;
  const smPipes    = unitData.smallPipes  || DEFAULT_SM;

  // 수입탭 연동
  const aptRows   = incomeData?.aptRows   || [];
  const offiRows  = incomeData?.offiRows  || [];
  const aptUnits  = aptRows.reduce((s,r)  => s+(parseFloat(String(r.units||'').replace(/,/g,''))||0), 0);
  const offiUnits = offiRows.reduce((s,r) => s+(parseFloat(String(r.units||'').replace(/,/g,''))||0), 0);
  const resUnits  = aptUnits + offiUnits;

  // 선택값
  const bizType       = d.bizType       || 'medium';
  const resMethod     = d.resMethod     || '1';   // 1=세대당고정, 2=단위사업비
  const nonResMethod  = d.nonResMethod  || '1';   // 1=구경별고정, 2=단위사업비
  const pipeSizeKey   = d.pipeSizeKey   || '40';
  const selectedBiz   = WATER_BIZI_TYPES_MAP[bizType] || WATER_BIZ_TYPES[1];

  // 주거 계산
  const resFee1 = 349 * resUnits;  // 방식①
  const resUsePerHH = (dailyUse/1000) * avgPerson * peakRate * 0.47; // 1세대당 사용량(㎥/일) 근사
  const resFee2 = Math.round(mediumUnit/1000 * resUsePerHH * resUnits); // 방식②
  const resFeeAmt = resMethod==='1' ? resFee1 : resFee2;

  // 비주거 계산 (중규모)
  const pipeUseM3 = parseFloat(WATER_PIPE_USE[pipeSizeKey]||'11.22');
  const nonResFee1 = parseFloat(medPipes[pipeSizeKey]||'8349');   // 방식① 구경별 고정
  const nonResFee2 = Math.round(mediumUnit/1000 * pipeUseM3);      // 방식②
  const nonResFeeAmt = nonResMethod==='1' ? nonResFee1 : nonResFee2;

  // 소규모 구경별
  const smFee = parseFloat(smPipes[pipeSizeKey]||'4559');

  const totalFee = (bizType==='small') ? smFee : (resFeeAmt + nonResFeeAmt);

  const boxStyle = { border:'1px solid #e0e0e0', borderRadius:'8px', padding:'14px 18px', marginBottom:'14px' };
  const stepHd = (n, t, color='#1565c0') => (
    <div style={{ fontWeight:'bold', fontSize:'13px', color, marginBottom:'10px', display:'flex', alignItems:'center', gap:'8px' }}>
      <span style={{ backgroundColor:color, color:'white', borderRadius:'50%', width:'22px', height:'22px', display:'inline-flex', alignItems:'center', justifyContent:'center', fontSize:'12px', flexShrink:0 }}>{n}</span>
      {t}
    </div>
  );
  const fmtN = (v) => formatNumber(Math.round(v));

  return (
    <div style={{ position:'fixed', top:0, left:0, width:'100vw', height:'100vh', backgroundColor:'rgba(0,0,0,0.5)', zIndex:2000, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ backgroundColor:'white', borderRadius:'10px', width:'92%', maxWidth:'760px', maxHeight:'90vh', overflowY:'auto', padding:'24px' }}>

        {/* 헤더 */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'18px' }}>
          <div>
            <h3 style={{ margin:0, color:'#1565c0' }}>💧 상수도 원인자부담금 계산기</h3>
            <div style={{ fontSize:'11px', color:'#888', marginTop:'3px' }}>{ordinance}</div>
          </div>
          <button onClick={onClose} style={{ padding:'6px 14px', border:'1px solid #ddd', borderRadius:'6px', cursor:'pointer', backgroundColor:'white', fontSize:'13px' }}>✕ 닫기</button>
        </div>

        {/* 납부시기 */}
        <div style={{ ...boxStyle, backgroundColor:'#fff8e1', borderColor:'#ffe082' }}>
          <div style={{ fontWeight:'bold', fontSize:'13px', color:'#e65100', marginBottom:'6px' }}>⏰ 납부시기</div>
          <div style={{ fontSize:'12px', color:'#555' }}>사용승인 전</div>
        </div>

        {/* 기준연도 선택 */}
        <div style={{ ...boxStyle, backgroundColor:'#f8f9fa' }}>
          <div style={{ display:'flex', gap:'16px', alignItems:'center', flexWrap:'wrap' }}>
            <div>
              <label style={{ fontSize:'12px', fontWeight:'bold', color:'#555', display:'block', marginBottom:'4px' }}>기준연도</label>
              <select value={selYear} onChange={e => update('waterYear', e.target.value)}
                style={{ padding:'6px 10px', border:'1px solid #1565c0', borderRadius:'4px', fontSize:'13px', color:'#1565c0', fontWeight:'bold' }}>
                {years.map(y => <option key={y} value={y}>{y}년</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize:'12px', fontWeight:'bold', color:'#555', display:'block', marginBottom:'4px' }}>지역</label>
              <select value={selCity} onChange={e => update('waterCity', e.target.value)}
                style={{ padding:'6px 10px', border:'1px solid #1565c0', borderRadius:'4px', fontSize:'13px', color:'#1565c0', fontWeight:'bold' }}>
                {cities.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div style={{ fontSize:'12px', color:'#555', lineHeight:'1.8' }}>
              <div>대규모 단위사업비: <strong style={{ color:'#1565c0' }}>{fmtN(largeUnit)}원/㎥</strong></div>
              <div>중규모 단위사업비: <strong style={{ color:'#1565c0' }}>{fmtN(mediumUnit)}원/㎥</strong></div>
              <div>1인1일 최대급수량: <strong style={{ color:'#1565c0' }}>{dailyUse}L</strong> | 첨두부하율: <strong style={{ color:'#1565c0' }}>{peakRate}</strong></div>
            </div>
          </div>
        </div>

        {/* STEP 1 - 사업규모 선택 */}
        <div style={boxStyle}>
          {stepHd('1', '사업규모 선택')}
          {WATER_BIZ_TYPES.map(bt => (
            <div key={bt.key} style={{ marginBottom:'10px' }}>
              <label style={{ display:'flex', alignItems:'flex-start', gap:'10px', cursor:'pointer' }}>
                <input type="radio" name="waterBizType" value={bt.key} checked={bizType===bt.key} onChange={() => update('bizType', bt.key)} style={{ marginTop:'3px', flexShrink:0 }} />
                <div>
                  <div style={{ fontWeight:'bold', fontSize:'13px', color: bizType===bt.key ? '#1565c0' : '#555' }}>{bt.label}</div>
                  <div style={{ fontSize:'11px', color:'#888', marginTop:'3px', whiteSpace:'pre-line' }}>{bt.desc}</div>
                  {bizType===bt.key && (
                    <div style={{ fontSize:'11px', color:'#1565c0', marginTop:'4px', backgroundColor:'#e3f2fd', padding:'4px 8px', borderRadius:'4px' }}>
                      📋 적용 산식: {bt.formula}
                    </div>
                  )}
                </div>
              </label>
            </div>
          ))}
        </div>

        {/* STEP 2 - 주거시설 (중규모) */}
        {bizType === 'medium' && (
          <div style={boxStyle}>
            {stepHd('2', '주거시설 — 공동주택 / 오피스텔')}
            <div style={{ fontSize:'11px', color:'#2980b9', marginBottom:'10px', fontWeight:'bold' }}>
              세대수: {fmtN(resUnits)}세대 (공동주택 {fmtN(aptUnits)} + 오피스텔 {fmtN(offiUnits)}) — 수입탭 자동연동
            </div>
            {[
              { val:'1', label:'① 세대당 고정 (349천원/세대)', result: resFee1,
                desc: `349천원 × ${fmtN(resUnits)}세대 = ${fmtN(resFee1)}천원` },
              { val:'2', label:'② 단위사업비 × 사용량',        result: resFee2,
                desc: `744천원/㎥ × 0.470㎥/세대 × ${fmtN(resUnits)}세대 = ${fmtN(resFee2)}천원` },
            ].map(m => (
              <label key={m.val} style={{ display:'flex', alignItems:'flex-start', gap:'8px', marginBottom:'8px', cursor:'pointer' }}>
                <input type="radio" name="resMethod" value={m.val} checked={resMethod===m.val} onChange={() => update('resMethod', m.val)} style={{ marginTop:'3px' }} />
                <div>
                  <div style={{ fontWeight:'bold', fontSize:'12px', color: resMethod===m.val?'#1565c0':'#555' }}>{m.label}</div>
                  <div style={{ fontSize:'11px', color:'#888', marginTop:'2px' }}>{m.desc}</div>
                  {resMethod===m.val && (
                    <div style={{ fontSize:'13px', fontWeight:'bold', color:'#1565c0', marginTop:'4px' }}>→ {fmtN(m.result)} 천원</div>
                  )}
                </div>
              </label>
            ))}
          </div>
        )}

        {/* STEP 3 - 비주거시설 (중규모) */}
        {bizType === 'medium' && (
          <div style={boxStyle}>
            {stepHd('3', '비주거시설 — 근린상가 (일반건축물)')}

            {/* 계량기 구경 선택 */}
            <div style={{ marginBottom:'12px' }}>
              <label style={{ fontSize:'12px', fontWeight:'bold', color:'#555', display:'block', marginBottom:'6px' }}>계량기 구경 선택</label>
              <select value={pipeSizeKey} onChange={e => update('pipeSizeKey', e.target.value)}
                style={{ padding:'6px 10px', border:'1px solid #1565c0', borderRadius:'4px', fontSize:'13px', color:'#1565c0', fontWeight:'bold' }}>
                {WATER_PIPE_SIZES_MEDIUM.map(s => (
                  <option key={s} value={s}>{s}㎜ (일최대사용량: {WATER_PIPE_USE[s]}㎥/일)</option>
                ))}
              </select>
            </div>

            {/* 중규모 구경별 테이블 */}
            <div style={{ overflowX:'auto', marginBottom:'12px' }}>
              <table style={{ borderCollapse:'collapse', fontSize:'11px' }}>
                <thead>
                  <tr style={{ backgroundColor:'#1565c0', color:'white' }}>
                    <th style={{ padding:'5px 8px' }}>구분</th>
                    {WATER_PIPE_SIZES_MEDIUM.map(s => (
                      <th key={s} style={{ padding:'5px 8px', whiteSpace:'nowrap',
                        backgroundColor: s===pipeSizeKey ? '#0d47a1' : '#1565c0' }}>
                        {s}㎜
                      </th>
                    ))}
                  </tr>
                  <tr style={{ backgroundColor:'#e3f2fd' }}>
                    <td style={{ padding:'4px 8px', fontWeight:'bold', fontSize:'11px' }}>부담금(천원)</td>
                    {WATER_PIPE_SIZES_MEDIUM.map(s => (
                      <td key={s} style={{ padding:'4px 8px', textAlign:'right',
                        fontWeight: s===pipeSizeKey?'bold':'normal',
                        color: s===pipeSizeKey?'#1565c0':'#333' }}>
                        {formatNumber(medPipes[s]||'')}
                      </td>
                    ))}
                  </tr>
                  <tr style={{ backgroundColor:'#f8f9fa' }}>
                    <td style={{ padding:'4px 8px', fontSize:'11px', color:'#888' }}>사용량(㎥/일)</td>
                    {WATER_PIPE_SIZES_MEDIUM.map(s => (
                      <td key={s} style={{ padding:'4px 8px', textAlign:'right', fontSize:'11px', color:'#888' }}>
                        {WATER_PIPE_USE[s]}
                      </td>
                    ))}
                  </tr>
                </thead>
              </table>
            </div>

            {[
              { val:'1', label:`① 구경별 고정 (${pipeSizeKey}㎜)`, result: nonResFee1,
                desc: `${pipeSizeKey}㎜ 구경 고정금액 = ${fmtN(nonResFee1)}천원 (사용량 ${pipeUseM3}㎥/일)` },
              { val:'2', label:'② 단위사업비 × 사용량', result: nonResFee2,
                desc: `744천원/㎥ × ${pipeUseM3}㎥/일 = ${fmtN(nonResFee2)}천원` },
            ].map(m => (
              <label key={m.val} style={{ display:'flex', alignItems:'flex-start', gap:'8px', marginBottom:'8px', cursor:'pointer' }}>
                <input type="radio" name="nonResMethod" value={m.val} checked={nonResMethod===m.val} onChange={() => update('nonResMethod', m.val)} style={{ marginTop:'3px' }} />
                <div>
                  <div style={{ fontWeight:'bold', fontSize:'12px', color: nonResMethod===m.val?'#1565c0':'#555' }}>{m.label}</div>
                  <div style={{ fontSize:'11px', color:'#888', marginTop:'2px' }}>{m.desc}</div>
                  {nonResMethod===m.val && (
                    <div style={{ fontSize:'13px', fontWeight:'bold', color:'#1565c0', marginTop:'4px' }}>→ {fmtN(m.result)} 천원</div>
                  )}
                </div>
              </label>
            ))}
          </div>
        )}

        {/* 소규모 */}
        {bizType === 'small' && (
          <div style={boxStyle}>
            {stepHd('2', '소규모 — 구경별 원인자부담금 (50㎜ 이하)')}
            <div style={{ overflowX:'auto', marginBottom:'12px' }}>
              <table style={{ borderCollapse:'collapse', fontSize:'12px' }}>
                <thead>
                  <tr style={{ backgroundColor:'#7b1fa2', color:'white' }}>
                    <th style={{ padding:'5px 8px' }}>구분</th>
                    {WATER_PIPE_SIZES_SMALL.map(s => (
                      <th key={s} style={{ padding:'5px 8px', backgroundColor: s===pipeSizeKey?'#4a148c':'#7b1fa2' }}>{s}㎜</th>
                    ))}
                  </tr>
                  <tr style={{ backgroundColor:'#f3e5f5' }}>
                    <td style={{ padding:'4px 8px', fontWeight:'bold', fontSize:'11px' }}>부담금(천원)</td>
                    {WATER_PIPE_SIZES_SMALL.map(s => (
                      <td key={s} style={{ padding:'4px 8px', textAlign:'right', fontWeight:s===pipeSizeKey?'bold':'normal', color:s===pipeSizeKey?'#7b1fa2':'#333' }}>
                        {formatNumber(smPipes[s]||'')}
                      </td>
                    ))}
                  </tr>
                </thead>
              </table>
            </div>
            <div style={{ marginBottom:'8px' }}>
              <label style={{ fontSize:'12px', fontWeight:'bold', color:'#555', display:'block', marginBottom:'6px' }}>계량기 구경 선택</label>
              <select value={pipeSizeKey} onChange={e => update('pipeSizeKey', e.target.value)}
                style={{ padding:'6px 10px', border:'1px solid #7b1fa2', borderRadius:'4px', fontSize:'13px', color:'#7b1fa2', fontWeight:'bold' }}>
                {WATER_PIPE_SIZES_SMALL.map(s => <option key={s} value={s}>{s}㎜ — {formatNumber(smPipes[s]||'')}천원</option>)}
              </select>
            </div>
            <div style={{ fontSize:'11px', color:'#888', backgroundColor:'#f8f9fa', padding:'8px', borderRadius:'4px' }}>
              ※ 공동주택/오피스텔 30세대 미만: 15㎜ 구경 적용, 세대별 산정
            </div>
          </div>
        )}

        {/* 합계 + 반영 */}
        <div style={{ backgroundColor:'#1565c0', borderRadius:'8px', padding:'16px 20px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div>
            <div style={{ color:'white', fontSize:'13px', fontWeight:'bold' }}>상수도 원인자부담금 합계</div>
            {bizType==='medium' && (
              <div style={{ color:'#90caf9', fontSize:'11px', marginTop:'3px' }}>
                주거시설 {fmtN(resFeeAmt)}천원 + 비주거시설 {fmtN(nonResFeeAmt)}천원
              </div>
            )}
          </div>
          <div style={{ display:'flex', gap:'10px', alignItems:'center' }}>
            <div style={{ fontSize:'20px', fontWeight:'bold', color:'white' }}>{fmtN(totalFee)} 천원</div>
            <button onClick={() => { onApply(Math.round(totalFee), d); onClose(); }}
              style={{ padding:'10px 24px', backgroundColor:'#27ae60', color:'white', border:'none', borderRadius:'6px', cursor:'pointer', fontSize:'14px', fontWeight:'bold' }}>
              💾 사업비 반영
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

// 사업규모 타입 맵
const WATER_BIZI_TYPES_MAP = Object.fromEntries(WATER_BIZ_TYPES.map(t => [t.key, t]));

// ─────────────────────────────────────────────
// 하수도 기준정보 설정
// ─────────────────────────────────────────────
function SewerRateSettings({ sewerRates, setSewerRates, thStyle, tdStyle }) {
  const entries  = sewerRates?.entries || [{ year:'2025', city:'부산', ordinance:'부산광역시 하수도 사용 조례 제10조·제12조', unitCost:'1761000' }];
  const years    = [...new Set(entries.map(e=>e.year))].filter(Boolean).sort((a,b)=>b-a);
  const [selYear, setSelYear] = useState(years[0]||'');
  const activeYear = selYear || years[0] || '';
  const yearEntries = entries.filter(e=>e.year===activeYear);
  const cities   = yearEntries.map(e=>e.city);
  const [selCity, setSelCity] = useState(cities[0]||'');
  const activeCity  = selCity || cities[0] || '';
  const activeEntry = yearEntries.find(e=>e.city===activeCity) || yearEntries[0] || {};

  const updateEntry = (key, val) => setSewerRates({ ...sewerRates, entries: entries.map(e =>
    e.year===activeYear && e.city===activeCity ? {...e,[key]:val} : e
  )});
  const addEntry = () => {
    const yr   = window.prompt('추가할 연도를 입력하세요 (예: 2026)');
    if (!yr?.trim()) return;
    const city = window.prompt('도시명을 입력하세요 (예: 부산)') || '부산';
    if (entries.find(e=>e.year===yr.trim()&&e.city===city.trim())) { alert('이미 있어요.'); return; }
    setSewerRates({ ...sewerRates, entries: [...entries, {
      year:yr.trim(), city:city.trim(),
      ordinance:`${city.trim()} 하수도 사용 조례`,
      unitCost:'1761000',
    }]});
    setSelYear(yr.trim()); setSelCity(city.trim());
  };
  const deleteEntry = () => {
    if (!window.confirm(`${activeYear}년 ${activeCity} 데이터를 삭제할까요?`)) return;
    const newEntries = entries.filter(e=>!(e.year===activeYear&&e.city===activeCity));
    setSewerRates({ ...sewerRates, entries: newEntries });
    setSelCity(newEntries.find(e=>e.year===activeYear)?.city || '');
  };

  return (
    <div>
      <div style={{ marginBottom:'14px' }}>
        <div style={{ fontWeight:'bold', fontSize:'14px' }}>🚿 하수도 원인자부담금 기준단가</div>
        <div style={{ fontSize:'11px', color:'#888', marginTop:'3px' }}>※ 하수도법 제61조 / 지역별 하수도 사용 조례 — 매년 공고</div>
      </div>

      {/* 연도 탭 */}
      <div style={{ display:'flex', gap:'6px', marginBottom:'12px', alignItems:'center', flexWrap:'wrap', borderBottom:'2px solid #eee', paddingBottom:'10px' }}>
        {years.map(yr => (
          <button key={yr} onClick={() => { setSelYear(yr); setSelCity(entries.find(e=>e.year===yr)?.city||''); }}
            style={{ padding:'6px 16px', border:'none', cursor:'pointer', fontSize:'13px', fontWeight:'bold',
              backgroundColor: activeYear===yr ? '#6a1b9a' : '#ecf0f1',
              color: activeYear===yr ? 'white' : '#555', borderRadius:'4px' }}>
            {yr}년
          </button>
        ))}
        <button onClick={addEntry}
          style={{ padding:'6px 14px', backgroundColor:'#6a1b9a', color:'white', border:'none', borderRadius:'4px', cursor:'pointer', fontSize:'12px', fontWeight:'bold' }}>
          + 연도/지역 추가
        </button>
      </div>

      {/* 지역 탭 */}
      {activeYear && (
        <div style={{ display:'flex', gap:'4px', marginBottom:'16px', alignItems:'center', flexWrap:'wrap' }}>
          {cities.map(c => (
            <button key={c} onClick={() => setSelCity(c)}
              style={{ padding:'5px 14px', border:'none', cursor:'pointer', fontSize:'12px',
                backgroundColor: activeCity===c ? '#4a148c' : '#f3e5f5',
                color: activeCity===c ? 'white' : '#6a1b9a',
                fontWeight: activeCity===c ? 'bold' : 'normal', borderRadius:'4px' }}>
              {c}
            </button>
          ))}
          <button onClick={() => {
            const city = window.prompt(`${activeYear}년에 추가할 도시명`);
            if (!city?.trim()) return;
            setSewerRates({ ...sewerRates, entries: [...entries, { year:activeYear, city:city.trim(), ordinance:`${city.trim()} 하수도 사용 조례`, unitCost:'1761000' }]});
            setSelCity(city.trim());
          }} style={{ padding:'5px 10px', backgroundColor:'#f3e5f5', border:'1px dashed #ce93d8', borderRadius:'4px', cursor:'pointer', fontSize:'11px', color:'#6a1b9a' }}>
            + 도시 추가
          </button>
          <button onClick={deleteEntry}
            style={{ padding:'5px 10px', backgroundColor:'#ffebee', border:'1px solid #ef9a9a', borderRadius:'4px', cursor:'pointer', fontSize:'11px', color:'#c62828' }}>
            🗑 삭제
          </button>
        </div>
      )}

      {activeEntry.year ? (
        <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
          <div>
            <label style={{ fontSize:'12px', fontWeight:'bold', color:'#555', display:'block', marginBottom:'4px' }}>근거 조례명</label>
            <input value={activeEntry.ordinance||''} onChange={e=>updateEntry('ordinance',e.target.value)}
              style={{ width:'100%', padding:'6px 10px', border:'1px solid #ce93d8', borderRadius:'4px', fontSize:'12px' }}
              placeholder="예: 부산광역시 하수도 사용 조례 제10조·제12조" />
          </div>
          <div>
            <label style={{ fontSize:'12px', fontWeight:'bold', color:'#6a1b9a', display:'block', marginBottom:'4px' }}>
              단위단가 (원/㎥) — 개별건축물 원인자부담금 (조례 제10조)
            </label>
            <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
              <input value={activeEntry.unitCost||''} onChange={e=>updateEntry('unitCost',e.target.value)}
                style={{ width:'160px', padding:'6px 10px', border:'1px solid #6a1b9a', borderRadius:'4px', fontSize:'14px', textAlign:'right', color:'#6a1b9a', fontWeight:'bold' }}
                placeholder="1761000" />
              <span style={{ fontSize:'12px', color:'#888' }}>원/㎥</span>
              <span style={{ fontSize:'11px', color:'#aaa' }}>(타행위 단위단가는 조례 제12조 해당 시설 단위단가 적용)</span>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ textAlign:'center', color:'#aaa', padding:'40px' }}>+ 연도/지역 추가 버튼으로 추가하세요</div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// 하수도원인자부담금 계산기 모달
// ─────────────────────────────────────────────
const DEFAULT_SEWER_BANDS = [
  { upper: 15,  r: 1 },
  { upper: 30,  r: 2 },
  { upper: 50,  r: 3 },
  { upper: 65,  r: 3 },
  { upper: 85,  r: 4 },
  { upper: 999, r: 5 },
];

function SewerModal({ onClose, onApply, archData, incomeData, settingsData, data, onChange }) {
  const d = data || {};
  const update = (key, val) => onChange({ ...d, [key]: val });

  // 기준정보 연동
  const sewerRates = settingsData?.sewerRates || {};
  const entries    = sewerRates?.entries || [{ year:'2025', city:'부산', ordinance:'부산광역시 하수도 사용 조례 제10조·제12조', unitCost:'1761000' }];
  const years      = [...new Set(entries.map(e=>e.year))].sort((a,b)=>b-a);
  const selYear    = d.sewerYear || years[0] || '2025';
  const cities     = entries.filter(e=>e.year===selYear).map(e=>e.city);
  const selCity    = d.sewerCity || cities[0] || '부산';
  const activeEntry = entries.find(e=>e.year===selYear&&e.city===selCity) || entries.find(e=>e.year===selYear) || {};
  const unitCost   = d.unitCostOverride
    ? parseFloat(String(d.unitCostOverride).replace(/,/g,''))||0
    : parseFloat(activeEntry.unitCost||'1761000');
  const ordinance  = activeEntry.ordinance || '하수도 사용 조례';

  // 구간표 (수정 가능)
  const bands = d.bands || DEFAULT_SEWER_BANDS;
  const updateBand = (i, key, val) => {
    const newBands = bands.map((b,idx) => idx===i ? {...b,[key]:parseFloat(val)||0} : b);
    update('bands', newBands);
  };
  const lookupR = (m2) => {
    for (const b of bands) { if (m2 <= b.upper) return b.r; }
    return bands[bands.length-1]?.r || 3;
  };

  // 수입탭 연동 — 타입별 자동구성
  const aptRows   = incomeData?.aptRows   || [];
  const offiRows  = incomeData?.offiRows  || [];
  const storeRows = incomeData?.storeRows || [];

  // 주거 타입 rows (수입탭 자동연동 or 직접입력)
  const autoResRows = [...aptRows, ...offiRows].map(r => ({
    name:  r.type_name || '',
    exclM2: parseFloat(String(r.excl_m2||'').replace(/,/g,''))||0,
    units:  parseFloat(String(r.units||'').replace(/,/g,''))||0,
  })).filter(r => r.units > 0);

  const resRows = d.resRowsOverride || autoResRows;
  const updateResRows = (rows) => update('resRowsOverride', rows);

  // 상가 계약면적 자동연동
  const storeAreaAuto = storeRows.reduce((s,r) => {
    const excl=parseFloat(String(r.excl_m2||'').replace(/,/g,''))||0;
    const wall=parseFloat(String(r.wall_m2||'').replace(/,/g,''))||0;
    const core=parseFloat(String(r.core_m2||'').replace(/,/g,''))||0;
    const mgmt=parseFloat(String(r.mgmt_m2||'').replace(/,/g,''))||0;
    const comm=parseFloat(String(r.comm_m2||'').replace(/,/g,''))||0;
    const park=parseFloat(String(r.park_m2||'').replace(/,/g,''))||0;
    const tel=parseFloat(String(r.tel_m2||'').replace(/,/g,''))||0;
    const elec=parseFloat(String(r.elec_m2||'').replace(/,/g,''))||0;
    const units=parseFloat(String(r.units||'').replace(/,/g,''))||0;
    return s + (excl+wall+core+mgmt+comm+park+tel+elec)*units;
  }, 0);
  const storeArea = d.storeAreaOverride
    ? parseFloat(String(d.storeAreaOverride).replace(/,/g,''))||storeAreaAuto
    : storeAreaAuto;

  // 비주거 용도별 설정
  const largeRate = parseFloat(d.largeRate??'40')||0;
  const largeLpm  = parseFloat(d.largeLpm??'60')||0;
  const midRate   = parseFloat(d.midRate??'60')||0;
  const midLpm    = parseFloat(d.midLpm??'20')||0;

  // ── 계산 ──
  // 주거
  const resCalc = resRows.map(r => {
    const R    = lookupR(r.exclM2);
    const nVal = 2.7 + (R - 2) * 0.5;
    const perHH = nVal * 200 / 1000;
    return { ...r, R, nVal, perHH, sub: perHH * r.units };
  });
  const resQty = resCalc.reduce((s,r) => s+r.sub, 0);

  // 비주거
  const largeQty = storeArea * (largeRate/100) * (largeLpm/1000);
  const midQty   = storeArea * (midRate/100)   * (midLpm/1000);
  const comQty   = largeQty + midQty;

  const totalQty  = resQty + comQty;
  const isTaxable = totalQty >= 10;
  const resFee    = isTaxable ? Math.round(resQty * unitCost / 1000) : 0;
  const comFee    = isTaxable ? Math.round(comQty * unitCost / 1000) : 0;
  const totalFee  = resFee + comFee;

  const boxStyle = { border:'1px solid #e0e0e0', borderRadius:'8px', padding:'14px 18px', marginBottom:'14px' };
  const stepHd = (n, t, color='#6a1b9a') => (
    <div style={{ fontWeight:'bold', fontSize:'13px', color, marginBottom:'10px', display:'flex', alignItems:'center', gap:'8px' }}>
      <span style={{ backgroundColor:color, color:'white', borderRadius:'50%', width:'22px', height:'22px', display:'inline-flex', alignItems:'center', justifyContent:'center', fontSize:'12px', flexShrink:0 }}>{n}</span>
      {t}
    </div>
  );
  const fmtN = (v) => formatNumber(Math.round(v));

  return (
    <div style={{ position:'fixed', top:0, left:0, width:'100vw', height:'100vh', backgroundColor:'rgba(0,0,0,0.5)', zIndex:2000, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ backgroundColor:'white', borderRadius:'10px', width:'92%', maxWidth:'780px', maxHeight:'90vh', overflowY:'auto', padding:'24px' }}>

        {/* 헤더 */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'18px' }}>
          <div>
            <h3 style={{ margin:0, color:'#6a1b9a' }}>🚿 하수도 원인자부담금 계산기</h3>
            <div style={{ fontSize:'11px', color:'#888', marginTop:'3px' }}>하수도법 제61조 / {ordinance}</div>
            <div style={{ fontSize:'11px', color:'#888' }}>계산식: 총 오수발생량(㎥/일) × 단위단가(원/㎥) | 10㎥/일 미만 부과제외</div>
          </div>
          <button onClick={onClose} style={{ padding:'6px 14px', border:'1px solid #ddd', borderRadius:'6px', cursor:'pointer', backgroundColor:'white', fontSize:'13px' }}>✕ 닫기</button>
        </div>

        {/* 납부시기 */}
        <div style={{ ...boxStyle, backgroundColor:'#fff8e1', borderColor:'#ffe082' }}>
          <div style={{ fontWeight:'bold', fontSize:'13px', color:'#e65100', marginBottom:'6px' }}>⏰ 납부시기</div>
          <div style={{ fontSize:'12px', color:'#555' }}>사용승인 전</div>
        </div>

        {/* 공통설정 — 기준정보 연동 */}
        <div style={{ ...boxStyle, backgroundColor:'#f3e5f5', borderColor:'#ce93d8' }}>
          <div style={{ display:'flex', gap:'16px', alignItems:'center', flexWrap:'wrap' }}>
            <div>
              <label style={{ fontSize:'12px', fontWeight:'bold', color:'#555', display:'block', marginBottom:'4px' }}>기준연도</label>
              <select value={selYear} onChange={e=>update('sewerYear',e.target.value)}
                style={{ padding:'6px 10px', border:'1px solid #6a1b9a', borderRadius:'4px', fontSize:'13px', color:'#6a1b9a', fontWeight:'bold' }}>
                {years.map(y=><option key={y} value={y}>{y}년</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize:'12px', fontWeight:'bold', color:'#555', display:'block', marginBottom:'4px' }}>지역</label>
              <select value={selCity} onChange={e=>update('sewerCity',e.target.value)}
                style={{ padding:'6px 10px', border:'1px solid #6a1b9a', borderRadius:'4px', fontSize:'13px', color:'#6a1b9a', fontWeight:'bold' }}>
                {cities.map(c=><option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div style={{ fontSize:'12px', color:'#555', lineHeight:'1.8' }}>
              <div>단위단가: <strong style={{ color:'#6a1b9a' }}>{fmtN(unitCost)} 원/㎥</strong></div>
              <div style={{ fontSize:'11px', color:'#888' }}>{ordinance}</div>
            </div>
            <div style={{ fontSize:'11px', color:'#7b1fa2', backgroundColor:'white', padding:'6px 10px', borderRadius:'4px', border:'1px solid #ce93d8' }}>
              ⚙ 단가/조례 변경은 기준정보(⚙) → 제세금 → 하수도 탭에서
            </div>
          </div>
        </div>

        {/* 구간표 */}
        <div style={boxStyle}>
          {stepHd('1', '전용면적 구간별 거실수(R) 기준 (수정 가능)')}
          <div style={{ fontSize:'11px', color:'#888', marginBottom:'8px' }}>
            ※ 구체적인 도면이 없을 때 전용면적으로 R을 자동추정합니다. 도면 확정 후 타입별 직접 입력 가능.
          </div>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'12px' }}>
            <thead>
              <tr style={{ backgroundColor:'#6a1b9a', color:'white' }}>
                <th style={{ padding:'6px 10px' }}>구간</th>
                <th style={{ padding:'6px 10px' }}>전용(㎡) 상한</th>
                <th style={{ padding:'6px 10px' }}>거실수(R)</th>
                <th style={{ padding:'6px 10px' }}>적용범위</th>
                <th style={{ padding:'6px 10px' }}>오수(㎥/세대)</th>
              </tr>
            </thead>
            <tbody>
              {bands.map((b,i) => {
                const nVal = 2.7 + (b.r-2)*0.5;
                const perHH = (nVal*200/1000).toFixed(4);
                const lower = i===0 ? 0 : bands[i-1].upper;
                const rangeText = b.upper>=999 ? `${lower}㎡ 이상` : `${lower}~${b.upper}㎡`;
                return (
                  <tr key={i} style={{ backgroundColor:i%2===0?'white':'#fafafa' }}>
                    <td style={{ padding:'5px 10px', textAlign:'center', fontWeight:'bold', color:'#6a1b9a' }}>{i+1}구간</td>
                    <td style={{ padding:'4px 8px', textAlign:'center' }}>
                      {b.upper>=999 ? <span style={{ color:'#888' }}>이상</span> :
                        <input value={b.upper} onChange={e=>updateBand(i,'upper',e.target.value)}
                          style={{ width:'70px', padding:'3px 6px', border:'1px solid #ce93d8', borderRadius:'3px', fontSize:'12px', textAlign:'right' }} />}
                    </td>
                    <td style={{ padding:'4px 8px', textAlign:'center' }}>
                      <input value={b.r} onChange={e=>updateBand(i,'r',e.target.value)}
                        style={{ width:'50px', padding:'3px 6px', border:'1px solid #ce93d8', borderRadius:'3px', fontSize:'12px', textAlign:'right' }} />
                    </td>
                    <td style={{ padding:'5px 10px', textAlign:'center', fontSize:'11px', color:'#888' }}>{rangeText}</td>
                    <td style={{ padding:'5px 10px', textAlign:'right', fontSize:'11px', color:'#6a1b9a', fontWeight:'bold' }}>{perHH}㎥</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div style={{ fontSize:'10px', color:'#888', marginTop:'6px' }}>
            💡 오수 = (2.7+(R-2)×0.5)인 × 200L/인 ÷ 1000
          </div>
        </div>

        {/* 주거시설 */}
        <div style={boxStyle}>
          {stepHd('2', '주거시설 — 공동주택 + 오피스텔 (수입탭 자동연동)')}
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'12px', marginBottom:'8px' }}>
            <thead>
              <tr style={{ backgroundColor:'#6a1b9a', color:'white' }}>
                {['타입명','전용(㎡)','세대수','거실수(R)','오수(㎥/세대)','소계(㎥/일)'].map(h=>(
                  <th key={h} style={{ padding:'5px 8px', textAlign:'center' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {resCalc.map((r,i) => (
                <tr key={i} style={{ backgroundColor:i%2===0?'white':'#f3e5f5' }}>
                  <td style={{ padding:'4px 8px' }}>{r.name||`타입${i+1}`}</td>
                  <td style={{ padding:'4px 8px', textAlign:'right' }}>{formatNumber(r.exclM2.toFixed(2))}</td>
                  <td style={{ padding:'4px 8px', textAlign:'right' }}>{fmtN(r.units)}</td>
                  <td style={{ padding:'4px 8px', textAlign:'center', fontWeight:'bold', color:'#6a1b9a' }}>{r.R}</td>
                  <td style={{ padding:'4px 8px', textAlign:'right' }}>{r.perHH.toFixed(4)}</td>
                  <td style={{ padding:'4px 8px', textAlign:'right', fontWeight:'bold', color:'#6a1b9a' }}>{r.sub.toFixed(4)}</td>
                </tr>
              ))}
              <tr style={{ backgroundColor:'#ede7f6', fontWeight:'bold' }}>
                <td colSpan={5} style={{ padding:'5px 8px' }}>주거 소계</td>
                <td style={{ padding:'5px 8px', textAlign:'right', color:'#6a1b9a' }}>{resQty.toFixed(4)} ㎥/일</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* 비주거시설 */}
        <div style={boxStyle}>
          {stepHd('3', '비주거시설 — 근린상가')}
          <div style={{ fontSize:'11px', color:'#888', marginBottom:'10px' }}>
            대(60L/㎡): 일반음식점/유흥주점/목욕장 &nbsp;|&nbsp; 중(20L/㎡): 근린생활/판매/사무소/학원
          </div>
          <div style={{ marginBottom:'10px' }}>
            <div style={{ fontSize:'12px', fontWeight:'bold', color:'#555', marginBottom:'4px' }}>상가 계약면적 (수입탭 자동연동)</div>
            <div style={{ fontSize:'11px', color:'#2980b9', marginBottom:'4px' }}>자동: {fmtN(storeAreaAuto)}㎡</div>
            <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
              <input value={d.storeAreaOverride||''} onChange={e=>update('storeAreaOverride',e.target.value)}
                placeholder={`자동: ${fmtN(storeAreaAuto)}㎡`}
                style={{ width:'140px', padding:'5px 8px', border:`1px solid ${d.storeAreaOverride?'#e74c3c':'#ddd'}`, borderRadius:'4px', fontSize:'13px', textAlign:'right', backgroundColor:d.storeAreaOverride?'#fdf2f0':'white' }} />
              <span style={{ fontSize:'12px', color:'#888' }}>㎡</span>
              {d.storeAreaOverride && <button onClick={()=>update('storeAreaOverride','')} style={{ padding:'4px 8px', fontSize:'11px', backgroundColor:'#e74c3c', color:'white', border:'none', borderRadius:'3px', cursor:'pointer' }}>자동</button>}
            </div>
          </div>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'12px' }}>
            <thead>
              <tr style={{ backgroundColor:'#6a1b9a', color:'white' }}>
                {['용도','비율(%)','L/㎡','면적(㎡)','오수발생량(㎥/일)'].map(h=>(
                  <th key={h} style={{ padding:'5px 8px' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { label:'대(음식점류)', rateKey:'largeRate', lpmKey:'largeLpm', rate:largeRate, lpm:largeLpm, qty:largeQty, color:'#e74c3c' },
                { label:'중(근린/사무)', rateKey:'midRate',   lpmKey:'midLpm',   rate:midRate,   lpm:midLpm,   qty:midQty,   color:'#3498db' },
              ].map((row,i) => (
                <tr key={i} style={{ backgroundColor:i%2===0?'white':'#fafafa' }}>
                  <td style={{ padding:'5px 8px', fontWeight:'bold', color:row.color }}>{row.label}</td>
                  <td style={{ padding:'4px 6px' }}>
                    <input value={d[row.rateKey]??String(row.rate)} onChange={e=>update(row.rateKey,e.target.value)}
                      style={{ width:'60px', padding:'4px 6px', border:'1px solid #ddd', borderRadius:'3px', fontSize:'12px', textAlign:'right' }} />
                  </td>
                  <td style={{ padding:'4px 6px' }}>
                    <input value={d[row.lpmKey]??String(row.lpm)} onChange={e=>update(row.lpmKey,e.target.value)}
                      style={{ width:'60px', padding:'4px 6px', border:'1px solid #ddd', borderRadius:'3px', fontSize:'12px', textAlign:'right' }} />
                  </td>
                  <td style={{ padding:'5px 8px', textAlign:'right', color:'#888', fontSize:'11px' }}>{fmtN(storeArea*(row.rate/100))}㎡</td>
                  <td style={{ padding:'5px 8px', textAlign:'right', fontWeight:'bold', color:row.color }}>{row.qty.toFixed(4)}</td>
                </tr>
              ))}
              <tr style={{ backgroundColor:'#fff8e1', fontWeight:'bold' }}>
                <td colSpan={4} style={{ padding:'5px 8px' }}>비주거 소계</td>
                <td style={{ padding:'5px 8px', textAlign:'right', color:'#e67e22' }}>{comQty.toFixed(4)} ㎥/일</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* 결과 */}
        <div style={{ ...boxStyle, backgroundColor: isTaxable?'#f3e5f5':'#f1f8e9', borderColor: isTaxable?'#ce93d8':'#a5d6a7' }}>
          <div style={{ fontWeight:'bold', fontSize:'13px', marginBottom:'8px', color: isTaxable?'#6a1b9a':'#2e7d32' }}>
            총 오수발생량: {totalQty.toFixed(4)} ㎥/일
            &nbsp;
            {isTaxable
              ? <span style={{ color:'#e74c3c' }}>● 부과대상 (≥ 10㎥/일)</span>
              : <span style={{ color:'#27ae60' }}>○ 부과제외 (10㎥/일 미만)</span>}
          </div>
          {isTaxable && (
            <div style={{ fontSize:'12px', color:'#555', lineHeight:'1.8' }}>
              <div>주거시설: {resQty.toFixed(4)}㎥/일 × {fmtN(unitCost)}원/㎥ = <strong style={{ color:'#6a1b9a' }}>{fmtN(resFee)} 천원</strong></div>
              <div>비주거시설: {comQty.toFixed(4)}㎥/일 × {fmtN(unitCost)}원/㎥ = <strong style={{ color:'#6a1b9a' }}>{fmtN(comFee)} 천원</strong></div>
            </div>
          )}
        </div>

        {/* 합계 + 반영 */}
        <div style={{ backgroundColor:'#6a1b9a', borderRadius:'8px', padding:'16px 20px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div>
            <div style={{ color:'white', fontSize:'13px', fontWeight:'bold' }}>하수도 원인자부담금 합계</div>
            <div style={{ color:'#ce93d8', fontSize:'11px', marginTop:'3px' }}>
              {isTaxable ? `주거 ${fmtN(resFee)}천원 + 비주거 ${fmtN(comFee)}천원` : '10㎥/일 미만 — 부과제외'}
            </div>
          </div>
          <div style={{ display:'flex', gap:'10px', alignItems:'center' }}>
            <div style={{ fontSize:'20px', fontWeight:'bold', color:'white' }}>{fmtN(totalFee)} 천원</div>
            <button onClick={() => { onApply(totalFee, d); onClose(); }}
              style={{ padding:'10px 24px', backgroundColor:'#27ae60', color:'white', border:'none', borderRadius:'6px', cursor:'pointer', fontSize:'14px', fontWeight:'bold' }}>
              💾 사업비 반영
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// 건축허가 국민주택채권할인 계산기 모달
// ─────────────────────────────────────────────
function BondBuildModal({ onClose, onApply, archData, incomeData, settingsData, data, onChange }) {
  const d = data || {};
  const update = (key, val) => onChange({ ...d, [key]: val });

  // 기준정보 즉시배도율 연동
  const discRate = parseFloat(d.discRateOverride ?? settingsData?.bondRates?.discRate ?? '13.5') || 13.5;

  // 수입탭 연동
  const aptRows   = incomeData?.aptRows   || [];
  const offiRows  = incomeData?.offiRows  || [];
  const storeRows = incomeData?.storeRows || [];

  // 공동주택+오피스텔 타입별 계산
  const resCalc = [...aptRows, ...offiRows].map(r => {
    const exclM2 = parseFloat(String(r.excl_m2||'').replace(/,/g,''))||0;
    const units  = parseFloat(String(r.units||'').replace(/,/g,''))||0;
    const name   = r.type_name || '';
    // 전용면적 구간별 단가 (원/㎡)
    let rate = 0;
    if      (exclM2 < 85)   rate = 0;      // 국민주택규모 이하 — 비과세
    else if (exclM2 < 100)  rate = 300;
    else if (exclM2 < 132)  rate = 1000;
    else if (exclM2 < 165)  rate = 2000;
    else if (exclM2 < 231)  rate = 4000;
    else if (exclM2 < 330)  rate = 10000;
    else if (exclM2 < 660)  rate = 17000;
    else                    rate = 28000;
    const buyAmt = Math.round(exclM2 * units * rate);  // 원
    return { name, exclM2, units, rate, buyAmt };
  }).filter(r => r.units > 0);

  const resBuyTotal = resCalc.reduce((s, r) => s + r.buyAmt, 0);

  // 근린상가 계약면적 합계 (수입탭 storeRows 자동연동)
  const storeFloorM2Auto = storeRows.reduce((s, r) => {
    const excl = parseFloat(String(r.excl_m2||'').replace(/,/g,''))||0;
    const wall = parseFloat(String(r.wall_m2||'').replace(/,/g,''))||0;
    const core = parseFloat(String(r.core_m2||'').replace(/,/g,''))||0;
    const mgmt = parseFloat(String(r.mgmt_m2||'').replace(/,/g,''))||0;
    const comm = parseFloat(String(r.comm_m2||'').replace(/,/g,''))||0;
    const park = parseFloat(String(r.park_m2||'').replace(/,/g,''))||0;
    const tel  = parseFloat(String(r.tel_m2||'').replace(/,/g,''))||0;
    const elec = parseFloat(String(r.elec_m2||'').replace(/,/g,''))||0;
    const units = parseFloat(String(r.units||'').replace(/,/g,''))||0;
    return s + (excl+wall+core+mgmt+comm+park+tel+elec)*units;
  }, 0);
  // 구조 선택 (기본: 철근·철골조 1,300원/㎡)
  const storeStructure = d.storeStructure || 'rc';
  const STORE_STRUCTURES = [
    { key: 'special', label: '극장·유흥주점·게임장 등',   rate: 4000 },
    { key: 'rc',      label: '철근·철골조',               rate: 1300 },
    { key: 'brick',   label: '연와조·석조',               rate: 1000 },
    { key: 'block',   label: '시멘트블록·블록조',         rate: 600  },
    { key: 'hotel',   label: '관광숙박시설',              rate: 500  },
  ];
  const storeM2 = d.storeM2Override
    ? parseFloat(String(d.storeM2Override).replace(/,/g,''))||0
    : storeFloorM2Auto;
  const storeRate   = STORE_STRUCTURES.find(s => s.key === storeStructure)?.rate || 1300;
  const storeBuyAmt = Math.round(storeM2 * storeRate);  // 원

  // 합계
  const totalBuyAmt  = resBuyTotal + storeBuyAmt;
  const totalDiscAmt = Math.round(totalBuyAmt * discRate / 100 / 1000); // 천원

  const boxStyle = { border:'1px solid #e0e0e0', borderRadius:'8px', padding:'14px 18px', marginBottom:'14px' };
  const stepHd = (n, t) => (
    <div style={{ fontWeight:'bold', fontSize:'13px', color:'#1a237e', marginBottom:'10px', display:'flex', alignItems:'center', gap:'8px' }}>
      <span style={{ backgroundColor:'#1a237e', color:'white', borderRadius:'50%', width:'22px', height:'22px', display:'inline-flex', alignItems:'center', justifyContent:'center', fontSize:'12px', flexShrink:0 }}>{n}</span>
      {t}
    </div>
  );
  const fmtN = (v) => formatNumber(Math.round(v));

  return (
    <div style={{ position:'fixed', top:0, left:0, width:'100vw', height:'100vh', backgroundColor:'rgba(0,0,0,0.5)', zIndex:2000, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ backgroundColor:'white', borderRadius:'10px', width:'92%', maxWidth:'740px', maxHeight:'90vh', overflowY:'auto', padding:'24px' }}>

        {/* 헤더 */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'18px' }}>
          <div>
            <h3 style={{ margin:0, color:'#1a237e' }}>🏦 건축허가 국민주택채권할인 계산기</h3>
            <div style={{ fontSize:'11px', color:'#888', marginTop:'3px' }}>주택도시기금법 시행령 별표 1 — 6. 건축허가(대수선허가 제외)</div>
            <div style={{ fontSize:'11px', color:'#888' }}>채권매입금액 × 즉시배도율 = 본인부담금(실제비용)</div>
          </div>
          <button onClick={onClose} style={{ padding:'6px 14px', border:'1px solid #ddd', borderRadius:'6px', cursor:'pointer', backgroundColor:'white', fontSize:'13px' }}>✕ 닫기</button>
        </div>

        {/* 즉시배도율 */}
        <div style={{ ...boxStyle, backgroundColor:'#e8eaf6', borderColor:'#9fa8da' }}>
          <div style={{ display:'flex', gap:'20px', alignItems:'center', flexWrap:'wrap' }}>
            <div>
              <label style={{ fontSize:'12px', fontWeight:'bold', color:'#555', display:'block', marginBottom:'4px' }}>즉시배도율 (%)</label>
              <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
                <input value={d.discRateOverride ?? (settingsData?.bondRates?.discRate ?? '13.5')}
                  onChange={e => update('discRateOverride', e.target.value)}
                  style={{ width:'80px', padding:'6px 10px', border:'1px solid #3f51b5', borderRadius:'4px', fontSize:'14px', textAlign:'right', color:'#1a237e', fontWeight:'bold' }} />
                <span style={{ fontSize:'12px', color:'#888' }}>%</span>
              </div>
            </div>
            <div style={{ fontSize:'11px', color:'#555', lineHeight:'1.8' }}>
              <div>기준정보(⚙) → 국민주택채권 → 계산기준값에서 기본값 관리</div>
              <div style={{ color:'#888' }}>※ 당일 배도단가에 따라 변동 — 주택도시기금 사이트 확인</div>
            </div>
          </div>
        </div>

        {/* STEP1 - 주거시설 */}
        <div style={boxStyle}>
          {stepHd('1', '주거시설 — 공동주택 + 오피스텔 (수입탭 자동연동)')}
          <div style={{ fontSize:'11px', color:'#888', marginBottom:'10px' }}>
            ※ 국민주택규모(85㎡) 이하는 부과제외 / 전용면적 기준
          </div>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'12px', marginBottom:'8px' }}>
            <thead>
              <tr style={{ backgroundColor:'#1a237e', color:'white' }}>
                {['타입명','전용(㎡)','세대수','구간단가(원/㎡)','채권매입금액(원)'].map(h=>(
                  <th key={h} style={{ padding:'5px 8px', textAlign:'center' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {resCalc.map((r, i) => (
                <tr key={i} style={{ backgroundColor: i%2===0?'white':'#f5f5f5' }}>
                  <td style={{ padding:'4px 8px' }}>{r.name||`타입${i+1}`}</td>
                  <td style={{ padding:'4px 8px', textAlign:'right' }}>{formatNumber(r.exclM2.toFixed(2))}</td>
                  <td style={{ padding:'4px 8px', textAlign:'right' }}>{fmtN(r.units)}</td>
                  <td style={{ padding:'4px 8px', textAlign:'right', color: r.rate===0 ? '#27ae60' : '#1a237e', fontWeight:'bold' }}>
                    {r.rate === 0 ? '면제(85㎡이하)' : formatNumber(r.rate)}
                  </td>
                  <td style={{ padding:'4px 8px', textAlign:'right', fontWeight:'bold', color:'#1a237e' }}>
                    {r.rate === 0 ? '—' : fmtN(r.buyAmt)}
                  </td>
                </tr>
              ))}
              <tr style={{ backgroundColor:'#e8eaf6', fontWeight:'bold' }}>
                <td colSpan={4} style={{ padding:'5px 8px' }}>주거 채권매입 소계</td>
                <td style={{ padding:'5px 8px', textAlign:'right', color:'#1a237e' }}>{fmtN(resBuyTotal)} 원</td>
              </tr>
            </tbody>
          </table>

          {/* 전용면적 구간 참조표 */}
          <details style={{ marginTop:'8px' }}>
            <summary style={{ fontSize:'11px', color:'#888', cursor:'pointer' }}>📋 전용면적 구간별 단가 참조 (별표1 제6호 가목)</summary>
            <table style={{ borderCollapse:'collapse', fontSize:'11px', marginTop:'6px', width:'100%' }}>
              <thead><tr style={{ backgroundColor:'#e8eaf6' }}>
                <th style={{ padding:'4px 8px', textAlign:'left' }}>전용면적 구간</th>
                <th style={{ padding:'4px 8px', textAlign:'right' }}>단가 (원/㎡)</th>
              </tr></thead>
              <tbody>
                {[
                  { range:'85㎡ 이하 (국민주택규모)',          rate: 0,     note:'면제' },
                  { range:'85㎡ 초과 ~ 100㎡ 미만',           rate: 300   },
                  { range:'100㎡ 이상 ~ 132㎡ 미만 (공동주택)',rate: 1000  },
                  { range:'132㎡ 이상 ~ 165㎡ 미만 (공동주택)',rate: 2000  },
                  { range:'165㎡ 이상 ~ 231㎡ 미만 (공동주택)',rate: 4000  },
                  { range:'231㎡ 이상 ~ 330㎡ 미만',          rate: 10000 },
                  { range:'330㎡ 이상 ~ 660㎡ 미만',          rate: 17000 },
                  { range:'660㎡ 이상',                       rate: 28000 },
                ].map((b, i) => (
                  <tr key={i} style={{ backgroundColor: i%2===0?'white':'#fafafa' }}>
                    <td style={{ padding:'3px 8px' }}>{b.range}</td>
                    <td style={{ padding:'3px 8px', textAlign:'right', fontWeight:'bold', color: b.rate===0?'#27ae60':'#1a237e' }}>
                      {b.rate===0 ? '면제' : formatNumber(b.rate)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </div>

        {/* STEP2 - 근린상가 */}
        <div style={boxStyle}>
          {stepHd('2', '비주거시설 — 근린상가 (주거전용 외 건축물)')}
          <div style={{ marginBottom:'12px' }}>
            <label style={{ fontSize:'12px', fontWeight:'bold', color:'#555', display:'block', marginBottom:'6px' }}>건축물 구조 선택</label>
            <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
              {STORE_STRUCTURES.map(s => (
                <label key={s.key} style={{ display:'flex', alignItems:'center', gap:'8px', cursor:'pointer', fontSize:'12px' }}>
                  <input type="radio" name="storeStructure" value={s.key}
                    checked={storeStructure === s.key}
                    onChange={() => update('storeStructure', s.key)} />
                  <span style={{ color: storeStructure===s.key ? '#1a237e' : '#555', fontWeight: storeStructure===s.key ? 'bold' : 'normal' }}>
                    {s.label}
                  </span>
                  <span style={{ color:'#1a237e', fontWeight:'bold' }}>{formatNumber(s.rate)} 원/㎡</span>
                </label>
              ))}
            </div>
          </div>
          <div style={{ marginBottom:'8px' }}>
            <label style={{ fontSize:'12px', fontWeight:'bold', color:'#555', display:'block', marginBottom:'4px' }}>연면적 (㎡)</label>
            <div style={{ fontSize:'11px', color:'#2980b9', marginBottom:'4px' }}>
              수입탭 자동연동: {fmtN(storeFloorM2Auto)}㎡ (근린상가 계약면적 합계)
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
              <input value={d.storeM2Override||''} onChange={e=>update('storeM2Override',e.target.value)}
                placeholder={`자동: ${fmtN(storeFloorM2Auto)}㎡`}
                style={{ width:'140px', padding:'5px 8px', border:`1px solid ${d.storeM2Override?'#e74c3c':'#ddd'}`, borderRadius:'4px', fontSize:'13px', textAlign:'right', backgroundColor:d.storeM2Override?'#fdf2f0':'white' }} />
              <span style={{ fontSize:'12px', color:'#888' }}>㎡</span>
              {d.storeM2Override && <button onClick={()=>update('storeM2Override','')} style={{ padding:'4px 8px', fontSize:'11px', backgroundColor:'#e74c3c', color:'white', border:'none', borderRadius:'3px', cursor:'pointer' }}>자동</button>}
            </div>
          </div>
          <div style={{ backgroundColor:'#e8eaf6', padding:'8px 12px', borderRadius:'4px', fontSize:'12px' }}>
            {fmtN(storeM2)}㎡ × {formatNumber(storeRate)}원/㎡ = <strong style={{ color:'#1a237e' }}>{fmtN(storeBuyAmt)} 원</strong>
          </div>
        </div>

        {/* 합계 + 반영 */}
        <div style={{ backgroundColor:'#1a237e', borderRadius:'8px', padding:'16px 20px' }}>
          <div style={{ color:'#9fa8da', fontSize:'12px', marginBottom:'8px' }}>
            채권매입금액: {fmtN(totalBuyAmt)}원 ({fmtN(Math.round(totalBuyAmt/1000))}천원)
          </div>
          <div style={{ color:'white', fontSize:'12px', marginBottom:'12px', fontFamily:'monospace' }}>
            {fmtN(Math.round(totalBuyAmt/1000))}천원 × {discRate}% = <strong style={{ color:'#fff59d' }}>{fmtN(totalDiscAmt)} 천원</strong>
          </div>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <div>
              <div style={{ color:'white', fontSize:'13px', fontWeight:'bold' }}>건축허가 국민주택채권할인 합계</div>
              <div style={{ color:'#9fa8da', fontSize:'11px', marginTop:'2px' }}>
                주거 {fmtN(Math.round(resBuyTotal/1000))}천원 + 상가 {fmtN(Math.round(storeBuyAmt/1000))}천원 채권매입
              </div>
            </div>
            <div style={{ display:'flex', gap:'10px', alignItems:'center' }}>
              <div style={{ fontSize:'20px', fontWeight:'bold', color:'white' }}>{fmtN(totalDiscAmt)} 천원</div>
              <button onClick={() => { onApply(totalDiscAmt, d); onClose(); }}
                style={{ padding:'10px 24px', backgroundColor:'#27ae60', color:'white', border:'none', borderRadius:'6px', cursor:'pointer', fontSize:'14px', fontWeight:'bold' }}>
                💾 사업비 반영
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// 학교용지부담금 계산기 모달
// ─────────────────────────────────────────────
const SCHOOL_EXEMPTIONS = [
  { key: 'ex1', label: '① 공익사업을 위한 토지 등의 취득 및 보상에 관한 법률에 따른 이주용·이주주택 분양' },
  { key: 'ex2', label: '② 임대주택을 분양하는 경우' },
  { key: 'ex3', label: '③ 도시개발법 제2조제1항제2호에 따른 도시개발사업 시행 결과 해당 구역 내 세대수 미증가' },
  { key: 'ex4', label: '④ 도시 및 주거환경정비법 제2조제2호가목에 따른 도시환경정비사업' },
  { key: 'ex5', label: '⑤ 빈집 및 소규모주택 정비에 관한 특례법에 따른 소규모주택정비사업 — 세대수 미증가' },
  { key: 'ex6', label: '⑥ 주택법 제2조제11호다목에 따른 리모델링조합의 구성원에게 분양하는 경우' },
];

function SchoolFundModal({ onClose, onApply, archData, incomeData, data, onChange }) {
  const d = data || {};
  const update = (key, val) => onChange({ ...d, [key]: val });

  // 수입탭 연동
  const aptRows  = incomeData?.aptRows  || [];
  const totalUnits = aptRows.reduce((s,r) => s+(parseFloat(String(r.units||'').replace(/,/g,''))||0), 0);

  // 300세대 미만 여부
  const isUnder300 = totalUnits < 300;

  // 면제 여부
  const exemption = d.exemption || 'none';

  // 분양가격 합계 (수입탭 apt 분양수입 합계)
  const aptSalesAuto = aptRows.reduce((s, r) => {
    const price = parseFloat(String(r.total_price||r.totalPrice||'').replace(/,/g,''))||0;
    const units = parseFloat(String(r.units||'').replace(/,/g,''))||0;
    const pyPrice = parseFloat(String(r.py_price||r.pyPrice||'').replace(/,/g,''))||0;
    const supplyPy = parseFloat(String(r.supply_py||r.supplyPy||'').replace(/,/g,''))||0;
    // 분양수입 = 공급면적(평) × 평당분양가 × 세대수
    if (pyPrice > 0 && supplyPy > 0) return s + pyPrice * supplyPy * units;
    return s + price * units;
  }, 0);

  const salesAmt = d.salesOverride
    ? parseFloat(String(d.salesOverride).replace(/,/g,''))||0
    : aptSalesAuto;

  // 부과율 (기본 4/1,000)
  const rate = parseFloat(d.rate ?? '4') || 4;

  // 계산
  const isTaxable = !isUnder300 && exemption === 'none';
  const schoolFee = isTaxable ? Math.round(salesAmt * rate / 1000) : 0;

  const boxStyle = { border:'1px solid #e0e0e0', borderRadius:'8px', padding:'14px 18px', marginBottom:'14px' };
  const stepHd = (n, t) => (
    <div style={{ fontWeight:'bold', fontSize:'13px', color:'#2e7d32', marginBottom:'10px', display:'flex', alignItems:'center', gap:'8px' }}>
      <span style={{ backgroundColor:'#2e7d32', color:'white', borderRadius:'50%', width:'22px', height:'22px', display:'inline-flex', alignItems:'center', justifyContent:'center', fontSize:'12px', flexShrink:0 }}>{n}</span>
      {t}
    </div>
  );
  const fmtN = (v) => formatNumber(Math.round(v));

  return (
    <div style={{ position:'fixed', top:0, left:0, width:'100vw', height:'100vh', backgroundColor:'rgba(0,0,0,0.5)', zIndex:2000, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ backgroundColor:'white', borderRadius:'10px', width:'92%', maxWidth:'720px', maxHeight:'90vh', overflowY:'auto', padding:'24px' }}>

        {/* 헤더 */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'18px' }}>
          <div>
            <h3 style={{ margin:0, color:'#2e7d32' }}>🏫 학교용지부담금 계산기</h3>
            <div style={{ fontSize:'11px', color:'#888', marginTop:'3px' }}>학교용지 확보 등에 관한 특례법 제3조·제5조·제5조의2</div>
            <div style={{ fontSize:'11px', color:'#888' }}>계산식: 공동주택 분양가격 합계 × 4/1,000 (0.4%)</div>
          </div>
          <button onClick={onClose} style={{ padding:'6px 14px', border:'1px solid #ddd', borderRadius:'6px', cursor:'pointer', backgroundColor:'white', fontSize:'13px' }}>✕ 닫기</button>
        </div>

        {/* 납부시기 */}
        <div style={{ ...boxStyle, backgroundColor:'#fff8e1', borderColor:'#ffe082' }}>
          <div style={{ fontWeight:'bold', fontSize:'13px', color:'#e65100', marginBottom:'6px' }}>⏰ 납부시기</div>
          <div style={{ fontSize:'12px', color:'#555', lineHeight:'1.8' }}>
            <div>• 공동주택분양자: 분양공고일부터 분양계약 체결 시까지 시·도지사에게 제출</div>
            <div>• 납부기한 고지일 날부터 30일 이내</div>
            <div style={{ fontSize:'11px', color:'#888' }}>※ 학교용지 확보 등에 관한 특례법 제5조의3 (부담금의 강제 징수)</div>
          </div>
        </div>

        {/* STEP 1 - 부과대상 확인 */}
        <div style={boxStyle}>
          {stepHd('1', '부과대상 확인 (제3조)')}
          <div style={{ backgroundColor: isUnder300 ? '#e8f5e9' : '#ffebee', padding:'12px 16px', borderRadius:'6px', marginBottom:'12px' }}>
            <div style={{ fontWeight:'bold', fontSize:'13px', color: isUnder300 ? '#2e7d32' : '#c62828' }}>
              {isUnder300
                ? `✓ 현재 공동주택 ${fmtN(totalUnits)}세대 → 300세대 미만 → 부과제외`
                : `⚠ 현재 공동주택 ${fmtN(totalUnits)}세대 → 300세대 이상 → 부과대상`}
            </div>
            <div style={{ fontSize:'11px', color:'#555', marginTop:'6px', lineHeight:'1.8' }}>
              <div>• 300세대(제5조제5항제3호에 해당하는 경우 세대 수를 대상) 이상의 개발사업에 부과</div>
              <div>• 도시 및 주거환경정비법 재건축/재개발, 빈집 및 소규모주택 정비 소규모주택정비사업: 기존 세대를 뺀 세대 수 기준</div>
            </div>
          </div>
        </div>

        {/* STEP 2 - 면제 조건 확인 */}
        <div style={boxStyle}>
          {stepHd('2', '면제 조건 확인 (제5조 제5항)')}
          <div style={{ fontSize:'11px', color:'#888', marginBottom:'10px' }}>
            아래 중 하나에 해당하면 부담금 면제 — 해당사항 선택하세요
          </div>
          <label style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'10px', cursor:'pointer', fontSize:'13px', fontWeight:'bold' }}>
            <input type="radio" name="exemption" value="none" checked={exemption==='none'} onChange={() => update('exemption','none')} />
            <span style={{ color: exemption==='none' ? '#e74c3c' : '#555' }}>해당없음 (100% 부과)</span>
          </label>
          {SCHOOL_EXEMPTIONS.map(e => (
            <label key={e.key} style={{ display:'flex', alignItems:'flex-start', gap:'8px', marginBottom:'8px', cursor:'pointer', fontSize:'12px' }}>
              <input type="radio" name="exemption" value={e.key} checked={exemption===e.key} onChange={() => update('exemption',e.key)} style={{ marginTop:'2px', flexShrink:0 }} />
              <span style={{ color: exemption===e.key ? '#2e7d32' : '#555', fontWeight: exemption===e.key ? 'bold' : 'normal' }}>{e.label}</span>
            </label>
          ))}
          {exemption !== 'none' && (
            <div style={{ backgroundColor:'#e8f5e9', padding:'8px 12px', borderRadius:'4px', fontSize:'12px', color:'#2e7d32', fontWeight:'bold', marginTop:'8px' }}>
              ✓ 면제 대상 선택됨 → 부담금 = 0원
            </div>
          )}
        </div>

        {/* STEP 3 - 분양가격 */}
        <div style={boxStyle}>
          {stepHd('3', '분양가격 합계 (제5조의2 산정기준)')}
          <div style={{ fontSize:'11px', color:'#888', marginBottom:'8px' }}>
            제5조의2: 공동주택 부담금 = 세대별 공동주택 분양가격 합계 × 1/1,000 × 4
          </div>
          <div style={{ fontSize:'11px', color:'#2980b9', marginBottom:'6px', fontWeight:'bold' }}>
            📐 수입탭 자동연동 — 공동주택 분양수입 합계: {fmtN(aptSalesAuto)} 천원
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'8px' }}>
            <input value={d.salesOverride||''} onChange={e=>update('salesOverride',e.target.value)}
              placeholder={`자동: ${fmtN(aptSalesAuto)}천원`}
              style={{ width:'180px', padding:'6px 10px', border:`1px solid ${d.salesOverride?'#e74c3c':'#ddd'}`, borderRadius:'4px', fontSize:'13px', textAlign:'right', backgroundColor:d.salesOverride?'#fdf2f0':'white' }} />
            <span style={{ fontSize:'12px', color:'#888' }}>천원</span>
            {d.salesOverride && <button onClick={()=>update('salesOverride','')} style={{ padding:'4px 8px', fontSize:'11px', backgroundColor:'#e74c3c', color:'white', border:'none', borderRadius:'3px', cursor:'pointer' }}>자동</button>}
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
            <label style={{ fontSize:'12px', fontWeight:'bold', color:'#555' }}>부과율</label>
            <input value={d.rate??'4'} onChange={e=>update('rate',e.target.value)}
              style={{ width:'60px', padding:'5px 8px', border:'1px solid #ddd', borderRadius:'3px', fontSize:'13px', textAlign:'right' }} />
            <span style={{ fontSize:'12px', color:'#888' }}>/1,000</span>
            <span style={{ fontSize:'11px', color:'#888' }}>(기본: 공동주택 4/1,000 = 0.4%)</span>
          </div>
        </div>

        {/* 결과 */}
        <div style={{ ...boxStyle, backgroundColor: isTaxable?'#f1f8e9':'#f8f9fa', borderColor: isTaxable?'#a5d6a7':'#dee2e6' }}>
          <div style={{ fontSize:'13px', fontWeight:'bold', color: isTaxable?'#2e7d32':'#888', marginBottom:'6px' }}>
            {isUnder300
              ? `300세대 미만(${fmtN(totalUnits)}세대) → 부과제외`
              : exemption !== 'none'
                ? `면제 조건 해당 → 부과제외`
                : `부과대상 — ${fmtN(salesAmt)}천원 × ${rate}/1,000`}
          </div>
          {isTaxable && (
            <div style={{ fontSize:'12px', color:'#555', fontFamily:'monospace' }}>
              {fmtN(salesAmt)}천원 × {rate} ÷ 1,000 = <strong style={{ color:'#2e7d32', fontSize:'14px' }}>{fmtN(schoolFee)} 천원</strong>
            </div>
          )}
        </div>

        {/* 합계 + 반영 */}
        <div style={{ backgroundColor:'#2e7d32', borderRadius:'8px', padding:'16px 20px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div>
            <div style={{ color:'white', fontSize:'13px', fontWeight:'bold' }}>학교용지부담금</div>
            <div style={{ color:'#a5d6a7', fontSize:'11px', marginTop:'2px' }}>
              {isUnder300 ? '300세대 미만 — 부과제외' : exemption!=='none' ? '면제 조건 해당' : `분양가 ${fmtN(salesAmt)}천원 × ${rate}/1,000`}
            </div>
          </div>
          <div style={{ display:'flex', gap:'10px', alignItems:'center' }}>
            <div style={{ fontSize:'20px', fontWeight:'bold', color:'white' }}>{fmtN(schoolFee)} 천원</div>
            <button onClick={() => { onApply(schoolFee, {...d, _applied: true}); onClose(); }}
              style={{ padding:'10px 24px', backgroundColor:'#27ae60', color:'white', border:'none', borderRadius:'6px', cursor:'pointer', fontSize:'14px', fontWeight:'bold' }}>
              💾 사업비 반영
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// 보존등기비 계산기 모달
// ─────────────────────────────────────────────
function RegFeeModal({ onClose, onApply, archData, incomeData, calcResults, data, onChange }) {
  const d = data || {};
  const update = (key, val) => onChange({ ...d, [key]: val });

  // ── 각 탭 계산결과 직접 연동 (재계산 없이 원값 그대로) ──
  const directAmt   = calcResults?.directAmt   || 0;
  const indirectAmt = calcResults?.indirectAmt || 0;
  const consultAmt  = calcResults?.consultAmt  || 0;
  const taxAmt      = calcResults?.taxAmt      || 0;
  const trustAmt    = calcResults?.trustAmt    || 0;

  // 준공전이자 (직접입력, 나중에 금융비 연동)
  const interestAmt = parseFloat(String(d.interestAmt||'').replace(/,/g,''))||0;

  // 과세표준 합계
  const taxBase = directAmt + indirectAmt + consultAmt + taxAmt + trustAmt + interestAmt;

  // 수입탭 연동 - 타입별 세대 구분
  const aptRows   = incomeData?.aptRows   || [];
  const offiRows  = incomeData?.offiRows  || [];
  const storeRows = incomeData?.storeRows || [];

  // 계약면적 계산 헬퍼 — 모든 용도 동일하게 계약면적 사용
  const getM2 = (r, k) => parseFloat(String(r[k]||'').replace(/,/g,''))||0;
  const contractM2 = (r) => (getM2(r,'excl_m2')+getM2(r,'wall_m2')+getM2(r,'core_m2')+getM2(r,'mgmt_m2')+getM2(r,'comm_m2')+getM2(r,'park_m2')+getM2(r,'tel_m2')+getM2(r,'elec_m2')) * (parseFloat(String(r.units||'').replace(/,/g,''))||0);

  // 용도별 계약면적 합계 (모두 동일 방식)
  const aptContM2   = aptRows.reduce((s,r)   => s + contractM2(r), 0);
  const offiContM2  = offiRows.reduce((s,r)  => s + contractM2(r), 0);
  const storeContM2 = storeRows.reduce((s,r) => s + contractM2(r), 0);
  const totalContM2 = aptContM2 + offiContM2 + storeContM2;

  // 취득세 계산 (타입별 — 계약면적 비율로 과세표준 안분)
  const aptCalc = aptRows.map(r => {
    const exclM2  = getM2(r,'excl_m2');
    const units   = parseFloat(String(r.units||'').replace(/,/g,''))||0;
    const areaM2  = contractM2(r);
    const isNational = exclM2 <= 85;
    const rate = isNational ? 2.96 : 3.16;
    const baseShare = totalContM2 > 0 ? Math.round(taxBase * areaM2 / totalContM2) : 0;
    return { label: r.type_name||'공동주택', exclM2, units, areaM2, isNational, rate, baseShare };
  });
  const offiCalc = offiRows.map(r => {
    const exclM2  = getM2(r,'excl_m2');
    const units   = parseFloat(String(r.units||'').replace(/,/g,''))||0;
    const areaM2  = contractM2(r);
    const baseShare = totalContM2 > 0 ? Math.round(taxBase * areaM2 / totalContM2) : 0;
    return { label: r.type_name||'오피스텔', exclM2, units, areaM2, isNational: false, rate: 3.16, baseShare, isOffi: true };
  });
  const storeCalc = storeRows.length > 0 ? [{
    label: '근린상가', exclM2: 0, units: storeRows.reduce((s,r)=>s+(parseFloat(String(r.units||'').replace(/,/g,''))||0),0),
    areaM2: storeContM2, isNational: false, rate: 3.16,
    baseShare: totalContM2 > 0 ? Math.round(taxBase * storeContM2 / totalContM2) : 0,
    isStore: true,
  }] : [];

  const allRows = [...aptCalc, ...offiCalc, ...storeCalc];

  // 취득세 합계
  const acqTotal = allRows.reduce((s,r) => s + Math.round(r.baseShare * r.rate / 100), 0);

  // 국민주택채권 (등기 시) — 분양가 기준
  // 별표1 제15호 1) 주택 — 시가표준액(분양가) 기준
  const BOND_REG_RATES = [
    { min:2000,   max:5000,   metro:13, other:13 },
    { min:5000,   max:10000,  metro:19, other:14 },
    { min:10000,  max:16000,  metro:21, other:16 },
    { min:16000,  max:26000,  metro:23, other:18 },
    { min:26000,  max:60000,  metro:26, other:21 },
    { min:60000,  max:Infinity, metro:31, other:26 },
  ];
  const isMetro   = d.isMetro !== false; // 기본 광역시
  const discRate  = parseFloat(d.bondDiscRate ?? '13.5') || 13.5;

  // 세대별 분양가로 채권매입액 계산
  const aptBondCalc = aptRows.map(r => {
    const units    = parseFloat(String(r.units||'').replace(/,/g,''))||0;
    const pyPrice  = parseFloat(String(r.py_price||r.pyPrice||'').replace(/,/g,''))||0;
    const supplyPy = parseFloat(String(r.supply_py||r.supplyPy||'').replace(/,/g,''))||0;
    const unitPrice = Math.round(pyPrice * supplyPy); // 세대당 분양가 (천원)
    const band = BOND_REG_RATES.find(b => unitPrice >= b.min && unitPrice < b.max);
    const rate = band ? (isMetro ? band.metro : band.other) : 0;
    const bondBuy = Math.round(unitPrice * rate / 1000 * units);
    return { label: r.type_name||'', units, unitPrice, rate, bondBuy };
  });
  const bondBuyTotal = aptBondCalc.reduce((s,r) => s+r.bondBuy, 0);
  const bondDiscAmt  = Math.round(bondBuyTotal * discRate / 100);

  // 법무사수수료
  const legalRate  = parseFloat(d.legalRate ?? '0.1') || 0;
  const legalDirect = parseFloat(String(d.legalDirect||'').replace(/,/g,''))||0;
  const legalAmt   = legalDirect > 0 ? legalDirect : Math.round(taxBase * legalRate / 100);

  // 최종 합계
  const totalAmt = acqTotal + bondDiscAmt + legalAmt;

  const boxStyle = { border:'1px solid #e0e0e0', borderRadius:'8px', padding:'14px 18px', marginBottom:'14px' };
  const fmtN = (v) => formatNumber(Math.round(v));
  const rowStyle = (i) => ({ backgroundColor: i%2===0?'white':'#f8f9fa' });
  const thS = { padding:'6px 10px', backgroundColor:'#546e7a', color:'white', fontSize:'11px', fontWeight:'bold', textAlign:'center' };
  const tdS = { padding:'5px 8px', borderBottom:'1px solid #eee', fontSize:'11px', verticalAlign:'middle' };

  return (
    <div style={{ position:'fixed', top:0, left:0, width:'100vw', height:'100vh', backgroundColor:'rgba(0,0,0,0.5)', zIndex:2000, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ backgroundColor:'white', borderRadius:'10px', width:'94%', maxWidth:'820px', maxHeight:'92vh', overflowY:'auto', padding:'24px' }}>

        {/* 헤더 */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'18px' }}>
          <div>
            <h3 style={{ margin:0, color:'#546e7a' }}>🏛 보존등기비 계산기</h3>
            <div style={{ fontSize:'11px', color:'#888', marginTop:'3px' }}>지방세법 제11조 제1항 제3호 (원시취득) / 주택도시기금법 시행령 별표 1 제15호</div>
            <div style={{ fontSize:'11px', color:'#888' }}>납부시기: 준공 후 보존등기 시</div>
          </div>
          <button onClick={onClose} style={{ padding:'6px 14px', border:'1px solid #ddd', borderRadius:'6px', cursor:'pointer', backgroundColor:'white', fontSize:'13px' }}>✕ 닫기</button>
        </div>

        {/* 세율 안내 */}
        <div style={{ ...boxStyle, backgroundColor:'#eceff1', borderColor:'#b0bec5' }}>
          <div style={{ fontWeight:'bold', fontSize:'13px', color:'#546e7a', marginBottom:'10px' }}>📋 보존등기 세율 (원시취득)</div>
          <table style={{ borderCollapse:'collapse', fontSize:'12px', width:'100%' }}>
            <thead><tr style={{ backgroundColor:'#546e7a', color:'white' }}>
              <th style={{ padding:'5px 10px', textAlign:'left' }}>항목</th>
              <th style={{ padding:'5px 10px', textAlign:'right' }}>요율</th>
              <th style={{ padding:'5px 10px', textAlign:'left' }}>근거</th>
            </tr></thead>
            <tbody>
              {[
                { label:'취득세',     rate:'2.8%',  note:'지방세법 제11조 제1항 제3호 (원시취득)' },
                { label:'농어촌특별세', rate:'0.2%', note:'취득세액의 10% (국민주택규모 이하 비과세)' },
                { label:'지방교육세',  rate:'0.16%', note:'(취득세율 - 2%) × 20%' },
                { label:'합계',       rate:'3.16%',  note:'국민주택규모(85㎡) 이하: 2.96% (농특세 비과세)', bold:true },
              ].map((r,i) => (
                <tr key={i} style={{ backgroundColor:i%2===0?'white':'#fafafa' }}>
                  <td style={{ padding:'5px 10px', fontWeight:r.bold?'bold':'normal', color:r.bold?'#546e7a':'#333' }}>{r.label}</td>
                  <td style={{ padding:'5px 10px', textAlign:'right', fontWeight:'bold', color:'#546e7a' }}>{r.rate}</td>
                  <td style={{ padding:'5px 10px', fontSize:'11px', color:'#888' }}>{r.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ fontSize:'11px', color:'#7f8c8d', marginTop:'8px' }}>
            ※ 오피스텔: 업무시설로 분류 → 면적 무관 3.16% 적용
          </div>
        </div>

        {/* STEP1 - 과세표준 */}
        <div style={boxStyle}>
          <div style={{ fontWeight:'bold', fontSize:'13px', color:'#546e7a', marginBottom:'12px', display:'flex', alignItems:'center', gap:'8px' }}>
            <span style={{ backgroundColor:'#546e7a', color:'white', borderRadius:'50%', width:'22px', height:'22px', display:'inline-flex', alignItems:'center', justifyContent:'center', fontSize:'12px' }}>1</span>
            과세표준 (건물 신축 원가)
          </div>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'12px' }}>
            <tbody>
              {[
                { label:'직접공사비',    amt:directAmt,   note:'직접공사비 탭 자동연동', auto:true },
                { label:'간접공사비',    amt:indirectAmt, note:'간접공사비 탭 자동연동', auto:true },
                { label:'용역비',       amt:consultAmt,  note:'용역비 탭 자동연동',     auto:true },
                { label:'제세금',       amt:taxAmt,      note:'제세금 탭 자동연동',     auto:true },
                { label:'관리신탁수수료', amt:trustAmt,   note:'부대비 탭 자동연동',     auto:true },
              ].map((r,i) => (
                <tr key={i} style={rowStyle(i)}>
                  <td style={{ ...tdS, fontWeight:'bold', color:'#555', width:'150px' }}>{r.label}</td>
                  <td style={{ ...tdS, textAlign:'right', fontWeight:'bold', color: r.amt>0?'#2c3e50':'#aaa' }}>
                    {r.amt > 0 ? fmtN(r.amt) : '—'}
                  </td>
                  <td style={{ ...tdS, color:'#888', fontSize:'10px' }}>{r.note}</td>
                </tr>
              ))}
              <tr style={{ backgroundColor:'#fff8e1' }}>
                <td style={{ ...tdS, fontWeight:'bold', color:'#e65100' }}>준공전 이자</td>
                <td style={{ ...tdS }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
                    <input value={d.interestAmt||''} onChange={e=>update('interestAmt',e.target.value)}
                      placeholder="직접입력 (금융비 미작업)"
                      style={{ width:'140px', padding:'4px 8px', border:'1px solid #ffe082', borderRadius:'3px', fontSize:'12px', textAlign:'right', backgroundColor:'#fffde7' }} />
                    <span style={{ fontSize:'11px', color:'#888' }}>천원</span>
                  </div>
                </td>
                <td style={{ ...tdS, color:'#e65100', fontSize:'10px' }}>※ 금융비 탭 완성 후 자동연동 예정</td>
              </tr>
              <tr style={{ backgroundColor:'#546e7a' }}>
                <td style={{ padding:'8px 10px', color:'white', fontWeight:'bold' }}>과세표준 합계</td>
                <td style={{ padding:'8px 10px', color:'white', fontWeight:'bold', fontSize:'14px', textAlign:'right' }}>{fmtN(taxBase)} 천원</td>
                <td style={{ padding:'8px 10px' }}></td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* STEP2 - 취득세 계산 */}
        <div style={boxStyle}>
          <div style={{ fontWeight:'bold', fontSize:'13px', color:'#546e7a', marginBottom:'12px', display:'flex', alignItems:'center', gap:'8px' }}>
            <span style={{ backgroundColor:'#546e7a', color:'white', borderRadius:'50%', width:'22px', height:'22px', display:'inline-flex', alignItems:'center', justifyContent:'center', fontSize:'12px' }}>2</span>
            취득세 계산 (타입별 세율 적용)
          </div>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'11px' }}>
            <thead>
              <tr>
                <th style={thS}>타입</th>
                <th style={thS}>전용(㎡)</th>
                <th style={thS}>세대수</th>
                <th style={thS}>구분</th>
                <th style={thS}>세율</th>
                <th style={thS}>과세표준 안분</th>
                <th style={thS}>취득세 (천원)</th>
              </tr>
            </thead>
            <tbody>
              {allRows.map((r,i) => (
                <tr key={i} style={rowStyle(i)}>
                  <td style={{ ...tdS, fontWeight:'bold' }}>{r.label||`타입${i+1}`} {r.isOffi?'(오피스텔)':''}</td>
                  <td style={{ ...tdS, textAlign:'right' }}>{r.isStore ? '—' : fmtN(r.exclM2)}</td>
                  <td style={{ ...tdS, textAlign:'right' }}>
                    {r.isStore
                      ? <span>{fmtN(r.areaM2)}㎡</span>
                      : <span>{fmtN(r.units)}세대<br/><span style={{fontSize:'10px',color:'#888'}}>{fmtN(r.areaM2)}㎡</span></span>}
                  </td>
                  <td style={{ ...tdS, textAlign:'center' }}>
                    <span style={{ fontSize:'10px', padding:'2px 6px', borderRadius:'8px',
                      backgroundColor: r.isStore?'#e3f2fd': r.isNational?'#e8f5e9':'#fff3e0',
                      color: r.isStore?'#1565c0': r.isNational?'#2e7d32':'#e65100', fontWeight:'bold' }}>
                      {r.isStore ? '근린상가' : r.isOffi ? '업무시설' : r.isNational ? '국민주택↓' : '국민주택↑'}
                    </span>
                  </td>
                  <td style={{ ...tdS, textAlign:'center', fontWeight:'bold', color:'#546e7a' }}>{r.rate}%</td>
                  <td style={{ ...tdS, textAlign:'right' }}>{fmtN(r.baseShare)}</td>
                  <td style={{ ...tdS, textAlign:'right', fontWeight:'bold', color:'#546e7a' }}>
                    {fmtN(Math.round(r.baseShare * r.rate / 100))}
                  </td>
                </tr>
              ))}
              <tr style={{ backgroundColor:'#eceff1', fontWeight:'bold' }}>
                <td colSpan={6} style={{ padding:'6px 10px' }}>취득세 합계</td>
                <td style={{ padding:'6px 10px', textAlign:'right', color:'#546e7a', fontSize:'13px' }}>{fmtN(acqTotal)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* STEP3 - 국민주택채권 (등기 시) */}
        <div style={boxStyle}>
          <div style={{ fontWeight:'bold', fontSize:'13px', color:'#546e7a', marginBottom:'12px', display:'flex', alignItems:'center', gap:'8px' }}>
            <span style={{ backgroundColor:'#546e7a', color:'white', borderRadius:'50%', width:'22px', height:'22px', display:'inline-flex', alignItems:'center', justifyContent:'center', fontSize:'12px' }}>3</span>
            국민주택채권 (등기 시) — 별표1 제15호
          </div>
          <div style={{ display:'flex', gap:'16px', marginBottom:'12px', flexWrap:'wrap', alignItems:'center' }}>
            <label style={{ display:'flex', alignItems:'center', gap:'6px', fontSize:'12px', fontWeight:'bold' }}>
              <input type="radio" checked={isMetro} onChange={() => update('isMetro', true)} />
              특별시·광역시 (부산)
            </label>
            <label style={{ display:'flex', alignItems:'center', gap:'6px', fontSize:'12px' }}>
              <input type="radio" checked={!isMetro} onChange={() => update('isMetro', false)} />
              그 밖의 지역
            </label>
            <div style={{ display:'flex', alignItems:'center', gap:'6px', fontSize:'12px' }}>
              <span style={{ fontWeight:'bold', color:'#555' }}>즉시배도율</span>
              <input value={d.bondDiscRate??'13.5'} onChange={e=>update('bondDiscRate',e.target.value)}
                style={{ width:'60px', padding:'4px 6px', border:'1px solid #ddd', borderRadius:'3px', fontSize:'12px', textAlign:'right' }} />
              <span style={{ color:'#888' }}>%</span>
            </div>
          </div>
          {aptBondCalc.length > 0 ? (
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'11px', marginBottom:'8px' }}>
              <thead><tr>
                {['타입','세대당분양가(천원)','적용요율(/1,000)','채권매입액(천원)'].map(h=>(
                  <th key={h} style={thS}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {aptBondCalc.map((r,i) => (
                  <tr key={i} style={rowStyle(i)}>
                    <td style={{ ...tdS, fontWeight:'bold' }}>{r.label||`타입${i+1}`}</td>
                    <td style={{ ...tdS, textAlign:'right' }}>{fmtN(r.unitPrice)}</td>
                    <td style={{ ...tdS, textAlign:'center', fontWeight:'bold', color:'#1a237e' }}>{r.rate}/1,000</td>
                    <td style={{ ...tdS, textAlign:'right', fontWeight:'bold', color:'#1a237e' }}>{fmtN(r.bondBuy)}</td>
                  </tr>
                ))}
                <tr style={{ backgroundColor:'#e8eaf6', fontWeight:'bold' }}>
                  <td colSpan={3} style={{ padding:'6px 10px' }}>채권매입 합계 × {discRate}% (즉시배도)</td>
                  <td style={{ padding:'6px 10px', textAlign:'right', color:'#1a237e' }}>{fmtN(bondBuyTotal)} × {discRate}% = <strong>{fmtN(bondDiscAmt)}</strong></td>
                </tr>
              </tbody>
            </table>
          ) : (
            <div style={{ fontSize:'12px', color:'#aaa', padding:'12px' }}>수입탭에 공동주택 데이터를 입력하세요</div>
          )}
        </div>

        {/* STEP4 - 법무사수수료 */}
        <div style={boxStyle}>
          <div style={{ fontWeight:'bold', fontSize:'13px', color:'#546e7a', marginBottom:'10px', display:'flex', alignItems:'center', gap:'8px' }}>
            <span style={{ backgroundColor:'#546e7a', color:'white', borderRadius:'50%', width:'22px', height:'22px', display:'inline-flex', alignItems:'center', justifyContent:'center', fontSize:'12px' }}>4</span>
            법무사 수수료
          </div>
          <div style={{ display:'flex', gap:'16px', alignItems:'center', flexWrap:'wrap' }}>
            <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
              <span style={{ fontSize:'12px', fontWeight:'bold', color:'#555' }}>요율</span>
              <input value={d.legalRate??'0.1'} onChange={e=>update('legalRate',e.target.value)}
                style={{ width:'70px', padding:'5px 8px', border:'1px solid #546e7a', borderRadius:'3px', fontSize:'13px', textAlign:'right', color:'#546e7a', fontWeight:'bold' }} />
              <span style={{ fontSize:'12px', color:'#888' }}>%</span>
            </div>
            <div style={{ fontSize:'12px', color:'#555' }}>
              과세표준 {fmtN(taxBase)}천원 × {parseFloat(d.legalRate??'0.1')||0}%
              = <strong style={{ color:'#546e7a' }}>{fmtN(Math.round(taxBase*(parseFloat(d.legalRate??'0.1')||0)/100))} 천원</strong>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
              <span style={{ fontSize:'11px', color:'#888' }}>또는 직접입력:</span>
              <input value={d.legalDirect||''} onChange={e=>update('legalDirect',e.target.value)}
                placeholder="직접입력"
                style={{ width:'120px', padding:'4px 8px', border:`1px solid ${d.legalDirect?'#e74c3c':'#ddd'}`, borderRadius:'3px', fontSize:'12px', textAlign:'right', backgroundColor:d.legalDirect?'#fdf2f0':'white' }} />
              {d.legalDirect && <button onClick={()=>update('legalDirect','')} style={{ padding:'3px 8px', fontSize:'11px', backgroundColor:'#e74c3c', color:'white', border:'none', borderRadius:'3px', cursor:'pointer' }}>요율</button>}
              <span style={{ fontSize:'11px', color:'#888' }}>천원</span>
            </div>
          </div>
        </div>

        {/* 합계 + 반영 */}
        <div style={{ backgroundColor:'#546e7a', borderRadius:'8px', padding:'16px 20px' }}>
          <div style={{ color:'#eceff1', fontSize:'12px', marginBottom:'8px', lineHeight:'1.8' }}>
            <div>취득세: {fmtN(acqTotal)}천원 + 국민주택채권할인: {fmtN(bondDiscAmt)}천원 + 법무사: {fmtN(legalAmt)}천원</div>
          </div>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <div>
              <div style={{ color:'white', fontSize:'13px', fontWeight:'bold' }}>보존등기비 합계</div>
            </div>
            <div style={{ display:'flex', gap:'10px', alignItems:'center' }}>
              <div style={{ fontSize:'20px', fontWeight:'bold', color:'white' }}>{fmtN(totalAmt)} 천원</div>
              <button onClick={() => { onApply(totalAmt, d); onClose(); }}
                style={{ padding:'10px 24px', backgroundColor:'#27ae60', color:'white', border:'none', borderRadius:'6px', cursor:'pointer', fontSize:'14px', fontWeight:'bold' }}>
                💾 사업비 반영
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// 재산세 계산기 모달
// ─────────────────────────────────────────────
function PropTaxModal({ onClose, onApply, archData, data, onChange }) {
  const d = data || {};
  const update = (key, val) => onChange({ ...d, [key]: val });

  // 건축개요 연동
  const permitType = archData?.permitType || 'building_permit'; // 허가구분
  const isHousingPlan = permitType === 'housing_plan'; // 주택법 여부

  const totalPublicPrice = (archData?.plots||[]).reduce((s,p) =>
    s + (parseFloat(String(p.totalPrice||'').replace(/,/g,''))||0), 0); // 원
  const publicPriceChun = Math.round(totalPublicPrice / 1000); // 천원

  const constructYear  = parseInt(archData?.constructYear)  || new Date().getFullYear();
  const constructMonth = parseInt(archData?.constructMonth) || 1;
  const constructPeriod = parseFloat(String(archData?.constructPeriod||'').replace(/,/g,''))||24;

  // 준공연도 계산
  const completeYear  = constructYear + Math.floor((constructMonth - 1 + (constructPeriod - 1)) / 12);
  const completeMonth = ((constructMonth - 1 + (constructPeriod - 1)) % 12) + 1;

  // 6월1일 기준 — 착공월이 7월 이후면 첫해 제외
  const skipFirstYear = constructMonth >= 7;

  // 납부 연도 목록 생성
  const taxYears = [];
  for (let y = constructYear; y <= completeYear; y++) {
    // 첫해: 착공월이 7월 이후면 6월1일 이후 착공 → 제외
    if (y === constructYear && skipFirstYear) continue;
    // 마지막해: 준공이 6월1일 이전이면 이미 소유권이전 → 계산에 포함하되 안내
    taxYears.push(y);
  }

  // 세율 계산 함수 — 허가구분에 따라 자동 선택
  // 주택법(분리과세): 0.2% 단일세율 / 건축법(별도합산): 누진세율
  const calcTaxAmt = (taxBase) => {
    let propTax = 0;
    if (isHousingPlan) {
      // 분리과세: 0.2% 단일세율
      propTax = taxBase * 0.002;
    } else {
      // 별도합산: 누진세율
      if (taxBase <= 200000000)       propTax = taxBase * 0.002;
      else if (taxBase <= 1000000000) propTax = 400000 + (taxBase - 200000000) * 0.003;
      else                             propTax = 2800000 + (taxBase - 1000000000) * 0.004;
    }
    const eduTax  = propTax * 0.2;    // 지방교육세
    const cityTax = taxBase * 0.0014; // 도시지역분
    return { propTax, eduTax, cityTax, total: propTax + eduTax + cityTax };
  };
  const calcBilydo = calcTaxAmt; // 하위 호환

  // 공정시장가액비율
  const fairRatio = parseFloat(d.fairRatio ?? '0.7') || 0.7;
  // 세부담 상한
  const capRate = parseFloat(d.capRate ?? '0.04') || 0.04;

  // 과세표준
  const taxBase = Math.round(totalPublicPrice * fairRatio);

  // 연도별 계산 (세부담 상한 4% 적용)
  const yearCalc = [];
  let prevTotal = 0;
  taxYears.forEach((year, i) => {
    const raw = calcBilydo(taxBase);
    const rawTotalChun = Math.round(raw.total / 1000);
    let actualTotalChun;
    if (i === 0 || prevTotal === 0) {
      actualTotalChun = rawTotalChun;
    } else {
      const cap = Math.round(prevTotal * (1 + capRate));
      actualTotalChun = Math.min(rawTotalChun, cap);
    }
    yearCalc.push({
      year,
      propTax:  Math.round(raw.propTax / 1000),
      eduTax:   Math.round(raw.eduTax  / 1000),
      cityTax:  Math.round(raw.cityTax / 1000),
      rawTotal: rawTotalChun,
      actualTotal: actualTotalChun,
      capped: actualTotalChun < rawTotalChun,
    });
    prevTotal = actualTotalChun;
  });

  const grandTotal = yearCalc.reduce((s, r) => s + r.actualTotal, 0);

  const fmtN = (v) => formatNumber(Math.round(v));
  const boxStyle = { border:'1px solid #e0e0e0', borderRadius:'8px', padding:'14px 18px', marginBottom:'14px' };

  return (
    <div style={{ position:'fixed', top:0, left:0, width:'100vw', height:'100vh', backgroundColor:'rgba(0,0,0,0.5)', zIndex:2000, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ backgroundColor:'white', borderRadius:'10px', width:'94%', maxWidth:'800px', maxHeight:'92vh', overflowY:'auto', padding:'24px' }}>

        {/* 헤더 */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'18px' }}>
          <div>
            <h3 style={{ margin:0, color:'#1b5e20' }}>🏘 재산세 계산기 (토지분)</h3>
            <div style={{ fontSize:'11px', color:'#888', marginTop:'3px' }}>지방세법 제111조 / 과세기준일: 매년 6월 1일 / 납부: 9월</div>
          </div>
          <button onClick={onClose} style={{ padding:'6px 14px', border:'1px solid #ddd', borderRadius:'6px', cursor:'pointer', fontSize:'13px' }}>✕ 닫기</button>
        </div>

        {/* 주택법 vs 건축법 안내 */}
        <div style={{ ...boxStyle, backgroundColor: isHousingPlan ? '#e8f5e9' : '#fff3e0', borderColor: isHousingPlan ? '#a5d6a7' : '#ffb74d' }}>
          <div style={{ fontWeight:'bold', fontSize:'13px', color: isHousingPlan ? '#2e7d32' : '#e65100', marginBottom:'8px' }}>
            {isHousingPlan ? '✅ 주택법 (사업계획승인) — 분리과세 적용' : '⚠ 건축법 (건축허가) — 별도합산 적용'}
            <span style={{ fontSize:'11px', fontWeight:'normal', marginLeft:'8px', color:'#888' }}>
              건축개요에서 허가구분 변경 가능
            </span>
          </div>
          <div style={{ fontSize:'12px', color:'#555', lineHeight:'2.0' }}>
            <div style={{ display:'flex', gap:'12px', marginBottom:'6px', flexWrap:'wrap' }}>
              <div style={{ flex:1, minWidth:'200px', backgroundColor:'#e8f5e9', padding:'8px 12px', borderRadius:'6px',
                border: isHousingPlan ? '2px solid #2e7d32' : '1px solid #ddd' }}>
                <div style={{ fontWeight:'bold', color:'#2e7d32', marginBottom:'4px' }}>
                  주택법 (사업계획승인) {isHousingPlan ? '← 현재 프로젝트' : ''}
                </div>
                <div style={{ fontSize:'11px' }}>• 30세대 이상 공동주택</div>
                <div style={{ fontSize:'11px' }}>• 사업계획승인 후 공사중 토지</div>
                <div style={{ fontSize:'11px', fontWeight:'bold', color:'#2e7d32' }}>→ 분리과세 0.2% (저율 혜택)</div>
                <div style={{ fontSize:'10px', color:'#888' }}>근거: 지방세법 시행령 §102⑤7호</div>
              </div>
              <div style={{ flex:1, minWidth:'200px', backgroundColor:'#fce4ec', padding:'8px 12px', borderRadius:'6px',
                border: !isHousingPlan ? '2px solid #c62828' : '1px solid #ddd' }}>
                <div style={{ fontWeight:'bold', color:'#c62828', marginBottom:'4px' }}>
                  건축법 (건축허가) {!isHousingPlan ? '← 현재 프로젝트' : ''}
                </div>
                <div style={{ fontSize:'11px' }}>• 건축허가로 진행하는 주상복합</div>
                <div style={{ fontSize:'11px' }}>• 분리과세 열거조항에 해당 없음</div>
                <div style={{ fontSize:'11px', fontWeight:'bold', color:'#c62828' }}>→ 별도합산 누진세율 적용</div>
                <div style={{ fontSize:'10px', color:'#888' }}>대법원 2013.7.26. 등 판례 확인</div>
              </div>
            </div>
            <div style={{ fontSize:'11px', color:'#888', fontStyle:'italic' }}>
              ※ 분리과세 대상은 지방세법 §106 및 시행령 §102에 한정적으로 열거되어 있으며, 건축법 건축허가는 포함되지 않습니다.
            </div>
          </div>
        </div>

        {/* 납부 기간 안내 */}
        <div style={{ ...boxStyle, backgroundColor:'#e8f5e9', borderColor:'#a5d6a7' }}>
          <div style={{ fontWeight:'bold', fontSize:'13px', color:'#1b5e20', marginBottom:'8px' }}>📅 납부 기간 (건축개요 자동연동)</div>
          <div style={{ display:'flex', gap:'24px', flexWrap:'wrap', fontSize:'12px', color:'#555' }}>
            <div>착공: <strong>{constructYear}년 {constructMonth}월</strong></div>
            <div>공사기간: <strong>{constructPeriod}개월</strong></div>
            <div>준공예정: <strong>{completeYear}년 {completeMonth}월</strong></div>
          </div>
          <div style={{ marginTop:'10px', fontSize:'11px', color:'#555', lineHeight:'1.9' }}>
            <div>• 과세기준일: 매년 <strong>6월 1일</strong> — 그 날 소유자가 납부 의무</div>
            {skipFirstYear
              ? <div style={{ color:'#e65100', fontWeight:'bold' }}>
                  • {constructYear}년 <strong>제외</strong> — 착공월({constructMonth}월)이 7월 이후이므로
                  6월 1일 과세기준일 이후에 착공 → 해당연도 부과 없음
                </div>
              : <div>• {constructYear}년 <strong>포함</strong> — 착공월({constructMonth}월)이 6월 이전이므로 6월 1일 기준 소유</div>}
            <div style={{ color:'#888' }}>• 준공 후 분양 완료 시 소유권 이전 → 이후 재산세는 매수자 부담 (계산 제외)</div>
          </div>
          <div style={{ marginTop:'8px', backgroundColor:'white', padding:'6px 10px', borderRadius:'4px', fontSize:'11px', color:'#888' }}>
            ℹ 토지취득 ~ 착공 전(종합합산), 준공 후(별도합산)는 기간이 짧거나 소유권 이전으로 생략
          </div>
        </div>

        {/* 과세표준 설정 */}
        <div style={boxStyle}>
          <div style={{ fontWeight:'bold', fontSize:'13px', color:'#1b5e20', marginBottom:'12px' }}>
            과세표준 설정
          </div>
          <div style={{ fontSize:'11px', color:'#2980b9', marginBottom:'8px' }}>
            📐 건축개요 토지조서 자동연동 — 개별공시지가: {fmtN(publicPriceChun)} 천원
          </div>
          <div style={{ display:'flex', gap:'24px', flexWrap:'wrap', alignItems:'flex-end' }}>
            <div>
              <label style={{ fontSize:'12px', fontWeight:'bold', color:'#555', display:'block', marginBottom:'4px' }}>
                공정시장가액비율
                <span style={{ fontSize:'10px', color:'#888', fontWeight:'normal', marginLeft:'6px' }}>토지·건축물: 70%</span>
              </label>
              <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
                <input value={d.fairRatio??'0.7'} onChange={e=>update('fairRatio',e.target.value)}
                  style={{ width:'70px', padding:'5px 8px', border:'1px solid #1b5e20', borderRadius:'3px', fontSize:'13px', textAlign:'right', color:'#1b5e20', fontWeight:'bold' }} />
                <span style={{ fontSize:'12px', color:'#888' }}>(= {Math.round((parseFloat(d.fairRatio??'0.7')||0)*100)}%)</span>
              </div>
            </div>
            <div>
              <label style={{ fontSize:'12px', fontWeight:'bold', color:'#555', display:'block', marginBottom:'4px' }}>
                세부담 상한
                <span style={{ fontSize:'10px', color:'#888', fontWeight:'normal', marginLeft:'6px' }}>전년도 대비</span>
              </label>
              <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
                <input value={d.capRate??'0.04'} onChange={e=>update('capRate',e.target.value)}
                  style={{ width:'70px', padding:'5px 8px', border:'1px solid #ddd', borderRadius:'3px', fontSize:'13px', textAlign:'right' }} />
                <span style={{ fontSize:'12px', color:'#888' }}>(= {Math.round((parseFloat(d.capRate??'0.04')||0)*100)}%)</span>
              </div>
            </div>
            <div style={{ fontSize:'12px', color:'#555' }}>
              과세표준: <strong style={{ color:'#1b5e20' }}>{fmtN(taxBase/1000)} 천원</strong>
              <div style={{ fontSize:'10px', color:'#888' }}>{fmtN(publicPriceChun)} × {Math.round(fairRatio*100)}%</div>
            </div>
          </div>
        </div>

        {/* 세율 안내 */}
        <div style={{ ...boxStyle, backgroundColor: isHousingPlan?'#e8f5e9':'#f1f8e9', borderColor: isHousingPlan?'#a5d6a7':'#aed581' }}>
          <div style={{ fontWeight:'bold', fontSize:'12px', color:'#1b5e20', marginBottom:'8px' }}>
            📋 {isHousingPlan ? '분리과세 세율 (지방세법 시행령 §102⑤7호)' : '별도합산토지 세율 (지방세법 §111①2호)'}
          </div>
          <table style={{ borderCollapse:'collapse', fontSize:'11px', width:'100%' }}>
            <thead><tr style={{ backgroundColor:'#1b5e20', color:'white' }}>
              <th style={{ padding:'4px 10px', textAlign:'left' }}>과세표준</th>
              <th style={{ padding:'4px 10px', textAlign:'center' }}>세율</th>
              <th style={{ padding:'4px 10px', textAlign:'left' }}>산식</th>
            </tr></thead>
            <tbody>
              {isHousingPlan ? (
                <tr style={{ backgroundColor:'white' }}>
                  <td style={{ padding:'4px 10px' }}>전체 (단일세율)</td>
                  <td style={{ padding:'4px 10px', textAlign:'center', fontWeight:'bold', color:'#2e7d32' }}>0.2%</td>
                  <td style={{ padding:'4px 10px', color:'#888' }}>과세표준 × 0.2% (누진 없음)</td>
                </tr>
              ) : (
                <>
                  {[
                    { range:'2억원 이하',             rate:'0.2%', formula:'과세표준 × 0.2%' },
                    { range:'2억원 초과 ~ 10억원 이하', rate:'0.3%', formula:'40만원 + (초과분 × 0.3%)' },
                    { range:'10억원 초과',             rate:'0.4%', formula:'280만원 + (초과분 × 0.4%)' },
                  ].map((r,i)=>(
                    <tr key={i} style={{ backgroundColor:i%2===0?'white':'#f9fbe7' }}>
                      <td style={{ padding:'4px 10px' }}>{r.range}</td>
                      <td style={{ padding:'4px 10px', textAlign:'center', fontWeight:'bold', color:'#1b5e20' }}>{r.rate}</td>
                      <td style={{ padding:'4px 10px', color:'#888' }}>{r.formula}</td>
                    </tr>
                  ))}
                </>
              )}
            </tbody>
          </table>
          <div style={{ fontSize:'11px', color:'#555', marginTop:'6px', lineHeight:'1.8' }}>
            <div>+ 지방교육세: 재산세액 × 20%</div>
            <div>+ 도시지역분: 과세표준 × 0.14%</div>
          </div>
        </div>

        {/* 연도별 계산 결과 */}
        <div style={boxStyle}>
          <div style={{ fontWeight:'bold', fontSize:'13px', color:'#1b5e20', marginBottom:'12px' }}>
            연도별 재산세 계산
          </div>
          {yearCalc.length === 0 ? (
            <div style={{ color:'#aaa', fontSize:'12px', padding:'12px' }}>
              납부 대상 연도가 없습니다. 착공월/공사기간을 확인하세요.
            </div>
          ) : (
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'12px' }}>
              <thead>
                <tr style={{ backgroundColor:'#1b5e20', color:'white' }}>
                  {['납부연도','재산세(천원)','지방교육세(천원)','도시지역분(천원)','산출세액(천원)','세부담상한','실납부(천원)'].map(h=>(
                    <th key={h} style={{ padding:'6px 8px', textAlign:'center', fontSize:'11px' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {yearCalc.map((r,i)=>(
                  <tr key={i} style={{ backgroundColor:i%2===0?'white':'#f1f8e9' }}>
                    <td style={{ padding:'5px 8px', textAlign:'center', fontWeight:'bold' }}>{r.year}년</td>
                    <td style={{ padding:'5px 8px', textAlign:'right' }}>{fmtN(r.propTax)}</td>
                    <td style={{ padding:'5px 8px', textAlign:'right' }}>{fmtN(r.eduTax)}</td>
                    <td style={{ padding:'5px 8px', textAlign:'right' }}>{fmtN(r.cityTax)}</td>
                    <td style={{ padding:'5px 8px', textAlign:'right' }}>{fmtN(r.rawTotal)}</td>
                    <td style={{ padding:'5px 8px', textAlign:'center' }}>
                      {r.capped
                        ? <span style={{ fontSize:'10px', color:'#e65100', fontWeight:'bold' }}>상한적용</span>
                        : <span style={{ fontSize:'10px', color:'#888' }}>—</span>}
                    </td>
                    <td style={{ padding:'5px 8px', textAlign:'right', fontWeight:'bold', color:'#1b5e20' }}>{fmtN(r.actualTotal)}</td>
                  </tr>
                ))}
                <tr style={{ backgroundColor:'#1b5e20' }}>
                  <td colSpan={6} style={{ padding:'6px 8px', color:'white', fontWeight:'bold' }}>합계</td>
                  <td style={{ padding:'6px 8px', textAlign:'right', color:'white', fontWeight:'bold', fontSize:'14px' }}>{fmtN(grandTotal)}</td>
                </tr>
              </tbody>
            </table>
          )}
        </div>

        {/* 사업비 반영 */}
        <div style={{ backgroundColor:'#1b5e20', borderRadius:'8px', padding:'16px 20px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div>
            <div style={{ color:'white', fontSize:'13px', fontWeight:'bold' }}>재산세 합계 (착공 ~ 준공)</div>
            <div style={{ color:'#a5d6a7', fontSize:'11px', marginTop:'2px' }}>
              {yearCalc.length}개년도 × 별도합산 / 매년 9월 납부
            </div>
          </div>
          <div style={{ display:'flex', gap:'10px', alignItems:'center' }}>
            <div style={{ fontSize:'20px', fontWeight:'bold', color:'white' }}>{fmtN(grandTotal)} 천원</div>
            <button onClick={() => { onApply(grandTotal, {...d, _applied:true, yearCalc: yearCalc.map(r=>({year:r.year, amt:r.actualTotal, month:9}))}); onClose(); }}
              style={{ padding:'10px 24px', backgroundColor:'#27ae60', color:'white', border:'none', borderRadius:'6px', cursor:'pointer', fontSize:'14px', fontWeight:'bold' }}>
              💾 사업비 반영
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// 종합부동산세 계산기 모달
// ─────────────────────────────────────────────
function CompTaxModal({ onClose, onApply, archData, data, onChange }) {
  const d = data || {};
  const update = (key, val) => onChange({ ...d, [key]: val });

  const permitType    = archData?.permitType || 'building_permit';
  const isHousingPlan = permitType === 'housing_plan';

  // 공시지가
  const totalPublicPrice = (archData?.plots||[]).reduce((s,p) =>
    s + (parseFloat(String(p.totalPrice||'').replace(/,/g,''))||0), 0); // 원
  const totalPublicEok = totalPublicPrice / 100000000; // 억원

  // 과세 기준: 별도합산 80억 초과
  const THRESHOLD = 8000000000; // 80억원
  const isTaxable = !isHousingPlan && totalPublicPrice > THRESHOLD;

  // 건축개요 사업기간
  const constructYear   = parseInt(archData?.constructYear)  || new Date().getFullYear();
  const constructMonth  = parseInt(archData?.constructMonth) || 1;
  const constructPeriod = parseFloat(String(archData?.constructPeriod||'').replace(/,/g,''))||24;
  const completeYear    = constructYear + Math.floor((constructMonth - 1 + (constructPeriod - 1)) / 12);
  const skipFirstYear   = constructMonth >= 7;

  const taxYears = [];
  for (let y = constructYear; y <= completeYear; y++) {
    if (y === constructYear && skipFirstYear) continue;
    taxYears.push(y);
  }

  // 공제액: 별도합산 80억
  const deduction    = THRESHOLD;
  // 공정시장가액비율: 100% (2022년 이후)
  const fairRatio    = parseFloat(d.fairRatio ?? '1.0') || 1.0;
  // 세부담 상한: 150%
  const capRate      = 1.5;
  // 즉시배도율 연동
  const discRate     = parseFloat(d.discRate ?? '13.5') || 13.5;

  // 과세표준
  const taxBase = Math.max(0, (totalPublicPrice - deduction) * fairRatio);

  // 별도합산 세율
  const calcCompTax = (base) => {
    if (base <= 0) return 0;
    if (base <= 20000000000)       return base * 0.005;
    if (base <= 40000000000)       return 100000000 + (base - 20000000000) * 0.006;
    return 220000000 + (base - 40000000000) * 0.007;
  };

  const compTaxAnnual = calcCompTax(taxBase);
  const agriTaxAnnual = compTaxAnnual * 0.2; // 농어촌특별세

  // 연도별 계산
  const yearCalc = [];
  let prevTotal = 0;
  taxYears.forEach((year, i) => {
    const annualChun = Math.round((compTaxAnnual + agriTaxAnnual) / 1000);
    let actualChun;
    if (i === 0 || prevTotal === 0) {
      actualChun = annualChun;
    } else {
      const cap = Math.round(prevTotal * capRate);
      actualChun = Math.min(annualChun, cap);
    }
    yearCalc.push({
      year,
      compTax:   Math.round(compTaxAnnual / 1000),
      agriTax:   Math.round(agriTaxAnnual / 1000),
      rawTotal:  annualChun,
      actualTotal: actualChun,
      capped:    actualChun < annualChun,
    });
    prevTotal = actualChun;
  });

  const grandTotal = yearCalc.reduce((s, r) => s + r.actualTotal, 0);

  const fmtN = (v) => formatNumber(Math.round(v));
  const boxStyle = { border:'1px solid #e0e0e0', borderRadius:'8px', padding:'14px 18px', marginBottom:'14px' };

  return (
    <div style={{ position:'fixed', top:0, left:0, width:'100vw', height:'100vh', backgroundColor:'rgba(0,0,0,0.5)', zIndex:2000, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ backgroundColor:'white', borderRadius:'10px', width:'94%', maxWidth:'780px', maxHeight:'92vh', overflowY:'auto', padding:'24px' }}>

        {/* 헤더 */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'18px' }}>
          <div>
            <h3 style={{ margin:0, color:'#4a148c' }}>💰 종합부동산세 계산기 (토지분)</h3>
            <div style={{ fontSize:'11px', color:'#888', marginTop:'3px' }}>종합부동산세법 제12조 / 과세기준일: 매년 6월 1일 / 납부: 12월</div>
          </div>
          <button onClick={onClose} style={{ padding:'6px 14px', border:'1px solid #ddd', borderRadius:'6px', cursor:'pointer', fontSize:'13px' }}>✕ 닫기</button>
        </div>

        {/* 과세구분 안내 */}
        <div style={{ ...boxStyle, backgroundColor: isHousingPlan?'#e8f5e9': isTaxable?'#fce4ec':'#e8f5e9',
          borderColor: isHousingPlan?'#a5d6a7': isTaxable?'#ef9a9a':'#a5d6a7' }}>
          <div style={{ fontWeight:'bold', fontSize:'13px',
            color: isHousingPlan?'#2e7d32': isTaxable?'#c62828':'#2e7d32', marginBottom:'8px' }}>
            {isHousingPlan
              ? '✅ 주택법(분리과세) → 종합부동산세 과세 없음'
              : isTaxable
                ? `⚠ 건축법 + 공시지가 ${fmtN(totalPublicEok.toFixed(1))}억 > 80억 → 과세대상`
                : `✅ 건축법 + 공시지가 ${fmtN(totalPublicEok.toFixed(1))}억 ≤ 80억 → 과세 없음`}
          </div>
          <div style={{ fontSize:'12px', color:'#555', lineHeight:'1.9' }}>
            <div>• 별도합산토지: 전국합산 공시가격이 <strong>80억원 초과</strong>인 경우 과세</div>
            <div>• 근거: 종합부동산세법 제12조 제1항</div>
            {isHousingPlan && <div style={{ color:'#2e7d32' }}>• 주택법 사업계획승인 → 분리과세 → 종부세법 §11에 따라 종부세 과세대상 아님</div>}
            {!isHousingPlan && !isTaxable && (
              <div style={{ color:'#2e7d32' }}>• 공시지가 {fmtN(totalPublicEok.toFixed(1))}억 ≤ 80억 → 납세의무 없음 → 종부세 0원</div>
            )}
            <div style={{ fontSize:'11px', color:'#888', marginTop:'4px' }}>
              ※ 건축개요에서 허가구분 변경 가능 / 공시지가는 토지조서 자동연동
            </div>
          </div>
        </div>

        {/* 과세표준 */}
        {isTaxable && (
          <>
            <div style={boxStyle}>
              <div style={{ fontWeight:'bold', fontSize:'13px', color:'#4a148c', marginBottom:'10px' }}>과세표준 계산</div>
              <div style={{ fontSize:'12px', color:'#555', lineHeight:'2.0' }}>
                <div>공시가격 합계: <strong>{fmtN(totalPublicEok.toFixed(2))}억원</strong> (토지조서 자동연동)</div>
                <div>공제액: <strong>80억원</strong> (별도합산토지 기본공제)</div>
                <div>차감 후: <strong>{fmtN((totalPublicPrice-deduction)/100000000)}억원</strong></div>
                <div style={{ display:'flex', alignItems:'center', gap:'8px', marginTop:'6px' }}>
                  <span>공정시장가액비율:</span>
                  <input value={d.fairRatio??'1.0'} onChange={e=>update('fairRatio',e.target.value)}
                    style={{ width:'70px', padding:'4px 8px', border:'1px solid #4a148c', borderRadius:'3px', fontSize:'13px', textAlign:'right', color:'#4a148c', fontWeight:'bold' }} />
                  <span style={{ fontSize:'12px', color:'#888' }}>({Math.round((parseFloat(d.fairRatio??'1.0')||0)*100)}%)</span>
                  <span style={{ fontSize:'11px', color:'#888' }}>※ 2022년 이후 100%</span>
                </div>
                <div style={{ marginTop:'6px', fontWeight:'bold', color:'#4a148c' }}>
                  과세표준: {fmtN(taxBase/100000000)}억원
                </div>
              </div>
            </div>

            {/* 세율 안내 */}
            <div style={{ ...boxStyle, backgroundColor:'#f3e5f5', borderColor:'#ce93d8' }}>
              <div style={{ fontWeight:'bold', fontSize:'12px', color:'#4a148c', marginBottom:'8px' }}>
                📋 별도합산토지 종부세 세율 (종합부동산세법 §12①2호)
              </div>
              <table style={{ borderCollapse:'collapse', fontSize:'11px', width:'100%', marginBottom:'8px' }}>
                <thead><tr style={{ backgroundColor:'#4a148c', color:'white' }}>
                  <th style={{ padding:'4px 10px', textAlign:'left' }}>과세표준</th>
                  <th style={{ padding:'4px 10px', textAlign:'center' }}>세율</th>
                  <th style={{ padding:'4px 10px', textAlign:'left' }}>산식</th>
                </tr></thead>
                <tbody>
                  {[
                    { range:'200억 이하',          rate:'0.5%', formula:'과세표준 × 0.5%' },
                    { range:'200억 초과 ~ 400억 이하', rate:'0.6%', formula:'1억원 + (초과분 × 0.6%)' },
                    { range:'400억 초과',           rate:'0.7%', formula:'2.2억원 + (초과분 × 0.7%)' },
                  ].map((r,i) => (
                    <tr key={i} style={{ backgroundColor:i%2===0?'white':'#f8f0fd' }}>
                      <td style={{ padding:'4px 10px' }}>{r.range}</td>
                      <td style={{ padding:'4px 10px', textAlign:'center', fontWeight:'bold', color:'#4a148c' }}>{r.rate}</td>
                      <td style={{ padding:'4px 10px', color:'#888' }}>{r.formula}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ fontSize:'11px', color:'#555', lineHeight:'1.8' }}>
                <div>+ 농어촌특별세: 종부세액 × 20%</div>
                <div>- 법정공제세액: 재산세 이중과세 방지 (재산세와 종부세 간 조정)</div>
                <div style={{ color:'#888' }}>※ 세부담 상한: 전년도 × 150%</div>
              </div>
            </div>

            {/* 연도별 계산 */}
            <div style={boxStyle}>
              <div style={{ fontWeight:'bold', fontSize:'13px', color:'#4a148c', marginBottom:'10px' }}>연도별 종합부동산세</div>
              {yearCalc.length === 0
                ? <div style={{ color:'#aaa', fontSize:'12px' }}>납부 대상 연도가 없습니다.</div>
                : (
                  <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'12px' }}>
                    <thead>
                      <tr style={{ backgroundColor:'#4a148c', color:'white' }}>
                        {['납부연도','종부세(천원)','농특세(천원)','산출세액(천원)','세부담상한','실납부(천원)'].map(h=>(
                          <th key={h} style={{ padding:'5px 8px', textAlign:'center', fontSize:'11px' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {yearCalc.map((r,i)=>(
                        <tr key={i} style={{ backgroundColor:i%2===0?'white':'#f3e5f5' }}>
                          <td style={{ padding:'5px 8px', textAlign:'center', fontWeight:'bold' }}>{r.year}년</td>
                          <td style={{ padding:'5px 8px', textAlign:'right' }}>{fmtN(r.compTax)}</td>
                          <td style={{ padding:'5px 8px', textAlign:'right' }}>{fmtN(r.agriTax)}</td>
                          <td style={{ padding:'5px 8px', textAlign:'right' }}>{fmtN(r.rawTotal)}</td>
                          <td style={{ padding:'5px 8px', textAlign:'center' }}>
                            {r.capped
                              ? <span style={{ fontSize:'10px', color:'#e65100', fontWeight:'bold' }}>상한적용</span>
                              : <span style={{ fontSize:'10px', color:'#888' }}>—</span>}
                          </td>
                          <td style={{ padding:'5px 8px', textAlign:'right', fontWeight:'bold', color:'#4a148c' }}>{fmtN(r.actualTotal)}</td>
                        </tr>
                      ))}
                      <tr style={{ backgroundColor:'#4a148c' }}>
                        <td colSpan={5} style={{ padding:'6px 8px', color:'white', fontWeight:'bold' }}>합계</td>
                        <td style={{ padding:'6px 8px', textAlign:'right', color:'white', fontWeight:'bold', fontSize:'14px' }}>{fmtN(grandTotal)}</td>
                      </tr>
                    </tbody>
                  </table>
                )}
            </div>
          </>
        )}

        {/* 사업비 반영 */}
        <div style={{ backgroundColor:'#4a148c', borderRadius:'8px', padding:'16px 20px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div>
            <div style={{ color:'white', fontSize:'13px', fontWeight:'bold' }}>종합부동산세 합계</div>
            <div style={{ color:'#ce93d8', fontSize:'11px', marginTop:'2px' }}>
              {isHousingPlan ? '주택법(분리과세) — 과세없음'
                : isTaxable ? `${yearCalc.length}개년도 / 매년 12월 납부`
                : '공시지가 80억 미만 — 과세없음'}
            </div>
          </div>
          <div style={{ display:'flex', gap:'10px', alignItems:'center' }}>
            <div style={{ fontSize:'20px', fontWeight:'bold', color:'white' }}>{fmtN(grandTotal)} 천원</div>
            <button onClick={() => { onApply(grandTotal, {...d, _applied:true, yearCalc: yearCalc.map(r=>({year:r.year, amt:r.actualTotal, month:12}))}); onClose(); }}
              style={{ padding:'10px 24px', backgroundColor:'#27ae60', color:'white', border:'none', borderRadius:'6px', cursor:'pointer', fontSize:'14px', fontWeight:'bold' }}>
              💾 사업비 반영
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// 분양보증수수료 계산기 모달
// ─────────────────────────────────────────────
function HugModal({ onClose, onApply, archData, incomeData, salesData, data, onChange }) {
  const d = data || {};
  const update = (key, val) => onChange({ ...d, [key]: val });

  // ── 공통설정 ──
  const bizType    = d.bizType    || 'normal';  // normal=일반, mixed=주상복합
  const landRatio  = bizType === 'mixed' ? 40 : 30;
  const landRate   = parseFloat(d.landRate   ?? '0.133') || 0;
  const constRate  = parseFloat(d.constRate  ?? '0.200') || 0;

  // ── 보증기간 (착공월 ~ 준공후1개월) ──
  // const prepPeriod      = parseFloat(String(archData?.prepPeriod      ||'').replace(/,/g,''))||0;
  const constructPeriod = parseFloat(String(archData?.constructPeriod ||'').replace(/,/g,''))||31;
  const guaranteeDays   = Math.round((constructPeriod + 1) * 30.44);  // 개월 → 일수 근사

  // ── 수입탭 데이터 ──
  const aptRows   = incomeData?.aptRows   || [];
  const offiRows  = incomeData?.offiRows  || [];

  const calcRowIncome = (rows, mode, withVat) => rows.reduce((s, r) => {
    const excl  = parseFloat(String(r.excl_m2 ||'').replace(/,/g,''))||0;
    const wall  = parseFloat(String(r.wall_m2 ||'').replace(/,/g,''))||0;
    const core  = parseFloat(String(r.core_m2 ||'').replace(/,/g,''))||0;
    const mgmt  = parseFloat(String(r.mgmt_m2 ||'').replace(/,/g,''))||0;
    const comm  = parseFloat(String(r.comm_m2 ||'').replace(/,/g,''))||0;
    const park  = parseFloat(String(r.park_m2 ||'').replace(/,/g,''))||0;
    const tel   = parseFloat(String(r.tel_m2  ||'').replace(/,/g,''))||0;
    const elec  = parseFloat(String(r.elec_m2 ||'').replace(/,/g,''))||0;
    const units = parseFloat(String(r.units   ||'').replace(/,/g,''))||0;
    const pyP   = parseFloat(String(r.py_price||'').replace(/,/g,''))||0;
    const sup_py  = (excl+wall+core)*0.3025;
    const cont_py = (excl+wall+core+mgmt+comm+park+tel+elec)*0.3025;
    const u = mode==='apt' ? pyP*sup_py : pyP*cont_py;
    const income = u * units;
    return s + (withVat ? income * 1.1 : income);
  }, 0);

  // 공동주택: 면세 (부가세 없음), 오피스텔: 부가세 포함
  const aptIncome  = calcRowIncome(aptRows,  'apt',  false);
  const offiIncome = calcRowIncome(offiRows, 'offi', true);

  // ── 분양율탭 계약금/중도금 비율 ──
  const aptCfg  = salesData?.aptConfig  || {};
  const offiCfg = salesData?.offiConfig || {};
  const aptDepR  = parseFloat(aptCfg.depositRate  ?? '10') || 10;
  const aptBalR  = parseFloat(aptCfg.balanceRate  ?? '30') || 30;
  const aptMidR  = 100 - aptDepR - aptBalR;  // 중도금 = 100 - 계약금 - 잔금
  const offiDepR = parseFloat(offiCfg.depositRate ?? '10') || 10;
  const offiBalR = parseFloat(offiCfg.balanceRate ?? '30') || 30;
  const offiMidR = 100 - offiDepR - offiBalR;

  // ── 총보증금액 = 분양수입 × (계약금% + 중도금%) ──
  const aptGuarAmt  = aptIncome  * (aptDepR  + aptMidR)  / 100;
  const offiGuarAmt = offiIncome * (offiDepR + offiMidR) / 100;

  // ── 대지비/건축비 분리 ──
  const aptLandAmt   = aptGuarAmt  * landRatio / 100;
  const aptConstAmt  = aptGuarAmt  - aptLandAmt;
  const offiLandAmt  = offiGuarAmt * landRatio / 100;
  const offiConstAmt = offiGuarAmt - offiLandAmt;

  // ── 수수료 계산 ──
  const aptFee  = (aptLandAmt  * landRate/100 + aptConstAmt  * constRate/100) * guaranteeDays / 365;
  const offiFee = (offiLandAmt * landRate/100 + offiConstAmt * constRate/100) * guaranteeDays / 365;
  const totalFee = Math.round(aptFee + offiFee);

  // 스타일
  const boxStyle  = { border: '1px solid #e0e0e0', borderRadius: '8px', padding: '16px 20px', marginBottom: '16px' };
  const stepHd    = (title, color='#2c3e50') => (
    <div style={{ fontWeight: 'bold', fontSize: '14px', color, marginBottom: '10px', paddingBottom: '6px', borderBottom: `2px solid ${color}20` }}>
      {title}
    </div>
  );
  const formula = (text) => (
    <div style={{ backgroundColor: '#f8f9fa', border: '1px solid #e9ecef', borderRadius: '4px', padding: '8px 12px', fontFamily: 'monospace', fontSize: '12px', color: '#495057', margin: '6px 0' }}>
      {text}
    </div>
  );
  const calcLine = (label, value, color='#2c3e50', bold=false) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #f5f5f5' }}>
      <span style={{ fontSize: '12px', color: '#666' }}>{label}</span>
      <span style={{ fontSize: bold?'14px':'12px', fontWeight: bold?'bold':'normal', color }}>{value}</span>
    </div>
  );

  // 섹션별 계산 블록
  const SectionCalc = ({ title, color, income, incomeLabel, depR, midR, balR, guarAmt, landAmt, constAmt, fee }) => (
    <div style={{ ...boxStyle, borderColor: color+'40' }}>
      {stepHd(`■ ${title}`, color)}
      {calcLine('분양수입 (부가세포함)', `${formatNumber(Math.round(income))} 천원 ${incomeLabel}`)}
      <div style={{ backgroundColor: '#f0f4f8', borderRadius: '4px', padding: '6px 10px', margin: '4px 0', fontSize: '11px', color: '#555' }}>
        <span style={{ color: '#888' }}>분양율탭 연동 → </span>
        <span style={{ fontWeight: 'bold' }}>계약금 {depR}%</span>
        <span style={{ color: '#aaa', margin: '0 4px' }}>+</span>
        <span style={{ fontWeight: 'bold' }}>중도금 {midR}%</span>
        <span style={{ color: '#aaa', margin: '0 4px' }}>(=100-계약금{depR}%-잔금{balR}%)</span>
        <span style={{ color: '#2980b9', fontWeight: 'bold', marginLeft: '6px' }}>= 보증대상 {depR+midR}%</span>
      </div>
      {calcLine('총보증금액 (계약금+중도금)', `${formatNumber(Math.round(guarAmt))} 천원`, '#1565c0', true)}
      <div style={{ height: '8px' }} />
      {formula(`대지비부분: ${formatNumber(Math.round(guarAmt))} × ${landRatio}% = ${formatNumber(Math.round(landAmt))} 천원`)}
      {formula(`건축비부분: ${formatNumber(Math.round(guarAmt))} - ${formatNumber(Math.round(landAmt))} = ${formatNumber(Math.round(constAmt))} 천원`)}
      {formula(`수수료: (${formatNumber(Math.round(landAmt))}×${landRate}% + ${formatNumber(Math.round(constAmt))}×${constRate}%) × ${guaranteeDays}/365`)}
      <div style={{ backgroundColor: color+'15', borderRadius: '6px', padding: '8px 12px', marginTop: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '13px', fontWeight: 'bold', color }}>{title} 수수료</span>
        <span style={{ fontSize: '15px', fontWeight: 'bold', color }}>{formatNumber(Math.round(fee))} 천원</span>
      </div>
    </div>
  );

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ backgroundColor: 'white', borderRadius: '10px', width: '92%', maxWidth: '700px', maxHeight: '90vh', overflowY: 'auto', padding: '24px' }}>

        {/* 헤더 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <h3 style={{ margin: 0, color: '#2c3e50' }}>분양보증수수료 계산기</h3>
            <div style={{ fontSize: '12px', color: '#888', marginTop: '3px' }}>HUG 주택도시보증공사 기준</div>
          </div>
          <button onClick={onClose} style={{ padding: '6px 14px', border: '1px solid #ddd', borderRadius: '6px', cursor: 'pointer', backgroundColor: 'white', fontSize: '13px' }}>✕ 닫기</button>
        </div>

        {/* 계산식 + 산출근거 */}
        <div style={{ ...boxStyle, backgroundColor: '#fff8e1', borderColor: '#ffe082' }}>
          {stepHd('📋 계산식 (근거: 주택도시보증공사 보증약관)', '#e65100')}
          {formula('수수료 = (대지비부분 × 대지비요율 + 건축비부분 × 건축비요율) × 보증기간일수 / 365')}
          <div style={{ fontSize: '11px', color: '#555', marginTop: '10px', lineHeight: '1.8' }}>
            <div>• <span style={{ color: '#c62828', fontWeight: 'bold' }}>대지비부분 보증금액</span> = 총보증금액 × 대지비비율 (주상복합 40% / 일반 공동주택 30%)</div>
            <div>• <span style={{ color: '#1565c0', fontWeight: 'bold' }}>건축비부분 보증금액</span> = 총보증금액 - 대지비부분</div>
            <div>• <span style={{ fontWeight: 'bold' }}>총보증금액</span> = 계약금 + 중도금 <span style={{ color: '#888' }}>(잔금 제외)</span></div>
            <div>• <span style={{ fontWeight: 'bold' }}>대지비요율</span> = 0.133%/년 (직접 수정 가능)</div>
            <div>• <span style={{ fontWeight: 'bold' }}>건축비요율</span> = 0.200%/년 (직접 수정 가능, HUG 심사 매트릭스 참조)</div>
            <div>• <span style={{ fontWeight: 'bold' }}>보증기간</span> = 착공월 ~ 준공후 1개월 (자동 계산)</div>
          </div>
        </div>

        {/* HUG 상품 구분표 */}
        <div style={{ ...boxStyle }}>
          {stepHd('HUG 분양보증 상품 구분', '#2c3e50')}
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr style={{ backgroundColor: '#2c3e50', color: 'white' }}>
                {['시설 유형','HUG 보증 상품','보증 대상','계약·중도금 보호','비고'].map(h => (
                  <th key={h} style={{ padding: '7px 10px', textAlign: 'center', fontWeight: 'bold' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { type: '아파트/주상복합', product: '주택분양보증', target: '✓ (주 대상)', mid: '✓', note: '대지비 0.133% + 건축비 변동' },
                { type: '오피스텔',       product: '오피스텔분양보증', target: '✓ (별도 상품)', mid: '✓', note: '유사 (대지비/건축비 구분), 주거용 한정' },
                { type: '근린상가',       product: '없음 (미적용)', target: '✗', mid: '✗', note: '후분양 또는 자체 보증' },
              ].map((r, i) => (
                <tr key={i} style={{ backgroundColor: i%2===0 ? 'white' : '#fafafa', textAlign: 'center' }}>
                  <td style={{ padding: '7px 10px', fontWeight: 'bold' }}>{r.type}</td>
                  <td style={{ padding: '7px 10px' }}>{r.product}</td>
                  <td style={{ padding: '7px 10px', color: r.target.startsWith('✓') ? '#27ae60' : '#e74c3c', fontWeight: 'bold' }}>{r.target}</td>
                  <td style={{ padding: '7px 10px', color: r.mid === '✓' ? '#27ae60' : '#e74c3c', fontWeight: 'bold' }}>{r.mid}</td>
                  <td style={{ padding: '7px 10px', fontSize: '11px', textAlign: 'left', color: '#555' }}>{r.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 공통설정 */}
        <div style={{ ...boxStyle, backgroundColor: '#f8f9fa' }}>
          {stepHd('공통 설정', '#546e7a')}
          <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            {/* 사업유형 */}
            <div>
              <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '4px' }}>사업유형</label>
              <select value={bizType} onChange={e => update('bizType', e.target.value)}
                style={{ padding: '6px 10px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '13px', fontWeight: 'bold', color: '#2c3e50' }}>
                <option value="normal">일반 공동주택</option>
                <option value="mixed">주상복합</option>
              </select>
              <div style={{ fontSize: '10px', color: '#7b1fa2', marginTop: '3px' }}>→ 대지비비율: {landRatio}% 자동 변경</div>
            </div>
            {/* 대지비요율 */}
            <div>
              <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#c62828', display: 'block', marginBottom: '4px' }}>대지비요율(%/년)</label>
              <input value={d.landRate ?? '0.133'} onChange={e => update('landRate', e.target.value)}
                style={{ width: '80px', padding: '6px 8px', border: '1px solid #c62828', borderRadius: '4px', fontSize: '13px', textAlign: 'right', color: '#c62828', fontWeight: 'bold' }} />
            </div>
            {/* 건축비요율 */}
            <div>
              <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#1565c0', display: 'block', marginBottom: '4px' }}>건축비요율(%/년)</label>
              <input value={d.constRate ?? '0.200'} onChange={e => update('constRate', e.target.value)}
                style={{ width: '80px', padding: '6px 8px', border: '1px solid #1565c0', borderRadius: '4px', fontSize: '13px', textAlign: 'right', color: '#1565c0', fontWeight: 'bold' }} />
            </div>
            {/* 보증기간 */}
            <div>
              <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '4px' }}>보증기간</label>
              <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#2c3e50', padding: '6px 0' }}>
                {guaranteeDays}일
              </div>
              <div style={{ fontSize: '10px', color: '#888' }}>착공월~준공후1개월 (자동)</div>
            </div>
          </div>
        </div>

        {/* 공동주택 섹션 */}
        {aptIncome > 0 && (
          <SectionCalc
            title="공동주택" color="#3d6a99"
            income={aptIncome} incomeLabel="(면세)"
            depR={aptDepR} midR={aptMidR} balR={aptBalR}
            guarAmt={aptGuarAmt} landAmt={aptLandAmt} constAmt={aptConstAmt}
            fee={aptFee}
          />
        )}

        {/* 오피스텔 섹션 */}
        {offiIncome > 0 && (
          <SectionCalc
            title="오피스텔" color="#347a6a"
            income={offiIncome} incomeLabel="(부가세 포함)"
            depR={offiDepR} midR={offiMidR} balR={offiBalR}
            guarAmt={offiGuarAmt} landAmt={offiLandAmt} constAmt={offiConstAmt}
            fee={offiFee}
          />
        )}

        {/* 합계 + 반영 */}
        <div style={{ backgroundColor: '#2c3e50', borderRadius: '8px', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ color: 'white', fontSize: '14px', fontWeight: 'bold' }}>총 분양보증수수료</div>
            <div style={{ color: '#aaa', fontSize: '11px', marginTop: '3px' }}>
              공동주택 {formatNumber(Math.round(aptFee))} + 오피스텔 {formatNumber(Math.round(offiFee))} | 보증기간 {guaranteeDays}일
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#f1c40f' }}>{formatNumber(totalFee)} 천원</div>
            <button onClick={() => { onApply(totalFee, d); onClose(); }}
              style={{ padding: '8px 20px', backgroundColor: '#27ae60', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }}>
              사업비 반영
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// 판매비 섹션
// ─────────────────────────────────────────────
function SalesCostSection({ data, onChange, incomeData, archData, salesData }) {
  const [showHugModal, setShowHugModal] = useState(false);
  const d = data || {};
  const update = (key, val) => onChange({ ...d, [key]: val });
  const updateFunding = (key, val) => onChange({ ...d, [`${key}_funding`]: val });

  // ── 분양기간 계산 ──
  // 분양율탭 공동주택 aptConfig.endMonth 참조
  const aptCfg        = salesData?.aptConfig || {};
  const patternEnd    = parseInt(aptCfg.endMonth) || 0;  // 0 = 준공시 완판
  const constructPeriod = parseFloat(String(archData?.constructPeriod||'').replace(/,/g,''))||31;
  const autoSalesPeriod = patternEnd > 0 ? patternEnd : constructPeriod;
  // 직접입력 override
  const salesPeriod   = d.salesPeriodOverride
    ? parseInt(d.salesPeriodOverride) || autoSalesPeriod
    : autoSalesPeriod;

  // ── 수입탭 분양수입 (apt+offi+store, 발코니 제외) ──
  const aptRows   = incomeData?.aptRows   || [];
  const offiRows  = incomeData?.offiRows  || [];
  const storeRows = incomeData?.storeRows || [];

  const calcTotal = (rows, mode) => rows.reduce((s, r) => {
    const excl  = parseFloat(String(r.excl_m2 ||'').replace(/,/g,''))||0;
    const wall  = parseFloat(String(r.wall_m2 ||'').replace(/,/g,''))||0;
    const core  = parseFloat(String(r.core_m2 ||'').replace(/,/g,''))||0;
    const mgmt  = parseFloat(String(r.mgmt_m2 ||'').replace(/,/g,''))||0;
    const comm  = parseFloat(String(r.comm_m2 ||'').replace(/,/g,''))||0;
    const park  = parseFloat(String(r.park_m2 ||'').replace(/,/g,''))||0;
    const tel   = parseFloat(String(r.tel_m2  ||'').replace(/,/g,''))||0;
    const elec  = parseFloat(String(r.elec_m2 ||'').replace(/,/g,''))||0;
    const units = parseFloat(String(r.units   ||'').replace(/,/g,''))||0;
    const pyPrice = parseFloat(String(r.py_price||'').replace(/,/g,''))||0;
    const sup_py  = (excl+wall+core)*0.3025;
    const cont_py = (excl+wall+core+mgmt+comm+park+tel+elec)*0.3025;
    const u = mode==='apt' ? pyPrice*sup_py : pyPrice*cont_py;
    return s + u*units;
  }, 0);

  const aptTotal   = calcTotal(aptRows,   'apt');
  const offiTotal  = calcTotal(offiRows,  'offi');
  const storeTotal = calcTotal(storeRows, 'store');
  const saleIncome = aptTotal + offiTotal + storeTotal;

  // ── 모델하우스 설치비 단위 ──
  const mhUnit = d.mhUnit || '평';

  // ── 각 항목 금액 계산 ──
  const p = (key) => parseFloat(String(d[key]||'').replace(/,/g,''))||0;

  const mhRentAmt  = Math.round(p('mhRentMonth')  * salesPeriod);
  const mhArea     = p('mhAreaInput');
  const mhAreaCalc = mhUnit === '평' ? mhArea : mhArea * 0.3025;
  const mhInstAmt  = Math.round(p('mhInstPrice') * mhAreaCalc);
  const mhOperAmt  = Math.round(p('mhOperMonth') * salesPeriod);
  const adAmt      = Math.round(saleIncome * (p('adRate') / 100));

  // ── 분양대행수수료 (공동주택/오피스텔/근린상가 분리) ──
  // 공동주택: 세대수 × 세대별금액
  const aptUnits      = aptRows.reduce((s,r) => s+(parseFloat(String(r.units||'').replace(/,/g,''))||0), 0);
  const agentAptAmt   = Math.round(aptUnits * p('agentAptPerUnit'));

  // 오피스텔: 기본 매출액×요율, 또는 세대수×세대별금액
  const offiUnits     = offiRows.reduce((s,r) => s+(parseFloat(String(r.units||'').replace(/,/g,''))||0), 0);
  const offiAgentMode = d.offiAgentMode || 'rate';
  const agentOffiAmt  = offiAgentMode === 'rate'
    ? Math.round(offiTotal * (p('agentOffiRate') / 100))
    : Math.round(offiUnits * p('agentOffiPerUnit'));

  // 근린상가: 매출액 × 요율
  const agentStoreAmt = Math.round(storeTotal * (p('agentStoreRate') / 100));

  const agentTotalAmt = agentAptAmt + agentOffiAmt + agentStoreAmt;

  // ── 분양보증수수료 (모달에서 반영) ──
  const hugAmt   = parseFloat(String(d.hugAmt||'').replace(/,/g,''))||0;
  const hugData  = d.hugData || {};

  const etcItems   = d.etcItems || [];
  const etcTotal   = etcItems.reduce((s, it) => s + (parseFloat(String(it.amt||'').replace(/,/g,''))||0), 0);
  const total      = mhRentAmt + mhInstAmt + mhOperAmt + adAmt + agentTotalAmt + hugAmt + etcTotal;
  const vatTotal = Math.round(
    (!!d.mhRent_taxable?mhRentAmt*0.1:0)+(!!d.mhInst_taxable?mhInstAmt*0.1:0)+
    (!!d.mhOper_taxable?mhOperAmt*0.1:0)+(!!d.ad_taxable?adAmt*0.1:0)+
    (!!d.agentApt_taxable?agentAptAmt*0.1:0)+(!!d.agentOffi_taxable?agentOffiAmt*0.1:0)+
    (!!d.agentStore_taxable?agentStoreAmt*0.1:0)+(!!d.hug_taxable?hugAmt*0.1:0)+
    etcItems.reduce((s,it)=>s+(!!it.taxable?(parseFloat(String(it.amt||'').replace(/,/g,''))||0)*0.1:0),0));

  const tdStyle    = { padding: '6px 8px', borderBottom: '1px solid #eee', verticalAlign: 'middle' };
  const labelStyle = { fontWeight: 'bold', fontSize: '13px', color: '#2c3e50' };
  const addEtc     = () => update('etcItems', [...etcItems, { name: '', amt: '', funding: { equity: '0', pf: '100', sale: '0' } }]);
  const removeEtc  = (i) => update('etcItems', etcItems.filter((_, idx) => idx !== i));
  const updateEtc  = (i, key, val) => update('etcItems', etcItems.map((it, idx) => idx === i ? { ...it, [key]: val } : it));

  // 분양기간 표시
  const salesPeriodLabel = (
    <div style={{ fontSize: '11px', color: '#888', marginTop: '2px' }}>
      분양기간: <span style={{ color: '#2980b9', fontWeight: 'bold' }}>{salesPeriod}개월</span>
      {patternEnd === 0 && <span style={{ color: '#e67e22', marginLeft: '4px' }}>(준공시완판→공사기간)</span>}
      <span style={{ color: '#aaa', marginLeft: '4px' }}>(분양율탭 연동)</span>
    </div>
  );

  // 분양기간 override 입력
  const salesPeriodOverride = (
    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
      <input
        value={d.salesPeriodOverride || ''}
        onChange={e => update('salesPeriodOverride', e.target.value)}
        placeholder={`자동: ${autoSalesPeriod}개월`}
        style={{
          width: '80px', padding: '3px 6px', fontSize: '11px',
          border: `1px solid ${d.salesPeriodOverride ? '#e74c3c' : '#ddd'}`,
          borderRadius: '3px', textAlign: 'right',
          backgroundColor: d.salesPeriodOverride ? '#fdf2f0' : 'white',
        }}
      />
      <span style={{ fontSize: '10px', color: '#888' }}>개월 직접입력</span>
      {d.salesPeriodOverride && (
        <button onClick={() => update('salesPeriodOverride', '')}
          style={{ padding: '2px 6px', fontSize: '10px', backgroundColor: '#e74c3c', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer' }}>✕</button>
      )}
    </div>
  );

  return (
    <div>
      {sectionTitle('판매비')}

      {/* 분양수입 참조 표시 */}
      <div style={{ backgroundColor: '#f8f9fa', border: '1px solid #e9ecef', borderRadius: '6px', padding: '10px 14px', marginBottom: '14px', fontSize: '12px' }}>
        <span style={{ color: '#888' }}>수입탭 분양수입 기준 (발코니 제외): </span>
        <span style={{ fontWeight: 'bold', color: '#2c3e50', marginLeft: '4px' }}>{formatNumber(Math.round(saleIncome))} 천원</span>
        <span style={{ color: '#aaa', fontSize: '11px', marginLeft: '8px' }}>
          (공동주택 {formatNumber(Math.round(aptTotal))} + 오피스텔 {formatNumber(Math.round(offiTotal))} + 근린상가 {formatNumber(Math.round(storeTotal))})
        </span>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
        <thead>
          <tr>
            {colHeader('항목', '160px', 'left')}
            {colHeader('근거기준', '200px')}
            {colHeader('단가/요율', '150px')}
            {colHeader('금액 (천원)', '150px')}
            {colHeader('재원조달', '140px')}
          </tr>
        </thead>
        <tbody>

          {/* ① 모델하우스 임대료 */}
          <tr style={{ backgroundColor: 'white' }}>
            <td style={tdStyle}>
              <span style={labelStyle}>① 모델하우스 임대료</span>
              <TaxBadge checked={!!d.mhRent_taxable} onChange={v => update('mhRent_taxable', v)} />
            </td>
            <td style={tdStyle}>
              <div style={{ fontSize: '11px', color: '#555' }}>월세 × 분양기간</div>
              {salesPeriodLabel}
              {salesPeriodOverride}
            </td>
            <td style={tdStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                {numInput(d.mhRentMonth, v => update('mhRentMonth', v), '월세')}
                <span style={{ fontSize: '11px', color: '#888', whiteSpace: 'nowrap' }}>천원/월</span>
              </div>
            </td>
            {(() => { const vc = vatCell(mhRentAmt, !!d.mhRent_taxable); return <td style={tdStyle}>{vc.cell}</td>; })()}
            <td style={tdStyle}>
              <FundingCell funding={d.mhRent_funding || { equity: '0', pf: '100', sale: '0' }} onChange={v => updateFunding('mhRent', v)} totalAmt={!!d.mhRent_taxable ? Math.round(mhRentAmt*1.1) : mhRentAmt} />
            </td>
          </tr>

          {/* ② 모델하우스 설치비 */}
          <tr style={{ backgroundColor: '#fafafa' }}>
            <td style={tdStyle}>
              <span style={labelStyle}>② 모델하우스 설치비</span>
              <TaxBadge checked={!!d.mhInst_taxable} onChange={v => update('mhInst_taxable', v)} />
            </td>
            <td style={tdStyle}>
              <div style={{ fontSize: '11px', color: '#555', marginBottom: '4px' }}>
                📐 모델하우스 연면적 × 공사비단가
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <input
                  value={d.mhAreaInput || ''}
                  onChange={e => update('mhAreaInput', e.target.value)}
                  placeholder="면적 입력"
                  style={{ width: '80px', padding: '4px 6px', border: '1px solid #ddd', borderRadius: '3px', fontSize: '12px', textAlign: 'right' }}
                />
                <UnitToggle unit={mhUnit} setUnit={u => update('mhUnit', u)} />
              </div>
              {mhArea > 0 && (
                <div style={{ fontSize: '10px', color: '#888', marginTop: '2px' }}>
                  {mhUnit === '평'
                    ? `= ${formatNumber((mhArea/0.3025).toFixed(0))}㎡`
                    : `= ${formatNumber((mhArea*0.3025).toFixed(2))}평`}
                </div>
              )}
            </td>
            <td style={tdStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                {numInput(d.mhInstPrice, v => update('mhInstPrice', v), '단가')}
                <span style={{ fontSize: '11px', color: '#888', whiteSpace: 'nowrap' }}>
                  천원/{mhUnit}
                </span>
              </div>
            </td>
            {(() => { const vc = vatCell(mhInstAmt, !!d.mhInst_taxable); return <td style={tdStyle}>{vc.cell}</td>; })()}
            <td style={tdStyle}>
              <FundingCell funding={d.mhInst_funding || { equity: '0', pf: '100', sale: '0' }} onChange={v => updateFunding('mhInst', v)} totalAmt={!!d.mhInst_taxable ? Math.round(mhInstAmt*1.1) : mhInstAmt} />
            </td>
          </tr>

          {/* ③ 모델하우스 운영비 */}
          <tr style={{ backgroundColor: 'white' }}>
            <td style={tdStyle}>
              <span style={labelStyle}>③ 모델하우스 운영비</span>
              <TaxBadge checked={!!d.mhOper_taxable} onChange={v => update('mhOper_taxable', v)} />
            </td>
            <td style={tdStyle}>
              <div style={{ fontSize: '11px', color: '#555' }}>월운영비 × 분양기간</div>
              {salesPeriodLabel}
            </td>
            <td style={tdStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                {numInput(d.mhOperMonth, v => update('mhOperMonth', v), '월운영비')}
                <span style={{ fontSize: '11px', color: '#888', whiteSpace: 'nowrap' }}>천원/월</span>
              </div>
            </td>
            {(() => { const vc = vatCell(mhOperAmt, !!d.mhOper_taxable); return <td style={tdStyle}>{vc.cell}</td>; })()}
            <td style={tdStyle}>
              <FundingCell funding={d.mhOper_funding || { equity: '0', pf: '100', sale: '0' }} onChange={v => updateFunding('mhOper', v)} totalAmt={!!d.mhOper_taxable ? Math.round(mhOperAmt*1.1) : mhOperAmt} />
            </td>
          </tr>

          {/* ④ 광고홍보비 */}
          <tr style={{ backgroundColor: '#fafafa' }}>
            <td style={tdStyle}>
              <span style={labelStyle}>④ 광고홍보비</span>
              <TaxBadge checked={!!d.ad_taxable} onChange={v => update('ad_taxable', v)} />
            </td>
            <td style={tdStyle}>
              <div style={{ fontSize: '11px', color: '#555' }}>분양수입(apt+offi+store) × 요율</div>
              <div style={{ fontSize: '11px', color: '#2980b9', marginTop: '2px', fontWeight: 'bold' }}>
                기준: {formatNumber(Math.round(saleIncome))} 천원
              </div>
            </td>
            <td style={tdStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <input
                  value={d.adRate || ''}
                  onChange={e => update('adRate', e.target.value)}
                  placeholder="요율"
                  style={{ width: '70px', padding: '5px 8px', border: '1px solid #ddd', borderRadius: '3px', fontSize: '12px', textAlign: 'right' }}
                />
                <span style={{ fontSize: '11px', color: '#888' }}>%</span>
              </div>
            </td>
            {(() => { const vc = vatCell(adAmt, !!d.ad_taxable); return <td style={tdStyle}>{vc.cell}</td>; })()}
            <td style={tdStyle}>
              <FundingCell funding={d.ad_funding || { equity: '0', pf: '100', sale: '0' }} onChange={v => updateFunding('ad', v)} totalAmt={!!d.ad_taxable ? Math.round(adAmt*1.1) : adAmt} />
            </td>
          </tr>

          {/* ⑤ 분양대행수수료 — 공동주택/오피스텔/근린상가 분리 */}
          {/* ⑤-1 공동주택: 세대수 × 세대별금액 */}
          <tr style={{ backgroundColor: 'white' }}>
            <td style={tdStyle}>
              <span style={labelStyle}>⑤ 분양대행 (공동주택)</span>
              <TaxBadge checked={!!d.agentApt_taxable} onChange={v => update('agentApt_taxable', v)} />
            </td>
            <td style={tdStyle}>
              <div style={{ fontSize: '11px', color: '#555' }}>세대수 × 세대별 금액</div>
              <div style={{ fontSize: '11px', color: '#2980b9', marginTop: '2px', fontWeight: 'bold' }}>
                세대수: {formatNumber(aptUnits)}세대 (수입탭 자동연동)
              </div>
            </td>
            <td style={tdStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                {numInput(d.agentAptPerUnit, v => update('agentAptPerUnit', v), '세대별금액')}
                <span style={{ fontSize: '11px', color: '#888', whiteSpace: 'nowrap' }}>천원/세대</span>
              </div>
            </td>
            {(() => { const vc = vatCell(agentAptAmt, !!d.agentApt_taxable); return <td style={tdStyle}>{vc.cell}</td>; })()}
            <td style={tdStyle}>
              <FundingCell funding={d.agentApt_funding || { equity: '0', pf: '100', sale: '0' }} onChange={v => updateFunding('agentApt', v)} totalAmt={!!d.agentApt_taxable ? Math.round(agentAptAmt*1.1) : agentAptAmt} />
            </td>
          </tr>

          {/* ⑤-2 오피스텔: 요율 or 세대별금액 선택 */}
          <tr style={{ backgroundColor: '#fafafa' }}>
            <td style={tdStyle}>
              <span style={labelStyle}>⑤ 분양대행 (오피스텔)</span>
              <TaxBadge checked={!!d.agentOffi_taxable} onChange={v => update('agentOffi_taxable', v)} />
            </td>
            <td style={tdStyle}>
              <div style={{ display: 'flex', gap: '6px', marginBottom: '4px' }}>
                {['rate','perUnit'].map(m => (
                  <label key={m} style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '11px', cursor: 'pointer' }}>
                    <input type="radio" name="offiAgentMode" value={m}
                      checked={(d.offiAgentMode||'rate') === m}
                      onChange={() => update('offiAgentMode', m)} />
                    {m === 'rate' ? '매출액×요율' : '세대수×세대별'}
                  </label>
                ))}
              </div>
              <div style={{ fontSize: '11px', color: '#2980b9', fontWeight: 'bold' }}>
                {offiAgentMode === 'rate'
                  ? `기준: ${formatNumber(Math.round(offiTotal))} 천원`
                  : `세대수: ${formatNumber(offiUnits)}세대`}
              </div>
            </td>
            <td style={tdStyle}>
              {offiAgentMode === 'rate' ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <input value={d.agentOffiRate || ''} onChange={e => update('agentOffiRate', e.target.value)}
                    placeholder="요율" style={{ width: '70px', padding: '5px 8px', border: '1px solid #ddd', borderRadius: '3px', fontSize: '12px', textAlign: 'right' }} />
                  <span style={{ fontSize: '11px', color: '#888' }}>%</span>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  {numInput(d.agentOffiPerUnit, v => update('agentOffiPerUnit', v), '세대별금액')}
                  <span style={{ fontSize: '11px', color: '#888', whiteSpace: 'nowrap' }}>천원/세대</span>
                </div>
              )}
            </td>
            {(() => { const vc = vatCell(agentOffiAmt, !!d.agentOffi_taxable); return <td style={tdStyle}>{vc.cell}</td>; })()}
            <td style={tdStyle}>
              <FundingCell funding={d.agentOffi_funding || { equity: '0', pf: '100', sale: '0' }} onChange={v => updateFunding('agentOffi', v)} totalAmt={!!d.agentOffi_taxable ? Math.round(agentOffiAmt*1.1) : agentOffiAmt} />
            </td>
          </tr>

          {/* ⑤-3 근린상가: 매출액 × 요율 */}
          <tr style={{ backgroundColor: 'white' }}>
            <td style={tdStyle}>
              <span style={labelStyle}>⑤ 분양대행 (근린상가)</span>
              <TaxBadge checked={!!d.agentStore_taxable} onChange={v => update('agentStore_taxable', v)} />
            </td>
            <td style={tdStyle}>
              <div style={{ fontSize: '11px', color: '#555' }}>매출액 × 요율</div>
              <div style={{ fontSize: '11px', color: '#2980b9', marginTop: '2px', fontWeight: 'bold' }}>
                기준: {formatNumber(Math.round(storeTotal))} 천원
              </div>
            </td>
            <td style={tdStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <input value={d.agentStoreRate || ''} onChange={e => update('agentStoreRate', e.target.value)}
                  placeholder="요율" style={{ width: '70px', padding: '5px 8px', border: '1px solid #ddd', borderRadius: '3px', fontSize: '12px', textAlign: 'right' }} />
                <span style={{ fontSize: '11px', color: '#888' }}>%</span>
              </div>
            </td>
            {(() => { const vc = vatCell(agentStoreAmt, !!d.agentStore_taxable); return <td style={tdStyle}>{vc.cell}</td>; })()}
            <td style={tdStyle}>
              <FundingCell funding={d.agentStore_funding || { equity: '0', pf: '100', sale: '0' }} onChange={v => updateFunding('agentStore', v)} totalAmt={!!d.agentStore_taxable ? Math.round(agentStoreAmt*1.1) : agentStoreAmt} />
            </td>
          </tr>



          {/* ⑥ 분양보증수수료 */}
          {showHugModal && (
            <HugModal
              onClose={() => setShowHugModal(false)}
              onApply={(amt, hugD) => onChange({ ...d, hugAmt: String(amt), hugData: hugD })}
              archData={archData}
              incomeData={incomeData}
              salesData={salesData}
              data={hugData}
              onChange={v => update('hugData', v)}
            />
          )}
          <tr style={{ backgroundColor: '#fafafa' }}>
            <td style={tdStyle}>
              <span style={labelStyle}>⑥ 분양보증수수료</span>
              <TaxBadge checked={!!d.hug_taxable} onChange={v => update('hug_taxable', v)} />
            </td>
            <td style={tdStyle}>
              <div style={{ fontSize: '11px', color: '#7b1fa2', fontWeight: 'bold', marginBottom: '3px' }}>
                📋 주택도시보증공사(HUG) 기준
              </div>
              <div style={{ fontSize: '11px', color: '#555' }}>
                (대지비×대지비요율 + 건축비×건축비요율) × 보증기간/365
              </div>
              <div style={{ fontSize: '10px', color: '#888', marginTop: '2px' }}>공동주택 + 오피스텔 | 근린상가 해당없음</div>
            </td>
            <td style={{ ...tdStyle, textAlign: 'center' }}>
              <button onClick={() => setShowHugModal(true)}
                style={{ padding: '5px 14px', backgroundColor: '#2980b9', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>
                🧮 계산기 열기
              </button>
            </td>
            <td style={tdStyle}>
              {hugAmt > 0
                ? (vatCell(hugAmt, !!d.hug_taxable).cell)
                : <input readOnly value="—" style={{ width: '100%', padding: '5px 8px', border: '1px solid #eee', borderRadius: '3px', fontSize: '12px', textAlign: 'right', backgroundColor: '#f8f8f8', color: '#aaa' }} />}
            </td>
            <td style={tdStyle}>
              {hugAmt > 0
                ? <FundingCell funding={d.hug_funding || { equity: '0', pf: '100', sale: '0' }} onChange={v => updateFunding('hug', v)} totalAmt={!!d.hug_taxable ? Math.round(hugAmt*1.1) : hugAmt} />
                : <span style={{ fontSize: '11px', color: '#aaa' }}>계산 후 활성화</span>}
            </td>
          </tr>

          {/* ⑦ 기타 판매비 (동적) */}
          {etcItems.map((it, i) => (
            <tr key={i} style={{ backgroundColor: i%2===0 ? 'white' : '#fafafa' }}>
              <td style={tdStyle}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <input value={it.name} onChange={e => updateEtc(i, 'name', e.target.value)}
                    placeholder={`기타항목 ${i+1}`}
                    style={{ flex: 1, padding: '5px 8px', border: '1px solid #ddd', borderRadius: '3px', fontSize: '12px' }} />
                  <button onClick={() => removeEtc(i)}
                    style={{ padding: '3px 7px', backgroundColor: '#e74c3c', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer', fontSize: '11px' }}>✕</button>
                </div>
                <TaxBadge checked={!!it.taxable} onChange={v => updateEtc(i, 'taxable', v)} />
              </td>
              <td style={{ ...tdStyle, textAlign: 'center' }}><span style={{ fontSize: '11px', color: '#888' }}>—</span></td>
              <td style={{ ...tdStyle, textAlign: 'center' }}><span style={{ fontSize: '11px', color: '#888' }}>직접입력</span></td>
              <td style={tdStyle}>{numInput(it.amt, v => updateEtc(i, 'amt', v), '금액 입력')}</td>
              <td style={tdStyle}>
                <FundingCell
                  funding={it.funding || { equity: '0', pf: '100', sale: '0' }}
                  onChange={v => updateEtc(i, 'funding', v)}
                  totalAmt={!!it.taxable ? Math.round((parseFloat(String(it.amt||'').replace(/,/g,''))||0)*1.1) : (parseFloat(String(it.amt||'').replace(/,/g,''))||0)}
                />
              </td>
            </tr>
          ))}

          <tr>
            <td colSpan={5} style={{ padding: '8px' }}>
              <button onClick={addEtc}
                style={{ padding: '6px 14px', backgroundColor: '#ecf0f1', border: '1px dashed #bbb', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', color: '#555' }}>
                + 기타 판매비 추가
              </button>
            </td>
          </tr>
        </tbody>

        <tfoot>
          <tr style={{ backgroundColor: '#d35400' }}>
            <td colSpan={3} style={{ padding: '8px 12px', color: 'white', fontWeight: 'bold', fontSize: '13px' }}>판매비 합계</td>
            <td style={{ padding: '8px 12px', color: 'white', fontWeight: 'bold', fontSize: '14px', textAlign: 'right' }}>
              {formatNumber(total)} 천원
              {vatTotal > 0 && <div style={{ fontSize:'11px', color:'#e67e22', marginTop:'2px' }}>VAT {formatNumber(vatTotal)} 천원 / 합계 {formatNumber(total+vatTotal)} 천원</div>}
            </td>
            <td style={{ padding: '8px 12px' }}>
              {(() => {
                const rows = [
                  { funding: d.mhRent_funding,  amt: mhRentAmt },
                  { funding: d.mhInst_funding,  amt: mhInstAmt },
                  { funding: d.mhOper_funding,  amt: mhOperAmt },
                  { funding: d.ad_funding,      amt: adAmt     },
                  { funding: d.agentApt_funding,   amt: agentAptAmt   },
                  { funding: d.agentOffi_funding,  amt: agentOffiAmt  },
                  { funding: d.agentStore_funding, amt: agentStoreAmt },
                  { funding: d.hug_funding,         amt: hugAmt         },
                  ...etcItems.map(it => ({ funding: it.funding, amt: parseFloat(String(it.amt||'').replace(/,/g,''))||0 })),
                ];
                const summary = calcFundingSummary(rows);
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    {FUNDING_KEYS.filter(k => summary[k] > 0).map(k => {
                      const c = FUNDING_COLORS[k];
                      return (
                        <span key={k} style={{ fontSize: '11px', padding: '2px 7px', borderRadius: '8px', backgroundColor: c.bg, color: c.color, border: `1px solid ${c.border}`, fontWeight: 'bold' }}>
                          {FUNDING_LABELS[k]} {formatNumber(Math.round(summary[k]))}
                        </span>
                      );
                    })}
                  </div>
                );
              })()}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

// ─────────────────────────────────────────────
// 부대비 섹션
// ─────────────────────────────────────────────
function OverheadCostSection({ data, onChange, archData, incomeData, allCostData }) {
  const d = data || {};
  const update = (key, val) => onChange({ ...d, [key]: val });
  const updateFunding = (key, val) => onChange({ ...d, [`${key}_funding`]: val });

  // ── 건축개요 기간 연동 ──
  // const prepPeriod      = parseFloat(String(archData?.prepPeriod      ||'').replace(/,/g,''))||0;
  const constructPeriod = parseFloat(String(archData?.constructPeriod ||'').replace(/,/g,''))||31;
  const settlePeriod    = parseFloat(String(archData?.settlePeriod    ||'').replace(/,/g,''))||6;

  // 시행사운영비: 착공~정산마지막 = constructPeriod + settlePeriod
  const operPeriod  = constructPeriod + settlePeriod;
  // 입주관리비: 준공다음달~정산마지막 = settlePeriod
  // const movePeriod  = settlePeriod;

  // ── 수입탭 분양수입 (발코니 제외, apt+offi+store) ──
  const aptRows   = incomeData?.aptRows   || [];
  const offiRows  = incomeData?.offiRows  || [];
  const storeRows = incomeData?.storeRows || [];
  const calcInc = (rows, mode) => rows.reduce((s, r) => {
    const excl=parseFloat(String(r.excl_m2||'').replace(/,/g,''))||0;
    const wall=parseFloat(String(r.wall_m2||'').replace(/,/g,''))||0;
    const core=parseFloat(String(r.core_m2||'').replace(/,/g,''))||0;
    const mgmt=parseFloat(String(r.mgmt_m2||'').replace(/,/g,''))||0;
    const comm=parseFloat(String(r.comm_m2||'').replace(/,/g,''))||0;
    const park=parseFloat(String(r.park_m2||'').replace(/,/g,''))||0;
    const tel =parseFloat(String(r.tel_m2 ||'').replace(/,/g,''))||0;
    const elec=parseFloat(String(r.elec_m2||'').replace(/,/g,''))||0;
    const units=parseFloat(String(r.units||'').replace(/,/g,''))||0;
    const pyP=parseFloat(String(r.py_price||'').replace(/,/g,''))||0;
    const sup_py=(excl+wall+core)*0.3025;
    const cont_py=(excl+wall+core+mgmt+comm+park+tel+elec)*0.3025;
    return s+(mode==='apt'?pyP*sup_py:pyP*cont_py)*units;
  }, 0);
  const saleIncome = calcInc(aptRows,'apt') + calcInc(offiRows,'offi') + calcInc(storeRows,'store');

  // ── 각 항목 금액 ──
  const p = (key) => parseFloat(String(d[key]||'').replace(/,/g,''))||0;

  // 관리신탁수수료
  const trustMode = d.trustMode || 'rate';
  const trustAmt  = trustMode === 'rate'
    ? Math.round(saleIncome * (p('trustRate') / 100))
    : p('trustDirect');

  // 시행사운영비
  const operAmt   = Math.round(p('operMonth') * operPeriod);

  // 입주관리비 = 세대수(공동주택+주거용오피스텔) × 월운영비 × 정산기간
  const aptUnitsOH  = (incomeData?.aptRows||[]).reduce((s,r)=>s+(parseFloat(String(r.units||'').replace(/,/g,''))||0),0);
  const offiUnitsOH = (incomeData?.offiRows||[]).reduce((s,r)=>s+(parseFloat(String(r.units||'').replace(/,/g,''))||0),0);
  const moveUnits   = aptUnitsOH + offiUnitsOH;
  const moveAmt     = Math.round(p('moveMonth') * moveUnits);

  // 예비비 — 현재 에쿼티를 1억 단위로 올림한 값이 목표 에쿼티
  // 에쿼티는 낮을수록 좋으므로 1억 단위 올림 (최소한의 에쿼티)
  const currentEquity  = allCostData?.totalEquity || 0;
  const EQUITY_UNIT    = 100000; // 1억 단위 (천원 기준: 1억 = 100,000천원)
  const targetEquity   = currentEquity > 0 ? Math.ceil(currentEquity / EQUITY_UNIT) * EQUITY_UNIT : 0;
  const reserveAmt     = Math.max(0, targetEquity - Math.round(currentEquity));

  // 기타
  const etcItems = d.etcItems || [];
  const etcTotal = etcItems.reduce((s, it) => s + (parseFloat(String(it.amt||'').replace(/,/g,''))||0), 0);
  const total    = trustAmt + operAmt + moveAmt + reserveAmt + etcTotal;
  const vatTotal = Math.round(
    (!!d.trust_taxable?trustAmt*0.1:0)+(!!d.oper_taxable?operAmt*0.1:0)+
    (!!d.move_taxable?moveAmt*0.1:0)+(!!d.reserve_taxable?reserveAmt*0.1:0)+
    etcItems.reduce((s,it)=>s+(!!it.taxable?(parseFloat(String(it.amt||'').replace(/,/g,''))||0)*0.1:0),0));

  const tdStyle    = { padding: '6px 8px', borderBottom: '1px solid #eee', verticalAlign: 'middle' };
  const labelStyle = { fontWeight: 'bold', fontSize: '13px', color: '#2c3e50' };
  const addEtc     = () => update('etcItems', [...etcItems, { name: '', amt: '', funding: { equity: '0', pf: '100', sale: '0' } }]);
  const removeEtc  = (i) => update('etcItems', etcItems.filter((_, idx) => idx !== i));
  const updateEtc  = (i, key, val) => update('etcItems', etcItems.map((it, idx) => idx === i ? { ...it, [key]: val } : it));

  const periodBadge = (months, label) => (
    <div style={{ fontSize: '11px', color: '#2980b9', marginTop: '2px', fontWeight: 'bold' }}>
      {label}: <span style={{ color: '#e67e22' }}>{months}개월</span>
      <span style={{ color: '#aaa', fontWeight: 'normal', marginLeft: '4px' }}>(건축개요 연동)</span>
    </div>
  );

  return (
    <div>
      {sectionTitle('부대비')}

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
        <thead>
          <tr>
            {colHeader('항목', '160px', 'left')}
            {colHeader('근거기준', '190px')}
            {colHeader('단가/요율', '160px')}
            {colHeader('금액 (천원)', '150px')}
            {colHeader('재원조달', '140px')}
          </tr>
        </thead>
        <tbody>

          {/* ① 관리신탁수수료 */}
          <tr style={{ backgroundColor: 'white' }}>
            <td style={tdStyle}>
              <span style={labelStyle}>① 관리신탁수수료</span>
              <TaxBadge checked={!!d.trust_taxable} onChange={v => update('trust_taxable', v)} />
            </td>
            <td style={tdStyle}>
              <div style={{ display: 'flex', gap: '6px', marginBottom: '4px' }}>
                {['rate','direct'].map(m => (
                  <label key={m} style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '11px', cursor: 'pointer' }}>
                    <input type="radio" name="trustMode" value={m}
                      checked={(d.trustMode||'rate') === m}
                      onChange={() => update('trustMode', m)} />
                    {m === 'rate' ? '분양수입×요율' : '직접입력'}
                  </label>
                ))}
              </div>
              {trustMode === 'rate' && (
                <div style={{ fontSize: '11px', color: '#2980b9', fontWeight: 'bold' }}>
                  기준: {formatNumber(Math.round(saleIncome))} 천원
                  <span style={{ color: '#aaa', fontWeight: 'normal', marginLeft: '4px' }}>(발코니 제외)</span>
                </div>
              )}
            </td>
            <td style={tdStyle}>
              {trustMode === 'rate' ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <input value={d.trustRate || ''} onChange={e => update('trustRate', e.target.value)}
                    placeholder="요율" style={{ width: '70px', padding: '5px 8px', border: '1px solid #ddd', borderRadius: '3px', fontSize: '12px', textAlign: 'right' }} />
                  <span style={{ fontSize: '11px', color: '#888' }}>%</span>
                </div>
              ) : (
                numInput(d.trustDirect, v => update('trustDirect', v), '금액 입력')
              )}
            </td>
            {(() => { const vc = vatCell(trustAmt, !!d.trust_taxable); return <td style={tdStyle}>{vc.cell}</td>; })()}
            <td style={tdStyle}>
              <FundingCell funding={d.trust_funding || { equity: '0', pf: '100', sale: '0' }} onChange={v => updateFunding('trust', v)} totalAmt={!!d.trust_taxable ? Math.round(trustAmt*1.1) : trustAmt} />
            </td>
          </tr>

          {/* ② 시행사운영비 */}
          <tr style={{ backgroundColor: '#fafafa' }}>
            <td style={tdStyle}>
              <span style={labelStyle}>② 시행사운영비</span>
              <TaxBadge checked={!!d.oper_taxable} onChange={v => update('oper_taxable', v)} />
            </td>
            <td style={tdStyle}>
              <div style={{ fontSize: '11px', color: '#555' }}>월운영비 × 기간 (착공~정산마지막)</div>
              {periodBadge(operPeriod, `공사${constructPeriod}개월 + 정산${settlePeriod}개월`)}
            </td>
            <td style={tdStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                {numInput(d.operMonth, v => update('operMonth', v), '월운영비')}
                <span style={{ fontSize: '11px', color: '#888', whiteSpace: 'nowrap' }}>천원/월</span>
              </div>
            </td>
            {(() => { const vc = vatCell(operAmt, !!d.oper_taxable); return <td style={tdStyle}>{vc.cell}</td>; })()}
            <td style={tdStyle}>
              <FundingCell funding={d.oper_funding || { equity: '0', pf: '100', sale: '0' }} onChange={v => updateFunding('oper', v)} totalAmt={!!d.oper_taxable ? Math.round(operAmt*1.1) : operAmt} />
            </td>
          </tr>

          {/* ③ 입주관리비 */}
          <tr style={{ backgroundColor: 'white' }}>
            <td style={tdStyle}>
              <span style={labelStyle}>③ 입주관리비</span>
              <TaxBadge checked={!!d.move_taxable} onChange={v => update('move_taxable', v)} />
            </td>
            <td style={tdStyle}>
              <div style={{ fontSize: '11px', color: '#555' }}>세대수 × 월운영비 × 정산기간</div>
              <div style={{ fontSize: '11px', color: '#2980b9', marginTop: '2px', fontWeight: 'bold' }}>
                세대수: {formatNumber(moveUnits)}세대 (공동주택 {formatNumber(aptUnitsOH)} + 오피스텔 {formatNumber(offiUnitsOH)})
              </div>
              <div style={{ fontSize: '10px', color: '#888', marginTop: '2px' }}>
                준공다음달~정산마지막 균등 (지급패턴에서 설정)
              </div>
            </td>
            <td style={tdStyle}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                {numInput(d.moveMonth, v => update('moveMonth', v), '월운영비')}
                <span style={{ fontSize: '11px', color: '#888', whiteSpace: 'nowrap' }}>천원/세대/월</span>
              </div>
            </td>
            {(() => { const vc = vatCell(moveAmt, !!d.move_taxable); return <td style={tdStyle}>{vc.cell}</td>; })()}
            <td style={tdStyle}>
              <FundingCell funding={d.move_funding || { equity: '0', pf: '100', sale: '0' }} onChange={v => updateFunding('move', v)} totalAmt={!!d.move_taxable ? Math.round(moveAmt*1.1) : moveAmt} />
            </td>
          </tr>

          {/* ④ 예비비 (에쿼티 자동 조정) */}
          <tr style={{ backgroundColor: '#fef9e7' }}>
            <td style={tdStyle}>
              <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
                <span style={labelStyle}>④ 예비비</span>
                <TaxBadge checked={!!d.reserve_taxable} onChange={v => update('reserve_taxable', v)} />
              </div>
              <div style={{ fontSize:'10px', color:'#7d5a00', marginTop:'2px', fontWeight:'bold' }}>
                에쿼티 자동 조정 | 반기별 균등 집행
              </div>
            </td>
            <td style={tdStyle}>
              {/* 근거기준: 예비비 제외 현재 에쿼티 */}
              <div style={{ fontSize:'11px', color:'#555' }}>
                현재 에쿼티 (예비비 제외)
              </div>
              <div style={{ fontSize:'13px', fontWeight:'bold', color:'#2c3e50', marginTop:'2px' }}>
                {formatNumber(Math.round(currentEquity))} 천원
              </div>
              <div style={{ fontSize:'10px', color:'#aaa', marginTop:'1px' }}>
                ≈ {(currentEquity/100000).toFixed(2)}억원
              </div>
              <div style={{ fontSize:'10px', color:'#888', marginTop:'4px' }}>
                ※ 착공~준공 반기(6개월)별 균등 자동 배분
              </div>
            </td>
            <td style={tdStyle}>
              {/* 단가/요율: 목표 에쿼티 */}
              <div style={{ fontSize:'11px', color:'#7b1fa2' }}>
                목표 에쿼티 (1억 올림)
              </div>
              <div style={{ fontSize:'13px', fontWeight:'bold', color:'#7b1fa2', marginTop:'2px' }}>
                {formatNumber(targetEquity)} 천원
              </div>
              <div style={{ fontSize:'10px', color:'#aaa', marginTop:'1px' }}>
                ≈ {(targetEquity/100000).toFixed(0)}억원
              </div>
            </td>
            {/* 금액: 예비비 */}
            {(() => {
              const vc = vatCell(reserveAmt, !!d.reserve_taxable);
              return (
                <td style={tdStyle}>
                  <div style={{ fontSize:'13px', fontWeight:'bold', color:'#e67e22' }}>
                    {formatNumber(reserveAmt)}
                  </div>
                  {!!d.reserve_taxable && reserveAmt > 0 && (
                    <div style={{ fontSize:'10px', color:'#e67e22', marginTop:'2px' }}>
                      VAT {formatNumber(Math.round(reserveAmt*0.1))}
                    </div>
                  )}
                  <div style={{ fontSize:'10px', color:'#aaa', marginTop:'1px' }}>
                    = 목표 - 현재
                  </div>
                </td>
              );
            })()}
            <td style={tdStyle}>
              <div style={{ padding:'6px 10px', backgroundColor:'#fef9e7',
                border:'1px solid #f5cba7', borderRadius:'4px',
                fontSize:'11px', color:'#7d5a00', fontWeight:'bold', textAlign:'center' }}>
                Equity 100%
              </div>
            </td>
          </tr>

          {/* ⑤ 기타 부대비 (동적) */}
          {etcItems.map((it, i) => (
            <tr key={i} style={{ backgroundColor: i%2===0 ? 'white' : '#fafafa' }}>
              <td style={tdStyle}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <input value={it.name} onChange={e => updateEtc(i, 'name', e.target.value)}
                    placeholder={`기타항목 ${i+1}`}
                    style={{ flex: 1, padding: '5px 8px', border: '1px solid #ddd', borderRadius: '3px', fontSize: '12px' }} />
                  <button onClick={() => removeEtc(i)}
                    style={{ padding: '3px 7px', backgroundColor: '#e74c3c', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer', fontSize: '11px' }}>✕</button>
                </div>
                <TaxBadge checked={!!it.taxable} onChange={v => updateEtc(i, 'taxable', v)} />
              </td>
              <td style={{ ...tdStyle, textAlign: 'center' }}><span style={{ fontSize: '11px', color: '#888' }}>—</span></td>
              <td style={{ ...tdStyle, textAlign: 'center' }}><span style={{ fontSize: '11px', color: '#888' }}>직접입력</span></td>
              <td style={tdStyle}>{numInput(it.amt, v => updateEtc(i, 'amt', v), '금액 입력')}</td>
              <td style={tdStyle}>
                <FundingCell funding={it.funding || { equity: '0', pf: '100', sale: '0' }} onChange={v => updateEtc(i, 'funding', v)} totalAmt={!!it.taxable ? Math.round((parseFloat(String(it.amt||'').replace(/,/g,''))||0)*1.1) : (parseFloat(String(it.amt||'').replace(/,/g,''))||0)} />
              </td>
            </tr>
          ))}

          <tr>
            <td colSpan={5} style={{ padding: '8px' }}>
              <button onClick={addEtc}
                style={{ padding: '6px 14px', backgroundColor: '#ecf0f1', border: '1px dashed #bbb', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', color: '#555' }}>
                + 기타 부대비 추가
              </button>
            </td>
          </tr>
        </tbody>

        <tfoot>
          <tr style={{ backgroundColor: '#6c3483' }}>
            <td colSpan={3} style={{ padding: '8px 12px', color: 'white', fontWeight: 'bold', fontSize: '13px' }}>부대비 합계</td>
            <td style={{ padding: '8px 12px', color: 'white', fontWeight: 'bold', fontSize: '14px', textAlign: 'right' }}>
              {formatNumber(total)} 천원
              {vatTotal > 0 && <div style={{ fontSize:'11px', color:'#e67e22', marginTop:'2px' }}>VAT {formatNumber(vatTotal)} 천원 / 합계 {formatNumber(total+vatTotal)} 천원</div>}
            </td>
            <td style={{ padding: '8px 12px' }}>
              {(() => {
                const rows = [
                  { funding: d.trust_funding,   amt: trustAmt   },
                  { funding: d.oper_funding,    amt: operAmt    },
                  { funding: d.move_funding,    amt: moveAmt    },
                  { funding: { equity:'100', pf:'0', sale:'0' }, amt: reserveAmt }, // 예비비 항상 Equity 100%
                  ...etcItems.map(it => ({ funding: it.funding, amt: parseFloat(String(it.amt||'').replace(/,/g,''))||0 })),
                ];
                const summary = calcFundingSummary(rows);
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    {FUNDING_KEYS.filter(k => summary[k] > 0).map(k => {
                      const c = FUNDING_COLORS[k];
                      return (
                        <span key={k} style={{ fontSize: '11px', padding: '2px 7px', borderRadius: '8px', backgroundColor: c.bg, color: c.color, border: `1px solid ${c.border}`, fontWeight: 'bold' }}>
                          {FUNDING_LABELS[k]} {formatNumber(Math.round(summary[k]))}
                        </span>
                      );
                    })}
                  </div>
                );
              })()}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

// ─────────────────────────────────────────────
// 제세금 섹션
// ─────────────────────────────────────────────
function TaxCostSection({ data, onChange, archData, incomeData, settingsData, costResults, salesData, paymentScheduleData, vatData }) {
  const [showTransModal, setShowTransModal] = useState(false);
  const [showGasModal,   setShowGasModal]   = useState(false);
  const [showWaterModal, setShowWaterModal] = useState(false);
  const [showSewerModal, setShowSewerModal] = useState(false);
  const [showBondModal,   setShowBondModal]   = useState(false);
  const [showSchoolModal, setShowSchoolModal] = useState(false);
  const [showRegModal,     setShowRegModal]     = useState(false);
  const [showPropTaxModal,  setShowPropTaxModal]  = useState(false);
  const [showCompTaxModal,  setShowCompTaxModal]  = useState(false);
  const d = data || {};
  const update = (key, val) => onChange({ ...d, [key]: val });
  const updateFunding = (key, val) => onChange({ ...d, [`${key}_funding`]: val });

  // 광역교통시설부담금
  const transAmt  = parseFloat(String(d.transAmt||'').replace(/,/g,''))||0;
  const transData = d.transData || {};

  // 도시가스시설분담금
  const gasAmt   = parseFloat(String(d.gasAmt||'').replace(/,/g,''))||0;
  const gasData  = d.gasData  || {};

  // 상수도원인자부담금
  const waterAmt  = parseFloat(String(d.waterAmt||'').replace(/,/g,''))||0;
  const waterData = d.waterData || {};

  // 하수도원인자부담금
  const sewerAmt   = parseFloat(String(d.sewerAmt||'').replace(/,/g,''))||0;
  const sewerData  = d.sewerData || {};

  // 건축허가 국민주택채권할인
  const bondBuildAmt  = parseFloat(String(d.bondBuildAmt||'').replace(/,/g,''))||0;
  const bondBuildData = d.bondBuildData || {};

  // 학교용지부담금
  const schoolAmt  = parseFloat(String(d.schoolAmt||'').replace(/,/g,''))||0;
  const schoolData = d.schoolData || {};

  // 보존등기비
  const regAmt  = parseFloat(String(d.regAmt||'').replace(/,/g,''))||0;
  const regData = d.regData || {};

  // 재산세
  const propTaxAmt  = parseFloat(String(d.propTaxAmt||'').replace(/,/g,''))||0;
  const propTaxData = d.propTaxData || {};

  // 종합부동산세
  const compTaxAmt  = parseFloat(String(d.compTaxAmt||'').replace(/,/g,''))||0;
  const compTaxData = d.compTaxData || {};

  const etcItems = d.etcItems || [];
  const etcTotal = etcItems.reduce((s, it) => s + (parseFloat(String(it.amt||'').replace(/,/g,''))||0), 0);

  // ── 부가세 정산 (합계탭 타임라인에서 계산된 값 연동) ──
  const vatByMonth        = salesData?.vatByMonth || {};
  const cm                = paymentScheduleData?.categoryMonthly || {};
  const taxRatio_         = parseFloat(vatData?.taxRatio) || 0;
  const prepPeriod_t  = parseFloat(String(archData?.prepPeriod||'').replace(/,/g,''))||0;
  const conPeriod_t   = parseFloat(String(archData?.constructPeriod||'').replace(/,/g,''))||24;
  const settlePeriod_t= parseFloat(String(archData?.settlePeriod||'').replace(/,/g,''))||6;
  const totalPeriod_t = Math.ceil(prepPeriod_t + conPeriod_t + settlePeriod_t);
  const conYear_t  = parseInt(archData?.constructYear)  || new Date().getFullYear();
  const conMonth_t = parseInt(archData?.constructMonth) || 1;
  const addM_t = (y, m, n) => { const t=(y-1)*12+(m-1)+n; return { year:Math.floor(t/12)+1, month:t%12+1 }; };
  const fmtYM_t = (y, m) => `${y}.${String(m).padStart(2,'0')}`;
  const bizS_t = addM_t(conYear_t, conMonth_t, -Math.round(prepPeriod_t));
  const allMonths_t = Array.from({length:totalPeriod_t},(_,i)=>{ const r=addM_t(bizS_t.year,bizS_t.month,i); return fmtYM_t(r.year,r.month); });

  // 매입VAT 월별 합계
  const inputVatByMonth_t = {};
  ['land','direct','indirect','consult','sales','tax','overhead'].forEach(key => {
    Object.entries(cm[`${key}Vat`]||{}).forEach(([ym,v]) => {
      inputVatByMonth_t[ym] = (inputVatByMonth_t[ym]||0) + v;
    });
  });

  // 분기별 부가세 정산
  const settleYMs_t = [...new Set([
    ...allMonths_t.filter(ym=>[1,4,7,10].includes(parseInt(ym.split('.')[1]))),
    allMonths_t[allMonths_t.length-1]
  ])].sort();
  const vatSettlements_t = {};
  let prevIdx_t = 0;
  settleYMs_t.forEach(sYM => {
    const idx = allMonths_t.indexOf(sYM);
    if(idx<0) return;
    const period = allMonths_t.slice(prevIdx_t, idx+1);
    const outVat = period.reduce((s,ym)=>s+(vatByMonth[ym]||0),0);
    const inVat  = period.reduce((s,ym)=>s+(inputVatByMonth_t[ym]||0),0);
    const v = Math.round(outVat - inVat * taxRatio_);
    if(v!==0) vatSettlements_t[sYM] = v;
    prevIdx_t = idx+1;
  });
  const vatSettleTotal = Object.values(vatSettlements_t).reduce((s,v)=>s+v,0);
  const hasVatData = taxRatio_ > 0 && (Object.keys(vatByMonth).length > 0 || Object.keys(inputVatByMonth_t).length > 0);

  const total    = transAmt + gasAmt + waterAmt + sewerAmt + bondBuildAmt + schoolAmt + regAmt + propTaxAmt + compTaxAmt + etcTotal;
  const vatTotal = Math.round(
    (!!d.trans_taxable?transAmt*0.1:0)+(!!d.gas_taxable?gasAmt*0.1:0)+
    (!!d.water_taxable?waterAmt*0.1:0)+(!!d.sewer_taxable?sewerAmt*0.1:0)+
    (!!d.bondBuild_taxable?bondBuildAmt*0.1:0)+(!!d.school_taxable?schoolAmt*0.1:0)+
    (!!d.reg_taxable?regAmt*0.1:0)+
    etcItems.reduce((s,it)=>s+(!!it.taxable?(parseFloat(String(it.amt||'').replace(/,/g,''))||0)*0.1:0),0));

  const tdStyle    = { padding: '6px 8px', borderBottom: '1px solid #eee', verticalAlign: 'middle' };
  const labelStyle = { fontWeight: 'bold', fontSize: '13px', color: '#2c3e50' };
  const addEtc     = () => update('etcItems', [...etcItems, { name: '', amt: '', funding: { equity: '0', pf: '100', sale: '0' } }]);
  const removeEtc  = (i) => update('etcItems', etcItems.filter((_, idx) => idx !== i));
  const updateEtc  = (i, key, val) => update('etcItems', etcItems.map((it, idx) => idx === i ? { ...it, [key]: val } : it));

  return (
    <div>
      {showCompTaxModal && (
        <CompTaxModal
          onClose={() => setShowCompTaxModal(false)}
          onApply={(amt, cd) => onChange({ ...d, compTaxAmt: String(amt), compTaxData: cd })}
          archData={archData}
          data={compTaxData}
          onChange={v => update('compTaxData', v)}
        />
      )}
      {showPropTaxModal && (
        <PropTaxModal
          onClose={() => setShowPropTaxModal(false)}
          onApply={(amt, td) => onChange({ ...d, propTaxAmt: String(amt), propTaxData: td })}
          archData={archData}
          data={propTaxData}
          onChange={v => update('propTaxData', v)}
        />
      )}
      {showRegModal && (
        <RegFeeModal
          onClose={() => setShowRegModal(false)}
          onApply={(amt, rd) => onChange({ ...d, regAmt: String(amt), regData: rd })}
          archData={archData}
          incomeData={incomeData}
          calcResults={costResults}
          data={regData}
          onChange={v => update('regData', v)}
        />
      )}
      {showSchoolModal && (
        <SchoolFundModal
          onClose={() => setShowSchoolModal(false)}
          onApply={(amt, sd) => onChange({ ...d, schoolAmt: String(amt), schoolData: sd })}
          archData={archData}
          incomeData={incomeData}
          data={schoolData}
          onChange={v => update('schoolData', v)}
        />
      )}
      {showBondModal && (
        <BondBuildModal
          onClose={() => setShowBondModal(false)}
          onApply={(amt, bd) => onChange({ ...d, bondBuildAmt: String(amt), bondBuildData: bd })}
          archData={archData}
          incomeData={incomeData}
          settingsData={settingsData}
          data={bondBuildData}
          onChange={v => update('bondBuildData', v)}
        />
      )}
      {showSewerModal && (
        <SewerModal
          onClose={() => setShowSewerModal(false)}
          onApply={(amt, sd) => onChange({ ...d, sewerAmt: String(amt), sewerData: sd })}
          archData={archData}
          incomeData={incomeData}
          settingsData={settingsData}
          data={sewerData}
          onChange={v => update('sewerData', v)}
        />
      )}
      {showWaterModal && (
        <WaterModal
          onClose={() => setShowWaterModal(false)}
          onApply={(amt, wd) => onChange({ ...d, waterAmt: String(amt), waterData: wd })}
          archData={archData}
          incomeData={incomeData}
          settingsData={settingsData}
          data={waterData}
          onChange={v => update('waterData', v)}
        />
      )}
      {showGasModal && (
        <GasModal
          onClose={() => setShowGasModal(false)}
          onApply={(amt, gd) => onChange({ ...d, gasAmt: String(amt), gasData: gd })}
          archData={archData}
          incomeData={incomeData}
          settingsData={settingsData}
          data={gasData}
          onChange={v => update('gasData', v)}
        />
      )}
      {showTransModal && (
        <TransportModal
          onClose={() => setShowTransModal(false)}
          onApply={(amt, td) => onChange({ ...d, transAmt: String(amt), transData: td })}
          archData={archData}
          incomeData={incomeData}
          settingsData={settingsData}
          data={transData}
          onChange={v => update('transData', v)}
        />
      )}

      {sectionTitle('제세금')}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
        <thead>
          <tr>
            {colHeader('항목', '160px', 'left')}
            {colHeader('근거기준', '200px')}
            {colHeader('계산기', '120px')}
            {colHeader('금액 (천원)', '150px')}
            {colHeader('재원조달', '140px')}
          </tr>
        </thead>
        <tbody>
          {/* ① 보존등기비 */}
          <tr style={{ backgroundColor: 'white' }}>
            <td style={tdStyle}>
              <span style={labelStyle}>① 보존등기비</span>
              <TaxBadge checked={!!d.reg_taxable} onChange={v => update('reg_taxable', v)} />
            </td>
            <td style={tdStyle}>
              <div style={{ fontSize:'11px', color:'#546e7a', fontWeight:'bold', marginBottom:'2px' }}>
                지방세법 제11조 제1항 제3호 (원시취득)
              </div>
              <div style={{ fontSize:'11px', color:'#555' }}>
                과세표준 × 세율(2.96~3.16%) + 국민주택채권 + 법무사
              </div>
              <div style={{ fontSize:'10px', color:'#888', marginTop:'2px' }}>
                과세표준: 직접/간접공사비+용역비+제세금+관리신탁+준공전이자
              </div>
            </td>
            <td style={{ ...tdStyle, textAlign:'center' }}>
              <button onClick={() => setShowRegModal(true)}
                style={{ padding:'5px 12px', backgroundColor:'#546e7a', color:'white', border:'none', borderRadius:'4px', cursor:'pointer', fontSize:'12px', fontWeight:'bold' }}>
                🧮 계산기
              </button>
            </td>
            <td style={tdStyle}>
              {d.regData
                ? (vatCell(regAmt, !!d.reg_taxable).cell)
                : <span style={{ fontSize:'11px', color:'#aaa' }}>계산 후 반영</span>}
            </td>
            <td style={tdStyle}>
              {d.regData
                ? <FundingCell funding={d.reg_funding||{equity:'0',pf:'100',sale:'0'}} onChange={v=>updateFunding('reg',v)} totalAmt={!!d.reg_taxable ? Math.round(regAmt*1.1) : regAmt} />
                : <span style={{ fontSize:'11px', color:'#aaa' }}>—</span>}
            </td>
          </tr>

          {/* ② 광역교통시설부담금 */}
          <tr style={{ backgroundColor: 'white' }}>
            <td style={tdStyle}>
              <span style={labelStyle}>① 광역교통시설부담금</span>
              <TaxBadge checked={!!d.trans_taxable} onChange={v => update('trans_taxable', v)} />
            </td>
            <td style={tdStyle}>
              <div style={{ fontSize: '11px', color: '#1565c0', fontWeight: 'bold', marginBottom: '2px' }}>
                📋 대도시권 광역교통 관리에 관한 특별법 제11조의3
              </div>
              <div style={{ fontSize: '11px', color: '#555' }}>
                표준단가 × 부과율 × 면적 - 공제액
              </div>
              {transAmt > 0 && (
                <div style={{ fontSize: '10px', color: '#888', marginTop: '2px' }}>
                  {transData.region === 'metro' ? '수도권 4%' : '지방 2%'} |
                  {transData.exemption === 'full' ? ' 100%면제' : transData.exemption === 'half' ? ' 50%경감' : ' 100%부과'}
                </div>
              )}
            </td>
            <td style={{ ...tdStyle, textAlign: 'center' }}>
              <button onClick={() => setShowTransModal(true)}
                style={{ padding: '5px 12px', backgroundColor: '#1565c0', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>
                🧮 계산기
              </button>
            </td>
            <td style={tdStyle}>
              {transAmt > 0
                ? (vatCell(transAmt, !!d.trans_taxable).cell)
                : <span style={{ fontSize: '11px', color: '#aaa' }}>계산 후 반영</span>}
            </td>
            <td style={tdStyle}>
              {transAmt > 0
                ? <FundingCell funding={d.trans_funding || { equity: '0', pf: '100', sale: '0' }} onChange={v => updateFunding('trans', v)} totalAmt={!!d.trans_taxable ? Math.round(transAmt*1.1) : transAmt} />
                : <span style={{ fontSize: '11px', color: '#aaa' }}>—</span>}
            </td>
          </tr>

          {/* ③ 학교용지부담금 */}
          <tr style={{ backgroundColor: '#fafafa' }}>
            <td style={tdStyle}>
              <span style={labelStyle}>② 학교용지부담금</span>
              <TaxBadge checked={!!d.school_taxable} onChange={v => update('school_taxable', v)} />
            </td>
            <td style={tdStyle}>
              <div style={{ fontSize:'11px', color:'#2e7d32', fontWeight:'bold', marginBottom:'2px' }}>
                학교용지 확보 등에 관한 특례법 제5조·제5조의2
              </div>
              <div style={{ fontSize:'11px', color:'#555' }}>분양가격 합계 × 4/1,000 (0.4%) — 300세대 이상</div>
              {(() => {
                const aptRows = incomeData?.aptRows || [];
                const totalUnits = aptRows.reduce((s,r) => s+(parseFloat(String(r.units||'').replace(/,/g,''))||0), 0);
                return totalUnits < 300
                  ? <div style={{ fontSize:'10px', color:'#27ae60', fontWeight:'bold', marginTop:'2px' }}>✓ {formatNumber(totalUnits)}세대 → 부과제외</div>
                  : <div style={{ fontSize:'10px', color:'#e74c3c', fontWeight:'bold', marginTop:'2px' }}>⚠ {formatNumber(totalUnits)}세대 → 부과대상</div>;
              })()}
            </td>
            <td style={{ ...tdStyle, textAlign:'center' }}>
              <button onClick={() => setShowSchoolModal(true)}
                style={{ padding:'5px 12px', backgroundColor:'#2e7d32', color:'white', border:'none', borderRadius:'4px', cursor:'pointer', fontSize:'12px', fontWeight:'bold' }}>
                🧮 계산기
              </button>
            </td>
            <td style={tdStyle}>
              {d.schoolData
                ? (vatCell(schoolAmt, !!d.school_taxable).cell)
                : <span style={{ fontSize:'11px', color:'#aaa' }}>계산 후 반영</span>}
            </td>
            <td style={tdStyle}>
              {d.schoolData
                ? <FundingCell funding={d.school_funding||{equity:'0',pf:'100',sale:'0'}} onChange={v=>updateFunding('school',v)} totalAmt={!!d.school_taxable ? Math.round(schoolAmt*1.1) : schoolAmt} />
                : <span style={{ fontSize:'11px', color:'#aaa' }}>—</span>}
            </td>
          </tr>

          {/* ④ 도시가스시설분담금 */}
          <tr style={{ backgroundColor: 'white' }}>
            <td style={tdStyle}>
              <span style={labelStyle}>③ 도시가스시설분담금</span>
              <TaxBadge checked={!!d.gas_taxable} onChange={v => update('gas_taxable', v)} />
            </td>
            <td style={tdStyle}>
              <div style={{ fontSize:'11px', color:'#e65100', fontWeight:'bold', marginBottom:'2px' }}>
                도시별 도시가스 공급규정 — 일반시설분담금
              </div>
              <div style={{ fontSize:'11px', color:'#555' }}>기준단가(원/㎥) × 표준가스소비량(㎥/hr)</div>
              {gasAmt > 0 && <div style={{ fontSize:'10px', color:'#888', marginTop:'2px' }}>{gasData.gasYear||'2026'}년 {gasData.gasCity||'부산'} 기준</div>}
            </td>
            <td style={{ ...tdStyle, textAlign:'center' }}>
              <button onClick={() => setShowGasModal(true)}
                style={{ padding:'5px 12px', backgroundColor:'#e65100', color:'white', border:'none', borderRadius:'4px', cursor:'pointer', fontSize:'12px', fontWeight:'bold' }}>
                🧮 계산기
              </button>
            </td>
            <td style={tdStyle}>
              {gasAmt > 0 ? (vatCell(gasAmt, !!d.gas_taxable).cell) : <span style={{ fontSize:'11px', color:'#aaa' }}>계산 후 반영</span>}
            </td>
            <td style={tdStyle}>
              {gasAmt > 0
                ? <FundingCell funding={d.gas_funding||{equity:'0',pf:'100',sale:'0'}} onChange={v=>updateFunding('gas',v)} totalAmt={!!d.gas_taxable ? Math.round(gasAmt*1.1) : gasAmt} />
                : <span style={{ fontSize:'11px', color:'#aaa' }}>—</span>}
            </td>
          </tr>

          {/* ⑤ 상수도원인자부담금 */}
          <tr style={{ backgroundColor: '#fafafa' }}>
            <td style={tdStyle}>
              <span style={labelStyle}>④ 상수도원인자부담금</span>
              <TaxBadge checked={!!d.water_taxable} onChange={v => update('water_taxable', v)} />
            </td>
            <td style={tdStyle}>
              <div style={{ fontSize:'11px', color:'#1565c0', fontWeight:'bold', marginBottom:'2px' }}>
                부산광역시 상수도 원인자부담금 징수 조례 제5조·제6조
              </div>
              <div style={{ fontSize:'11px', color:'#555' }}>세대당 고정(349천원) 또는 단위사업비×사용량</div>
              {waterAmt > 0 && <div style={{ fontSize:'10px', color:'#888', marginTop:'2px' }}>{waterData.waterYear||'2026'}년 기준 | {['large','medium','small'].find(k=>k===waterData.bizType)||'중규모'}</div>}
            </td>
            <td style={{ ...tdStyle, textAlign:'center' }}>
              <button onClick={() => setShowWaterModal(true)}
                style={{ padding:'5px 12px', backgroundColor:'#1565c0', color:'white', border:'none', borderRadius:'4px', cursor:'pointer', fontSize:'12px', fontWeight:'bold' }}>
                🧮 계산기
              </button>
            </td>
            <td style={tdStyle}>
              {waterAmt > 0 ? (vatCell(waterAmt, !!d.water_taxable).cell) : <span style={{ fontSize:'11px', color:'#aaa' }}>계산 후 반영</span>}
            </td>
            <td style={tdStyle}>
              {waterAmt > 0
                ? <FundingCell funding={d.water_funding||{equity:'0',pf:'100',sale:'0'}} onChange={v=>updateFunding('water',v)} totalAmt={!!d.water_taxable ? Math.round(waterAmt*1.1) : waterAmt} />
                : <span style={{ fontSize:'11px', color:'#aaa' }}>—</span>}
            </td>
          </tr>

          {/* ⑥ 하수도원인자부담금 */}
          <tr style={{ backgroundColor: 'white' }}>
            <td style={tdStyle}>
              <span style={labelStyle}>⑤ 하수도원인자부담금</span>
              <TaxBadge checked={!!d.sewer_taxable} onChange={v => update('sewer_taxable', v)} />
            </td>
            <td style={tdStyle}>
              <div style={{ fontSize:'11px', color:'#6a1b9a', fontWeight:'bold', marginBottom:'2px' }}>
                하수도법 제61조 / 부산광역시 하수도 사용 조례 제10조·제12조
              </div>
              <div style={{ fontSize:'11px', color:'#555' }}>총 오수발생량(㎥/일) × 단위단가(원/㎥)</div>
              {sewerAmt > 0 && <div style={{ fontSize:'10px', color:'#888', marginTop:'2px' }}>{sewerData.sewerYear||'2025'}년 {sewerData.sewerCity||'부산'} 기준</div>}
            </td>
            <td style={{ ...tdStyle, textAlign:'center' }}>
              <button onClick={() => setShowSewerModal(true)}
                style={{ padding:'5px 12px', backgroundColor:'#6a1b9a', color:'white', border:'none', borderRadius:'4px', cursor:'pointer', fontSize:'12px', fontWeight:'bold' }}>
                🧮 계산기
              </button>
            </td>
            <td style={tdStyle}>
              {sewerAmt > 0 ? (vatCell(sewerAmt, !!d.sewer_taxable).cell) : <span style={{ fontSize:'11px', color:'#aaa' }}>계산 후 반영</span>}
            </td>
            <td style={tdStyle}>
              {sewerAmt > 0
                ? <FundingCell funding={d.sewer_funding||{equity:'0',pf:'100',sale:'0'}} onChange={v=>updateFunding('sewer',v)} totalAmt={!!d.sewer_taxable ? Math.round(sewerAmt*1.1) : sewerAmt} />
                : <span style={{ fontSize:'11px', color:'#aaa' }}>—</span>}
            </td>
          </tr>

          {/* ⑦ 건축허가 국민주택채권할인 */}
          <tr style={{ backgroundColor: '#fafafa' }}>
            <td style={tdStyle}>
              <span style={labelStyle}>⑥ 건축허가 국민주택채권할인</span>
              <TaxBadge checked={!!d.bondBuild_taxable} onChange={v => update('bondBuild_taxable', v)} />
            </td>
            <td style={tdStyle}>
              <div style={{ fontSize:'11px', color:'#1a237e', fontWeight:'bold', marginBottom:'2px' }}>
                주택도시기금법 시행령 별표 1 (제6호 건축허가)
              </div>
              <div style={{ fontSize:'11px', color:'#555' }}>전용면적 구간별 원/㎡ × 세대수 + 상가 연면적 × 구조별 단가</div>
              <div style={{ fontSize:'10px', color:'#888', marginTop:'2px' }}>× 즉시배도율 = 본인부담금</div>
            </td>
            <td style={{ ...tdStyle, textAlign:'center' }}>
              <button onClick={() => setShowBondModal(true)}
                style={{ padding:'5px 12px', backgroundColor:'#1a237e', color:'white', border:'none', borderRadius:'4px', cursor:'pointer', fontSize:'12px', fontWeight:'bold' }}>
                🧮 계산기
              </button>
            </td>
            <td style={tdStyle}>
              {bondBuildAmt > 0 ? (vatCell(bondBuildAmt, !!d.bondBuild_taxable).cell) : <span style={{ fontSize:'11px', color:'#aaa' }}>계산 후 반영</span>}
            </td>
            <td style={tdStyle}>
              {bondBuildAmt > 0
                ? <FundingCell funding={d.bondBuild_funding||{equity:'0',pf:'100',sale:'0'}} onChange={v=>updateFunding('bondBuild',v)} totalAmt={!!d.bondBuild_taxable ? Math.round(bondBuildAmt*1.1) : bondBuildAmt} />
                : <span style={{ fontSize:'11px', color:'#aaa' }}>—</span>}
            </td>
          </tr>

          {/* ⑧ 재산세 */}
          <tr style={{ backgroundColor: '#fafafa' }}>
            <td style={tdStyle}>
              <span style={labelStyle}>⑧ 재산세</span>
              <TaxBadge checked={!!d.propTax_taxable} onChange={v => update('propTax_taxable', v)} />
            </td>
            <td style={tdStyle}>
              <div style={{ fontSize:'11px', color:'#1b5e20', fontWeight:'bold', marginBottom:'2px' }}>
                지방세법 제111조 (별도합산 누진세율)
              </div>
              <div style={{ fontSize:'11px', color:'#555' }}>
                공시지가 × 70% × 누진세율 + 지방교육세 + 도시지역분
              </div>
              <div style={{ fontSize:'10px', color:'#888', marginTop:'2px' }}>
                착공 후 ~ 준공 전 / 매년 6월1일 기준 · 9월 납부
              </div>
            </td>
            <td style={{ ...tdStyle, textAlign:'center' }}>
              <button onClick={() => setShowPropTaxModal(true)}
                style={{ padding:'5px 12px', backgroundColor:'#1b5e20', color:'white', border:'none', borderRadius:'4px', cursor:'pointer', fontSize:'12px', fontWeight:'bold' }}>
                🧮 계산기
              </button>
            </td>
            <td style={tdStyle}>
              {d.propTaxData
                ? roCell(formatNumber(propTaxAmt))
                : <span style={{ fontSize:'11px', color:'#aaa' }}>계산 후 반영</span>}
            </td>
            <td style={tdStyle}>
              {d.propTaxData
                ? <FundingCell funding={d.propTax_funding||{equity:'0',pf:'100',sale:'0'}} onChange={v=>updateFunding('propTax',v)} totalAmt={propTaxAmt} />
                : <span style={{ fontSize:'11px', color:'#aaa' }}>—</span>}
            </td>
          </tr>

          {/* ⑨ 종합부동산세 */}
          <tr style={{ backgroundColor: 'white' }}>
            <td style={tdStyle}>
              <span style={labelStyle}>⑨ 종합부동산세</span>
              <TaxBadge checked={!!d.compTax_taxable} onChange={v => update('compTax_taxable', v)} />
            </td>
            <td style={tdStyle}>
              <div style={{ fontSize:'11px', color:'#4a148c', fontWeight:'bold', marginBottom:'2px' }}>
                종합부동산세법 제12조 (별도합산토지)
              </div>
              <div style={{ fontSize:'11px', color:'#555' }}>
                공시지가 80억 초과 시 과세 / 납부: 매년 12월
              </div>
              {(() => {
                const permitType = archData?.permitType || 'building_permit';
                const totalPrice = (archData?.plots||[]).reduce((s,p)=>s+(parseFloat(String(p.totalPrice||'').replace(/,/g,''))||0),0);
                if (permitType === 'housing_plan') return <div style={{ fontSize:'10px', color:'#27ae60', fontWeight:'bold', marginTop:'2px' }}>✓ 주택법(분리과세) → 종부세 없음</div>;
                if (totalPrice < 80000000000) return <div style={{ fontSize:'10px', color:'#27ae60', fontWeight:'bold', marginTop:'2px' }}>✓ 공시지가 {formatNumber(Math.round(totalPrice/100000000))}억 → 80억 미만 → 과세 없음</div>;
                return <div style={{ fontSize:'10px', color:'#e74c3c', fontWeight:'bold', marginTop:'2px' }}>⚠ 공시지가 {formatNumber(Math.round(totalPrice/100000000))}억 → 80억 초과 → 과세대상</div>;
              })()}
            </td>
            <td style={{ ...tdStyle, textAlign:'center' }}>
              <button onClick={() => setShowCompTaxModal(true)}
                style={{ padding:'5px 12px', backgroundColor:'#4a148c', color:'white', border:'none', borderRadius:'4px', cursor:'pointer', fontSize:'12px', fontWeight:'bold' }}>
                🧮 계산기
              </button>
            </td>
            <td style={tdStyle}>
              {d.compTaxData
                ? roCell(formatNumber(compTaxAmt))
                : <span style={{ fontSize:'11px', color:'#aaa' }}>계산 후 반영</span>}
            </td>
            <td style={tdStyle}>
              {d.compTaxData
                ? <FundingCell funding={d.compTax_funding||{equity:'0',pf:'100',sale:'0'}} onChange={v=>updateFunding('compTax',v)} totalAmt={compTaxAmt} />
                : <span style={{ fontSize:'11px', color:'#aaa' }}>—</span>}
            </td>
          </tr>

          {/* 기타 제세금 (동적) */}
          {etcItems.map((it, i) => (
            <tr key={i} style={{ backgroundColor: i%2===0 ? '#fafafa' : 'white' }}>
              <td style={tdStyle}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <input value={it.name} onChange={e => updateEtc(i, 'name', e.target.value)}
                    placeholder={`기타항목 ${i+1}`}
                    style={{ flex: 1, padding: '5px 8px', border: '1px solid #ddd', borderRadius: '3px', fontSize: '12px' }} />
                  <button onClick={() => removeEtc(i)}
                    style={{ padding: '3px 7px', backgroundColor: '#e74c3c', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer', fontSize: '11px' }}>✕</button>
                </div>
                <TaxBadge checked={!!it.taxable} onChange={v => updateEtc(i, 'taxable', v)} />
              </td>
              <td style={{ ...tdStyle, textAlign: 'center' }}><span style={{ fontSize: '11px', color: '#888' }}>—</span></td>
              <td style={{ ...tdStyle, textAlign: 'center' }}><span style={{ fontSize: '11px', color: '#888' }}>직접입력</span></td>
              <td style={tdStyle}>{numInput(it.amt, v => updateEtc(i, 'amt', v), '금액 입력')}</td>
              <td style={tdStyle}>
                <FundingCell funding={it.funding || { equity: '0', pf: '100', sale: '0' }} onChange={v => updateEtc(i, 'funding', v)} totalAmt={!!it.taxable ? Math.round((parseFloat(String(it.amt||'').replace(/,/g,''))||0)*1.1) : (parseFloat(String(it.amt||'').replace(/,/g,''))||0)} />
              </td>
            </tr>
          ))}

          <tr>
            <td colSpan={5} style={{ padding: '8px' }}>
              <button onClick={addEtc}
                style={{ padding: '6px 14px', backgroundColor: '#ecf0f1', border: '1px dashed #bbb', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', color: '#555' }}>
                + 기타 제세금 추가
              </button>
            </td>
          </tr>

        </tbody>

        <tfoot>
          <tr style={{ backgroundColor: '#1a237e' }}>
            <td colSpan={3} style={{ padding: '8px 12px', color: 'white', fontWeight: 'bold', fontSize: '13px' }}>제세금 합계</td>
            <td style={{ padding: '8px 12px', color: 'white', fontWeight: 'bold', fontSize: '14px', textAlign: 'right' }}>
              {formatNumber(total)} 천원
              {vatTotal > 0 && <div style={{ fontSize:'11px', color:'#e67e22', marginTop:'2px' }}>VAT {formatNumber(vatTotal)} 천원 / 합계 {formatNumber(total+vatTotal)} 천원</div>}
            </td>
            <td style={{ padding: '8px 12px' }}>
              {(() => {
                const rows = [
                  { funding: d.trans_funding, amt: transAmt },
                  { funding: d.gas_funding,   amt: gasAmt   },
                  { funding: d.water_funding, amt: waterAmt },
                  { funding: d.sewer_funding,     amt: sewerAmt     },
                  { funding: d.bondBuild_funding, amt: bondBuildAmt },
                  { funding: d.school_funding, amt: schoolAmt },
                  { funding: d.reg_funding,    amt: regAmt    },
                  ...etcItems.map(it => ({ funding: it.funding, amt: parseFloat(String(it.amt||'').replace(/,/g,''))||0 })),
                ];
                const summary = calcFundingSummary(rows);
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    {FUNDING_KEYS.filter(k => summary[k] > 0).map(k => {
                      const c = FUNDING_COLORS[k];
                      return (
                        <span key={k} style={{ fontSize: '11px', padding: '2px 7px', borderRadius: '8px', backgroundColor: c.bg, color: c.color, border: `1px solid ${c.border}`, fontWeight: 'bold' }}>
                          {FUNDING_LABELS[k]} {formatNumber(Math.round(summary[k]))}
                        </span>
                      );
                    })}
                  </div>
                );
              })()}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

// ─────────────────────────────────────────────
// 월별 지급 계산 순수 함수 (ProjectCost 메인에서 useMemo로 호출)
// 모든 섹션의 월별 공급가/VAT를 1회만 계산 → 지급패턴탭/합계탭 공유
// ─────────────────────────────────────────────
function calcMonthlyPayments({
  landData, directData, indirectData, consultData,
  salesCostData, overheadData, taxData,
  directResult, indirectResult, consultResult,
  taxResult, salesCostResult, overheadResult,
  archData, settingsData, salesData, vatData,
  paymentSchedule,
}) {
  const d = paymentSchedule || {};
  const parseAmt = (v) => parseFloat(String(v||'').replace(/,/g,''))||0;

  // ── 사업기간/월 목록 ──
  const prepPeriod      = parseFloat(String(archData?.prepPeriod||'').replace(/,/g,''))      || 0;
  const constructPeriod = parseFloat(String(archData?.constructPeriod||'').replace(/,/g,'')) || 24;
  const settlePeriod    = parseFloat(String(archData?.settlePeriod||'').replace(/,/g,''))    || 0;
  const totalPeriod     = Math.ceil(prepPeriod + constructPeriod + settlePeriod);
  const constructYear   = parseInt(archData?.constructYear)  || new Date().getFullYear();
  const constructMonth  = parseInt(archData?.constructMonth) || 1;

  const addMonths_ = (year, month, n) => {
    const total = (parseInt(year)-1)*12 + (parseInt(month)-1) + n;
    return { year: Math.floor(total/12)+1, month: (total%12)+1 };
  };
  const fmtYM_ = (y, m) => `${y}.${String(m).padStart(2,'0')}`;
  const bizStart = addMonths_(constructYear, constructMonth, -Math.round(prepPeriod));
  const months = Array.from({ length: Math.max(totalPeriod, 1) }, (_, i) => {
    const ym = addMonths_(bizStart.year, bizStart.month, i);
    return fmtYM_(ym.year, ym.month);
  });

  const relToYM = (rel) => {
    const ym = addMonths_(constructYear, constructMonth, parseInt(rel)||0);
    return fmtYM_(ym.year, ym.month);
  };

  // 공통: N회분할 헬퍼
  const calcSplit = (prefix, amt, defN=1) => {
    const n = parseInt(d[`${prefix}_n`] || defN) || 1;
    const splits = [];
    let pctSum = 0;
    for (let i = 0; i < n; i++) {
      const rel = parseInt(d[`${prefix}_rel_${i}`] || '0') || 0;
      const isLast = i === n - 1;
      const pct = isLast
        ? Math.max(0, 100 - pctSum)
        : parseFloat(d[`${prefix}_pct_${i}`] || String(Math.round(100/n))) || 0;
      if (!isLast) pctSum += pct;
      splits.push({ rel, amt: isLast ? amt - Math.round(amt * pctSum / 100) : Math.round(amt * pct / 100) });
    }
    return splits;
  };

  // 공통: 월별 누적 헬퍼
  const addToMonth = (totals, ym, amt) => {
    if (months.includes(ym)) totals[ym] = (totals[ym]||0) + amt;
  };

  // ── VAT 보정 헬퍼 ──
  // 원칙: 원천금액(itemAmt)에서 VAT 총액을 1회 계산하고,
  //       월별 배분 후 마지막 달에 오차 보정 → 합계 항상 일치
  //
  // 사용법:
  //   const vatPays = calcItemVat(itemAmt, monthPays, isTaxable);
  //   // monthPays: { 'YYYY.MM': amt, ... }  (해당 항목의 월별 공급가)
  //   // 반환값: { 'YYYY.MM': vatAmt, ... }
  const calcItemVat = (itemAmt, monthPays, isTaxable) => {
    if (!isTaxable || itemAmt <= 0) return {};
    const totalVat = Math.round(itemAmt * 0.1);
    const yms = Object.keys(monthPays).filter(ym => months.includes(ym) && monthPays[ym] > 0);
    if (yms.length === 0) return {};
    const raw = {};
    let allocated = 0;
    yms.forEach((ym, i) => {
      if (i === yms.length - 1) {
        raw[ym] = totalVat - allocated; // 마지막 달 보정
      } else {
        const v = Math.round(monthPays[ym] / itemAmt * totalVat);
        raw[ym] = v;
        allocated += v;
      }
    });
    return raw;
  };

  // vatTotals에 calcItemVat 결과를 누적
  const mergeVat = (vatTotals, vatPays) => {
    Object.entries(vatPays).forEach(([ym, v]) => {
      vatTotals[ym] = (vatTotals[ym]||0) + v;
    });
  };

  // 단일 지급(1개 달)용 — 총액 기준 VAT 그대로 적용
  const addVatToMonth = (vatTotals, ym, itemAmt, isTaxable) => {
    if (isTaxable && itemAmt > 0 && months.includes(ym))
      vatTotals[ym] = (vatTotals[ym]||0) + Math.round(itemAmt * 0.1);
  };

  // ── 1. 토지관련비용 ──
  const calcLand_ = () => {
    const plots   = archData?.plots || [];
    const totalM2 = plots.reduce((s,p)=>s+(parseFloat(String(p.areaM2||'').replace(/,/g,''))||0),0);
    const totalPy = totalM2 * 0.3025;

    const groups = ['A','B','C','D'];
    const landGroupData = landData?.landGroups || {};
    const activeGroups = groups.filter(g => {
      const gM2 = plots.filter(p=>(p.group||'A')===g)
        .reduce((s,p)=>s+(parseFloat(String(p.areaM2||'').replace(/,/g,''))||0),0);
      return gM2 > 0;
    });
    const groupLandAmts_ld = {};
    activeGroups.forEach(g => {
      const gM2 = plots.filter(p=>(p.group||'A')===g)
        .reduce((s,p)=>s+(parseFloat(String(p.areaM2||'').replace(/,/g,''))||0),0);
      const gPy = gM2 * 0.3025;
      const gd  = landGroupData[g] || {};
      const gPyPrice  = parseAmt(gd.pyPrice);
      const gCalcAmt  = Math.round(gPyPrice * gPy);
      const gOverride = parseAmt(gd.override);
      groupLandAmts_ld[g] = gOverride > 0 ? gOverride : gCalcAmt;
    });
    let landAmt;
    if (activeGroups.length > 0) {
      landAmt = activeGroups.reduce((s,g)=>s+groupLandAmts_ld[g], 0);
    } else {
      const pyPrice = parseAmt(landData?.landPyPrice);
      const calcL   = Math.round(pyPrice * totalPy);
      landAmt = parseAmt(landData?.landOverride) > 0 ? parseAmt(landData.landOverride) : calcL;
    }

    const acqAmt   = landData?.acqTaxOverride ? parseAmt(landData.acqTaxOverride)
      : Math.round(landAmt * (parseFloat(landData?.acqTaxRate??'4.6')||0) / 100);
    const bondPublic = plots.reduce((s,p)=>s+(parseFloat(String(p.totalPrice||'').replace(/,/g,''))||0),0);
    const bondAmt  = landData?.bondOverride ? parseAmt(landData.bondOverride)
      : Math.round(bondPublic * (parseFloat(landData?.bondBuyRate??'50')||0)/1000 * (parseFloat(landData?.bondDiscRate??'13.5')||0)/100/1000);
    const legalAmt = parseAmt(landData?.legalDirect) > 0 ? parseAmt(landData.legalDirect)
      : Math.round(landAmt * (parseFloat(landData?.legalRate??'0.3')||0)/100);
    const agentGroupRates = landData?.agentGroupRates || {};
    const agentMode_ = landData?.agentMode || 'rate';
    let agentAmt = 0;
    if (agentMode_ === 'rate' && activeGroups.length > 0) {
      activeGroups.forEach(g => {
        const rate = parseFloat(agentGroupRates[g] ?? '0.5') || 0;
        agentAmt += Math.round(groupLandAmts_ld[g] * rate / 100);
      });
    } else {
      agentAmt = parseAmt(landData?.agentDirect);
    }
    const depositPct = parseFloat(d.deposit_pct ?? '10') || 10;
    const midPct     = parseFloat(d.mid_pct     ?? '0')  || 0;
    const depositAmt = Math.round(landAmt * depositPct / 100);
    const midAmt     = Math.round(landAmt * midPct / 100);
    const balanceAmt = landAmt - depositAmt - midAmt;

    const landPayments = [
      { rel: d.deposit_rel??'-2', amt: depositAmt, key:'land' },
      ...(midPct > 0 ? [{ rel: d.mid_rel??'-1', amt: midAmt, key:'land' }] : []),
      { rel: d.balance_rel??'-1', amt: balanceAmt, key:'land' },
    ];
    const otherItems = [
      { key:'acq',   rel: d.acq_rel??'-1',   amt: acqAmt   },
      { key:'bond',  rel: d.bond_rel??'-1',   amt: bondAmt  },
      { key:'legal', rel: d.legal_rel??'-1',  amt: legalAmt },
      { key:'agent', rel: d.agent_rel??'-1',  amt: agentAmt },
      ...(landData?.etcItems||[]).filter(it=>parseAmt(it.amt)>0).map((it,i)=>({
        key:`etc_${i}`, rel:d[`etc_rel_${i}`]??'0', amt:parseAmt(it.amt)
      })),
    ].filter(it => it.amt > 0);

    const taxMap = { land:!!landData?.land_taxable, acq:!!landData?.acq_taxable,
      bond:!!landData?.bond_taxable, legal:!!landData?.legal_taxable, agent:!!landData?.agent_taxable };
    (landData?.etcItems||[]).forEach((it,i) => { taxMap[`etc_${i}`]=!!it.taxable; });

    const totals={}, vatTotals={};
    const items = []; // 세부항목별 { label, totals, vatTotals }

    // 토지매입비
    const landItemTotals={}, landItemVat={};
    landPayments.forEach(p => {
      const ym=relToYM(p.rel);
      addToMonth(totals,ym,p.amt); addVatToMonth(vatTotals,ym,p.amt,taxMap.land);
      addToMonth(landItemTotals,ym,p.amt); addVatToMonth(landItemVat,ym,p.amt,taxMap.land);
    });
    const landFunding = landData?.land_funding || d.land_funding || { equity:'0', pf:'100', sale:'0' };
    items.push({ label:'① 토지매입비', totals:landItemTotals, vatTotals:landItemVat, funding:landFunding });

    // 기타 항목 (취득세/채권/법무사/중개수수료/기타)
    const otherLabels = { acq:'② 취득세', bond:'③ 국민주택채권할인', legal:'④ 법무사/등기비', agent:'⑤ 중개수수료' };
    otherItems.forEach(r => {
      const ym=relToYM(r.rel);
      addToMonth(totals,ym,r.amt); addVatToMonth(vatTotals,ym,r.amt,taxMap[r.key]);
      const itTotals={}, itVat={};
      addToMonth(itTotals,ym,r.amt); addVatToMonth(itVat,ym,r.amt,taxMap[r.key]);
      const lbl = r.key.startsWith('etc_')
        ? `기타 ${landData?.etcItems?.[parseInt(r.key.replace('etc_',''))]?.name||''}`
        : (otherLabels[r.key]||r.key);
      const fndKey = r.key.startsWith('etc_') ? (landData?.etcItems?.[parseInt(r.key.replace('etc_',''))]?.funding) : (landData?.[`${r.key}_funding`] || d[`${r.key}_funding`]);
      items.push({ label:lbl, totals:itTotals, vatTotals:itVat, funding: fndKey || { equity:'0', pf:'100', sale:'0' } });
    });
    return { totals, vatTotals, items };
  };

  // ── 2. 직접공사비 ──
  const calcDirect_ = () => {
    const directAmt = directResult?.total || 0;
    const isTaxable = !!directData?.const_taxable;
    const progressTable = (settingsData?.progressRates && Object.keys(settingsData.progressRates).length > 0)
      ? settingsData.progressRates : DEFAULT_PROGRESS_TABLE;
    const conPeriod = Math.round(constructPeriod);
    const baseRates = progressTable[conPeriod] || DEFAULT_PROGRESS_TABLE[conPeriod] || [];
    const retainPct = parseFloat(d.direct_retain_pct ?? '0') || 0;
    const retainRel = d.direct_retain_rel ?? String(Math.round(constructPeriod) + 1);
    const retainAmt = Math.round(directAmt * retainPct / 100);
    const workingAmt = directAmt - retainAmt;
    const rateSum = baseRates.reduce((s,r)=>s+Math.max(0,r),0);
    const monthlyAmts = baseRates.map(r => rateSum>0 ? Math.round(workingAmt*Math.max(0,r)/rateSum) : 0);
    const calcSum = monthlyAmts.reduce((s,v)=>s+v,0);
    if (monthlyAmts.length>0) monthlyAmts[monthlyAmts.length-1] += (workingAmt - calcSum);
    const conMonths = Array.from({length:conPeriod},(_,i)=>{
      const ym=addMonths_(constructYear,constructMonth,i); return fmtYM_(ym.year,ym.month);
    });
    const retainYM = relToYM(parseInt(retainRel));
    const totals={}, vatTotals={};
    const workingPays = {};
    const directItemTotals={}, directItemVat={};
    conMonths.forEach((ym,i)=>{
      if (months.includes(ym) && monthlyAmts[i]>0) {
        addToMonth(totals,ym,monthlyAmts[i]);
        addToMonth(directItemTotals,ym,monthlyAmts[i]);
        workingPays[ym] = (workingPays[ym]||0) + monthlyAmts[i];
      }
    });
    if (retainAmt>0) {
      addToMonth(totals,retainYM,retainAmt);
      addToMonth(directItemTotals,retainYM,retainAmt);
    }
    mergeVat(vatTotals, calcItemVat(workingAmt, workingPays, isTaxable));
    if (retainAmt>0) addVatToMonth(vatTotals, retainYM, retainAmt, isTaxable);
    mergeVat(directItemVat, calcItemVat(workingAmt, workingPays, isTaxable));
    if (retainAmt>0) addVatToMonth(directItemVat, retainYM, retainAmt, isTaxable);
    const directFunding = directData?.const_funding || d.const_funding || { equity:'0', pf:'100', sale:'0' };
    const items = [{ label:'① 건축공사비', totals:directItemTotals, vatTotals:directItemVat, funding:directFunding }];
    return { totals, vatTotals, items };
  };

  // ── 3. 간접공사비 ──
  const calcIndirect_ = () => {
    const { permitAmt=0, demolAmt=0, utilAmt=0, artAmt=0, etcItems:indEtc=[] } = indirectResult||{};
    const items = [
      {key:'permit',amt:permitAmt,mode:'split',defN:1},
      {key:'demol', amt:demolAmt, mode:'single',defRel:'-2'},
      {key:'util',  amt:utilAmt,  mode:'split', defN:1},
      {key:'art',   amt:artAmt,   mode:'split', defN:1},
      ...indEtc.filter(it=>parseAmt(it.amt)>0).map((it,i)=>({key:`etc_${i}`,amt:parseAmt(it.amt),mode:'single',defRel:'0'})),
    ].filter(it=>it.amt>0);
    const taxMap = {permit:!!indirectData?.permit_taxable,demol:!!indirectData?.demol_taxable,
      util:!!indirectData?.util_taxable,art:!!indirectData?.art_taxable};
    (indirectData?.etcItems||[]).forEach((it,i)=>{taxMap[`etc_${i}`]=!!it.taxable;});
    const indLabels = {permit:'① 인허가비',demol:'② 철거비',util:'③ 각종부담금',art:'④ 미술작품설치비'};
    const totals={}, vatTotals={};
    const resultItems = [];
    items.forEach(it=>{
      const tax=taxMap[it.key]||false;
      const itemPays={}, itTotals={}, itVat={};
      if (it.mode==='split') {
        calcSplit(`ind_${it.key}`,it.amt,it.defN).forEach(sp=>{
          const ym=relToYM(sp.rel); addToMonth(totals,ym,sp.amt); addToMonth(itTotals,ym,sp.amt);
          itemPays[ym]=(itemPays[ym]||0)+sp.amt;
        });
      } else {
        const ym=relToYM(parseInt(d[`ind_rel_${it.key}`]??it.defRel)||0);
        addToMonth(totals,ym,it.amt); addToMonth(itTotals,ym,it.amt);
        itemPays[ym]=(itemPays[ym]||0)+it.amt;
      }
      mergeVat(vatTotals, calcItemVat(it.amt, itemPays, tax));
      mergeVat(itVat,     calcItemVat(it.amt, itemPays, tax));
      const lbl = it.key.startsWith('etc_')
        ? `기타 ${indirectData?.etcItems?.[parseInt(it.key.replace('etc_',''))]?.name||''}`
        : (indLabels[it.key]||it.key);
      const fnd_ind = it.key.startsWith('etc_') ? (indirectData?.etcItems?.[parseInt(it.key.replace('etc_',''))]?.funding) : (indirectData?.[`${it.key}_funding`] || d[`ind_${it.key}_funding`]);
      resultItems.push({ label:lbl, totals:itTotals, vatTotals:itVat, funding: fnd_ind || { equity:'0', pf:'100', sale:'0' } });
    });
    return { totals, vatTotals, items:resultItems };
  };

  // ── 4. 용역비 ──
  const calcConsult_ = () => {
    const { designAmt=0, superAmt=0, cmAmt=0, assessAmt=0, interiorAmt=0, etcItems:conEtc=[] } = consultResult||{};
    const cp=Math.round(constructPeriod);
    const items = [
      {key:'design',  amt:designAmt,   mode:'split', defN:2},
      {key:'super',   amt:superAmt,    mode:'range', defStart:'0',  defEnd:String(cp)},
      {key:'cm',      amt:cmAmt,       mode:'range', defStart:'-6', defEnd:String(cp)},
      {key:'assess',  amt:assessAmt,   mode:'split', defN:1},
      {key:'interior',amt:interiorAmt, mode:'split', defN:1},
      ...conEtc.filter(it=>parseAmt(it.amt)>0).map((it,i)=>({key:`etc_${i}`,amt:parseAmt(it.amt),mode:'single',defRel:'0'})),
    ].filter(it=>it.amt>0);
    const taxMap = {design:!!consultData?.design_taxable,super:!!consultData?.super_taxable,
      cm:!!consultData?.cm_taxable,assess:!!consultData?.assess_taxable,interior:!!consultData?.interior_taxable};
    (consultData?.etcItems||[]).forEach((it,i)=>{taxMap[`etc_${i}`]=!!it.taxable;});
    const conLabels = {design:'① 설계비',super:'② 감리비',cm:'③ CM비',assess:'④ 평가비',interior:'⑤ 인테리어'};
    const totals={}, vatTotals={};
    const resultItems = [];
    items.forEach(it=>{
      const tax=taxMap[it.key]||false;
      const itemPays={}, itTotals={}, itVat={};
      if (it.mode==='split') {
        calcSplit(`con_${it.key}`,it.amt,it.defN).forEach(sp=>{
          const ym=relToYM(sp.rel); addToMonth(totals,ym,sp.amt); addToMonth(itTotals,ym,sp.amt);
          itemPays[ym]=(itemPays[ym]||0)+sp.amt;
        });
      } else if (it.mode==='range') {
        const sR=parseInt((d[`con_rel_${it.key}_start`]??it.defStart)||'0');
        const eR=parseInt((d[`con_rel_${it.key}_end`]??it.defEnd)||'0');
        const len=Math.max(1,eR-sR+1); const mo=Math.round(it.amt/len);
        for (let r=sR;r<=eR;r++) {
          const ym=relToYM(r); const adj=r===eR?it.amt-mo*(len-1):mo;
          addToMonth(totals,ym,adj); addToMonth(itTotals,ym,adj);
          itemPays[ym]=(itemPays[ym]||0)+adj;
        }
      } else {
        const ym=relToYM(parseInt(d[`con_rel_${it.key}`]??it.defRel)||0);
        addToMonth(totals,ym,it.amt); addToMonth(itTotals,ym,it.amt);
        itemPays[ym]=(itemPays[ym]||0)+it.amt;
      }
      mergeVat(vatTotals, calcItemVat(it.amt, itemPays, tax));
      mergeVat(itVat,     calcItemVat(it.amt, itemPays, tax));
      const lbl = it.key.startsWith('etc_')
        ? `기타 ${consultData?.etcItems?.[parseInt(it.key.replace('etc_',''))]?.name||''}`
        : (conLabels[it.key]||it.key);
      const fnd_con = it.key.startsWith('etc_') ? (consultData?.etcItems?.[parseInt(it.key.replace('etc_',''))]?.funding) : (consultData?.[`${it.key}_funding`] || d[`con_${it.key}_funding`]);
      resultItems.push({ label:lbl, totals:itTotals, vatTotals:itVat, funding: fnd_con || { equity:'0', pf:'100', sale:'0' } });
    });
    return { totals, vatTotals, items:resultItems };
  };

  // ── 5. 판매비 ──
  const calcSales_ = () => {
    const { mhRentAmt=0, mhInstAmt=0, mhOperAmt=0, adAmt=0,
            agentAptAmt2=0, agentOffiAmt2=0, agentStoreAmt2=0,
            hugAmt2=0, etcItems:salEtc=[] } = salesCostResult||{};

    // 분양일정 (지급패턴과 동일 로직)
    const prepPeriod_ = parseFloat(String(archData?.prepPeriod||'').replace(/,/g,''))||0;
    const conPrd_     = Math.round(constructPeriod);
    const totalMonths_= Math.ceil(prepPeriod_ + conPrd_ + (parseFloat(String(archData?.settlePeriod||'').replace(/,/g,''))||0));
    const aptCfg_     = salesData?.aptConfig   || {};
    const offiCfg_    = salesData?.offiConfig  || {};
    const storeCfg_   = salesData?.storeConfig || {};
    const conIdx_     = prepPeriod_ + 1;
    const idxToRel_   = (idx) => idx - conIdx_;

    const aptStartIdx_  = conIdx_ + (parseInt(aptCfg_.salesStartOffset)||0);
    const aptEndMonth_  = parseInt(aptCfg_.endMonth)||0;
    const aptEndIdx_    = aptEndMonth_ > 0 ? aptStartIdx_ + aptEndMonth_ - 1 : prepPeriod_ + conPrd_;
    const aptStartRel_  = idxToRel_(aptStartIdx_);
    const aptEndRel_    = idxToRel_(aptEndIdx_);

    const offiStartIdx_ = conIdx_ + (parseInt(offiCfg_.salesStartOffset)||0);
    const offiEndMonth_ = parseInt(offiCfg_.endMonth)||0;
    const offiEndIdx_   = offiEndMonth_ > 0 ? offiStartIdx_ + offiEndMonth_ - 1 : prepPeriod_ + conPrd_;

    const junIdx_           = prepPeriod_ + conPrd_ - 1;
    const storeStartBefore_ = parseInt(storeCfg_.storeStartBefore)||9;
    const storeEndAfter_    = parseInt(storeCfg_.storeEndAfter)||4;
    const storeStartIdx_    = junIdx_ - storeStartBefore_;
    const storeEndIdx_      = junIdx_ + storeEndAfter_ - 1;

    // calcRates (지급패턴과 동일)
    const calcRatesLocal_ = (cfg, startIdx, endIdx) => {
      const m1=parseFloat(cfg.m1)||0, m2=parseFloat(cfg.m2)||0, m3=parseFloat(cfg.m3)||0;
      const remain=1-m1-m2-m3;
      const remMonths=Math.max(0,endIdx-startIdx-2);
      const rates=Array(totalMonths_).fill(0);
      for(let i=startIdx-1;i<totalMonths_;i++){
        const m=i-(startIdx-1);
        if(i>endIdx-1) break;
        if(m===0) rates[i]=m1;
        else if(m===1) rates[i]=m2;
        else if(m===2) rates[i]=m3;
        else if(remMonths>0) rates[i]=remain/remMonths;
      }
      return rates;
    };

    // agentByRates (지급패턴과 동일)
    const agentByRates_ = (amt, rates) => {
      if(amt<=0) return {};
      const pays={};
      rates.forEach((rate,i)=>{
        if(rate<=0) return;
        const t=(bizStart.year-1)*12+(bizStart.month-1)+i;
        const ym2=`${Math.floor(t/12)+1}.${String(t%12+1).padStart(2,'0')}`;
        if(months.includes(ym2)) pays[ym2]=(pays[ym2]||0)+Math.round(amt*rate);
      });
      // 반올림 오차 보정
      const paidSum=Object.values(pays).reduce((s,v)=>s+v,0);
      const diff=amt-paidSum;
      if(diff!==0){
        const lastYM=Object.keys(pays).filter(ym=>months.includes(ym)).sort().pop();
        if(lastYM) pays[lastYM]=(pays[lastYM]||0)+diff;
      }
      return pays;
    };

    const aptRates_   = calcRatesLocal_(aptCfg_,   aptStartIdx_,   aptEndIdx_);
    const offiRates_  = calcRatesLocal_(offiCfg_,  offiStartIdx_,  offiEndIdx_);
    const storeRates_ = calcRatesLocal_(storeCfg_, storeStartIdx_, storeEndIdx_);

    const agentAptPays_   = agentByRates_(agentAptAmt2,   aptRates_);
    const agentOffiPays_  = agentByRates_(agentOffiAmt2,  offiRates_);
    const agentStorePays_ = agentByRates_(agentStoreAmt2, storeRates_);

    const items = [
      {key:'mhRent',    amt:mhRentAmt,     mode:'range',      startRel:aptStartRel_, endRel:aptEndRel_},
      {key:'mhInst',    amt:mhInstAmt,     mode:'single',     defRel:String(aptStartRel_-1)},
      {key:'mhOper',    amt:mhOperAmt,     mode:'range',      startRel:aptStartRel_, endRel:aptEndRel_},
      {key:'ad',        amt:adAmt,         mode:'range',      startRel:aptStartRel_, endRel:aptEndRel_},
      {key:'agentApt',  amt:agentAptAmt2,  mode:'agentRates', pays:agentAptPays_},
      {key:'agentOffi', amt:agentOffiAmt2, mode:'agentRates', pays:agentOffiPays_},
      {key:'agentStore',amt:agentStoreAmt2,mode:'agentRates', pays:agentStorePays_},
      {key:'hug',       amt:hugAmt2,       mode:'split',      defN:1},
      ...salEtc.filter(it=>parseAmt(it.amt)>0).map((it,i)=>({key:`etc_${i}`,amt:parseAmt(it.amt),mode:'single',defRel:'0'})),
    ].filter(it=>it.amt>0);

    const taxMap={mhRent:!!salesCostData?.mhRent_taxable,mhInst:!!salesCostData?.mhInst_taxable,
      mhOper:!!salesCostData?.mhOper_taxable,ad:!!salesCostData?.ad_taxable,
      agentApt:!!salesCostData?.agentApt_taxable,agentOffi:!!salesCostData?.agentOffi_taxable,
      agentStore:!!salesCostData?.agentStore_taxable,hug:!!salesCostData?.hug_taxable};
    (salesCostData?.etcItems||[]).forEach((it,i)=>{taxMap[`etc_${i}`]=!!it.taxable;});

    const salLabels = {mhRent:'① 모델하우스임차료',mhInst:'② 모델하우스설치비',mhOper:'③ 모델하우스운영비',
      ad:'④ 광고선전비',agentApt:'⑤ 분양대행비(아파트)',agentOffi:'⑤ 분양대행비(오피스텔)',
      agentStore:'⑤ 분양대행비(상가)',hug:'⑥ HUG보증수수료'};
    const totals={}, vatTotals={};
    const resultItems = [];
    items.forEach(it=>{
      const tax=taxMap[it.key]||false;
      const itemPays={}, itTotals={}, itVat={};
      if(it.mode==='range'){
        const sR=it.startRel, eR=it.endRel;
        const len=Math.max(1,eR-sR+1); const mo=Math.round(it.amt/len);
        for(let r=sR;r<=eR;r++){
          const ym=relToYM(r); const adj=r===eR?it.amt-mo*(len-1):mo;
          addToMonth(totals,ym,adj); addToMonth(itTotals,ym,adj);
          itemPays[ym]=(itemPays[ym]||0)+adj;
        }
      } else if(it.mode==='agentRates'){
        Object.entries(it.pays||{}).forEach(([ym,amt])=>{
          addToMonth(totals,ym,amt); addToMonth(itTotals,ym,amt);
          itemPays[ym]=(itemPays[ym]||0)+amt;
        });
      } else if(it.mode==='split'){
        calcSplit(`sal_${it.key}`,it.amt,it.defN||1).forEach(sp=>{
          const ym=relToYM(sp.rel); addToMonth(totals,ym,sp.amt); addToMonth(itTotals,ym,sp.amt);
          itemPays[ym]=(itemPays[ym]||0)+sp.amt;
        });
      } else {
        const rel=d[`sal_rel_${it.key}`]??it.defRel??'0';
        const ym=relToYM(parseInt(rel)||0); addToMonth(totals,ym,it.amt); addToMonth(itTotals,ym,it.amt);
        itemPays[ym]=(itemPays[ym]||0)+it.amt;
      }
      mergeVat(vatTotals, calcItemVat(it.amt, itemPays, tax));
      mergeVat(itVat,     calcItemVat(it.amt, itemPays, tax));
      const lbl = it.key.startsWith('etc_')
        ? `기타 ${salesCostData?.etcItems?.[parseInt(it.key.replace('etc_',''))]?.name||''}`
        : (salLabels[it.key]||it.key);
      const fnd_sal = it.key.startsWith('etc_') ? (salesCostData?.etcItems?.[parseInt(it.key.replace('etc_',''))]?.funding) : (salesCostData?.[`${it.key}_funding`] || d[`sal_${it.key}_funding`]);
      resultItems.push({ label:lbl, totals:itTotals, vatTotals:itVat, funding: fnd_sal || { equity:'0', pf:'100', sale:'0' } });
    });
    return { totals, vatTotals, items:resultItems };
  };

  // ── 6. 제세금 ──
  const calcTaxM_ = () => {
    const { transAmt=0, gasAmt=0, waterAmt=0, sewerAmt=0, bondBuildAmt=0,
            schoolAmt=0, regAmt=0, propTaxAmt=0, compTaxAmt=0, etcItems:taxEtc=[] } = taxResult||{};
    const propYearCalc = taxData?.propTaxData?.yearCalc||[];
    const compYearCalc = taxData?.compTaxData?.yearCalc||[];
    const yearCalcToPayments = (yc) => yc.filter(r=>r.amt>0)
      .map(r=>({ym:`${r.year}.${String(r.month).padStart(2,'0')}`,amt:r.amt}));
    const items = [
      {key:'trans',     amt:transAmt,     mode:'split',    defN:1},
      {key:'gas',       amt:gasAmt,       mode:'single',   defRel:'0'},
      {key:'water',     amt:waterAmt,     mode:'single',   defRel:'0'},
      {key:'sewer',     amt:sewerAmt,     mode:'single',   defRel:'0'},
      {key:'bondBuild', amt:bondBuildAmt, mode:'single',   defRel:String(Math.round(constructPeriod)-1)},
      {key:'school',    amt:schoolAmt,    mode:'single',   defRel:'-1'},
      {key:'reg',       amt:regAmt,       mode:'single',   defRel:String(Math.round(constructPeriod))},
      {key:'propTax',   amt:propTaxAmt,   mode:'yearCalc', payments:yearCalcToPayments(propYearCalc)},
      {key:'compTax',   amt:compTaxAmt,   mode:'yearCalc', payments:yearCalcToPayments(compYearCalc)},
      ...taxEtc.filter(it=>parseAmt(it.amt)>0).map((it,i)=>({key:`etc_${i}`,amt:parseAmt(it.amt),mode:'single',defRel:'0'})),
    ].filter(it=>it.amt>0);
    const taxMap = {trans:!!taxData?.trans_taxable,gas:!!taxData?.gas_taxable,
      water:!!taxData?.water_taxable,sewer:!!taxData?.sewer_taxable,
      bondBuild:!!taxData?.bondBuild_taxable,school:!!taxData?.school_taxable,
      reg:!!taxData?.reg_taxable,propTax:false,compTax:false};
    (taxData?.etcItems||[]).forEach((it,i)=>{taxMap[`etc_${i}`]=!!it.taxable;});
    const taxLabels = {trans:'① 광역교통부담금',gas:'② 도시가스부담금',water:'③ 상수도부담금',
      sewer:'④ 하수도부담금',bondBuild:'⑤ 건설채권할인',school:'⑥ 학교용지부담금',
      reg:'⑦ 취득세(준공)',propTax:'⑧ 재산세',compTax:'⑨ 법인세'};
    const totals={}, vatTotals={};
    const resultItems = [];
    items.forEach(it=>{
      const tax=taxMap[it.key]||false;
      const itemPays={}, itTotals={}, itVat={};
      if (it.mode==='split') {
        calcSplit(`tax_${it.key}`,it.amt,it.defN||1).forEach(sp=>{
          const ym=relToYM(sp.rel); addToMonth(totals,ym,sp.amt); addToMonth(itTotals,ym,sp.amt);
          itemPays[ym]=(itemPays[ym]||0)+sp.amt;
        });
      } else if (it.mode==='yearCalc') {
        (it.payments||[]).forEach(p=>{
          addToMonth(totals,p.ym,p.amt); addToMonth(itTotals,p.ym,p.amt);
          itemPays[p.ym]=(itemPays[p.ym]||0)+p.amt;
        });
      } else {
        const ym=relToYM(parseInt(d[`tax_rel_${it.key}`]??it.defRel)||0);
        addToMonth(totals,ym,it.amt); addToMonth(itTotals,ym,it.amt);
        itemPays[ym]=(itemPays[ym]||0)+it.amt;
      }
      mergeVat(vatTotals, calcItemVat(it.amt, itemPays, tax));
      mergeVat(itVat,     calcItemVat(it.amt, itemPays, tax));
      const lbl = it.key.startsWith('etc_')
        ? `기타 ${taxData?.etcItems?.[parseInt(it.key.replace('etc_',''))]?.name||''}`
        : (taxLabels[it.key]||it.key);
      const fnd_tax = it.key.startsWith('etc_') ? (taxData?.etcItems?.[parseInt(it.key.replace('etc_',''))]?.funding) : (taxData?.[`${it.key}_funding`] || d[`tax_${it.key}_funding`]);
      resultItems.push({ label:lbl, totals:itTotals, vatTotals:itVat, funding: fnd_tax || { equity:'0', pf:'100', sale:'0' } });
    });
    return { totals, vatTotals, items:resultItems };
  };

  // ── 7. 부대비 ──
  const calcOverhead_ = () => {
    const { trustAmt=0, operAmt=0, moveAmt=0, reserveAmt=0, etcItems:ovrEtc=[] } = overheadResult||{};
    const cp=parseFloat(String(archData?.constructPeriod||'').replace(/,/g,''))||31;
    const sp=parseFloat(String(archData?.settlePeriod||'').replace(/,/g,''))||6;
    // 예비비: 착공(0)~준공(cp) 반기(6개월)별 균등 집행
    const reserveSemiAnnuals = Math.max(1, Math.floor(cp / 6));
    const reserveRels = Array.from({ length: reserveSemiAnnuals }, (_, i) => i * 6); // 0, 6, 12, ...
    const items = [
      {key:'trust',  amt:trustAmt,  mode:'range',     defStart:'-3',          defEnd:String(Math.round(cp+sp-1))},
      {key:'oper',   amt:operAmt,   mode:'range',     defStart:'0',            defEnd:String(Math.round(cp+sp-1))},
      {key:'move',   amt:moveAmt,   mode:'range',     defStart:String(Math.round(cp)), defEnd:String(Math.round(cp+sp-1))},
      {key:'reserve',amt:reserveAmt,mode:'quarterly', rels:reserveRels},
      ...ovrEtc.filter(it=>parseAmt(it.amt)>0).map((it,i)=>({key:`etc_${i}`,amt:parseAmt(it.amt),mode:'single',defRel:'0'})),
    ].filter(it=>it.amt>0);
    const taxMap = {trust:!!overheadData?.trust_taxable,oper:!!overheadData?.oper_taxable,
      move:!!overheadData?.move_taxable,reserve:!!overheadData?.reserve_taxable};
    (overheadData?.etcItems||[]).forEach((it,i)=>{taxMap[`etc_${i}`]=!!it.taxable;});
    const ovrLabels = {trust:'① 관리신탁수수료',oper:'② 시행사운영비',move:'③ 입주관리비',reserve:'④ 예비비(에쿼티 조정)'};
    const totals={}, vatTotals={};
    const resultItems = [];
    items.forEach(it=>{
      const tax=taxMap[it.key]||false;
      const itemPays={}, itTotals={}, itVat={};
      if (it.mode==='range') {
        const sR=parseInt((d[`ovr_rel_${it.key}_start`]??it.defStart)||'0');
        const eR=parseInt((d[`ovr_rel_${it.key}_end`]??it.defEnd)||'0');
        const len=Math.max(1,eR-sR+1); const mo=Math.round(it.amt/len);
        for (let r=sR;r<=eR;r++) {
          const ym=relToYM(r); const adj=r===eR?it.amt-mo*(len-1):mo;
          addToMonth(totals,ym,adj); addToMonth(itTotals,ym,adj);
          itemPays[ym]=(itemPays[ym]||0)+adj;
        }
      } else if (it.mode==='quarterly') {
        // 분기별 균등 집행 — 마지막 분기에 오차 보정
        const rels = it.rels || [0];
        const qn   = rels.length;
        const mo   = Math.round(it.amt / qn);
        rels.forEach((r, qi) => {
          const ym  = relToYM(r);
          const adj = qi === qn-1 ? it.amt - mo*(qn-1) : mo;
          addToMonth(totals,ym,adj); addToMonth(itTotals,ym,adj);
          itemPays[ym]=(itemPays[ym]||0)+adj;
        });
      } else {
        const rel=d[`ovr_rel_${it.key}`]??it.defRel??'0';
        const ym=relToYM(parseInt(rel)||0); addToMonth(totals,ym,it.amt); addToMonth(itTotals,ym,it.amt);
        itemPays[ym]=(itemPays[ym]||0)+it.amt;
      }
      mergeVat(vatTotals, calcItemVat(it.amt, itemPays, tax));
      mergeVat(itVat,     calcItemVat(it.amt, itemPays, tax));
      const lbl = it.key.startsWith('etc_')
        ? `기타 ${overheadData?.etcItems?.[parseInt(it.key.replace('etc_',''))]?.name||''}`
        : (ovrLabels[it.key]||it.key);
      const fnd_ovr = it.key === 'reserve'
        ? { equity:'100', pf:'0', sale:'0' }  // 예비비는 항상 Equity 100%
        : it.key.startsWith('etc_') ? (overheadData?.etcItems?.[parseInt(it.key.replace('etc_',''))]?.funding) : (overheadData?.[`${it.key}_funding`] || d[`ovr_${it.key}_funding`]);
      resultItems.push({ label:lbl, totals:itTotals, vatTotals:itVat, funding: fnd_ovr || { equity:'0', pf:'100', sale:'0' } });
    });
    return { totals, vatTotals, items:resultItems };
  };

  // ── 전체 결과 조합 ──
  const land     = calcLand_();
  const direct   = calcDirect_();
  const indirect = calcIndirect_();
  const consult  = calcConsult_();
  const sales    = calcSales_();
  const tax      = calcTaxM_();
  const overhead = calcOverhead_();

  // ── 부가세 정산 (분기별 납부+/환급-) ──
  // 매입VAT 합산 (모든 카테고리)
  const inputVatByMonth_ = {};
  [land.vatTotals, direct.vatTotals, indirect.vatTotals,
   consult.vatTotals, sales.vatTotals, tax.vatTotals, overhead.vatTotals
  ].forEach(vt => {
    Object.entries(vt).forEach(([ym, v]) => {
      inputVatByMonth_[ym] = (inputVatByMonth_[ym]||0) + v;
    });
  });
  // 매출VAT (분양율탭 vatByMonth)
  const salesVatByMonth_ = salesData?.vatByMonth || {};
  // 부가세 안분율 — vatData.taxRatio 우선
  const taxRatioVAT_ = parseFloat(vatData?.taxRatio) || parseFloat(paymentSchedule?.taxRatioVAT) || 0;
  // 분기 정산월: 1,4,7,10월 + 마지막 월
  const settleYMs = [...new Set([
    ...months.filter(ym => [1,4,7,10].includes(parseInt(ym.split('.')[1]))),
    months[months.length-1]
  ])].sort();
  const vatSettlements = {};
  let prevIdx2 = 0;
  settleYMs.forEach(sYM => {
    const idx = months.indexOf(sYM);
    if (idx < 0) return;
    const period = months.slice(prevIdx2, idx+1);
    const outVat = period.reduce((s,ym) => s + (salesVatByMonth_[ym]||0), 0);
    const inVat  = period.reduce((s,ym) => s + (inputVatByMonth_[ym]||0), 0);
    const v = Math.round(outVat - inVat * taxRatioVAT_);
    if (v !== 0) vatSettlements[sYM] = v;
    prevIdx2 = idx + 1;
  });

  // ── 항목별 재원조달 월별 배분 (에쿼티 한도 → 분양불 한도 → PF) ──
  // 각 item에 eqMonthly, saleMonthly, pfMonthly 배열 추가
  const assignFunding = (items) => items.map(item => {
    const monthly = months.map(ym => (item.totals[ym]||0) + (item.vatTotals?.[ym]||0));
    const totalAmt = monthly.reduce((s,v)=>s+v, 0);
    const f = item.funding || { equity:'0', pf:'100', sale:'0' };
    const eqPct   = (parseFloat(f.equity)||0) / 100;
    const salePct = (parseFloat(f.sale  )||0) / 100;
    // 총 한도 (반올림 정책: 총액 먼저 확정)
    const eqLimit   = Math.round(totalAmt * eqPct);
    const saleLimit = Math.round(totalAmt * salePct);
    const pfLimit   = totalAmt - eqLimit - saleLimit;

    // ── 투입 순서: 분양불 → 에쿼티 → PF (한도 소진 방식) ──
    // 각 재원을 한도 내에서 월별 지출 순서대로 먼저 채움
    const saleMonthly = Array(monthly.length).fill(0);
    const eqMonthly   = Array(monthly.length).fill(0);
    const pfMonthly   = Array(monthly.length).fill(0);

    let saleRemain = saleLimit;
    let eqRemain   = eqLimit;

    monthly.forEach((v, i) => {
      if (v <= 0) return;
      let left = v;

      // 1. 분양불 우선 투입
      const saleUse = Math.min(saleRemain, left);
      saleMonthly[i] = saleUse;
      saleRemain -= saleUse;
      left -= saleUse;

      // 2. 에쿼티 투입
      const eqUse = Math.min(eqRemain, left);
      eqMonthly[i] = eqUse;
      eqRemain -= eqUse;
      left -= eqUse;

      // 3. PF 나머지
      pfMonthly[i] = left;
    });

    // 마지막 달 오차 보정 (총합 일치)
    const saleSum = saleMonthly.reduce((s,v)=>s+v,0);
    const eqSum   = eqMonthly.reduce((s,v)=>s+v,0);
    const pfSum   = pfMonthly.reduce((s,v)=>s+v,0);
    const lastIdx = monthly.findLastIndex(v=>v>0);
    if (lastIdx >= 0) {
      saleMonthly[lastIdx] += saleLimit - saleSum;
      eqMonthly[lastIdx]   += eqLimit   - eqSum;
      pfMonthly[lastIdx]   += pfLimit   - pfSum;
    }

    return { ...item, monthly, eqMonthly, saleMonthly, pfMonthly, eqLimit, saleLimit, pfLimit };
  });

  const landItemsF     = assignFunding(land.items    ||[]);
  const directItemsF   = assignFunding(direct.items  ||[]);
  const indirectItemsF = assignFunding(indirect.items||[]);
  const consultItemsF  = assignFunding(consult.items ||[]);
  const salesItemsF    = assignFunding(sales.items   ||[]);
  const taxItemsF      = assignFunding(tax.items     ||[]);
  const overheadItemsF = assignFunding(overhead.items||[]);

  return {
    months,
    land:        land.totals,     landVat:     land.vatTotals,     landItems:     landItemsF,
    direct:      direct.totals,   directVat:   direct.vatTotals,   directItems:   directItemsF,
    indirect:    indirect.totals, indirectVat: indirect.vatTotals, indirectItems: indirectItemsF,
    consult:     consult.totals,  consultVat:  consult.vatTotals,  consultItems:  consultItemsF,
    sales:       sales.totals,    salesVat:    sales.vatTotals,    salesItems:    salesItemsF,
    tax:         tax.totals,      taxVat:      tax.vatTotals,      taxItems:      taxItemsF,
    overhead:    overhead.totals, overheadVat: overhead.vatTotals, overheadItems: overheadItemsF,
    vatSettlements,
  };
}

// ─────────────────────────────────────────────
// ─────────────────────────────────────────────
// 부가세/지출합계 행 렌더 헬퍼 (지급패턴 공통)
// ─────────────────────────────────────────────
function renderVatRows(monthTotals, vatMonthTotals, totalAmt, totalVatAmt, CAT_COLOR, months, formatNumber, taxRatio) {
  if (totalVatAmt === 0) return null;
  const deductVat   = taxRatio > 0 ? Math.round(totalVatAmt * taxRatio) : totalVatAmt;
  const nonDeductVat = totalVatAmt - deductVat;
  return (
    <>
      <tr style={{ backgroundColor:'#f9f9f9' }}>
        <td style={{ padding:'4px 8px', color:'#888', fontSize:'11px', position:'sticky', left:0, backgroundColor:'#f9f9f9', zIndex:1 }}>
          부가세 (VAT 10%)
          {taxRatio > 0 && (
            <div style={{ fontSize:'9px', color:'#aaa', marginTop:'1px' }}>
              공제 {(taxRatio*100).toFixed(1)}% / 원가 {((1-taxRatio)*100).toFixed(1)}%
            </div>
          )}
        </td>
        <td style={{ padding:'4px 6px', color:'#e67e22', fontSize:'11px', textAlign:'right', fontWeight:'bold' }}>
          {formatNumber(totalVatAmt)}
          {taxRatio > 0 && nonDeductVat > 0 && (
            <div style={{ fontSize:'9px', color:'#c0392b' }}>원가 {formatNumber(nonDeductVat)}</div>
          )}
        </td>
        {months.map(ym => {
          const v = vatMonthTotals[ym] || 0;
          return (
            <td key={ym} style={{ padding:'4px 6px', textAlign:'right', color:'#e67e22', fontSize:'11px' }}>
              {v > 0 ? formatNumber(v) : ''}
            </td>
          );
        })}
        <td style={{ padding:'4px 6px', color:'#e67e22', fontSize:'11px', textAlign:'right', fontWeight:'bold' }}>
          {formatNumber(totalVatAmt)}
        </td>
      </tr>
      <tr style={{ backgroundColor: CAT_COLOR }}>
        <td style={{ padding:'5px 8px', color:'white', fontWeight:'bold', fontSize:'11px', position:'sticky', left:0, backgroundColor: CAT_COLOR, zIndex:1 }}>
          월별 지출합계
        </td>
        <td style={{ padding:'4px 6px', color:'white', fontWeight:'bold', textAlign:'right', fontSize:'11px' }}>
          {formatNumber(totalAmt + totalVatAmt)}
        </td>
        {months.map(ym => (
          <td key={ym} style={{ padding:'4px 6px', textAlign:'right', color:'white', fontWeight:'bold', fontSize:'11px' }}>
            {(monthTotals[ym]||0) + (vatMonthTotals[ym]||0) > 0
              ? formatNumber((monthTotals[ym]||0) + (vatMonthTotals[ym]||0))
              : '—'}
          </td>
        ))}
        <td style={{ padding:'4px 6px', color:'white', fontWeight:'bold', textAlign:'right', fontSize:'11px' }}>
          {formatNumber(totalAmt + totalVatAmt)}
        </td>
      </tr>
    </>
  );
}

// 지급패턴 섹션
// ─────────────────────────────────────────────
function PaymentScheduleSection({ costSummary, landData, directData, indirectData, consultData, salesCostData, overheadData, taxData, archData, settingsData, directResult, indirectResult, consultResult, taxResult, salesCostResult, overheadResult, landResult, incomeData, salesData, taxRatioVAT, monthlyPayments, data, onChange }) {
  const d = data || {};
  const update = (key, val) => onChange({ ...d, [key]: val });

  // monthlyPayments에서 각 섹션 데이터 직접 참조 (1회 계산, 항상 최신값)
  const mp = monthlyPayments || {};

  // 아코디언 열림/닫힘 상태
  const [openSections, setOpenSections] = useState({ land: false, direct: false, indirect: false, consult: false, tax: false, sales: false, overhead: false });
  const toggleSection = (key) => setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));

  // 섹션별 크로스체크 팝업 상태
  const [crossCheckSection, setCrossCheckSection] = useState(null); // null | 'land'|'direct'|'indirect'|'consult'|'sales'|'tax'|'overhead'

  // ── 사업기간 연동 ──
  const prepPeriodRaw   = archData?.prepPeriod;
  const prepPeriod      = parseFloat(String(prepPeriodRaw||'').replace(/,/g,''))      || 0;
  const constructPeriod = parseFloat(String(archData?.constructPeriod||'').replace(/,/g,'')) || 24;
  const settlePeriod    = parseFloat(String(archData?.settlePeriod||'').replace(/,/g,''))    || 0;
  const totalPeriod     = Math.ceil(prepPeriod + constructPeriod + settlePeriod);
  const constructYear   = parseInt(archData?.constructYear)  || new Date().getFullYear();
  const constructMonth  = parseInt(archData?.constructMonth) || 1;

  // addMonths / fmtYM (분양율탭과 동일)
  const addMonths = (year, month, n) => {
    const total = (parseInt(year)-1)*12 + (parseInt(month)-1) + n;
    return { year: Math.floor(total/12)+1, month: (total%12)+1 };
  };
  const fmtYM = (y, m) => `${y}.${String(m).padStart(2,'0')}`;

  // 분양율탭과 동일한 방식: 사업시작=1번월, 착공=prepPeriod+1번월
  // constructYear/constructMonth는 절대 착공년월
  const bizStart = addMonths(constructYear, constructMonth, -Math.round(prepPeriod));
  const conYM    = fmtYM(constructYear, constructMonth);
  // 준공월 = 착공월 포함 N개월 → 착공 + (N-1)M = N번째 달
  const compYM   = (() => { const ym = addMonths(constructYear, constructMonth, Math.round(constructPeriod) - 1); return fmtYM(ym.year, ym.month); })();

  // 전체 월 목록: 사업시작 ~ 사업종료 (분양율탭과 동일)
  const months = Array.from({ length: Math.max(totalPeriod, 1) }, (_, i) => {
    const ym = addMonths(bizStart.year, bizStart.month, i);
    return fmtYM(ym.year, ym.month);
  });

  // 착공 기준 상대월 입력값 → 절대 YM
  // rel=-2 → 착공 2개월 전, rel=0 → 착공월, rel=1 → 착공 다음달
  const relToYM = (rel) => {
    const ym = addMonths(constructYear, constructMonth, parseInt(rel||0));
    return fmtYM(ym.year, ym.month);
  };

  // 절대 YM → 착공 기준 상대 레이블 (-2M, -1M, 착공, +1M ...)
  const relLabel = (ym) => {
    const [y, m] = ym.split('.').map(Number);
    const rel = (y - constructYear)*12 + (m - constructMonth);
    if (rel === 0) return '착공';
    if (ym === compYM) return '준공';
    return rel > 0 ? `+${rel}M` : `${rel}M`;
  };

  // ── 금액 헬퍼 ──
  const parseAmt = (v) => parseFloat(String(v||'').replace(/,/g,''))||0;

  // ── 토지관련비용 금액 (그룹별 합산) ──
  const plots_ps   = archData?.plots || [];
  const totalM2_ps = plots_ps.reduce((s,p)=>s+(parseFloat(String(p.areaM2||'').replace(/,/g,''))||0),0);
  const totalPy_ps = totalM2_ps * 0.3025;
  const landGroupData_ps = landData?.landGroups || {};
  const groups_ps = ['A','B','C','D'];
  const activeGroups_ps = groups_ps.filter(g => {
    const gM2 = plots_ps.filter(p=>(p.group||'A')===g)
      .reduce((s,p)=>s+(parseFloat(String(p.areaM2||'').replace(/,/g,''))||0),0);
    return gM2 > 0;
  });
  const groupLandAmts_ps = {};
  activeGroups_ps.forEach(g => {
    const gM2 = plots_ps.filter(p=>(p.group||'A')===g)
      .reduce((s,p)=>s+(parseFloat(String(p.areaM2||'').replace(/,/g,''))||0),0);
    const gPy = gM2 * 0.3025;
    const gd  = landGroupData_ps[g] || {};
    const gPyPrice  = parseAmt(gd.pyPrice);
    const gCalcAmt  = Math.round(gPyPrice * gPy);
    const gOverride = parseAmt(gd.override);
    groupLandAmts_ps[g] = gOverride > 0 ? gOverride : gCalcAmt;
  });
  let landAmt;
  if (activeGroups_ps.length > 0) {
    landAmt = activeGroups_ps.reduce((s,g)=>s+groupLandAmts_ps[g], 0);
  } else {
    const pyPrice_ps = parseAmt(landData?.landPyPrice);
    const calcL_ps   = Math.round(pyPrice_ps * totalPy_ps);
    const ovLand_ps  = parseAmt(landData?.landOverride);
    landAmt = ovLand_ps > 0 ? ovLand_ps : calcL_ps;
  }
  const acqAmt = landData?.acqTaxOverride
    ? parseAmt(landData.acqTaxOverride)
    : Math.round(landAmt * (parseFloat(landData?.acqTaxRate??'4.6')||0) / 100);
  const bondPublic = plots_ps.reduce((s,p)=>s+(parseFloat(String(p.totalPrice||'').replace(/,/g,''))||0),0);
  const bondAmt    = landData?.bondOverride
    ? parseAmt(landData.bondOverride)
    : Math.round(bondPublic * (parseFloat(landData?.bondBuyRate??'50')||0) / 1000 * (parseFloat(landData?.bondDiscRate??'13.5')||0) / 100 / 1000);
  const legalDirect = parseAmt(landData?.legalDirect);
  const legalAmt    = legalDirect > 0 ? legalDirect : Math.round(landAmt * (parseFloat(landData?.legalRate??'0.3')||0) / 100);
  const agentGroupRates_ps = landData?.agentGroupRates || {};
  const agentMode_ps = landData?.agentMode || 'rate';
  let agentAmt = 0;
  if (agentMode_ps === 'rate' && activeGroups_ps.length > 0) {
    activeGroups_ps.forEach(g => {
      const rate = parseFloat(agentGroupRates_ps[g] ?? '0.5') || 0;
      agentAmt += Math.round(groupLandAmts_ps[g] * rate / 100);
    });
  } else {
    agentAmt = parseAmt(landData?.agentDirect);
  }

  // ── 토지매입비 분할 (계약금/중도금/잔금) ──
  const depositPct = parseFloat(d.deposit_pct ?? '10') || 10;
  const midPct     = parseFloat(d.mid_pct     ?? '0')  || 0;
  const balancePct = Math.max(0, 100 - depositPct - midPct);

  const depositAmt = Math.round(landAmt * depositPct / 100);
  const midAmt     = Math.round(landAmt * midPct     / 100);
  const balanceAmt = landAmt - depositAmt - midAmt;

  // 지급월 (착공 기준 상대월로 저장, 표시는 절대 YM)
  const depositRel = d.deposit_rel ?? '-2';
  const midRel     = d.mid_rel     ?? '-1';
  const balanceRel = d.balance_rel ?? '-1';
  const acqRel     = d.acq_rel     ?? '-1';
  const bondRel    = d.bond_rel    ?? '-1';
  const legalRel   = d.legal_rel   ?? '-1';
  const agentRel   = d.agent_rel   ?? '-1';

  // ── 토지매입비: 한 행에 계약금/중도금/잔금 표시 ──
  // 각 분할금액을 해당 월 셀에 표시
  const landPayments = [
    { rel: depositRel, amt: depositAmt, label: `계약금 ${depositPct}%`, relKey: 'deposit_rel' },
    ...(midPct > 0 ? [{ rel: midRel, amt: midAmt, label: `중도금 ${midPct}%`, relKey: 'mid_rel' }] : []),
    { rel: balanceRel, amt: balanceAmt, label: `잔금 ${balancePct}%`, relKey: 'balance_rel' },
  ];

  // ── 다른 항목 행 ──
  const otherRows = [
    ...(acqAmt  >0?[{ key:'acq',   label:'② 취득세',           rel:acqRel,   relKey:'acq_rel',   amt:acqAmt   }]:[]),
    ...(bondAmt >0?[{ key:'bond',  label:'③ 국민주택채권할인', rel:bondRel,  relKey:'bond_rel',  amt:bondAmt  }]:[]),
    ...(legalAmt>0?[{ key:'legal', label:'④ 법무사/등기비',    rel:legalRel, relKey:'legal_rel', amt:legalAmt }]:[]),
    ...(agentAmt>0?[{ key:'agent', label:'⑤ 중개수수료',       rel:agentRel, relKey:'agent_rel', amt:agentAmt }]:[]),
    ...(landData?.etcItems||[]).filter(it=>parseAmt(it.amt)>0).map((it,i)=>({
      key:`etc_${i}`, label:`기타 ${it.name||''}`, rel:d[`etc_rel_${i}`]??'0', relKey:`etc_rel_${i}`, amt:parseAmt(it.amt)
    })),
  ];

  // ── 월별 합계 계산 ──
  const monthTotals = {};
  const vatTotals   = {};

  // taxable 매핑 (landData)
  const landTaxableMap = {
    land:  !!landData?.land_taxable,
    acq:   !!landData?.acq_taxable,
    bond:  !!landData?.bond_taxable,
    legal: !!landData?.legal_taxable,
    agent: !!landData?.agent_taxable,
  };
  (landData?.etcItems||[]).forEach((it,i) => { landTaxableMap[`etc_${i}`] = !!it.taxable; });

  // 토지매입비 (과세 여부 반영)
  landPayments.forEach(p => {
    const ym = relToYM(p.rel);
    if (months.includes(ym)) {
      monthTotals[ym] = (monthTotals[ym]||0) + p.amt;
      if (landTaxableMap.land) vatTotals[ym] = (vatTotals[ym]||0) + Math.round(p.amt * 0.1);
    }
  });
  // 기타 항목
  otherRows.forEach(r => {
    const ym = relToYM(r.rel);
    if (months.includes(ym)) {
      monthTotals[ym] = (monthTotals[ym]||0) + r.amt;
      if (landTaxableMap[r.key]) vatTotals[ym] = (vatTotals[ym]||0) + Math.round(r.amt * 0.1);
    }
  });
  const landTotalVat = Object.values(vatTotals).reduce((s,v)=>s+v,0);
  // categoryMonthly 누적 (항상 실행 - isOpen 무관)

  const grandTotal = landAmt + acqAmt + bondAmt + legalAmt + agentAmt +
    (landData?.etcItems||[]).reduce((s,it)=>s+parseAmt(it.amt),0);

  // ── 스타일 ──
  const thS = { padding:'5px 6px', fontSize:'11px', fontWeight:'bold', textAlign:'center', whiteSpace:'nowrap', color:'white' };
  const tdS = { padding:'5px 6px', borderBottom:'1px solid #eee', fontSize:'11px', verticalAlign:'middle' };
  const CAT_COLOR = '#546e7a';

  // 상대월 입력 셀
  const relInputCell = (relKey, relVal) => (
    <div style={{ display:'flex', alignItems:'center', gap:'2px', justifyContent:'center' }}>
      <span style={{ fontSize:'10px', color:'#888' }}>착공</span>
      <input value={d[relKey] ?? relVal}
        onChange={e => update(relKey, e.target.value)}
        style={{ width:'36px', padding:'2px 3px', border:'1px solid #ccc', borderRadius:'3px', fontSize:'11px', textAlign:'center' }} />
      <span style={{ fontSize:'10px', color:'#888' }}>M</span>
    </div>
  );

  return (
    <div>
      {/* ── 섹션별 크로스체크 팝업 ── */}
      {crossCheckSection && (() => {
        const fmtCC = (v) => Math.round(v).toLocaleString('ko-KR');
        const chk = (a, b) => Math.abs(a - b) < 2 ? '✅' : '❌';
        const parseAmt2 = (v) => parseFloat(String(v||'').replace(/,/g,''))||0;

        // 월별 합계 합산 헬퍼
        const sumMonthly = (obj) => Object.values(obj||{}).reduce((s,v)=>s+v,0);

        // 섹션별 항목 정의
        const getSectionItems = () => {
          if (crossCheckSection === 'land') {
            const plots = archData?.plots||[];
            const totalM2 = plots.reduce((s,p)=>s+(parseFloat(String(p.areaM2||'').replace(/,/g,''))||0),0);
            const totalPy = totalM2 * 0.3025;
            const pyPrice = parseAmt2(landData?.landPyPrice);
            const calcL   = Math.round(pyPrice * totalPy);
            const landAmt = parseAmt2(landData?.landOverride)>0 ? parseAmt2(landData.landOverride) : calcL;
            const acqAmt  = landData?.acqTaxOverride ? parseAmt2(landData.acqTaxOverride)
              : Math.round(landAmt*(parseFloat(landData?.acqTaxRate??'4.6')||0)/100);
            const bondPublic = plots.reduce((s,p)=>s+(parseFloat(String(p.totalPrice||'').replace(/,/g,''))||0),0);
            const bondAmt = landData?.bondOverride ? parseAmt2(landData.bondOverride)
              : Math.round(bondPublic*(parseFloat(landData?.bondBuyRate??'50')||0)/1000*(parseFloat(landData?.bondDiscRate??'13.5')||0)/100/1000);
            const legalAmt = parseAmt2(landData?.legalDirect)>0 ? parseAmt2(landData.legalDirect)
              : Math.round(landAmt*(parseFloat(landData?.legalRate??'0.3')||0)/100);
            const agentAmt = parseAmt2(landData?.agentDirect)>0 ? parseAmt2(landData.agentDirect)
              : Math.round(landAmt*(parseFloat(landData?.agentRate??'0.5')||0)/100);
            const etcItems = (landData?.etcItems||[]).filter(it=>parseAmt2(it.amt)>0);
            // 지급패턴 항목별 합계 — land는 개별 항목 키로 추적이 어려워 전체 합계로 비교
            const pmtTotal = sumMonthly(mp.land||{});
            const pmtVat   = sumMonthly(mp.landVat||{});
            const srcTotal = landAmt + acqAmt + bondAmt + legalAmt + agentAmt + etcItems.reduce((s,it)=>s+parseAmt2(it.amt),0);
            const srcVat   = Math.round(
              (!!landData?.land_taxable?landAmt*0.1:0)+(!!landData?.acq_taxable?acqAmt*0.1:0)+
              (!!landData?.bond_taxable?bondAmt*0.1:0)+(!!landData?.legal_taxable?legalAmt*0.1:0)+
              (!!landData?.agent_taxable?agentAmt*0.1:0)+
              etcItems.reduce((s,it)=>s+(!!it.taxable?parseAmt2(it.amt)*0.1:0),0));
            return {
              title: '🏗 토지관련비용',
              color: '#546e7a',
              items: [
                { label:'① 토지매입비', src: landAmt, taxable: !!landData?.land_taxable },
                { label:'② 취득세',     src: acqAmt,  taxable: !!landData?.acq_taxable  },
                { label:'③ 국민주택채권할인', src: bondAmt, taxable: !!landData?.bond_taxable },
                { label:'④ 법무사/등기비',   src: legalAmt, taxable: !!landData?.legal_taxable },
                { label:'⑤ 중개수수료',      src: agentAmt, taxable: !!landData?.agent_taxable },
                ...etcItems.map((it,i)=>({ label:`기타 ${it.name||''}`, src:parseAmt2(it.amt), taxable:!!it.taxable })),
              ].filter(it=>it.src>0),
              srcTotal, pmtTotal, srcVat, pmtVat,
              note: '※ 토지관련비용은 항목별 지급시점이 월 단위로 분산되어 전체 합계로 비교합니다.',
            };
          }

          if (crossCheckSection === 'direct') {
            const directAmt = directResult?.total || 0;
            const pmtTotal  = sumMonthly(mp.direct||{});
            const pmtVat    = sumMonthly(mp.directVat||{});
            const srcVat    = !!directData?.const_taxable ? Math.round(directAmt*0.1) : 0;
            return {
              title: '🏗 직접공사비',
              color: '#37474f',
              items: [{ label:'직접공사비 (공정율 배분)', src: directAmt, taxable: !!directData?.const_taxable }],
              srcTotal: directAmt, pmtTotal, srcVat, pmtVat,
              note: '※ 직접공사비는 공정율에 따라 월별 배분됩니다.',
            };
          }

          if (crossCheckSection === 'indirect') {
            const { permitAmt=0, demolAmt=0, utilAmt=0, artAmt=0, etcItems:indEtc=[] } = indirectResult||{};
            const srcTotal = indirectResult?.total || 0;
            const pmtTotal = sumMonthly(mp.indirect||{});
            const pmtVat   = sumMonthly(mp.indirectVat||{});
            const taxMap = {permit:!!indirectData?.permit_taxable,demol:!!indirectData?.demol_taxable,
              util:!!indirectData?.util_taxable,art:!!indirectData?.art_taxable};
            (indirectData?.etcItems||[]).forEach((it,i)=>{taxMap[`etc_${i}`]=!!it.taxable;});
            const srcVat = Math.round(
              (taxMap.permit?permitAmt*0.1:0)+(taxMap.demol?demolAmt*0.1:0)+
              (taxMap.util?utilAmt*0.1:0)+(taxMap.art?artAmt*0.1:0)+
              (indEtc||[]).reduce((s,it,i)=>s+(taxMap[`etc_${i}`]?parseAmt2(it.amt)*0.1:0),0));
            return {
              title: '🏗 간접공사비',
              color: '#4a6572',
              items: [
                { label:'① 인허가비',    src: permitAmt, taxable: taxMap.permit },
                { label:'② 철거비',      src: demolAmt,  taxable: taxMap.demol  },
                { label:'③ 각종부담금', src: utilAmt,   taxable: taxMap.util   },
                { label:'④ 미술작품',   src: artAmt,    taxable: taxMap.art    },
                ...(indEtc||[]).filter(it=>parseAmt2(it.amt)>0).map((it,i)=>({
                  label:`기타 ${it.name||''}`, src:parseAmt2(it.amt), taxable:taxMap[`etc_${i}`]
                })),
              ].filter(it=>it.src>0),
              srcTotal, pmtTotal, srcVat, pmtVat,
            };
          }

          if (crossCheckSection === 'consult') {
            const { designAmt=0, superAmt=0, cmAmt=0, assessAmt=0, interiorAmt=0, etcItems:conEtc=[] } = consultResult||{};
            const srcTotal = consultResult?.total || 0;
            const pmtTotal = sumMonthly(mp.consult||{});
            const pmtVat   = sumMonthly(mp.consultVat||{});
            const taxMap = {design:!!consultData?.design_taxable,super:!!consultData?.super_taxable,
              cm:!!consultData?.cm_taxable,assess:!!consultData?.assess_taxable,interior:!!consultData?.interior_taxable};
            (consultData?.etcItems||[]).forEach((it,i)=>{taxMap[`etc_${i}`]=!!it.taxable;});
            const srcVat = Math.round(
              (taxMap.design?designAmt*0.1:0)+(taxMap.super?superAmt*0.1:0)+
              (taxMap.cm?cmAmt*0.1:0)+(taxMap.assess?assessAmt*0.1:0)+(taxMap.interior?interiorAmt*0.1:0)+
              (conEtc||[]).reduce((s,it,i)=>s+(taxMap[`etc_${i}`]?parseAmt2(it.amt)*0.1:0),0));
            return {
              title: '📐 용역비',
              color: '#1565c0',
              items: [
                { label:'① 설계비',          src: designAmt,   taxable: taxMap.design   },
                { label:'② 감리비',          src: superAmt,    taxable: taxMap.super    },
                { label:'③ CM비',            src: cmAmt,       taxable: taxMap.cm       },
                { label:'④ 각종 영향평가비', src: assessAmt,   taxable: taxMap.assess   },
                { label:'⑤ 인테리어설계비', src: interiorAmt, taxable: taxMap.interior },
                ...(conEtc||[]).filter(it=>parseAmt2(it.amt)>0).map((it,i)=>({
                  label:`기타 ${it.name||''}`, src:parseAmt2(it.amt), taxable:taxMap[`etc_${i}`]
                })),
              ].filter(it=>it.src>0),
              srcTotal, pmtTotal, srcVat, pmtVat,
            };
          }

          if (crossCheckSection === 'sales') {
            const { mhRentAmt=0, mhInstAmt=0, mhOperAmt=0, adAmt=0,
                    agentAptAmt2=0, agentOffiAmt2=0, agentStoreAmt2=0,
                    hugAmt2=0, etcItems:salEtc=[] } = salesCostResult||{};
            const srcTotal = salesCostResult?.total || 0;
            const pmtTotal = sumMonthly(mp.sales||{});
            const pmtVat   = sumMonthly(mp.salesVat||{});
            const taxMap = {mhRent:!!salesCostData?.mhRent_taxable,mhInst:!!salesCostData?.mhInst_taxable,
              mhOper:!!salesCostData?.mhOper_taxable,ad:!!salesCostData?.ad_taxable,
              agentApt:!!salesCostData?.agentApt_taxable,agentOffi:!!salesCostData?.agentOffi_taxable,
              agentStore:!!salesCostData?.agentStore_taxable,hug:!!salesCostData?.hug_taxable};
            (salesCostData?.etcItems||[]).forEach((it,i)=>{taxMap[`etc_${i}`]=!!it.taxable;});
            const agentTotal = agentAptAmt2 + agentOffiAmt2 + agentStoreAmt2;
            const srcVat = Math.round(
              (taxMap.mhRent?mhRentAmt*0.1:0)+(taxMap.mhInst?mhInstAmt*0.1:0)+
              (taxMap.mhOper?mhOperAmt*0.1:0)+(taxMap.ad?adAmt*0.1:0)+
              (taxMap.agentApt?agentAptAmt2*0.1:0)+(taxMap.agentOffi?agentOffiAmt2*0.1:0)+
              (taxMap.agentStore?agentStoreAmt2*0.1:0)+(taxMap.hug?hugAmt2*0.1:0)+
              (salEtc||[]).reduce((s,it,i)=>s+(taxMap[`etc_${i}`]?parseAmt2(it.amt)*0.1:0),0));
            return {
              title: '📢 판매비',
              color: '#6a1b9a',
              items: [
                { label:'모델하우스 임차비', src: mhRentAmt,   taxable: taxMap.mhRent    },
                { label:'모델하우스 설치비', src: mhInstAmt,   taxable: taxMap.mhInst    },
                { label:'모델하우스 운영비', src: mhOperAmt,   taxable: taxMap.mhOper    },
                { label:'광고비',            src: adAmt,        taxable: taxMap.ad        },
                { label:'분양대행수수료(APT)',  src: agentAptAmt2,   taxable: taxMap.agentApt   },
                { label:'분양대행수수료(오피)', src: agentOffiAmt2,  taxable: taxMap.agentOffi  },
                { label:'분양대행수수료(상가)', src: agentStoreAmt2, taxable: taxMap.agentStore },
                { label:'HUG 분양보증수수료',  src: hugAmt2,    taxable: taxMap.hug       },
                ...(salEtc||[]).filter(it=>parseAmt2(it.amt)>0).map((it,i)=>({
                  label:`기타 ${it.name||''}`, src:parseAmt2(it.amt), taxable:taxMap[`etc_${i}`]
                })),
              ].filter(it=>it.src>0),
              srcTotal, pmtTotal, srcVat, pmtVat,
            };
          }

          if (crossCheckSection === 'tax') {
            const { transAmt=0, gasAmt=0, waterAmt=0, sewerAmt=0, bondBuildAmt=0,
                    schoolAmt=0, regAmt=0, propTaxAmt=0, compTaxAmt=0, etcItems:taxEtc=[] } = taxResult||{};
            const srcTotal = taxResult?.total || 0;
            const pmtTotal = sumMonthly(mp.tax||{});
            const pmtVat   = sumMonthly(mp.taxVat||{});
            const taxMap = {trans:!!taxData?.trans_taxable,gas:!!taxData?.gas_taxable,
              water:!!taxData?.water_taxable,sewer:!!taxData?.sewer_taxable,
              bondBuild:!!taxData?.bondBuild_taxable,school:!!taxData?.school_taxable,
              reg:!!taxData?.reg_taxable,propTax:false,compTax:false};
            (taxData?.etcItems||[]).forEach((it,i)=>{taxMap[`etc_${i}`]=!!it.taxable;});
            const srcVat = Math.round(
              (taxMap.trans?transAmt*0.1:0)+(taxMap.gas?gasAmt*0.1:0)+
              (taxMap.water?waterAmt*0.1:0)+(taxMap.sewer?sewerAmt*0.1:0)+
              (taxMap.bondBuild?bondBuildAmt*0.1:0)+(taxMap.school?schoolAmt*0.1:0)+
              (taxMap.reg?regAmt*0.1:0)+
              (taxEtc||[]).reduce((s,it,i)=>s+(taxMap[`etc_${i}`]?parseAmt2(it.amt)*0.1:0),0));
            return {
              title: '📋 제세금',
              color: '#004d40',
              items: [
                { label:'① 보존등기비',               src: regAmt,       taxable: taxMap.reg       },
                { label:'② 광역교통시설부담금',       src: transAmt,     taxable: taxMap.trans     },
                { label:'③ 학교용지부담금',           src: schoolAmt,    taxable: taxMap.school    },
                { label:'④ 도시가스시설분담금',       src: gasAmt,       taxable: taxMap.gas       },
                { label:'⑤ 상수도원인자부담금',       src: waterAmt,     taxable: taxMap.water     },
                { label:'⑥ 하수도원인자부담금',       src: sewerAmt,     taxable: taxMap.sewer     },
                { label:'⑦ 건축허가 국민주택채권할인', src: bondBuildAmt, taxable: taxMap.bondBuild },
                { label:'⑧ 재산세',                   src: propTaxAmt,   taxable: false            },
                { label:'⑨ 종합부동산세',             src: compTaxAmt,   taxable: false            },
                ...(taxEtc||[]).filter(it=>parseAmt2(it.amt)>0).map((it,i)=>({
                  label:`기타 ${it.name||''}`, src:parseAmt2(it.amt), taxable:taxMap[`etc_${i}`]
                })),
              ].filter(it=>it.src>0),
              srcTotal, pmtTotal, srcVat, pmtVat,
            };
          }

          if (crossCheckSection === 'overhead') {
            const { trustAmt=0, operAmt=0, moveAmt=0, reserveAmt=0, etcItems:ovrEtc=[] } = overheadResult||{};
            const srcTotal = overheadResult?.total || 0;
            const pmtTotal = sumMonthly(mp.overhead||{});
            const pmtVat   = sumMonthly(mp.overheadVat||{});
            const taxMap = {trust:!!overheadData?.trust_taxable,oper:!!overheadData?.oper_taxable,
              move:!!overheadData?.move_taxable,reserve:!!overheadData?.reserve_taxable};
            (overheadData?.etcItems||[]).forEach((it,i)=>{taxMap[`etc_${i}`]=!!it.taxable;});
            const srcVat = Math.round(
              (taxMap.trust?trustAmt*0.1:0)+(taxMap.oper?operAmt*0.1:0)+
              (taxMap.move?moveAmt*0.1:0)+(taxMap.reserve?reserveAmt*0.1:0)+
              (ovrEtc||[]).reduce((s,it,i)=>s+(taxMap[`etc_${i}`]?parseAmt2(it.amt)*0.1:0),0));
            return {
              title: '🏢 부대비',
              color: '#bf360c',
              items: [
                { label:'신탁보수',   src: trustAmt,   taxable: taxMap.trust   },
                { label:'운영비',     src: operAmt,    taxable: taxMap.oper    },
                { label:'이사비',     src: moveAmt,    taxable: taxMap.move    },
                { label:'예비비',     src: reserveAmt, taxable: taxMap.reserve },
                ...(ovrEtc||[]).filter(it=>parseAmt2(it.amt)>0).map((it,i)=>({
                  label:`기타 ${it.name||''}`, src:parseAmt2(it.amt), taxable:taxMap[`etc_${i}`]
                })),
              ].filter(it=>it.src>0),
              srcTotal, pmtTotal, srcVat, pmtVat,
            };
          }
          return null;
        };

        const sec = getSectionItems();
        if (!sec) return null;
        const totalOk  = chk(sec.srcTotal, sec.pmtTotal);
        const vatOk    = sec.srcVat > 0 ? chk(sec.srcVat, sec.pmtVat) : null;
        const overallOk = totalOk === '✅' && (vatOk === null || vatOk === '✅') ? '✅' : '❌';

        const thS2 = (bg='#2c3e50') => ({ padding:'7px 10px', textAlign:'right', fontWeight:'bold', color:'white', backgroundColor:bg, fontSize:'11px', whiteSpace:'nowrap' });
        const tdS2 = { padding:'6px 10px', textAlign:'right', fontSize:'12px', borderBottom:'1px solid #f0f0f0', whiteSpace:'nowrap' };

        return (
          <div style={{ position:'fixed', top:0, left:0, width:'100vw', height:'100vh',
            backgroundColor:'rgba(0,0,0,0.55)', zIndex:4000, display:'flex', alignItems:'center', justifyContent:'center' }}>
            <div style={{ backgroundColor:'white', borderRadius:'10px', width:'92%', maxWidth:'720px',
              maxHeight:'88vh', overflowY:'auto', padding:'24px', boxShadow:'0 8px 40px rgba(0,0,0,0.3)' }}>

              {/* 헤더 */}
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'16px' }}>
                <div>
                  <h3 style={{ margin:0, color: sec.color }}>{sec.title} 크로스체크</h3>
                  <div style={{ fontSize:'11px', color:'#888', marginTop:'4px' }}>
                    세부항목탭 금액 ↔ 지급패턴 배분 합계 — 허용오차 ±2천원
                  </div>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
                  <span style={{ fontSize:'22px' }}>{overallOk}</span>
                  <button onClick={() => setCrossCheckSection(null)}
                    style={{ padding:'6px 14px', border:'1px solid #ddd', borderRadius:'6px', cursor:'pointer', fontSize:'13px' }}>
                    ✕ 닫기
                  </button>
                </div>
              </div>

              {/* 항목별 테이블 */}
              <table style={{ borderCollapse:'collapse', width:'100%', fontSize:'12px', marginBottom:'12px' }}>
                <thead>
                  <tr>
                    <th style={{ ...thS2(sec.color), textAlign:'left', minWidth:'160px' }}>항목</th>
                    <th style={{ ...thS2('#2980b9') }}>세부항목탭 (천원)</th>
                    <th style={{ ...thS2('#16a085') }}>지급패턴 합계 (천원)</th>
                    <th style={{ ...thS2('#e65100'), width:'50px' }}>일치</th>
                  </tr>
                </thead>
                <tbody>
                  {sec.items.map((it, i) => {
                    // 항목별 지급패턴 합계는 전체 합계 기준 (개별 추적 불가)
                    // 항목이 1개면 전체 pmt, 여러 개면 원천 기준으로 비율 표시
                    const bg = i%2===0 ? 'white' : '#f8f9fa';
                    return (
                      <tr key={i} style={{ backgroundColor: bg }}>
                        <td style={{ ...tdS2, textAlign:'left', fontWeight:'bold', color:'#2c3e50' }}>
                          {it.label}
                          {it.taxable && <span style={{ fontSize:'10px', color:'#e74c3c', marginLeft:'6px',
                            backgroundColor:'#fde8d8', padding:'1px 5px', borderRadius:'8px' }}>과세</span>}
                        </td>
                        <td style={{ ...tdS2, color:'#2980b9', fontWeight:'bold' }}>{fmtCC(it.src)}</td>
                        <td style={{ ...tdS2, color:'#aaa', textAlign:'center' }}>—</td>
                        <td style={{ ...tdS2, textAlign:'center' }}>—</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* 합계 비교 박스 */}
              <div style={{ backgroundColor:'#f8f9fa', borderRadius:'8px', padding:'16px', border:'1px solid #e0e0e0' }}>
                <div style={{ fontWeight:'bold', fontSize:'13px', color:'#2c3e50', marginBottom:'12px' }}>📊 합계 비교</div>

                {/* 공급금액 */}
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 50px', gap:'0', marginBottom:'4px' }}>
                  <div style={{ padding:'8px 10px', backgroundColor:sec.color, color:'white', fontWeight:'bold', fontSize:'12px', borderRadius:'4px 0 0 4px' }}>
                    공급금액 합계
                  </div>
                  <div style={{ padding:'8px 10px', backgroundColor:'#ebf5fb', color:'#2980b9', fontWeight:'bold', fontSize:'13px', textAlign:'right', border:'1px solid #bee3f8' }}>
                    {fmtCC(sec.srcTotal)} 천원
                    <div style={{ fontSize:'10px', color:'#888', fontWeight:'normal' }}>세부항목탭</div>
                  </div>
                  <div style={{ padding:'8px 10px', backgroundColor:'#eafaf1', color:'#16a085', fontWeight:'bold', fontSize:'13px', textAlign:'right', border:'1px solid #a9dfbf' }}>
                    {fmtCC(sec.pmtTotal)} 천원
                    <div style={{ fontSize:'10px', color:'#888', fontWeight:'normal' }}>지급패턴 합계</div>
                  </div>
                  <div style={{ padding:'8px', textAlign:'center', fontSize:'18px', display:'flex', alignItems:'center', justifyContent:'center',
                    backgroundColor: totalOk==='✅'?'#eafaf1':'#fdecea', border:'1px solid #ddd', borderRadius:'0 4px 4px 0' }}>
                    {totalOk}
                  </div>
                </div>
                {totalOk === '❌' && (
                  <div style={{ fontSize:'11px', color:'#e74c3c', textAlign:'right', marginBottom:'4px', padding:'2px 8px' }}>
                    차이: {fmtCC(Math.abs(sec.srcTotal - sec.pmtTotal))} 천원
                  </div>
                )}

                {/* VAT */}
                {sec.srcVat > 0 && (
                  <>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 50px', gap:'0', marginTop:'6px' }}>
                      <div style={{ padding:'8px 10px', backgroundColor:'#e67e22', color:'white', fontWeight:'bold', fontSize:'12px', borderRadius:'4px 0 0 4px' }}>
                        VAT 합계
                      </div>
                      <div style={{ padding:'8px 10px', backgroundColor:'#fef9e7', color:'#d35400', fontWeight:'bold', fontSize:'13px', textAlign:'right', border:'1px solid #fad7a0' }}>
                        {fmtCC(sec.srcVat)} 천원
                        <div style={{ fontSize:'10px', color:'#888', fontWeight:'normal' }}>세부항목탭</div>
                      </div>
                      <div style={{ padding:'8px 10px', backgroundColor:'#fef9e7', color:'#d35400', fontWeight:'bold', fontSize:'13px', textAlign:'right', border:'1px solid #fad7a0' }}>
                        {fmtCC(sec.pmtVat)} 천원
                        <div style={{ fontSize:'10px', color:'#888', fontWeight:'normal' }}>지급패턴 합계</div>
                      </div>
                      <div style={{ padding:'8px', textAlign:'center', fontSize:'18px', display:'flex', alignItems:'center', justifyContent:'center',
                        backgroundColor: vatOk==='✅'?'#eafaf1':'#fdecea', border:'1px solid #ddd', borderRadius:'0 4px 4px 0' }}>
                        {vatOk}
                      </div>
                    </div>
                    {vatOk === '❌' && (
                      <div style={{ fontSize:'11px', color:'#e74c3c', textAlign:'right', marginTop:'2px', padding:'2px 8px' }}>
                        차이: {fmtCC(Math.abs(sec.srcVat - sec.pmtVat))} 천원
                      </div>
                    )}
                  </>
                )}
                {sec.srcVat === 0 && (
                  <div style={{ fontSize:'11px', color:'#aaa', marginTop:'6px', textAlign:'right' }}>VAT: 전체 면세</div>
                )}
              </div>

              {sec.note && (
                <div style={{ marginTop:'10px', fontSize:'11px', color:'#888', fontStyle:'italic' }}>{sec.note}</div>
              )}

              <div style={{ marginTop:'10px', fontSize:'11px', color:'#888', display:'flex', gap:'16px' }}>
                <span style={{ color:'#2980b9' }}>■ 세부항목탭: 각 항목 계산값</span>
                <span style={{ color:'#16a085' }}>■ 지급패턴: monthlyPayments 합산</span>
              </div>
            </div>
          </div>
        );
      })()}

      {/* 사업기간 요약 */}
      <div style={{ display:'flex', gap:'16px', marginBottom:'14px', padding:'10px 16px', backgroundColor:'#f8f9fa', borderRadius:'8px', flexWrap:'wrap', fontSize:'12px' }}>
        <div>📅 사업시작: <strong>{fmtYM(bizStart.year, bizStart.month)}</strong></div>
        <div>착공: <strong>{conYM}</strong> (준비 {prepPeriod}개월)</div>
        <div>공사: <strong>{constructPeriod}개월</strong></div>
        <div>정산: <strong>{settlePeriod}개월</strong></div>
        <div>전체: <strong>{totalPeriod}개월</strong></div>
        <div style={{ color:'#888', fontSize:'11px' }}>
          ※ 지급월 설정: 착공 기준 상대월 (-2M = 착공 2개월 전, 0 = 착공월, +1M = 착공 다음달)
        </div>
      </div>

      {/* 토지관련비용 */}
      <div style={{ marginBottom:'28px' }}>
        <div onClick={() => toggleSection('land')}
          style={{ fontWeight:'bold', fontSize:'14px', color:CAT_COLOR, marginBottom: openSections.land?'10px':'0',
            paddingBottom:'5px', borderBottom:`2px solid ${CAT_COLOR}`, cursor:'pointer',
            display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <span>🏗 토지관련비용 지급패턴</span>
          <div style={{ display:'flex', gap:'8px', alignItems:'center', fontSize:'12px', fontWeight:'normal' }}>
            <span style={{ color:'#555', fontSize:'11px' }}>
                  공급가 <strong style={{ color:CAT_COLOR }}>{formatNumber(grandTotal)}</strong>
                  {landTotalVat > 0 && <span style={{ color:'#e67e22', marginLeft:'6px' }}>VAT <strong>{formatNumber(landTotalVat)}</strong></span>}
                  <span style={{ marginLeft:'6px', opacity:0.6 }}>천원</span>
                </span>
            <button onClick={e=>{e.stopPropagation();setCrossCheckSection('land');}}
              style={{ padding:'3px 10px', backgroundColor:'#8e44ad', color:'white', border:'none', borderRadius:'4px', cursor:'pointer', fontSize:'11px', fontWeight:'bold', whiteSpace:'nowrap' }}>
              🔍 체크
            </button>
            <span>{openSections.land ? '▲ 접기' : '▼ 펼치기'}</span>
          </div>
        </div>
        {openSections.land && <>

        {/* 토지매입비 분할 설정 */}
        <div style={{ display:'flex', gap:'12px', alignItems:'center', marginBottom:'10px', flexWrap:'wrap', padding:'8px 12px', backgroundColor:'#f5f6f7', borderRadius:'6px', fontSize:'12px' }}>
          <span style={{ fontWeight:'bold', color:CAT_COLOR }}>① 토지매입비 분할:</span>
          {[
            { label:'계약금', pctKey:'deposit_pct', relKey:'deposit_rel', relVal:depositRel, pct:depositPct },
            ...(midPct > 0 || d.show_mid ? [{ label:'중도금', pctKey:'mid_pct', relKey:'mid_rel', relVal:midRel, pct:midPct }] : []),
            { label:'잔금', pct:balancePct, readonly:true, relKey:'balance_rel', relVal:balanceRel },
          ].map((item, i) => (
            <div key={i} style={{ display:'flex', alignItems:'center', gap:'4px' }}>
              <span style={{ color:'#555' }}>{item.label}:</span>
              {item.readonly
                ? <span style={{ fontWeight:'bold', color:CAT_COLOR }}>{item.pct}%</span>
                : <input value={d[item.pctKey] ?? String(item.pct)} onChange={e=>update(item.pctKey, e.target.value)}
                    style={{ width:'45px', padding:'2px 5px', border:`1px solid ${CAT_COLOR}`, borderRadius:'3px', fontSize:'12px', textAlign:'right', color:CAT_COLOR, fontWeight:'bold' }} />
              }
              {!item.readonly && <span style={{ color:'#888' }}>%</span>}
              <span style={{ color:'#888', fontSize:'11px', marginLeft:'2px' }}>@ 착공</span>
              <input value={d[item.relKey] ?? item.relVal} onChange={e=>update(item.relKey, e.target.value)}
                style={{ width:'36px', padding:'2px 3px', border:'1px solid #ccc', borderRadius:'3px', fontSize:'11px', textAlign:'center' }} />
              <span style={{ color:'#888', fontSize:'11px' }}>M</span>
            </div>
          ))}
          <button onClick={() => update('show_mid', !d.show_mid)}
            style={{ padding:'2px 8px', fontSize:'11px', backgroundColor: d.show_mid||midPct>0 ? '#e74c3c' : '#27ae60',
              color:'white', border:'none', borderRadius:'3px', cursor:'pointer' }}>
            {d.show_mid||midPct>0 ? '중도금 제거' : '+ 중도금 추가'}
          </button>
        </div>

        <div style={{ overflowX:'auto' }}>
          <table style={{ borderCollapse:'collapse', fontSize:'11px', minWidth:'100%' }}>
            <thead>
              <tr style={{ backgroundColor:'#2c3e50' }}>
                <th style={{ ...thS, textAlign:'left', minWidth:'180px', position:'sticky', left:0, backgroundColor:'#2c3e50', zIndex:2 }}>항목</th>
                <th style={{ ...thS, minWidth:'100px' }}>금액(천원)</th>
                {months.map(ym => (
                  <th key={ym} style={{ ...thS, minWidth:'76px',
                    backgroundColor: (ym===conYM||ym===compYM) ? '#c0392b' : '#455a64' }}>
                    {ym}
                    <div style={{ fontSize:'9px', fontWeight:'normal', opacity:0.8 }}>{relLabel(ym)}</div>
                  </th>
                ))}
                <th style={{ ...thS, minWidth:'90px' }}>합계</th>
              </tr>
            </thead>
            <tbody>
              {/* 토지매입비 — 한 행, 분할금 각 해당 월에 표시 */}
              <tr style={{ backgroundColor:'#f5f6f7' }}>
                <td style={{ ...tdS, fontWeight:'bold', color:CAT_COLOR, position:'sticky', left:0, backgroundColor:'#f5f6f7', zIndex:1 }}>
                  ① 토지매입비
                  <div style={{ fontSize:'10px', color:'#888', fontWeight:'normal' }}>
                    {landPayments.map(p=>`${p.label}(${fmtYM(...relToYM(p.rel).split('.').map(Number))})`).join(' / ')}
                  </div>
                </td>
                <td style={{ ...tdS, textAlign:'right', fontWeight:'bold', color:CAT_COLOR }}>{formatNumber(landAmt)}</td>
                {months.map(ym => {
                  const pays = landPayments.filter(p => relToYM(p.rel) === ym);
                  const total = pays.reduce((s,p)=>s+p.amt, 0);
                  return (
                    <td key={ym} style={{ ...tdS, textAlign:'right', padding:'3px 5px',
                      backgroundColor: total > 0 ? '#f0f0f0' : 'transparent' }}>
                      {total > 0
                        ? <div>
                            <div style={{ fontWeight:'bold', color:CAT_COLOR }}>{formatNumber(total)}</div>
                            {pays.map((p,i)=><div key={i} style={{ fontSize:'9px', color:'#888' }}>{p.label}</div>)}
                          </div>
                        : <span style={{ color:'#ddd' }}>—</span>}
                    </td>
                  );
                })}
                <td style={{ ...tdS, textAlign:'right', fontWeight:'bold', color:CAT_COLOR }}>{formatNumber(landAmt)}</td>
              </tr>

              {/* 기타 항목들 */}
              {otherRows.map((row, i) => {
                const payYM = relToYM(row.rel);
                return (
                  <tr key={row.key} style={{ backgroundColor: i%2===0?'white':'#f9f9f9' }}>
                    <td style={{ ...tdS, fontWeight:'bold', color:CAT_COLOR, position:'sticky', left:0, backgroundColor:i%2===0?'white':'#f9f9f9', zIndex:1 }}>
                      {row.label}
                      <div style={{ marginTop:'2px' }}>{relInputCell(row.relKey, row.rel)}</div>
                    </td>
                    <td style={{ ...tdS, textAlign:'right', fontWeight:'bold' }}>{formatNumber(row.amt)}</td>
                    {months.map(ym => {
                      const isPay = payYM === ym;
                      return (
                        <td key={ym} style={{ ...tdS, textAlign:'right',
                          backgroundColor: isPay ? '#f0f0f0' : 'transparent',
                          fontWeight: isPay ? 'bold' : 'normal',
                          color: isPay ? CAT_COLOR : '#ccc' }}>
                          {isPay ? formatNumber(row.amt) : '—'}
                        </td>
                      );
                    })}
                    <td style={{ ...tdS, textAlign:'right', fontWeight:'bold', color:CAT_COLOR }}>{formatNumber(row.amt)}</td>
                  </tr>
                );
              })}

              {/* 월별 합계 */}
              <tr style={{ backgroundColor:CAT_COLOR }}>
                <td style={{ padding:'6px 8px', color:'white', fontWeight:'bold', fontSize:'12px', position:'sticky', left:0, backgroundColor:CAT_COLOR, zIndex:1 }}>월별 합계</td>
                <td style={{ padding:'6px 8px', color:'white', fontWeight:'bold', textAlign:'right' }}>{formatNumber(grandTotal)}</td>
                {months.map(ym => (
                  <td key={ym} style={{ padding:'6px 6px', textAlign:'right', color:'white', fontWeight:'bold', fontSize:'11px' }}>
                    {monthTotals[ym] ? formatNumber(monthTotals[ym]) : '—'}
                  </td>
                ))}
                <td style={{ padding:'6px 8px', color:'white', fontWeight:'bold', textAlign:'right' }}>{formatNumber(grandTotal)}</td>
              </tr>
              {renderVatRows(monthTotals, vatTotals, grandTotal, landTotalVat, CAT_COLOR, months, formatNumber, taxRatioVAT)}
            </tbody>
          </table>
        </div>
        <div style={{ marginTop:'8px', fontSize:'11px', color:'#888' }}>
          💡 지급월: 착공 기준 상대월 입력 (-2 = 착공 2개월 전, -1 = 착공 1개월 전, 0 = 착공월, 1 = 착공 다음달)
        </div>
        </>}
      </div>

      {/* ── 직접공사비 ── */}
      {(() => {
        const CAT_COLOR = '#546e7a';
        const directAmt = directResult?.total || 0;

        // 공정율 테이블 (기준정보 → 없으면 DEFAULT)
        const progressTable = (settingsData?.progressRates && Object.keys(settingsData.progressRates).length > 0)
          ? settingsData.progressRates
          : DEFAULT_PROGRESS_TABLE;
        const conPeriod = Math.round(constructPeriod);
        const baseRates = progressTable[conPeriod] || DEFAULT_PROGRESS_TABLE[conPeriod] || [];

        // 준공불 설정
        const retainPct  = parseFloat(d.direct_retain_pct  ?? '0') || 0;  // 준공불 %
        const retainRel  = d.direct_retain_rel ?? String(Math.round(constructPeriod) + 1); // 준공 후 몇달
        const retainAmt  = Math.round(directAmt * retainPct / 100);
        const workingAmt = directAmt - retainAmt;  // 공사중 지급분

        // 월별 지급액 계산 (공정율 × 공사중지급분)
        // 공정율 합계가 100%가 안될 수 있으므로 정규화
        const rateSum = baseRates.reduce((s, r) => s + Math.max(0, r), 0);
        const monthlyAmts = baseRates.map(r =>
          rateSum > 0 ? Math.round(workingAmt * Math.max(0, r) / rateSum) : 0
        );
        // 반올림 오차 보정 (마지막 월에 추가)
        const calcSum = monthlyAmts.reduce((s, v) => s + v, 0);
        if (monthlyAmts.length > 0) monthlyAmts[monthlyAmts.length - 1] += (workingAmt - calcSum);

        // 착공월부터 공사기간만큼의 YM 목록
        const conMonths = Array.from({ length: conPeriod }, (_, i) => {
          const ym = addMonths(constructYear, constructMonth, i);
          return fmtYM(ym.year, ym.month);
        });

        // 준공불 지급 YM
        const retainYM = relToYM(parseInt(retainRel));

        // 월별 합계 (지급패턴 전체 months 기준)
        const directIsTaxable = !!directData?.const_taxable;
        const directMonthTotals = {};
        const directVatTotals   = {};
        conMonths.forEach((ym, i) => {
          if (months.includes(ym) && monthlyAmts[i] > 0) {
            directMonthTotals[ym] = (directMonthTotals[ym]||0) + monthlyAmts[i];
            if (directIsTaxable) directVatTotals[ym] = (directVatTotals[ym]||0) + Math.round(monthlyAmts[i] * 0.1);
          }
        });
        if (retainAmt > 0 && months.includes(retainYM)) {
          directMonthTotals[retainYM] = (directMonthTotals[retainYM]||0) + retainAmt;
          if (directIsTaxable) directVatTotals[retainYM] = (directVatTotals[retainYM]||0) + Math.round(retainAmt * 0.1);
        }
        const directTotalVat = Object.values(directVatTotals).reduce((s,v)=>s+v,0);

        const isOpen = openSections['direct'] !== false;

        return (
          <div style={{ marginBottom:'28px' }}>
            {/* 헤더 */}
            <div onClick={() => toggleSection('direct')}
              style={{ fontWeight:'bold', fontSize:'14px', color:CAT_COLOR, marginBottom: isOpen?'10px':'0',
                paddingBottom:'5px', borderBottom:`2px solid ${CAT_COLOR}`, cursor:'pointer',
                display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span>🏗 직접공사비 지급패턴</span>
              <div style={{ display:'flex', gap:'8px', alignItems:'center', fontSize:'12px', fontWeight:'normal' }}>
                <span style={{ color:'#555', fontSize:'11px' }}>
                  공급가 <strong style={{ color:CAT_COLOR }}>{formatNumber(directAmt)}</strong>
                  {directTotalVat > 0 && <span style={{ color:'#e67e22', marginLeft:'6px' }}>VAT <strong>{formatNumber(directTotalVat)}</strong></span>}
                  <span style={{ marginLeft:'6px', opacity:0.6 }}>천원</span>
                </span>
                <button onClick={e=>{e.stopPropagation();setCrossCheckSection('direct');}}
                  style={{ padding:'3px 10px', backgroundColor:'#8e44ad', color:'white', border:'none', borderRadius:'4px', cursor:'pointer', fontSize:'11px', fontWeight:'bold', whiteSpace:'nowrap' }}>
                  🔍 체크
                </button>
                <span>{isOpen ? '▲ 접기' : '▼ 펼치기'}</span>
              </div>
            </div>

            {isOpen && (
              <>
                {/* 준공불 설정 */}
                <div style={{ display:'flex', gap:'12px', alignItems:'center', marginBottom:'10px',
                  flexWrap:'wrap', padding:'8px 12px', backgroundColor:'#f5f6f7', borderRadius:'6px', fontSize:'12px' }}>
                  <span style={{ fontWeight:'bold', color:CAT_COLOR }}>준공불 설정:</span>
                  <div style={{ display:'flex', alignItems:'center', gap:'4px' }}>
                    <span style={{ color:'#555' }}>준공불</span>
                    <input value={d.direct_retain_pct??'0'} onChange={e=>update('direct_retain_pct',e.target.value)}
                      style={{ width:'45px', padding:'2px 5px', border:`1px solid ${CAT_COLOR}`, borderRadius:'3px',
                        fontSize:'12px', textAlign:'right', color:CAT_COLOR, fontWeight:'bold' }} />
                    <span style={{ color:'#555' }}>%</span>
                  </div>
                  {retainPct > 0 && (
                    <div style={{ display:'flex', alignItems:'center', gap:'4px' }}>
                      <span style={{ color:'#555' }}>지급시기: 착공</span>
                      <input value={d.direct_retain_rel ?? String(Math.round(constructPeriod)+1)}
                        onChange={e=>update('direct_retain_rel',e.target.value)}
                        style={{ width:'40px', padding:'2px 4px', border:'1px solid #ccc', borderRadius:'3px', fontSize:'11px', textAlign:'center' }} />
                      <span style={{ color:'#555' }}>M ({retainYM})</span>
                      <span style={{ color:CAT_COLOR, fontWeight:'bold', marginLeft:'4px' }}>{formatNumber(retainAmt)}천원</span>
                    </div>
                  )}
                  <span style={{ fontSize:'11px', color:'#888' }}>
                    공사중 지급: {formatNumber(workingAmt)}천원 ({100-retainPct}%)
                    / 공정율: {conPeriod}개월 기준정보 자동적용
                  </span>
                </div>

                {/* 월별 공정율 + 지급액 테이블 */}
                <div style={{ overflowX:'auto' }}>
                  <table style={{ borderCollapse:'collapse', fontSize:'11px', minWidth:'100%' }}>
                    <thead>
                      <tr style={{ backgroundColor:'#2c3e50' }}>
                        <th style={{ ...thS, textAlign:'left', minWidth:'140px', position:'sticky', left:0, backgroundColor:'#2c3e50', zIndex:2 }}>항목</th>
                        <th style={{ ...thS, minWidth:'100px' }}>금액(천원)</th>
                        {months.map(ym => (
                          <th key={ym} style={{ ...thS, minWidth:'72px',
                            backgroundColor: (ym===conYM||ym===compYM) ? '#c0392b' : '#455a64' }}>
                            {ym}
                            <div style={{ fontSize:'9px', fontWeight:'normal', opacity:0.8 }}>{relLabel(ym)}</div>
                          </th>
                        ))}
                        <th style={{ ...thS, minWidth:'90px' }}>합계</th>
                      </tr>
                    </thead>
                    <tbody>
                      {/* 공사비 (공정율 지급) */}
                      <tr style={{ backgroundColor:'#f5f6f7' }}>
                        <td style={{ ...tdS, fontWeight:'bold', color:CAT_COLOR, position:'sticky', left:0, backgroundColor:'#f5f6f7', zIndex:1 }}>
                          직접공사비
                          {retainPct > 0 && <div style={{ fontSize:'10px', color:'#888' }}>공사중 {100-retainPct}%</div>}
                        </td>
                        <td style={{ ...tdS, textAlign:'right', fontWeight:'bold', color:CAT_COLOR }}>{formatNumber(workingAmt)}</td>
                        {months.map(ym => {
                          const idx = conMonths.indexOf(ym);
                          const amt = idx >= 0 ? monthlyAmts[idx] : 0;
                          const rate = idx >= 0 ? baseRates[idx] : 0;
                          return (
                            <td key={ym} style={{ ...tdS, textAlign:'right', padding:'3px 4px',
                              backgroundColor: amt > 0 ? '#f5f6f7' : 'transparent' }}>
                              {amt > 0
                                ? <div>
                                    <div style={{ fontWeight:'bold', color:CAT_COLOR }}>{formatNumber(amt)}</div>
                                    <div style={{ fontSize:'9px', color:'#888' }}>{(rate*100).toFixed(1)}%</div>
                                  </div>
                                : <span style={{ color:'#ddd' }}>—</span>}
                            </td>
                          );
                        })}
                        <td style={{ ...tdS, textAlign:'right', fontWeight:'bold', color:CAT_COLOR }}>{formatNumber(workingAmt)}</td>
                      </tr>

                      {/* 준공불 */}
                      {retainPct > 0 && (
                        <tr style={{ backgroundColor:'#f5f6f7' }}>
                          <td style={{ ...tdS, fontWeight:'bold', color:'#546e7a', position:'sticky', left:0, backgroundColor:'#f5f6f7', zIndex:1 }}>
                            준공불 ({retainPct}%)
                            <div style={{ fontSize:'10px', color:'#888' }}>{retainYM} 지급</div>
                          </td>
                          <td style={{ ...tdS, textAlign:'right', fontWeight:'bold', color:'#546e7a' }}>{formatNumber(retainAmt)}</td>
                          {months.map(ym => {
                            const isPay = ym === retainYM;
                            return (
                              <td key={ym} style={{ ...tdS, textAlign:'right',
                                backgroundColor: isPay ? '#f5f6f7' : 'transparent',
                                fontWeight: isPay ? 'bold' : 'normal',
                                color: isPay ? '#546e7a' : '#ddd' }}>
                                {isPay ? formatNumber(retainAmt) : '—'}
                              </td>
                            );
                          })}
                          <td style={{ ...tdS, textAlign:'right', fontWeight:'bold', color:'#546e7a' }}>{formatNumber(retainAmt)}</td>
                        </tr>
                      )}

                      {/* 월별 합계 */}
                      <tr style={{ backgroundColor:CAT_COLOR }}>
                        <td style={{ padding:'6px 8px', color:'white', fontWeight:'bold', position:'sticky', left:0, backgroundColor:CAT_COLOR, zIndex:1 }}>월별 합계</td>
                        <td style={{ padding:'5px 6px', color:'white', fontWeight:'bold', textAlign:'right' }}>{formatNumber(directAmt)}</td>
                        {months.map(ym => (
                          <td key={ym} style={{ padding:'5px 6px', textAlign:'right', color:'white', fontWeight:'bold', fontSize:'11px' }}>
                            {directMonthTotals[ym] ? formatNumber(directMonthTotals[ym]) : '—'}
                          </td>
                        ))}
                        <td style={{ padding:'5px 6px', color:'white', fontWeight:'bold', textAlign:'right' }}>{formatNumber(directAmt)}</td>
                      </tr>
                      {renderVatRows(directMonthTotals, directVatTotals, directAmt, directTotalVat, CAT_COLOR, months, formatNumber, taxRatioVAT)}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        );
      })()}

      {/* ── 간접공사비 ── */}
      {(() => {
        const CAT_COLOR = '#546e7a';
        const BG_LIGHT  = '#f5f6f7';
        const indAmt = indirectResult?.total || 0;

        const { permitAmt=0, demolAmt=0, utilAmt=0, artAmt=0, etcItems: indEtcItems=[] } = indirectResult || {};

        // N회 분할 헬퍼: 지급 스케줄 계산
        // splits = [{rel, pct}] (마지막 pct는 잔여 자동)
        const calcSplitPayments = (itemKey, amt, defN=1) => {
          const n = parseInt(d[`${itemKey}_n`] || defN) || 1;
          const splits = [];
          let pctSum = 0;
          for (let i = 0; i < n; i++) {
            const rel = parseInt(d[`${itemKey}_rel_${i}`] || '0') || 0;
            const isLast = i === n - 1;
            const pct = isLast
              ? Math.max(0, 100 - pctSum)
              : parseFloat(d[`${itemKey}_pct_${i}`] || String(Math.round(100/n))) || 0;
            if (!isLast) pctSum += pct;
            splits.push({ rel, pct, amt: isLast ? amt - Math.round(amt * pctSum / 100) : Math.round(amt * pct / 100) });
          }
          return splits;
        };

        // 항목 정의: mode='split'=N회분할, mode='single'=일시
        const indItemDefs = [
          { key:'permit', label:'① 인허가조건공사비', amt: permitAmt, mode:'split', defN:1 },
          { key:'demol',  label:'② 철거공사비',       amt: demolAmt, mode:'single', defRel:'-2' },
          { key:'util',   label:'③ 각종인입비',       amt: utilAmt,  mode:'split', defN:1 },
          { key:'art',    label:'④ 미술장식품',       amt: artAmt,   mode:'split', defN:1 },
          ...indEtcItems.filter(it=>parseAmt(it.amt)>0).map((it,i)=>({
            key:`etc_${i}`, label:`기타 ${it.name||''}`, amt: parseAmt(it.amt), mode:'single', defRel:'0'
          })),
        ].filter(it => it.amt > 0);

        // taxable 여부 매핑 (indirectData에서)
        const indTaxableMap = {
          permit: !!indirectData?.permit_taxable,
          demol:  !!indirectData?.demol_taxable,
          util:   !!indirectData?.util_taxable,
          art:    !!indirectData?.art_taxable,
        };
        (indirectData?.etcItems||[]).forEach((it,i) => { indTaxableMap[`etc_${i}`] = !!it.taxable; });

        // 월별 합계
        const indMonthTotals = {};
        const indVatTotals   = {};
        indItemDefs.forEach(it => {
          const isTaxable = indTaxableMap[it.key] || false;
          if (it.mode === 'split') {
            const splits = calcSplitPayments(`ind_${it.key}`, it.amt, it.defN);
            splits.forEach(sp => {
              const ym = relToYM(sp.rel);
              if (months.includes(ym)) {
                indMonthTotals[ym] = (indMonthTotals[ym]||0) + sp.amt;
                if (isTaxable) indVatTotals[ym] = (indVatTotals[ym]||0) + Math.round(sp.amt * 0.1);
              }
            });
          } else {
            const ym = relToYM(parseInt(d[`ind_rel_${it.key}`] ?? it.defRel) || 0);
            if (months.includes(ym)) {
              indMonthTotals[ym] = (indMonthTotals[ym]||0) + it.amt;
              if (isTaxable) indVatTotals[ym] = (indVatTotals[ym]||0) + Math.round(it.amt * 0.1);
            }
          }
        });
        const indTotalVat = Object.values(indVatTotals).reduce((s,v)=>s+v,0);

        // N회 분할 입력 UI
        const splitInputUI = (itemKey, amt, defN=1, CAT) => {
          const n = parseInt(d[`${itemKey}_n`] || defN) || 1;
          const splits = calcSplitPayments(itemKey, amt, defN);
          const pctSum = splits.slice(0,-1).reduce((s,sp)=>s+sp.pct,0);
          const lastPct = Math.max(0, 100 - pctSum);
          return (
            <div style={{ marginTop:'4px' }}>
              {/* 회수 입력 */}
              <div style={{ display:'flex', alignItems:'center', gap:'4px', marginBottom:'4px' }}>
                <input
                  type="number" min="1" max="10"
                  value={d[`${itemKey}_n`] || defN}
                  onChange={e => update(`${itemKey}_n`, e.target.value)}
                  style={{ width:'36px', padding:'2px 4px', border:'1px solid #bbb', borderRadius:'3px', fontSize:'11px', textAlign:'center' }}
                />
                <span style={{ fontSize:'10px', color:'#888' }}>회 분할</span>
              </div>
              {/* 회차별 입력 */}
              {splits.map((sp, i) => {
                const isLast = i === n - 1;
                return (
                  <div key={i} style={{ display:'flex', alignItems:'center', gap:'3px', marginBottom:'2px' }}>
                    <span style={{ fontSize:'10px', color:'#999', width:'16px' }}>{i+1}.</span>
                    <span style={{ fontSize:'10px', color:'#888' }}>착공</span>
                    <input
                      value={d[`${itemKey}_rel_${i}`] ?? '0'}
                      onChange={e => update(`${itemKey}_rel_${i}`, e.target.value)}
                      style={{ width:'34px', padding:'2px 3px', border:'1px solid #ccc', borderRadius:'3px', fontSize:'11px', textAlign:'center' }}
                    />
                    <span style={{ fontSize:'10px', color:'#888' }}>M</span>
                    {isLast ? (
                      <span style={{ fontSize:'10px', color:CAT, fontWeight:'bold', minWidth:'36px', textAlign:'right' }}>{lastPct.toFixed(0)}%</span>
                    ) : (
                      <input
                        value={d[`${itemKey}_pct_${i}`] ?? String(Math.round(100/n))}
                        onChange={e => update(`${itemKey}_pct_${i}`, e.target.value)}
                        style={{ width:'34px', padding:'2px 3px', border:'1px solid #ccc', borderRadius:'3px', fontSize:'11px', textAlign:'center' }}
                      />
                    )}
                    {!isLast && <span style={{ fontSize:'10px', color:'#888' }}>%</span>}
                    <span style={{ fontSize:'10px', color:'#aaa', marginLeft:'2px' }}>({formatNumber(sp.amt)})</span>
                  </div>
                );
              })}
            </div>
          );
        };

        const isOpen = openSections['indirect'] !== false;
        return (
          <div style={{ marginBottom:'28px' }}>
            <div onClick={() => toggleSection('indirect')}
              style={{ fontWeight:'bold', fontSize:'14px', color:CAT_COLOR, marginBottom: isOpen?'10px':'0',
                paddingBottom:'5px', borderBottom:`2px solid ${CAT_COLOR}`, cursor:'pointer',
                display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span>🏗 간접공사비 지급패턴</span>
              <div style={{ display:'flex', gap:'8px', alignItems:'center', fontSize:'12px', fontWeight:'normal' }}>
                <span style={{ color:'#555', fontSize:'11px' }}>
                  공급가 <strong style={{ color:CAT_COLOR }}>{formatNumber(indAmt)}</strong>
                  {indTotalVat > 0 && <span style={{ color:'#e67e22', marginLeft:'6px' }}>VAT <strong>{formatNumber(indTotalVat)}</strong></span>}
                  <span style={{ marginLeft:'6px', opacity:0.6 }}>천원</span>
                </span>
                <button onClick={e=>{e.stopPropagation();setCrossCheckSection('indirect');}}
                  style={{ padding:'3px 10px', backgroundColor:'#8e44ad', color:'white', border:'none', borderRadius:'4px', cursor:'pointer', fontSize:'11px', fontWeight:'bold', whiteSpace:'nowrap' }}>
                  🔍 체크
                </button>
                <span>{isOpen ? '▲ 접기' : '▼ 펼치기'}</span>
              </div>
            </div>
            {isOpen && (
              <div style={{ overflowX:'auto' }}>
                <table style={{ borderCollapse:'collapse', fontSize:'11px', minWidth:'100%' }}>
                  <thead>
                    <tr style={{ backgroundColor:'#455a64' }}>
                      <th style={{ ...thS, textAlign:'left', minWidth:'220px', position:'sticky', left:0, backgroundColor:'#455a64', zIndex:2 }}>항목</th>
                      <th style={{ ...thS, minWidth:'100px' }}>금액(천원)</th>
                      {months.map(ym => (
                        <th key={ym} style={{ ...thS, minWidth:'72px', backgroundColor: (ym===conYM||ym===compYM)?'#c0392b':'#455a64' }}>
                          {ym}<div style={{ fontSize:'9px', fontWeight:'normal', opacity:0.8 }}>{relLabel(ym)}</div>
                        </th>
                      ))}
                      <th style={{ ...thS, minWidth:'90px' }}>합계</th>
                    </tr>
                  </thead>
                  <tbody>
                    {indItemDefs.map((it, i) => {
                      const rowBg = i%2===0 ? 'white' : BG_LIGHT;
                      if (it.mode === 'split') {
                        const splits = calcSplitPayments(`ind_${it.key}`, it.amt, it.defN);
                        const rowPays = {};
                        splits.forEach(sp => { rowPays[relToYM(sp.rel)] = (rowPays[relToYM(sp.rel)]||0) + sp.amt; });
                        return (
                          <tr key={it.key} style={{ backgroundColor: rowBg }}>
                            <td style={{ ...tdS, fontWeight:'bold', color:CAT_COLOR, position:'sticky', left:0, backgroundColor:rowBg, zIndex:1, verticalAlign:'top' }}>
                              {it.label}
                              {splitInputUI(`ind_${it.key}`, it.amt, it.defN, CAT_COLOR)}
                            </td>
                            <td style={{ ...tdS, textAlign:'right', fontWeight:'bold', color:CAT_COLOR, verticalAlign:'top' }}>{formatNumber(it.amt)}</td>
                            {months.map(ym => {
                              const amt = rowPays[ym] || 0;
                              return (
                                <td key={ym} style={{ ...tdS, textAlign:'right',
                                  backgroundColor: amt>0 ? BG_LIGHT : 'transparent',
                                  fontWeight: amt>0?'bold':'normal', color: amt>0?CAT_COLOR:'#ccc' }}>
                                  {amt>0 ? formatNumber(amt) : '—'}
                                </td>
                              );
                            })}
                            <td style={{ ...tdS, textAlign:'right', fontWeight:'bold', color:CAT_COLOR }}>{formatNumber(it.amt)}</td>
                          </tr>
                        );
                      } else {
                        const rel   = d[`ind_rel_${it.key}`] ?? it.defRel;
                        const payYM = relToYM(parseInt(rel)||0);
                        return (
                          <tr key={it.key} style={{ backgroundColor: rowBg }}>
                            <td style={{ ...tdS, fontWeight:'bold', color:CAT_COLOR, position:'sticky', left:0, backgroundColor:rowBg, zIndex:1 }}>
                              {it.label}
                              <div style={{ marginTop:'2px' }}>{relInputCell(`ind_rel_${it.key}`, rel)}</div>
                            </td>
                            <td style={{ ...tdS, textAlign:'right', fontWeight:'bold', color:CAT_COLOR }}>{formatNumber(it.amt)}</td>
                            {months.map(ym => {
                              const isPay = payYM===ym;
                              return (
                                <td key={ym} style={{ ...tdS, textAlign:'right',
                                  backgroundColor: isPay?BG_LIGHT:'transparent',
                                  fontWeight: isPay?'bold':'normal', color: isPay?CAT_COLOR:'#ccc' }}>
                                  {isPay ? formatNumber(it.amt) : '—'}
                                </td>
                              );
                            })}
                            <td style={{ ...tdS, textAlign:'right', fontWeight:'bold', color:CAT_COLOR }}>{formatNumber(it.amt)}</td>
                          </tr>
                        );
                      }
                    })}
                    <tr style={{ backgroundColor:CAT_COLOR }}>
                      <td style={{ padding:'6px 8px', color:'white', fontWeight:'bold', position:'sticky', left:0, backgroundColor:CAT_COLOR, zIndex:1 }}>월별 합계</td>
                      <td style={{ padding:'5px 6px', color:'white', fontWeight:'bold', textAlign:'right' }}>{formatNumber(indAmt)}</td>
                      {months.map(ym => (
                        <td key={ym} style={{ padding:'5px 6px', textAlign:'right', color:'white', fontWeight:'bold', fontSize:'11px' }}>
                          {indMonthTotals[ym] ? formatNumber(indMonthTotals[ym]) : '—'}
                        </td>
                      ))}
                      <td style={{ padding:'5px 6px', color:'white', fontWeight:'bold', textAlign:'right' }}>{formatNumber(indAmt)}</td>
                    </tr>
                    {renderVatRows(indMonthTotals, indVatTotals, indAmt, indTotalVat, CAT_COLOR, months, formatNumber, taxRatioVAT)}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })()}

      {/* ── 용역비 ── */}
      {(() => {
        const CAT_COLOR = '#546e7a';
        const BG_LIGHT  = '#f5f6f7';
        const consultAmt = consultResult?.total || 0;

        // result에서 직접 꺼내기 (재계산 없음)
        const { designAmt=0, superAmt=0, cmAmt=0, assessAmt=0, interiorAmt=0, etcItems: conEtcItems=[] } = consultResult || {};


        // 항목 정의: split=N회분할, range=균등, single=일시
        const conItemDefs = [
          { key:'design',   label:'① 설계비',           amt: designAmt,   mode:'split', defN:2 },
          { key:'super',    label:'② 감리비',           amt: superAmt,    mode:'range', defStart:'0', defEnd:String(Math.round(constructPeriod)) },
          { key:'cm',       label:'③ CM비',             amt: cmAmt,       mode:'range', defStart:'-6', defEnd:String(Math.round(constructPeriod)) },
          { key:'assess',   label:'④ 각종 영향평가비', amt: assessAmt,   mode:'split', defN:1 },
          { key:'interior', label:'⑤ 인테리어설계비',  amt: interiorAmt, mode:'split', defN:1 },
          ...conEtcItems.filter(it=>parseAmt(it.amt)>0).map((it,i)=>({
            key:`etc_${i}`, label:`기타 ${it.name||''}`, amt: parseAmt(it.amt), mode:'single', defRel:'0'
          })),
        ].filter(it => it.amt > 0);

        // split 헬퍼 (간접공사비와 동일 로직, prefix만 다름)
        const calcConSplit = (itemKey, amt, defN=1) => {
          const n = parseInt(d[`${itemKey}_n`] || defN) || 1;
          const splits = [];
          let pctSum = 0;
          for (let i = 0; i < n; i++) {
            const rel = parseInt(d[`${itemKey}_rel_${i}`] || '0') || 0;
            const isLast = i === n - 1;
            const pct = isLast
              ? Math.max(0, 100 - pctSum)
              : parseFloat(d[`${itemKey}_pct_${i}`] || String(Math.round(100/n))) || 0;
            if (!isLast) pctSum += pct;
            splits.push({ rel, pct, amt: isLast ? amt - Math.round(amt * pctSum / 100) : Math.round(amt * pct / 100) });
          }
          return splits;
        };

        // taxable 매핑 (consultData)
        const conTaxableMap = {
          design:   !!consultData?.design_taxable,
          super:    !!consultData?.super_taxable,
          cm:       !!consultData?.cm_taxable,
          assess:   !!consultData?.assess_taxable,
          interior: !!consultData?.interior_taxable,
        };
        (consultData?.etcItems||[]).forEach((it,i) => { conTaxableMap[`etc_${i}`] = !!it.taxable; });

        // 월별 합계
        const consultMonthTotals = {};
        const consultVatTotals   = {};
        conItemDefs.forEach(it => {
          const isTaxable = conTaxableMap[it.key] || false;
          const addVat = (ym, amt) => { if (isTaxable && months.includes(ym)) consultVatTotals[ym] = (consultVatTotals[ym]||0) + Math.round(amt * 0.1); };
          if (it.mode === 'split') {
            calcConSplit(`con_${it.key}`, it.amt, it.defN).forEach(sp => {
              const ym = relToYM(sp.rel);
              if (months.includes(ym)) { consultMonthTotals[ym] = (consultMonthTotals[ym]||0) + sp.amt; addVat(ym, sp.amt); }
            });
          } else if (it.mode === 'range') {
            const sR = parseInt((d[`con_rel_${it.key}_start`] ?? it.defStart) || '0');
            const eR = parseInt((d[`con_rel_${it.key}_end`]   ?? it.defEnd)   || '0');
            const len = Math.max(1, eR - sR + 1);
            const mo  = Math.round(it.amt / len);
            for (let r = sR; r <= eR; r++) {
              const ym = relToYM(r);
              if (months.includes(ym)) {
                const adj = r===eR ? it.amt - mo*(len-1) : mo;
                consultMonthTotals[ym] = (consultMonthTotals[ym]||0) + adj;
                addVat(ym, adj);
              }
            }
          } else {
            const ym = relToYM(parseInt(d[`con_rel_${it.key}`] ?? it.defRel) || 0);
            if (months.includes(ym)) { consultMonthTotals[ym] = (consultMonthTotals[ym]||0) + it.amt; addVat(ym, it.amt); }
          }
        });
        const consultTotalVat = Object.values(consultVatTotals).reduce((s,v)=>s+v,0);

        // split UI (간접공사비와 동일, prefix=con_)
        const conSplitUI = (itemKey, amt, defN=1) => {
          const n = parseInt(d[`${itemKey}_n`] || defN) || 1;
          const splits = calcConSplit(itemKey, amt, defN);
          const pctSum = splits.slice(0,-1).reduce((s,sp)=>s+sp.pct,0);
          const lastPct = Math.max(0, 100 - pctSum);
          return (
            <div style={{ marginTop:'4px' }}>
              <div style={{ display:'flex', alignItems:'center', gap:'4px', marginBottom:'4px' }}>
                <input type="number" min="1" max="10"
                  value={d[`${itemKey}_n`] || defN}
                  onChange={e => update(`${itemKey}_n`, e.target.value)}
                  style={{ width:'36px', padding:'2px 4px', border:'1px solid #bbb', borderRadius:'3px', fontSize:'11px', textAlign:'center' }} />
                <span style={{ fontSize:'10px', color:'#888' }}>회 분할</span>
              </div>
              {splits.map((sp, i) => {
                const isLast = i === n - 1;
                return (
                  <div key={i} style={{ display:'flex', alignItems:'center', gap:'3px', marginBottom:'2px' }}>
                    <span style={{ fontSize:'10px', color:'#999', width:'16px' }}>{i+1}.</span>
                    <span style={{ fontSize:'10px', color:'#888' }}>착공</span>
                    <input value={d[`${itemKey}_rel_${i}`] ?? '0'}
                      onChange={e => update(`${itemKey}_rel_${i}`, e.target.value)}
                      style={{ width:'34px', padding:'2px 3px', border:'1px solid #ccc', borderRadius:'3px', fontSize:'11px', textAlign:'center' }} />
                    <span style={{ fontSize:'10px', color:'#888' }}>M</span>
                    {isLast
                      ? <span style={{ fontSize:'10px', color:CAT_COLOR, fontWeight:'bold', minWidth:'36px', textAlign:'right' }}>{lastPct.toFixed(0)}%</span>
                      : <input value={d[`${itemKey}_pct_${i}`] ?? String(Math.round(100/n))}
                          onChange={e => update(`${itemKey}_pct_${i}`, e.target.value)}
                          style={{ width:'34px', padding:'2px 3px', border:'1px solid #ccc', borderRadius:'3px', fontSize:'11px', textAlign:'center' }} />
                    }
                    {!isLast && <span style={{ fontSize:'10px', color:'#888' }}>%</span>}
                    <span style={{ fontSize:'10px', color:'#aaa', marginLeft:'2px' }}>({formatNumber(sp.amt)})</span>
                  </div>
                );
              })}
            </div>
          );
        };

        const isOpen = openSections['consult'] !== false;
        return (
          <div style={{ marginBottom:'28px' }}>
            <div onClick={() => toggleSection('consult')}
              style={{ fontWeight:'bold', fontSize:'14px', color:CAT_COLOR, marginBottom: isOpen?'10px':'0',
                paddingBottom:'5px', borderBottom:`2px solid ${CAT_COLOR}`, cursor:'pointer',
                display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span>📐 용역비 지급패턴</span>
              <div style={{ display:'flex', gap:'8px', alignItems:'center', fontSize:'12px', fontWeight:'normal' }}>
                <span style={{ color:'#555', fontSize:'11px' }}>
                  공급가 <strong style={{ color:CAT_COLOR }}>{formatNumber(consultAmt)}</strong>
                  {consultTotalVat > 0 && <span style={{ color:'#e67e22', marginLeft:'6px' }}>VAT <strong>{formatNumber(consultTotalVat)}</strong></span>}
                  <span style={{ marginLeft:'6px', opacity:0.6 }}>천원</span>
                </span>
                <button onClick={e=>{e.stopPropagation();setCrossCheckSection('consult');}}
                  style={{ padding:'3px 10px', backgroundColor:'#8e44ad', color:'white', border:'none', borderRadius:'4px', cursor:'pointer', fontSize:'11px', fontWeight:'bold', whiteSpace:'nowrap' }}>
                  🔍 체크
                </button>
                <span>{isOpen ? '▲ 접기' : '▼ 펼치기'}</span>
              </div>
            </div>
            {isOpen && (
              <div style={{ overflowX:'auto' }}>
                <table style={{ borderCollapse:'collapse', fontSize:'11px', minWidth:'100%' }}>
                  <thead>
                    <tr style={{ backgroundColor:'#455a64' }}>
                      <th style={{ ...thS, textAlign:'left', minWidth:'220px', position:'sticky', left:0, backgroundColor:'#455a64', zIndex:2 }}>항목</th>
                      <th style={{ ...thS, minWidth:'100px' }}>금액(천원)</th>
                      {months.map(ym => (
                        <th key={ym} style={{ ...thS, minWidth:'72px', backgroundColor: (ym===conYM||ym===compYM)?'#c0392b':'#455a64' }}>
                          {ym}<div style={{ fontSize:'9px', fontWeight:'normal', opacity:0.8 }}>{relLabel(ym)}</div>
                        </th>
                      ))}
                      <th style={{ ...thS, minWidth:'90px' }}>합계</th>
                    </tr>
                  </thead>
                  <tbody>
                    {conItemDefs.map((it, i) => {
                      const rowBg = i%2===0 ? 'white' : BG_LIGHT;
                      if (it.mode === 'split') {
                        const splits = calcConSplit(`con_${it.key}`, it.amt, it.defN);
                        const rowPays = {};
                        splits.forEach(sp => { rowPays[relToYM(sp.rel)] = (rowPays[relToYM(sp.rel)]||0) + sp.amt; });
                        return (
                          <tr key={it.key} style={{ backgroundColor: rowBg }}>
                            <td style={{ ...tdS, fontWeight:'bold', color:CAT_COLOR, position:'sticky', left:0, backgroundColor:rowBg, zIndex:1, verticalAlign:'top' }}>
                              {it.label}
                              {conSplitUI(`con_${it.key}`, it.amt, it.defN)}
                            </td>
                            <td style={{ ...tdS, textAlign:'right', fontWeight:'bold', color:CAT_COLOR, verticalAlign:'top' }}>{formatNumber(it.amt)}</td>
                            {months.map(ym => {
                              const amt = rowPays[ym] || 0;
                              return (
                                <td key={ym} style={{ ...tdS, textAlign:'right',
                                  backgroundColor: amt>0 ? BG_LIGHT : 'transparent',
                                  fontWeight: amt>0?'bold':'normal', color: amt>0?CAT_COLOR:'#ccc' }}>
                                  {amt>0 ? formatNumber(amt) : '—'}
                                </td>
                              );
                            })}
                            <td style={{ ...tdS, textAlign:'right', fontWeight:'bold', color:CAT_COLOR }}>{formatNumber(it.amt)}</td>
                          </tr>
                        );
                      } else if (it.mode === 'range') {
                        const sR  = parseInt((d[`con_rel_${it.key}_start`] ?? it.defStart) || '0');
                        const eR  = parseInt((d[`con_rel_${it.key}_end`]   ?? it.defEnd)   || '0');
                        const len = Math.max(1, eR - sR + 1);
                        const mo  = Math.round(it.amt / len);
                        const rowPays = {};
                        for (let r = sR; r <= eR; r++) rowPays[relToYM(r)] = r===eR ? it.amt - mo*(len-1) : mo;
                        return (
                          <tr key={it.key} style={{ backgroundColor: rowBg }}>
                            <td style={{ ...tdS, fontWeight:'bold', color:CAT_COLOR, position:'sticky', left:0, backgroundColor:rowBg, zIndex:1 }}>
                              {it.label}
                              <div style={{ marginTop:'3px', display:'flex', alignItems:'center', gap:'4px', flexWrap:'wrap' }}>
                                <span style={{ fontSize:'10px', color:'#888' }}>착공</span>
                                <input value={d[`con_rel_${it.key}_start`] ?? it.defStart}
                                  onChange={e=>update(`con_rel_${it.key}_start`, e.target.value)}
                                  style={{ width:'34px', padding:'2px 3px', border:'1px solid #ccc', borderRadius:'3px', fontSize:'11px', textAlign:'center' }} />
                                <span style={{ fontSize:'10px', color:'#888' }}>M ~</span>
                                <input value={d[`con_rel_${it.key}_end`] ?? it.defEnd}
                                  onChange={e=>update(`con_rel_${it.key}_end`, e.target.value)}
                                  style={{ width:'34px', padding:'2px 3px', border:'1px solid #ccc', borderRadius:'3px', fontSize:'11px', textAlign:'center' }} />
                                <span style={{ fontSize:'10px', color:'#888' }}>M 균등</span>
                              </div>
                            </td>
                            <td style={{ ...tdS, textAlign:'right', fontWeight:'bold', color:CAT_COLOR }}>{formatNumber(it.amt)}</td>
                            {months.map(ym => {
                              const amt = rowPays[ym] || 0;
                              return (
                                <td key={ym} style={{ ...tdS, textAlign:'right',
                                  backgroundColor: amt>0 ? BG_LIGHT : 'transparent',
                                  fontWeight: amt>0?'bold':'normal', color: amt>0?CAT_COLOR:'#ccc' }}>
                                  {amt>0 ? formatNumber(amt) : '—'}
                                </td>
                              );
                            })}
                            <td style={{ ...tdS, textAlign:'right', fontWeight:'bold', color:CAT_COLOR }}>{formatNumber(it.amt)}</td>
                          </tr>
                        );
                      } else {
                        const rel   = d[`con_rel_${it.key}`] ?? it.defRel;
                        const payYM = relToYM(parseInt(rel)||0);
                        return (
                          <tr key={it.key} style={{ backgroundColor: rowBg }}>
                            <td style={{ ...tdS, fontWeight:'bold', color:CAT_COLOR, position:'sticky', left:0, backgroundColor:rowBg, zIndex:1 }}>
                              {it.label}
                              <div style={{ marginTop:'2px' }}>{relInputCell(`con_rel_${it.key}`, rel)}</div>
                            </td>
                            <td style={{ ...tdS, textAlign:'right', fontWeight:'bold', color:CAT_COLOR }}>{formatNumber(it.amt)}</td>
                            {months.map(ym => {
                              const isPay = payYM===ym;
                              return (
                                <td key={ym} style={{ ...tdS, textAlign:'right',
                                  backgroundColor: isPay?BG_LIGHT:'transparent',
                                  fontWeight: isPay?'bold':'normal', color: isPay?CAT_COLOR:'#ccc' }}>
                                  {isPay ? formatNumber(it.amt) : '—'}
                                </td>
                              );
                            })}
                            <td style={{ ...tdS, textAlign:'right', fontWeight:'bold', color:CAT_COLOR }}>{formatNumber(it.amt)}</td>
                          </tr>
                        );
                      }
                    })}
                    <tr style={{ backgroundColor:CAT_COLOR }}>
                      <td style={{ padding:'6px 8px', color:'white', fontWeight:'bold', position:'sticky', left:0, backgroundColor:CAT_COLOR, zIndex:1 }}>월별 합계</td>
                      <td style={{ padding:'5px 6px', color:'white', fontWeight:'bold', textAlign:'right' }}>{formatNumber(consultAmt)}</td>
                      {months.map(ym => (
                        <td key={ym} style={{ padding:'5px 6px', textAlign:'right', color:'white', fontWeight:'bold', fontSize:'11px' }}>
                          {consultMonthTotals[ym] ? formatNumber(consultMonthTotals[ym]) : '—'}
                        </td>
                      ))}
                      <td style={{ padding:'5px 6px', color:'white', fontWeight:'bold', textAlign:'right' }}>{formatNumber(consultAmt)}</td>
                    </tr>
                    {renderVatRows(consultMonthTotals, consultVatTotals, consultAmt, consultTotalVat, CAT_COLOR, months, formatNumber, taxRatioVAT)}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })()}

      {/* ── 판매비 ── */}
      {(() => {
        const CAT_COLOR = '#546e7a';
        const BG_LIGHT  = '#f5f6f7';
        const salesAmt = salesCostResult?.total || 0;

        // result에서 직접 꺼내기 (재계산 없음)
        const { mhRentAmt=0, mhInstAmt=0, mhOperAmt=0, adAmt=0,
                agentAptAmt2=0, agentOffiAmt2=0, agentStoreAmt2=0, hugAmt2=0,
                salesPeriod=0, etcItems: salEtcItems=[] } = salesCostResult || {};

        // ── 분양일정 연동 ──
        const prepPeriod_ = parseFloat(String(archData?.prepPeriod||'').replace(/,/g,''))||0;
        const conPrd_     = Math.round(constructPeriod);
        const totalMonths_= Math.ceil(prepPeriod_ + conPrd_ + (parseFloat(String(archData?.settlePeriod||'').replace(/,/g,''))||0));
        const aptCfg_     = salesData?.aptConfig  || {};
        const offiCfg_    = salesData?.offiConfig || {};
        const storeCfg_   = salesData?.storeConfig|| {};

        // 착공 인덱스(1-based)
        const conIdx = prepPeriod_ + 1;
        const idxToRel = (idx) => idx - conIdx;

        // 공동주택 분양일정 (균등 배분용: 임차료/운영비/광고)
        const aptStartIdx  = conIdx + (parseInt(aptCfg_.salesStartOffset)||0);
        const aptEndMonth  = parseInt(aptCfg_.endMonth)||0;
        const aptEndIdx    = aptEndMonth > 0 ? aptStartIdx + aptEndMonth - 1 : prepPeriod_ + conPrd_;
        const aptStartRel  = idxToRel(aptStartIdx);
        const aptEndRel    = idxToRel(aptEndIdx);
        const aptPeriod    = Math.max(1, aptEndIdx - aptStartIdx + 1);

        // 오피스텔 분양일정
        const offiStartIdx = conIdx + (parseInt(offiCfg_.salesStartOffset)||0);
        const offiEndMonth = parseInt(offiCfg_.endMonth)||0;
        const offiEndIdx   = offiEndMonth > 0 ? offiStartIdx + offiEndMonth - 1 : prepPeriod_ + conPrd_;
        const offiStartRel = idxToRel(offiStartIdx);
        const offiEndRel   = idxToRel(offiEndIdx);

        // 상가 분양일정
        const junIdx_      = prepPeriod_ + conPrd_ - 1;  // 준공 인덱스(0-based)
        const storeStartBefore = parseInt(storeCfg_.storeStartBefore)||9;
        const storeEndAfter    = parseInt(storeCfg_.storeEndAfter)||4;
        const storeStartIdx    = junIdx_ - storeStartBefore;
        const storeEndIdx      = junIdx_ + storeEndAfter - 1;
        const storeStartRel    = idxToRel(storeStartIdx);
        const storeEndRel      = idxToRel(storeEndIdx);

        // ── calcRates: Sales.js와 동일 로직 (junMonth = pre+con 수정 버전) ──
        const calcRatesLocal = (cfg, startIdx, endIdx, isStore) => {
          const m1 = parseFloat(cfg.m1)||0, m2 = parseFloat(cfg.m2)||0, m3 = parseFloat(cfg.m3)||0;
          const remain = 1 - m1 - m2 - m3;
          const remMonths = Math.max(0, endIdx - startIdx - 2);
          const rates = Array(totalMonths_).fill(0);
          for (let i = startIdx-1; i < totalMonths_; i++) {
            const m = i - (startIdx-1);
            if (i > endIdx-1) break;
            if (m === 0)      rates[i] = m1;
            else if (m === 1) rates[i] = m2;
            else if (m === 2) rates[i] = m3;
            else if (remMonths > 0) rates[i] = remain / remMonths;
          }
          return rates;  // 각 원소: 해당월 분양율(0~1)
        };

        // 분양대행비: 월별 분양율 × 총액 → 월별 지급액
        const agentByRates = (amt, rates) => {
          const pays = {};
          rates.forEach((rate, i) => {
            if (rate <= 0) return;
            const ym = months[i] || null;  // months[]는 전체 사업기간
            // rates 인덱스(0-based) → YM 변환: bizStart 기준
            const bsY = bizStart.year, bsM = bizStart.month;
            const total_ = (bsY-1)*12 + (bsM-1) + i;
            const ym2 = `${Math.floor(total_/12)+1}.${String(total_%12+1).padStart(2,'0')}`;
            if (months.includes(ym2)) {
              pays[ym2] = (pays[ym2]||0) + Math.round(amt * rate);
            }
          });
          // 반올림 오차 보정
          const paidSum = Object.values(pays).reduce((s,v)=>s+v,0);
          const diff = amt - paidSum;
          if (diff !== 0) {
            const lastYM = Object.keys(pays).filter(ym=>months.includes(ym)).sort().pop();
            if (lastYM) pays[lastYM] = (pays[lastYM]||0) + diff;
          }
          return pays;
        };

        // 각 상품 분양율 배열
        const aptRates_   = calcRatesLocal(aptCfg_,   aptStartIdx,   aptEndIdx,   false);
        const offiRates_  = calcRatesLocal(offiCfg_,  offiStartIdx,  offiEndIdx,  false);
        const storeRates_ = calcRatesLocal(storeCfg_, storeStartIdx, storeEndIdx, true);

        const agentAptPays   = agentByRates(agentAptAmt2,   aptRates_);
        const agentOffiPays  = agentByRates(agentOffiAmt2,  offiRates_);
        const agentStorePays = agentByRates(agentStoreAmt2, storeRates_);

        // HUG N회 분할 헬퍼
        const calcSalSplit = (itemKey, amt, defN=1) => {
          const n = parseInt(d[`${itemKey}_n`] || defN) || 1;
          let pctSum = 0;
          return Array.from({length:n}, (_,i) => {
            const rel = parseInt(d[`${itemKey}_rel_${i}`] || '0') || 0;
            const isLast = i===n-1;
            const pct = isLast ? Math.max(0,100-pctSum) : parseFloat(d[`${itemKey}_pct_${i}`] || String(Math.round(100/n)))||0;
            if (!isLast) pctSum += pct;
            return { rel, pct, amt: isLast ? amt-Math.round(amt*pctSum/100) : Math.round(amt*pct/100) };
          });
        };

        const salSplitUI = (itemKey, amt, defN=1) => {
          const n = parseInt(d[`${itemKey}_n`] || defN) || 1;
          const splits = calcSalSplit(itemKey, amt, defN);
          const pctSum = splits.slice(0,-1).reduce((s,sp)=>s+sp.pct,0);
          return (
            <div style={{ marginTop:'4px' }}>
              <div style={{ display:'flex', alignItems:'center', gap:'4px', marginBottom:'4px' }}>
                <input type="number" min="1" max="10"
                  value={d[`${itemKey}_n`] || defN}
                  onChange={e => update(`${itemKey}_n`, e.target.value)}
                  style={{ width:'36px', padding:'2px 4px', border:'1px solid #bbb', borderRadius:'3px', fontSize:'11px', textAlign:'center' }} />
                <span style={{ fontSize:'10px', color:'#888' }}>회 분할</span>
              </div>
              {splits.map((sp, i) => {
                const isLast = i===n-1;
                return (
                  <div key={i} style={{ display:'flex', alignItems:'center', gap:'3px', marginBottom:'2px' }}>
                    <span style={{ fontSize:'10px', color:'#999', width:'16px' }}>{i+1}.</span>
                    <span style={{ fontSize:'10px', color:'#888' }}>착공</span>
                    <input value={d[`${itemKey}_rel_${i}`] ?? '0'}
                      onChange={e => update(`${itemKey}_rel_${i}`, e.target.value)}
                      style={{ width:'34px', padding:'2px 3px', border:'1px solid #ccc', borderRadius:'3px', fontSize:'11px', textAlign:'center' }} />
                    <span style={{ fontSize:'10px', color:'#888' }}>M</span>
                    {isLast
                      ? <span style={{ fontSize:'10px', color:CAT_COLOR, fontWeight:'bold', minWidth:'36px', textAlign:'right' }}>{Math.max(0,100-pctSum).toFixed(0)}%</span>
                      : <input value={d[`${itemKey}_pct_${i}`] ?? String(Math.round(100/n))}
                          onChange={e => update(`${itemKey}_pct_${i}`, e.target.value)}
                          style={{ width:'34px', padding:'2px 3px', border:'1px solid #ccc', borderRadius:'3px', fontSize:'11px', textAlign:'center' }} />
                    }
                    {!isLast && <span style={{ fontSize:'10px', color:'#888' }}>%</span>}
                    <span style={{ fontSize:'10px', color:'#aaa', marginLeft:'2px' }}>({formatNumber(sp.amt)})</span>
                  </div>
                );
              })}
            </div>
          );
        };

        // 항목 정의
        const salesItems = [
          { key:'mhRent',    label:'① 모델하우스 임차료', amt: mhRentAmt,
            mode:'range', startRel: aptStartRel, endRel: aptEndRel,
            hint:`공동주택 분양일정 연동 (착공${aptStartRel}M~${aptEndRel}M, ${aptPeriod}개월 균등)` },
          { key:'mhInst',    label:'② 모델하우스 설치비', amt: mhInstAmt,
            mode:'single', defRel: String(aptStartRel-1), hint:'분양 전 일시' },
          { key:'mhOper',    label:'③ 모델하우스 운영비', amt: mhOperAmt,
            mode:'range', startRel: aptStartRel, endRel: aptEndRel,
            hint:`공동주택 분양일정 연동 (착공${aptStartRel}M~${aptEndRel}M)` },
          { key:'ad',        label:'④ 광고선전비',         amt: adAmt,
            mode:'range', startRel: aptStartRel, endRel: aptEndRel,
            hint:`공동주택 분양일정 연동 (착공${aptStartRel}M~${aptEndRel}M)` },
          { key:'agentApt',  label:'⑤ 분양대행비(아파트)',   amt: agentAptAmt2,
            mode:'agentRates', pays: agentAptPays,
            hint:'공동주택 월별 분양율 연동' },
          { key:'agentOffi', label:'⑤ 분양대행비(오피스텔)', amt: agentOffiAmt2,
            mode:'agentRates', pays: agentOffiPays,
            hint:'오피스텔 월별 분양율 연동' },
          { key:'agentStore',label:'⑤ 분양대행비(상가)',      amt: agentStoreAmt2,
            mode:'agentRates', pays: agentStorePays,
            hint:'상가 월별 분양율 연동' },
          { key:'hug',       label:'⑥ HUG 보증수수료',    amt: hugAmt2,
            mode:'split', defN:1, hint:'N회 분할' },
          ...salEtcItems.filter(it=>parseAmt(it.amt)>0).map((it,i)=>({
            key:`etc_${i}`, label:`기타 ${it.name||''}`, amt: parseAmt(it.amt),
            mode:'single', defRel:'0', hint:''
          })),
        ].filter(it => it.amt > 0);

        // taxable 매핑 (salesCostData)
        const salTaxableMap = {
          mhRent: !!salesCostData?.mhRent_taxable, mhInst: !!salesCostData?.mhInst_taxable,
          mhOper: !!salesCostData?.mhOper_taxable, ad: !!salesCostData?.ad_taxable,
          agentApt: !!salesCostData?.agentApt_taxable, agentOffi: !!salesCostData?.agentOffi_taxable,
          agentStore: !!salesCostData?.agentStore_taxable, hug: !!salesCostData?.hug_taxable,
        };
        (salesCostData?.etcItems||[]).forEach((it,i) => { salTaxableMap[`etc_${i}`] = !!it.taxable; });

        // 월별 합계
        const salesMonthTotals = {};
        const salesVatTotals   = {};
        salesItems.forEach(it => {
          const isTaxable = salTaxableMap[it.key] || false;
          const addVat = (ym, amt) => { if (isTaxable && months.includes(ym)) salesVatTotals[ym] = (salesVatTotals[ym]||0) + Math.round(amt * 0.1); };
          if (it.mode === 'range') {
            const sR = it.startRel, eR = it.endRel;
            const len = Math.max(1, eR - sR + 1);
            const mo  = Math.round(it.amt / len);
            for (let r = sR; r <= eR; r++) {
              const ym = relToYM(r);
              if (months.includes(ym)) {
                const adj = r===eR ? it.amt - mo*(len-1) : mo;
                salesMonthTotals[ym] = (salesMonthTotals[ym]||0) + adj;
                addVat(ym, adj);
              }
            }
          } else if (it.mode === 'agentRates') {
            Object.entries(it.pays||{}).forEach(([ym, amt]) => {
              if (months.includes(ym)) { salesMonthTotals[ym] = (salesMonthTotals[ym]||0) + amt; addVat(ym, amt); }
            });
          } else if (it.mode === 'split') {
            calcSalSplit(`sal_${it.key}`, it.amt, it.defN).forEach(sp => {
              const ym = relToYM(sp.rel);
              if (months.includes(ym)) { salesMonthTotals[ym] = (salesMonthTotals[ym]||0) + sp.amt; addVat(ym, sp.amt); }
            });
          } else {
            const rel = d[`sal_rel_${it.key}`] ?? it.defRel;
            const ym  = relToYM(parseInt(rel||0));
            if (months.includes(ym)) { salesMonthTotals[ym] = (salesMonthTotals[ym]||0) + it.amt; addVat(ym, it.amt); }
          }
        });
        const salesTotalVat = Object.values(salesVatTotals).reduce((s,v)=>s+v,0);

        const isOpen = openSections['sales'] !== false;
        return (
          <div style={{ marginBottom:'28px' }}>
            <div onClick={() => toggleSection('sales')}
              style={{ fontWeight:'bold', fontSize:'14px', color:CAT_COLOR, marginBottom: isOpen?'10px':'0',
                paddingBottom:'5px', borderBottom:`2px solid ${CAT_COLOR}`, cursor:'pointer',
                display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span>📢 판매비 지급패턴</span>
              <div style={{ display:'flex', gap:'8px', alignItems:'center', fontSize:'12px', fontWeight:'normal' }}>
                <span style={{ color:'#555', fontSize:'11px' }}>
                  공급가 <strong style={{ color:CAT_COLOR }}>{formatNumber(salesAmt)}</strong>
                  {salesTotalVat > 0 && <span style={{ color:'#e67e22', marginLeft:'6px' }}>VAT <strong>{formatNumber(salesTotalVat)}</strong></span>}
                  <span style={{ marginLeft:'6px', opacity:0.6 }}>천원</span>
                </span>
                <button onClick={e=>{e.stopPropagation();setCrossCheckSection('sales');}}
                  style={{ padding:'3px 10px', backgroundColor:'#8e44ad', color:'white', border:'none', borderRadius:'4px', cursor:'pointer', fontSize:'11px', fontWeight:'bold', whiteSpace:'nowrap' }}>
                  🔍 체크
                </button>
                <span>{isOpen ? '▲ 접기' : '▼ 펼치기'}</span>
              </div>
            </div>
            {isOpen && (
              <>
                <div style={{ fontSize:'11px', color:'#888', marginBottom:'8px', padding:'6px 10px', backgroundColor:BG_LIGHT, borderRadius:'4px' }}>
                  💡 단일: 착공 기준 상대월 &nbsp;|&nbsp; 균등: 시작M ~ 종료M 균등 분할
                </div>
                <div style={{ overflowX:'auto' }}>
                  <table style={{ borderCollapse:'collapse', fontSize:'11px', minWidth:'100%' }}>
                    <thead>
                      <tr style={{ backgroundColor:'#2c3e50' }}>
                        <th style={{ ...thS, textAlign:'left', minWidth:'220px', position:'sticky', left:0, backgroundColor:'#2c3e50', zIndex:2 }}>항목</th>
                        <th style={{ ...thS, minWidth:'100px' }}>금액(천원)</th>
                        {months.map(ym => (
                          <th key={ym} style={{ ...thS, minWidth:'72px', backgroundColor: (ym===conYM||ym===compYM)?'#c0392b':'#455a64' }}>
                            {ym}<div style={{ fontSize:'9px', fontWeight:'normal', opacity:0.8 }}>{relLabel(ym)}</div>
                          </th>
                        ))}
                        <th style={{ ...thS, minWidth:'90px' }}>합계</th>
                      </tr>
                    </thead>
                    <tbody>
                      {salesItems.map((it, i) => {
                        const rowBg = i%2===0?'white':BG_LIGHT;
                        // range: 분양일정 균등
                        if (it.mode === 'range') {
                          const sR = it.startRel, eR = it.endRel;
                          const len = Math.max(1, eR - sR + 1);
                          const mo  = Math.round(it.amt / len);
                          const rowPays = {};
                          for (let r = sR; r <= eR; r++) {
                            rowPays[relToYM(r)] = r===eR ? it.amt - mo*(len-1) : mo;
                          }
                          return (
                            <tr key={it.key} style={{ backgroundColor: rowBg }}>
                              <td style={{ ...tdS, fontWeight:'bold', color:CAT_COLOR, position:'sticky', left:0, backgroundColor:rowBg, zIndex:1 }}>
                                {it.label}
                                <div style={{ fontSize:'9px', color:'#27ae60', marginTop:'2px' }}>✓ 분양일정 자동연동 (균등)</div>
                                {it.hint && <div style={{ fontSize:'9px', color:'#aaa', marginTop:'1px' }}>{it.hint}</div>}
                              </td>
                              <td style={{ ...tdS, textAlign:'right', fontWeight:'bold', color:CAT_COLOR }}>{formatNumber(it.amt)}</td>
                              {months.map(ym => {
                                const amt = rowPays[ym] || 0;
                                return (
                                  <td key={ym} style={{ ...tdS, textAlign:'right',
                                    backgroundColor: amt>0?BG_LIGHT:'transparent',
                                    fontWeight: amt>0?'bold':'normal', color: amt>0?CAT_COLOR:'#ccc' }}>
                                    {amt>0 ? formatNumber(amt) : '—'}
                                  </td>
                                );
                              })}
                              <td style={{ ...tdS, textAlign:'right', fontWeight:'bold', color:CAT_COLOR }}>{formatNumber(it.amt)}</td>
                            </tr>
                          );
                        }
                        // agentRates: 월별 분양율 비례 지급
                        if (it.mode === 'agentRates') {
                          const rowPays = it.pays || {};
                          return (
                            <tr key={it.key} style={{ backgroundColor: rowBg }}>
                              <td style={{ ...tdS, fontWeight:'bold', color:CAT_COLOR, position:'sticky', left:0, backgroundColor:rowBg, zIndex:1 }}>
                                {it.label}
                                <div style={{ fontSize:'9px', color:'#27ae60', marginTop:'2px' }}>✓ 월별 분양율 비례 자동연동</div>
                                {it.hint && <div style={{ fontSize:'9px', color:'#aaa', marginTop:'1px' }}>{it.hint}</div>}
                              </td>
                              <td style={{ ...tdS, textAlign:'right', fontWeight:'bold', color:CAT_COLOR }}>{formatNumber(it.amt)}</td>
                              {months.map(ym => {
                                const amt = rowPays[ym] || 0;
                                return (
                                  <td key={ym} style={{ ...tdS, textAlign:'right',
                                    backgroundColor: amt>0?BG_LIGHT:'transparent',
                                    fontWeight: amt>0?'bold':'normal', color: amt>0?CAT_COLOR:'#ccc' }}>
                                    {amt>0 ? formatNumber(amt) : '—'}
                                  </td>
                                );
                              })}
                              <td style={{ ...tdS, textAlign:'right', fontWeight:'bold', color:CAT_COLOR }}>{formatNumber(it.amt)}</td>
                            </tr>
                          );
                        }
                        // split: HUG N회 분할
                        if (it.mode === 'split') {
                          const splits = calcSalSplit(`sal_${it.key}`, it.amt, it.defN);
                          const rowPays = {};
                          splits.forEach(sp => { rowPays[relToYM(sp.rel)] = (rowPays[relToYM(sp.rel)]||0) + sp.amt; });
                          return (
                            <tr key={it.key} style={{ backgroundColor: rowBg }}>
                              <td style={{ ...tdS, fontWeight:'bold', color:CAT_COLOR, position:'sticky', left:0, backgroundColor:rowBg, zIndex:1, verticalAlign:'top' }}>
                                {it.label}
                                {salSplitUI(`sal_${it.key}`, it.amt, it.defN)}
                                {it.hint && <div style={{ fontSize:'9px', color:'#aaa', marginTop:'2px' }}>{it.hint}</div>}
                              </td>
                              <td style={{ ...tdS, textAlign:'right', fontWeight:'bold', color:CAT_COLOR, verticalAlign:'top' }}>{formatNumber(it.amt)}</td>
                              {months.map(ym => {
                                const amt = rowPays[ym] || 0;
                                return (
                                  <td key={ym} style={{ ...tdS, textAlign:'right',
                                    backgroundColor: amt>0?BG_LIGHT:'transparent',
                                    fontWeight: amt>0?'bold':'normal', color: amt>0?CAT_COLOR:'#ccc' }}>
                                    {amt>0 ? formatNumber(amt) : '—'}
                                  </td>
                                );
                              })}
                              <td style={{ ...tdS, textAlign:'right', fontWeight:'bold', color:CAT_COLOR }}>{formatNumber(it.amt)}</td>
                            </tr>
                          );
                        }
                        // single: 일시
                        const relKey = `sal_rel_${it.key}`;
                        const rel    = d[relKey] ?? it.defRel;
                        const payYM  = relToYM(parseInt(rel)||0);
                        return (
                          <tr key={it.key} style={{ backgroundColor: rowBg }}>
                            <td style={{ ...tdS, fontWeight:'bold', color:CAT_COLOR, position:'sticky', left:0, backgroundColor:rowBg, zIndex:1 }}>
                              {it.label}
                              <div style={{ marginTop:'2px' }}>{relInputCell(relKey, rel)}</div>
                              {it.hint && <div style={{ fontSize:'9px', color:'#aaa' }}>{it.hint}</div>}
                            </td>
                            <td style={{ ...tdS, textAlign:'right', fontWeight:'bold', color:CAT_COLOR }}>{formatNumber(it.amt)}</td>
                            {months.map(ym => {
                              const isPay = payYM===ym;
                              return (
                                <td key={ym} style={{ ...tdS, textAlign:'right',
                                  backgroundColor: isPay?BG_LIGHT:'transparent',
                                  fontWeight: isPay?'bold':'normal', color: isPay?CAT_COLOR:'#ccc' }}>
                                  {isPay ? formatNumber(it.amt) : '—'}
                                </td>
                              );
                            })}
                            <td style={{ ...tdS, textAlign:'right', fontWeight:'bold', color:CAT_COLOR }}>{formatNumber(it.amt)}</td>
                          </tr>
                        );
                      })}
                      <tr style={{ backgroundColor:CAT_COLOR }}>
                        <td style={{ padding:'6px 8px', color:'white', fontWeight:'bold', position:'sticky', left:0, backgroundColor:CAT_COLOR, zIndex:1 }}>월별 합계</td>
                        <td style={{ padding:'5px 6px', color:'white', fontWeight:'bold', textAlign:'right' }}>{formatNumber(salesAmt)}</td>
                        {months.map(ym => (
                          <td key={ym} style={{ padding:'5px 6px', textAlign:'right', color:'white', fontWeight:'bold', fontSize:'11px' }}>
                            {salesMonthTotals[ym] ? formatNumber(salesMonthTotals[ym]) : '—'}
                          </td>
                        ))}
                        <td style={{ padding:'5px 6px', color:'white', fontWeight:'bold', textAlign:'right' }}>{formatNumber(salesAmt)}</td>
                      </tr>
                      {renderVatRows(salesMonthTotals, salesVatTotals, salesAmt, salesTotalVat, CAT_COLOR, months, formatNumber, taxRatioVAT)}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        );
      })()}

      {/* ── 제세금 ── */}
      {(() => {
        const CAT_COLOR = '#546e7a';
        const BG_LIGHT  = '#f5f6f7';
        const taxAmt = taxResult?.total || 0;

        // result에서 직접 꺼내기 (재계산 없음)
        const { transAmt=0, gasAmt=0, waterAmt=0, sewerAmt=0, bondBuildAmt=0,
                schoolAmt=0, regAmt=0, propTaxAmt=0, compTaxAmt=0, etcItems: taxEtcItems=[] } = taxResult || {};

        // 재산세/종부세 yearCalc (납부연도별 일정)
        const propYearCalc = taxData?.propTaxData?.yearCalc || [];  // [{year, amt, month:9}]
        const compYearCalc = taxData?.compTaxData?.yearCalc || [];  // [{year, amt, month:12}]

        // N회 분할 헬퍼 (광역교통/HUG용)
        const calcTaxSplit = (itemKey, amt, defN=1) => {
          const n = parseInt(d[`${itemKey}_n`] || defN) || 1;
          let pctSum = 0;
          return Array.from({length:n}, (_, i) => {
            const rel = parseInt(d[`${itemKey}_rel_${i}`] || '0') || 0;
            const isLast = i === n-1;
            const pct = isLast ? Math.max(0,100-pctSum) : parseFloat(d[`${itemKey}_pct_${i}`] || String(Math.round(100/n))) || 0;
            if (!isLast) pctSum += pct;
            return { rel, pct, amt: isLast ? amt - Math.round(amt*pctSum/100) : Math.round(amt*pct/100) };
          });
        };

        const taxSplitUI = (itemKey, amt, defN=1) => {
          const n = parseInt(d[`${itemKey}_n`] || defN) || 1;
          const splits = calcTaxSplit(itemKey, amt, defN);
          const pctSum = splits.slice(0,-1).reduce((s,sp)=>s+sp.pct,0);
          return (
            <div style={{ marginTop:'4px' }}>
              <div style={{ display:'flex', alignItems:'center', gap:'4px', marginBottom:'4px' }}>
                <input type="number" min="1" max="10"
                  value={d[`${itemKey}_n`] || defN}
                  onChange={e => update(`${itemKey}_n`, e.target.value)}
                  style={{ width:'36px', padding:'2px 4px', border:'1px solid #bbb', borderRadius:'3px', fontSize:'11px', textAlign:'center' }} />
                <span style={{ fontSize:'10px', color:'#888' }}>회 분할</span>
              </div>
              {splits.map((sp, i) => {
                const isLast = i === n-1;
                return (
                  <div key={i} style={{ display:'flex', alignItems:'center', gap:'3px', marginBottom:'2px' }}>
                    <span style={{ fontSize:'10px', color:'#999', width:'16px' }}>{i+1}.</span>
                    <span style={{ fontSize:'10px', color:'#888' }}>착공</span>
                    <input value={d[`${itemKey}_rel_${i}`] ?? '0'}
                      onChange={e => update(`${itemKey}_rel_${i}`, e.target.value)}
                      style={{ width:'34px', padding:'2px 3px', border:'1px solid #ccc', borderRadius:'3px', fontSize:'11px', textAlign:'center' }} />
                    <span style={{ fontSize:'10px', color:'#888' }}>M</span>
                    {isLast
                      ? <span style={{ fontSize:'10px', color:CAT_COLOR, fontWeight:'bold', minWidth:'36px', textAlign:'right' }}>{Math.max(0,100-pctSum).toFixed(0)}%</span>
                      : <input value={d[`${itemKey}_pct_${i}`] ?? String(Math.round(100/n))}
                          onChange={e => update(`${itemKey}_pct_${i}`, e.target.value)}
                          style={{ width:'34px', padding:'2px 3px', border:'1px solid #ccc', borderRadius:'3px', fontSize:'11px', textAlign:'center' }} />
                    }
                    {!isLast && <span style={{ fontSize:'10px', color:'#888' }}>%</span>}
                    <span style={{ fontSize:'10px', color:'#aaa', marginLeft:'2px' }}>({formatNumber(sp.amt)})</span>
                  </div>
                );
              })}
            </div>
          );
        };

        // 재산세 납부일정: yearCalc → 절대YM 변환
        // year의 9월(재산세) or 12월(종부세)를 착공기준 relM으로
        const yearCalcToPayments = (yearCalc) => yearCalc
          .filter(r => r.amt > 0)
          .map(r => {
            const ym = `${r.year}.${String(r.month).padStart(2,'0')}`;
            return { ym, amt: r.amt };
          });

        const propPayments = yearCalcToPayments(propYearCalc);
        const compPayments = yearCalcToPayments(compYearCalc);

        const taxItems = [
          { key:'trans',     label:'① 광역교통시설부담금', amt: transAmt,     mode:'split', defN:1 },
          { key:'gas',       label:'② 가스공급비용',       amt: gasAmt,       mode:'single', defRel:'0' },
          { key:'water',     label:'③ 상수도분담금',       amt: waterAmt,     mode:'single', defRel:'0' },
          { key:'sewer',     label:'④ 하수도원인자부담금', amt: sewerAmt,     mode:'single', defRel:'0' },
          { key:'bondBuild', label:'⑤ 건물분채권할인',     amt: bondBuildAmt, mode:'single', defRel:String(Math.round(constructPeriod)-1) },
          { key:'school',    label:'⑥ 학교용지부담금',     amt: schoolAmt,    mode:'single', defRel:'-1' },
          { key:'reg',       label:'⑦ 보존등기비',         amt: regAmt,       mode:'single', defRel:String(Math.round(constructPeriod)) },
          { key:'propTax',   label:'⑧ 재산세',             amt: propTaxAmt,   mode:'yearCalc', payments: propPayments, hint:'재산세계산기 연도별 9월 납부' },
          { key:'compTax',   label:'⑨ 종합부동산세',       amt: compTaxAmt,   mode:'yearCalc', payments: compPayments, hint:'종부세계산기 연도별 12월 납부' },
          ...taxEtcItems.filter(it=>parseAmt(it.amt)>0).map((it,i)=>({
            key:`etc_${i}`, label:`기타 ${it.name||''}`, amt: parseAmt(it.amt), mode:'single', defRel:'0'
          })),
        ].filter(it => it.amt > 0);

        // taxable 매핑 (taxData)
        const taxTaxableMap = {
          trans: !!taxData?.trans_taxable, gas: !!taxData?.gas_taxable,
          water: !!taxData?.water_taxable, sewer: !!taxData?.sewer_taxable,
          bondBuild: !!taxData?.bondBuild_taxable, school: !!taxData?.school_taxable,
          reg: !!taxData?.reg_taxable, propTax: false, compTax: false,  // 세금류 = 면세
        };
        (taxData?.etcItems||[]).forEach((it,i) => { taxTaxableMap[`etc_${i}`] = !!it.taxable; });

        const taxMonthTotals = {};
        const taxVatTotals   = {};
        taxItems.forEach(it => {
          const isTaxable = taxTaxableMap[it.key] || false;
          const addVat = (ym, amt) => { if (isTaxable && months.includes(ym)) taxVatTotals[ym] = (taxVatTotals[ym]||0) + Math.round(amt * 0.1); };
          if (it.mode === 'split') {
            calcTaxSplit(`tax_${it.key}`, it.amt, it.defN).forEach(sp => {
              const ym = relToYM(sp.rel);
              if (months.includes(ym)) { taxMonthTotals[ym] = (taxMonthTotals[ym]||0) + sp.amt; addVat(ym, sp.amt); }
            });
          } else if (it.mode === 'yearCalc') {
            (it.payments||[]).forEach(p => {
              if (months.includes(p.ym)) { taxMonthTotals[p.ym] = (taxMonthTotals[p.ym]||0) + p.amt; addVat(p.ym, p.amt); }
            });
          } else {
            const ym = relToYM(parseInt(d[`tax_rel_${it.key}`] ?? it.defRel) || 0);
            if (months.includes(ym)) { taxMonthTotals[ym] = (taxMonthTotals[ym]||0) + it.amt; addVat(ym, it.amt); }
          }
        });
        const taxTotalVat = Object.values(taxVatTotals).reduce((s,v)=>s+v,0);

        const isOpen = openSections['tax'] !== false;
        return (
          <div style={{ marginBottom:'28px' }}>
            <div onClick={() => toggleSection('tax')}
              style={{ fontWeight:'bold', fontSize:'14px', color:CAT_COLOR, marginBottom: isOpen?'10px':'0',
                paddingBottom:'5px', borderBottom:`2px solid ${CAT_COLOR}`, cursor:'pointer',
                display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span>📋 제세금 지급패턴</span>
              <div style={{ display:'flex', gap:'8px', alignItems:'center', fontSize:'12px', fontWeight:'normal' }}>
                <span style={{ color:'#555', fontSize:'11px' }}>
                  공급가 <strong style={{ color:CAT_COLOR }}>{formatNumber(taxAmt)}</strong>
                  {taxTotalVat > 0 && <span style={{ color:'#e67e22', marginLeft:'6px' }}>VAT <strong>{formatNumber(taxTotalVat)}</strong></span>}
                  <span style={{ marginLeft:'6px', opacity:0.6 }}>천원</span>
                </span>
                <button onClick={e=>{e.stopPropagation();setCrossCheckSection('tax');}}
                  style={{ padding:'3px 10px', backgroundColor:'#8e44ad', color:'white', border:'none', borderRadius:'4px', cursor:'pointer', fontSize:'11px', fontWeight:'bold', whiteSpace:'nowrap' }}>
                  🔍 체크
                </button>
                <span>{isOpen ? '▲ 접기' : '▼ 펼치기'}</span>
              </div>
            </div>
            {isOpen && (
              <div style={{ overflowX:'auto' }}>
                <table style={{ borderCollapse:'collapse', fontSize:'11px', minWidth:'100%' }}>
                  <thead>
                    <tr style={{ backgroundColor:'#2c3e50' }}>
                      <th style={{ ...thS, textAlign:'left', minWidth:'200px', position:'sticky', left:0, backgroundColor:'#2c3e50', zIndex:2 }}>항목</th>
                      <th style={{ ...thS, minWidth:'100px' }}>금액(천원)</th>
                      {months.map(ym => (
                        <th key={ym} style={{ ...thS, minWidth:'72px', backgroundColor: (ym===conYM||ym===compYM)?'#c0392b':'#455a64' }}>
                          {ym}<div style={{ fontSize:'9px', fontWeight:'normal', opacity:0.8 }}>{relLabel(ym)}</div>
                        </th>
                      ))}
                      <th style={{ ...thS, minWidth:'90px' }}>합계</th>
                    </tr>
                  </thead>
                  <tbody>
                    {taxItems.map((it, i) => {
                      const rowBg = i%2===0?'white':BG_LIGHT;
                      // split 모드 (광역교통 등)
                      if (it.mode === 'split') {
                        const splits = calcTaxSplit(`tax_${it.key}`, it.amt, it.defN);
                        const rowPays = {};
                        splits.forEach(sp => { rowPays[relToYM(sp.rel)] = (rowPays[relToYM(sp.rel)]||0) + sp.amt; });
                        return (
                          <tr key={it.key} style={{ backgroundColor: rowBg }}>
                            <td style={{ ...tdS, fontWeight:'bold', color:CAT_COLOR, position:'sticky', left:0, backgroundColor:rowBg, zIndex:1, verticalAlign:'top' }}>
                              {it.label}
                              {taxSplitUI(`tax_${it.key}`, it.amt, it.defN)}
                            </td>
                            <td style={{ ...tdS, textAlign:'right', fontWeight:'bold', color:CAT_COLOR, verticalAlign:'top' }}>{formatNumber(it.amt)}</td>
                            {months.map(ym => {
                              const amt = rowPays[ym] || 0;
                              return (
                                <td key={ym} style={{ ...tdS, textAlign:'right',
                                  backgroundColor: amt>0?BG_LIGHT:'transparent',
                                  fontWeight: amt>0?'bold':'normal', color: amt>0?CAT_COLOR:'#ccc' }}>
                                  {amt>0 ? formatNumber(amt) : '—'}
                                </td>
                              );
                            })}
                            <td style={{ ...tdS, textAlign:'right', fontWeight:'bold', color:CAT_COLOR }}>{formatNumber(it.amt)}</td>
                          </tr>
                        );
                      }
                      // yearCalc 모드 (재산세/종부세)
                      if (it.mode === 'yearCalc') {
                        const rowPays = {};
                        (it.payments||[]).forEach(p => { rowPays[p.ym] = (rowPays[p.ym]||0) + p.amt; });
                        const hasData = (it.payments||[]).length > 0;
                        return (
                          <tr key={it.key} style={{ backgroundColor: rowBg }}>
                            <td style={{ ...tdS, fontWeight:'bold', color:CAT_COLOR, position:'sticky', left:0, backgroundColor:rowBg, zIndex:1 }}>
                              {it.label}
                              {hasData
                                ? <div style={{ fontSize:'9px', color:'#27ae60', marginTop:'2px' }}>✓ 계산기 연동 ({(it.payments||[]).length}개년)</div>
                                : <div style={{ fontSize:'9px', color:'#e74c3c', marginTop:'2px' }}>⚠ 계산기에서 먼저 계산 후 반영하세요</div>
                              }
                              {it.hint && <div style={{ fontSize:'9px', color:'#aaa' }}>{it.hint}</div>}
                            </td>
                            <td style={{ ...tdS, textAlign:'right', fontWeight:'bold', color:CAT_COLOR }}>{formatNumber(it.amt)}</td>
                            {months.map(ym => {
                              const amt = rowPays[ym] || 0;
                              return (
                                <td key={ym} style={{ ...tdS, textAlign:'right',
                                  backgroundColor: amt>0?BG_LIGHT:'transparent',
                                  fontWeight: amt>0?'bold':'normal', color: amt>0?CAT_COLOR:'#ccc' }}>
                                  {amt>0 ? formatNumber(amt) : '—'}
                                </td>
                              );
                            })}
                            <td style={{ ...tdS, textAlign:'right', fontWeight:'bold', color:CAT_COLOR }}>{formatNumber(it.amt)}</td>
                          </tr>
                        );
                      }
                      // single 모드 (나머지)
                      const relKey = `tax_rel_${it.key}`;
                      const rel    = d[relKey] ?? it.defRel;
                      const payYM  = relToYM(parseInt(rel||0));
                      return (
                        <tr key={it.key} style={{ backgroundColor: rowBg }}>
                          <td style={{ ...tdS, fontWeight:'bold', color:CAT_COLOR, position:'sticky', left:0, backgroundColor:rowBg, zIndex:1 }}>
                            {it.label}
                            <div style={{ marginTop:'2px' }}>{relInputCell(relKey, rel)}</div>
                            {it.hint && <div style={{ fontSize:'9px', color:'#aaa' }}>{it.hint}</div>}
                          </td>
                          <td style={{ ...tdS, textAlign:'right', fontWeight:'bold', color:CAT_COLOR }}>{formatNumber(it.amt)}</td>
                          {months.map(ym => {
                            const isPay = payYM === ym;
                            return (
                              <td key={ym} style={{ ...tdS, textAlign:'right',
                                backgroundColor: isPay?BG_LIGHT:'transparent',
                                fontWeight: isPay?'bold':'normal', color: isPay?CAT_COLOR:'#ccc' }}>
                                {isPay ? formatNumber(it.amt) : '—'}
                              </td>
                            );
                          })}
                          <td style={{ ...tdS, textAlign:'right', fontWeight:'bold', color:CAT_COLOR }}>{formatNumber(it.amt)}</td>
                        </tr>
                      );
                    })}
                    <tr style={{ backgroundColor:CAT_COLOR }}>
                      <td style={{ padding:'6px 8px', color:'white', fontWeight:'bold', position:'sticky', left:0, backgroundColor:CAT_COLOR, zIndex:1 }}>월별 합계</td>
                      <td style={{ padding:'5px 6px', color:'white', fontWeight:'bold', textAlign:'right' }}>{formatNumber(taxAmt)}</td>
                      {months.map(ym => (
                        <td key={ym} style={{ padding:'5px 6px', textAlign:'right', color:'white', fontWeight:'bold', fontSize:'11px' }}>
                          {taxMonthTotals[ym] ? formatNumber(taxMonthTotals[ym]) : '—'}
                        </td>
                      ))}
                      <td style={{ padding:'5px 6px', color:'white', fontWeight:'bold', textAlign:'right' }}>{formatNumber(taxAmt)}</td>
                    </tr>
                    {renderVatRows(taxMonthTotals, taxVatTotals, taxAmt, taxTotalVat, CAT_COLOR, months, formatNumber, taxRatioVAT)}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })()}

      {/* ── 부대비 ── */}
      {(() => {
        const CAT_COLOR = '#546e7a';
        const BG_LIGHT  = '#f5f6f7';
        const overAmt = overheadResult?.total || 0;

        // result에서 직접 꺼내기 (재계산 없음)
        const { trustAmt=0, operAmt=0, moveAmt=0, reserveAmt=0, etcItems: ovrEtcItems=[] } = overheadResult || {};
        const cp3_ = parseFloat(String(archData?.constructPeriod||'').replace(/,/g,''))||31;
        const sp3_ = parseFloat(String(archData?.settlePeriod   ||'').replace(/,/g,''))||6;

        const overItems = [
          { key:'trust',   label:'① 관리신탁수수료', amt: trustAmt,
            mode:'range', defStart:'-3', defEnd:String(Math.round(cp3_+sp3_-1)), hint:`착공전3M~정산마지막 균등 (${Math.round(cp3_+sp3_+3)}개월)` },
          { key:'oper',    label:'② 시행사운영비',   amt: operAmt,
            mode:'range', defStart:'0', defEnd:String(Math.round(cp3_+sp3_-1)), hint:`착공~정산마지막 균등 (${Math.round(cp3_+sp3_)}개월)` },
          { key:'move',    label:'③ 입주관리비',     amt: moveAmt,
            mode:'range', defStart:String(Math.round(cp3_)), defEnd:String(Math.round(cp3_+sp3_-1)), hint:`준공다음달~정산마지막 균등 (${Math.round(sp3_)}개월)` },
          { key:'reserve', label:'④ 예비비',         amt: reserveAmt,
            mode:'semiannual', cp: cp3_, hint:'착공~준공 반기(6개월)별 균등 (1,7월 기준)' },
          ...ovrEtcItems.filter(it=>parseAmt(it.amt)>0).map((it,i)=>({
            key:`etc_${i}`, label:`기타 ${it.name||''}`, amt: parseAmt(it.amt),
            mode:'single', defRel:'0', hint:''
          })),
        ].filter(it => it.amt > 0);

        // taxable 매핑 (overheadData)
        const ovrTaxableMap = {
          trust: !!overheadData?.trust_taxable, oper: !!overheadData?.oper_taxable,
          move:  !!overheadData?.move_taxable,  reserve: !!overheadData?.reserve_taxable,
        };
        (overheadData?.etcItems||[]).forEach((it,i) => { ovrTaxableMap[`etc_${i}`] = !!it.taxable; });

        const overMonthTotals = {};
        const overVatTotals   = {};
        overItems.forEach(it => {
          const isTaxable = ovrTaxableMap[it.key] || false;
          const addVat = (ym, amt) => { if (isTaxable && months.includes(ym)) overVatTotals[ym] = (overVatTotals[ym]||0) + Math.round(amt * 0.1); };
          if (it.mode === 'range') {
            const sR = parseInt((d[`ovr_rel_${it.key}_start`] ?? it.defStart) || '0');
            const eR = parseInt((d[`ovr_rel_${it.key}_end`]   ?? it.defEnd)   || '0');
            const len = Math.max(1, eR - sR + 1);
            const mo  = Math.round(it.amt / len);
            for (let r = sR; r <= eR; r++) {
              const ym = relToYM(r);
              if (months.includes(ym)) {
                const adj = r===eR ? it.amt - mo*(len-1) : mo;
                overMonthTotals[ym] = (overMonthTotals[ym]||0) + adj;
                addVat(ym, adj);
              }
            }
          } else if (it.mode === 'semiannual') {
            // 반기(6개월)별 균등 집행 — 착공~준공
            const cp_ = Math.round(it.cp || 0);
            const n_  = Math.max(1, Math.floor(cp_ / 6));
            const rels_ = Array.from({ length: n_ }, (_, i) => i * 6);
            const mo_  = Math.round(it.amt / n_);
            rels_.forEach((r, qi) => {
              const ym  = relToYM(r);
              const adj = qi === n_-1 ? it.amt - mo_*(n_-1) : mo_;
              if (months.includes(ym)) {
                overMonthTotals[ym] = (overMonthTotals[ym]||0) + adj;
                addVat(ym, adj);
              }
            });
          } else {
            const rel = d[`ovr_rel_${it.key}`] ?? it.defRel;
            const ym  = relToYM(parseInt(rel||0));
            if (months.includes(ym)) { overMonthTotals[ym] = (overMonthTotals[ym]||0) + it.amt; addVat(ym, it.amt); }
          }
        });
        const overTotalVat = Object.values(overVatTotals).reduce((s,v)=>s+v,0);

        const isOpen = openSections['overhead'] !== false;
        return (
          <div style={{ marginBottom:'28px' }}>
            <div onClick={() => toggleSection('overhead')}
              style={{ fontWeight:'bold', fontSize:'14px', color:CAT_COLOR, marginBottom: isOpen?'10px':'0',
                paddingBottom:'5px', borderBottom:`2px solid ${CAT_COLOR}`, cursor:'pointer',
                display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span>🏢 부대비 지급패턴</span>
              <div style={{ display:'flex', gap:'8px', alignItems:'center', fontSize:'12px', fontWeight:'normal' }}>
                <span style={{ color:'#555', fontSize:'11px' }}>
                  공급가 <strong style={{ color:CAT_COLOR }}>{formatNumber(overAmt)}</strong>
                  {overTotalVat > 0 && <span style={{ color:'#e67e22', marginLeft:'6px' }}>VAT <strong>{formatNumber(overTotalVat)}</strong></span>}
                  <span style={{ marginLeft:'6px', opacity:0.6 }}>천원</span>
                </span>
                <button onClick={e=>{e.stopPropagation();setCrossCheckSection('overhead');}}
                  style={{ padding:'3px 10px', backgroundColor:'#8e44ad', color:'white', border:'none', borderRadius:'4px', cursor:'pointer', fontSize:'11px', fontWeight:'bold', whiteSpace:'nowrap' }}>
                  🔍 체크
                </button>
                <span>{isOpen ? '▲ 접기' : '▼ 펼치기'}</span>
              </div>
            </div>
            {isOpen && (
              <>
                <div style={{ fontSize:'11px', color:'#888', marginBottom:'8px', padding:'6px 10px', backgroundColor:BG_LIGHT, borderRadius:'4px' }}>
                  💡 단일: 착공 기준 상대월 &nbsp;|&nbsp; 균등: 시작M ~ 종료M 균등 분할
                </div>
                <div style={{ overflowX:'auto' }}>
                  <table style={{ borderCollapse:'collapse', fontSize:'11px', minWidth:'100%' }}>
                    <thead>
                      <tr style={{ backgroundColor:'#2c3e50' }}>
                        <th style={{ ...thS, textAlign:'left', minWidth:'220px', position:'sticky', left:0, backgroundColor:'#2c3e50', zIndex:2 }}>항목</th>
                        <th style={{ ...thS, minWidth:'100px' }}>금액(천원)</th>
                        {months.map(ym => (
                          <th key={ym} style={{ ...thS, minWidth:'72px', backgroundColor: (ym===conYM||ym===compYM)?'#c0392b':'#455a64' }}>
                            {ym}<div style={{ fontSize:'9px', fontWeight:'normal', opacity:0.8 }}>{relLabel(ym)}</div>
                          </th>
                        ))}
                        <th style={{ ...thS, minWidth:'90px' }}>합계</th>
                      </tr>
                    </thead>
                    <tbody>
                      {overItems.map((it, i) => {
                        if (it.mode === 'range') {
                          const sR  = parseInt((d[`ovr_rel_${it.key}_start`] ?? it.defStart) || '0');
                          const eR  = parseInt((d[`ovr_rel_${it.key}_end`]   ?? it.defEnd)   || '0');
                          const len = Math.max(1, eR - sR + 1);
                          const mo  = Math.round(it.amt / len);
                          const rowPays = {};
                          for (let r = sR; r <= eR; r++) {
                            rowPays[relToYM(r)] = r===eR ? it.amt - mo*(len-1) : mo;
                          }
                          return (
                            <tr key={it.key} style={{ backgroundColor: i%2===0?'white':BG_LIGHT }}>
                              <td style={{ ...tdS, fontWeight:'bold', color:CAT_COLOR, position:'sticky', left:0, backgroundColor:i%2===0?'white':BG_LIGHT, zIndex:1 }}>
                                {it.label}
                                <div style={{ marginTop:'3px', display:'flex', alignItems:'center', gap:'4px', flexWrap:'wrap' }}>
                                  <span style={{ fontSize:'10px', color:'#888' }}>착공</span>
                                  <input value={d[`ovr_rel_${it.key}_start`] ?? it.defStart} onChange={e=>update(`ovr_rel_${it.key}_start`,e.target.value)}
                                    style={{ width:'34px', padding:'2px 3px', border:'1px solid #ccc', borderRadius:'3px', fontSize:'11px', textAlign:'center' }} />
                                  <span style={{ fontSize:'10px', color:'#888' }}>M ~</span>
                                  <input value={d[`ovr_rel_${it.key}_end`] ?? it.defEnd} onChange={e=>update(`ovr_rel_${it.key}_end`,e.target.value)}
                                    style={{ width:'34px', padding:'2px 3px', border:'1px solid #ccc', borderRadius:'3px', fontSize:'11px', textAlign:'center' }} />
                                  <span style={{ fontSize:'10px', color:'#888' }}>M 균등</span>
                                </div>
                                {it.hint && <div style={{ fontSize:'9px', color:'#aaa', marginTop:'2px' }}>{it.hint}</div>}
                              </td>
                              <td style={{ ...tdS, textAlign:'right', fontWeight:'bold', color:CAT_COLOR }}>{formatNumber(it.amt)}</td>
                              {months.map(ym => {
                                const amt = rowPays[ym] || 0;
                                return (
                                  <td key={ym} style={{ ...tdS, textAlign:'right',
                                    backgroundColor:amt>0?BG_LIGHT:'transparent',
                                    fontWeight:amt>0?'bold':'normal', color:amt>0?CAT_COLOR:'#ccc' }}>
                                    {amt>0 ? formatNumber(amt) : '—'}
                                  </td>
                                );
                              })}
                              <td style={{ ...tdS, textAlign:'right', fontWeight:'bold', color:CAT_COLOR }}>{formatNumber(it.amt)}</td>
                            </tr>
                          );
                        } else if (it.mode === 'semiannual') {
                          // 반기별 집행 표시
                          const cp_ = Math.round(it.cp || 0);
                          const n_  = Math.max(1, Math.floor(cp_ / 6));
                          const rels_ = Array.from({ length: n_ }, (_, i) => i * 6);
                          const mo_   = Math.round(it.amt / n_);
                          const rowPays = {};
                          rels_.forEach((r, qi) => {
                            const ym  = relToYM(r);
                            rowPays[ym] = qi === n_-1 ? it.amt - mo_*(n_-1) : mo_;
                          });
                          return (
                            <tr key={it.key} style={{ backgroundColor: i%2===0?'white':BG_LIGHT }}>
                              <td style={{ ...tdS, fontWeight:'bold', color:CAT_COLOR, position:'sticky', left:0, backgroundColor:i%2===0?'white':BG_LIGHT, zIndex:1 }}>
                                {it.label}
                                {it.hint && <div style={{ fontSize:'9px', color:'#aaa', marginTop:'2px' }}>{it.hint}</div>}
                                <div style={{ fontSize:'9px', color:'#7d5a00', marginTop:'2px' }}>
                                  반기 {n_}회 × {formatNumber(mo_)}천원
                                </div>
                              </td>
                              <td style={{ ...tdS, textAlign:'right', fontWeight:'bold', color:CAT_COLOR }}>{formatNumber(it.amt)}</td>
                              {months.map(ym => {
                                const amt = rowPays[ym] || 0;
                                return (
                                  <td key={ym} style={{ ...tdS, textAlign:'right',
                                    backgroundColor:amt>0?BG_LIGHT:'transparent',
                                    fontWeight:amt>0?'bold':'normal', color:amt>0?CAT_COLOR:'#ccc' }}>
                                    {amt>0 ? formatNumber(amt) : '—'}
                                  </td>
                                );
                              })}
                              <td style={{ ...tdS, textAlign:'right', fontWeight:'bold', color:CAT_COLOR }}>{formatNumber(it.amt)}</td>
                            </tr>
                          );
                        } else {
                          const relKey = `ovr_rel_${it.key}`;
                          const rel    = d[relKey] ?? it.defRel;
                          const payYM  = relToYM(parseInt(rel||0));
                          return (
                            <tr key={it.key} style={{ backgroundColor: i%2===0?'white':BG_LIGHT }}>
                              <td style={{ ...tdS, fontWeight:'bold', color:CAT_COLOR, position:'sticky', left:0, backgroundColor:i%2===0?'white':BG_LIGHT, zIndex:1 }}>
                                {it.label}
                                <div style={{ marginTop:'2px' }}>{relInputCell(relKey, rel)}</div>
                                {it.hint && <div style={{ fontSize:'9px', color:'#aaa' }}>{it.hint}</div>}
                              </td>
                              <td style={{ ...tdS, textAlign:'right', fontWeight:'bold', color:CAT_COLOR }}>{formatNumber(it.amt)}</td>
                              {months.map(ym => {
                                const isPay = payYM===ym;
                                return (
                                  <td key={ym} style={{ ...tdS, textAlign:'right',
                                    backgroundColor:isPay?BG_LIGHT:'transparent',
                                    fontWeight:isPay?'bold':'normal', color:isPay?CAT_COLOR:'#ccc' }}>
                                    {isPay ? formatNumber(it.amt) : '—'}
                                  </td>
                                );
                              })}
                              <td style={{ ...tdS, textAlign:'right', fontWeight:'bold', color:CAT_COLOR }}>{formatNumber(it.amt)}</td>
                            </tr>
                          );
                        }
                      })}
                      <tr style={{ backgroundColor:CAT_COLOR }}>
                        <td style={{ padding:'6px 8px', color:'white', fontWeight:'bold', position:'sticky', left:0, backgroundColor:CAT_COLOR, zIndex:1 }}>월별 합계</td>
                        <td style={{ padding:'5px 6px', color:'white', fontWeight:'bold', textAlign:'right' }}>{formatNumber(overAmt)}</td>
                        {months.map(ym => (
                          <td key={ym} style={{ padding:'5px 6px', textAlign:'right', color:'white', fontWeight:'bold', fontSize:'11px' }}>
                            {overMonthTotals[ym] ? formatNumber(overMonthTotals[ym]) : '—'}
                          </td>
                        ))}
                        <td style={{ padding:'5px 6px', color:'white', fontWeight:'bold', textAlign:'right' }}>{formatNumber(overAmt)}</td>
                      </tr>
                      {renderVatRows(overMonthTotals, overVatTotals, overAmt, overTotalVat, CAT_COLOR, months, formatNumber, taxRatioVAT)}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        );
      })()}

      {/* ── 부가세 납부/환급 정산 ── */}
      {(() => {
        const CAT_COLOR = '#546e7a';
        const BG_LIGHT  = '#f5f6f7';

        // ── 매출VAT — Sales.js에서 저장된 원천값 사용 (재계산 없음) ──
        const outputVatByMonth = salesData?.vatByMonth || {};
        const totalOutputVat = Object.values(outputVatByMonth).reduce((s,v)=>s+v,0);

        // ── 매입VAT 월별 합계 (monthlyPayments에서 직접) — 과세안분 적용 ──
        // 각 섹션의 과세항목 VAT가 이미 monthlyPayments.xxxVat에 들어 있음
        // 여기에 taxRatioVAT(과세비율)를 곱해서 실제 공제 가능한 매입VAT를 구함
        const rawInputVatByMonth = {};
        ['land','direct','indirect','consult','sales','tax','overhead'].forEach(key => {
          Object.entries((mp||{})[`${key}Vat`]||{}).forEach(([ym, v]) => {
            rawInputVatByMonth[ym] = (rawInputVatByMonth[ym]||0) + v;
          });
        });
        // 월별 과세안분 적용 (각 월의 매입VAT × 과세비율)
        const inputVatByMonth = {};
        Object.entries(rawInputVatByMonth).forEach(([ym, v]) => {
          const deduct = Math.round(v * taxRatioVAT);
          if (deduct > 0) inputVatByMonth[ym] = deduct;
        });
        const totalInputVat  = Object.values(rawInputVatByMonth).reduce((s,v)=>s+v,0);
        const totalDeductVat = Object.values(inputVatByMonth).reduce((s,v)=>s+v,0);

        // ── 분기별 정산 ──
        // 1~3월 → 4월, 4~6월 → 7월, 7~9월 → 10월, 10~12월 → 다음해 1월
        // 사업기간 마지막 달이 정산월이 아니면 강제 정산
        const getSettleMonth = (ym) => {
          const [y, m] = ym.split('.').map(Number);
          if (m <= 3)  return `${y}.04`;
          if (m <= 6)  return `${y}.07`;
          if (m <= 9)  return `${y}.10`;
          return `${y+1}.01`;
        };

        // 월별 발생분을 정산월에 누적
        const settleBucket = {}; // settleYM → { output, input }
        months.forEach(ym => {
          const sYM = getSettleMonth(ym);
          if (!settleBucket[sYM]) settleBucket[sYM] = { output:0, input:0 };
          settleBucket[sYM].output += (outputVatByMonth[ym]||0);
          settleBucket[sYM].input  += (inputVatByMonth[ym]||0);
        });

        // 정산월이 사업기간 months 안에 있는지 확인, 없으면 마지막 달로 강제
        const lastMonth = months[months.length-1];
        const vatSettlements = {}; // ym → 납부(+)/환급(-)
        Object.entries(settleBucket).forEach(([sYM, { output, input }]) => {
          const settlement = Math.round(output - input);
          if (settlement === 0) return;
          // 정산월이 사업기간 안에 있으면 그 달, 없으면 마지막 달
          const targetYM = months.includes(sYM) ? sYM : lastMonth;
          vatSettlements[targetYM] = (vatSettlements[targetYM]||0) + settlement;
        });

        const totalSettlement = Object.values(vatSettlements).reduce((s,v)=>s+v,0);
        const hasData = totalOutputVat > 0 || totalDeductVat > 0;

        if(!hasData && taxRatioVAT===0) return (
          <div style={{ padding:'10px 16px', backgroundColor:'#fff8e1', borderRadius:'8px', border:'1px solid #ffe082', fontSize:'12px', color:'#795548', marginBottom:'16px' }}>
            ⚠ 부가세 정산: 부가세안분탭에서 계산 완료 후 자동연동됩니다. (과세비율: 미설정)
          </div>
        );

        return (
          <div style={{ marginBottom:'28px' }}>
            <div style={{ fontWeight:'bold', fontSize:'14px', color:CAT_COLOR, marginBottom:'10px',
              paddingBottom:'5px', borderBottom:`2px solid ${CAT_COLOR}`,
              display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span>💰 부가세 납부/환급 정산</span>
              <div style={{ fontSize:'12px', fontWeight:'normal', color:'#555' }}>
                과세비율: <strong style={{ color:CAT_COLOR }}>{(taxRatioVAT*100).toFixed(2)}%</strong>
                &nbsp;|&nbsp;
                <span style={{ color: totalSettlement>=0?'#e74c3c':'#27ae60', fontWeight:'bold' }}>
                  {totalSettlement>=0?'순납부':'순환급'}: {formatNumber(Math.abs(totalSettlement))} 천원
                </span>
              </div>
            </div>
            <div style={{ overflowX:'auto' }}>
              <table style={{ borderCollapse:'collapse', fontSize:'11px', minWidth:'100%' }}>
                <thead>
                  <tr style={{ backgroundColor:'#455a64' }}>
                    <th style={{ ...thS, textAlign:'left', minWidth:'160px', position:'sticky', left:0, backgroundColor:'#455a64', zIndex:2 }}>항목</th>
                    <th style={{ ...thS, minWidth:'100px' }}>합계(천원)</th>
                    {months.map(ym => (
                      <th key={ym} style={{ ...thS, minWidth:'72px',
                        backgroundColor:(ym===conYM||ym===compYM)?'#c0392b':'#455a64' }}>
                        {ym}<div style={{ fontSize:'9px', fontWeight:'normal', opacity:0.8 }}>{relLabel(ym)}</div>
                      </th>
                    ))}
                    <th style={{ ...thS, minWidth:'90px' }}>합계</th>
                  </tr>
                </thead>
                <tbody>
                  {/* ① 매출VAT 행 */}
                  <tr style={{ backgroundColor:'white' }}>
                    <td style={{ ...tdS, fontWeight:'bold', color:'#27ae60', position:'sticky', left:0, backgroundColor:'white', zIndex:1 }}>
                      ① 매출VAT (받는 부가세)
                      <div style={{ fontSize:'9px', color:'#aaa' }}>분양율탭 원천 × 과세율 × 10%</div>
                    </td>
                    <td style={{ ...tdS, textAlign:'right', fontWeight:'bold', color:'#27ae60' }}>
                      {formatNumber(totalOutputVat)}
                    </td>
                    {months.map(ym => {
                      const v = outputVatByMonth[ym]||0;
                      return <td key={ym} style={{ ...tdS, textAlign:'right', color:'#27ae60' }}>
                        {v>0?formatNumber(v):'—'}
                      </td>;
                    })}
                    <td style={{ ...tdS, textAlign:'right', fontWeight:'bold', color:'#27ae60' }}>
                      {formatNumber(totalOutputVat)}
                    </td>
                  </tr>
                  {/* ② 매입VAT 행 — 사업비 합계 과세항목 VAT */}
                  <tr style={{ backgroundColor:BG_LIGHT }}>
                    <td style={{ ...tdS, fontWeight:'bold', color:'#2980b9', position:'sticky', left:0, backgroundColor:BG_LIGHT, zIndex:1 }}>
                      ② 매입VAT (준 부가세)
                      <div style={{ fontSize:'9px', color:'#aaa' }}>사업비 합계탭 과세항목 VAT 전체</div>
                    </td>
                    <td style={{ ...tdS, textAlign:'right', fontWeight:'bold', color:'#2980b9' }}>
                      {formatNumber(totalInputVat)}
                    </td>
                    {months.map(ym => {
                      const v = rawInputVatByMonth[ym]||0;
                      return <td key={ym} style={{ ...tdS, textAlign:'right', color:'#2980b9' }}>
                        {v>0?formatNumber(v):'—'}
                      </td>;
                    })}
                    <td style={{ ...tdS, textAlign:'right', fontWeight:'bold', color:'#2980b9' }}>
                      {formatNumber(totalInputVat)}
                    </td>
                  </tr>
                  {/* ③ 안분VAT 행 — 실제 공제 가능분 */}
                  <tr style={{ backgroundColor:'#fef9e7' }}>
                    <td style={{ ...tdS, fontWeight:'bold', color:'#e67e22', position:'sticky', left:0, backgroundColor:'#fef9e7', zIndex:1 }}>
                      ③ 안분VAT (공제 가능분)
                      <div style={{ fontSize:'9px', color:'#aaa' }}>
                        ② × 과세비율 {(taxRatioVAT*100).toFixed(2)}%
                        {totalInputVat > totalDeductVat && (
                          <span style={{ marginLeft:'6px', color:'#c0392b' }}>
                            (원가처리 {formatNumber(totalInputVat-totalDeductVat)})
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={{ ...tdS, textAlign:'right', fontWeight:'bold', color:'#e67e22' }}>
                      {formatNumber(totalDeductVat)}
                    </td>
                    {months.map(ym => {
                      const v = inputVatByMonth[ym]||0;
                      return <td key={ym} style={{ ...tdS, textAlign:'right', color:'#e67e22' }}>
                        {v>0?formatNumber(v):'—'}
                      </td>;
                    })}
                    <td style={{ ...tdS, textAlign:'right', fontWeight:'bold', color:'#e67e22' }}>
                      {formatNumber(totalDeductVat)}
                    </td>
                  </tr>
                  {/* ④ 분기별 납부/환급 */}
                  <tr style={{ backgroundColor:'#fff8e1' }}>
                    <td style={{ ...tdS, fontWeight:'bold', color:'#e65100', position:'sticky', left:0, backgroundColor:'#fff8e1', zIndex:1 }}>
                      ④ 분기별 납부(+)/환급(-)
                      <div style={{ fontSize:'9px', color:'#aaa' }}>①-③ 기준, 1·4·7·10월 (미도래시 마지막달)</div>
                    </td>
                    <td style={{ ...tdS, textAlign:'right', fontWeight:'bold',
                      color: totalSettlement>=0?'#e74c3c':'#27ae60' }}>
                      {totalSettlement>=0?'+':''}{formatNumber(totalSettlement)}
                    </td>
                    {months.map(ym => {
                      const v = vatSettlements[ym];
                      if(!v) return <td key={ym} style={{ ...tdS, textAlign:'right', color:'#ddd' }}>—</td>;
                      return <td key={ym} style={{ ...tdS, textAlign:'right', fontWeight:'bold',
                        color: v>=0?'#e74c3c':'#27ae60',
                        backgroundColor: v>=0?'#fdecea':'#e8f5e9' }}>
                        {v>=0?'+':''}{formatNumber(v)}
                      </td>;
                    })}
                    <td style={{ ...tdS, textAlign:'right', fontWeight:'bold',
                      color: totalSettlement>=0?'#e74c3c':'#27ae60' }}>
                      {totalSettlement>=0?'+':''}{formatNumber(totalSettlement)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div style={{ fontSize:'11px', color:'#888', marginTop:'6px', display:'flex', gap:'16px', flexWrap:'wrap' }}>
              <span style={{ color:'#27ae60' }}>① 매출VAT: 분양율탭 원천</span>
              <span style={{ color:'#2980b9' }}>② 매입VAT: 사업비 과세항목 전체</span>
              <span style={{ color:'#e67e22' }}>③ 안분VAT = ② × {(taxRatioVAT*100).toFixed(2)}% (공제 가능분)</span>
              <span style={{ color:'#888' }}>④ 납부(+)/환급(-) = ①-③</span>
              {totalInputVat > totalDeductVat && (
                <span style={{ color:'#c0392b' }}>※ 원가처리 {formatNumber(totalInputVat-totalDeductVat)}천원은 법인세 계산시 원가 반영</span>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ─────────────────────────────────────────────
// 합계 탭
// ─────────────────────────────────────────────
// const SUB_CATEGORIES = [
//   { key: 'land',   label: '토지관련비용', color: '#546e7a' },
//   { key: 'direct', label: '직접공사비',   color: '#546e7a' },
// ];


// ─────────────────────────────────────────────
// 사업비탭 금융비 섹션
// ─────────────────────────────────────────────
function FinanceCostTab({ financeData, onChange, salesData, cashFlowResult }) {
  const d  = financeData?.financeCost || {};
  const ltv = financeData?.ltvCalc || {};
  const tranches = ltv.tranches || [];
  const pnv = (v) => parseFloat(String(v||'').replace(/,/g,''))||0;
  const upd = (key, val) => onChange({ ...financeData, financeCost: { ...d, [key]: val } });

  // 트랜치 정보
  const getTranche = (name) => {
    const t = tranches.find(t => t.name?.includes(name));
    return { amt: pnv(t?.savedAmt||0), rate: parseFloat(t?.rate||0) };
  };
  const senior = getTranche('선순위');
  const mez    = getTranche('중순위');
  const junior = getTranche('후순위');
  const totalPF = senior.amt + mez.amt + junior.amt;

  // 중도금 잔액 (분양율탭) - 잔금 납부 시 비례 차감
  const ymList    = salesData?.ymList || [];
  const aptMid    = salesData?.aptMidMonthly   || [];
  const offiMid   = salesData?.offiMidMonthly  || [];
  const storeMid  = salesData?.storeMidMonthly || [];
  const aptBal    = salesData?.aptBalMonthly   || [];
  const offiBal   = salesData?.offiBalMonthly  || [];
  const storeBal  = salesData?.storeBalMonthly || [];
  const totalMidAmt = [...aptMid,...offiMid,...storeMid].reduce((s,v)=>s+(v||0),0);
  const totalBalAmt = [...aptBal,...offiBal,...storeBal].reduce((s,v)=>s+(v||0),0);
  const midBalances = (() => {
    let midAccum = 0, midRepaid = 0;
    return ymList.map((_,i) => {
      midAccum += (aptMid[i]||0) + (offiMid[i]||0) + (storeMid[i]||0);
      const balThis = (aptBal[i]||0) + (offiBal[i]||0) + (storeBal[i]||0);
      if (totalBalAmt > 0 && balThis > 0)
        midRepaid += Math.round(totalMidAmt * balThis / totalBalAmt);
      return Math.max(0, midAccum - midRepaid);
    });
  })();

  // 금액 계산
  const mgmtPct      = pnv(d.mgmtPct    || '0');
  const seniorFee    = pnv(d.seniorFee  || '0');
  const mezFee       = pnv(d.mezFee     || '0');
  const juniorFee    = pnv(d.juniorFee  || '0');
  const unindrawnPct = pnv(d.unindrawnPct|| '0');
  const midRate      = pnv(d.midRate    || '0');
  const loanAmt      = pnv(d.loanAmt    || '0');
  const loanRate     = pnv(d.loanRate   || '0');

  const mgmtAmt      = Math.round(totalPF    * mgmtPct   / 100);
  const seniorFeeAmt = Math.round(senior.amt * seniorFee / 100);
  const mezFeeAmt    = Math.round(mez.amt    * mezFee    / 100);
  const juniorFeeAmt = Math.round(junior.amt * juniorFee / 100);
  // 이자는 현금유출입 계산기 결과에서 가져옴 (재계산 없음)
  const seniorIntAmt = cashFlowResult
    ? cashFlowResult.result.reduce((s,r)=>s+(r.intS||0),0)
    : Math.round(senior.amt * senior.rate / 100); // 미연동 시 연간 추정
  const mezIntAmt = cashFlowResult
    ? cashFlowResult.result.reduce((s,r)=>s+(r.intM||0),0)
    : Math.round(mez.amt * mez.rate / 100);
  const juniorIntAmt = cashFlowResult
    ? cashFlowResult.result.reduce((s,r)=>s+(r.intJ||0),0)
    : Math.round(junior.amt * junior.rate / 100);
  const midIntAmt = cashFlowResult
    ? cashFlowResult.result.reduce((s,r)=>s+(r.midInt||0),0)
    : midBalances.reduce((s,bal) => s + Math.round(bal * midRate / 100 / 12), 0);
  const isFromCalc = !!cashFlowResult;
  const unindrawnAmt = Math.round(senior.amt * unindrawnPct / 100); // 선순위 한도 × %
  const loanIntAmt   = Math.round(loanAmt * loanRate / 100);

  // 합계: 수수료 + 이자 전체
  const grandTotal = mgmtAmt + seniorFeeAmt + mezFeeAmt + juniorFeeAmt
    + seniorIntAmt + mezIntAmt + juniorIntAmt + midIntAmt + unindrawnAmt + loanIntAmt;

  // 스타일 (사업비탭 동일)
  const tdS = { padding: '6px 8px', borderBottom: '1px solid #eee', verticalAlign: 'middle' };
  const numCell = (v) => v > 0 ? formatNumber(Math.round(v)) : '—';
  const pctDisplay = (val) => (
    <span style={{ padding:'4px 8px', backgroundColor:'#f5f5f5', border:'1px solid #eee',
      borderRadius:'4px', fontSize:'12px', color:'#2c3e50', fontWeight:'bold' }}>
      {val||'0'}
    </span>
  );
  const autoCell = (v) => (
    <div style={{ padding:'4px 8px', backgroundColor:'#f5f5f5', border:'1px solid #eee',
      borderRadius:'4px', fontSize:'12px', color:'#1a3a5c', fontWeight:'bold',
      textAlign:'right', minWidth:'100px' }}>
      {numCell(v)}
    </div>
  );
  const noFundingBadge = (
    <span style={{ fontSize:'11px', color:'#888', padding:'2px 8px',
      backgroundColor:'#f5f5f5', borderRadius:'8px', border:'1px solid #ddd' }}>
      현금흐름 자동계산
    </span>
  );
  const pfBadge = (
    <span style={{ fontSize:'11px', color:'#1a5276', padding:'2px 8px',
      backgroundColor:'#e8f0f8', borderRadius:'8px', border:'1px solid #aad4e8',
      fontWeight:'bold' }}>
      필수사업비 100%
    </span>
  );
  const saleBadge = (
    <span style={{ fontSize:'11px', color:'#1a5c2a', padding:'2px 8px',
      backgroundColor:'#e8f5ec', borderRadius:'8px', border:'1px solid #a9dfbf',
      fontWeight:'bold' }}>
      분양불 100%
    </span>
  );

  if (totalPF === 0) return (
    <div style={{ padding:'24px', backgroundColor:'#fff8e1', borderRadius:'8px',
      border:'1px solid #ffe082', fontSize:'13px', color:'#795548', textAlign:'center' }}>
      💡 금융탭 → LTV/트랜치 계산기에서 먼저 PF 금액을 설정해주세요.
    </div>
  );

  // 테이블 행 정의
  const autoBadge = (
    <span style={{ fontSize:'11px', color:'#888', padding:'2px 8px',
      backgroundColor:'#f5f5f5', borderRadius:'8px', border:'1px solid #ddd' }}>
      현금흐름 자동계산
    </span>
  );
  const rows = [
    {
      num:'①', label:'주관사수수료', editable: true,
      basis: <span style={{fontSize:'11px',color:'#555'}}>PF총액 <strong>{numCell(totalPF)}</strong> 천원</span>,
      rate:  <span style={{fontWeight:'bold',color:'#2c3e50'}}>{d.mgmtPct||'0'}</span>,
      rateLabel: '% (1회)',
      amt:   autoCell(mgmtAmt),
      funding: pfBadge,
    },
    {
      num:'②', label:'선순위 이자', editable: false,
      basis: <span style={{fontSize:'11px',color:'#1a5276'}}>선순위 {numCell(senior.amt)}천원 × {senior.rate}%</span>,
      rate:  <span style={{fontSize:'11px',color:'#1a5276',fontWeight:'bold'}}>{senior.rate}%</span>,
      rateLabel: '(연)',
      amt:   autoCell(seniorIntAmt),
      funding: noFundingBadge,
    },
    {
      num:'③', label:'중순위 이자', editable: false,
      basis: mez.amt > 0
        ? <span style={{fontSize:'11px',color:'#6c3483'}}>중순위 {numCell(mez.amt)}천원 × {mez.rate}%</span>
        : <span style={{fontSize:'11px',color:'#aaa'}}>중순위 미설정</span>,
      rate:  mez.amt > 0
        ? <span style={{fontSize:'11px',color:'#6c3483',fontWeight:'bold'}}>{mez.rate}%</span>
        : <span style={{fontSize:'11px',color:'#aaa'}}>—</span>,
      rateLabel: mez.amt > 0 ? '(연)' : '',
      amt:   autoCell(mezIntAmt),
      funding: noFundingBadge,
    },
    {
      num:'④', label:'후순위 이자', editable: false,
      basis: junior.amt > 0
        ? <span style={{fontSize:'11px',color:'#922b21'}}>후순위 {numCell(junior.amt)}천원 × {junior.rate}%</span>
        : <span style={{fontSize:'11px',color:'#aaa'}}>후순위 미설정</span>,
      rate:  junior.amt > 0
        ? <span style={{fontSize:'11px',color:'#922b21',fontWeight:'bold'}}>{junior.rate}%</span>
        : <span style={{fontSize:'11px',color:'#aaa'}}>—</span>,
      rateLabel: junior.amt > 0 ? '(연)' : '',
      amt:   autoCell(juniorIntAmt),
      funding: noFundingBadge,
    },
    {
      num:'⑤', label:'선순위 취급수수료', editable: true,
      basis: <span style={{fontSize:'11px',color:'#555'}}>선순위 <strong>{numCell(senior.amt)}</strong> 천원</span>,
      rate:  <span style={{fontWeight:'bold',color:'#2c3e50'}}>{d.seniorFee||'0'}</span>,
      rateLabel: '% (1회)',
      amt:   autoCell(seniorFeeAmt),
      funding: pfBadge,
    },
    {
      num:'⑥', label:'중순위 취급수수료', editable: true,
      basis: <span style={{fontSize:'11px',color:'#555'}}>중순위 <strong>{numCell(mez.amt)}</strong> 천원</span>,
      rate:  <span style={{fontWeight:'bold',color:'#2c3e50'}}>{d.mezFee||'0'}</span>,
      rateLabel: '% (1회)',
      amt:   autoCell(mezFeeAmt),
      funding: pfBadge,
    },
    {
      num:'⑦', label:'후순위 취급수수료', editable: true,
      basis: <span style={{fontSize:'11px',color:'#555'}}>후순위 <strong>{numCell(junior.amt)}</strong> 천원</span>,
      rate:  <span style={{fontWeight:'bold',color:'#2c3e50'}}>{d.juniorFee||'0'}</span>,
      rateLabel: '% (1회)',
      amt:   autoCell(juniorFeeAmt),
      funding: pfBadge,
    },
    {
      num:'⑧', label:'중도금 무이자', editable: true,
      basis: <span style={{fontSize:'11px',color:'#555'}}>중도금 누적잔액 × 이율/12</span>,
      rate:  <span style={{fontWeight:'bold',color:'#2c3e50'}}>{d.midRate||'0'}</span>,
      rateLabel: '% (연)',
      amt:   autoCell(midIntAmt),
      funding: noFundingBadge,
    },
    {
      num:'⑨', label:'미인출수수료', editable: true,
      basis: <span style={{fontSize:'11px',color:'#555'}}>선순위 한도 <strong>{numCell(senior.amt)}</strong> × %</span>,
      rate:  <span style={{fontWeight:'bold',color:'#2c3e50'}}>{d.unindrawnPct||'0'}</span>,
      rateLabel: '% (상환 시)',
      amt:   autoCell(unindrawnAmt),
      funding: noFundingBadge,
    },
    {
      num:'⑩', label:'대여금 이자', editable: true,
      basis: <span style={{fontSize:'11px',color:'#555'}}>대여금 <strong>{numCell(loanAmt)}</strong> 천원</span>,
      rate:  <span style={{fontWeight:'bold',color:'#2c3e50'}}>{d.loanRate||'0'}</span>,
      rateLabel: '% (연)',
      amt:   autoCell(loanIntAmt),
      funding: noFundingBadge,
    },
  ];

  return (
    <div>
      {sectionTitle('금융비')}

      {/* PF 요약 */}
      <div style={{ display:'flex', gap:'10px', flexWrap:'wrap', marginBottom:'16px' }}>
        {[
          { label:'PF 총액',  val:totalPF,    color:'#1a1a2e' },
          { label:'선순위',    val:senior.amt, color:'#1a5276' },
          { label:'중순위',    val:mez.amt,    color:'#6c3483' },
          { label:'후순위',    val:junior.amt, color:'#922b21' },
        ].map(({ label, val, color }) => (
          <div key={label} style={{ padding:'7px 14px', backgroundColor:'#f8f9fa',
            border:`1px solid ${color}30`, borderRadius:'6px' }}>
            <div style={{ fontSize:'10px', color:'#888' }}>{label}</div>
            <div style={{ fontSize:'13px', fontWeight:'bold', color }}>{numCell(val)} 천원</div>
          </div>
        ))}
      </div>

      {/* 테이블 */}
      <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'12px' }}>
        <thead>
          <tr>
            {['항목','근거기준','요율','금액(천원)','재원조달'].map((h,i) => (
              <th key={h} style={{ padding:'7px 8px', backgroundColor:'#f0f0f0',
                fontWeight:'bold', fontSize:'12px', borderBottom:'2px solid #ddd',
                textAlign: i===0?'left':'center' }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.num} style={{ backgroundColor: i%2===0?'white':'#fafafa' }}>
              <td style={{ ...tdS, fontWeight:'bold', color:'#2c3e50' }}>
                <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
                  <span>{r.num} {r.label}</span>
                  {r.editable && (
                    <button
                      onClick={() => window.dispatchEvent(new CustomEvent('navigate-to-finance-cost'))}
                      title="금융탭에서 수정"
                      style={{ padding:'1px 6px', backgroundColor:'transparent', border:'1px solid #ddd',
                        borderRadius:'4px', cursor:'pointer', fontSize:'11px', color:'#e67e22' }}>
                      ✏️
                    </button>
                  )}
                </div>
              </td>
              <td style={{ ...tdS, textAlign:'center' }}>{r.basis}</td>
              <td style={{ ...tdS, textAlign:'center' }}>
                <div style={{ display:'flex', alignItems:'center', gap:'4px', justifyContent:'center' }}>
                  {r.rate}
                  {r.rateLabel && <span style={{ fontSize:'11px', color:'#888' }}>{r.rateLabel}</span>}
                </div>
              </td>
              <td style={{ ...tdS, textAlign:'right', fontWeight:'bold', color:'#2c3e50' }}>
                {r.amt}
              </td>
              <td style={{ ...tdS, textAlign:'center' }}>{r.funding}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr style={{ backgroundColor:'#2c3e50' }}>
            <td colSpan={3} style={{ padding:'9px 8px', color:'white', fontWeight:'bold', fontSize:'13px' }}>
              금융비 합계
            </td>
            <td style={{ padding:'9px 8px', color:'#f1c40f', fontWeight:'bold', fontSize:'14px', textAlign:'right' }}>
              {formatNumber(grandTotal)} 천원
            </td>
            <td style={{ padding:'9px 8px', textAlign:'center' }}>
              <div style={{ fontSize:'10px', color:'rgba(255,255,255,0.5)', marginBottom:'4px' }}>{isFromCalc ? '※ 이자는 현금유출입 계산기 실계산값' : '※ 이자는 연간 기준 추정액 (금융탭 계산 필요)'}</div>
              <button
                onClick={() => window.dispatchEvent(new CustomEvent('navigate-to-finance-cost'))}
                style={{ padding:'4px 10px', backgroundColor:'#e67e22', color:'white',
                  border:'none', borderRadius:'4px', cursor:'pointer', fontSize:'11px', fontWeight:'bold' }}>
                ✏️ 금융탭에서 수정
              </button>
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
function SummaryTab({ costSummary, archData, monthlyPayments, salesData, vatData, financeData, cashFlowResult }) {
  const [openCats, setOpenCats] = React.useState({});
  const toggleCat = (key) => setOpenCats(p=>({...p,[key]:!p[key]}));
  const grandTotal   = costSummary.reduce((s, c) => s + c.total, 0);
  // 재원별 합계: monthlyPayments의 VAT포함 배분값 사용 (공급가 기준 costSummary.funding 대신)
  const mp_ = monthlyPayments || {};
  const allItemKeys = ['landItems','directItems','indirectItems','consultItems','salesItems','taxItems','overheadItems'];
  const grandFunding = { equity: 0, pf: 0, sale: 0 };
  allItemKeys.forEach(key => {
    (mp_[key]||[]).forEach(item => {
      grandFunding.equity += (item.eqMonthly   || []).reduce((s,v)=>s+v,0);
      grandFunding.sale   += (item.saleMonthly || []).reduce((s,v)=>s+v,0);
      grandFunding.pf     += (item.pfMonthly   || []).reduce((s,v)=>s+v,0);
    });
  });

  // monthlyPayments에서 VAT 합계 계산
  const cm = monthlyPayments || {};
  const catKeyMap = { land:'land', direct:'direct', indirect:'indirect', consult:'consult', salesCost:'sales', tax:'tax', overhead:'overhead' };
  const getCatVat = (key) => Object.values(cm[`${catKeyMap[key]||key}Vat`]||{}).reduce((s,v)=>s+v,0);
  const grandVat  = costSummary.reduce((s,c) => s + getCatVat(c.key), 0);
  const grandWithVat = grandTotal + grandVat;

  const thStyle = {
    padding: '8px 12px', backgroundColor: '#2c3e50', color: 'white',
    fontWeight: 'bold', fontSize: '12px', textAlign: 'right',
  };
  const tdStyle = { padding: '8px 12px', borderBottom: '1px solid #eee', textAlign: 'right', fontSize: '13px' };
  const numCell = (v) => formatNumber(Math.round(v));

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h4 style={{ margin: 0, color: '#2c3e50' }}>사업비 합계</h4>
        <div style={{ fontSize: '12px', color: '#888' }}>단위: 천원</div>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
        <thead>
          <tr>
            <th style={{ ...thStyle, textAlign: 'left', width: '180px' }}>카테고리</th>
            <th style={thStyle}>합계</th>
            {FUNDING_KEYS.map(k => (
              <th key={k} style={{ ...thStyle, backgroundColor: FUNDING_COLORS[k].border }}>
                <span style={{ color: FUNDING_COLORS[k].color, backgroundColor: FUNDING_COLORS[k].bg, padding: '2px 8px', borderRadius: '8px' }}>
                  {FUNDING_LABELS[k]}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {costSummary.map((cat, i) => {
            const catVat     = getCatVat(cat.key);
            const totalWithVat = cat.total + catVat;
            // 재원별: monthlyPayments VAT포함 배분값
            const catItemsKey = { land:'landItems', direct:'directItems', indirect:'indirectItems',
              consult:'consultItems', salesCost:'salesItems', tax:'taxItems', overhead:'overheadItems' };
            const mpItems = mp_[catItemsKey[cat.key]] || [];
            const catFundingVat = {
              equity: mpItems.reduce((s,it)=>s+(it.eqMonthly||[]).reduce((ss,v)=>ss+v,0),0),
              pf:     mpItems.reduce((s,it)=>s+(it.pfMonthly||[]).reduce((ss,v)=>ss+v,0),0),
              sale:   mpItems.reduce((s,it)=>s+(it.saleMonthly||[]).reduce((ss,v)=>ss+v,0),0),
            };
            return (
              <tr key={cat.key} style={{ backgroundColor: i % 2 === 0 ? 'white' : '#fafafa' }}>
                <td style={{ ...tdStyle, textAlign: 'left' }}>
                  <span style={{
                    display: 'inline-block', width: '8px', height: '8px',
                    borderRadius: '50%', backgroundColor: cat.color, marginRight: '8px',
                  }} />
                  <span style={{ fontWeight: 'bold' }}>{cat.label}</span>
                </td>
                <td style={{ ...tdStyle, fontWeight: 'bold', color: '#2c3e50' }}>
                  <div>{numCell(totalWithVat)}</div>
                  {catVat > 0 && (
                    <div style={{ fontSize:'10px', fontWeight:'normal', marginTop:'2px', lineHeight:'1.6' }}>
                      <span style={{ color:'#7f8c8d' }}>공급가 </span><span style={{ color:'#2c3e50' }}>{numCell(cat.total)}</span>
                      <span style={{ color:'#7f8c8d' }}> / VAT </span><span style={{ color:'#e67e22' }}>{numCell(catVat)}</span>
                      <span style={{ color:'#7f8c8d' }}> / 합계 </span><span style={{ color:'#c0392b', fontWeight:'bold' }}>{numCell(totalWithVat)}</span>
                    </div>
                  )}
                </td>
                {FUNDING_KEYS.map(k => {
                  const fWithVat = catFundingVat[k] || 0;
                  return (
                    <td key={k} style={{ ...tdStyle, color: fWithVat > 0 ? FUNDING_COLORS[k].color : '#ccc' }}>
                      {fWithVat > 0 ? <div>{numCell(fWithVat)}</div> : '—'}
                    </td>
                  );
                })}
              </tr>
            );
          })}

          {/* 금융비 행 */}
          {(() => {
            const pnv = (v) => parseFloat(String(v||'').replace(/,/g,''))||0;
            const d   = financeData?.financeCost || {};
            const ltv = financeData?.ltvCalc     || {};
            const tr  = ltv.tranches || [];
            const getT = (name) => tr.find(t=>t.name?.includes(name))||{};
            const seniorAmt  = pnv(getT('선순위').savedAmt||0);
            const mezAmt     = pnv(getT('중순위').savedAmt||0);
            const juniorAmt  = pnv(getT('후순위').savedAmt||0);
            const seniorRate = parseFloat(getT('선순위').rate||0);
            const mezRate    = parseFloat(getT('중순위').rate||0);
            const juniorRate = parseFloat(getT('후순위').rate||0);
            const totalPF    = seniorAmt + mezAmt + juniorAmt;
            if (totalPF === 0) return (
              <tr style={{ backgroundColor:'white' }}>
                <td style={{ ...tdStyle, textAlign:'left', color:'#bbb' }}>
                  <span style={{ display:'inline-block', width:'8px', height:'8px', borderRadius:'50%', backgroundColor:'#ddd', marginRight:'8px' }} />
                  금융비
                </td>
                <td colSpan={4} style={{ ...tdStyle, color:'#bbb', textAlign:'center', fontSize:'11px' }}>준비 중 (LTV/트랜치 설정 필요)</td>
              </tr>
            );
            // 금융비 총액 계산
            const mgmtAmt      = Math.round(totalPF * pnv(d.mgmtPct) / 100);
            const seniorFeeAmt = Math.round(seniorAmt * pnv(d.seniorFee) / 100);
            const mezFeeAmt    = Math.round(mezAmt    * pnv(d.mezFee)    / 100);
            const juniorFeeAmt = Math.round(juniorAmt * pnv(d.juniorFee) / 100);
            const unindrawnAmt = Math.round(seniorAmt * pnv(d.unindrawnPct) / 100);
            const loanIntAmt   = Math.round(pnv(d.loanAmt) * pnv(d.loanRate) / 100);
            // 이자: cashFlowResult에서 가져옴 (재계산 없음)
            const cfr = cashFlowResult;
            const seniorIntAmt = cfr ? cfr.result.reduce((s,r)=>s+(r.intS||0),0) : Math.round(seniorAmt * seniorRate / 100);
            const mezIntAmt    = cfr ? cfr.result.reduce((s,r)=>s+(r.intM||0),0) : Math.round(mezAmt    * mezRate    / 100);
            const juniorIntAmt = cfr ? cfr.result.reduce((s,r)=>s+(r.intJ||0),0) : Math.round(juniorAmt * juniorRate / 100);
            const midIntTotal  = cfr ? cfr.result.reduce((s,r)=>s+(r.midInt||0),0) : (() => {
              const ymList_ = salesData?.ymList || [];
              const aptMid_ = salesData?.aptMidMonthly || [], offiMid_ = salesData?.offiMidMonthly || [], storeMid_ = salesData?.storeMidMonthly || [];
              const aptBal_ = salesData?.aptBalMonthly || [], offiBal_ = salesData?.offiBalMonthly || [], storeBal_ = salesData?.storeBalMonthly || [];
              const totalMid_ = [...aptMid_,...offiMid_,...storeMid_].reduce((s,v)=>s+(v||0),0);
              const totalBal_ = [...aptBal_,...offiBal_,...storeBal_].reduce((s,v)=>s+(v||0),0);
              let midAccum=0, midRepaid=0, tot=0;
              const midRate_ = pnv(d.midRate)/100/12;
              ymList_.forEach((ym,i)=>{ midAccum+=(aptMid_[i]||0)+(offiMid_[i]||0)+(storeMid_[i]||0); const b=(aptBal_[i]||0)+(offiBal_[i]||0)+(storeBal_[i]||0); if(totalBal_>0&&b>0)midRepaid+=Math.round(totalMid_*b/totalBal_); tot+=Math.round(Math.max(0,midAccum-midRepaid)*midRate_); });
              return tot;
            })();
            const finTotal = mgmtAmt+seniorFeeAmt+mezFeeAmt+juniorFeeAmt
              +seniorIntAmt+mezIntAmt+juniorIntAmt+midIntTotal+unindrawnAmt+loanIntAmt;
            const bg = costSummary.length % 2 === 0 ? 'white' : '#fafafa';
            return (
              <tr style={{ backgroundColor:bg }}>
                <td style={{ ...tdStyle, textAlign:'left', fontWeight:'bold' }}>
                  <span style={{ display:'inline-block', width:'8px', height:'8px', borderRadius:'50%', backgroundColor:'#e67e22', marginRight:'8px' }} />
                  금융비
                </td>
                <td style={{ ...tdStyle, fontWeight:'bold', color:'#2c3e50' }}>
                  <div>{numCell(finTotal)}</div>
                  <div style={{ fontSize:'10px', color: cfr?'#27ae60':'#e67e22', marginTop:'2px' }}>{cfr?'실계산값':'연간 기준 추정'}</div>
                </td>
                <td style={{ ...tdStyle, color:'#888', fontSize:'10px' }}>—</td>
                <td style={{ ...tdStyle, color:'#333', fontWeight:'bold' }}>
                  {numCell(mgmtAmt+seniorFeeAmt+mezFeeAmt+juniorFeeAmt)}
                  <div style={{fontSize:'9px',color:'#888'}}>수수료</div>
                </td>
                <td style={{ ...tdStyle, color:'#333', fontWeight:'bold' }}>
                  {numCell(seniorIntAmt+mezIntAmt+juniorIntAmt+midIntTotal)}
                  <div style={{fontSize:'9px',color:'#888'}}>이자</div>
                </td>
              </tr>
            );
          })()}
        </tbody>
        <tfoot>
          {(() => {
            const finTot_ = cashFlowResult
              ? (cashFlowResult.months||[]).reduce((s,ym,i)=>{ const r=cashFlowResult.result[i]||{}; return s+(r.intS||0)+(r.intM||0)+(r.intJ||0)+(r.midInt||0)+(r.fee||0); },0)
              : 0;
            const pnv_ = (v) => parseFloat(String(v||'').replace(/,/g,''))||0;
            const d_ = financeData?.financeCost || {};
            const ltv_ = financeData?.ltvCalc || {};
            const getT_ = (name) => (ltv_.tranches||[]).find(t=>t.name?.includes(name))||{};
            const feeAmt_ = Math.round((pnv_(getT_('선순위').savedAmt||0)+pnv_(getT_('중순위').savedAmt||0)+pnv_(getT_('후순위').savedAmt||0)) * pnv_(d_.mgmtPct) / 100)
              + Math.round(pnv_(getT_('선순위').savedAmt||0) * pnv_(d_.seniorFee) / 100)
              + Math.round(pnv_(getT_('중순위').savedAmt||0) * pnv_(d_.mezFee) / 100)
              + Math.round(pnv_(getT_('후순위').savedAmt||0) * pnv_(d_.juniorFee) / 100);
            const intAmt_ = finTot_ - (cashFlowResult ? (cashFlowResult.months||[]).reduce((s,ym,i)=>s+((cashFlowResult.result[i]||{}).fee||0),0) : feeAmt_);
            const grandWithFinTotal = grandWithVat + finTot_;
            // 재원별 금융비 배분: 에쿼티(0) | 필수사업비(수수료) | 분양불(이자)
            const finFunding = { equity: 0, pf: feeAmt_, sale: finTot_ - feeAmt_ };
            return (
              <tr style={{ backgroundColor: '#2c3e50' }}>
                <td style={{ padding: '10px 12px', color: 'white', fontWeight: 'bold', fontSize: '14px' }}>총 사업비</td>
                <td style={{ padding: '10px 12px', color: '#f1c40f', fontWeight: 'bold', fontSize: '15px', textAlign: 'right' }}>
                  <div>{numCell(grandWithFinTotal)}</div>
                  <div style={{ fontSize:'10px', fontWeight:'normal', marginTop:'2px', lineHeight:'1.6' }}>
                    <span style={{ color:'rgba(255,255,255,0.6)' }}>공급가 </span><span style={{ color:'#ecf0f1' }}>{numCell(grandTotal)}</span>
                    <span style={{ color:'rgba(255,255,255,0.6)' }}> / VAT </span><span style={{ color:'#f39c12' }}>{numCell(grandVat)}</span>
                    {finTot_>0 && <><span style={{ color:'rgba(255,255,255,0.6)' }}> / 금융비 </span><span style={{ color:'#f39c12' }}>{numCell(finTot_)}</span></>}
                    <span style={{ color:'rgba(255,255,255,0.6)' }}> / 합계 </span><span style={{ color:'#f1c40f' }}>{numCell(grandWithFinTotal)}</span>
                  </div>
                </td>
                {FUNDING_KEYS.map(k => (
                  <td key={k} style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 'bold' }}>
                    <span style={{ fontSize: '13px', color: '#f1c40f', fontWeight:'bold' }}>
                      {numCell(Math.round((grandFunding[k]||0) + (finFunding[k]||0)))}
                    </span>
                  </td>
                ))}
              </tr>
            );
          })()}
        </tfoot>
      </table>
      {/* ── 월별 타임라인 ── */}
      {(() => {
        const cm = monthlyPayments || {};
        const vatByMonth = salesData?.vatByMonth || {};
        const prepPeriod  = parseFloat(String(archData?.prepPeriod||'').replace(/,/g,''))||0;
        const conPeriod   = parseFloat(String(archData?.constructPeriod||'').replace(/,/g,''))||24;
        const settlePeriod= parseFloat(String(archData?.settlePeriod||'').replace(/,/g,''))||6;
        const totalPeriod = Math.ceil(prepPeriod + conPeriod + settlePeriod);
        const conYear  = parseInt(archData?.constructYear)  || new Date().getFullYear();
        const conMonth = parseInt(archData?.constructMonth) || 1;
        const addM = (y, m, n) => { const t=(y-1)*12+(m-1)+n; return { year:Math.floor(t/12)+1, month:t%12+1 }; };
        const fmtYM = (y, m) => `${y}.${String(m).padStart(2,'0')}`;
        // monthlyPayments.months 사용 (calcMonthlyPayments와 완전 동일한 월 목록)
        const allMonths = cm.months || (() => {
          const bizS = addM(conYear, conMonth, -Math.round(prepPeriod));
          return Array.from({length:totalPeriod},(_,i)=>{ const r=addM(bizS.year,bizS.month,i); return fmtYM(r.year,r.month); });
        })();
        const conYM_  = fmtYM(conYear, conMonth);
        const compR   = addM(conYear, conMonth, Math.round(conPeriod)-1);
        const compYM_ = fmtYM(compR.year, compR.month);
        const taxRatio_ = parseFloat(vatData?.taxRatio) || 0;

        const cats = [
          { key:'land',     label:'토지관련비용' },
          { key:'direct',   label:'직접공사비'   },
          { key:'indirect', label:'간접공사비'   },
          { key:'consult',  label:'용역비'       },
          { key:'sales',    label:'판매비'       },
          { key:'overhead', label:'부대비'       },
          { key:'tax',      label:'제세금'       },
        ];

        const inputVatByMonth = {};
        cats.forEach(cat => {
          Object.entries(cm[`${cat.key}Vat`]||{}).forEach(([ym,v]) => {
            inputVatByMonth[ym] = (inputVatByMonth[ym]||0) + v;
          });
        });

        // 분기별 부가세 정산
        const settleYMs = [...new Set([
          ...allMonths.filter(ym=>[1,4,7,10].includes(parseInt(ym.split('.')[1]))),
          allMonths[allMonths.length-1]
        ])].sort();
        const vatSettlements = {};
        let prevIdx = 0;
        settleYMs.forEach(sYM => {
          const idx = allMonths.indexOf(sYM);
          if(idx<0) return;
          const period = allMonths.slice(prevIdx, idx+1);
          const outVat = period.reduce((s,ym)=>s+(vatByMonth[ym]||0),0);
          const inVat  = period.reduce((s,ym)=>s+(inputVatByMonth[ym]||0),0);
          const v = Math.round(outVat - inVat * taxRatio_);
          if(v!==0) vatSettlements[sYM] = v;
          prevIdx = idx+1;
        });

        const hasData = cats.some(cat=>Object.keys(cm[cat.key]||{}).length>0);
        if(!hasData) return (
          <div style={{marginTop:'20px',padding:'12px 16px',backgroundColor:'#f8f9fa',borderRadius:'8px',fontSize:'12px',color:'#888'}}>
            💡 지급 설정 후 월별 타임라인이 자동 생성됩니다.
          </div>
        );

        const thS_ = {padding:'4px 6px',fontSize:'10px',fontWeight:'bold',textAlign:'right',whiteSpace:'nowrap',color:'white',backgroundColor:'#455a64'};
        const tdS_ = {padding:'3px 5px',fontSize:'11px',textAlign:'right',borderBottom:'1px solid #f0f0f0'};

        // 카테고리별 합계/VAT 계산 (VAT포함 기준으로 통일)
        const catTotals = {};
        const catVatTotals = {};
        const catWithVat = {}; // VAT포함 월별
        cats.forEach(cat => {
          catTotals[cat.key]    = Object.values(cm[cat.key]||{}).reduce((s,v)=>s+v,0);
          catVatTotals[cat.key] = Object.values(cm[`${cat.key}Vat`]||{}).reduce((s,v)=>s+v,0);
          // 월별 VAT포함 합계
          const supply = cm[cat.key]||{};
          const vat    = cm[`${cat.key}Vat`]||{};
          catWithVat[cat.key] = {};
          allMonths.forEach(ym => {
            const v = (supply[ym]||0) + (vat[ym]||0);
            if (v > 0) catWithVat[cat.key][ym] = v;
          });
        });
        const grandSupply = cats.reduce((s,cat)=>s+catTotals[cat.key],0);
        const grandVat    = cats.reduce((s,cat)=>s+catVatTotals[cat.key],0);
        const grandExpend = grandSupply + grandVat; // = VAT포함 합계

        return (
          <div style={{marginTop:'24px'}}>
            <div style={{fontWeight:'bold',fontSize:'14px',color:'#2c3e50',marginBottom:'12px',paddingBottom:'5px',borderBottom:'2px solid #e0e0e0',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <span>📅 월별 사업비 타임라인</span>
              <span style={{fontSize:'11px',fontWeight:'normal',color:'#888'}}>
                {taxRatio_>0 && `과세비율 ${(taxRatio_*100).toFixed(2)}%`}
              </span>
            </div>
            <div style={{overflowX:'auto'}}>
              <table style={{borderCollapse:'collapse',fontSize:'11px',minWidth:'100%'}}>
                <thead>
                  <tr>
                    <th style={{...thS_,textAlign:'left',minWidth:'110px',position:'sticky',left:0,zIndex:2}}>항목</th>
                    <th style={{...thS_,minWidth:'80px'}}>합계</th>
                    {allMonths.map(ym=>(
                      <th key={ym} style={{...thS_,minWidth:'58px',
                        backgroundColor:(ym===conYM_||ym===compYM_)?'#c0392b':'#455a64'}}>
                        {ym.slice(2)}
                        {ym===conYM_&&<div style={{fontSize:'8px',opacity:0.8}}>착공</div>}
                        {ym===compYM_&&<div style={{fontSize:'8px',opacity:0.8}}>준공</div>}
                      </th>
                    ))}
                    <th style={{...thS_,minWidth:'80px'}}>합계</th>
                  </tr>
                </thead>
                <tbody>
                  {/* 카테고리별 공급금액 행 (아코디언) */}
                  {cats.map((cat,ci)=>{
                    const monthly  = cm[cat.key]||{};
                    const total    = catTotals[cat.key];
                    if(total===0) return null;
                    const bg       = ci%2===0?'white':'#fafafa';
                    const isOpen   = openCats[cat.key];
                    // items: eqMonthly, saleMonthly, pfMonthly 포함
                    const itemsKey = {land:'landItems',direct:'directItems',indirect:'indirectItems',consult:'consultItems',sales:'salesItems',tax:'taxItems',overhead:'overheadItems'}[cat.key];
                    const items    = (cm[itemsKey]||[]).filter(item=>item.monthly?.reduce((s,v)=>s+v,0)>0);

                    const FUND_ROWS = [
                      { key:'eq',   label:'에쿼티', color:'#1a3a5c', bg:'#e8f0f8', getArr: item=>item.eqMonthly   },
                      { key:'sale', label:'분양불', color:'#1a5c2a', bg:'#e8f5ec', getArr: item=>item.saleMonthly },
                      { key:'pf',   label:'필수사업비', color:'#6c3483', bg:'#f5eef8', getArr: item=>item.pfMonthly   },
                    ];

                    return (
                      <React.Fragment key={cat.key}>
                        {/* 카테고리 헤더 행 (VAT포함) */}
                        {(() => {
                          const catTotal_ = catTotals[cat.key] + catVatTotals[cat.key];
                          return (
                            <tr style={{backgroundColor:bg, cursor:'pointer'}} onClick={()=>toggleCat(cat.key)}>
                              <td style={{...tdS_,textAlign:'left',fontWeight:'bold',color:'#2c3e50',position:'sticky',left:0,backgroundColor:bg,zIndex:1}}>
                                <span style={{marginRight:'5px',fontSize:'10px'}}>{isOpen?'▼':'▶'}</span>
                                {cat.label}
                              </td>
                              <td style={{...tdS_,fontWeight:'bold',color:'#2c3e50'}}>{formatNumber(catTotal_)}</td>
                              {allMonths.map(ym=>{const v=catWithVat[cat.key]?.[ym]||0; return(
                                <td key={ym} style={{...tdS_,color:v>0?'#2c3e50':'#ddd'}}>{v>0?formatNumber(v):'—'}</td>
                              );})}
                              <td style={{...tdS_,fontWeight:'bold',color:'#2c3e50'}}>{formatNumber(catTotal_)}</td>
                            </tr>
                          );
                        })()}
                        {/* 펼쳐진 세부항목 */}
                        {isOpen && items.map((item,ii)=>(
                          <React.Fragment key={ii}>
                            {/* 항목명 행 */}
                            <tr style={{backgroundColor:'#f8f9fa'}}>
                              <td style={{...tdS_,textAlign:'left',color:'#444',paddingLeft:'20px',position:'sticky',left:0,backgroundColor:'#f8f9fa',zIndex:1,fontWeight:'bold'}}>
                                {item.label}
                              </td>
                              <td style={{...tdS_,color:'#444',fontWeight:'bold'}}>{formatNumber(item.monthly?.reduce((s,v)=>s+v,0)||0)}</td>
                              {allMonths.map((ym,mi)=>{
                                const v=item.monthly?.[mi]||0;
                                return <td key={ym} style={{...tdS_,color:v>0?'#444':'#ddd'}}>{v>0?formatNumber(v):'—'}</td>;
                              })}
                              <td style={{...tdS_,color:'#444',fontWeight:'bold'}}>{formatNumber(item.monthly?.reduce((s,v)=>s+v,0)||0)}</td>
                            </tr>
                            {/* 재원별 행 (에쿼티/분양불/PF) */}
                            {FUND_ROWS.map(fr=>{
                              const arr   = fr.getArr(item)||[];
                              const total_ = arr.reduce((s,v)=>s+v,0);
                              if(total_===0) return null;
                              return (
                                <tr key={fr.key} style={{backgroundColor:fr.bg}}>
                                  <td style={{...tdS_,textAlign:'left',color:fr.color,paddingLeft:'32px',position:'sticky',left:0,backgroundColor:fr.bg,zIndex:1}}>
                                    └ {fr.label}
                                  </td>
                                  <td style={{...tdS_,color:fr.color,fontWeight:'bold'}}>{formatNumber(total_)}</td>
                                  {allMonths.map((ym,mi)=>{
                                    const v=arr[mi]||0;
                                    return <td key={ym} style={{...tdS_,color:v>0?fr.color:'#ddd'}}>{v>0?formatNumber(v):'—'}</td>;
                                  })}
                                  <td style={{...tdS_,color:fr.color,fontWeight:'bold'}}>{formatNumber(total_)}</td>
                                </tr>
                              );
                            })}
                          </React.Fragment>
                        ))}
                      </React.Fragment>
                    );
                  })}

                  {/* 금융비 행 (아코디언) */}
                  {cashFlowResult && (() => {
                    const cfMonths = cashFlowResult.months || [];
                    // 항목별 월별 배열
                    const finItems_ = [
                      { key:'fee',    label:'금융비 — ① 주관사수수료', color:'#7d5a00', getV: r=>(r.fee||0)    },
                      { key:'intS',   label:'금융비 — ② 선순위 이자',  color:'#1a5276', getV: r=>(r.intS||0)   },
                      { key:'intM',   label:'금융비 — ③ 중순위 이자',  color:'#6c3483', getV: r=>(r.intM||0)   },
                      { key:'intJ',   label:'금융비 — ④ 후순위 이자',  color:'#922b21', getV: r=>(r.intJ||0)   },
                      { key:'midInt', label:'금융비 — ⑧ 중도금 무이자',color:'#1a5c2a', getV: r=>(r.midInt||0) },
                    ].map(item => {
                      const byYM = {};
                      cfMonths.forEach((ym,i) => { const v=item.getV(cashFlowResult.result[i]||{}); if(v>0) byYM[ym]=v; });
                      const total = Object.values(byYM).reduce((s,v)=>s+v,0);
                      return { ...item, byYM, total };
                    }).filter(item => item.total > 0);

                    const finByYM = {};
                    cfMonths.forEach((ym,i) => {
                      const r = cashFlowResult.result[i] || {};
                      const v = (r.intS||0)+(r.intM||0)+(r.intJ||0)+(r.midInt||0)+(r.fee||0);
                      if(v>0) finByYM[ym]=v;
                    });
                    const finTotal_ = Object.values(finByYM).reduce((s,v)=>s+v,0);
                    if(!finTotal_) return null;
                    const isOpen = openCats['finance'];
                    return (
                      <React.Fragment>
                        {/* 금융비 헤더 행 */}
                        <tr style={{backgroundColor:'#fff8f0', cursor:'pointer'}} onClick={()=>toggleCat('finance')}>
                          <td style={{...tdS_,textAlign:'left',fontWeight:'bold',color:'#e67e22',position:'sticky',left:0,backgroundColor:'#fff8f0',zIndex:1}}>
                            <span style={{marginRight:'5px',fontSize:'10px'}}>{isOpen?'▼':'▶'}</span>
                            금융비
                          </td>
                          <td style={{...tdS_,fontWeight:'bold',color:'#e67e22'}}>{formatNumber(finTotal_)}</td>
                          {allMonths.map(ym=>{const v=finByYM[ym]||0; return(
                            <td key={ym} style={{...tdS_,color:v>0?'#e67e22':'#ddd'}}>{v>0?formatNumber(v):'—'}</td>
                          );})}
                          <td style={{...tdS_,fontWeight:'bold',color:'#e67e22'}}>{formatNumber(finTotal_)}</td>
                        </tr>
                        {/* 펼쳐진 세부항목 */}
                        {isOpen && finItems_.map(item=>(
                          <tr key={item.key} style={{backgroundColor:'#fffaf5'}}>
                            <td style={{...tdS_,textAlign:'left',color:item.color,paddingLeft:'20px',position:'sticky',left:0,backgroundColor:'#fffaf5',zIndex:1}}>
                              {item.label}
                            </td>
                            <td style={{...tdS_,color:item.color,fontWeight:'bold'}}>{formatNumber(item.total)}</td>
                            {allMonths.map(ym=>{const v=item.byYM[ym]||0; return(
                              <td key={ym} style={{...tdS_,color:v>0?item.color:'#ddd'}}>{v>0?formatNumber(v):'—'}</td>
                            );})}
                            <td style={{...tdS_,color:item.color,fontWeight:'bold'}}>{formatNumber(item.total)}</td>
                          </tr>
                        ))}
                      </React.Fragment>
                    );
                  })()}

                  {/* 공급금액 행 (VAT제외) */}
                  {(() => {
                    const finTotal_ = cashFlowResult ? (cashFlowResult.months||[]).reduce((s,ym,i)=>{ const r=cashFlowResult.result[i]||{}; return s+(r.intS||0)+(r.intM||0)+(r.intJ||0)+(r.midInt||0)+(r.fee||0); },0) : 0;
                    // 공급금액 = VAT제외 사업비 합계
                    const grandSupplyWithFin = grandSupply + finTotal_;
                    return (
                      <tr style={{backgroundColor:'#ecf0f1'}}>
                        <td style={{...tdS_,textAlign:'left',fontWeight:'bold',color:'#2c3e50',position:'sticky',left:0,backgroundColor:'#ecf0f1',zIndex:1}}>공급금액 (VAT제외)</td>
                        <td style={{...tdS_,fontWeight:'bold',color:'#2c3e50'}}>{formatNumber(grandSupplyWithFin)}</td>
                        {allMonths.map(ym=>{
                          const sV=cats.reduce((s,cat)=>s+((cm[cat.key]||{})[ym]||0),0);
                          const fV=cashFlowResult ? (() => { const i=(cashFlowResult.months||[]).indexOf(ym); if(i<0)return 0; const r=cashFlowResult.result[i]||{}; return (r.intS||0)+(r.intM||0)+(r.intJ||0)+(r.midInt||0)+(r.fee||0); })() : 0;
                          const v=sV+fV;
                          return <td key={ym} style={{...tdS_,fontWeight:'bold',color:v>0?'#2c3e50':'#ddd'}}>{v>0?formatNumber(v):'—'}</td>;
                        })}
                        <td style={{...tdS_,fontWeight:'bold',color:'#2c3e50'}}>{formatNumber(grandSupplyWithFin)}</td>
                      </tr>
                    );
                  })()}

                  {/* VAT 행 - 표시용 (위 합계에 포함됨) */}
                  {grandVat>0&&(
                    <tr style={{backgroundColor:'#fff8f0'}}>
                      <td style={{...tdS_,textAlign:'left',color:'#e67e22',position:'sticky',left:0,backgroundColor:'#fff8f0',zIndex:1}}>
                        └ 부가세
                      </td>
                      <td style={{...tdS_,color:'#e67e22'}}>{formatNumber(grandVat)}</td>
                      {allMonths.map(ym=>{
                        const v=cats.reduce((s,cat)=>s+((cm[`${cat.key}Vat`]||{})[ym]||0),0);
                        return <td key={ym} style={{...tdS_,color:v>0?'#e67e22':'#ddd'}}>{v>0?formatNumber(v):'—'}</td>;
                      })}
                      <td style={{...tdS_,color:'#e67e22'}}>{formatNumber(grandVat)}</td>
                    </tr>
                  )}


                </tbody>
              </table>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ─────────────────────────────────────────────
// 메인 사업비 컴포넌트
// ─────────────────────────────────────────────
function ProjectCost({ data, onChange, onSave, saving, archData, incomeData, salesData, vatData, financeData, onFinanceChange, onResultChange, cashFlowResult }) {
  const [subTab, setSubTab]         = useState('합계');
  const [settingsData, setSettingsData] = useState({ stdCosts: [], artRates: [] });
  const [categoryMonthly, setCategoryMonthly] = useState({});  // 지급패턴 월별 데이터 (실시간)
  const [showCrossCheck, setShowCrossCheck] = useState(false);
  const [showFunding,    setShowFunding]    = useState(false);

  // 기준정보 로드 (Firestore settings)
  const loadSettings = React.useCallback(async () => {
    try {
      const stdSnap = await getDoc(doc(db, 'settings', 'stdCost'));
      const artSnap = await getDoc(doc(db, 'settings', 'artRates'));
      const moefSnap2 = await getDoc(doc(db, 'settings', 'moefStdCost'));
      setSettingsData({
        stdCosts:   stdSnap.exists()   ? (stdSnap.data().items   || []) : [{ year: '2026', cost: '2392000', note: '국토부 고시' }],
        artRates:   artSnap.exists()   ? (artSnap.data().items   || []) : [{ region: '부산광역시', ordinance: '부산광역시 조례 제5조', residRate: '0.1', nonResidRate: '0.5' }],
        moefCosts:  moefSnap2.exists() ? (moefSnap2.data().items || []) : [
          { year: '2026', usage: '주거용(아파트 등)', cost: '860000' },
          { year: '2026', usage: '상업용(상가 등)',   cost: '860000' },
          { year: '2026', usage: '공업용(공장 등)',   cost: '840000' },
        ],
      });
        // 국민주택채권 기준 로드
        try {
          const bondSnap2 = await getDoc(doc(db, 'settings', 'bondRates'));
          if (bondSnap2.exists()) setSettingsData(prev => ({ ...prev, bondRates: bondSnap2.data() }));
          else setSettingsData(prev => ({ ...prev, bondRates: { buyRate: '50', discRate: '13.5' } }));
        } catch(e) { console.error(e); }

        // 공정율 테이블 로드
        try {
          const progressSnap2 = await getDoc(doc(db, 'settings', 'progressRates'));
          if (progressSnap2.exists()) setSettingsData(prev => ({ ...prev, progressRates: progressSnap2.data() }));
          else setSettingsData(prev => ({ ...prev, progressRates: {} }));
        } catch(e) { console.error(e); }

        // 제세금 기준단가도 로드
        try {
          const taxSnap2 = await getDoc(doc(db, 'settings', 'taxTables'));
          if (taxSnap2.exists()) setSettingsData(prev => ({ ...prev, taxTables: taxSnap2.data() }));
          const gasSnap2 = await getDoc(doc(db, 'settings', 'gasRates'));
          if (gasSnap2.exists()) setSettingsData(prev => ({ ...prev, gasRates: gasSnap2.data().items || [] }));
          else setSettingsData(prev => ({ ...prev, gasRates: [{ year: '2026', city: '부산', rate: '22169', note: '부산 도시가스 공급규정' }] }));
          const waterSnap2 = await getDoc(doc(db, 'settings', 'waterRates'));
          if (waterSnap2.exists()) setSettingsData(prev => ({ ...prev, waterRates: waterSnap2.data() }));
          else setSettingsData(prev => ({ ...prev, waterRates: {
            entries: [{ year:'2026', city:'부산', ordinance:'부산광역시 상수도 원인자부담금 징수 조례 제5조·제6조',
              large:'926000', medium:'744000', dailyUse:'196', peakRate:'1.0', avgPerson:'2.38',
              mediumPipes: {'15':'749','20':'1663','25':'2972','32':'6050','40':'8349','50':'16234','80':'39437','100':'76411','150':'359302','200':'570082','250':'780861','300':'2316751'},
              smallPipes:  {'15':'310','20':'838','25':'1490','32':'2700','40':'4559','50':'7266'},
            }],
          }}));
          const sewerSnap2 = await getDoc(doc(db, 'settings', 'sewerRates'));
          if (sewerSnap2.exists()) setSettingsData(prev => ({ ...prev, sewerRates: sewerSnap2.data() }));
          else setSettingsData(prev => ({ ...prev, sewerRates: { entries: [{ year:'2025', city:'부산', ordinance:'부산광역시 하수도 사용 조례 제10조·제12조', unitCost:'1761000' }] }}));
        } catch(e) { console.error(e); }
      } catch(e) { console.error('settings load error:', e); }
  }, []);  // eslint-disable-line

  useEffect(() => {
    loadSettings();
    const handleSettingsSaved = () => { loadSettings(); };
    window.addEventListener('settings-saved', handleSettingsSaved);
    return () => window.removeEventListener('settings-saved', handleSettingsSaved);
  }, [loadSettings]);

  const landData     = data.land     || {};
  const directData   = data.direct   || {};
  const indirectData  = data.indirect  || {};
  const consultData   = data.consult   || {};
  const salesCostData  = data.salesCost  || {};
  const overheadData   = data.overhead   || {};
  const taxData        = data.tax        || {};

  // ── 부가세 과세비율 (VATCalculation에서 저장된 값) ──
  const taxRatioVAT = parseFloat(vatData?.taxRatio) || 0;  // 0~1
  const updateLand     = (val) => onChange({ ...data, land:     val });
  const updateDirect   = (val) => onChange({ ...data, direct:   val });
  const updateIndirect  = (val) => onChange({ ...data, indirect:  val });
  const updateConsult    = (val) => onChange({ ...data, consult:    val });
  const updateSalesCost   = (val) => onChange({ ...data, salesCost:   val });
  const updateOverhead    = (val) => onChange({ ...data, overhead:    val });
  const updateTax         = (val) => onChange({ ...data, tax:        val });

  // ── 토지관련비용 합계 + 재원 ──
  const calcLand = () => {
    const plots = archData?.plots || [];
    const totalM2 = plots.reduce((s, p) => s + (parseFloat(parseNumber(p.areaM2)) || 0), 0);
    const totalPy = totalM2 * 0.3025;

    const groups = ['A', 'B', 'C', 'D'];
    const landGroupData = landData.landGroups || {};
    const activeGroups = groups.filter(g => {
      const gM2 = plots.filter(p => (p.group || 'A') === g)
        .reduce((s, p) => s + (parseFloat(parseNumber(p.areaM2)) || 0), 0);
      return gM2 > 0;
    });
    const groupLandAmts_main = {};
    activeGroups.forEach(g => {
      const gM2 = plots.filter(p => (p.group || 'A') === g)
        .reduce((s, p) => s + (parseFloat(parseNumber(p.areaM2)) || 0), 0);
      const gPy = gM2 * 0.3025;
      const gd  = landGroupData[g] || {};
      const gPyPrice  = parseFloat(parseNumber(gd.pyPrice)) || 0;
      const gCalcAmt  = Math.round(gPyPrice * gPy);
      const gOverride = parseFloat(parseNumber(gd.override));
      groupLandAmts_main[g] = gOverride > 0 ? gOverride : gCalcAmt;
    });
    let landAmt;
    if (activeGroups.length > 0) {
      landAmt = activeGroups.reduce((s, g) => s + groupLandAmts_main[g], 0);
    } else {
      const pyPrice = parseFloat(parseNumber(landData.landPyPrice)) || 0;
      const calcL   = Math.round(pyPrice * totalPy);
      const ov      = parseFloat(parseNumber(landData.landOverride));
      landAmt = ov > 0 ? ov : calcL;
    }

    const acqRate = parseFloat(landData.acqTaxRate ?? '4.6') || 0;
    const acqAmt  = landData.acqTaxOverride
      ? parseFloat(parseNumber(landData.acqTaxOverride)) || 0
      : Math.round(landAmt * acqRate / 100);
    const bondPublic = plots.reduce((s, p) => s + (parseFloat(parseNumber(p.totalPrice)) || 0), 0);
    const bondBuyR   = parseFloat(landData.bondBuyRate  ?? '50')   || 0;
    const bondDiscR  = parseFloat(landData.bondDiscRate ?? '13.5') || 0;
    const bondAmt    = landData.bondOverride
      ? parseFloat(parseNumber(landData.bondOverride)) || 0
      : Math.round(bondPublic * bondBuyR / 1000 * bondDiscR / 100 / 1000);
    const legalRate = parseFloat(landData.legalRate ?? '0.3') || 0;
    const legalAmt  = (landData.legalMode || 'rate') === 'rate'
      ? Math.round(landAmt * legalRate / 100)
      : parseFloat(parseNumber(landData.legalDirect)) || 0;
    const agentGroupRates = landData.agentGroupRates || {};
    const agentMode = landData.agentMode || 'rate';
    let agentAmt = 0;
    if (agentMode === 'rate' && activeGroups.length > 0) {
      activeGroups.forEach(g => {
        const rate = parseFloat(agentGroupRates[g] ?? '0.5') || 0;
        agentAmt += Math.round(groupLandAmts_main[g] * rate / 100);
      });
    } else {
      agentAmt = parseFloat(parseNumber(landData.agentDirect)) || 0;
    }
    const etcItems  = landData.etcItems || [];
    const rows = [
      { funding: landData.land_funding,  amt: landAmt  },
      { funding: landData.acq_funding,   amt: acqAmt   },
      { funding: landData.bond_funding,  amt: bondAmt  },
      { funding: landData.legal_funding, amt: legalAmt },
      { funding: landData.agent_funding, amt: agentAmt },
      ...etcItems.map(it => ({ funding: it.funding, amt: parseFloat(parseNumber(it.amt)) || 0 })),
    ];
    const total   = rows.reduce((s, r) => s + r.amt, 0);
    const funding = calcFundingSummary(rows);
    return { total, funding, landAmt, acqAmt, bondAmt, legalAmt, agentAmt };
  };
  const landResult = calcLand();

  // ── 직접공사비 합계 + 재원 ──
  const calcDirect = () => {
    const aboveM2 = parseFloat(parseNumber(archData?.floorAboveM2)) || 0;
    const underM2 = parseFloat(parseNumber(archData?.floorUnderM2)) || 0;
    const totalFloorM2  = aboveM2 + underM2;
    const constUnit     = directData.constUnit || '평';
    const constUnitRaw  = parseFloat(parseNumber(directData.constUnitPrice)) || 0;
    const areaForCalc   = constUnit === '평' ? totalFloorM2 * 0.3025 : totalFloorM2;
    const calcC    = Math.round(constUnitRaw * areaForCalc);
    const ov       = parseFloat(parseNumber(directData.constOverride));
    const constAmt = ov > 0 ? ov : calcC;
    const etcItems = directData.etcItems || [];
    const rows = [
      { funding: directData.const_funding, amt: constAmt },
      ...etcItems.map(it => ({ funding: it.funding, amt: parseFloat(parseNumber(it.amt)) || 0 })),
    ];
    const total   = rows.reduce((s, r) => s + r.amt, 0);
    const funding = calcFundingSummary(rows);
    return { total, funding, constAmt };
  };
  const directResult = calcDirect();
  // ── 간접공사비 합계 + 재원 ──
  const calcIndirect = () => {
    const plots        = archData?.plots || [];
    const landM2       = plots.reduce((s, p) => s + (parseFloat(String(p.areaM2||'').replace(/,/g,'')) || 0), 0);
    const farM2        = parseFloat(String(archData?.farAreaM2   || '').replace(/,/g,'')) || 0;
    const aboveM2      = parseFloat(String(archData?.floorAboveM2|| '').replace(/,/g,'')) || 0;
    const underM2      = parseFloat(String(archData?.floorUnderM2|| '').replace(/,/g,'')) || 0;
    const totalFloorM2 = aboveM2 + underM2;
    const permitAmt = calcAreaAmt(indirectData.permitPrice, indirectData.permitUnit || '평', farM2);
    const demolAmt  = calcAreaAmt(indirectData.demolPrice,  indirectData.demolUnit  || '평', landM2);
    const utilAmt   = calcAreaAmt(indirectData.utilPrice,   indirectData.utilUnit   || '평', totalFloorM2);
    const artAmt    = parseFloat(String(indirectData.artAmt || '').replace(/,/g, '')) || 0;
    const etcItems  = indirectData.etcItems || [];
    const rows = [
      { funding: indirectData.permit_funding, amt: permitAmt },
      { funding: indirectData.demol_funding,  amt: demolAmt  },
      { funding: indirectData.util_funding,   amt: utilAmt   },
      { funding: indirectData.art_funding,    amt: artAmt    },
      ...etcItems.map(it => ({ funding: it.funding, amt: parseFloat(String(it.amt||'').replace(/,/g,'')) || 0 })),
    ];
    const total   = rows.reduce((s, r) => s + r.amt, 0);
    const funding = calcFundingSummary(rows);
    return { total, funding, permitAmt, demolAmt, utilAmt, artAmt, etcItems };
  };
  const indirectResult = calcIndirect();

  // ── 용역비 합계 + 재원 ──
  const calcConsult = () => {
    const aboveM2      = parseFloat(String(archData?.floorAboveM2||'').replace(/,/g,''))||0;
    const underM2      = parseFloat(String(archData?.floorUnderM2||'').replace(/,/g,''))||0;
    const totalFloorM2 = aboveM2 + underM2;
    const totalFloorPy = totalFloorM2 * 0.3025;
    const getArea = (unit) => unit === '평' ? totalFloorPy : totalFloorM2;
    const p = (key) => parseFloat(String(consultData[key]||'').replace(/,/g,''))||0;
    const designAmt   = Math.round(p('designPrice')   * getArea(consultData.designUnit   || '평'));
    const superAmt    = Math.round(p('superPrice')    * getArea(consultData.superUnit    || '평'));
    const cmAmt       = Math.round(p('cmPrice')       * getArea(consultData.cmUnit       || '평'));
    const assessAmt   = p('assessAmt');
    const aptRows     = incomeData?.aptRows  || [];
    const offiRows    = incomeData?.offiRows || [];
    const autoM2      = [...aptRows,...offiRows].reduce((s,r)=>s+(parseFloat(String(r.excl_m2||'').replace(/,/g,''))||0)*(parseFloat(String(r.units||'').replace(/,/g,''))||0),0);
    const interiorM2  = consultData.interiorM2Override ? (parseFloat(String(consultData.interiorM2Override).replace(/,/g,''))||autoM2) : autoM2;
    const interiorArea = (consultData.interiorUnit||'평')==='평' ? interiorM2*0.3025 : interiorM2;
    const interiorAmt = Math.round(p('interiorPrice') * interiorArea);
    const etcItems    = consultData.etcItems || [];
    const rows = [
      { funding: consultData.design_funding,   amt: designAmt   },
      { funding: consultData.super_funding,    amt: superAmt    },
      { funding: consultData.cm_funding,       amt: cmAmt       },
      { funding: consultData.assess_funding,   amt: assessAmt   },
      { funding: consultData.interior_funding, amt: interiorAmt },
      ...etcItems.map(it => ({ funding: it.funding, amt: parseFloat(String(it.amt||'').replace(/,/g,''))||0 })),
    ];
    const total   = rows.reduce((s,r) => s+r.amt, 0);
    const funding = calcFundingSummary(rows);
    return { total, funding, designAmt, superAmt, cmAmt, assessAmt, interiorAmt, etcItems };
  };
  const consultResult = calcConsult();

  // ── 판매비 합계 + 재원 ──
  const calcSalesCost = () => {
    const sd = salesCostData;
    const aptRows   = incomeData?.aptRows   || [];
    const offiRows  = incomeData?.offiRows  || [];
    const storeRows = incomeData?.storeRows || [];
    const calcT = (rows, mode) => rows.reduce((s, r) => {
      const excl=parseFloat(String(r.excl_m2||'').replace(/,/g,''))||0;
      const wall=parseFloat(String(r.wall_m2||'').replace(/,/g,''))||0;
      const core=parseFloat(String(r.core_m2||'').replace(/,/g,''))||0;
      const mgmt=parseFloat(String(r.mgmt_m2||'').replace(/,/g,''))||0;
      const comm=parseFloat(String(r.comm_m2||'').replace(/,/g,''))||0;
      const park=parseFloat(String(r.park_m2||'').replace(/,/g,''))||0;
      const tel =parseFloat(String(r.tel_m2 ||'').replace(/,/g,''))||0;
      const elec=parseFloat(String(r.elec_m2||'').replace(/,/g,''))||0;
      const units=parseFloat(String(r.units||'').replace(/,/g,''))||0;
      const pyP=parseFloat(String(r.py_price||'').replace(/,/g,''))||0;
      const sup_py=(excl+wall+core)*0.3025;
      const cont_py=(excl+wall+core+mgmt+comm+park+tel+elec)*0.3025;
      return s+(mode==='apt'?pyP*sup_py:pyP*cont_py)*units;
    }, 0);
    const saleIncome = calcT(aptRows,'apt') + calcT(offiRows,'offi') + calcT(storeRows,'store');
    const aptCfg = salesData?.aptConfig || {};
    const patternEnd = parseInt(aptCfg.endMonth)||0;
    const cp = parseFloat(String(archData?.constructPeriod||'').replace(/,/g,''))||31;
    const autoSP = patternEnd > 0 ? patternEnd : cp;
    const sp = sd.salesPeriodOverride ? (parseInt(sd.salesPeriodOverride)||autoSP) : autoSP;
    const p = (key) => parseFloat(String(sd[key]||'').replace(/,/g,''))||0;
    const mhUnit = sd.mhUnit || '평';
    const mhArea = p('mhAreaInput');
    const mhAreaCalc = mhUnit === '평' ? mhArea : mhArea * 0.3025;
    const mhRentAmt = Math.round(p('mhRentMonth') * sp);
    const mhInstAmt = Math.round(p('mhInstPrice') * mhAreaCalc);
    const mhOperAmt = Math.round(p('mhOperMonth') * sp);
    const adAmt     = Math.round(saleIncome * (p('adRate')/100));
    const aptUnits2  = (incomeData?.aptRows||[]).reduce((s,r)=>s+(parseFloat(String(r.units||'').replace(/,/g,''))||0),0);
    const offiUnits2 = (incomeData?.offiRows||[]).reduce((s,r)=>s+(parseFloat(String(r.units||'').replace(/,/g,''))||0),0);
    const offiTotal2     = calcT(offiRows,'offi');
    const storeTotal2    = calcT(storeRows,'store');
    const agentAptAmt2   = Math.round(aptUnits2 * p('agentAptPerUnit'));
    const offiMode2      = sd.offiAgentMode || 'rate';
    const agentOffiAmt2  = offiMode2==='rate' ? Math.round(offiTotal2*(p('agentOffiRate')/100)) : Math.round(offiUnits2*p('agentOffiPerUnit'));
    const agentStoreAmt2 = Math.round(storeTotal2*(p('agentStoreRate')/100));
    // const agentTotalAmt2 = agentAptAmt2 + agentOffiAmt2 + agentStoreAmt2;
    const hugAmt2   = parseFloat(String(sd.hugAmt||'').replace(/,/g,''))||0;
    // etcTotal included in rows below
    const rows = [
      { funding: sd.mhRent_funding,    amt: mhRentAmt      },
      { funding: sd.mhInst_funding,    amt: mhInstAmt      },
      { funding: sd.mhOper_funding,    amt: mhOperAmt      },
      { funding: sd.ad_funding,        amt: adAmt          },
      { funding: sd.agentApt_funding,  amt: agentAptAmt2   },
      { funding: sd.agentOffi_funding, amt: agentOffiAmt2  },
      { funding: sd.agentStore_funding, amt: agentStoreAmt2 },
      { funding: sd.hug_funding,          amt: hugAmt2          },
      ...(sd.etcItems||[]).map(it=>({ funding: it.funding, amt: parseFloat(String(it.amt||'').replace(/,/g,''))||0 })),
    ];
    const total   = rows.reduce((s,r)=>s+r.amt,0);
    const funding = calcFundingSummary(rows);
    return { total, funding, mhRentAmt, mhInstAmt, mhOperAmt, adAmt, agentAptAmt2, agentOffiAmt2, agentStoreAmt2, hugAmt2, salesPeriod: sp, etcItems: sd.etcItems||[] };
  };
  const salesCostResult = calcSalesCost();
  const calcTax = () => {
    const td = taxData;
    const transAmt = parseFloat(String(td.transAmt||'').replace(/,/g,''))||0;
    const gasAmt   = parseFloat(String(td.gasAmt||'').replace(/,/g,''))||0;
    const waterAmt = parseFloat(String(td.waterAmt||'').replace(/,/g,''))||0;
    const sewerAmt     = parseFloat(String(td.sewerAmt||'').replace(/,/g,''))||0;
    const bondBuildAmt = parseFloat(String(td.bondBuildAmt||'').replace(/,/g,''))||0;
    const schoolAmt = parseFloat(String(td.schoolAmt||'').replace(/,/g,''))||0;
    const regAmt     = parseFloat(String(td.regAmt||'').replace(/,/g,''))||0;
    const propTaxAmt  = parseFloat(String(td.propTaxAmt||'').replace(/,/g,''))||0;
    const compTaxAmt  = parseFloat(String(td.compTaxAmt||'').replace(/,/g,''))||0;

    const rows = [
      { funding: td.trans_funding, amt: transAmt },
      { funding: td.gas_funding,   amt: gasAmt   },
      { funding: td.water_funding, amt: waterAmt },
      { funding: td.sewer_funding,     amt: sewerAmt     },
      { funding: td.bondBuild_funding, amt: bondBuildAmt },
      { funding: td.school_funding, amt: schoolAmt },
      { funding: td.reg_funding,     amt: regAmt     },
      { funding: td.propTax_funding, amt: propTaxAmt  },
      { funding: td.compTax_funding, amt: compTaxAmt  },
      ...(td.etcItems||[]).map(it => ({ funding: it.funding, amt: parseFloat(String(it.amt||'').replace(/,/g,''))||0 })),
    ];
    const total   = rows.reduce((s,r) => s+r.amt, 0);
    const funding = calcFundingSummary(rows);
    return { total, funding, transAmt, gasAmt, waterAmt, sewerAmt, bondBuildAmt, schoolAmt, regAmt, propTaxAmt, compTaxAmt, etcItems: td.etcItems||[] };
  };
  const taxResult = calcTax();

  // ── 임시 부대비 (예비비 제외) — taxResult 이후 정확한 에쿼티 계산을 위해 ──
  const calcOverheadNoReserve = () => {
    const od = overheadData;
    const p  = (key) => parseFloat(String(od[key]||'').replace(/,/g,''))||0;
    const calcI = (rows, mode) => rows.reduce((s, r) => {
      const excl=parseFloat(String(r.excl_m2||'').replace(/,/g,''))||0;
      const wall=parseFloat(String(r.wall_m2||'').replace(/,/g,''))||0;
      const core=parseFloat(String(r.core_m2||'').replace(/,/g,''))||0;
      const mgmt=parseFloat(String(r.mgmt_m2||'').replace(/,/g,''))||0;
      const comm=parseFloat(String(r.comm_m2||'').replace(/,/g,''))||0;
      const park=parseFloat(String(r.park_m2||'').replace(/,/g,''))||0;
      const tel =parseFloat(String(r.tel_m2 ||'').replace(/,/g,''))||0;
      const elec=parseFloat(String(r.elec_m2||'').replace(/,/g,''))||0;
      const units=parseFloat(String(r.units||'').replace(/,/g,''))||0;
      const pyP=parseFloat(String(r.py_price||'').replace(/,/g,''))||0;
      const sup_py=(excl+wall+core)*0.3025;
      const cont_py=(excl+wall+core+mgmt+comm+park+tel+elec)*0.3025;
      return s+(mode==='apt'?pyP*sup_py:pyP*cont_py)*units;
    }, 0);
    const saleIncome = calcI(incomeData?.aptRows||[],'apt') + calcI(incomeData?.offiRows||[],'offi') + calcI(incomeData?.storeRows||[],'store');
    const cp = parseFloat(String(archData?.constructPeriod||'').replace(/,/g,''))||31;
    const sp = parseFloat(String(archData?.settlePeriod||'').replace(/,/g,''))||6;
    const trustAmt = (od.trustMode||'rate')==='rate' ? Math.round(saleIncome*(p('trustRate')/100)) : p('trustDirect');
    const operAmt  = Math.round(p('operMonth') * (cp+sp));
    const aptU  = (incomeData?.aptRows||[]).reduce((s,r)=>s+(parseFloat(String(r.units||'').replace(/,/g,''))||0),0);
    const offiU = (incomeData?.offiRows||[]).reduce((s,r)=>s+(parseFloat(String(r.units||'').replace(/,/g,''))||0),0);
    const moveAmt = Math.round(p('moveMonth') * (aptU+offiU));
    const rows = [
      { funding: od.trust_funding, amt: trustAmt },
      { funding: od.oper_funding,  amt: operAmt  },
      { funding: od.move_funding,  amt: moveAmt  },
      ...(od.etcItems||[]).map(it=>({ funding: it.funding, amt: parseFloat(String(it.amt||'').replace(/,/g,''))||0 })),
    ];
    return calcFundingSummary(rows).equity;
  };
  const overheadEquityNoReserve = calcOverheadNoReserve();

  // ── 부대비 합계 + 재원 ──
  const calcOverhead = () => {
    const od = overheadData;
    const p  = (key) => parseFloat(String(od[key]||'').replace(/,/g,''))||0;
    const aptRows   = incomeData?.aptRows   || [];
    const offiRows  = incomeData?.offiRows  || [];
    const storeRows = incomeData?.storeRows || [];
    const calcI = (rows, mode) => rows.reduce((s, r) => {
      const excl=parseFloat(String(r.excl_m2||'').replace(/,/g,''))||0;
      const wall=parseFloat(String(r.wall_m2||'').replace(/,/g,''))||0;
      const core=parseFloat(String(r.core_m2||'').replace(/,/g,''))||0;
      const mgmt=parseFloat(String(r.mgmt_m2||'').replace(/,/g,''))||0;
      const comm=parseFloat(String(r.comm_m2||'').replace(/,/g,''))||0;
      const park=parseFloat(String(r.park_m2||'').replace(/,/g,''))||0;
      const tel =parseFloat(String(r.tel_m2 ||'').replace(/,/g,''))||0;
      const elec=parseFloat(String(r.elec_m2||'').replace(/,/g,''))||0;
      const units=parseFloat(String(r.units||'').replace(/,/g,''))||0;
      const pyP=parseFloat(String(r.py_price||'').replace(/,/g,''))||0;
      const sup_py=(excl+wall+core)*0.3025;
      const cont_py=(excl+wall+core+mgmt+comm+park+tel+elec)*0.3025;
      return s+(mode==='apt'?pyP*sup_py:pyP*cont_py)*units;
    }, 0);
    const saleIncome = calcI(aptRows,'apt') + calcI(offiRows,'offi') + calcI(storeRows,'store');
    const cp = parseFloat(String(archData?.constructPeriod||'').replace(/,/g,''))||31;
    const sp = parseFloat(String(archData?.settlePeriod   ||'').replace(/,/g,''))||6;
    const trustAmt   = (od.trustMode||'rate')==='rate' ? Math.round(saleIncome*(p('trustRate')/100)) : p('trustDirect');
    const operAmt    = Math.round(p('operMonth')  * (cp + sp));
    const aptUnitsC  = (incomeData?.aptRows||[]).reduce((s,r)=>s+(parseFloat(String(r.units||'').replace(/,/g,''))||0),0);
    const offiUnitsC = (incomeData?.offiRows||[]).reduce((s,r)=>s+(parseFloat(String(r.units||'').replace(/,/g,''))||0),0);
    const moveUnitsC = aptUnitsC + offiUnitsC;
    const moveAmt    = Math.round(p('moveMonth') * moveUnitsC);
    const targetEq    = Math.ceil(overheadEquityNoReserve / 100000) * 100000; // 1억 단위 올림 (자동, Excel ROUNDUP(-5))
    const reserveAmt  = Math.max(0, targetEq - Math.round(overheadEquityNoReserve));
    // etcTotal included in rows below
    const rows = [
      { funding: od.trust_funding,   amt: trustAmt   },
      { funding: od.oper_funding,    amt: operAmt    },
      { funding: od.move_funding,    amt: moveAmt    },
      { funding: { equity:'100', pf:'0', sale:'0' }, amt: reserveAmt }, // 예비비 항상 Equity 100%
      ...(od.etcItems||[]).map(it=>({ funding: it.funding, amt: parseFloat(String(it.amt||'').replace(/,/g,''))||0 })),
    ];
    const total   = rows.reduce((s,r)=>s+r.amt,0);
    const funding = calcFundingSummary(rows);
    return { total, funding, trustAmt, operAmt, moveAmt, reserveAmt, etcItems: od.etcItems||[] };
  };
  // ── 1차 overheadResult (예비비=0 임시) ──
  const overheadResult1st = calcOverhead();

  // ── 1차 monthlyPayments (VAT포함 에쿼티 합산용) ──
  const monthlyPayments1st = calcMonthlyPayments({
    landData, directData, indirectData, consultData,
    salesCostData, overheadData, taxData,
    directResult, indirectResult, consultResult,
    taxResult, salesCostResult, overheadResult: overheadResult1st,
    archData, settingsData, salesData, vatData,
    paymentSchedule: data.paymentSchedule || {},
  });

  // ── VAT 포함 전체 에쿼티 합산 (예비비 제외) ──
  const calcTotalEquityWithVat = (mp) => {
    const allItemsKeys = ['landItems','directItems','indirectItems','consultItems','salesItems','taxItems','overheadItems'];
    let totalEquity = 0;
    allItemsKeys.forEach(key => {
      (mp[key]||[]).forEach(item => {
        if ((item.label||'').includes('예비비')) return;
        const eqPct = (parseFloat((item.funding||{}).equity)||0) / 100;
        if (eqPct <= 0) return;
        const tot = Object.values(item.totals||{}).reduce((s,v)=>s+v,0);
        const vat = Object.values(item.vatTotals||{}).reduce((s,v)=>s+v,0);
        totalEquity += Math.round((tot + vat) * eqPct);
      });
    });
    return totalEquity;
  };
  const totalEquityWithVat   = calcTotalEquityWithVat(monthlyPayments1st);
  const targetEqFinal        = totalEquityWithVat > 0 ? Math.ceil(totalEquityWithVat / 100000) * 100000 : 0;
  const reserveAmtFinal      = Math.max(0, targetEqFinal - totalEquityWithVat);

  // ── 최종 overheadResult (예비비 반영) ──
  const overheadResult = (() => {
    const od = overheadData;
    const p  = (key) => parseFloat(String(od[key]||'').replace(/,/g,''))||0;
    const aptRows   = incomeData?.aptRows   || [];
    const offiRows  = incomeData?.offiRows  || [];
    const storeRows = incomeData?.storeRows || [];
    const calcI = (rows, mode) => rows.reduce((s, r) => {
      const excl=parseFloat(String(r.excl_m2||'').replace(/,/g,''))||0;
      const wall=parseFloat(String(r.wall_m2||'').replace(/,/g,''))||0;
      const core=parseFloat(String(r.core_m2||'').replace(/,/g,''))||0;
      const mgmt=parseFloat(String(r.mgmt_m2||'').replace(/,/g,''))||0;
      const comm=parseFloat(String(r.comm_m2||'').replace(/,/g,''))||0;
      const park=parseFloat(String(r.park_m2||'').replace(/,/g,''))||0;
      const tel =parseFloat(String(r.tel_m2 ||'').replace(/,/g,''))||0;
      const elec=parseFloat(String(r.elec_m2||'').replace(/,/g,''))||0;
      const units=parseFloat(String(r.units||'').replace(/,/g,''))||0;
      const pyP=parseFloat(String(r.py_price||'').replace(/,/g,''))||0;
      const sup_py=(excl+wall+core)*0.3025;
      const cont_py=(excl+wall+core+mgmt+comm+park+tel+elec)*0.3025;
      return s+(mode==='apt'?pyP*sup_py:pyP*cont_py)*units;
    }, 0);
    const saleIncome = calcI(aptRows,'apt') + calcI(offiRows,'offi') + calcI(storeRows,'store');
    const cp = parseFloat(String(archData?.constructPeriod||'').replace(/,/g,''))||31;
    const sp = parseFloat(String(archData?.settlePeriod   ||'').replace(/,/g,''))||6;
    const trustAmt = (od.trustMode||'rate')==='rate' ? Math.round(saleIncome*(p('trustRate')/100)) : p('trustDirect');
    const operAmt  = Math.round(p('operMonth') * (cp + sp));
    const aptUnitsC  = (incomeData?.aptRows||[]).reduce((s,r)=>s+(parseFloat(String(r.units||'').replace(/,/g,''))||0),0);
    const offiUnitsC = (incomeData?.offiRows||[]).reduce((s,r)=>s+(parseFloat(String(r.units||'').replace(/,/g,''))||0),0);
    const moveAmt  = Math.round(p('moveMonth') * (aptUnitsC + offiUnitsC));
    const rows = [
      { funding: od.trust_funding, amt: trustAmt },
      { funding: od.oper_funding,  amt: operAmt  },
      { funding: od.move_funding,  amt: moveAmt  },
      { funding: { equity:'100', pf:'0', sale:'0' }, amt: reserveAmtFinal },
      ...(od.etcItems||[]).map(it=>({ funding: it.funding, amt: parseFloat(String(it.amt||'').replace(/,/g,''))||0 })),
    ];
    const total   = rows.reduce((s,r)=>s+r.amt,0);
    const funding = calcFundingSummary(rows);
    return { total, funding, trustAmt, operAmt, moveAmt, reserveAmt: reserveAmtFinal, etcItems: od.etcItems||[] };
  })();

  // 관리신탁수수료만 별도 추출 (보존등기비 과세표준용)
  const trustAmtForReg = (() => {
    const od = overheadData;
    const p  = (k) => parseFloat(String(od[k]||'').replace(/,/g,''))||0;
    const aptRows   = incomeData?.aptRows   || [];
    const offiRows  = incomeData?.offiRows  || [];
    const storeRows = incomeData?.storeRows || [];
    const calcI = (rows, mode) => rows.reduce((s,r) => {
      const pyP=parseFloat(String(r.py_price||r.pyPrice||'').replace(/,/g,''))||0;
      const excl=parseFloat(String(r.excl_m2||'').replace(/,/g,''))||0;
      const wall=parseFloat(String(r.wall_m2||'').replace(/,/g,''))||0;
      const core=parseFloat(String(r.core_m2||'').replace(/,/g,''))||0;
      const mgmt=parseFloat(String(r.mgmt_m2||'').replace(/,/g,''))||0;
      const comm=parseFloat(String(r.comm_m2||'').replace(/,/g,''))||0;
      const park=parseFloat(String(r.park_m2||'').replace(/,/g,''))||0;
      const tel=parseFloat(String(r.tel_m2||'').replace(/,/g,''))||0;
      const elec=parseFloat(String(r.elec_m2||'').replace(/,/g,''))||0;
      const units=parseFloat(String(r.units||'').replace(/,/g,''))||0;
      const sup_py=(excl+wall+core)*0.3025;
      const cont_py=(excl+wall+core+mgmt+comm+park+tel+elec)*0.3025;
      return s+(mode==='apt'?pyP*sup_py:pyP*cont_py)*units;
    }, 0);
    const saleIncome = calcI(aptRows,'apt') + calcI(offiRows,'offi') + calcI(storeRows,'store');
    return (od.trustMode||'rate')==='rate' ? Math.round(saleIncome*(p('trustRate')/100)) : p('trustDirect');
  })();

  // ── 제세금 합계 + 재원 ──
  // ── 월별 지급 계산 (1회만, 지급패턴탭/합계탭 공유) ──
  const monthlyPayments = calcMonthlyPayments({
    landData, directData, indirectData, consultData,
    salesCostData, overheadData, taxData,
    directResult, indirectResult, consultResult,
    taxResult, salesCostResult, overheadResult,
    archData, settingsData, salesData, vatData,
    paymentSchedule: data.paymentSchedule || {},
  });

  // ── result를 상위로 전달 (읽기 전용 — Firestore 저장 안 함) ──
  // monthlyPayments를 ref에 저장해서 항상 최신값 유지
  const mpRef = React.useRef(null);
  mpRef.current = monthlyPayments;

  useEffect(() => {
    if (!onResultChange) return;
    onResultChange({
      landResult, directResult, indirectResult,
      consultResult, salesCostResult, overheadResult, taxResult,
      landData, directData, indirectData,
      consultData, salesCostData, overheadData, taxData,
      paymentSchedule: data.paymentSchedule || {},
      monthlyPayments: mpRef.current,
    });
  }, [ // eslint-disable-line
    landResult.total, directResult.total, indirectResult.total,
    consultResult.total, salesCostResult.total, overheadResult.total, taxResult.total,
    JSON.stringify(data.paymentSchedule),
  ]);

  const grandTotal = landResult.total + directResult.total + indirectResult.total + consultResult.total + salesCostResult.total + overheadResult.total + taxResult.total;

  const costSummary = [
    { key: 'land',     label: '토지관련비용', color: '#546e7a', ...landResult     },
    { key: 'direct',   label: '직접공사비',   color: '#546e7a', ...directResult   },
    { key: 'indirect', label: '간접공사비',   color: '#546e7a', ...indirectResult },
    { key: 'consult',  label: '용역비',       color: '#546e7a', ...consultResult  },
    { key: 'salesCost', label: '판매비',       color: '#546e7a', ...salesCostResult },
    { key: 'overhead',  label: '부대비',       color: '#546e7a', ...overheadResult  },
    { key: 'tax',       label: '제세금',       color: '#546e7a', ...taxResult       },
  ];

  const SUB_TABS = ['합계', '토지관련비용', '직접공사비', '간접공사비', '용역비', '판매비', '제세금', '부대비', '금융비', '지급패턴'];
  const READY_TABS = [];

  return (
    <div>
      {/* 크로스체크 팝업 */}
      {showCrossCheck && (() => {
        const fmtCC = (v) => v === null ? '—' : Math.round(v).toLocaleString('ko-KR');
        const chk4 = (a, b, c, d) => {
          const vals = [a,b,c,d].filter(v=>v!==null);
          return vals.every((v,_,arr) => Math.abs(v - arr[0]) < 2) ? '✅' : '❌';
        };
        const chk3 = (a, b, c) => Math.abs(a-b)<2 && Math.abs(b-c)<2 ? '✅' : '❌';
        const mp = monthlyPayments || {};

        // 각 항목탭 vatTotal (항목탭에서 계산된 값)
        // costSummary의 vatTotal을 각 항목 컴포넌트에서 가져올 수 없으므로
        // monthlyPayments의 VAT 합산값 사용 (동일한 taxable 기반 계산)
        const mpSum = (key) => Object.values(mp[key]||{}).reduce((s,v)=>s+v,0);
        const mpVat = (key) => Object.values(mp[`${key}Vat`]||{}).reduce((s,v)=>s+v,0);

        // costSummary 매핑
        const summaryMap = {};
        (costSummary||[]).forEach(c => {
          const km = {land:'land',direct:'direct',indirect:'indirect',consult:'consult',salesCost:'sales',overhead:'overhead',tax:'tax'};
          summaryMap[km[c.key]||c.key] = c.total;
        });

        const catDefs = [
          { key:'land',     label:'토지관련비용', total: landResult?.total||0 },
          { key:'direct',   label:'직접공사비',   total: directResult?.total||0 },
          { key:'indirect', label:'간접공사비',   total: indirectResult?.total||0 },
          { key:'consult',  label:'용역비',       total: consultResult?.total||0 },
          { key:'sales',    label:'판매비',       total: salesCostResult?.total||0 },
          { key:'overhead', label:'부대비',       total: overheadResult?.total||0 },
          { key:'tax',      label:'제세금',       total: taxResult?.total||0 },
        ];

        // 합계
        const totOrigin  = catDefs.reduce((s,c)=>s+c.total,0);
        const totPmt     = catDefs.reduce((s,c)=>s+mpSum(c.key),0);
        const totSummary = Object.values(summaryMap).reduce((s,v)=>s+v,0);
        const totTimeline= catDefs.reduce((s,c)=>s+mpSum(c.key),0);
        const totVatOrigin  = catDefs.reduce((s,c)=>s+mpVat(c.key),0);
        const totVatPmt     = catDefs.reduce((s,c)=>s+mpVat(c.key),0);
        const totVatTimeline= catDefs.reduce((s,c)=>s+mpVat(c.key),0);

        const supplyAllOk = chk4(totOrigin, totPmt, totSummary, totTimeline);
        const vatAllOk    = chk3(totVatOrigin, totVatPmt, totVatTimeline);
        const overallOk   = supplyAllOk==='✅' && vatAllOk==='✅' ? '✅' : '❌';

        const thS = (bg) => ({ padding:'7px 10px', textAlign:'right', fontWeight:'bold', color:'white', backgroundColor:bg||'#2c3e50', fontSize:'11px', whiteSpace:'nowrap' });
        const tdS = { padding:'6px 10px', textAlign:'right', fontSize:'12px', borderBottom:'1px solid #eee', whiteSpace:'nowrap' };
        const secTitle = (title, color) => (
          <tr>
            <td colSpan={6} style={{ padding:'10px 10px 4px', fontWeight:'bold', fontSize:'13px', color, borderTop:'2px solid '+color, backgroundColor:color+'11' }}>
              {title}
            </td>
          </tr>
        );

        return (
          <div style={{ position:'fixed', top:0, left:0, width:'100vw', height:'100vh',
            backgroundColor:'rgba(0,0,0,0.5)', zIndex:3000, display:'flex', alignItems:'center', justifyContent:'center' }}>
            <div style={{ backgroundColor:'white', borderRadius:'10px', width:'96%', maxWidth:'980px',
              maxHeight:'90vh', overflowY:'auto', padding:'24px' }}>

              {/* 헤더 */}
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'16px' }}>
                <div>
                  <h3 style={{ margin:0, color:'#8e44ad' }}>🔍 사업비 크로스체크</h3>
                  <div style={{ fontSize:'11px', color:'#888', marginTop:'4px' }}>
                    원천(항목탭) ↔ 지급패턴합계 ↔ 합계탭 ↔ 타임라인합계 — 허용오차 ±2천원
                  </div>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
                  <span style={{ fontSize:'24px' }}>{overallOk}</span>
                  <button onClick={()=>setShowCrossCheck(false)}
                    style={{ padding:'6px 14px', border:'1px solid #ddd', borderRadius:'6px', cursor:'pointer' }}>✕ 닫기</button>
                </div>
              </div>

              <table style={{ borderCollapse:'collapse', width:'100%', fontSize:'12px' }}>
                <thead>
                  <tr>
                    <th style={{ ...thS(), textAlign:'left', minWidth:'110px' }}>카테고리</th>
                    <th style={thS('#2980b9')}>원천</th>
                    <th style={thS('#16a085')}>지급패턴</th>
                    <th style={thS('#27ae60')}>합계탭</th>
                    <th style={thS('#8e44ad')}>타임라인</th>
                    <th style={thS('#e65100')}>일치</th>
                  </tr>
                </thead>
                <tbody>
                  {/* ── 공급금액 섹션 ── */}
                  {secTitle('💰 공급금액', '#2980b9')}
                  {catDefs.map((cat,i) => {
                    const a=cat.total, b=mpSum(cat.key), c=summaryMap[cat.key]||0, d=mpSum(cat.key);
                    const ok=chk4(a,b,c,d);
                    const bg=ok==='✅'?(i%2===0?'white':'#f8f9fa'):'#fdecea';
                    return (
                      <tr key={cat.key} style={{backgroundColor:bg}}>
                        <td style={{...tdS,textAlign:'left',fontWeight:'bold',color:'#2c3e50'}}>{cat.label}</td>
                        <td style={{...tdS,color:'#2980b9',fontWeight:'bold'}}>{fmtCC(a)}</td>
                        <td style={{...tdS,color:'#16a085'}}>{fmtCC(b)}</td>
                        <td style={{...tdS,color:'#27ae60'}}>{fmtCC(c)}</td>
                        <td style={{...tdS,color:'#8e44ad'}}>{fmtCC(d)}</td>
                        <td style={{...tdS,textAlign:'center',fontSize:'15px'}}>{ok}</td>
                      </tr>
                    );
                  })}
                  {/* 금융비 */}
                  <tr style={{backgroundColor:'#f5f5f5'}}>
                    <td style={{...tdS,textAlign:'left',color:'#bbb',fontStyle:'italic'}}>금융비</td>
                    <td style={{...tdS,color:'#bbb',textAlign:'center'}} colSpan={5}>준비 중</td>
                  </tr>
                  {/* 공급금액 전체합계 */}
                  <tr style={{backgroundColor:'#1a5276'}}>
                    <td style={{padding:'8px 10px',color:'white',fontWeight:'bold',textAlign:'left'}}>전체 합계</td>
                    <td style={{padding:'8px 10px',color:'#74b9ff',fontWeight:'bold',textAlign:'right'}}>{fmtCC(totOrigin)}</td>
                    <td style={{padding:'8px 10px',color:'#1abc9c',fontWeight:'bold',textAlign:'right'}}>{fmtCC(totPmt)}</td>
                    <td style={{padding:'8px 10px',color:'#55efc4',fontWeight:'bold',textAlign:'right'}}>{fmtCC(totSummary)}</td>
                    <td style={{padding:'8px 10px',color:'#a29bfe',fontWeight:'bold',textAlign:'right'}}>{fmtCC(totTimeline)}</td>
                    <td style={{padding:'8px 10px',textAlign:'center',fontSize:'18px'}}>{supplyAllOk}</td>
                  </tr>

                  {/* ── 부가세 섹션 ── */}
                  {secTitle('🧾 부가세 (VAT)', '#e67e22')}
                  {catDefs.map((cat,i) => {
                    const a=mpVat(cat.key), b=mpVat(cat.key), c=mpVat(cat.key);
                    // 타임라인은 카테고리별 없으므로 — 표시
                    const ok=chk3(a,b,c);
                    const bg=ok==='✅'?(i%2===0?'white':'#f8f9fa'):'#fdecea';
                    if(a===0) return (
                      <tr key={cat.key+'_vat'} style={{backgroundColor:bg}}>
                        <td style={{...tdS,textAlign:'left',color:'#999'}}>{cat.label}</td>
                        <td style={{...tdS,color:'#ddd',textAlign:'center'}} colSpan={4}>면세</td>
                        <td style={{...tdS,textAlign:'center'}}>—</td>
                      </tr>
                    );
                    return (
                      <tr key={cat.key+'_vat'} style={{backgroundColor:bg}}>
                        <td style={{...tdS,textAlign:'left',fontWeight:'bold',color:'#2c3e50'}}>{cat.label}</td>
                        <td style={{...tdS,color:'#2980b9',fontWeight:'bold'}}>{fmtCC(a)}</td>
                        <td style={{...tdS,color:'#16a085'}}>{fmtCC(b)}</td>
                        <td style={{...tdS,color:'#27ae60'}}>{fmtCC(c)}</td>
                        <td style={{...tdS,color:'#aaa',textAlign:'center'}}>—</td>
                        <td style={{...tdS,textAlign:'center',fontSize:'15px'}}>{ok}</td>
                      </tr>
                    );
                  })}
                  {/* 부가세 전체합계 (타임라인 포함 3개 비교) */}
                  <tr style={{backgroundColor:'#7d3c00'}}>
                    <td style={{padding:'8px 10px',color:'white',fontWeight:'bold',textAlign:'left'}}>전체 합계</td>
                    <td style={{padding:'8px 10px',color:'#fad7a0',fontWeight:'bold',textAlign:'right'}}>{fmtCC(totVatOrigin)}</td>
                    <td style={{padding:'8px 10px',color:'#a9dfbf',fontWeight:'bold',textAlign:'right'}}>{fmtCC(totVatPmt)}</td>
                    <td style={{padding:'8px 10px',color:'#a9dfbf',fontWeight:'bold',textAlign:'right'}}>{fmtCC(totVatOrigin)}</td>
                    <td style={{padding:'8px 10px',color:'#d2b4de',fontWeight:'bold',textAlign:'right'}}>{fmtCC(totVatTimeline)}</td>
                    <td style={{padding:'8px 10px',textAlign:'center',fontSize:'18px'}}>{vatAllOk}</td>
                  </tr>
                </tbody>
              </table>

              <div style={{ marginTop:'14px', fontSize:'11px', color:'#888', display:'flex', gap:'16px', flexWrap:'wrap' }}>
                <span style={{color:'#2980b9'}}>■ 원천: 각 항목탭</span>
                <span style={{color:'#16a085'}}>■ 지급패턴: monthlyPayments 합산</span>
                <span style={{color:'#27ae60'}}>■ 합계탭: costSummary</span>
                <span style={{color:'#8e44ad'}}>■ 타임라인: monthlyPayments 합산</span>
                <span style={{color:'#888'}}>※ 타임라인VAT는 전체합계만 비교</span>
              </div>
            </div>
          </div>
        );
      })()}

      {/* 사업비 재원조달 팝업 */}
      {showFunding && (
        <FundingModal
          onClose={() => setShowFunding(false)}
          projectName={archData?.projectName || '프로젝트'}
          landResult={landResult}             landData={landData}
          directResult={directResult}         directData={directData}
          paymentSchedule={data.paymentSchedule || {}}
          indirectResult={indirectResult}     indirectData={indirectData}
          consultResult={consultResult}       consultData={consultData}
          salesCostResult={salesCostResult}   salesCostData={salesCostData}
          overheadResult={overheadResult}     overheadData={overheadData}
          taxResult={taxResult}               taxData={taxData}
          financeData={financeData}
          salesData={salesData}
          cashFlowResult={cashFlowResult}
        />
      )}

      {/* 헤더 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div style={{ display:'flex', alignItems:'baseline', gap:'12px' }}>
          <h3 style={{ margin: 0 }}>사업비</h3>
          <span style={{ fontSize:'10px', color:'#aaa', fontStyle:'italic' }}>
            ※ 소수점 처리: 항목별 총액 확정 → 월별 배분 → 마지막 월 오차 보정 (월별 합계 = 총액 항상 일치)
          </span>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {saving && <span style={{ fontSize: '12px', color: '#27ae60' }}>저장 중...</span>}
          <button onClick={() => setShowFunding(true)}
            style={{ padding:'6px 14px', backgroundColor:'#1a1a2e', color:'white', border:'none', borderRadius:'4px', cursor:'pointer', fontSize:'12px' }}>
            📊 재원조달
          </button>
          <button onClick={() => setShowCrossCheck(true)}
            style={{ padding:'6px 14px', backgroundColor:'#8e44ad', color:'white', border:'none', borderRadius:'4px', cursor:'pointer', fontSize:'12px' }}>
            🔍 크로스체크
          </button>
          <button onClick={onSave}
            style={{ padding: '6px 16px', backgroundColor: '#27ae60', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
            Firestore 저장
          </button>
        </div>
      </div>

      {/* 서브탭 */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', flexWrap: 'wrap', borderBottom: '2px solid #eee', paddingBottom: '0' }}>
        {SUB_TABS.map(tab => {
          const isReady   = READY_TABS.includes(tab);
          const isActive  = subTab === tab;
          const isSummary = tab === '합계';
          return (
            <button key={tab} onClick={() => !isReady && setSubTab(tab)}
              style={{
                padding: '7px 14px',
                backgroundColor: isActive ? (isSummary ? '#2c3e50' : '#2980b9') : isReady ? '#f5f5f5' : '#ecf0f1',
                color: isActive ? 'white' : isReady ? '#bbb' : '#2c3e50',
                border: 'none',
                borderBottom: isActive ? `3px solid ${isSummary ? '#f1c40f' : '#1a5276'}` : '3px solid transparent',
                borderRadius: '4px 4px 0 0',
                cursor: isReady ? 'not-allowed' : 'pointer',
                fontWeight: isActive ? 'bold' : 'normal',
                fontSize: '12px',
              }}>
              {tab}{isReady ? ' 🔒' : ''}
            </button>
          );
        })}
      </div>

      {/* 탭 내용 */}
      <div style={{ border: '1px solid #e8e8e8', borderRadius: '8px', padding: '20px', minHeight: '300px' }}>
        {subTab === '합계' && <SummaryTab costSummary={costSummary} archData={archData} monthlyPayments={monthlyPayments} salesData={salesData} vatData={vatData} financeData={financeData} cashFlowResult={cashFlowResult} />}
        {subTab === '토지관련비용' && (
          <LandCostSection data={landData} onChange={updateLand} archData={archData} />
        )}
        {subTab === '직접공사비' && (
          <DirectCostSection data={directData} onChange={updateDirect} archData={archData} />
        )}
        {subTab === '간접공사비' && (
          <IndirectCostSection data={indirectData} onChange={updateIndirect} archData={archData} directData={directData} incomeData={incomeData} settingsData={settingsData} />
        )}
        {subTab === '용역비' && (
          <ConsultCostSection data={consultData} onChange={updateConsult} archData={archData} incomeData={incomeData} />
        )}
        {subTab === '판매비' && (
          <SalesCostSection data={salesCostData} onChange={updateSalesCost} incomeData={incomeData} archData={archData} salesData={salesData || {}} />
        )}
        {subTab === '부대비' && (
          <OverheadCostSection data={overheadData} onChange={updateOverhead} archData={archData} incomeData={incomeData} allCostData={{ totalEquity: totalEquityWithVat }} />
        )}
        {subTab === '제세금' && (
          <TaxCostSection data={taxData} onChange={updateTax} archData={archData} incomeData={incomeData} settingsData={settingsData} costResults={{ directAmt: directResult.total, indirectAmt: indirectResult.total, consultAmt: consultResult.total, taxAmt: taxResult.total, trustAmt: trustAmtForReg }} salesData={salesData} paymentScheduleData={data.paymentSchedule||{}} vatData={vatData} />
        )}
        {subTab === '금융비' && (
          <FinanceCostTab
            financeData={financeData || {}}
            onChange={onFinanceChange || (() => {})}
            salesData={salesData}
            cashFlowResult={cashFlowResult}
          />
        )}
        {subTab === '지급패턴' && (
          <PaymentScheduleSection
            costSummary={costSummary}
            landData={landData}
            directData={directData}
            indirectData={indirectData}
            consultData={consultData}
            salesCostData={salesCostData}
            overheadData={overheadData}
            taxData={taxData}
            archData={archData}
            settingsData={settingsData}
            directResult={directResult}
            indirectResult={indirectResult}
            consultResult={consultResult}
            taxResult={taxResult}
            salesCostResult={salesCostResult}
            overheadResult={overheadResult}
            landResult={landResult}
            incomeData={incomeData}
            salesData={salesData}
            taxRatioVAT={taxRatioVAT}
            monthlyPayments={monthlyPayments}
            data={data.paymentSchedule || {}}
            onChange={v => onChange({ ...data, paymentSchedule: v })}
          />
        )}
      </div>

      {/* 하단 미니 합계 바 (항상 표시) */}
      <div style={{
        backgroundColor: '#2c3e50', color: 'white',
        borderRadius: '8px', padding: '12px 20px', marginTop: '12px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        flexWrap: 'wrap', gap: '8px',
      }}>
        <div style={{ display: 'flex', gap: '16px', fontSize: '12px', opacity: 0.75, flexWrap:'wrap' }}>
          {costSummary.map(c => (
            <span key={c.key}>
              <span style={{ color:'#80cbc4' }}>●</span>
              {' '}{c.label} {formatNumber(c.total)}
            </span>
          ))}
          {cashFlowResult && (() => {
            const finTot = (cashFlowResult.months||[]).reduce((s,ym,i)=>{ const r=cashFlowResult.result[i]||{}; return s+(r.intS||0)+(r.intM||0)+(r.intJ||0)+(r.midInt||0)+(r.fee||0); },0);
            return finTot > 0 ? (
              <span>
                <span style={{ color:'#ffcc80' }}>●</span>
                {' '}금융비 {formatNumber(finTot)}
              </span>
            ) : null;
          })()}
        </div>
        <div style={{ textAlign: 'right' }}>
          {(() => {
            const catKeys = ['land','direct','indirect','consult','sales','tax','overhead'];
            const totalVat_ = catKeys.reduce((s,k) => s + Object.values((monthlyPayments||{})[`${k}Vat`]||{}).reduce((a,v)=>a+v,0), 0);
            const finTot_ = cashFlowResult ? (cashFlowResult.months||[]).reduce((s,ym,i)=>{ const r=cashFlowResult.result[i]||{}; return s+(r.intS||0)+(r.intM||0)+(r.intJ||0)+(r.midInt||0)+(r.fee||0); },0) : 0;
            const totalWithFin = grandTotal + totalVat_ + finTot_;
            return (
              <>
                <div style={{ fontSize: '15px', fontWeight: 'bold', color: '#f1c40f' }}>
                  총 {formatNumber(totalWithFin)} 천원
                </div>
                {totalVat_ > 0 && (
                  <div style={{ fontSize: '11px', color: '#f39c12', opacity: 0.85 }}>
                    공급 {formatNumber(grandTotal)} + VAT {formatNumber(totalVat_)}{finTot_>0?` + 금융비 ${formatNumber(finTot_)}`:''}
                  </div>
                )}
              </>
            );
          })()}
        </div>
      </div>
    </div>
  );
}

export default ProjectCost;
