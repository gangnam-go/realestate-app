import React, { useState, useMemo } from 'react';
import { formatNumber } from '../utils';

const fmtN = (v) => (v && Math.round(v) !== 0) ? formatNumber(Math.round(v)) : '';
const fmtC = (v) => v ? formatNumber(Math.round(v)) : '';
const fmtPct = (v) => v > 0 ? `${(v*100).toFixed(1)}%` : '';

// ─────────────────────────────────────────────
// 금융비 월별 배분 계산
// ─────────────────────────────────────────────
const calcFinanceCostMonthly = (financeData, salesData, months) => {
  if (!financeData || !months?.length) return {};
  const d  = financeData?.financeCost || {};
  const ltv = financeData?.ltvCalc   || {};
  const tranches = ltv.tranches || [];
  const pnv = (v) => parseFloat(String(v||'').replace(/,/g,''))||0;

  // 트랜치 올림금액
  const getT = (name) => tranches.find(t => t.name?.includes(name)) || {};
  const seniorAmt  = pnv(getT('선순위').savedAmt || 0);
  const mezAmt     = pnv(getT('중순위').savedAmt || 0);
  const juniorAmt  = pnv(getT('후순위').savedAmt || 0);
  const seniorRate = parseFloat(getT('선순위').rate || 0);
  const mezRate    = parseFloat(getT('중순위').rate || 0);
  const juniorRate = parseFloat(getT('후순위').rate || 0);
  const totalPF    = seniorAmt + mezAmt + juniorAmt;

  // 착공월
  const conIdx = (salesData?.constructMonth || 1) - 1;
  const conYM  = salesData?.ymList?.[conIdx] || months[0];
  // 준공월 (마지막 잔금 납부 이후 → 임시로 마지막 달)
  const lastYM = months[months.length - 1];

  // 월별 결과 초기화 (항목별)
  const byItem = {};
  const KEYS = ['mgmt','seniorFee','mezFee','juniorFee','seniorInt','mezInt','juniorInt','midInt','unindrawn','loanInt'];
  KEYS.forEach(k => { byItem[k] = {}; months.forEach(ym => { byItem[k][ym] = 0; }); });

  const addOnce = (key, ym, amt) => { if (months.includes(ym) && amt > 0) byItem[key][ym] = (byItem[key][ym]||0) + amt; };
  const addMonthly = (key, ym, amt) => { if (months.includes(ym) && amt > 0) byItem[key][ym] = (byItem[key][ym]||0) + amt; };

  // ① 주관사수수료 (착공월 1회)
  addOnce('mgmt', conYM, Math.round(totalPF * pnv(d.mgmtPct) / 100));

  // ② 선순위 이자 (착공월부터 월별 균등 — 현금흐름 계산기 미완성 시 임시)
  if (seniorAmt > 0 && seniorRate > 0) {
    const mo = Math.round(seniorAmt * seniorRate / 100 / 12);
    months.forEach(ym => { if (ym >= conYM) addMonthly('seniorInt', ym, mo); });
  }

  // ③ 중순위 이자
  if (mezAmt > 0 && mezRate > 0) {
    const mo = Math.round(mezAmt * mezRate / 100 / 12);
    months.forEach(ym => { if (ym >= conYM) addMonthly('mezInt', ym, mo); });
  }

  // ④ 후순위 이자
  if (juniorAmt > 0 && juniorRate > 0) {
    const mo = Math.round(juniorAmt * juniorRate / 100 / 12);
    months.forEach(ym => { if (ym >= conYM) addMonthly('juniorInt', ym, mo); });
  }

  // ⑤ 선순위 취급수수료 (착공월 1회)
  addOnce('seniorFee', conYM, Math.round(seniorAmt * pnv(d.seniorFee) / 100));

  // ⑥ 중순위 취급수수료
  addOnce('mezFee', conYM, Math.round(mezAmt * pnv(d.mezFee) / 100));

  // ⑦ 후순위 취급수수료
  addOnce('juniorFee', conYM, Math.round(juniorAmt * pnv(d.juniorFee) / 100));

  // ⑧ 중도금 이자 (월별, 잔금 납부 시 차감)
  const midRate_   = pnv(d.midRate) / 100 / 12;
  const ymList     = salesData?.ymList || [];
  const aptMid     = salesData?.aptMidMonthly   || [];
  const offiMid    = salesData?.offiMidMonthly  || [];
  const storeMid   = salesData?.storeMidMonthly || [];
  const aptBal     = salesData?.aptBalMonthly   || [];
  const offiBal    = salesData?.offiBalMonthly  || [];
  const storeBal   = salesData?.storeBalMonthly || [];
  const totalMid_  = [...aptMid,...offiMid,...storeMid].reduce((s,v)=>s+(v||0),0);
  const totalBal_  = [...aptBal,...offiBal,...storeBal].reduce((s,v)=>s+(v||0),0);
  let midAccum = 0, midRepaid = 0;
  ymList.forEach((ym, i) => {
    midAccum += (aptMid[i]||0) + (offiMid[i]||0) + (storeMid[i]||0);
    const balThis = (aptBal[i]||0) + (offiBal[i]||0) + (storeBal[i]||0);
    if (totalBal_ > 0 && balThis > 0)
      midRepaid += Math.round(totalMid_ * balThis / totalBal_);
    const bal = Math.max(0, midAccum - midRepaid);
    addMonthly('midInt', ym, Math.round(bal * midRate_));
  });

  // ⑨ 미인출수수료 (상환 시점 → 임시로 마지막 달)
  addOnce('unindrawn', lastYM, Math.round(seniorAmt * pnv(d.unindrawnPct) / 100));

  // ⑩ 대여금 이자 (월별 균등)
  const loanIntAmt = Math.round(pnv(d.loanAmt) * pnv(d.loanRate) / 100);
  if (loanIntAmt > 0) {
    const mo = Math.round(loanIntAmt / 12);
    months.forEach(ym => { addMonthly('loanInt', ym, mo); });
  }

  // 통합 결과 (월별 합계)
  const result = {};
  months.forEach(ym => {
    result[ym] = KEYS.reduce((s,k) => s + (byItem[k][ym]||0), 0);
  });

  // 항목별 월별 데이터도 반환
  result._byItem = byItem;
  return result;
};

// 금융비 세부항목 레이블 (표시 순서)
const FINANCE_COST_ITEMS = [
  { key:'mgmt',       label:'주관사수수료' },
  { key:'seniorInt',  label:'선순위 이자' },
  { key:'mezInt',     label:'중순위 이자' },
  { key:'juniorInt',  label:'후순위 이자' },
  { key:'seniorFee',  label:'선순위 취급수수료' },
  { key:'mezFee',     label:'중순위 취급수수료' },
  { key:'juniorFee',  label:'후순위 취급수수료' },
  { key:'midInt',     label:'중도금 무이자' },
  { key:'unindrawn',  label:'미인출수수료' },
  { key:'loanInt',    label:'대여금 이자' },
];

// ─────────────────────────────────────────────
// 보고서 공통 스타일 상수 (모든 보고서 통일)
// ─────────────────────────────────────────────
const RS = {
  // 색상
  headerBg:    '#1a1a2e',  // 테이블 헤더 배경
  headerColor: 'white',
  secBg:       '#2c3e50',  // 섹션 구분 배경
  secColor:    'white',
  rowBg:       'white',    // 일반 행 배경
  rowColor:    '#333',
  rateBg:      '#f5f5f5',  // 분양율 행
  rateColor:   '#888',
  vatBg:       '#fffde7',  // 부가세 행
  vatColor:    '#c0750a',
  subBg:       '#e8e8e8',  // 합계 행
  subColor:    '#1a1a2e',
  grandBg:     '#1a1a2e',  // 총합계 행
  grandColor:  'white',
  totalColBg:  '#f0f0f0',  // 합계 열
  conColor:    '#58d68d',  // 착공월 글자색
  junColor:    '#f5cba7',  // 준공월 글자색
  specBg:      '#f5f5dc',  // 착공/준공월 셀 배경
  divBg:       '#aaa',     // 구분선
  // 폰트
  fontSize:    '10px',
  fontFamily:  "'Malgun Gothic', sans-serif",
  // 인쇄 폰트
  printSize:   '8px',
};

// 공통 헬퍼 — 열 스타일
const colBorderR = (ym) => {
  const m = parseInt(ym.split('.')[1]) || 0;
  return (m === 6 || m === 12) ? '2px solid #888' : undefined;
};
const printBR = (ym, isSpec) => {
  const m = parseInt(ym.split('.')[1]) || 0;
  if (isSpec) return 'border-left:2px solid #555;border-right:2px solid #555;';
  if (m === 6 || m === 12) return 'border-right:2px solid #888;';
  return '';
};

// 인쇄용 공통 CSS
const PRINT_CSS = `
  *{margin:0;padding:0;box-sizing:border-box;}
  body{font-family:'Malgun Gothic',sans-serif;font-size:8px;color:#111;padding:6mm;}
  h2{font-size:12px;font-weight:bold;text-align:center;margin-bottom:2px;}
  .sub{text-align:center;font-size:8px;color:#555;margin-bottom:8px;}
  table{border-collapse:collapse;width:100%;}
  th,td{-webkit-print-color-adjust:exact;print-color-adjust:exact;}
  @media print{@page{margin:6mm;size:A3 landscape;}th,td{-webkit-print-color-adjust:exact;print-color-adjust:exact;}}
`;

// 인쇄용 셀 생성
const pCell = (v, bg, color='#333', bold=false, extra='') =>
  `<td style="background:${bg};color:${color};padding:3px 4px;font-size:8px;` +
  `border-bottom:1px solid #eee;text-align:right;` +
  `${bold?'font-weight:bold;':''}${extra}` +
  `-webkit-print-color-adjust:exact;print-color-adjust:exact;">${v||''}</td>`;

// 인쇄용 헤더 셀
const pTh = (v, extra='') =>
  `<th style="background:${RS.headerBg};color:white;padding:3px 4px;font-size:8px;` +
  `border-bottom:2px solid #444;text-align:right;white-space:nowrap;` +
  `-webkit-print-color-adjust:exact;print-color-adjust:exact;${extra}">${v}</th>`;

// 인쇄용 월 헤더 (착공/준공 강조)
const pColHdr = (ym, idx, isCon, isJun) => {
  const sp    = isCon || isJun;
  const color = isCon ? RS.conColor : isJun ? RS.junColor : 'white';
  const bR    = printBR(ym, sp);
  const label = isCon ? `◆ ${ym}` : isJun ? `★ ${ym}` : ym;
  return `<th style="background:${RS.headerBg};color:${color};padding:3px 4px;font-size:8px;` +
    `border-bottom:2px solid #444;text-align:right;white-space:nowrap;min-width:44px;${bR}` +
    `-webkit-print-color-adjust:exact;print-color-adjust:exact;">${label}</th>`;
};

// 인쇄 창 열기
const openPrintWin = (title) => {
  const win = window.open('', '_blank', 'width=1400,height=900');
  win.document.write(`<html><head><title>${title}</title><style>${PRINT_CSS}</style></head><body>`);
  return win;
};

// 인쇄 실행
const doPrint = (win) => {
  win.document.write('</body></html>');
  win.document.close();
  setTimeout(() => win.print(), 400);
};

// ─────────────────────────────────────────────
// 기본 배분 비율
// 초과: 계약금/중도금 상환30/운영70, 잔금 상환100
// 미만: 계약금/중도금 상환10/운영90 (분양 부진 → 운영비 더 필요)
// ─────────────────────────────────────────────
const DEFAULT_ALLOC = {
  over:  { res: { dep: 30, mid: 30, bal: 100 }, store: { all: 40 } },
  under: { res: { dep: 10, mid: 10, bal: 100 }, store: { all: 40 } },
};

// ─────────────────────────────────────────────
// 계산
// ─────────────────────────────────────────────
const calcRows = (salesData, alloc, baseRate, scenario, ymList) => {
  const n = ymList.length;

  // VAT 포함 배열 우선, 없으면 공급가 배열로 fallback (분양율탭 미방문 시)
  const hasVat = !!(salesData?.aptDepMonthlyVat);
  const resDep = ymList.map((_,i) =>
    (hasVat ? (salesData?.aptDepMonthlyVat?.[i]||0) : (salesData?.aptDepMonthly?.[i]||0))
    + (hasVat ? (salesData?.balDepMonthlyVat?.[i]||0) : (salesData?.balDepMonthly?.[i]||0))
    + (hasVat ? (salesData?.offiDepMonthlyVat?.[i]||0) : (salesData?.offiDepMonthly?.[i]||0))
  );
  const resMid = ymList.map((_,i) =>
    (hasVat ? (salesData?.aptMidMonthlyVat?.[i]||0) : (salesData?.aptMidMonthly?.[i]||0))
    + (hasVat ? (salesData?.offiMidMonthlyVat?.[i]||0) : (salesData?.offiMidMonthly?.[i]||0))
  );
  const resBal = ymList.map((_,i) =>
    (hasVat ? (salesData?.aptBalMonthlyVat?.[i]||0) : (salesData?.aptBalMonthly?.[i]||0))
    + (hasVat ? (salesData?.balBalMonthlyVat?.[i]||0) : (salesData?.balBalMonthly?.[i]||0))
    + (hasVat ? (salesData?.offiBalMonthlyVat?.[i]||0) : (salesData?.offiBalMonthly?.[i]||0))
  );
  const store = (hasVat ? salesData?.storeMonthlyVat : salesData?.storeMonthly) || Array(n).fill(0);

  // 누적 분양율 계산
  const totalRes   = (salesData?.salesSumApt||0) + (salesData?.salesSumBal||0) + (salesData?.salesSumOffi||0);
  const totalStore = salesData?.salesSumStore || 0;
  const totalAll   = totalRes + totalStore;
  let cumul = 0;
  const salesRates = ymList.map((_,i) => {
    cumul += resDep[i] + resMid[i] + resBal[i] + (store[i]||0);
    return totalAll > 0 ? cumul / totalAll * 100 : 0;
  });

  return ymList.map((ym, i) => {
    const isOver = scenario === 'over' ? true : false;

    const a = isOver ? alloc.over : alloc.under;
    if (!a || !a.res || !a.store) return null; // 안전 처리

    const resDepSave  = Math.round(resDep[i] * (a.res.dep ?? 30) / 100);
    const resDepOper  = resDep[i] - resDepSave;
    const resMidSave  = Math.round(resMid[i] * (a.res.mid ?? 30) / 100);
    const resMidOper  = resMid[i] - resMidSave;
    const resBalSave  = Math.round(resBal[i] * (a.res.bal ?? 100) / 100);
    const resBalOper  = resBal[i] - resBalSave;
    const storeSave   = Math.round((store[i]||0) * (a.store.all ?? 40) / 100);
    const storeOper   = (store[i]||0) - storeSave;

    const totalSave = resDepSave + resMidSave + resBalSave + storeSave;
    const totalOper = resDepOper + resMidOper + resBalOper + storeOper;
    const total     = totalSave + totalOper;

    return {
      ym, salesRate: salesRates[i], isOver,
      resDepSave, resDepOper,
      resMidSave, resMidOper,
      resBalSave, resBalOper,
      storeSave, storeOper,
      totalSave, totalOper, total,
    };
  }).filter(Boolean);
};

// ─────────────────────────────────────────────
// 비율 입력 컴포넌트
// ─────────────────────────────────────────────
function AllocRow({ label, save, onChangeSave, color='#1a3a5c' }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:'6px', marginBottom:'5px' }}>
      <span style={{ width:'80px', fontSize:'11px', color:'#555' }}>{label}</span>
      <span style={{ fontSize:'11px', color:'#1a5276' }}>상환</span>
      <input type="number" min="0" max="100" value={save}
        onChange={e => onChangeSave(Math.min(100, Math.max(0, parseFloat(e.target.value)||0)))}
        style={{ width:'52px', padding:'3px 6px', border:`1px solid ${color}`,
          borderRadius:'3px', fontSize:'12px', textAlign:'center',
          color, fontWeight:'bold' }} />
      <span style={{ fontSize:'10px', color:'#aaa' }}>%</span>
      <span style={{ fontSize:'11px', color:'#27ae60' }}>운영</span>
      <span style={{ width:'40px', fontSize:'12px', fontWeight:'bold', color:'#27ae60' }}>
        {100 - save}%
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────
// 메인
// ─────────────────────────────────────────────
function SaleAllocation({ salesData, projectName }) {
  const ymList   = salesData?.ymList || [];
  const hasStore = (salesData?.salesSumStore || 0) > 0;
  const noData   = ymList.length === 0;

  const [baseRate, setBaseRate] = useState(60);
  const [scenario, setScenario] = useState('over');
  const [alloc, setAlloc] = useState(JSON.parse(JSON.stringify(DEFAULT_ALLOC)));

  const updateAlloc = (when, cat, item, val) => {
    setAlloc(prev => {
      const next = JSON.parse(JSON.stringify(prev));
      next[when][cat][item] = val;
      return next;
    });
  };

  const rows = useMemo(() =>
    ymList.length > 0 ? calcRows(salesData, alloc, baseRate, scenario, ymList) : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(salesData?.ymList), JSON.stringify(alloc), baseRate, scenario]
  );

  // 전체 월 표시 (금액 없어도 사업기간 전체 표시)
  const activeCols = rows;

  // 합계
  const sum = (key) => activeCols.reduce((s, r) => s + (r[key]||0), 0);
  const grandSave  = sum('totalSave');
  const grandOper  = sum('totalOper');
  const grandTotal = sum('total');

  // 행 정의
  const ROW_DEFS = [
    { key:'resDepSave', label:'계약금 (공동주택+발코니+오피스텔)',   sub:'상환용', color:'#1a5276', bg:'#e8f0f8' },
    { key:'resDepOper', label:'',               sub:'운영비', color:'#1a6a3a', bg:'#e8f5ec' },
    { key:'resMidSave', label:'중도금 (공동주택+오피스텔)',   sub:'상환용', color:'#1a5276', bg:'#e8f0f8' },
    { key:'resMidOper', label:'',               sub:'운영비', color:'#1a6a3a', bg:'#e8f5ec' },
    { key:'resBalSave', label:'잔금 (공동주택+발코니+오피스텔)',     sub:'상환용', color:'#1a5276', bg:'#e8f0f8' },
    { key:'resBalOper', label:'',               sub:'운영비', color:'#1a6a3a', bg:'#e8f5ec' },
    ...(hasStore ? [
      { key:'storeSave', label:'근린상가',       sub:'상환용', color:'#1a5276', bg:'#e8f0f8' },
      { key:'storeOper', label:'',              sub:'운영비', color:'#1a6a3a', bg:'#e8f5ec' },
    ] : []),
    { key:'__divider__' },
    { key:'totalSave',  label:'상환용 합계',     sub:'',       color:'#1a3a5c', bg:'#d0e4f7', bold:true },
    { key:'totalOper',  label:'운영비 합계',     sub:'',       color:'#1a5c2a', bg:'#d0f0e0', bold:true },
    { key:'total',      label:'월 합계',         sub:'',       color:'#2c3e50', bg:'#f0f0f0', bold:true },
  ];

  // ── 인쇄 (별도 창) ──
  const handlePrint = () => {
    const junMonth = salesData?.junMonth || 0;  // 준공월 인덱스 (1-based)

    // 열별 스타일 헬퍼
    const colBorderStyle = (idx) => {
      // 구분열 뒤(첫 번째 월 앞), 6월/12월 뒤 구분선
      const ym = activeCols[idx]?.ym || '';
      const month = parseInt(ym.split('.')[1]) || 0;
      if (month === 6 || month === 12) return 'border-right:2px solid #888;';
      return '';
    };
    const isJunMonth = (idx) => activeCols[idx] && (idx + 1) === junMonth;

    const thS  = 'background:#222;color:white;padding:3px 4px;font-size:8px;border:1px solid #444;text-align:right;white-space:nowrap;';
    const thSL = thS + 'text-align:left;';
    const thJun = thS + 'outline:2px solid #f39c12;outline-offset:-2px;color:#f39c12;font-weight:bold;';
    const tdS  = (bg, color='#111', bold=false, borderR='') =>
      `background:${bg};padding:3px 4px;font-size:8px;border-bottom:1px solid #e8e8e8;text-align:right;color:${color};${bold?'font-weight:bold;':''}${borderR}`;
    const tdTotal = (color='#111', bold=false) =>
      `background:#f0f0f0;padding:3px 4px;font-size:8px;border-bottom:1px solid #e8e8e8;text-align:right;color:${color};font-weight:bold;border-left:2px solid #bbb;`;

    const win = window.open('', '_blank', 'width=1400,height=900');
    win.document.write(`<html><head><title>분양금배분_${projectName}</title>
    <style>
      *{margin:0;padding:0;box-sizing:border-box;}
      body{font-family:'Malgun Gothic',sans-serif;font-size:8px;color:#111;padding:6mm;}
      h2{font-size:12px;font-weight:bold;text-align:center;margin-bottom:2px;}
      .sub{text-align:center;font-size:8px;color:#555;margin-bottom:8px;}
      table{border-collapse:collapse;width:100%;}
      th,td{-webkit-print-color-adjust:exact;print-color-adjust:exact;}
      th{background:#222;color:white;padding:3px 4px;text-align:right;font-size:8px;border:1px solid #444;white-space:nowrap;}
      th.L{text-align:left;}
      td{padding:3px 4px;border-bottom:1px solid #e8e8e8;text-align:right;font-size:8px;}
      .note{margin-top:5px;font-size:7px;color:#888;}
      @media print{
        @page{margin:6mm;size:A3 landscape;}
        th,td{-webkit-print-color-adjust:exact;print-color-adjust:exact;}
      }
    </style></head><body>`);
    win.document.write(`
      <h2 style="font-size:12px;font-weight:bold;text-align:center;margin-bottom:2px;font-family:'Malgun Gothic',sans-serif;">
        분양금 배분 현황 (상환용 / 운영비 계좌)
      </h2>
      <div style="text-align:center;font-size:8px;color:#555;margin-bottom:8px;font-family:'Malgun Gothic',sans-serif;">
        ${projectName} | ${new Date().toLocaleDateString('ko-KR')} | 단위: 천원 | 부가가치세 별도 | 기준분양율: ${baseRate}%
        | ${scenario==='over'?'초과 기준 고정':'미만 기준 고정'}
        ${junMonth > 0 ? `| 준공월: ${activeCols[junMonth-1]?.ym||''}` : ''}
      </div>
      <table style="width:100%;border-collapse:collapse;font-family:'Malgun Gothic',sans-serif;font-size:8px;">
        <thead>
          <tr>
            <th style="${thSL}min-width:70px;">항목</th>
            <th style="${thS}min-width:30px;border-right:2px solid #888;">구분</th>
            ${activeCols.map((r, idx) => {
              const isJun = isJunMonth(idx);
              const bR = colBorderStyle(idx);
              const style = isJun ? thJun + bR : thS + bR;
              return `<th style="${style}min-width:46px;">${isJun ? `★${r.ym}` : r.ym}</th>`;
            }).join('')}
            <th style="${thS}min-width:56px;color:#ddd;background:#333;border-left:2px solid #bbb;">합계</th>
          </tr>
        </thead>
        <tbody>
          ${ROW_DEFS.map(row => {
            if (row.key === '__divider__') return `<tr><td colspan="${activeCols.length+3}" style="height:3px;background:#ddd;"></td></tr>`;
            const isGrandRow = ['totalSave','totalOper','total'].includes(row.key);
            const rowSum = sum(row.key);
            if (!isGrandRow && rowSum === 0) return '';
            return `<tr>
              <td style="${tdS(row.bg, row.color, row.bold)}text-align:left;">${row.label||''}</td>
              <td style="${tdS(row.bg, row.sub==='상환용'?'#1a5276':row.sub==='운영비'?'#1a6a3a':'#555', row.bold)}border-right:2px solid #ccc;">${row.sub||''}</td>
              ${activeCols.map((r, idx) => {
                const bR = colBorderStyle(idx);
                const isJun = isJunMonth(idx);
                const cellBg = isJun ? (r.isOver ? '#fff8e1' : '#fffde7') : (r.isOver ? row.bg : '#fffde7');
                const junBorder = isJun ? 'outline:1px solid #f39c12;outline-offset:-1px;' : '';
                return `<td style="${tdS(cellBg, row.color, row.bold, bR)}${junBorder}">${fmtN(r[row.key])}</td>`;
              }).join('')}
              <td style="${tdTotal(row.color, true)}">${fmtN(rowSum)}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
      <div style="margin-top:8px;font-family:'Malgun Gothic',sans-serif;">
        <table style="width:auto;border-collapse:collapse;font-size:8px;">
          <thead>
            <tr>
              <th style="background:#1a3a5c;color:white;padding:3px 8px;text-align:center;" colspan="2">구분</th>
              <th style="background:#1a3a5c;color:#aed6f1;padding:3px 8px;text-align:center;">계약금</th>
              <th style="background:#1a3a5c;color:#aed6f1;padding:3px 8px;text-align:center;">중도금</th>
              <th style="background:#1a3a5c;color:#aed6f1;padding:3px 8px;text-align:center;">잔금</th>
              <th style="background:#1a3a5c;color:#aed6f1;padding:3px 8px;text-align:center;">상가</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="background:#e8f0f8;color:#1a3a5c;font-weight:bold;padding:3px 8px;text-align:center;" rowspan="2">초과<br/>(≥${baseRate}%)</td>
              <td style="background:#e8f0f8;color:#1a5276;padding:3px 8px;text-align:center;">상환용</td>
              <td style="background:#e8f0f8;color:#1a5276;padding:3px 8px;text-align:center;">${alloc.over.res.dep}%</td>
              <td style="background:#e8f0f8;color:#1a5276;padding:3px 8px;text-align:center;">${alloc.over.res.mid}%</td>
              <td style="background:#e8f0f8;color:#1a5276;padding:3px 8px;text-align:center;">${alloc.over.res.bal}%</td>
              <td style="background:#e8f0f8;color:#1a5276;padding:3px 8px;text-align:center;">${alloc.over.store.all}%</td>
            </tr>
            <tr>
              <td style="background:#e8f5ec;color:#1a6a3a;padding:3px 8px;text-align:center;">운영비</td>
              <td style="background:#e8f5ec;color:#1a6a3a;padding:3px 8px;text-align:center;">${100-alloc.over.res.dep}%</td>
              <td style="background:#e8f5ec;color:#1a6a3a;padding:3px 8px;text-align:center;">${100-alloc.over.res.mid}%</td>
              <td style="background:#e8f5ec;color:#1a6a3a;padding:3px 8px;text-align:center;">${100-alloc.over.res.bal}%</td>
              <td style="background:#e8f5ec;color:#1a6a3a;padding:3px 8px;text-align:center;">${100-alloc.over.store.all}%</td>
            </tr>
            <tr>
              <td style="background:#fff8e1;color:#7d5a00;font-weight:bold;padding:3px 8px;text-align:center;" rowspan="2">미만<br/>(&lt;${baseRate}%)</td>
              <td style="background:#fff8e1;color:#1a5276;padding:3px 8px;text-align:center;">상환용</td>
              <td style="background:#fff8e1;color:#1a5276;padding:3px 8px;text-align:center;">${alloc.under.res.dep}%</td>
              <td style="background:#fff8e1;color:#1a5276;padding:3px 8px;text-align:center;">${alloc.under.res.mid}%</td>
              <td style="background:#fff8e1;color:#1a5276;padding:3px 8px;text-align:center;">${alloc.under.res.bal}%</td>
              <td style="background:#fff8e1;color:#1a5276;padding:3px 8px;text-align:center;">${alloc.under.store.all}%</td>
            </tr>
            <tr>
              <td style="background:#fffde7;color:#1a6a3a;padding:3px 8px;text-align:center;">운영비</td>
              <td style="background:#fffde7;color:#1a6a3a;padding:3px 8px;text-align:center;">${100-alloc.under.res.dep}%</td>
              <td style="background:#fffde7;color:#1a6a3a;padding:3px 8px;text-align:center;">${100-alloc.under.res.mid}%</td>
              <td style="background:#fffde7;color:#1a6a3a;padding:3px 8px;text-align:center;">${100-alloc.under.res.bal}%</td>
              <td style="background:#fffde7;color:#1a6a3a;padding:3px 8px;text-align:center;">${100-alloc.under.store.all}%</td>
            </tr>
          </tbody>
        </table>
        <div style="margin-top:4px;font-size:7px;color:#888;">
          ※ 주거용 = 공동주택 + 발코니확장 + 오피스텔 | 노란 배경: 기준분양율(${baseRate}%) 미만
          ${junMonth > 0 ? `| ★ 준공월` : ''}
        </div>
      </div>
    `);
    win.document.write('</body></html>');
    win.document.close();
    setTimeout(() => win.print(), 400);
  };

  const junMonth = salesData?.junMonth || 0;
  const cardStyle = { border:'1px solid #e0e0e0', borderRadius:'8px', padding:'14px', backgroundColor:'white' };

  return (
    <div>
      {/* 헤더 */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'16px' }}>
        <div>
          <h3 style={{ margin:0, fontSize:'16px', color:'#1a1a2e' }}>■ 분양금 배분 현황</h3>
          <div style={{ fontSize:'11px', color:'#888', marginTop:'3px' }}>상환용 계좌 / 운영비 계좌 | 단위: 천원</div>
        </div>
        <button onClick={handlePrint} disabled={noData}
          style={{ padding:'8px 18px', backgroundColor: noData?'#bdc3c7':'#2c3e50',
            color:'white', border:'none', borderRadius:'6px',
            cursor: noData?'not-allowed':'pointer', fontSize:'12px', fontWeight:'bold' }}>
          🖨 인쇄
        </button>
      </div>

      {noData ? (
        <div style={{ padding:'40px', textAlign:'center', color:'#aaa',
          border:'2px dashed #ddd', borderRadius:'12px' }}>
          💡 분양율 탭을 먼저 방문하면 데이터가 자동으로 연동됩니다.
        </div>
      ) : (<>

        {/* 설정 패널 */}
        <div style={{ display:'flex', gap:'12px', flexWrap:'wrap', marginBottom:'16px' }}>

          {/* 기준 + 시나리오 */}
          <div style={{ ...cardStyle, minWidth:'200px' }}>
            <div style={{ fontWeight:'bold', fontSize:'12px', color:'#1a1a2e', marginBottom:'10px' }}>⚙ 기준 분양율</div>
            <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'14px' }}>
              <input type="number" min="0" max="100" value={baseRate}
                onChange={e => setBaseRate(parseFloat(e.target.value)||0)}
                style={{ width:'60px', padding:'5px 8px', border:'1px solid #2980b9',
                  borderRadius:'4px', fontSize:'14px', textAlign:'center',
                  fontWeight:'bold', color:'#1a3a5c' }} />
              <span style={{ fontSize:'14px', fontWeight:'bold', color:'#1a3a5c' }}>%</span>
            </div>
            <div style={{ fontWeight:'bold', fontSize:'12px', color:'#1a1a2e', marginBottom:'8px' }}>시나리오</div>
            {[
              { val:'over',  label:`초과 기준 고정 (분양율 ≥ ${baseRate}%)` },
              { val:'under', label:`미만 기준 고정 (분양율 < ${baseRate}%)` },
            ].map(opt => (
              <label key={opt.val} onClick={() => setScenario(opt.val)}
                style={{ display:'flex', alignItems:'center', gap:'6px', cursor:'pointer',
                  padding:'4px 8px', borderRadius:'4px', marginBottom:'2px',
                  backgroundColor: scenario===opt.val?'#e8f0f8':'transparent' }}>
                <div style={{ width:'12px', height:'12px', borderRadius:'50%', flexShrink:0,
                  border:`2px solid ${scenario===opt.val?'#1a3a5c':'#aaa'}`,
                  backgroundColor: scenario===opt.val?'#1a3a5c':'white' }} />
                <span style={{ fontSize:'11px', color: scenario===opt.val?'#1a3a5c':'#555' }}>{opt.label}</span>
              </label>
            ))}
          </div>

          {/* 초과 시 */}
          <div style={{ ...cardStyle, minWidth:'240px' }}>
            <div style={{ fontWeight:'bold', fontSize:'12px', color:'#1a3a5c', marginBottom:'10px' }}>
              📈 초과 시 (분양율 ≥ {baseRate}%)
            </div>
            <div style={{ fontSize:'10px', color:'#888', marginBottom:'6px' }}>주거용 (공동주택+오피스텔)</div>
            <AllocRow label="계약금" save={alloc.over.res.dep} onChangeSave={v => updateAlloc('over','res','dep',v)} />
            <AllocRow label="중도금" save={alloc.over.res.mid} onChangeSave={v => updateAlloc('over','res','mid',v)} />
            <AllocRow label="잔금"   save={alloc.over.res.bal} onChangeSave={v => updateAlloc('over','res','bal',v)} color='#555' />
            {hasStore && <>
              <div style={{ fontSize:'10px', color:'#888', margin:'8px 0 6px' }}>근린상가</div>
              <AllocRow label="전체" save={alloc.over.store.all} onChangeSave={v => updateAlloc('over','store','all',v)} color='#1a5c2a' />
            </>}
          </div>

          {/* 미만 시 */}
          <div style={{ ...cardStyle, minWidth:'240px', backgroundColor:'#fffde7', borderColor:'#ffe082' }}>
            <div style={{ fontWeight:'bold', fontSize:'12px', color:'#7d5a00', marginBottom:'10px' }}>
              📉 미만 시 (분양율 {'<'} {baseRate}%) — 운영비 우선
            </div>
            <div style={{ fontSize:'10px', color:'#888', marginBottom:'6px' }}>주거용 (공동주택+오피스텔)</div>
            <AllocRow label="계약금" save={alloc.under.res.dep} onChangeSave={v => updateAlloc('under','res','dep',v)} color='#7d5a00' />
            <AllocRow label="중도금" save={alloc.under.res.mid} onChangeSave={v => updateAlloc('under','res','mid',v)} color='#7d5a00' />
            <AllocRow label="잔금"   save={alloc.under.res.bal} onChangeSave={v => updateAlloc('under','res','bal',v)} color='#555' />
            {hasStore && <>
              <div style={{ fontSize:'10px', color:'#888', margin:'8px 0 6px' }}>근린상가</div>
              <AllocRow label="전체" save={alloc.under.store.all} onChangeSave={v => updateAlloc('under','store','all',v)} color='#1a5c2a' />
            </>}
          </div>

          {/* 요약 */}
          <div style={{ ...cardStyle, minWidth:'160px' }}>
            <div style={{ fontWeight:'bold', fontSize:'12px', color:'#1a1a2e', marginBottom:'12px' }}>💰 배분 요약</div>
            {[
              { label:'총 분양수입', val: grandTotal, color:'#2c3e50' },
              { label:'상환용계좌',  val: grandSave,  color:'#1a5276' },
              { label:'운영비계좌',  val: grandOper,  color:'#1a6a3a' },
            ].map(({ label, val, color }) => (
              <div key={label} style={{ marginBottom:'10px' }}>
                <div style={{ fontSize:'10px', color:'#888' }}>{label}</div>
                <div style={{ fontSize:'13px', fontWeight:'bold', color }}>
                  {formatNumber(Math.round(val))}
                  <span style={{ fontSize:'10px', color:'#aaa', marginLeft:'4px' }}>천원</span>
                </div>
                {grandTotal > 0 && val !== grandTotal && (
                  <div style={{ fontSize:'10px', color:'#aaa' }}>({(val/grandTotal*100).toFixed(1)}%)</div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 월별 표 — 행=항목, 열=월 */}
        <div style={{ overflowX:'auto', border:'1px solid #ddd', borderRadius:'8px' }}>
          <table style={{ borderCollapse:'collapse', fontSize:'11px', whiteSpace:'nowrap' }}>
            <thead>
              <tr>
                {/* 고정 열 */}
                <th style={{ padding:'8px 12px', background:'#1a1a2e', color:'white',
                  textAlign:'left', borderBottom:'2px solid #444', minWidth:'100px',
                  position:'sticky', left:0, zIndex:2 }}>항목</th>
                <th style={{ padding:'8px 8px', background:'#1a1a2e', color:'rgba(255,255,255,0.7)',
                  fontSize:'10px', borderBottom:'2px solid #444', minWidth:'44px',
                  borderRight:'2px solid #666',
                  position:'sticky', left:100, zIndex:2 }}>구분</th>
                {/* 월별 열 */}
                {activeCols.map((r, idx) => {
                  const month = parseInt(r.ym.split('.')[1]) || 0;
                  const isJun = junMonth > 0 && (idx + 1) === junMonth;
                  const borderR = (month === 6 || month === 12) ? '2px solid #555' : '1px solid #333';
                  return (
                    <th key={r.ym} style={{
                      padding:'6px 8px', background: isJun ? '#3d2b00' : '#1a1a2e',
                      color: isJun ? '#f39c12' : 'white',
                      textAlign:'right', borderBottom:'2px solid #444',
                      borderRight: borderR,
                      minWidth:'72px', fontWeight: isJun ? 'bold' : 'normal',
                      outline: isJun ? '2px solid #f39c12' : 'none',
                      outlineOffset: isJun ? '-2px' : '0',
                    }}>
                      <div style={{ fontWeight:'bold' }}>{isJun ? `★ ${r.ym}` : r.ym}</div>
                    </th>
                  );
                })}
                {/* 합계 열 */}
                <th style={{ padding:'8px 10px', background:'#333',
                  color:'#ddd', textAlign:'right', borderBottom:'2px solid #444',
                  borderLeft:'2px solid #888', minWidth:'80px' }}>합계</th>
              </tr>
            </thead>
            <tbody>
              {ROW_DEFS.map((row, ri) => {
                if (row.key === '__divider__') {
                  return (
                    <tr key={ri}>
                      <td colSpan={activeCols.length + 3}
                        style={{ height:'4px', backgroundColor:'#e8e8e8', padding:0 }} />
                    </tr>
                  );
                }
                const rowSum = sum(row.key);
                const isGrandRow = ['totalSave','totalOper','total'].includes(row.key);
                if (!isGrandRow && rowSum === 0) return null;

                return (
                  <tr key={row.key}>
                    <td style={{ padding:'6px 12px', backgroundColor: row.bg,
                      fontWeight: row.bold?'bold':'normal', color: row.color,
                      borderBottom:'1px solid #eee', textAlign:'left',
                      position:'sticky', left:0, zIndex:1, fontSize:'11px' }}>
                      {row.label}
                    </td>
                    <td style={{ padding:'6px 8px', backgroundColor: row.bg,
                      color: row.sub==='상환용'?'#1a5276':row.sub==='운영비'?'#1a6a3a':'#555',
                      borderBottom:'1px solid #eee', fontSize:'10px', textAlign:'center',
                      position:'sticky', left:100, zIndex:1 }}>
                      {row.sub}
                    </td>
                    {activeCols.map((r, idx) => {
                      const val = r[row.key] || 0;
                      const month = parseInt(r.ym.split('.')[1]) || 0;
                      const isJun = junMonth > 0 && (idx + 1) === junMonth;
                      const borderR = (month === 6 || month === 12) ? '2px solid #bbb' : undefined;
                      const underBg = r.isOver ? row.bg : '#fffde7';
                      const junBg   = isJun ? (r.isOver ? '#fff8e1' : '#fff3cd') : underBg;
                      return (
                        <td key={r.ym} style={{ padding:'6px 8px',
                          backgroundColor: junBg,
                          color: row.color, fontWeight: row.bold?'bold':'normal',
                          borderBottom:'1px solid #eee', textAlign:'right',
                          borderRight: borderR,
                          outline: isJun ? '1px solid #f39c12' : 'none',
                          outlineOffset: isJun ? '-1px' : '0',
                        }}>
                          {fmtN(val)}
                        </td>
                      );
                    })}
                    <td style={{ padding:'6px 10px', backgroundColor:'#f0f0f0',
                      color: row.color, fontWeight:'bold',
                      borderBottom:'1px solid #eee', textAlign:'right',
                      borderLeft:'2px solid #bbb' }}>
                      {fmtN(rowSum)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div style={{ marginTop:'8px', fontSize:'10px', color:'#888' }}>
          ※ 주거용 = 공동주택 + 발코니확장 + 오피스텔
          &nbsp;|&nbsp; ↑ 흰 배경: 기준분양율({baseRate}%) 초과
          &nbsp;|&nbsp; ↓ 노란 배경: 기준분양율 미만
        </div>
      </>)}
    </div>
  );
}

// ─────────────────────────────────────────────
// 월별 현금흐름
// ─────────────────────────────────────────────
function CashFlow({ salesData, monthlyPayments, financeData, projectName, cashFlowResult }) {
  const mp  = monthlyPayments || {};
  const months = mp.months || salesData?.ymList || [];
  const junMonth   = salesData?.junMonth    || 0;
  const conMonth   = salesData?.constructMonth || 0;
  const noData = months.length === 0;
  const fmtC = (v) => v ? formatNumber(Math.round(v)) : '';
  const fmtN2 = (v) => v ? formatNumber(Math.round(v)) : '';

  // ── 수입 행 정의 ──
  const incomeRows = [
    { key:'apt',   label:'공동주택'   },
    { key:'bal',   label:'발코니확장' },
    { key:'offi',  label:'오피스텔'   },
    { key:'store', label:'근린상가'   },
  ];
  // VAT포함 매출
  const getIncome = (key, i) => {
    switch(key) {
      case 'apt':   return (salesData?.aptDepMonthlyVat?.[i]||salesData?.aptDepMonthly?.[i]||0)+(salesData?.aptMidMonthlyVat?.[i]||salesData?.aptMidMonthly?.[i]||0)+(salesData?.aptBalMonthlyVat?.[i]||salesData?.aptBalMonthly?.[i]||0);
      case 'bal':   return (salesData?.balDepMonthlyVat?.[i]||salesData?.balDepMonthly?.[i]||0)+(salesData?.balBalMonthlyVat?.[i]||salesData?.balBalMonthly?.[i]||0);
      case 'offi':  return (salesData?.offiDepMonthlyVat?.[i]||salesData?.offiDepMonthly?.[i]||0)+(salesData?.offiMidMonthlyVat?.[i]||salesData?.offiMidMonthly?.[i]||0)+(salesData?.offiBalMonthlyVat?.[i]||salesData?.offiBalMonthly?.[i]||0);
      case 'store': return (salesData?.storeMonthlyVat?.[i]||salesData?.storeMonthly?.[i]||0);
      default: return 0;
    }
  };
  // 공급금액(VAT제외)
  const getIncomeSupply = (key, i) => {
    switch(key) {
      case 'apt':   return (salesData?.aptDepMonthly?.[i]||0)+(salesData?.aptMidMonthly?.[i]||0)+(salesData?.aptBalMonthly?.[i]||0);
      case 'bal':   return (salesData?.balDepMonthly?.[i]||0)+(salesData?.balBalMonthly?.[i]||0);
      case 'offi':  return (salesData?.offiDepMonthly?.[i]||0)+(salesData?.offiMidMonthly?.[i]||0)+(salesData?.offiBalMonthly?.[i]||0);
      case 'store': return (salesData?.storeMonthly?.[i]||0);
      default: return 0;
    }
  };
  // 부가세
  const getIncomeVat = (key, i) => getIncome(key, i) - getIncomeSupply(key, i);

  // ── 지출 행 정의 ──
  const costRows = [
    { key:'land',     label:'토지관련비용' },
    { key:'direct',   label:'직접공사비'   },
    { key:'indirect', label:'간접공사비'   },
    { key:'consult',  label:'용역비'       },
    { key:'sales',    label:'판매비'       },
    { key:'overhead', label:'부대비'       },
    { key:'tax',      label:'제세금'       },
  ];
  const getCost        = (key, ym) => (mp[key]?.[ym]||0) + (mp[`${key}Vat`]?.[ym]||0);
  const getCostSupply  = (key, ym) => (mp[key]?.[ym]||0);
  const getCostVat_    = (key, ym) => (mp[`${key}Vat`]?.[ym]||0);

  // ── 금융비 월별 (cashFlowResult 연동, 없으면 기존 계산) ──
  const financeCostMonthly = useMemo(() => {
    if (cashFlowResult) {
      const m = {};
      (cashFlowResult.months||[]).forEach((ym,i) => {
        const r = cashFlowResult.result[i] || {};
        // 수수료+중도금무이자 (운영비계좌) + PF이자 (상환용계좌) = 전체 금융비
        m[ym] = (r.fee||0) + (r.midInt||0) + (r.intS||0) + (r.intM||0) + (r.intJ||0);
      });
      return m;
    }
    return calcFinanceCostMonthly(financeData, salesData, months);
  }, [cashFlowResult, financeData, salesData, months]); // eslint-disable-line
  const getFinanceCost = (ym) => financeCostMonthly[ym] || 0;

  // ── 월별 계산 ──
  const incomeTotals        = months.map((_,i) => incomeRows.reduce((s,r) => s+getIncome(r.key,i), 0));
  const incomeSupplyTotals  = months.map((_,i) => incomeRows.reduce((s,r) => s+getIncomeSupply(r.key,i), 0));
  const incomeVatTotals     = months.map((_,i) => incomeRows.reduce((s,r) => s+getIncomeVat(r.key,i), 0));
  const costTotals        = months.map((_,i) => costRows.reduce((s,r) => s+getCost(r.key,months[i]), 0));
  const costSupplyTotals  = months.map((_,i) => costRows.reduce((s,r) => s+getCostSupply(r.key,months[i]), 0));
  const costVatTotals_    = months.map((_,i) => costRows.reduce((s,r) => s+getCostVat_(r.key,months[i]), 0));
  const finTotals    = months.map(ym => getFinanceCost(ym)); // 금융비
  const vatSettle    = months.map(ym => mp.vatSettlements?.[ym] || 0);
  const netCash      = months.map((_,i) => incomeTotals[i] - costTotals[i] - finTotals[i] - vatSettle[i]);
  const cumulative   = months.reduce((acc,_,i) => { acc.push((acc[i-1]||0)+netCash[i]); return acc; }, []);

  const rowTotalIncome = (key) => months.reduce((s,_,i) => s+getIncome(key,i), 0);
  const rowTotalCost   = (key) => months.reduce((s,_,i) => s+getCost(key,months[i]), 0);
  const totalFinCost   = finTotals.reduce((s,v)=>s+v,0);

  // ── 열 스타일 헬퍼 ──
  const isCon = (idx) => conMonth > 0 && (idx+1) === conMonth;
  const isJun = (idx) => junMonth > 0 && (idx+1) === junMonth;
  const isSpecial = (idx) => isCon(idx) || isJun(idx);
  const monthBorderR = (ym) => { const m=parseInt(ym.split('.')[1])||0; return (m===6||m===12)?'2px solid #aaa':undefined; };
  const specialBorder = (idx) => isSpecial(idx) ? '2px solid #333' : undefined;

  // 인쇄
  const handlePrint = () => {
    const win = window.open('', '_blank', 'width=1400,height=900');
    const n   = months.length;

    const bR = (ym, idx) => {
      const m   = parseInt(ym.split('.')[1])||0;
      const sp  = isSpecial(idx);
      if (sp)         return 'border-left:2px solid #555;border-right:2px solid #555;';
      if (m===6||m===12) return 'border-right:2px solid #aaa;';
      return '';
    };
    const colHdr = (ym, idx) => {
      const con=isCon(idx), jun=isJun(idx), sp=con||jun;
      const color = con ? '#58d68d' : jun ? '#f5cba7' : 'white';
      const extra = sp ? 'border-left:2px solid #aaa;border-right:2px solid #aaa;' : bR(ym,idx);
      return `<th style="background:#222;color:${color};padding:3px 4px;font-size:8px;border-bottom:1px solid #444;text-align:right;white-space:nowrap;${extra}">${sp?(con?'◆ ':'★ '):''}${ym}</th>`;
    };
    const thL  = (bg,color='white',extra='') => `<th style="background:${bg};color:${color};padding:4px 6px;font-size:8px;border-bottom:1px solid #555;text-align:left;${extra}">`;
    const thR  = (bg,color='white',extra='') => `<th style="background:${bg};color:${color};padding:4px 6px;font-size:8px;border-bottom:1px solid #555;text-align:right;${extra}">`;
    const cell = (v,bg,color,bold,extra='') => `<td style="background:${bg};color:${color};padding:3px 4px;font-size:8px;border-bottom:1px solid #eee;text-align:right;${bold?'font-weight:bold;':''}${extra}-webkit-print-color-adjust:exact;print-color-adjust:exact;">${v}</td>`;
    const secHdr = (label,bg) => `<tr><td colspan="${n+2}" style="background:${bg};color:white;font-weight:bold;padding:4px 6px;font-size:9px;-webkit-print-color-adjust:exact;print-color-adjust:exact;">${label}</td></tr>`;
    const div3   = (bg='#aaa') => `<tr><td colspan="${n+2}" style="height:3px;background:${bg};-webkit-print-color-adjust:exact;print-color-adjust:exact;"></td></tr>`;
    const fmtV   = (v) => v ? formatNumber(Math.round(v)) : '';
    const fmtNeg = (v) => v < 0 ? `(${fmtV(-v)})` : fmtV(v);

    const incomeSection = () => {
      let rows = '';
      incomeRows.forEach(r => {
        const vals = months.map((_,i) => getIncome(r.key,i));
        const total = vals.reduce((s,v)=>s+v,0);
        if(total===0) return;
        rows += `<tr><td style="background:#f8f9fa;padding:3px 4px 3px 12px;font-size:8px;border-bottom:1px solid #eee;-webkit-print-color-adjust:exact;print-color-adjust:exact;">${r.label}</td>${vals.map((v,idx)=>cell(fmtV(v),isSpecial(idx)?'#f5f5e8':'white','#333',false,bR(months[idx],idx))).join('')}${cell(fmtV(total),'#f0f0f0','#333',true,'border-left:2px solid #bbb;')}</tr>`;
      });
      // 공급금액 합계행
      const supplyTotals = months.map((_,i) => incomeRows.reduce((s,r)=>s+getIncomeSupply(r.key,i),0));
      const supplyGrand  = supplyTotals.reduce((s,v)=>s+v,0);
      const vatTotals_   = months.map((_,i) => incomeRows.reduce((s,r)=>s+getIncomeVat(r.key,i),0));
      const vatGrand_    = vatTotals_.reduce((s,v)=>s+v,0);
      const totals = months.map((_,i) => incomeRows.reduce((s,r)=>s+getIncome(r.key,i),0));
      const grand  = totals.reduce((s,v)=>s+v,0);
      rows += `<tr><td style="background:#e8f4e8;color:#1a6a3a;font-weight:bold;padding:3px 6px;font-size:8px;border-bottom:1px solid #eee;-webkit-print-color-adjust:exact;print-color-adjust:exact;">공급금액 (VAT제외)</td>
        ${supplyTotals.map((v,idx)=>cell(fmtV(v),isSpecial(idx)?'#dde8f0':'#e8f4e8','#1a6a3a',true,bR(months[idx],idx))).join('')}
        ${cell(fmtV(supplyGrand),'#d5ecd5','#1a6a3a',true,'border-left:2px solid #aaa;')}</tr>`;
      if (vatGrand_ > 0) {
        rows += `<tr><td style="background:#fff8e8;color:#b7770d;padding:3px 6px;font-size:8px;border-bottom:1px solid #eee;-webkit-print-color-adjust:exact;print-color-adjust:exact;">└ 부가세</td>
          ${vatTotals_.map((v,idx)=>cell(fmtV(v),isSpecial(idx)?'#f5f5e8':'#fff8e8','#b7770d',false,bR(months[idx],idx))).join('')}
          ${cell(fmtV(vatGrand_),'#f5ecc5','#b7770d',true,'border-left:2px solid #aaa;')}</tr>`;
      }
      rows += `<tr>${[...totals.map((v,idx)=>cell(fmtV(v),isSpecial(idx)?'#dde8f0':'#e8f0f8','#1a3a5c',true,bR(months[idx],idx))), cell(fmtV(grand),'#d0dce8','#1a3a5c',true,'border-left:2px solid #aaa;')].join('')}</tr>`.replace('<tr>','<tr><td style="background:#e8f0f8;color:#1a3a5c;font-weight:bold;padding:3px 6px;font-size:8px;border-bottom:1px solid #eee;-webkit-print-color-adjust:exact;print-color-adjust:exact;">매출 합계 (VAT포함)</td>');
      return rows;
    };

    const costSection = () => {
      let rows = '';
      costRows.forEach(r => {
        const vals = months.map(ym => getCost(r.key,ym));
        const total = vals.reduce((s,v)=>s+v,0);
        if(total===0) return;
        rows += `<tr><td style="background:#fdf8f8;padding:3px 4px 3px 12px;font-size:8px;border-bottom:1px solid #eee;-webkit-print-color-adjust:exact;print-color-adjust:exact;">${r.label}</td>${vals.map((v,idx)=>cell(fmtV(v),isSpecial(idx)?'#f5f5e8':'white','#333',false,bR(months[idx],idx))).join('')}${cell(fmtV(total),'#f0f0f0','#333',true,'border-left:2px solid #bbb;')}</tr>`;
      });
      return rows;
    };

    win.document.write(`<html><head><title>월별현금흐름_${projectName}</title>
    <style>
      *{margin:0;padding:0;box-sizing:border-box;}
      body{font-family:'Malgun Gothic',sans-serif;font-size:8px;color:#111;padding:6mm;}
      h2{font-size:12px;font-weight:bold;text-align:center;margin-bottom:2px;}
      table{border-collapse:collapse;width:100%;}
      th,td{-webkit-print-color-adjust:exact;print-color-adjust:exact;}
      @media print{@page{margin:6mm;size:A3 landscape;}th,td{-webkit-print-color-adjust:exact;print-color-adjust:exact;}}
    </style></head><body>
    <h2>월별 현금흐름</h2>
    <div style="text-align:center;font-size:8px;color:#555;margin-bottom:8px;">
      ${projectName} | ${new Date().toLocaleDateString('ko-KR')} | 단위: 천원 | 부가가치세 별도 (VAT 포함)
      ${conMonth>0?`| ◆ 착공: ${months[conMonth-1]||''}`:''}
      ${junMonth>0?`| ★ 준공: ${months[junMonth-1]||''}`:''}
    </div>
    <table>
      <thead><tr>
        <th style="background:#222;color:white;padding:3px 6px;font-size:8px;border-bottom:2px solid #444;text-align:left;min-width:88px;white-space:nowrap;">항목</th>
        ${months.map(colHdr).join('')}
        <th style="background:#333;color:#f5cba7;padding:3px 4px;font-size:8px;border-bottom:2px solid #444;text-align:right;min-width:64px;border-left:2px solid #888;">합계</th>
      </tr></thead>
      <tbody>
        ${secHdr('▶ 수입 (VAT 포함)', RS.secBg)}
        ${incomeSection()}
        ${div3()}
        ${secHdr('▶ 지출 (VAT 포함)', RS.secBg)}
        ${costSection()}
        ${finTotals.some(v=>v>0) ? `
        <tr><td style="background:#fff8f0;color:#e67e22;font-weight:bold;padding:3px 6px;font-size:8px;border-bottom:1px solid #eee;-webkit-print-color-adjust:exact;print-color-adjust:exact;">금융비용</td>
          ${finTotals.map((v,idx)=>cell(fmtV(v),isSpecial(idx)?'#f5f5e8':'#fff8f0','#e67e22',false,bR(months[idx],idx))).join('')}
          ${cell(fmtV(finTotals.reduce((s,v)=>s+v,0)),'#ffe8cc','#e67e22',true,'border-left:2px solid #aaa;')}
        </tr>
        <tr><td style="background:#f0f4e8;color:#3a5a1c;font-weight:bold;padding:3px 6px;font-size:8px;border-bottom:1px solid #eee;-webkit-print-color-adjust:exact;print-color-adjust:exact;">공급금액 (VAT제외)</td>
          ${months.map((_,idx)=>cell(fmtV(costSupplyTotals[idx]+finTotals[idx]),isSpecial(idx)?'#e5edd8':'#f0f4e8','#3a5a1c',true,bR(months[idx],idx))).join('')}
          ${cell(fmtV(costSupplyTotals.reduce((s,v)=>s+v,0)+finTotals.reduce((s,v)=>s+v,0)),'#e0ecce','#3a5a1c',true,'border-left:2px solid #aaa;')}
        </tr>
        ${costVatTotals_.some(v=>v>0)?`<tr><td style="background:#fff8e8;color:#b7770d;padding:3px 6px;font-size:8px;border-bottom:1px solid #eee;-webkit-print-color-adjust:exact;print-color-adjust:exact;">└ 부가세</td>
          ${months.map((_,idx)=>cell(fmtV(costVatTotals_[idx]),isSpecial(idx)?'#f5f5e8':'#fff8e8','#b7770d',false,bR(months[idx],idx))).join('')}
          ${cell(fmtV(costVatTotals_.reduce((s,v)=>s+v,0)),'#f5ecc5','#b7770d',true,'border-left:2px solid #aaa;')}
        </tr>`:''}
        <tr><td style="background:#f0e8e8;color:#555;font-weight:bold;padding:3px 6px;font-size:8px;border-bottom:1px solid #eee;-webkit-print-color-adjust:exact;print-color-adjust:exact;">지출 합계 (VAT포함)</td>
          ${months.map((_,idx)=>cell(fmtV(costTotals[idx]+finTotals[idx]),isSpecial(idx)?'#ede0e0':'#f0e8e8','#555',true,bR(months[idx],idx))).join('')}
          ${cell(fmtV(costTotals.reduce((s,v)=>s+v,0)+finTotals.reduce((s,v)=>s+v,0)),'#e8d8d8','#555',true,'border-left:2px solid #aaa;')}
        </tr>` : ''}
        ${div3()}
        <tr>
          <td style="background:#fffde7;color:#7d5a00;font-weight:bold;padding:3px 6px;font-size:8px;border-bottom:1px solid #eee;-webkit-print-color-adjust:exact;print-color-adjust:exact;">부가세 납부(+)/환급(-)</td>
          ${vatSettle.map((v,idx)=>cell(v>0?fmtV(v):v<0?`(${fmtV(-v)})`:'',isSpecial(idx)?'#f5f5e8':'#fffde7',v>0?'#c0392b':v<0?'#1a5276':'#888',true,bR(months[idx],idx))).join('')}
          ${cell(fmtV(vatSettle.reduce((s,v)=>s+v,0)),'#f0e8c0','#7d5a00',true,'border-left:2px solid #aaa;')}
        </tr>
        ${div3('#333')}
        <tr>
          <td style="background:#e8e8e8;color:#1a1a2e;font-weight:bold;padding:3px 6px;font-size:8px;border-bottom:1px solid #eee;-webkit-print-color-adjust:exact;print-color-adjust:exact;">순현금흐름</td>
          ${netCash.map((v,idx)=>cell(fmtNeg(v),isSpecial(idx)?'#f5f5e8':'#f5f5f5',v>=0?'#1a3a5c':'#c0392b',true,bR(months[idx],idx))).join('')}
          ${cell(fmtNeg(netCash.reduce((s,v)=>s+v,0)),'#e0e0e0','#1a1a2e',true,'border-left:2px solid #aaa;')}
        </tr>
        <tr>
          <td style="background:#d5d5d5;color:#1a1a2e;font-weight:bold;padding:3px 6px;font-size:8px;border-bottom:1px solid #eee;-webkit-print-color-adjust:exact;print-color-adjust:exact;">누적현금흐름</td>
          ${cumulative.map((v,idx)=>cell(fmtNeg(v),isSpecial(idx)?'#f5f5e8':'#ececec',v>=0?'#1a3a5c':'#c0392b',true,bR(months[idx],idx))).join('')}
          ${cell(fmtNeg(cumulative[cumulative.length-1]||0),'#ccc','#1a1a2e',true,'border-left:2px solid #aaa;')}
        </tr>
      </tbody>
    </table>
    <div style="margin-top:5px;font-size:7px;color:#888;">※ 부가세 납부(+): 실제 지출 / 환급(-): 실제 수입 | ◆ 착공월 | ★ 준공월</div>
    </body></html>`);
    win.document.close();
    setTimeout(() => win.print(), 400);
  };

  // ── 화면 공통 헬퍼 ──
  const thSty = (extra={}) => ({ padding:'6px 8px', background:'#1a1a2e', color:'white', textAlign:'right', borderBottom:'2px solid #444', fontSize:'11px', whiteSpace:'nowrap', ...extra });
  const tdSty = (bg, color='#333', bold=false) => ({ padding:'5px 8px', backgroundColor:bg, color, fontWeight:bold?'bold':'normal', borderBottom:'1px solid #eee', textAlign:'right' });
  const colBR  = (ym) => { const m=parseInt(ym.split('.')[1])||0; return (m===6||m===12)?'2px solid #666':undefined; };
  const cellBg = (idx, base='white') => isSpecial(idx) ? '#f5f5dc' : base;

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'16px' }}>
        <div>
          <h3 style={{ margin:0, fontSize:'16px', color:'#1a1a2e' }}>■ 월별 현금흐름</h3>
          <div style={{ fontSize:'11px', color:'#888', marginTop:'3px' }}>VAT 포함 기준 | 단위: 천원</div>
        </div>
        <button onClick={handlePrint} disabled={noData}
          style={{ padding:'8px 18px', backgroundColor:noData?'#bdc3c7':'#2c3e50', color:'white', border:'none', borderRadius:'6px', cursor:noData?'not-allowed':'pointer', fontSize:'12px', fontWeight:'bold' }}>
          🖨 인쇄
        </button>
      </div>

      {noData ? (
        <div style={{ padding:'40px', textAlign:'center', color:'#aaa', border:'2px dashed #ddd', borderRadius:'12px' }}>
          💡 사업비 탭을 먼저 방문하면 데이터가 자동으로 연동됩니다.
        </div>
      ) : (
        <div style={{ overflowX:'auto', border:'1px solid #ddd', borderRadius:'8px' }}>
          <table style={{ borderCollapse:'collapse', fontSize:'11px', whiteSpace:'nowrap' }}>
            <thead>
              <tr>
                <th style={{ ...thSty({ textAlign:'left', minWidth:'110px', position:'sticky', left:0, zIndex:2 }) }}>항목</th>
                {months.map((ym, idx) => {
                  const con=isCon(idx), jun=isJun(idx), sp=con||jun;
                  const m=parseInt(ym.split('.')[1])||0;
                  return (
                    <th key={ym} style={{ ...thSty({
                      minWidth:'68px',
                      color: con?'#58d68d':jun?'#f39c12':'white',
                      fontWeight: sp?'bold':'normal',
                      borderRight: sp?'2px solid #aaa':(m===6||m===12)?'2px solid #555':undefined,
                      borderLeft:  sp?'2px solid #aaa':undefined,
                    }) }}>
                      {con?`◆ ${ym}`:jun?`★ ${ym}`:ym}
                    </th>
                  );
                })}
                <th style={{ ...thSty({ minWidth:'80px', color:'#f5cba7', borderLeft:'2px solid #888' }) }}>합계</th>
              </tr>
            </thead>
            <tbody>
              {/* 수입 헤더 */}
              <tr><td colSpan={months.length+2} style={{ padding:'5px 10px', background:RS.secBg, color:'white', fontWeight:'bold', fontSize:'11px' }}>▶ 수입 (VAT 포함)</td></tr>
              {incomeRows.map(r => {
                const total = months.reduce((_,i)=>0,0) || rowTotalIncome(r.key);
                const t = rowTotalIncome(r.key);
                if(t===0) return null;
                return (
                  <tr key={r.key}>
                    <td style={{ ...tdSty('#f8f9fa','#333'), textAlign:'left', paddingLeft:'18px', position:'sticky', left:0 }}>{r.label}</td>
                    {months.map((ym,idx) => (
                      <td key={ym} style={{ ...tdSty(cellBg(idx),'#333'), borderRight:colBR(ym), borderLeft:isSpecial(idx)?'2px solid #bbb':undefined, borderRight2:isSpecial(idx)?'2px solid #bbb':undefined }}>
                        {fmtC(getIncome(r.key, idx))}
                      </td>
                    ))}
                    <td style={{ ...tdSty('#f0f0f0','#333',true), borderLeft:'2px solid #bbb' }}>{fmtC(t)}</td>
                  </tr>
                );
              })}
              {/* 수입 합계 - 공급금액/부가세/합계 3행 */}
              <tr style={{ borderTop:'2px solid #888' }}>
                <td style={{ ...tdSty('#e8f4e8','#1a6a3a'), textAlign:'left', position:'sticky', left:0 }}>공급금액 (VAT제외)</td>
                {incomeSupplyTotals.map((v,idx) => (
                  <td key={months[idx]} style={{ ...tdSty(cellBg(idx,'#e8f4e8'),'#1a6a3a'), borderRight:colBR(months[idx]), borderLeft:isSpecial(idx)?'2px solid #bbb':undefined }}>{fmtC(v)}</td>
                ))}
                <td style={{ ...tdSty('#d5ecd5','#1a6a3a',true), borderLeft:'2px solid #bbb' }}>{fmtC(incomeSupplyTotals.reduce((s,v)=>s+v,0))}</td>
              </tr>
              {incomeVatTotals.some(v=>v>0) && (
                <tr>
                  <td style={{ ...tdSty('#fff8e8','#b7770d'), textAlign:'left', position:'sticky', left:0 }}>└ 부가세</td>
                  {incomeVatTotals.map((v,idx) => (
                    <td key={months[idx]} style={{ ...tdSty(cellBg(idx,'#fff8e8'),'#b7770d'), borderRight:colBR(months[idx]), borderLeft:isSpecial(idx)?'2px solid #bbb':undefined }}>{fmtC(v)}</td>
                  ))}
                  <td style={{ ...tdSty('#f5ecc5','#b7770d',true), borderLeft:'2px solid #bbb' }}>{fmtC(incomeVatTotals.reduce((s,v)=>s+v,0))}</td>
                </tr>
              )}
              <tr>
                <td style={{ ...tdSty('#e8e8e8','#1a3a5c',true), textAlign:'left', position:'sticky', left:0 }}>매출 합계 (VAT포함)</td>
                {incomeTotals.map((v,idx) => (
                  <td key={months[idx]} style={{ ...tdSty(cellBg(idx,'#d5e8f7'),'#1a3a5c',true), borderRight:colBR(months[idx]), borderLeft:isSpecial(idx)?'2px solid #bbb':undefined }}>{fmtC(v)}</td>
                ))}
                <td style={{ ...tdSty('#c5ddf0','#1a3a5c',true), borderLeft:'2px solid #bbb' }}>{fmtC(incomeTotals.reduce((s,v)=>s+v,0))}</td>
              </tr>
              <tr><td colSpan={months.length+2} style={{ height:'3px', background:'#aaa', padding:0 }} /></tr>
              {/* 지출 헤더 */}
              <tr><td colSpan={months.length+2} style={{ padding:'5px 10px', background:RS.secBg, color:'white', fontWeight:'bold', fontSize:'11px' }}>▶ 지출 (VAT 포함)</td></tr>
              {costRows.map(r => {
                const t = rowTotalCost(r.key);
                if(t===0) return null;
                return (
                  <tr key={r.key}>
                    <td style={{ ...tdSty('#fdf8f8','#333'), textAlign:'left', paddingLeft:'18px', position:'sticky', left:0 }}>{r.label}</td>
                    {months.map((ym,idx) => (
                      <td key={ym} style={{ ...tdSty(cellBg(idx),'#333'), borderRight:colBR(ym), borderLeft:isSpecial(idx)?'2px solid #bbb':undefined }}>
                        {fmtC(getCost(r.key,ym))}
                      </td>
                    ))}
                    <td style={{ ...tdSty('#f0f0f0','#333',true), borderLeft:'2px solid #bbb' }}>{fmtC(t)}</td>
                  </tr>
                );
              })}
              {/* 금융비 */}
              {totalFinCost > 0 && (
                <tr>
                  <td style={{ ...tdSty('#fdf3e7','#7d5a00'), textAlign:'left', paddingLeft:'18px', position:'sticky', left:0 }}>금융비용</td>
                  {months.map((ym,idx) => (
                    <td key={ym} style={{ ...tdSty(cellBg(idx,'#fdf3e7'),'#7d5a00'), borderRight:colBR(ym), borderLeft:isSpecial(idx)?'2px solid #bbb':undefined }}>
                      {fmtC(getFinanceCost(ym))}
                    </td>
                  ))}
                  <td style={{ ...tdSty('#f5e6d0','#7d5a00',true), borderLeft:'2px solid #bbb' }}>{fmtC(totalFinCost)}</td>
                </tr>
              )}
              {/* 지출합계 - 공급금액/부가세/합계 3행 */}
              <tr style={{ borderTop:'2px solid #888' }}>
                <td style={{ ...tdSty('#f0f4e8','#3a5a1c',true), textAlign:'left', position:'sticky', left:0 }}>공급금액 (VAT제외)</td>
                {costSupplyTotals.map((v,idx) => (
                  <td key={months[idx]} style={{ ...tdSty(cellBg(idx,'#f0f4e8'),'#3a5a1c',true), borderRight:colBR(months[idx]), borderLeft:isSpecial(idx)?'2px solid #bbb':undefined }}>
                    {fmtC(v + finTotals[idx])}
                  </td>
                ))}
                <td style={{ ...tdSty('#e0ecce','#3a5a1c',true), borderLeft:'2px solid #bbb' }}>
                  {fmtC(costSupplyTotals.reduce((s,v)=>s+v,0) + totalFinCost)}
                </td>
              </tr>
              {costVatTotals_.some(v=>v>0) && (
                <tr>
                  <td style={{ ...tdSty('#fff8e8','#b7770d'), textAlign:'left', position:'sticky', left:0 }}>└ 부가세</td>
                  {costVatTotals_.map((v,idx) => (
                    <td key={months[idx]} style={{ ...tdSty(cellBg(idx,'#fff8e8'),'#b7770d'), borderRight:colBR(months[idx]), borderLeft:isSpecial(idx)?'2px solid #bbb':undefined }}>
                      {fmtC(v)}
                    </td>
                  ))}
                  <td style={{ ...tdSty('#f5ecc5','#b7770d',true), borderLeft:'2px solid #bbb' }}>
                    {fmtC(costVatTotals_.reduce((s,v)=>s+v,0))}
                  </td>
                </tr>
              )}
              <tr>
                <td style={{ ...tdSty('#e8e8e8','#555',true), textAlign:'left', position:'sticky', left:0 }}>지출 합계 (VAT포함)</td>
                {months.map((_,idx) => (
                  <td key={months[idx]} style={{ ...tdSty(cellBg(idx,'#f5d5d5'),'#555',true), borderRight:colBR(months[idx]), borderLeft:isSpecial(idx)?'2px solid #bbb':undefined }}>
                    {fmtC(costTotals[idx] + finTotals[idx])}
                  </td>
                ))}
                <td style={{ ...tdSty('#edc5c5','#555',true), borderLeft:'2px solid #bbb' }}>{fmtC(costTotals.reduce((s,v)=>s+v,0) + totalFinCost)}</td>
              </tr>
              <tr><td colSpan={months.length+2} style={{ height:'3px', background:'#aaa', padding:0 }} /></tr>
              {/* 부가세 정산 */}
              <tr>
                <td style={{ ...tdSty('#fffde7','#7d5a00',true), textAlign:'left', position:'sticky', left:0 }}>부가세 납부(+)/환급(-)</td>
                {vatSettle.map((v,idx) => (
                  <td key={months[idx]} style={{ ...tdSty(cellBg(idx,'#fffde7'), v>0?'#c0392b':v<0?'#1a5276':'#888', true), borderRight:colBR(months[idx]), borderLeft:isSpecial(idx)?'2px solid #bbb':undefined }}>
                    {v>0?fmtC(v):v<0?`(${fmtC(-v)})`:''}
                  </td>
                ))}
                <td style={{ ...tdSty('#f0e8c0','#7d5a00',true), borderLeft:'2px solid #bbb' }}>{fmtC(vatSettle.reduce((s,v)=>s+v,0))}</td>
              </tr>
              <tr><td colSpan={months.length+2} style={{ height:'3px', background:'#333', padding:0 }} /></tr>
              {/* 순현금흐름 */}
              <tr>
                <td style={{ ...tdSty('#e8e8e8','#1a1a2e',true), textAlign:'left', position:'sticky', left:0 }}>순현금흐름</td>
                {netCash.map((v,idx) => (
                  <td key={months[idx]} style={{ ...tdSty(cellBg(idx,'#f5f5f5'), v>=0?'#1a3a5c':'#c0392b', true), borderRight:colBR(months[idx]), borderLeft:isSpecial(idx)?'2px solid #bbb':undefined }}>
                    {netCash.reduce((s,v)=>s+v,0)<0?`(${fmtC(-v)})`:fmtC(v)}
                  </td>
                ))}
                <td style={{ ...tdSty('#e0e0e0','#1a1a2e',true), borderLeft:'2px solid #bbb' }}>{netCash.reduce((s,v)=>s+v,0)<0?`(${fmtC(-netCash.reduce((s,v2)=>s+v2,0))})`:fmtC(netCash.reduce((s,v2)=>s+v2,0))}</td>
              </tr>
              {/* 누적현금흐름 */}
              <tr>
                <td style={{ ...tdSty('#d5d5d5','#1a1a2e',true), textAlign:'left', position:'sticky', left:0 }}>누적현금흐름</td>
                {cumulative.map((v,idx) => (
                  <td key={months[idx]} style={{ ...tdSty(cellBg(idx,'#ececec'), v>=0?'#1a3a5c':'#c0392b', true), borderRight:colBR(months[idx]), borderLeft:isSpecial(idx)?'2px solid #bbb':undefined }}>
                    {v<0?`(${fmtC(-v)})`:fmtC(v)}
                  </td>
                ))}
                <td style={{ ...tdSty('#ccc','#1a1a2e',true), borderLeft:'2px solid #bbb' }}>{(cumulative[cumulative.length-1]||0)<0?`(${fmtC(-(cumulative[cumulative.length-1]||0))})`:fmtC(cumulative[cumulative.length-1]||0)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
      <div style={{ marginTop:'8px', fontSize:'10px', color:'#888' }}>
        ※ 부가세 납부(+): 실제 지출 / 환급(-): 실제 수입
        {conMonth>0&&months[conMonth-1]?` | ◆ 착공: ${months[conMonth-1]}`:''}
        {junMonth>0&&months[junMonth-1]?` | ★ 준공: ${months[junMonth-1]}`:''}
      </div>
    </div>
  );
}


// ─────────────────────────────────────────────
// 매출 현금흐름
// ─────────────────────────────────────────────
function SalesCashFlow({ salesData, projectName }) {
  const ymList   = salesData?.ymList || [];
  const junMonth = salesData?.junMonth     || 0;
  const conMonth = salesData?.constructMonth || 0;
  const hasBal   = (salesData?.salesSumBal  || 0) > 0;
  const hasOffi  = (salesData?.salesSumOffi || 0) > 0;
  const hasStore = (salesData?.salesSumStore|| 0) > 0;
  const noData   = ymList.length === 0;
  const n        = ymList.length;

  const isCon  = (i) => conMonth > 0 && (i+1) === conMonth;
  const isJun  = (i) => junMonth > 0 && (i+1) === junMonth;
  const isSpec = (i) => isCon(i) || isJun(i);

  // 섹션 정의 — 모든 용도 동일 구조
  const makeSections = () => {
    const aptVatExists = (salesData?.aptVatMonthly||[]).some(v=>v>0);
    const secs = [
      {
        key:'apt', label:'공동주택',
        total: salesData?.salesSumApt || 0,
        // 합계 행용 원천 배열 (소수점 오차 방지)
        supplyMonthly: salesData?.aptMonthly || ymList.map((_,i)=>(salesData?.aptDepMonthly?.[i]||0)+(salesData?.aptMidMonthly?.[i]||0)+(salesData?.aptBalMonthly?.[i]||0)),
        vatMonthly:    salesData?.aptVatMonthly || [],
        rows: [
          { label:'월별 분양율', data: salesData?.aptRateMonthly, fmt: fmtPct, isRate: true },
          { label:'계약금',      data: salesData?.aptDepMonthly },
          { label:'중도금',      data: salesData?.aptMidMonthly },
          { label:'잔금',        data: salesData?.aptBalMonthly },
          ...(aptVatExists ? [{ label:'부가세', data: salesData?.aptVatMonthly, isVat: true }] : []),
        ],
      },
      ...(hasBal ? [{
        key:'bal', label:'발코니확장',
        total: salesData?.salesSumBal || 0,
        supplyMonthly: salesData?.balconyMonthly || ymList.map((_,i)=>(salesData?.balDepMonthly?.[i]||0)+(salesData?.balBalMonthly?.[i]||0)),
        vatMonthly:    [],
        rows: [
          { label:'월별 분양율', data: salesData?.aptRateMonthly, fmt: fmtPct, isRate: true },
          { label:'계약금',      data: salesData?.balDepMonthly },
          { label:'중도금',      data: Array(n).fill(0), isEmpty: true },
          { label:'잔금',        data: salesData?.balBalMonthly },
        ],
      }] : []),
      ...(hasOffi ? [{
        key:'offi', label:'오피스텔',
        total: salesData?.salesSumOffi || 0,
        supplyMonthly: salesData?.offiMonthly2 || ymList.map((_,i)=>(salesData?.offiDepMonthly?.[i]||0)+(salesData?.offiMidMonthly?.[i]||0)+(salesData?.offiBalMonthly?.[i]||0)),
        vatMonthly:    salesData?.offiVatMonthly || [],
        rows: [
          { label:'월별 분양율', data: salesData?.offiRateMonthly, fmt: fmtPct, isRate: true },
          { label:'계약금',      data: salesData?.offiDepMonthly },
          { label:'중도금',      data: salesData?.offiMidMonthly },
          { label:'잔금',        data: salesData?.offiBalMonthly },
          { label:'부가세',      data: salesData?.offiVatMonthly, isVat: true },
        ],
      }] : []),
      ...(hasStore ? [{
        key:'store', label:'근린상가',
        total: salesData?.salesSumStore || 0,
        supplyMonthly: salesData?.storeMonthly || ymList.map((_,i)=>(salesData?.storeDepMonthly?.[i]||0)+(salesData?.storeMidMonthly?.[i]||0)+(salesData?.storeBalMonthly?.[i]||0)),
        vatMonthly:    salesData?.storeVatMonthly || [],
        rows: [
          { label:'월별 분양율', data: salesData?.storeRateMonthly, fmt: fmtPct, isRate: true },
          { label:'계약금',      data: salesData?.storeDepMonthly },
          { label:'중도금',      data: salesData?.storeMidMonthly },
          { label:'잔금',        data: salesData?.storeBalMonthly },
          { label:'부가세',      data: salesData?.storeVatMonthly, isVat: true },
        ],
      }] : []),
    ];
    return secs;
  };
  const sections = makeSections();

  // 월별 합계 — 저장된 monthly 배열(이미 보정된 정수) 직접 사용
  const supplyByMonth = ymList.map((_,i) =>
    (salesData?.aptMonthly?.[i] ?? ((salesData?.aptDepMonthly?.[i]||0)+(salesData?.aptMidMonthly?.[i]||0)+(salesData?.aptBalMonthly?.[i]||0))) +
    (salesData?.balconyMonthly?.[i] ?? ((salesData?.balDepMonthly?.[i]||0)+(salesData?.balBalMonthly?.[i]||0))) +
    (salesData?.offiMonthly2?.[i] ?? ((salesData?.offiDepMonthly?.[i]||0)+(salesData?.offiMidMonthly?.[i]||0)+(salesData?.offiBalMonthly?.[i]||0))) +
    (salesData?.storeMonthly?.[i] ?? ((salesData?.storeDepMonthly?.[i]||0)+(salesData?.storeMidMonthly?.[i]||0)+(salesData?.storeBalMonthly?.[i]||0)))
  );
  // VAT 합계
  const vatByMonthAll = ymList.map((_,i) =>
    (salesData?.aptVatMonthly?.[i]||0) +
    (salesData?.offiVatMonthly?.[i]||0) +
    (salesData?.storeVatMonthly?.[i]||0)
  );
  // VAT 포함 합계 (마지막 행)
  const grandByMonth = ymList.map((_,i) => supplyByMonth[i] + vatByMonthAll[i]);
  const grandTotal   = grandByMonth.reduce((s,v)=>s+v,0);

  // ── 인쇄 ──
  const handlePrint = () => {
    const win = openPrintWin(`매출현금흐름_${projectName}`);
    const hdr = `
      <h2>매출 현금흐름</h2>
      <div class="sub">${projectName} | ${new Date().toLocaleDateString('ko-KR')} | 단위: 천원 | 부가가치세 별도
        ${conMonth>0?`| ◆ 착공: ${ymList[conMonth-1]||''}`:''}
        ${junMonth>0?`| ★ 준공: ${ymList[junMonth-1]||''}`:''}
      </div>
      <table>
        <thead><tr>
          ${pTh('항목','text-align:left;min-width:72px;')}
          ${ymList.map((ym,i)=>pColHdr(ym,i,isCon(i),isJun(i))).join('')}
          ${pTh('합계','border-left:2px solid #666;min-width:60px;color:'+RS.junColor+';')}
        </tr></thead>
        <tbody>`;
    let body = '';
    sections.forEach(sec => {
      // 섹션 헤더
      body += `<tr><td colspan="${n+2}" style="background:${RS.secBg};color:white;font-weight:bold;` +
        `padding:4px 6px;font-size:9px;-webkit-print-color-adjust:exact;print-color-adjust:exact;">${sec.label}</td></tr>`;
      // 세부 행
      sec.rows.forEach(row => {
        if (!row.data) return;
        const bg    = row.isRate ? RS.rateBg : row.isVat ? RS.vatBg : RS.rowBg;
        const color = row.isRate ? RS.rateColor : row.isVat ? RS.vatColor : RS.rowColor;
        const total = row.isRate ? '' : fmtC((row.data||[]).reduce((s,v)=>s+(v||0),0));
        body += `<tr>
          <td style="background:${bg};color:${color};padding:3px 4px 3px 8px;font-size:8px;` +
          `border-bottom:1px solid #eee;-webkit-print-color-adjust:exact;print-color-adjust:exact;">${row.label}</td>
          ${ymList.map((ym,i)=>{
            const v   = row.data[i]||0;
            const sp  = isSpec(i);
            const cbg = sp ? RS.specBg : bg;
            const br  = printBR(ym,sp);
            return pCell(row.fmt?row.fmt(v):fmtC(v), cbg, color, false, br);
          }).join('')}
          ${pCell(total, RS.totalColBg, color, true, 'border-left:2px solid #888;')}
        </tr>`;
      });
      // 합계 행 — 원천 배열 직접 사용 (소수점 오차 방지)
      const secSupplyMonth = ymList.map((_,i)=>sec.supplyMonthly?.[i]||0);
      const secVatMonth    = ymList.map((_,i)=>sec.vatMonthly?.[i]||0);
      const secTotal       = sec.total + (sec.vatMonthly||[]).reduce((s,v)=>s+(v||0),0);
      body += `<tr>
        <td style="background:${RS.subBg};color:${RS.subColor};font-weight:bold;padding:3px 6px;font-size:8px;` +
        `border-bottom:1px solid #ccc;-webkit-print-color-adjust:exact;print-color-adjust:exact;">합계</td>
        ${ymList.map((ym,i)=>{
          const v  = secSupplyMonth[i]+secVatMonth[i];
          const sp = isSpec(i);
          return pCell(fmtC(v), sp?RS.specBg:RS.subBg, RS.subColor, true, printBR(ym,sp));
        }).join('')}
        ${pCell(fmtC(secTotal), RS.totalColBg, RS.subColor, true, 'border-left:2px solid #888;')}
      </tr>
      <tr><td colspan="${n+2}" style="height:2px;background:${RS.divBg};"></td></tr>`;
    });
    // 총합계
    body += `<tr><td colspan="${n+2}" style="height:3px;background:#222;-webkit-print-color-adjust:exact;print-color-adjust:exact;"></td></tr>`;
    body += `<tr>
      <td style="background:${RS.grandBg};color:${RS.grandColor};font-weight:bold;padding:4px 6px;font-size:9px;` +
      `-webkit-print-color-adjust:exact;print-color-adjust:exact;">매출 합계 (VAT 포함)</td>
      ${ymList.map((ym,i)=>{
        const sp=isSpec(i);
        return pCell(fmtC(grandByMonth[i]), sp?'#333':RS.grandBg, RS.grandColor, true, printBR(ym,sp));
      }).join('')}
      ${pCell(fmtC(grandTotal), '#333', RS.grandColor, true, 'border-left:2px solid #666;')}
    </tr>`;
    // 공급금액 행
    const supplyGrand_ = supplyByMonth.reduce((s,v)=>s+v,0);
    const vatGrand__   = vatByMonthAll.reduce((s,v)=>s+v,0);
    body = `<tr style="border-top:3px solid #222;">
      <td style="background:#e8f4e8;color:#1a6a3a;font-weight:bold;padding:4px 6px;font-size:9px;-webkit-print-color-adjust:exact;print-color-adjust:exact;">공급금액 (VAT 제외)</td>
      ${ymList.map((ym,i) => pCell(fmtC(supplyByMonth[i]), isSpec(i)?'#c8e8c8':'#e8f4e8', '#1a6a3a', true, printBR(ym,i))).join('')}
      ${pCell(fmtC(supplyGrand_), '#d5ecd5', '#1a6a3a', true, 'border-left:2px solid #666;')}
    </tr>` + (vatGrand__ > 0 ? `<tr>
      <td style="background:#fff8e8;color:#b7770d;padding:4px 6px;font-size:9px;-webkit-print-color-adjust:exact;print-color-adjust:exact;">└ 부가세</td>
      ${ymList.map((ym,i) => pCell(fmtC(vatByMonthAll[i]), isSpec(i)?'#f5e8c0':'#fff8e8', '#b7770d', false, printBR(ym,i))).join('')}
      ${pCell(fmtC(vatGrand__), '#f5ecc5', '#b7770d', true, 'border-left:2px solid #666;')}
    </tr>` : '') + body;
    body += `</tbody></table>
      <div style="margin-top:5px;font-size:7px;color:#888;">◆ 착공월 | ★ 준공월</div>`;
    win.document.write(hdr + body);
    doPrint(win);
  };

  // ── 화면 ──
  const thS = (extra={}) => ({
    padding:'5px 8px', background:RS.headerBg, color:RS.headerColor,
    textAlign:'right', borderBottom:'2px solid #444',
    fontSize:RS.fontSize, whiteSpace:'nowrap', ...extra,
  });
  const tdS = (bg, color=RS.rowColor, bold=false) => ({
    padding:'4px 8px', backgroundColor:bg, color,
    fontWeight:bold?'bold':'normal',
    borderBottom:'1px solid #eee', textAlign:'right', fontSize:RS.fontSize,
  });

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'16px' }}>
        <div>
          <h3 style={{ margin:0, fontSize:'16px', color:RS.headerBg }}>■ 매출 현금흐름</h3>
          <div style={{ fontSize:'11px', color:'#888', marginTop:'3px' }}>공급가 기준 | 단위: 천원</div>
        </div>
        <button onClick={handlePrint} disabled={noData}
          style={{ padding:'8px 18px', backgroundColor:noData?'#bdc3c7':'#2c3e50', color:'white',
            border:'none', borderRadius:'6px', cursor:noData?'not-allowed':'pointer',
            fontSize:'12px', fontWeight:'bold' }}>
          🖨 인쇄
        </button>
      </div>

      {noData ? (
        <div style={{ padding:'40px', textAlign:'center', color:'#aaa', border:'2px dashed #ddd', borderRadius:'12px' }}>
          💡 분양율 탭을 먼저 방문하면 데이터가 자동으로 연동됩니다.
        </div>
      ) : (
        <div style={{ overflowX:'auto', border:'1px solid #ddd', borderRadius:'8px' }}>
          <table style={{ borderCollapse:'collapse', fontSize:RS.fontSize, whiteSpace:'nowrap' }}>
            <thead>
              <tr>
                <th style={{ ...thS({ textAlign:'left', minWidth:'90px', position:'sticky', left:0, zIndex:2 }) }}>항목</th>
                {ymList.map((ym,i) => {
                  const sp=isSpec(i), m=parseInt(ym.split('.')[1])||0;
                  return (
                    <th key={ym} style={{ ...thS({
                      minWidth:'60px',
                      color: isCon(i)?RS.conColor:isJun(i)?RS.junColor:RS.headerColor,
                      borderLeft:  sp?'2px solid #777':undefined,
                      borderRight: sp?'2px solid #777':(m===6||m===12)?'2px solid #666':undefined,
                    }) }}>
                      {isCon(i)?`◆ ${ym}`:isJun(i)?`★ ${ym}`:ym}
                    </th>
                  );
                })}
                <th style={{ ...thS({ minWidth:'72px', color:RS.junColor, borderLeft:'2px solid #666' }) }}>합계</th>
              </tr>
            </thead>
            <tbody>
              {sections.map(sec => (
                <React.Fragment key={sec.key}>
                  {/* 섹션 헤더 */}
                  <tr>
                    <td colSpan={n+2} style={{ padding:'6px 10px', background:RS.secBg, color:RS.secColor, fontWeight:'bold', fontSize:'11px' }}>
                      {sec.label}
                    </td>
                  </tr>
                  {/* 세부 행 */}
                  {sec.rows.map(row => {
                    if (!row.data) return null;
                    const bg    = row.isRate ? RS.rateBg : row.isVat ? RS.vatBg : RS.rowBg;
                    const color = row.isRate ? RS.rateColor : row.isVat ? RS.vatColor : RS.rowColor;
                    const total = row.isRate ? null : (row.data||[]).reduce((s,v)=>s+(v||0),0);
                    return (
                      <tr key={row.key||row.label}>
                        <td style={{ ...tdS(bg,color), textAlign:'left', paddingLeft:'14px', position:'sticky', left:0 }}>
                          {row.label}
                        </td>
                        {ymList.map((ym,i) => {
                          const v   = row.data[i]||0;
                          const sp  = isSpec(i);
                          const cbg = sp ? RS.specBg : bg;
                          return (
                            <td key={ym} style={{ ...tdS(cbg,color),
                              borderRight: colBorderR(ym),
                              borderLeft:  sp?'2px solid #bbb':undefined,
                              borderRight2:sp?'2px solid #bbb':undefined,
                            }}>
                              {row.fmt ? row.fmt(v) : fmtC(v)}
                            </td>
                          );
                        })}
                        <td style={{ ...tdS(RS.totalColBg,color,true), borderLeft:'2px solid #bbb' }}>
                          {total !== null ? fmtC(total) : ''}
                        </td>
                      </tr>
                    );
                  })}
                  {/* 합계 행 */}
                  <tr style={{ borderTop:`2px solid ${RS.secBg}` }}>
                    <td style={{ ...tdS(RS.subBg,RS.subColor,true), textAlign:'left', position:'sticky', left:0 }}>합계</td>
                    {ymList.map((ym,i) => {
                      const v  = (sec.supplyMonthly?.[i]||0) + (sec.vatMonthly?.[i]||0);
                      const sp = isSpec(i);
                      return (
                        <td key={ym} style={{ ...tdS(sp?RS.specBg:RS.subBg,RS.subColor,true),
                          borderRight:colBorderR(ym), borderLeft:sp?'2px solid #bbb':undefined }}>
                          {fmtC(v)}
                        </td>
                      );
                    })}
                    <td style={{ ...tdS(RS.totalColBg,RS.subColor,true), borderLeft:'2px solid #bbb' }}>
                      {fmtC(sec.total + (sec.vatMonthly||[]).reduce((s,v)=>s+(v||0),0))}
                    </td>
                  </tr>
                  <tr><td colSpan={n+2} style={{ height:'3px', background:RS.divBg, padding:0 }} /></tr>
                </React.Fragment>
              ))}
              {/* 총합계 - 공급금액/부가세/합계 */}
              <tr style={{ borderTop:'3px solid #222' }}>
                <td style={{ ...tdS('#e8f4e8','#1a6a3a',true), textAlign:'left', fontSize:'11px', position:'sticky', left:0 }}>
                  공급금액 (VAT 제외)
                </td>
                {ymList.map((ym,i) => {
                  const sp=isSpec(i);
                  return (
                    <td key={ym} style={{ ...tdS(sp?'#c8e8c8':'#e8f4e8','#1a6a3a',true),
                      borderRight:colBorderR(ym), borderLeft:sp?'2px solid #555':undefined }}>
                      {fmtC(supplyByMonth[i])}
                    </td>
                  );
                })}
                <td style={{ ...tdS('#d5ecd5','#1a6a3a',true), borderLeft:'2px solid #666' }}>
                  {fmtC(supplyByMonth.reduce((s,v)=>s+v,0))}
                </td>
              </tr>
              {vatByMonthAll.some(v=>v>0) && (
                <tr>
                  <td style={{ ...tdS('#fff8e8','#b7770d'), textAlign:'left', fontSize:'11px', position:'sticky', left:0 }}>
                    └ 부가세
                  </td>
                  {ymList.map((ym,i) => {
                    const sp=isSpec(i);
                    return (
                      <td key={ym} style={{ ...tdS(sp?'#f5e8c0':'#fff8e8','#b7770d'),
                        borderRight:colBorderR(ym), borderLeft:sp?'2px solid #555':undefined }}>
                        {fmtC(vatByMonthAll[i])}
                      </td>
                    );
                  })}
                  <td style={{ ...tdS('#f5ecc5','#b7770d',true), borderLeft:'2px solid #666' }}>
                    {fmtC(vatByMonthAll.reduce((s,v)=>s+v,0))}
                  </td>
                </tr>
              )}
              <tr>
                <td style={{ ...tdS(RS.grandBg,RS.grandColor,true), textAlign:'left', fontSize:'11px', position:'sticky', left:0 }}>
                  매출 합계 (VAT 포함)
                </td>
                {ymList.map((ym,i) => {
                  const sp=isSpec(i);
                  return (
                    <td key={ym} style={{ ...tdS(sp?'#333':RS.grandBg,RS.grandColor,true),
                      borderRight:colBorderR(ym), borderLeft:sp?'2px solid #555':undefined }}>
                      {fmtC(grandByMonth[i])}
                    </td>
                  );
                })}
                <td style={{ ...tdS('#333',RS.grandColor,true), borderLeft:'2px solid #666' }}>
                  {fmtC(grandTotal)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
      <div style={{ marginTop:'8px', fontSize:'10px', color:'#888' }}>
        ◆ 착공월 | ★ 준공월
        {conMonth>0&&ymList[conMonth-1]?` | 착공: ${ymList[conMonth-1]}`:''}
        {junMonth>0&&ymList[junMonth-1]?` | 준공: ${ymList[junMonth-1]}`:''}
      </div>
    </div>
  );
}


// ─────────────────────────────────────────────
// 지출 현금흐름
// ─────────────────────────────────────────────
function CostCashFlow({ monthlyPayments, salesData, financeData, projectName, cashFlowResult }) {
  const mp      = monthlyPayments || {};
  const months  = mp.months || [];
  const junMonth = salesData?.junMonth    || 0;
  const conMonth = salesData?.constructMonth || 0;
  const noData  = months.length === 0;
  const n       = months.length;

  const isCon  = (i) => conMonth > 0 && (i+1) === conMonth;
  const isJun  = (i) => junMonth > 0 && (i+1) === junMonth;
  const isSpec = (i) => isCon(i) || isJun(i);
  const colBR  = (ym) => { const m=parseInt(ym.split('.')[1])||0; return (m===6||m===12)?'2px solid #888':undefined; };

  // 카테고리 정의
  const categories = [
    { key:'land',     label:'토지관련비용', itemsKey:'landItems'     },
    { key:'direct',   label:'직접공사비',   itemsKey:'directItems'   },
    { key:'indirect', label:'간접공사비',   itemsKey:'indirectItems' },
    { key:'consult',  label:'용역비',       itemsKey:'consultItems'  },
    { key:'sales',    label:'판매비',       itemsKey:'salesItems'    },
    { key:'tax',      label:'제세금',       itemsKey:'taxItems'      },
    { key:'overhead', label:'부대비',       itemsKey:'overheadItems' },
  ];

  // 월별 값 헬퍼
  const getVal  = (obj, ym) => obj?.[ym] || 0;
  const rowSum  = (obj) => months.reduce((s,ym) => s+getVal(obj,ym), 0);

  // 금융비 월별 (cashFlowResult 연동)
  const financeCostMonthly = useMemo(() => {
    if (cashFlowResult) {
      const m = {};
      (cashFlowResult.months||[]).forEach((ym,i) => {
        const r = cashFlowResult.result[i] || {};
        m[ym] = (r.fee||0) + (r.midInt||0) + (r.intS||0) + (r.intM||0) + (r.intJ||0);
      });
      return m;
    }
    return calcFinanceCostMonthly(financeData, salesData, months);
  }, [cashFlowResult, financeData, salesData, months]); // eslint-disable-line

  // 항목별 금융비 (cashFlowResult 우선)
  const getFinItemMonthly = (key) => {
    if (!cashFlowResult) return (calcFinanceCostMonthly(financeData, salesData, months)._byItem||{})[key] || {};
    const m = {};
    (cashFlowResult.months||[]).forEach((ym,i) => {
      const r = cashFlowResult.result[i] || {};
      const v = key==='fee'?(r.fee||0):key==='midInt'?(r.midInt||0):key==='intS'?(r.intS||0):key==='intM'?(r.intM||0):key==='intJ'?(r.intJ||0):0;
      if(v>0) m[ym]=v;
    });
    return m;
  };
  const finItems = [
    { key:'fee',    label:'주관사/취급수수료' },
    { key:'intS',   label:'선순위 이자'       },
    { key:'intM',   label:'중순위 이자'       },
    { key:'intJ',   label:'후순위 이자'       },
    { key:'midInt', label:'중도금 무이자'     },
  ].map(item => ({ ...item, totals: getFinItemMonthly(item.key), vatTotals:{} }))
   .filter(item => rowSum(item.totals) > 0);

  const finCatTotal = months.reduce((s,ym) => s+(financeCostMonthly[ym]||0), 0);

  // 총합계 (사업비 + 금융비)
  const grandByMonth = months.map(ym =>
    categories.reduce((s,cat) => s + getVal(mp[cat.key],ym) + getVal(mp[`${cat.key}Vat`],ym), 0)
    + (financeCostMonthly[ym]||0)
  );
  const grandTotal = grandByMonth.reduce((s,v)=>s+v,0);

  // ── 인쇄 ──
  const handlePrint = () => {
    const bRp = (ym,i) => { const m=parseInt(ym.split('.')[1])||0; const sp=isSpec(i); return sp?'border-left:2px solid #555;border-right:2px solid #555;':(m===6||m===12)?'border-right:2px solid #888;':''; };
    const cell = (v,bg,color='#333',bold=false,extra='') =>
      `<td style="background:${bg};color:${color};padding:3px 4px;font-size:8px;border-bottom:1px solid #eee;text-align:right;${bold?'font-weight:bold;':''}${extra}-webkit-print-color-adjust:exact;print-color-adjust:exact;">${v||''}</td>`;
    const colHdr = (ym,i) => {
      const con=isCon(i), jun=isJun(i), sp=con||jun;
      const color=con?RS.conColor:jun?RS.junColor:'white';
      return `<th style="background:${RS.headerBg};color:${color};padding:3px 4px;font-size:8px;border-bottom:2px solid #444;text-align:right;white-space:nowrap;min-width:44px;${bRp(ym,i)}">${sp?(con?'◆ ':'★ '):''}${ym}</th>`;
    };

    const win = openPrintWin(`지출현금흐름_${projectName}`);
    let html = `<h2>지출 현금흐름</h2>
      <div class="sub">${projectName} | ${new Date().toLocaleDateString('ko-KR')} | 단위: 천원 | 부가가치세 별도 (VAT 포함)
        ${conMonth>0?`| ◆ 착공: ${months[conMonth-1]||''}`:''}
        ${junMonth>0?`| ★ 준공: ${months[junMonth-1]||''}`:''}
      </div>
      <table>
        <thead><tr>
          ${pTh('항목','text-align:left;min-width:120px;')}
          ${months.map(colHdr).join('')}
          ${pTh('합계','border-left:2px solid #666;min-width:60px;color:'+RS.junColor+';')}
        </tr></thead><tbody>`;

    categories.forEach(cat => {
      const items = mp[cat.itemsKey] || [];
      const catTotal = months.reduce((s,ym) => s+getVal(mp[cat.key],ym)+getVal(mp[`${cat.key}Vat`],ym),0);
      if (catTotal === 0) return;

      // 섹션 헤더
      html += `<tr><td colspan="${n+2}" style="background:${RS.secBg};color:white;font-weight:bold;padding:4px 6px;font-size:9px;-webkit-print-color-adjust:exact;print-color-adjust:exact;">${cat.label}</td></tr>`;

      // 세부항목
      items.forEach(item => {
        const total = rowSum(item.totals) + rowSum(item.vatTotals);
        if (total === 0) return;
        html += `<tr><td style="background:${RS.rowBg};padding:3px 4px 3px 10px;font-size:8px;border-bottom:1px solid #eee;">${item.label}</td>
          ${months.map((ym,i) => {
            const v = getVal(item.totals,ym)+getVal(item.vatTotals,ym);
            return cell(fmtC(v), isSpec(i)?RS.specBg:RS.rowBg, RS.rowColor, false, bRp(ym,i));
          }).join('')}
          ${cell(fmtC(total), RS.totalColBg, RS.rowColor, true, 'border-left:2px solid #888;')}
        </tr>`;
      });

      // 카테고리 합계
      html += `<tr><td style="background:${RS.subBg};color:${RS.subColor};font-weight:bold;padding:3px 6px;font-size:8px;border-bottom:1px solid #ccc;-webkit-print-color-adjust:exact;print-color-adjust:exact;">합계</td>
        ${months.map((ym,i) => {
          const v = getVal(mp[cat.key],ym)+getVal(mp[`${cat.key}Vat`],ym);
          return cell(fmtC(v), isSpec(i)?RS.specBg:RS.subBg, RS.subColor, true, bRp(ym,i));
        }).join('')}
        ${cell(fmtC(catTotal), RS.totalColBg, RS.subColor, true, 'border-left:2px solid #888;')}
      </tr>
      <tr><td colspan="${n+2}" style="height:2px;background:${RS.divBg};"></td></tr>`;
    });

    // 금융비 섹션
    if (finCatTotal > 0) {
      html += `<tr><td colspan="${n+2}" style="background:#e67e22;color:white;font-weight:bold;padding:4px 6px;font-size:9px;-webkit-print-color-adjust:exact;print-color-adjust:exact;">금융비</td></tr>`;
      finItems.forEach(item => {
        const total = rowSum(item.totals);
        if (total === 0) return;
        html += `<tr><td style="background:#fff8f0;padding:3px 4px 3px 10px;font-size:8px;">${item.label}</td>
          ${months.map((ym,i) => cell(fmtC(getVal(item.totals,ym)), isSpec(i)?RS.specBg:'#fff8f0', '#e67e22', false, bRp(ym,i))).join('')}
          ${cell(fmtC(total), '#ffe8cc', '#e67e22', true, 'border-left:2px solid #888;')}
        </tr>`;
      });
      html += `<tr><td style="background:#fff0e0;color:#e67e22;font-weight:bold;padding:3px 6px;font-size:8px;">합계</td>
        ${months.map((ym,i) => cell(fmtC(financeCostMonthly[ym]||0), isSpec(i)?RS.specBg:'#fff0e0', '#e67e22', true, bRp(ym,i))).join('')}
        ${cell(fmtC(finCatTotal), RS.totalColBg, '#e67e22', true, 'border-left:2px solid #888;')}
      </tr>
      <tr><td colspan="${n+2}" style="height:2px;background:${RS.divBg};"></td></tr>`;
    }
    // 총합계
    html += `<tr><td colspan="${n+2}" style="height:3px;background:#222;-webkit-print-color-adjust:exact;print-color-adjust:exact;"></td></tr>
      <tr><td style="background:${RS.grandBg};color:${RS.grandColor};font-weight:bold;padding:4px 6px;font-size:9px;-webkit-print-color-adjust:exact;print-color-adjust:exact;">지출 합계 (VAT 포함)</td>
        ${months.map((ym,i) => cell(fmtC(grandByMonth[months.indexOf(ym)]), isSpec(i)?'#333':RS.grandBg, RS.grandColor, true, bRp(ym,i))).join('')}
        ${cell(fmtC(grandTotal), '#333', RS.grandColor, true, 'border-left:2px solid #666;')}
      </tr>
    </tbody></table>
    <div style="margin-top:5px;font-size:7px;color:#888;">◆ 착공월 | ★ 준공월</div>`;

    win.document.write(html);
    doPrint(win);
  };

  // ── 화면 ──
  const thS = (extra={}) => ({ padding:'5px 8px', background:RS.headerBg, color:RS.headerColor, textAlign:'right', borderBottom:'2px solid #444', fontSize:RS.fontSize, whiteSpace:'nowrap', ...extra });
  const tdS = (bg, color=RS.rowColor, bold=false) => ({ padding:'4px 8px', backgroundColor:bg, color, fontWeight:bold?'bold':'normal', borderBottom:'1px solid #eee', textAlign:'right', fontSize:RS.fontSize });

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'16px' }}>
        <div>
          <h3 style={{ margin:0, fontSize:'16px', color:RS.headerBg }}>■ 지출 현금흐름</h3>
          <div style={{ fontSize:'11px', color:'#888', marginTop:'3px' }}>VAT 포함 기준 | 단위: 천원</div>
        </div>
        <button onClick={handlePrint} disabled={noData}
          style={{ padding:'8px 18px', backgroundColor:noData?'#bdc3c7':'#2c3e50', color:'white', border:'none', borderRadius:'6px', cursor:noData?'not-allowed':'pointer', fontSize:'12px', fontWeight:'bold' }}>
          🖨 인쇄
        </button>
      </div>

      {noData ? (
        <div style={{ padding:'40px', textAlign:'center', color:'#aaa', border:'2px dashed #ddd', borderRadius:'12px' }}>
          💡 사업비 탭을 먼저 방문하면 데이터가 자동으로 연동됩니다.
        </div>
      ) : (
        <div style={{ overflowX:'auto', border:'1px solid #ddd', borderRadius:'8px' }}>
          <table style={{ borderCollapse:'collapse', fontSize:RS.fontSize, whiteSpace:'nowrap' }}>
            <thead>
              <tr>
                <th style={{ ...thS({ textAlign:'left', minWidth:'130px', position:'sticky', left:0, zIndex:2 }) }}>항목</th>
                {months.map((ym,i) => {
                  const sp=isSpec(i), m=parseInt(ym.split('.')[1])||0;
                  return (
                    <th key={ym} style={{ ...thS({
                      minWidth:'60px',
                      color: isCon(i)?RS.conColor:isJun(i)?RS.junColor:RS.headerColor,
                      borderLeft:  sp?'2px solid #777':undefined,
                      borderRight: sp?'2px solid #777':(m===6||m===12)?'2px solid #666':undefined,
                    }) }}>
                      {isCon(i)?`◆ ${ym}`:isJun(i)?`★ ${ym}`:ym}
                    </th>
                  );
                })}
                <th style={{ ...thS({ minWidth:'72px', color:RS.junColor, borderLeft:'2px solid #666' }) }}>합계</th>
              </tr>
            </thead>
            <tbody>
              {categories.map(cat => {
                const items = mp[cat.itemsKey] || [];
                const catTotal = months.reduce((s,ym) => s+getVal(mp[cat.key],ym)+getVal(mp[`${cat.key}Vat`],ym), 0);
                if (catTotal === 0) return null;
                return (
                  <React.Fragment key={cat.key}>
                    {/* 섹션 헤더 */}
                    <tr>
                      <td colSpan={n+2} style={{ padding:'6px 10px', background:RS.secBg, color:RS.secColor, fontWeight:'bold', fontSize:'11px' }}>
                        {cat.label}
                      </td>
                    </tr>
                    {/* 세부항목 */}
                    {items.map((item, ii) => {
                      const total = rowSum(item.totals) + rowSum(item.vatTotals);
                      if (total === 0) return null;
                      return (
                        <tr key={ii}>
                          <td style={{ ...tdS(RS.rowBg), textAlign:'left', paddingLeft:'16px', position:'sticky', left:0 }}>
                            {item.label}
                          </td>
                          {months.map((ym,i) => {
                            const v = getVal(item.totals,ym) + getVal(item.vatTotals,ym);
                            const sp = isSpec(i);
                            return (
                              <td key={ym} style={{ ...tdS(sp?RS.specBg:RS.rowBg), borderRight:colBR(ym), borderLeft:sp?'2px solid #bbb':undefined }}>
                                {fmtC(v)}
                              </td>
                            );
                          })}
                          <td style={{ ...tdS(RS.totalColBg, RS.rowColor, true), borderLeft:'2px solid #bbb' }}>{fmtC(total)}</td>
                        </tr>
                      );
                    })}
                    {/* 카테고리 합계 */}
                    <tr style={{ borderTop:`2px solid ${RS.secBg}` }}>
                      <td style={{ ...tdS(RS.subBg, RS.subColor, true), textAlign:'left', position:'sticky', left:0 }}>합계</td>
                      {months.map((ym,i) => {
                        const v = getVal(mp[cat.key],ym) + getVal(mp[`${cat.key}Vat`],ym);
                        const sp = isSpec(i);
                        return (
                          <td key={ym} style={{ ...tdS(sp?RS.specBg:RS.subBg, RS.subColor, true), borderRight:colBR(ym), borderLeft:sp?'2px solid #bbb':undefined }}>
                            {fmtC(v)}
                          </td>
                        );
                      })}
                      <td style={{ ...tdS(RS.totalColBg, RS.subColor, true), borderLeft:'2px solid #bbb' }}>{fmtC(catTotal)}</td>
                    </tr>
                    <tr><td colSpan={n+2} style={{ height:'3px', background:RS.divBg, padding:0 }} /></tr>
                  </React.Fragment>
                );
              })}
              {/* 금융비 카테고리 */}
              {finCatTotal > 0 && (
                <React.Fragment>
                  <tr>
                    <td colSpan={n+2} style={{ padding:'6px 10px', background:'#7d5a00', color:'white', fontWeight:'bold', fontSize:'11px' }}>
                      금융비용
                    </td>
                  </tr>
                  {finItems.map((item, ii) => {
                    const total = rowSum(item.totals);
                    if (total === 0) return null;
                    return (
                      <tr key={ii}>
                        <td style={{ ...tdS(RS.rowBg), textAlign:'left', paddingLeft:'16px', position:'sticky', left:0, color:'#7d5a00' }}>
                          {item.label}
                        </td>
                        {months.map((ym,i) => {
                          const sp = isSpec(i);
                          return (
                            <td key={ym} style={{ ...tdS(sp?RS.specBg:'#fdf8f0'), borderRight:colBR(ym), borderLeft:sp?'2px solid #bbb':undefined, color:'#7d5a00' }}>
                              {fmtC(item.totals[ym]||0)}
                            </td>
                          );
                        })}
                        <td style={{ ...tdS('#f5e6d0','#7d5a00',true), borderLeft:'2px solid #bbb' }}>{fmtC(total)}</td>
                      </tr>
                    );
                  })}
                  <tr style={{ borderTop:'2px solid #7d5a00' }}>
                    <td style={{ ...tdS('#f5e6d0','#7d5a00',true), textAlign:'left', position:'sticky', left:0 }}>합계</td>
                    {months.map((ym,i) => {
                      const sp = isSpec(i);
                      return (
                        <td key={ym} style={{ ...tdS(sp?RS.specBg:'#f5e6d0','#7d5a00',true), borderRight:colBR(ym), borderLeft:sp?'2px solid #bbb':undefined }}>
                          {fmtC(financeCostMonthly[ym]||0)}
                        </td>
                      );
                    })}
                    <td style={{ ...tdS(RS.totalColBg,'#7d5a00',true), borderLeft:'2px solid #bbb' }}>{fmtC(finCatTotal)}</td>
                  </tr>
                  <tr><td colSpan={n+2} style={{ height:'3px', background:RS.divBg, padding:0 }} /></tr>
                </React.Fragment>
              )}
              {/* 총합계 */}
              <tr style={{ borderTop:'3px solid #222' }}>
                <td style={{ ...tdS(RS.grandBg, RS.grandColor, true), textAlign:'left', fontSize:'11px', position:'sticky', left:0 }}>지출 합계 (VAT 포함)</td>
                {months.map((ym,i) => {
                  const sp = isSpec(i);
                  return (
                    <td key={ym} style={{ ...tdS(sp?'#333':RS.grandBg, RS.grandColor, true), borderRight:colBR(ym), borderLeft:sp?'2px solid #555':undefined }}>
                      {fmtC(grandByMonth[months.indexOf(ym)])}
                    </td>
                  );
                })}
                <td style={{ ...tdS('#333', RS.grandColor, true), borderLeft:'2px solid #666' }}>{fmtC(grandTotal)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
      <div style={{ marginTop:'8px', fontSize:'10px', color:'#888' }}>
        ◆ 착공월 | ★ 준공월
        {conMonth>0&&months[conMonth-1]?` | 착공: ${months[conMonth-1]}`:''}
        {junMonth>0&&months[junMonth-1]?` | 준공: ${months[junMonth-1]}`:''}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// 보고서탭 메인 — 버튼 메뉴 구조
// ─────────────────────────────────────────────
// ─────────────────────────────────────────────
// 재원조달별 지출현금흐름
// ─────────────────────────────────────────────
function FundingCashFlow({ monthlyPayments, salesData, projectName, cashFlowResult, financeData }) {
  const mp     = monthlyPayments || {};
  const months = mp.months || [];
  const n      = months.length;
  const noData = n === 0;

  const pnv    = (v) => parseFloat(String(v||'').replace(/,/g,''))||0;
  const conIdx = (salesData?.constructMonth||1)-1;
  const junIdx = (salesData?.junMonth||1)-1;
  const isCon  = (i) => (salesData?.constructMonth||0)>0 && i===conIdx;
  const isJun  = (i) => (salesData?.junMonth||0)>0 && i===junIdx;
  const isSpec = (i) => isCon(i)||isJun(i);
  const colBR  = (i) => { const m=parseInt((months[i]||'').split('.')[1])||0; return (m===6||m===12)?'2px solid #888':undefined; };

  // 재원조달 정의
  const FUNDS = [
    { key:'equity', label:'Equity',  color:'#1a3a5c', bg:'#e8f0f8', secBg:'#1a3a5c' },
    { key:'pf',     label:'필수사업비', color:'#6c3483', bg:'#f5eef8', secBg:'#6c3483' },
    { key:'sale',   label:'분양불',   color:'#1a5c2a', bg:'#e8f5ec', secBg:'#1a5c2a' },
    { key:'loan',   label:'대여금',   color:'#7d5a00', bg:'#fdf8f0', secBg:'#7d5a00' },
  ];

  // 카테고리 정의
  const categories = [
    { key:'land',     label:'토지관련비용', itemsKey:'landItems'     },
    { key:'direct',   label:'직접공사비',   itemsKey:'directItems'   },
    { key:'indirect', label:'간접공사비',   itemsKey:'indirectItems' },
    { key:'consult',  label:'용역비',       itemsKey:'consultItems'  },
    { key:'sales',    label:'판매비',       itemsKey:'salesItems'    },
    { key:'tax',      label:'제세금',       itemsKey:'taxItems'      },
    { key:'overhead', label:'부대비',       itemsKey:'overheadItems' },
  ];

  // 재원조달별 × 세부항목별 월별 금액 계산
  // calcByFund: assignFunding의 한도소진 결과(eqMonthly/saleMonthly/pfMonthly) 직접 사용
  const calcByFund = (item, fundKey) => {
    const keyMap = { equity:'eqMonthly', sale:'saleMonthly', pf:'pfMonthly' };
    const arr = item[keyMap[fundKey]];
    if (!arr) return null;
    const totals = {};
    months.forEach((ym,i) => { if((arr[i]||0)>0) totals[ym]=arr[i]; });
    const total = Object.values(totals).reduce((s,v)=>s+v,0);
    if (total === 0) return null;
    return { totals, total };
  };

  // 재원조달별 월별 합계
  const fundTotals = {};
  FUNDS.forEach(fd => { fundTotals[fd.key] = Array(n).fill(0); });
  categories.forEach(cat => {
    (mp[cat.itemsKey]||[]).forEach(item => {
      FUNDS.forEach(fd => {
        const r = calcByFund(item, fd.key);
        if (!r) return;
        months.forEach((ym,i) => { fundTotals[fd.key][i] += r.totals[ym]||0; });
      });
    });
  });

  // 금융비 월별 (cashFlowResult 연동)
  const finByMonth_ = useMemo(() => {
    if (!cashFlowResult) return Array(n).fill(0);
    return months.map(ym => {
      const i = (cashFlowResult.months||[]).indexOf(ym);
      if (i < 0) return 0;
      const r = cashFlowResult.result[i] || {};
      return (r.fee||0)+(r.midInt||0)+(r.intS||0)+(r.intM||0)+(r.intJ||0);
    });
  }, [cashFlowResult, months]); // eslint-disable-line
  const finTotal_ = finByMonth_.reduce((s,v)=>s+v,0);
  // 금융비 재원별: 수수료→필수사업비, 이자+중도금무이자→분양불
  const finFeeByMonth_    = months.map(ym => { const i=(cashFlowResult?.months||[]).indexOf(ym); return i<0?0:(cashFlowResult?.result[i]?.fee||0); });
  const finPFIntByMonth_  = months.map(ym => { const i=(cashFlowResult?.months||[]).indexOf(ym); if(i<0)return 0; const r=cashFlowResult?.result[i]||{}; return (r.intS||0)+(r.intM||0)+(r.intJ||0); });
  const finMidIntByMonth_ = months.map(ym => { const i=(cashFlowResult?.months||[]).indexOf(ym); if(i<0)return 0; return (cashFlowResult?.result[i]?.midInt||0); });
  const finIntByMonth_    = months.map((_,i) => finPFIntByMonth_[i] + finMidIntByMonth_[i]);

  // 금융비를 각 재원조달에 포함 (수수료→필수사업비, 이자/중도금→분양불)
  finFeeByMonth_.forEach((v,i)    => { fundTotals['pf'][i]   += v; });
  finPFIntByMonth_.forEach((v,i)  => { fundTotals['sale'][i] += v; });
  finMidIntByMonth_.forEach((v,i) => { fundTotals['sale'][i] += v; });

  // 선순위/중순위/후순위 이자 월별
  const finIntSByMonth_ = months.map(ym => { const i=(cashFlowResult?.months||[]).indexOf(ym); if(i<0)return 0; return cashFlowResult?.result[i]?.intS||0; });
  const finIntMByMonth_ = months.map(ym => { const i=(cashFlowResult?.months||[]).indexOf(ym); if(i<0)return 0; return cashFlowResult?.result[i]?.intM||0; });
  const finIntJByMonth_ = months.map(ym => { const i=(cashFlowResult?.months||[]).indexOf(ym); if(i<0)return 0; return cashFlowResult?.result[i]?.intJ||0; });

  // 전체 월별 합계
  const grandMonthly = months.map((_,i) => FUNDS.reduce((s,fd) => s+fundTotals[fd.key][i], 0));
  const grandTotal   = grandMonthly.reduce((s,v)=>s+v,0);

  // ── 스타일 ──
  const thS = (extra={}) => ({
    padding:'4px 6px', background:'#1a1a2e', color:'white', textAlign:'right',
    borderBottom:'2px solid #444', fontSize:'10px', whiteSpace:'nowrap', ...extra,
  });
  const tdS = (bg='white', color='#333', bold=false) => ({
    padding:'3px 6px', backgroundColor:bg, color, fontWeight:bold?'bold':'normal',
    borderBottom:'1px solid #eee', textAlign:'right', fontSize:'10px',
  });
  const stickyL = { position:'sticky', left:0, zIndex:1 };

  // ── 인쇄 ──
  const handlePrint = () => {
    const win = openPrintWin(`재원조달별지출_${projectName}`);
    const bRp = (i) => { const m=parseInt((months[i]||'').split('.')[1])||0; const sp=isSpec(i); return sp?'border-left:2px solid #555;border-right:2px solid #555;':(m===6||m===12)?'border-right:2px solid #888;':''; };
    const cell = (v,bg,color='#333',bold=false,extra='') =>
      `<td style="background:${bg};color:${color};padding:3px 4px;font-size:8px;text-align:right;${bold?'font-weight:bold;':''}${extra}-webkit-print-color-adjust:exact;print-color-adjust:exact;">${v||''}</td>`;

    let html = `<h2>재원조달별 지출현금흐름</h2>
      <div class="sub">${projectName} | ${new Date().toLocaleDateString('ko-KR')} | 단위: 천원 | 부가가치세 별도 (VAT 포함)</div>
      <table><thead><tr>
        ${pTh('항목', 'text-align:left;min-width:150px;')}
        ${months.map((ym,i) => {
          const sp=isSpec(i); const con=isCon(i), jun=isJun(i);
          return `<th style="background:${RS.headerBg};color:${con?RS.conColor:jun?RS.junColor:'white'};padding:3px 4px;font-size:8px;text-align:right;min-width:44px;${bRp(i)}">${sp?(con?'◆ ':'★ '):''}${ym}</th>`;
        }).join('')}
        ${pTh('합계','border-left:2px solid #666;min-width:60px;color:'+RS.junColor+';')}
      </tr></thead><tbody>`;

    FUNDS.forEach(fd => {
      const fdTotal = fundTotals[fd.key].reduce((s,v)=>s+v,0);
      if (fdTotal === 0 && fd.key !== 'loan') return;
      html += `<tr><td colspan="${n+2}" style="background:${fd.secBg};color:white;font-weight:bold;padding:5px 8px;font-size:9px;-webkit-print-color-adjust:exact;print-color-adjust:exact;">[${fd.label}]</td></tr>`;
      categories.forEach(cat => {
        (mp[cat.itemsKey]||[]).forEach(item => {
          const r = calcByFund(item, fd.key);
          if (!r) return;
          html += `<tr><td style="background:white;padding:3px 4px 3px 10px;font-size:8px;">${cat.label} — ${item.label}</td>
            ${months.map((ym,i) => cell(fmtC(r.totals[ym]||0), isSpec(i)?RS.specBg:'white', fd.color, false, bRp(i))).join('')}
            ${cell(fmtC(r.total), RS.totalColBg, fd.color, true, 'border-left:2px solid #888;')}
          </tr>`;
        });
      });
      // 금융비 항목 (부대비 아래)
      if (fd.key === 'pf') {
        if (finFeeByMonth_.some(v=>v>0))
          html += `<tr><td style="background:white;padding:3px 4px 3px 10px;font-size:8px;font-style:italic;">금융비 — ① 주관사수수료</td>
            ${finFeeByMonth_.map((v,i) => cell(fmtC(v), isSpec(i)?RS.specBg:'white', fd.color, false, bRp(i))).join('')}
            ${cell(fmtC(finFeeByMonth_.reduce((s,v)=>s+v,0)), RS.totalColBg, fd.color, true, 'border-left:2px solid #888;')}
          </tr>`;
      }
      if (fd.key === 'sale') {
        if (finIntSByMonth_.some(v=>v>0))
          html += `<tr><td style="background:white;padding:3px 4px 3px 10px;font-size:8px;font-style:italic;">금융비 — ② 선순위 이자</td>
            ${finIntSByMonth_.map((v,i) => cell(fmtC(v), isSpec(i)?RS.specBg:'white', fd.color, false, bRp(i))).join('')}
            ${cell(fmtC(finIntSByMonth_.reduce((s,v)=>s+v,0)), RS.totalColBg, fd.color, true, 'border-left:2px solid #888;')}
          </tr>`;
        if (finIntMByMonth_.some(v=>v>0))
          html += `<tr><td style="background:white;padding:3px 4px 3px 10px;font-size:8px;font-style:italic;">금융비 — ③ 중순위 이자</td>
            ${finIntMByMonth_.map((v,i) => cell(fmtC(v), isSpec(i)?RS.specBg:'white', fd.color, false, bRp(i))).join('')}
            ${cell(fmtC(finIntMByMonth_.reduce((s,v)=>s+v,0)), RS.totalColBg, fd.color, true, 'border-left:2px solid #888;')}
          </tr>`;
        if (finIntJByMonth_.some(v=>v>0))
          html += `<tr><td style="background:white;padding:3px 4px 3px 10px;font-size:8px;font-style:italic;">금융비 — ④ 후순위 이자</td>
            ${finIntJByMonth_.map((v,i) => cell(fmtC(v), isSpec(i)?RS.specBg:'white', fd.color, false, bRp(i))).join('')}
            ${cell(fmtC(finIntJByMonth_.reduce((s,v)=>s+v,0)), RS.totalColBg, fd.color, true, 'border-left:2px solid #888;')}
          </tr>`;
        if (finMidIntByMonth_.some(v=>v>0))
          html += `<tr><td style="background:white;padding:3px 4px 3px 10px;font-size:8px;font-style:italic;">금융비 — ⑧ 중도금 무이자</td>
            ${finMidIntByMonth_.map((v,i) => cell(fmtC(v), isSpec(i)?RS.specBg:'white', fd.color, false, bRp(i))).join('')}
            ${cell(fmtC(finMidIntByMonth_.reduce((s,v)=>s+v,0)), RS.totalColBg, fd.color, true, 'border-left:2px solid #888;')}
          </tr>`;
      }
      html += `<tr><td style="background:#e8e8e8;font-weight:bold;padding:3px 8px;font-size:8px;">${fd.label} 소계</td>
        ${fundTotals[fd.key].map((v,i) => cell(fmtC(v), isSpec(i)?RS.specBg:'#e8e8e8', fd.color, true, bRp(i))).join('')}
        ${cell(fmtC(fdTotal), '#d0d0d0', fd.color, true, 'border-left:2px solid #888;')}
      </tr><tr><td colspan="${n+2}" style="height:2px;background:#ccc;padding:0;"></td></tr>`;
    });
    html += `<tr><td colspan="${n+2}" style="height:3px;background:#222;padding:0;-webkit-print-color-adjust:exact;print-color-adjust:exact;"></td></tr>
      <tr><td style="background:${RS.grandBg};color:${RS.grandColor};font-weight:bold;padding:4px 8px;font-size:9px;-webkit-print-color-adjust:exact;print-color-adjust:exact;">지출 합계 (VAT 포함)</td>
        ${grandMonthly.map((v,i) => cell(fmtC(v), isSpec(i)?'#333':RS.grandBg, RS.grandColor, true, bRp(i))).join('')}
        ${cell(fmtC(grandTotal), '#333', RS.grandColor, true, 'border-left:2px solid #666;')}
      </tr></tbody></table>`;

    win.document.write(html);
    doPrint(win);
  };

  if (noData) return (
    <div style={{ padding:'40px', textAlign:'center', color:'#aaa', border:'2px dashed #ddd', borderRadius:'12px' }}>
      💡 사업비 탭을 먼저 방문하면 데이터가 자동으로 연동됩니다.
    </div>
  );

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'16px' }}>
        <div>
          <h3 style={{ margin:0, fontSize:'16px', color:'#1a1a2e' }}>■ 재원조달별 지출현금흐름</h3>
          <div style={{ fontSize:'11px', color:'#888', marginTop:'3px' }}>VAT 포함 | 단위: 천원</div>
        </div>
        <button onClick={handlePrint}
          style={{ padding:'8px 18px', backgroundColor:'#2c3e50', color:'white', border:'none', borderRadius:'6px', cursor:'pointer', fontSize:'12px', fontWeight:'bold' }}>
          🖨 인쇄
        </button>
      </div>

      <div style={{ overflowX:'auto', border:'1px solid #ddd', borderRadius:'8px' }}>
        <table style={{ borderCollapse:'collapse', fontSize:'10px', whiteSpace:'nowrap' }}>
          <thead>
            <tr>
              <th style={{ ...thS({ textAlign:'left', minWidth:'160px', ...stickyL }) }}>항목</th>
              {months.map((ym,i) => (
                <th key={ym} style={{ ...thS({
                  minWidth:'56px',
                  color: isCon(i)?RS.conColor:isJun(i)?RS.junColor:'white',
                  borderLeft:  isSpec(i)?'2px solid #777':undefined,
                  borderRight: isSpec(i)?'2px solid #777':colBR(i),
                }) }}>
                  {isCon(i)?`◆${ym}`:isJun(i)?`★${ym}`:ym}
                </th>
              ))}
              <th style={{ ...thS({ minWidth:'70px', color:RS.junColor, borderLeft:'2px solid #666' }) }}>합계</th>
            </tr>
          </thead>
          <tbody>
            {FUNDS.map(fd => {
              const fdTotal = fundTotals[fd.key].reduce((s,v)=>s+v,0);
              if (fdTotal === 0 && fd.key !== 'loan') return null;

              // 재원별 금융비 항목
              const finRows = fd.key === 'pf' ? [
                { label:'금융비 — ① 주관사수수료', arr: finFeeByMonth_ },
              ] : fd.key === 'sale' ? [
                { label:'금융비 — ② 선순위 이자', arr: finIntSByMonth_ },
                { label:'금융비 — ③ 중순위 이자', arr: finIntMByMonth_ },
                { label:'금융비 — ④ 후순위 이자', arr: finIntJByMonth_ },
                { label:'금융비 — ⑧ 중도금 무이자', arr: finMidIntByMonth_ },
              ] : [];

              return (
                <React.Fragment key={fd.key}>
                  {/* 재원조달 헤더 */}
                  <tr>
                    <td colSpan={n+2} style={{ padding:'5px 10px', background:fd.secBg, color:'white', fontWeight:'bold', fontSize:'11px' }}>
                      [{fd.label}]
                    </td>
                  </tr>
                  {/* 카테고리별 세부항목 */}
                  {categories.map(cat =>
                    (mp[cat.itemsKey]||[]).map((item, ii) => {
                      const r = calcByFund(item, fd.key);
                      if (!r) return null;
                      return (
                        <tr key={`${cat.key}-${ii}`}>
                          <td style={{ ...tdS(fd.bg, fd.color), textAlign:'left', paddingLeft:'14px', ...stickyL }}>
                            {cat.label} — {item.label}
                          </td>
                          {months.map((ym,i) => (
                            <td key={ym} style={{ ...tdS(isSpec(i)?'#f0f0f0':fd.bg, fd.color), borderRight:colBR(i), borderLeft:isSpec(i)?'2px solid #bbb':undefined }}>
                              {fmtC(r.totals[ym]||0)}
                            </td>
                          ))}
                          <td style={{ ...tdS('#f0f0f0', fd.color, true), borderLeft:'2px solid #bbb' }}>{fmtC(r.total)}</td>
                        </tr>
                      );
                    })
                  )}
                  {/* 금융비 항목 (부대비 아래) */}
                  {finRows.filter(fr=>fr.arr.some(v=>v>0)).map((fr,fri) => (
                    <tr key={`fin-${fri}`}>
                      <td style={{ ...tdS(fd.bg, fd.color), textAlign:'left', paddingLeft:'14px', ...stickyL, fontStyle:'italic' }}>
                        {fr.label}
                      </td>
                      {fr.arr.map((v,i) => (
                        <td key={i} style={{ ...tdS(isSpec(i)?'#f0f0f0':fd.bg, fd.color), borderRight:colBR(i), borderLeft:isSpec(i)?'2px solid #bbb':undefined }}>
                          {fmtC(v)}
                        </td>
                      ))}
                      <td style={{ ...tdS('#f0f0f0', fd.color, true), borderLeft:'2px solid #bbb' }}>{fmtC(fr.arr.reduce((s,v)=>s+v,0))}</td>
                    </tr>
                  ))}
                  {/* 재원조달 소계 */}
                  <tr style={{ borderTop:`2px solid ${fd.color}` }}>
                    <td style={{ ...tdS(fd.bg, fd.color, true), textAlign:'left', paddingLeft:'10px', ...stickyL }}>{fd.label} 소계</td>
                    {fundTotals[fd.key].map((v,i) => (
                      <td key={i} style={{ ...tdS(isSpec(i)?'#e8e8e8':fd.bg, fd.color, true), borderRight:colBR(i), borderLeft:isSpec(i)?'2px solid #bbb':undefined }}>
                        {fmtC(v)}
                      </td>
                    ))}
                    <td style={{ ...tdS('#e0e0e0', fd.color, true), borderLeft:'2px solid #bbb' }}>{fmtC(fdTotal)}</td>
                  </tr>
                  <tr><td colSpan={n+2} style={{ height:'3px', background:'#ddd', padding:0 }} /></tr>
                </React.Fragment>
              );
            })}

            {/* 총합계 */}
            <tr style={{ borderTop:'3px solid #222' }}>
              <td style={{ ...tdS(RS.grandBg, RS.grandColor, true), textAlign:'left', fontSize:'11px', ...stickyL }}>
                지출 합계 (VAT 포함)
              </td>
              {grandMonthly.map((v,i) => (
                <td key={i} style={{ ...tdS(isSpec(i)?'#333':RS.grandBg, RS.grandColor, true), borderRight:colBR(i), borderLeft:isSpec(i)?'2px solid #555':undefined }}>
                  {fmtC(v)}
                </td>
              ))}
              <td style={{ ...tdS('#333', RS.grandColor, true), borderLeft:'2px solid #666' }}>{fmtC(grandTotal)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div style={{ marginTop:'8px', fontSize:'10px', color:'#888' }}>
        ◆ 착공월 | ★ 준공월
        {(salesData?.constructMonth||0)>0&&months[conIdx]?` | 착공: ${months[conIdx]}`:''}
        {(salesData?.junMonth||0)>0&&months[junIdx]?` | 준공: ${months[junIdx]}`:''}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// 수입현황 보고서
// ─────────────────────────────────────────────
const pnI = (v) => parseFloat(String(v||'').replace(/,/g,'')) || 0;

const calcRowI = (row, mode = 'apt') => {
  const excl = pnI(row.excl_m2), wall = pnI(row.wall_m2), core = pnI(row.core_m2);
  const mgmt = pnI(row.mgmt_m2), comm = pnI(row.comm_m2), park = pnI(row.park_m2);
  const tel  = pnI(row.tel_m2),  elec = pnI(row.elec_m2);
  const units = pnI(row.units), pyPrice = pnI(row.py_price);
  const sup_m2  = excl + wall + core;
  const cont_m2 = sup_m2 + mgmt + comm + park + tel + elec;
  const sup_py  = sup_m2  * 0.3025;
  const cont_py = cont_m2 * 0.3025;
  const excl_py = excl    * 0.3025;
  // 세대당 매출: apt=공급(평)*평당분양가, offi/store=계약(평)*평당분양가
  const unit_sale = mode === 'apt' ? pyPrice * sup_py : pyPrice * cont_py;
  const u_price   = unit_sale;
  const total     = unit_sale * units;
  return { excl_py, sup_py, cont_py, unit_sale, u_price, total };
};

function IncomeReport({ incomeData, projectName }) {
  const aptRows   = incomeData?.aptRows   || [];
  const offiRows  = incomeData?.offiRows  || [];
  const storeRows = incomeData?.storeRows || [];
  const balcony   = incomeData?.balcony   || {};
  const balBurden = incomeData?.balconyBurden || '분양자 부담';

  const balRows = aptRows.map(r => {
    const units = pnI(r.units);
    const price = pnI(balcony[r.type] || '0');
    return { type: r.type, units, price, total: units * price };
  }).filter(r => r.price > 0);

  // ── 섹션별 합계 ──
  const aptTotal   = aptRows.reduce((s, r) => s + calcRowI(r, 'apt').total, 0);
  const balTotal   = balBurden === '분양자 부담' ? balRows.reduce((s, r) => s + r.total, 0) : 0;
  const offiTotal  = offiRows.reduce((s, r) => s + calcRowI(r, 'offi').total, 0);
  const storeTotal = storeRows.reduce((s, r) => s + calcRowI(r, 'store').total, 0);
  const grandTotal = aptTotal + balTotal + offiTotal + storeTotal;

  // ── 전체 계약면적 합계 (발코니 제외) — 계약/전체연면적(%) 분모 ──
  const calcContPy = (rows, mode) => rows.reduce((s, r) => {
    const c = calcRowI(r, mode);
    return s + c.cont_py * pnI(r.units);
  }, 0);
  const totalContPy = calcContPy(aptRows, 'apt') + calcContPy(offiRows, 'offi') + calcContPy(storeRows, 'store');

  // ── 합계행 면적 합계 ──
  const sumExclPy  = [...aptRows, ...offiRows, ...storeRows].reduce((s, r) => s + pnI(r.excl_m2) * 0.3025 * pnI(r.units), 0);
  const sumSupPy   = aptRows.reduce((s, r) => s + calcRowI(r, 'apt').sup_py * pnI(r.units), 0)
                   + [...offiRows, ...storeRows].reduce((s, r) => s + calcRowI(r, 'offi').cont_py * pnI(r.units), 0);
  const sumContPy  = totalContPy;

  // 스타일
  const thBg = '#2c3e50', secBg = '#34495e', subBg = '#eaf1f8', totalBg = '#1a252f';
  const thS  = (a='center') => ({ padding:'8px 10px', backgroundColor:thBg, color:'white', fontSize:'12px', fontWeight:'bold', textAlign:a, whiteSpace:'nowrap', border:'1px solid #4a6278' });
  const secS = ()           => ({ padding:'8px 12px', backgroundColor:secBg, color:'white', fontSize:'13px', fontWeight:'bold', border:'1px solid #4a6278' });
  const tdS  = (a='right', bg='white') => ({ padding:'7px 10px', fontSize:'12px', textAlign:a, border:'1px solid #ddd', backgroundColor:bg, whiteSpace:'nowrap' });
  const subS = (a='right') => ({ padding:'7px 10px', fontSize:'12px', fontWeight:'bold', textAlign:a, border:'1px solid #b0c4d8', backgroundColor:subBg, whiteSpace:'nowrap' });
  const totS = (a='right') => ({ padding:'9px 10px', fontSize:'13px', fontWeight:'bold', textAlign:a, border:'1px solid #aaa', backgroundColor:totalBg, color:'white', whiteSpace:'nowrap' });

  const fmtAmt  = (v) => v ? Math.round(v).toLocaleString('ko-KR') : '-';
  const fmtPy   = (v) => v ? v.toFixed(2) : '-';
  const fmtPct  = (v) => grandTotal > 0 ? `${(v / grandTotal * 100).toFixed(1)}%` : '-';
  const fmtArea = (v) => totalContPy > 0 ? `${(v / totalContPy * 100).toFixed(1)}%` : '-';

  // ── 행 렌더링 ──
  const renderRows = (rows, mode) => rows.map((r, i) => {
    const c      = calcRowI(r, mode);
    const units  = pnI(r.units);
    const sup_py = (pnI(r.excl_m2) + pnI(r.wall_m2) + pnI(r.core_m2)) * 0.3025;
    // 공급(평): apt=공급면적평, offi/store=계약면적평(=cont_py)
    const dispSupPy = mode === 'apt' ? sup_py : c.cont_py;
    // 계약/전체연면적: 세대수 × 계약(평) / 전체계약면적
    const rowContPy = c.cont_py * units;
    return (
      <tr key={i}>
        <td style={tdS('center')}>{r.type || '-'}</td>
        <td style={tdS('right')}>{units ? units.toLocaleString() : '-'}</td>
        <td style={tdS('right')}>{fmtPy(pnI(r.excl_m2) * 0.3025)}</td>
        <td style={tdS('right')}>{fmtPy(dispSupPy)}</td>
        <td style={tdS('right')}>{fmtPy(c.cont_py)}</td>
        <td style={tdS('right')}>{pnI(r.py_price) ? pnI(r.py_price).toLocaleString() : '-'}</td>
        <td style={tdS('right')}>{fmtAmt(c.unit_sale)}</td>
        <td style={tdS('right')}>{fmtAmt(c.total)}<br/><span style={{fontSize:'10px',color:'#888'}}>({fmtPct(c.total)})</span></td>
        <td style={tdS('center')}>{fmtArea(rowContPy)}</td>
      </tr>
    );
  });

  const renderSubtotal = (label, total, contPy) => (
    <tr>
      <td style={subS('center')} colSpan={7}>{label} 소계</td>
      <td style={subS('right')}>{fmtAmt(total)}<br/><span style={{fontSize:'10px',color:'#666'}}>({fmtPct(total)})</span></td>
      <td style={subS('center')}>{fmtArea(contPy)}</td>
    </tr>
  );

  const handlePrint = () => {
    // 트랜치 계산기와 동일한 방식 — 현재 페이지에 print-area 주입
    const styleId = 'income-print-style';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.innerHTML = `
        @media print {
          body > * { display: none !important; }
          #income-print-area { display: block !important; }
          @page { size: A4 portrait; margin: 8mm; }
        }
        #income-print-area { display: none; }
      `;
      document.head.appendChild(style);
    }

    const existing = document.getElementById('income-print-area');
    if (existing) existing.remove();

    // 스타일 상수
    const thS = 'background:#2c3e50;color:white;padding:5px 6px;font-size:10px;font-weight:bold;border:1px solid #4a6278;text-align:right;white-space:nowrap;';
    const thSC= thS + 'text-align:center;';
    const thSL= thS + 'text-align:left;';
    const secS= 'background:#34495e;color:white;font-weight:bold;padding:6px 8px;font-size:11px;border:1px solid #4a6278;';
    const tdS = 'padding:4px 6px;font-size:11px;border:1px solid #ddd;text-align:right;white-space:nowrap;background:white;';
    const tdSC= tdS + 'text-align:center;';
    const subS= 'padding:4px 6px;font-size:11px;font-weight:bold;border:1px solid #b0c4d8;text-align:right;white-space:nowrap;background:#eaf1f8;';
    const subSC=subS + 'text-align:center;';
    const totS= 'padding:6px 6px;font-size:11px;font-weight:bold;border:1px solid #aaa;text-align:right;white-space:nowrap;background:#1a252f;color:white;';
    const totSC=totS + 'text-align:center;';

    const fmtA = (v) => v ? Math.round(v).toLocaleString('ko-KR') : '-';
    const fmtP = (v) => v ? v.toFixed(2) : '-';
    const fmtPct = (v) => grandTotal > 0 ? (v / grandTotal * 100).toFixed(1) + '%' : '-';
    const fmtArea= (v) => totalContPy > 0 ? (v / totalContPy * 100).toFixed(1) + '%' : '-';
    const fmtAmtPct = (amt, pct) => `${fmtA(amt)}<br><span style="font-size:8px;color:#aaa;">(${pct})</span>`;

    // 행 렌더링
    const renderRowsHTML = (rows, mode) => rows.map(r => {
      const c     = calcRowI(r, mode);
      const units = pnI(r.units);
      const sup_py= (pnI(r.excl_m2)+pnI(r.wall_m2)+pnI(r.core_m2))*0.3025;
      const dispSupPy = mode === 'apt' ? sup_py : c.cont_py;
      const rowContPy = c.cont_py * units;
      return `<tr>
        <td style="${tdSC}">${r.type||'-'}</td>
        <td style="${tdS}">${units ? units.toLocaleString() : '-'}</td>
        <td style="${tdS}">${fmtP(pnI(r.excl_m2)*0.3025)}</td>
        <td style="${tdS}">${fmtP(dispSupPy)}</td>
        <td style="${tdS}">${fmtP(c.cont_py)}</td>
        <td style="${tdS}">${pnI(r.py_price) ? pnI(r.py_price).toLocaleString() : '-'}</td>
        <td style="${tdS}">${fmtA(c.unit_sale)}</td>
        <td style="${tdS}">${fmtA(c.total)}<br><span style="font-size:8px;color:#888;">(${fmtPct(c.total)})</span></td>
        <td style="${tdSC}">${fmtArea(rowContPy)}</td>
      </tr>`;
    }).join('');

    const renderSubHTML = (label, total, contPy) =>
      `<tr>
        <td style="${subSC}" colspan="7">${label} 소계</td>
        <td style="${subS}">${fmtA(total)}<br><span style="font-size:8px;color:#666;">(${fmtPct(total)})</span></td>
        <td style="${subSC}">${fmtArea(contPy)}</td>
      </tr>`;

    // 발코니 행
    const balHTML = balRows.map(r =>
      `<tr>
        <td style="${tdSC}">${r.type}</td>
        <td style="${tdS}">${r.units.toLocaleString()}</td>
        <td style="${tdSC}" colspan="3">-</td>
        <td style="${tdS}">${r.price.toLocaleString()} <span style="font-size:9px;color:#888;">(세대당)</span></td>
        <td style="${tdS}">${fmtA(r.price)}</td>
        <td style="${tdS}">${fmtA(r.total)}<br><span style="font-size:8px;color:#888;">(${fmtPct(r.total)})</span></td>
        <td style="${tdSC}">-</td>
      </tr>`
    ).join('');

    const div = document.createElement('div');
    div.id = 'income-print-area';
    div.style.fontFamily = "'Malgun Gothic', sans-serif";
    div.style.fontSize = '10px';
    div.style.color = '#111';

    div.innerHTML = `
      <h2 style="font-size:16px;font-weight:bold;text-align:center;margin-bottom:3px;">수입현황</h2>
      <div style="text-align:center;font-size:10px;color:#555;margin-bottom:16px;">
        ${projectName} | ${new Date().toLocaleDateString('ko-KR')} | 단위: 천원 | 부가가치세 별도
      </div>
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr>
            <th style="${thSC}">타입</th>
            <th style="${thS}">세대</th>
            <th style="${thS}">전용</th>
            <th style="${thS}">공급</th>
            <th style="${thS}">계약</th>
            <th style="${thS}">평당분양가</th>
            <th style="${thS}">세대당매출</th>
            <th style="${thS}">매출액 (%)</th>
            <th style="${thSC}">계약면적<br>전체계약면적</th>
          </tr>
        </thead>
        <tbody>
          ${aptRows.length > 0 ? `
            <tr><td style="${secS}" colspan="9">공동주택</td></tr>
            ${renderRowsHTML(aptRows, 'apt')}
            ${renderSubHTML('공동주택', aptTotal, calcContPy(aptRows, 'apt'))}
          ` : ''}
          ${balRows.length > 0 && balBurden === '분양자 부담' ? `
            <tr><td style="${secS}" colspan="9">발코니확장</td></tr>
            ${balHTML}
            ${renderSubHTML('발코니확장', balTotal, 0)}
          ` : ''}
          ${offiRows.length > 0 ? `
            <tr><td style="${secS}" colspan="9">오피스텔</td></tr>
            ${renderRowsHTML(offiRows, 'offi')}
            ${renderSubHTML('오피스텔', offiTotal, calcContPy(offiRows, 'offi'))}
          ` : ''}
          ${storeRows.length > 0 ? `
            <tr><td style="${secS}" colspan="9">근린상가</td></tr>
            ${renderRowsHTML(storeRows, 'store')}
            ${renderSubHTML('근린상가', storeTotal, calcContPy(storeRows, 'store'))}
          ` : ''}
          <tr>
            <td style="${totSC}">합 계</td>
            <td style="${totS}">-</td>
            <td style="${totS}">${fmtP(sumExclPy)}</td>
            <td style="${totS}">${fmtP(sumSupPy)}</td>
            <td style="${totS}">${fmtP(sumContPy)}</td>
            <td style="${totSC}">-</td>
            <td style="${totSC}">-</td>
            <td style="${totS}">${fmtA(grandTotal)}<br><span style="font-size:8px;color:#aaa;">(100%)</span></td>
            <td style="${totSC}">100%</td>
          </tr>
        </tbody>
      </table>
      <div style="margin-top:8px;font-size:9px;color:#888;">
        * 매출액·평당분양가·세대당매출 단위: 천원 / 발코니확장 단가는 세대당 금액
      </div>
    `;

    document.body.appendChild(div);
    window.print();
  };

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'16px' }}>
        <h3 style={{ margin:0, color:'#2c3e50' }}>수입현황</h3>
        <button onClick={handlePrint}
          style={{ padding:'7px 16px', backgroundColor:'#2980b9', color:'white', border:'none', borderRadius:'6px', cursor:'pointer', fontSize:'13px', fontWeight:'bold' }}>
          🖨 인쇄
        </button>
      </div>
      <div style={{ overflowX:'auto' }}>
        <table id="income-report-table" style={{ borderCollapse:'collapse', width:'100%', fontSize:'12px' }}>
          <thead>
            <tr>
              <th style={thS('center')}>타입</th>
              <th style={thS('right')}>세대</th>
              <th style={thS('right')}>전용</th>
              <th style={thS('right')}>공급</th>
              <th style={thS('right')}>계약</th>
              <th style={thS('right')}>평당분양가</th>
              <th style={thS('right')}>세대당매출</th>
              <th style={thS('right')}>매출액 (%)</th>
              <th style={thS('center')}>계약면적<br/>전체계약면적</th>
            </tr>
          </thead>
          <tbody>
            {aptRows.length > 0 && <>
              <tr><td style={secS()} colSpan={10}>공동주택</td></tr>
              {renderRows(aptRows, 'apt')}
              {renderSubtotal('공동주택', aptTotal, calcContPy(aptRows, 'apt'))}
            </>}
            {publicRows.length > 0 && <>
              <tr><td style={secS()} colSpan={10}>공공주택</td></tr>
              {renderRows(publicRows, 'apt')}
              {renderSubtotal('공공주택', publicTotal, calcContPy(publicRows, 'apt'))}
            </>}
            {balRows.length > 0 && balBurden === '분양자 부담' && <>
              <tr><td style={secS()} colSpan={10}>발코니확장{balIncludePublic ? ' (공공주택 포함)' : ''}</td></tr>
              {balRows.map((r, i) => (
                <tr key={i}>
                  <td style={tdS('center')}>{r.type}</td>
                  <td style={tdS('right')}>{r.units.toLocaleString()}</td>
                  <td style={tdS('center')} colSpan={3}>-</td>
                  <td style={tdS('right')}>
                    {r.price.toLocaleString()}
                    <span style={{ fontSize:'10px', color:'#888', marginLeft:'4px' }}>(세대당)</span>
                  </td>
                  <td style={tdS('right')}>{fmtAmt(r.price)}</td>
                  <td style={tdS('right')}>{fmtAmt(r.total)}<br/><span style={{fontSize:'10px',color:'#888'}}>({fmtPct(r.total)})</span></td>
                  <td style={tdS('center')}>-</td>
                </tr>
              ))}
              {renderSubtotal('발코니확장', balTotal, 0)}
            </>}
            {offiRows.length > 0 && <>
              <tr><td style={secS()} colSpan={10}>오피스텔</td></tr>
              {renderRows(offiRows, 'offi')}
              {renderSubtotal('오피스텔', offiTotal, calcContPy(offiRows, 'offi'))}
            </>}
            {storeRows.length > 0 && <>
              <tr><td style={secS()} colSpan={10}>근린상가</td></tr>
              {renderRows(storeRows, 'store')}
              {renderSubtotal('근린상가', storeTotal, calcContPy(storeRows, 'store'))}
            </>}
            {pubfacRows.length > 0 && <>
              <tr><td style={secS()} colSpan={10}>공공시설</td></tr>
              {renderRows(pubfacRows, 'store')}
              {renderSubtotal('공공시설', pubfacTotal, calcContPy(pubfacRows, 'store'))}
            </>}
            {/* 합계행 */}
            <tr>
              <td style={totS('center')}>합 계</td>
              <td style={totS('right')}>-</td>
              <td style={totS('right')}>{fmtPy(sumExclPy)}</td>
              <td style={totS('right')}>{fmtPy(sumSupPy)}</td>
              <td style={totS('right')}>{fmtPy(sumContPy)}</td>
              <td style={totS('center')}>-</td>
              <td style={totS('center')}>-</td>
              <td style={totS('right')}>{fmtAmt(grandTotal)}<br/><span style={{fontSize:'10px',color:'#aaa'}}>(100%)</span></td>
              <td style={totS('center')}>100%</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div style={{ fontSize:'11px', color:'#aaa', marginTop:'8px' }}>
        * 매출액·평당분양가·세대당매출 단위: 천원 / 발코니확장 단가는 세대당 금액
      </div>
    </div>
  );
}

function Report({ salesData, monthlyPayments, financeData, projectName, cashFlowResult, incomeData }) {
  const [active, setActive] = React.useState(null);

  const btnStyle = (color, disabled = false) => ({
    padding: '10px 20px', backgroundColor: disabled ? '#bdc3c7' : color,
    color: 'white', border: 'none', borderRadius: '8px',
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontSize: '13px', fontWeight: 'bold',
    boxShadow: disabled ? 'none' : '0 2px 6px rgba(0,0,0,0.15)',
    opacity: disabled ? 0.6 : 1,
  });

  return (
    <div>
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '28px' }}>
        <button style={btnStyle(active==='income'?'#1a5276':'#1f618d')} onClick={() => setActive(active==='income'?null:'income')}>
          📋 수입현황
        </button>
        <button style={btnStyle(active==='alloc'?'#1a3a5c':'#2c3e50')} onClick={() => setActive(active==='alloc'?null:'alloc')}>
          💰 분양금 배분 현황
        </button>
        <button style={btnStyle(active==='cashflow'?'#1a3a5c':'#2c3e50')} onClick={() => setActive(active==='cashflow'?null:'cashflow')}>
          📊 월별 현금흐름
        </button>
        <button style={btnStyle(active==='salescf'?'#1a3a5c':'#2c3e50')} onClick={() => setActive(active==='salescf'?null:'salescf')}>
          📈 매출 현금흐름
        </button>
        <button style={btnStyle(active==='costcf'?'#1a3a5c':'#2c3e50')} onClick={() => setActive(active==='costcf'?null:'costcf')}>
          📉 지출 현금흐름
        </button>
        <button style={btnStyle(active==='fundcf'?'#1a3a5c':'#2c3e50')} onClick={() => setActive(active==='fundcf'?null:'fundcf')}>
          🏦 재원조달별 지출
        </button>
        <button style={btnStyle('#95a5a6', true)} disabled>
          📋 PF 대출 계획
        </button>
      </div>

      {active === 'income'   && <IncomeReport incomeData={incomeData} projectName={projectName} />}
      {active === 'alloc'    && <SaleAllocation salesData={salesData} projectName={projectName} />}
      {active === 'cashflow' && <CashFlow salesData={salesData} monthlyPayments={monthlyPayments} financeData={financeData} projectName={projectName} cashFlowResult={cashFlowResult} />}
      {active === 'salescf'  && <SalesCashFlow salesData={salesData} projectName={projectName} />}
      {active === 'costcf'   && <CostCashFlow monthlyPayments={monthlyPayments} salesData={salesData} financeData={financeData} projectName={projectName} cashFlowResult={cashFlowResult} />}
      {active === 'fundcf'   && <FundingCashFlow monthlyPayments={monthlyPayments} salesData={salesData} projectName={projectName} cashFlowResult={cashFlowResult} financeData={financeData} />}

      {active === null && (
        <div style={{ color:'#aaa', textAlign:'center', padding:'60px', border:'2px dashed #ddd', borderRadius:'12px', fontSize:'14px' }}>
          위 버튼을 선택하면 보고서를 확인할 수 있습니다.
        </div>
      )}
    </div>
  );
}

export default Report;

