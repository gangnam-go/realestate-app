import React, { useState, useEffect } from 'react';
import { formatNumber, parseNumber } from '../utils';

const addMonths = (year, month, n) => {
  const total = (parseInt(year) - 1) * 12 + (parseInt(month) - 1) + n;
  return { year: Math.floor(total / 12) + 1, month: (total % 12) + 1 };
};
const fmtYM = (y, m) => `${y}.${String(m).padStart(2, '0')}`;

const APT_PATTERNS = [
  { label: '1개월 100%',            m1: 1.00, m2: 0.00, m3: 0.00, end: 1  },
  { label: '3개월 100%',            m1: 0.50, m2: 0.30, m3: 0.20, end: 3  },
  { label: '3개월 80%  6개월 완판', m1: 0.40, m2: 0.20, m3: 0.20, end: 6  },
  { label: '3개월 60%  9개월 완판', m1: 0.30, m2: 0.20, m3: 0.10, end: 9  },
  { label: '3개월 60% 12개월 완판', m1: 0.30, m2: 0.20, m3: 0.10, end: 12 },
  { label: '3개월 40% 12개월 완판', m1: 0.20, m2: 0.10, m3: 0.10, end: 12 },
  { label: '3개월 40% 15개월 완판', m1: 0.20, m2: 0.10, m3: 0.10, end: 15 },
  { label: '3개월 40% 18개월 완판', m1: 0.20, m2: 0.10, m3: 0.10, end: 18 },
  { label: '3개월 40% 24개월 완판', m1: 0.20, m2: 0.10, m3: 0.10, end: 24 },
  { label: '3개월 40% 준공시 완판', m1: 0.20, m2: 0.10, m3: 0.10, end: 0  },
  { label: '직접입력',              m1: 0,    m2: 0,    m3: 0,    end: 0  },
];
const OFFI_PATTERNS = [
  { label: '3개월 100%',            m1: 0.50, m2: 0.30, m3: 0.20, end: 3  },
  { label: '3개월 80%  6개월 완판', m1: 0.40, m2: 0.20, m3: 0.20, end: 6  },
  { label: '3개월 60%  9개월 완판', m1: 0.30, m2: 0.20, m3: 0.10, end: 9  },
  { label: '3개월 40% 12개월 완판', m1: 0.20, m2: 0.10, m3: 0.10, end: 12 },
  { label: '3개월 40% 15개월 완판', m1: 0.20, m2: 0.10, m3: 0.10, end: 15 },
  { label: '3개월 40% 18개월 완판', m1: 0.20, m2: 0.10, m3: 0.10, end: 18 },
  { label: '3개월 40% 24개월 완판', m1: 0.20, m2: 0.10, m3: 0.10, end: 24 },
  { label: '3개월 40% 준공시 완판', m1: 0.20, m2: 0.10, m3: 0.10, end: 0  },
  { label: '직접입력',              m1: 0,    m2: 0,    m3: 0,    end: 0  },
];
const STORE_PATTERNS = [
  { label: '3개월 30%', m1: 0.15, m2: 0.10, m3: 0.05 },
  { label: '3개월 40%', m1: 0.20, m2: 0.10, m3: 0.10 },
  { label: '3개월 50%', m1: 0.25, m2: 0.15, m3: 0.10 },
  { label: '직접입력',  m1: 0,    m2: 0,    m3: 0    },
];

const calcMidMonths = (salesStartMonth, constructPeriod, prepPeriod, midCount, midBeforeEnd) => {
  const n   = parseInt(midCount)        || 0;
  const x   = parseInt(midBeforeEnd)   || 3;
  const con = parseInt(constructPeriod) || 31;
  const pre = parseInt(prepPeriod)      || 0;
  if (n === 0) return [];
  const junMonth   = pre + con;
  const endMonth   = junMonth - x;
  const startMonth = parseInt(salesStartMonth) || (pre + 1);
  const span       = endMonth - startMonth;
  const interval   = Math.floor(span / (n + 1));
  return Array.from({ length: n }, (_, i) => startMonth + interval * (i + 1));
};

const calcBalMonths = (prepPeriod, constructPeriod, balCount) => {
  const pre = parseInt(prepPeriod)      || 0;
  const con = parseInt(constructPeriod) || 31;
  const m   = parseInt(balCount)        || 3;
  const junMonth = pre + con;
  return Array.from({ length: m }, (_, i) => junMonth + i);
};

const calcRates = (config, totalMonths, salesStartMonth, constructPeriod, prepPeriod, isStore) => {
  const rates = Array(totalMonths).fill(0);
  const m1 = parseFloat(config.m1) || 0;
  const m2 = parseFloat(config.m2) || 0;
  const m3 = parseFloat(config.m3) || 0;
  const remain = 1 - m1 - m2 - m3;
  const con = parseInt(constructPeriod) || 31;
  const pre = parseInt(prepPeriod)      || 0;
  const junMonth = pre + con;

  if (isStore) {
    const startIdx  = junMonth - (parseInt(config.storeStartBefore) || 9) - 1;
    const endIdx    = junMonth + (parseInt(config.storeEndAfter)    || 4) - 2;
    const remMonths = endIdx - startIdx - 2;
    for (let i = startIdx; i < totalMonths; i++) {
      const m = i - startIdx;
      if (m === 0)      rates[i] = m1;
      else if (m === 1) rates[i] = m2;
      else if (m === 2) rates[i] = m3;
      else if (m > 2 && i <= endIdx && remMonths > 0) rates[i] = remain / remMonths;
    }
  } else {
    const startIdx  = parseInt(salesStartMonth) - 1;
    const endMonth  = parseInt(config.endMonth) || 0;
    const endIdx    = endMonth > 0 ? startIdx + endMonth - 1 : junMonth - 2;
    const remMonths = endIdx - startIdx - 2;
    for (let i = startIdx; i < totalMonths; i++) {
      const m = i - startIdx;
      if (m === 0)      rates[i] = m1;
      else if (m === 1) rates[i] = m2;
      else if (m === 2) rates[i] = m3;
      else if (m > 2 && i <= endIdx && remMonths > 0) rates[i] = remain / remMonths;
    }
  }
  return rates;
};

const roundAndFix = (arr, total) => {
  const rounded = arr.map(v => Math.round(v));
  const diff = total - rounded.reduce((s,v)=>s+v,0);
  if (diff !== 0) {
    for (let i = rounded.length-1; i>=0; i--) {
      if (rounded[i] > 0) { rounded[i] += diff; break; }
    }
  }
  return rounded;
};

const calcIncome = (rates, totalUnits, unitPrice, config, midMonths, balMonths, totalMonths) => {
  const depRate = (parseFloat(config.depositRate) || 10) / 100;
  const midN    = parseInt(config.midCount)        || 0;
  const midTot  = config.midRate !== undefined
    ? (parseFloat(config.midRate) || 0) / 100
    : Math.max(0, 1 - depRate - (parseFloat(config.balanceRate)||30)/100);
  const balRate = Math.max(0, 1 - depRate - midTot);
  const mid1    = midN > 0 ? midTot / midN : 0;
  const balN    = parseInt(config.balanceCount) || 3;
  const bal1    = balRate / balN;

  const cumul = rates.reduce((acc, v, i) => { acc.push((acc[i-1]||0)+v); return acc; }, []);
  const dep = Array(totalMonths).fill(0);
  const mid = Array(totalMonths).fill(0);
  const bal = Array(totalMonths).fill(0);

  for (let i = 0; i < totalMonths; i++) {
    dep[i] = rates[i] * totalUnits * unitPrice * depRate;
    if (midMonths.includes(i + 1)) {
      const curMidIdx    = midMonths.indexOf(i + 1);
      const prevMidMonth = curMidIdx > 0 ? midMonths[curMidIdx - 1] : 0;
      const prevCumul    = prevMidMonth > 0 ? cumul[prevMidMonth - 1] : 0;
      mid[i] = (cumul[i] * totalUnits * unitPrice * mid1)
             + ((cumul[i] - prevCumul) * totalUnits * unitPrice * mid1 * curMidIdx);
    }
    if (balMonths.includes(i + 1)) {
      const curBalIdx    = balMonths.indexOf(i + 1);
      const prevBalMonth = curBalIdx > 0 ? balMonths[curBalIdx - 1] : 0;
      const prevCumul    = prevBalMonth > 0 ? cumul[prevBalMonth - 1] : cumul[i];
      bal[i] = (cumul[i] * totalUnits * unitPrice * bal1)
             + ((cumul[i] - prevCumul) * totalUnits * unitPrice * bal1 * curBalIdx);
    }
  }

  const depTotal = Math.round(dep.reduce((s,v)=>s+v,0));
  const midTotal = Math.round(mid.reduce((s,v)=>s+v,0));
  const balTotal = Math.round(bal.reduce((s,v)=>s+v,0));
  return {
    dep: roundAndFix(dep, depTotal),
    mid: roundAndFix(mid, midTotal),
    bal: roundAndFix(bal, balTotal),
    cumul,
  };
};

const calcBalconyIncome = (rates, totalUnits, unitPrice, depositRate, balMonths, totalMonths) => {
  const depRate = (parseFloat(depositRate) || 10) / 100;
  const balRate = 1 - depRate;
  const balN    = balMonths.length || 1;
  const bal1    = balRate / balN;

  const cumul = rates.reduce((acc, v, i) => { acc.push((acc[i-1]||0)+v); return acc; }, []);
  const dep = Array(totalMonths).fill(0);
  const mid = Array(totalMonths).fill(0);
  const bal = Array(totalMonths).fill(0);

  for (let i = 0; i < totalMonths; i++) {
    dep[i] = rates[i] * totalUnits * unitPrice * depRate;
    if (balMonths.includes(i + 1)) {
      const curBalIdx    = balMonths.indexOf(i + 1);
      const prevBalMonth = curBalIdx > 0 ? balMonths[curBalIdx - 1] : 0;
      const prevCumul    = prevBalMonth > 0 ? cumul[prevBalMonth - 1] : cumul[i];
      bal[i] = (cumul[i] * totalUnits * unitPrice * bal1)
             + ((cumul[i] - prevCumul) * totalUnits * unitPrice * bal1 * curBalIdx);
    }
  }

  const depTotal = Math.round(dep.reduce((s,v)=>s+v,0));
  const balTotal = Math.round(bal.reduce((s,v)=>s+v,0));
  return {
    dep: roundAndFix(dep, depTotal),
    mid,
    bal: roundAndFix(bal, balTotal),
    cumul,
  };
};

// ── 공공주택/공공시설 수입 계산 ──────────────────────────────
// 계약금: 착공월 일시납
// 중도금 1차: 공정율 prog1% 달성월 (착공월 + 공사기간 × prog1/100 반올림)
// 중도금 2차: 공정율 prog2% 달성월
// 잔금 1차: 준공월
// 잔금 2차: 준공+1월
// 금융비 무관 (자치단체 납부)
const calcPublicMonths = (constructMonth, constructPeriod, junMonth, prog1, prog2) => {
  const mid1Month = constructMonth + Math.round(constructPeriod * (parseFloat(prog1) || 30) / 100);
  const mid2Month = constructMonth + Math.round(constructPeriod * (parseFloat(prog2) || 60) / 100);
  const bal1Month = junMonth;
  const bal2Month = junMonth + 1;
  return { mid1Month, mid2Month, bal1Month, bal2Month };
};

const calcPublicIncome = (totalAmount, cfg, constructMonth, constructPeriod, junMonth, totalMonths) => {
  const depRate  = (parseFloat(cfg.depositRate)  || 10) / 100;
  const mid1Rate = (parseFloat(cfg.mid1Rate)     || 20) / 100;
  const mid2Rate = (parseFloat(cfg.mid2Rate)     || 20) / 100;
  const bal1Rate = (parseFloat(cfg.bal1Rate)     || 25) / 100;
  const bal2Rate = Math.max(0, 1 - depRate - mid1Rate - mid2Rate - bal1Rate);

  const { mid1Month, mid2Month, bal1Month, bal2Month } =
    calcPublicMonths(constructMonth, constructPeriod, junMonth, cfg.prog1, cfg.prog2);

  const dep = Array(totalMonths).fill(0);
  const mid = Array(totalMonths).fill(0);
  const bal = Array(totalMonths).fill(0);

  // 계약금: 착공월 일시납
  if (constructMonth - 1 < totalMonths) dep[constructMonth - 1] = Math.round(totalAmount * depRate);
  // 중도금 1차
  if (mid1Month - 1 < totalMonths) mid[mid1Month - 1] = Math.round(totalAmount * mid1Rate);
  // 중도금 2차
  if (mid2Month - 1 < totalMonths && mid2Month !== mid1Month)
    mid[mid2Month - 1] += Math.round(totalAmount * mid2Rate);
  else if (mid2Month - 1 < totalMonths)
    mid[mid2Month - 1] += Math.round(totalAmount * mid2Rate);
  // 잔금 1차
  if (bal1Month - 1 < totalMonths) bal[bal1Month - 1] = Math.round(totalAmount * bal1Rate);
  // 잔금 2차
  if (bal2Month - 1 < totalMonths) bal[bal2Month - 1] = Math.round(totalAmount * bal2Rate);

  // 합계 보정 (반올림 오차 → 잔금 2차에 흡수)
  const depTotal  = dep.reduce((s,v)=>s+v,0);
  const midTotal  = mid.reduce((s,v)=>s+v,0);
  const balTotal  = bal.reduce((s,v)=>s+v,0);
  const allocated = depTotal + midTotal + balTotal;
  const diff      = Math.round(totalAmount) - allocated;
  if (diff !== 0 && bal2Month - 1 < totalMonths) bal[bal2Month - 1] += diff;

  const monthly = dep.map((v,i) => v + mid[i] + bal[i]);
  return {
    dep, mid, bal, monthly,
    depTotal: dep.reduce((s,v)=>s+v,0),
    midTotal: mid.reduce((s,v)=>s+v,0),
    balTotal: bal.reduce((s,v)=>s+v,0),
    total:    monthly.reduce((s,v)=>s+v,0),
    mid1Month, mid2Month, bal1Month, bal2Month,
  };
};

function TimelineHeader({ ymList, midMonths, balMonths, constructMonth, junMonth }) {
  const thBase = { padding: '4px 4px', fontSize: '10px', textAlign: 'center', whiteSpace: 'nowrap', borderBottom: '1px solid #ddd', minWidth: '38px' };
  const thTotal = { ...thBase, backgroundColor: '#546e7a', color: '#f5cba7', minWidth: '70px', borderLeft: '2px solid #888' };
  return (
    <>
      <tr>
        <th style={{ ...thBase, backgroundColor: '#546e7a', color: 'white', textAlign: 'left', minWidth: '70px' }}>년월</th>
        {ymList.map((ym, i) => {
          const isC = (i+1) === constructMonth;
          const isJ = (i+1) === junMonth;
          return (
            <th key={i} style={{ ...thBase, backgroundColor: isC?'#e67e22':isJ?'#8e44ad':'#f8f9fa', color: isC||isJ?'white':'#555', fontWeight: isC||isJ?'bold':'normal' }}>
              {isC ? '착공' : isJ ? '준공' : ym}
            </th>
          );
        })}
        <th style={thTotal}>합계</th>
      </tr>
      <tr>
        <th style={{ ...thBase, backgroundColor: '#546e7a', color: 'white', textAlign: 'left' }}>납부일정</th>
        {ymList.map((_, i) => {
          const midIdx = midMonths.indexOf(i+1);
          const balIdx = balMonths.indexOf(i+1);
          const label  = midIdx >= 0 ? `중${midIdx+1}` : balIdx >= 0 ? `잔${balIdx+1}` : '';
          return (
            <th key={i} style={{ ...thBase, backgroundColor: midIdx>=0?'#eaf1f8':balIdx>=0?'#d5f5e3':'white', color: midIdx>=0?'#1a5276':balIdx>=0?'#1e8449':'#ddd', fontWeight: label?'bold':'normal' }}>
              {label || '-'}
            </th>
          );
        })}
        <th style={{ ...thBase, backgroundColor: '#546e7a', borderLeft: '2px solid #888' }}></th>
      </tr>
    </>
  );
}

// ── 공공주택/공공시설 납부일정 헤더 ──
function PublicTimelineHeader({ ymList, constructMonth, junMonth, mid1Month, mid2Month, bal1Month, bal2Month }) {
  const thBase = { padding: '4px 4px', fontSize: '10px', textAlign: 'center', whiteSpace: 'nowrap', borderBottom: '1px solid #ddd', minWidth: '38px' };
  return (
    <>
      <tr>
        <th style={{ ...thBase, backgroundColor: '#546e7a', color: 'white', textAlign: 'left', minWidth: '70px' }}>년월</th>
        {ymList.map((ym, i) => {
          const isC = (i+1) === constructMonth;
          const isJ = (i+1) === junMonth;
          return (
            <th key={i} style={{ ...thBase, backgroundColor: isC?'#e67e22':isJ?'#8e44ad':'#f8f9fa', color: isC||isJ?'white':'#555', fontWeight: isC||isJ?'bold':'normal' }}>
              {isC ? '착공' : isJ ? '준공' : ym}
            </th>
          );
        })}
        <th style={{ ...thBase, backgroundColor: '#546e7a', color: '#f5cba7', minWidth: '70px', borderLeft: '2px solid #888' }}>합계</th>
      </tr>
      <tr>
        <th style={{ ...thBase, backgroundColor: '#546e7a', color: 'white', textAlign: 'left' }}>납부일정</th>
        {ymList.map((_, i) => {
          const monthNum = i + 1;
          let label = '';
          let bg = 'white'; let color = '#ddd';
          if (monthNum === constructMonth)  { label = '계약금'; bg = '#eaf1f8'; color = '#1a5276'; }
          if (monthNum === mid1Month)       { label = '중도1';  bg = '#eaf1f8'; color = '#1a5276'; }
          if (monthNum === mid2Month && mid2Month !== mid1Month) { label = '중도2'; bg = '#eaf1f8'; color = '#1a5276'; }
          if (monthNum === bal1Month)       { label = '잔금1';  bg = '#d5f5e3'; color = '#1e8449'; }
          if (monthNum === bal2Month)       { label = '잔금2';  bg = '#d5f5e3'; color = '#1e8449'; }
          return (
            <th key={i} style={{ ...thBase, backgroundColor: bg, color, fontWeight: label?'bold':'normal' }}>
              {label || '-'}
            </th>
          );
        })}
        <th style={{ ...thBase, backgroundColor: '#546e7a', borderLeft: '2px solid #888' }}></th>
      </tr>
    </>
  );
}

function SalesCondition({ title, color, config, setConfig }) {
  const depOpts = [5, 10, 15, 20];
  const midOpts = [0, 1, 2, 3, 4, 5, 6];
  const balOpts = [1, 2, 3, 4, 5, 6];
  const btn = (val, cur, onClick, suffix='') => (
    <button key={val} onClick={() => onClick(val)}
      style={{ padding:'4px 10px', border:'1px solid #ddd', borderRadius:'4px', cursor:'pointer', fontSize:'12px',
        backgroundColor: cur===val ? color : 'white', color: cur===val ? 'white' : '#333' }}>
      {val}{suffix}
    </button>
  );
  return (
    <div style={{ backgroundColor:'#f8f9fa', border:'1px solid #e0e0e0', borderRadius:'6px', padding:'14px', marginBottom:'10px' }}>
      <div style={{ fontWeight:'bold', fontSize:'13px', color, marginBottom:'12px' }}>{title} — 분양 조건</div>
      <div style={{ display:'flex', gap:'20px', flexWrap:'wrap' }}>
        <div>
          <div style={{ fontSize:'12px', fontWeight:'bold', color:'#555', marginBottom:'6px' }}>계약금율</div>
          <div style={{ display:'flex', gap:'4px' }}>
            {depOpts.map(v => btn(v, parseInt(config.depositRate)||10, val => setConfig({...config, depositRate: val}), '%'))}
          </div>
        </div>
        <div>
          <div style={{ fontSize:'12px', fontWeight:'bold', color:'#555', marginBottom:'6px' }}>중도금 회차</div>
          <div style={{ display:'flex', gap:'4px' }}>
            {midOpts.map(v => btn(v, parseInt(config.midCount)||0, val => setConfig({...config, midCount: val}), '회'))}
          </div>
        </div>
        <div>
          <div style={{ fontSize:'12px', fontWeight:'bold', color:'#555', marginBottom:'6px' }}>중도금</div>
          <div style={{ display:'flex', gap:'4px' }}>
            {['무이자','유이자'].map(v => (
              <button key={v} onClick={() => setConfig({...config, midFree: v==='무이자'})}
                style={{ padding:'4px 10px', border:'1px solid #ddd', borderRadius:'4px', cursor:'pointer', fontSize:'12px',
                  backgroundColor: (config.midFree!==false)===(v==='무이자') ? color : 'white',
                  color: (config.midFree!==false)===(v==='무이자') ? 'white' : '#333' }}>
                {v}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div style={{ fontSize:'12px', fontWeight:'bold', color:'#555', marginBottom:'6px' }}>중도금 마감</div>
          <div style={{ display:'flex', alignItems:'center', gap:'4px' }}>
            <span style={{ fontSize:'12px' }}>준공</span>
            <input type="number" value={config.midBeforeEnd||3}
              onChange={e => setConfig({...config, midBeforeEnd: e.target.value})}
              style={{ width:'45px', padding:'4px 6px', border:'1px solid #ddd', borderRadius:'4px', fontSize:'12px', textAlign:'right' }} />
            <span style={{ fontSize:'12px' }}>개월 전</span>
          </div>
        </div>
        <div>
          <div style={{ fontSize:'12px', fontWeight:'bold', color:'#555', marginBottom:'6px' }}>중도금율</div>
          <div style={{ display:'flex', alignItems:'center', gap:'4px' }}>
            <input type="number" value={config.midRate !== undefined ? config.midRate : 60}
              onChange={e => setConfig({...config, midRate: e.target.value})}
              style={{ width:'45px', padding:'4px 6px', border:'1px solid #ddd', borderRadius:'4px', fontSize:'12px', textAlign:'right' }} />
            <span style={{ fontSize:'12px' }}>%</span>
          </div>
        </div>
        <div>
          <div style={{ fontSize:'12px', fontWeight:'bold', color:'#555', marginBottom:'6px' }}>잔금율</div>
          <div style={{ display:'flex', alignItems:'center', gap:'4px' }}>
            <span style={{ padding:'4px 8px', backgroundColor:'#f0f4f8', border:'1px solid #ddd',
              borderRadius:'4px', fontSize:'12px', fontWeight:'bold', color:'#1a3a5c', minWidth:'45px', textAlign:'right' }}>
              {Math.max(0, 100-(parseInt(config.depositRate)||10)-(parseInt(config.midRate !== undefined ? config.midRate : 60)||60))}
            </span>
            <span style={{ fontSize:'12px' }}>% (자동)</span>
          </div>
        </div>
        <div>
          <div style={{ fontSize:'12px', fontWeight:'bold', color:'#555', marginBottom:'6px' }}>잔금 입주회차</div>
          <div style={{ display:'flex', gap:'4px' }}>
            {balOpts.map(v => btn(v, parseInt(config.balanceCount)||3, val => setConfig({...config, balanceCount: val}), '회'))}
          </div>
        </div>
        <div>
          <div style={{ fontSize:'12px', fontWeight:'bold', color:'#555', marginBottom:'6px' }}>분양시작</div>
          <div style={{ display:'flex', alignItems:'center', gap:'4px' }}>
            <span style={{ fontSize:'12px' }}>착공</span>
            <input type="number" value={config.salesStartOffset||0}
              onChange={e => setConfig({...config, salesStartOffset: e.target.value})}
              style={{ width:'45px', padding:'4px 6px', border:'1px solid #ddd', borderRadius:'4px', fontSize:'12px', textAlign:'right' }} />
            <span style={{ fontSize:'12px' }}>개월 후 (0=착공월, 음수=선분양)</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── 공공주택/공공시설 분양조건 컴포넌트 ──────────────────────
function PublicSalesCondition({ title, color, config, setConfig }) {
  const depRate  = parseFloat(config.depositRate) || 10;
  const mid1Rate = parseFloat(config.mid1Rate)    || 20;
  const mid2Rate = parseFloat(config.mid2Rate)    || 20;
  const bal1Rate = parseFloat(config.bal1Rate)    || 25;
  const bal2Rate = Math.max(0, 100 - depRate - mid1Rate - mid2Rate - bal1Rate);

  const numIn = (label, key, value, onChange, hint, readOnly=false) => (
    <div style={{ display:'flex', flexDirection:'column', gap:'4px' }}>
      <div style={{ fontSize:'11px', fontWeight:'bold', color:'#555' }}>{label}</div>
      <div style={{ display:'flex', alignItems:'center', gap:'4px' }}>
        <input type="number" value={value} readOnly={readOnly}
          onChange={onChange}
          style={{ width:'52px', padding:'4px 6px', border:'1px solid #ddd', borderRadius:'4px', fontSize:'12px', textAlign:'right',
            backgroundColor: readOnly ? '#f0f4f8' : 'white',
            color: readOnly ? '#1a3a5c' : '#333',
            fontWeight: readOnly ? 'bold' : 'normal' }} />
        <span style={{ fontSize:'11px', color:'#888' }}>%</span>
      </div>
      {hint && <div style={{ fontSize:'10px', color }}>{hint}</div>}
    </div>
  );

  return (
    <div style={{ backgroundColor:'#f8f9fa', border:'1px solid #e0e0e0', borderRadius:'6px', padding:'14px', marginBottom:'10px' }}>
      <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'12px', flexWrap:'wrap' }}>
        <span style={{ fontWeight:'bold', fontSize:'13px', color }}>{title} — 분양 조건</span>
        <span style={{ fontSize:'11px', color:'#e74c3c', backgroundColor:'#fdecea', padding:'2px 8px', borderRadius:'10px' }}>
          자치단체 납부 · 중도금 무이자/유이자 해당없음
        </span>
      </div>
      <div style={{ display:'flex', gap:'16px', flexWrap:'wrap', alignItems:'flex-start' }}>
        {/* 비율 입력 */}
        <div style={{ display:'flex', gap:'10px', alignItems:'flex-end', flexWrap:'wrap' }}>
          {numIn('계약금', 'depositRate', depRate,
            e => setConfig({...config, depositRate: e.target.value}), '착공월 일시납')}
          <div style={{ paddingBottom:'20px', color:'#aaa', fontSize:'14px' }}>+</div>
          {numIn('중도금 1차', 'mid1Rate', mid1Rate,
            e => setConfig({...config, mid1Rate: e.target.value}), null)}
          <div style={{ paddingBottom:'20px', color:'#aaa', fontSize:'14px' }}>+</div>
          {numIn('중도금 2차', 'mid2Rate', mid2Rate,
            e => setConfig({...config, mid2Rate: e.target.value}), null)}
          <div style={{ paddingBottom:'20px', color:'#aaa', fontSize:'14px' }}>+</div>
          {numIn('잔금 1차', 'bal1Rate', bal1Rate,
            e => setConfig({...config, bal1Rate: e.target.value}), '준공월')}
          <div style={{ paddingBottom:'20px', color:'#aaa', fontSize:'14px' }}>+</div>
          {numIn('잔금 2차 (자동)', null, bal2Rate.toFixed(1), null, '준공+1개월', true)}
          <div style={{ display:'flex', alignItems:'center', marginBottom:'20px' }}>
            <span style={{ fontSize:'12px', fontWeight:'bold',
              color: Math.abs(bal2Rate) < 0.1 ? '#27ae60' : bal2Rate < 0 ? '#e74c3c' : '#e67e22' }}>
              = {(depRate+mid1Rate+mid2Rate+bal1Rate+bal2Rate).toFixed(1)}%
              {Math.abs(100 - (depRate+mid1Rate+mid2Rate+bal1Rate+bal2Rate)) < 0.1 ? ' ✓' : ' ≠100%'}
            </span>
          </div>
        </div>
        {/* 공정율 입력 */}
        <div style={{ borderLeft:'1px solid #e0e0e0', paddingLeft:'16px', display:'flex', flexDirection:'column', gap:'10px' }}>
          <div style={{ fontSize:'11px', fontWeight:'bold', color:'#555' }}>공정율 기준 (수정 가능)</div>
          <div style={{ display:'flex', gap:'12px' }}>
            <div style={{ display:'flex', flexDirection:'column', gap:'4px' }}>
              <div style={{ fontSize:'11px', color:'#555' }}>중도금 1차 공정율</div>
              <div style={{ display:'flex', alignItems:'center', gap:'4px' }}>
                <input type="number" value={config.prog1 || 30}
                  onChange={e => setConfig({...config, prog1: e.target.value})}
                  style={{ width:'45px', padding:'4px 6px', border:'1px solid #ddd', borderRadius:'4px', fontSize:'12px', textAlign:'right' }} />
                <span style={{ fontSize:'11px', color:'#888' }}>%</span>
              </div>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:'4px' }}>
              <div style={{ fontSize:'11px', color:'#555' }}>중도금 2차 공정율</div>
              <div style={{ display:'flex', alignItems:'center', gap:'4px' }}>
                <input type="number" value={config.prog2 || 60}
                  onChange={e => setConfig({...config, prog2: e.target.value})}
                  style={{ width:'45px', padding:'4px 6px', border:'1px solid #ddd', borderRadius:'4px', fontSize:'12px', textAlign:'right' }} />
                <span style={{ fontSize:'11px', color:'#888' }}>%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── 공공주택/공공시설 타임라인 섹션 ──────────────────────────
function PublicSalesSection({ title, color, totalAmount, cfg, totalMonths, ymList, constructMonth, junMonth, constructPeriod, vatRate }) {
  if (totalAmount <= 0) return null;

  const inc = calcPublicIncome(totalAmount, cfg, constructMonth, constructPeriod, junMonth, totalMonths);
  const { dep, mid, bal, monthly, mid1Month, mid2Month, bal1Month, bal2Month } = inc;

  const tdBase = (v) => ({
    padding:'4px 4px', borderBottom:'1px solid #f0f0f0', fontSize:'11px', textAlign:'right',
    backgroundColor: v>0?'#f0f7ff':'white', color: v>0?'#1a5276':'#ddd', fontWeight: v>0?'bold':'normal'
  });

  const grandDep   = dep.reduce((s,v)=>s+v,0);
  const grandMid   = mid.reduce((s,v)=>s+v,0);
  const grandBal   = bal.reduce((s,v)=>s+v,0);
  const grandTotal = monthly.reduce((s,v)=>s+v,0);

  const vat = vatRate > 0 ? (() => {
    const totalVat = Math.round(grandTotal * vatRate / 100);
    return roundAndFix(monthly.map(v => v * vatRate / 100), totalVat);
  })() : null;
  const grandVat   = vat ? vat.reduce((s,v)=>s+v,0) : 0;
  const finalTotal = vat ? monthly.map((v,i) => v + vat[i]) : monthly;
  const grandFinal = grandTotal + grandVat;

  return (
    <div style={{ marginBottom:'32px' }}>
      <div style={{ overflowX:'auto', borderRadius:'6px', border:'1px solid #e0e0e0' }}>
        <table style={{ borderCollapse:'collapse', fontSize:'11px', minWidth:'100%' }}>
          <thead>
            <PublicTimelineHeader
              ymList={ymList} constructMonth={constructMonth} junMonth={junMonth}
              mid1Month={mid1Month} mid2Month={mid2Month} bal1Month={bal1Month} bal2Month={bal2Month} />
          </thead>
          <tbody>
            {/* 계약금 */}
            <tr>
              <td style={{ padding:'4px 6px', fontWeight:'bold', fontSize:'11px', backgroundColor:'#f0f4f8', whiteSpace:'nowrap' }}>계약금</td>
              {dep.map((v,i) => <td key={i} style={tdBase(v)}>{v>0?formatNumber(Math.round(v)):'-'}</td>)}
              <td style={{ padding:'4px 6px', backgroundColor:'#f0f4f8', borderLeft:'2px solid #888', textAlign:'right', fontWeight:'bold', fontSize:'11px', color }}>
                {formatNumber(Math.round(grandDep))}
              </td>
            </tr>
            {/* 중도금 (1차+2차 한 행) */}
            <tr>
              <td style={{ padding:'4px 6px', fontWeight:'bold', fontSize:'11px', backgroundColor:'#f0f4f8', whiteSpace:'nowrap' }}>
                중도금
                <span style={{ fontSize:'9px', color:'#888', marginLeft:'4px' }}>(1차·2차)</span>
              </td>
              {mid.map((v,i) => <td key={i} style={tdBase(v)}>{v>0?formatNumber(Math.round(v)):'-'}</td>)}
              <td style={{ padding:'4px 6px', backgroundColor:'#f0f4f8', borderLeft:'2px solid #888', textAlign:'right', fontWeight:'bold', fontSize:'11px', color }}>
                {grandMid > 0 ? formatNumber(Math.round(grandMid)) : '-'}
              </td>
            </tr>
            {/* 잔금 (1차+2차 한 행) */}
            <tr>
              <td style={{ padding:'4px 6px', fontWeight:'bold', fontSize:'11px', backgroundColor:'#f0f4f8', whiteSpace:'nowrap' }}>
                잔금
                <span style={{ fontSize:'9px', color:'#888', marginLeft:'4px' }}>(1차·2차)</span>
              </td>
              {bal.map((v,i) => <td key={i} style={tdBase(v)}>{v>0?formatNumber(Math.round(v)):'-'}</td>)}
              <td style={{ padding:'4px 6px', backgroundColor:'#f0f4f8', borderLeft:'2px solid #888', textAlign:'right', fontWeight:'bold', fontSize:'11px', color }}>
                {grandBal > 0 ? formatNumber(Math.round(grandBal)) : '-'}
              </td>
            </tr>
            {/* 합계 */}
            <tr style={{ borderTop:'2px solid #ccc' }}>
              <td style={{ padding:'4px 6px', fontWeight:'bold', fontSize:'11px', backgroundColor:'#e8f4fd', whiteSpace:'nowrap', color }}>합계</td>
              {monthly.map((v,i) => (
                <td key={i} style={{ ...tdBase(v), backgroundColor:v>0?'#d5eaf7':'white', fontWeight:'bold' }}>
                  {v>0?formatNumber(Math.round(v)):'-'}
                </td>
              ))}
              <td style={{ padding:'4px 6px', backgroundColor:'#d5eaf7', borderLeft:'2px solid #888', textAlign:'right', fontWeight:'bold', fontSize:'11px', color }}>
                {formatNumber(Math.round(grandTotal))}
              </td>
            </tr>
            {/* 부가세 (공공시설만) */}
            {vat && (
              <tr>
                <td style={{ padding:'4px 6px', fontWeight:'bold', fontSize:'11px', backgroundColor:'#fef9e7', whiteSpace:'nowrap', color:'#b7770d' }}>
                  부가세({vatRate}%)
                </td>
                {vat.map((v,i) => (
                  <td key={i} style={{ ...tdBase(v), backgroundColor:v>0?'#fef9e7':'white', color:v>0?'#b7770d':'#ddd', fontWeight:'bold' }}>
                    {v>0?formatNumber(v):'-'}
                  </td>
                ))}
                <td style={{ padding:'4px 6px', backgroundColor:'#fef9e7', borderLeft:'2px solid #888', textAlign:'right', fontWeight:'bold', fontSize:'11px', color:'#b7770d' }}>
                  {formatNumber(Math.round(grandVat))}
                </td>
              </tr>
            )}
            {vat && (
              <tr style={{ borderTop:'2px solid #f39c12' }}>
                <td style={{ padding:'4px 6px', fontWeight:'bold', fontSize:'11px', backgroundColor:'#fdebd0', whiteSpace:'nowrap', color:'#b7770d' }}>
                  최종매출합계
                </td>
                {finalTotal.map((v,i) => (
                  <td key={i} style={{ ...tdBase(v), backgroundColor:v>0?'#fdebd0':'white', color:v>0?'#b7770d':'#ddd', fontWeight:'bold' }}>
                    {v>0?formatNumber(Math.round(v)):'-'}
                  </td>
                ))}
                <td style={{ padding:'4px 6px', backgroundColor:'#fdebd0', borderLeft:'2px solid #888', textAlign:'right', fontWeight:'bold', fontSize:'11px', color:'#b7770d' }}>
                  {formatNumber(Math.round(grandFinal))}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div style={{ display:'flex', gap:'12px', marginTop:'10px', flexWrap:'wrap' }}>
        {[
          ['계약금', grandDep],
          ['중도금', grandMid],
          ['잔금', grandBal],
          ['총수입', grandTotal],
          ...(vat ? [['부가세', grandVat], ['최종매출합계', grandFinal]] : []),
        ].map(([lbl, val]) => (
          <div key={lbl} style={{ backgroundColor: lbl==='최종매출합계'?'#fdebd0':lbl==='부가세'?'#fef9e7':'#f8f9fa',
            border:`1px solid ${lbl==='최종매출합계'||lbl==='부가세' ? '#f39c12' : color}`,
            borderRadius:'6px', padding:'8px 14px', fontSize:'12px' }}>
            <span style={{ color:'#666' }}>{lbl}: </span>
            <strong style={{ color: lbl==='최종매출합계'||lbl==='부가세'?'#b7770d':color }}>{formatNumber(Math.round(val))} 천원</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function SalesSection({ title, color, patterns, config, setConfig, isStore, totalMonths, ymList, constructMonth, junMonth, midMonths, balMonths, totalUnits, unitPrice, isBalcony, vatRate, monthly: monthlyFromParent }) {
  const isDirect = config.patternLabel === '직접입력';
  const handlePattern = (label) => {
    const p = patterns.find(x => x.label === label);
    if (p.label === '직접입력') setConfig({...config, patternLabel: label});
    else setConfig({...config, patternLabel: label, m1: p.m1, m2: p.m2, m3: p.m3, endMonth: p.end||0});
  };
  const salesStart = constructMonth + (parseInt(config.salesStartOffset)||0);
  const rates  = calcRates(config, totalMonths, salesStart, 0, 0, isStore);
  const cumul  = rates.reduce((acc, v, i) => { acc.push((acc[i-1]||0)+v); return acc; }, []);

  const incomeResult = isBalcony
    ? calcBalconyIncome(rates, totalUnits, unitPrice, config.depositRate, balMonths, totalMonths)
    : calcIncome(rates, totalUnits, unitPrice, config, midMonths, balMonths, totalMonths);

  const { dep, mid, bal } = incomeResult;
  const total = monthlyFromParent || dep.map((v,i) => v + mid[i] + bal[i]);

  const tdBase = (v) => ({ padding:'4px 4px', borderBottom:'1px solid #f0f0f0', fontSize:'11px', textAlign:'right',
    backgroundColor: v>0?'#f0f7ff':'white', color: v>0?'#1a5276':'#ddd', fontWeight: v>0?'bold':'normal' });

  const grandDep   = dep.reduce((s,v)=>s+v,0);
  const grandMid   = mid.reduce((s,v)=>s+v,0);
  const grandBal   = bal.reduce((s,v)=>s+v,0);
  const grandTotal = total.reduce((s,v)=>s+v,0);
  const vat = vatRate > 0 ? (() => {
    const totalVat = Math.round(grandTotal * vatRate / 100);
    return roundAndFix(total.map(v => v * vatRate / 100), totalVat);
  })() : null;
  const grandVat   = vat ? vat.reduce((s,v)=>s+v,0) : 0;
  const finalTotal = vat ? total.map((v,i) => v + vat[i]) : total;
  const grandFinal = grandTotal + grandVat;

  return (
    <div style={{ marginBottom:'32px' }}>
      <div style={{ fontWeight:'bold', fontSize:'14px', color, marginBottom:'10px' }}>{title}</div>

      {!isBalcony && (
        <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'8px', flexWrap:'wrap' }}>
          <label style={{ fontSize:'13px', fontWeight:'bold' }}>패턴</label>
          <select value={config.patternLabel} onChange={e => handlePattern(e.target.value)}
            style={{ padding:'5px 10px', border:'1px solid #ccc', borderRadius:'4px', fontSize:'13px', minWidth:'200px' }}>
            {patterns.map(p => <option key={p.label} value={p.label}>{p.label}</option>)}
          </select>
        </div>
      )}

      {!isBalcony && isDirect && (
        <div style={{ backgroundColor:'#f8f9fa', border:'1px solid #e0e0e0', borderRadius:'6px', padding:'10px', marginBottom:'8px' }}>
          <div style={{ display:'flex', gap:'12px', flexWrap:'wrap', alignItems:'center' }}>
            {[['1개월','m1'],['2개월','m2'],['3개월','m3']].map(([lbl,key]) => (
              <div key={key} style={{ display:'flex', alignItems:'center', gap:'4px' }}>
                <label style={{ fontSize:'12px', fontWeight:'bold' }}>{lbl}</label>
                <input value={config[key]!==undefined?(config[key]*100).toFixed(0):''}
                  onChange={e => setConfig({...config, [key]:(parseFloat(e.target.value)||0)/100})}
                  style={{ width:'50px', padding:'4px 6px', border:'1px solid #ccc', borderRadius:'4px', fontSize:'12px', textAlign:'right' }} />
                <span style={{ fontSize:'12px' }}>%</span>
              </div>
            ))}
            {!isStore && (
              <div style={{ display:'flex', alignItems:'center', gap:'4px' }}>
                <label style={{ fontSize:'12px', fontWeight:'bold' }}>완판기간</label>
                <input value={config.endMonth||''}
                  onChange={e => setConfig({...config, endMonth:parseInt(e.target.value)||0})}
                  style={{ width:'50px', padding:'4px 6px', border:'1px solid #ccc', borderRadius:'4px', fontSize:'12px', textAlign:'right' }} />
                <span style={{ fontSize:'12px' }}>개월(0=준공시)</span>
              </div>
            )}
          </div>
        </div>
      )}

      {isStore && (
        <div style={{ display:'flex', gap:'16px', marginBottom:'8px', flexWrap:'wrap', alignItems:'center' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'4px' }}>
            <label style={{ fontSize:'13px', fontWeight:'bold' }}>분양시작</label>
            <span style={{ fontSize:'13px' }}>준공</span>
            <input value={config.storeStartBefore||'9'}
              onChange={e => setConfig({...config, storeStartBefore:e.target.value})}
              style={{ width:'45px', padding:'4px 8px', border:'1px solid #ccc', borderRadius:'4px', fontSize:'13px', textAlign:'right' }} />
            <span style={{ fontSize:'13px' }}>개월 전</span>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:'4px' }}>
            <label style={{ fontSize:'13px', fontWeight:'bold' }}>분양완료</label>
            <span style={{ fontSize:'13px' }}>준공 후</span>
            <input value={config.storeEndAfter||'4'}
              onChange={e => setConfig({...config, storeEndAfter:e.target.value})}
              style={{ width:'45px', padding:'4px 8px', border:'1px solid #ccc', borderRadius:'4px', fontSize:'13px', textAlign:'right' }} />
            <span style={{ fontSize:'13px' }}>개월</span>
          </div>
        </div>
      )}

      <div style={{ overflowX:'auto', borderRadius:'6px', border:'1px solid #e0e0e0' }}>
        <table style={{ borderCollapse:'collapse', fontSize:'11px', minWidth:'100%' }}>
          <thead>
            <TimelineHeader ymList={ymList} midMonths={midMonths} balMonths={balMonths}
              constructMonth={constructMonth} junMonth={junMonth} />
          </thead>
          <tbody>
            <tr>
              <td style={{ padding:'4px 6px', fontWeight:'bold', fontSize:'11px', backgroundColor:'#f0f4f8', whiteSpace:'nowrap' }}>월분양율</td>
              {rates.map((v,i) => (
                <td key={i} style={{ ...tdBase(v), backgroundColor:v>0?'#eaf1f8':'white', color:v>0?'#1a5276':'#ddd' }}>
                  {v>0?(v*100).toFixed(1)+'%':'-'}
                </td>
              ))}
              <td style={{ padding:'4px 6px', backgroundColor:'#f0f4f8', borderLeft:'2px solid #888', textAlign:'right', fontWeight:'bold', fontSize:'11px', color:'#1a5276' }}>
                {(rates.reduce((s,v)=>s+v,0)*100).toFixed(1)}%
              </td>
            </tr>
            <tr>
              <td style={{ padding:'4px 6px', fontWeight:'bold', fontSize:'11px', backgroundColor:'#f0f4f8', whiteSpace:'nowrap' }}>누적분양율</td>
              {cumul.map((v,i) => (
                <td key={i} style={{ ...tdBase(v), backgroundColor:v>=1?'#d5f5e3':v>0?'#eaf5f2':'white', color:v>=1?'#1e8449':v>0?'#1a5276':'#ddd' }}>
                  {v>0?(v*100).toFixed(1)+'%':'-'}
                </td>
              ))}
              <td style={{ padding:'4px 6px', backgroundColor:'#f0f4f8', borderLeft:'2px solid #888', textAlign:'right', fontWeight:'bold', fontSize:'11px', color:'#1e8449' }}>
                {((cumul[cumul.length-1]||0)*100).toFixed(1)}%
              </td>
            </tr>
            <tr><td colSpan={totalMonths+2} style={{ height:'3px', backgroundColor:'#e0e0e0' }}></td></tr>
            <tr>
              <td style={{ padding:'4px 6px', fontWeight:'bold', fontSize:'11px', backgroundColor:'#f0f4f8', whiteSpace:'nowrap' }}>계약금</td>
              {dep.map((v,i) => <td key={i} style={tdBase(v)}>{v>0?formatNumber(Math.round(v)):'-'}</td>)}
              <td style={{ padding:'4px 6px', backgroundColor:'#f0f4f8', borderLeft:'2px solid #888', textAlign:'right', fontWeight:'bold', fontSize:'11px', color }}>
                {formatNumber(Math.round(dep.reduce((s,v)=>s+v,0)))}
              </td>
            </tr>
            {!isBalcony && (
              <tr>
                <td style={{ padding:'4px 6px', fontWeight:'bold', fontSize:'11px', backgroundColor:'#f0f4f8', whiteSpace:'nowrap' }}>중도금</td>
                {mid.map((v,i) => <td key={i} style={tdBase(v)}>{v>0?formatNumber(Math.round(v)):'-'}</td>)}
                <td style={{ padding:'4px 6px', backgroundColor:'#f0f4f8', borderLeft:'2px solid #888', textAlign:'right', fontWeight:'bold', fontSize:'11px', color }}>
                  {mid.reduce((s,v)=>s+v,0) > 0 ? formatNumber(Math.round(mid.reduce((s,v)=>s+v,0))) : '-'}
                </td>
              </tr>
            )}
            <tr>
              <td style={{ padding:'4px 6px', fontWeight:'bold', fontSize:'11px', backgroundColor:'#f0f4f8', whiteSpace:'nowrap' }}>잔금</td>
              {bal.map((v,i) => <td key={i} style={tdBase(v)}>{v>0?formatNumber(Math.round(v)):'-'}</td>)}
              <td style={{ padding:'4px 6px', backgroundColor:'#f0f4f8', borderLeft:'2px solid #888', textAlign:'right', fontWeight:'bold', fontSize:'11px', color }}>
                {bal.reduce((s,v)=>s+v,0) > 0 ? formatNumber(Math.round(bal.reduce((s,v)=>s+v,0))) : '-'}
              </td>
            </tr>
            <tr style={{ borderTop:'2px solid #ccc' }}>
              <td style={{ padding:'4px 6px', fontWeight:'bold', fontSize:'11px', backgroundColor:'#e8f4fd', whiteSpace:'nowrap', color }}>합계</td>
              {total.map((v,i) => (
                <td key={i} style={{ ...tdBase(v), backgroundColor:v>0?'#d5eaf7':'white', fontWeight:'bold' }}>
                  {v>0?formatNumber(Math.round(v)):'-'}
                </td>
              ))}
              <td style={{ padding:'4px 6px', backgroundColor:'#d5eaf7', borderLeft:'2px solid #888', textAlign:'right', fontWeight:'bold', fontSize:'11px', color }}>
                {formatNumber(Math.round(total.reduce((s,v)=>s+v,0)))}
              </td>
            </tr>
            {vat && (
              <tr>
                <td style={{ padding:'4px 6px', fontWeight:'bold', fontSize:'11px', backgroundColor:'#fef9e7', whiteSpace:'nowrap', color:'#b7770d' }}>
                  부가세({vatRate}%)
                </td>
                {vat.map((v,i) => (
                  <td key={i} style={{ ...tdBase(v), backgroundColor:v>0?'#fef9e7':'white', color:v>0?'#b7770d':'#ddd', fontWeight:'bold' }}>
                    {v>0?formatNumber(v):'-'}
                  </td>
                ))}
                <td style={{ padding:'4px 6px', backgroundColor:'#fef9e7', borderLeft:'2px solid #888', textAlign:'right', fontWeight:'bold', fontSize:'11px', color:'#b7770d' }}>
                  {formatNumber(Math.round(vat.reduce((s,v)=>s+v,0)))}
                </td>
              </tr>
            )}
            {vat && (
              <tr style={{ borderTop:'2px solid #f39c12' }}>
                <td style={{ padding:'4px 6px', fontWeight:'bold', fontSize:'11px', backgroundColor:'#fdebd0', whiteSpace:'nowrap', color:'#b7770d' }}>
                  최종매출합계
                </td>
                {finalTotal.map((v,i) => (
                  <td key={i} style={{ ...tdBase(v), backgroundColor:v>0?'#fdebd0':'white', color:v>0?'#b7770d':'#ddd', fontWeight:'bold' }}>
                    {v>0?formatNumber(Math.round(v)):'-'}
                  </td>
                ))}
                <td style={{ padding:'4px 6px', backgroundColor:'#fdebd0', borderLeft:'2px solid #888', textAlign:'right', fontWeight:'bold', fontSize:'11px', color:'#b7770d' }}>
                  {formatNumber(Math.round(finalTotal.reduce((s,v)=>s+v,0)))}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div style={{ display:'flex', gap:'12px', marginTop:'10px', flexWrap:'wrap' }}>
        {[
          ['계약금', grandDep],
          ...(!isBalcony ? [['중도금', grandMid]] : []),
          ['잔금', grandBal],
          ['총수입', grandTotal],
          ...(vat ? [['부가세', grandVat], ['최종매출합계', grandFinal]] : []),
        ].map(([lbl, val]) => (
          <div key={lbl} style={{ backgroundColor: lbl==='최종매출합계'?'#fdebd0':lbl==='부가세'?'#fef9e7':'#f8f9fa',
            border:`1px solid ${lbl==='최종매출합계'||lbl==='부가세' ? '#f39c12' : color}`,
            borderRadius:'6px', padding:'8px 14px', fontSize:'12px' }}>
            <span style={{ color:'#666' }}>{lbl}: </span>
            <strong style={{ color: lbl==='최종매출합계'||lbl==='부가세'?'#b7770d':color }}>{formatNumber(Math.round(val))} 천원</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function Sales({ data, incomeData, archData, onChange, onSave, saving, onSalesChange }) {
  const prepPeriod      = parseFloat(parseNumber(archData.prepPeriod))      || 0;
  const constructPeriod = parseFloat(parseNumber(archData.constructPeriod)) || 31;
  const settlePeriod    = parseFloat(parseNumber(archData.settlePeriod))    || 6;
  const totalMonths     = prepPeriod + constructPeriod + settlePeriod;
  const constructMonth  = prepPeriod + 1;
  const junMonth        = prepPeriod + constructPeriod;

  const constructYear     = archData.constructYear  || '2027';
  const constructMonthVal = archData.constructMonth || '1';
  const bizStartYM = addMonths(constructYear, constructMonthVal, -prepPeriod);
  const ymList = Array.from({ length: totalMonths }, (_, i) => {
    const ym = addMonths(bizStartYM.year, bizStartYM.month, i);
    return fmtYM(ym.year, ym.month);
  });

  const aptRows    = incomeData.aptRows    || [];
  const publicRows = incomeData.publicRows || [];
  const offiRows   = incomeData.offiRows   || [];
  const storeRows  = incomeData.storeRows  || [];
  const pubfacRows = incomeData.pubfacRows || [];
  const balcony    = incomeData.balcony    || {};
  const balconyBurden = incomeData.balconyBurden || '분양자 부담';

  // ── 수입탭 각 카테고리 총액 계산 ──
  const calcRowTotal = (row, mode) => {
    const excl  = parseFloat(parseNumber(row.excl_m2)) || 0;
    const wall  = parseFloat(parseNumber(row.wall_m2)) || 0;
    const core  = parseFloat(parseNumber(row.core_m2)) || 0;
    const mgmt  = parseFloat(parseNumber(row.mgmt_m2)) || 0;
    const comm  = parseFloat(parseNumber(row.comm_m2)) || 0;
    const park  = parseFloat(parseNumber(row.park_m2)) || 0;
    const tel   = parseFloat(parseNumber(row.tel_m2))  || 0;
    const elec  = parseFloat(parseNumber(row.elec_m2)) || 0;
    const units = parseFloat(parseNumber(row.units))   || 0;
    const pyP   = parseFloat(parseNumber(row.py_price))|| 0;
    const sup_py  = (excl+wall+core) * 0.3025;
    const cont_py = (excl+wall+core+mgmt+comm+park+tel+elec) * 0.3025;
    return mode === 'apt' ? pyP * sup_py * units : pyP * cont_py * units;
  };

  const aptTotalAmt    = aptRows.reduce((s,r)    => s + calcRowTotal(r, 'apt'),   0);
  const publicTotalAmt = publicRows.reduce((s,r) => s + calcRowTotal(r, 'apt'),   0);
  const offiTotalAmt   = offiRows.reduce((s,r)   => s + calcRowTotal(r, 'offi'),  0);
  const storeTotalAmt  = storeRows.reduce((s,r)  => s + calcRowTotal(r, 'store'), 0);
  const pubfacTotalAmt = pubfacRows.reduce((s,r) => s + calcRowTotal(r, 'store'), 0);

  const getUnitsAndPrice = (rows, mode) => {
    const units = rows.reduce((s, r) => s + (parseFloat(parseNumber(r.units))||0), 0);
    const total = rows.reduce((s, r) => s + calcRowTotal(r, mode), 0);
    return { units, unitPrice: units > 0 ? total/units : 0 };
  };

  // ── 발코니: 일반(공동주택) / 공공(공공주택) 분리 ──
  // 일반 발코니 — aptRows 기준
  const normalBalTotal = balconyBurden === '분양자 부담'
    ? aptRows.reduce((s,r) => s + (parseFloat(parseNumber(r.units))||0)*(parseFloat(parseNumber(balcony[r.type]||'0'))||0), 0)
    : 0;
  const normalBalUnits = aptRows.reduce((s, r) => {
    const price = parseFloat(parseNumber(balcony[r.type]||'0')) || 0;
    return s + (price > 0 ? (parseFloat(parseNumber(r.units))||0) : 0);
  }, 0);
  // 공공 발코니 — publicRows 기준 (자치단체 별도 청구)
  const publicBalTotal = publicRows.reduce((s,r) => s + (parseFloat(parseNumber(r.units))||0)*(parseFloat(parseNumber(balcony[r.type]||'0'))||0), 0);
  const publicBalUnits = publicRows.reduce((s, r) => {
    const price = parseFloat(parseNumber(balcony[r.type]||'0')) || 0;
    return s + (price > 0 ? (parseFloat(parseNumber(r.units))||0) : 0);
  }, 0);
  // 하위 호환용 (기존 코드에서 balTotal/balUnits 참조하는 곳 대응)
  const balTotal = normalBalTotal;
  const balUnits = normalBalUnits;

  const apt   = getUnitsAndPrice(aptRows,   'apt');
  const offi  = getUnitsAndPrice(offiRows,  'offi');
  const store = getUnitsAndPrice(storeRows, 'store');

  // ── 기본 config ──
  const defApt     = { patternLabel:'3개월 40% 15개월 완판', m1:0.20, m2:0.10, m3:0.10, endMonth:15, depositRate:10, midCount:6, midFree:true, midBeforeEnd:3, midRate:60, balanceCount:3, salesStartOffset:0 };
  const defBalcony = { patternLabel:'3개월 40% 15개월 완판', m1:0.20, m2:0.10, m3:0.10, endMonth:15, depositRate:10, midFree:true, midBeforeEnd:3, balanceRate:30, balanceCount:3, salesStartOffset:0 };
  const defOffi    = { patternLabel:'3개월 40% 18개월 완판', m1:0.20, m2:0.10, m3:0.10, endMonth:18, depositRate:10, midCount:6, midFree:true, midBeforeEnd:3, midRate:60, balanceCount:3, salesStartOffset:0 };
  const defStore   = { patternLabel:'3개월 40%', m1:0.20, m2:0.10, m3:0.10, storeStartBefore:'9', storeEndAfter:'4', depositRate:10, midCount:0, midFree:false, midBeforeEnd:3, midRate:0, balanceCount:3 };
  // 공공주택/공공시설 기본 config
  const defPublic  = { depositRate:10, mid1Rate:20, mid2Rate:20, bal1Rate:25, prog1:30, prog2:60 };

  const aptCfg     = { ...defApt,    ...(data.aptConfig     || {}) };
  const balconyCfg = { ...defBalcony,...(data.balconyConfig  || {}) };
  const offiCfg    = { ...defOffi,   ...(data.offiConfig    || {}) };
  const storeCfg   = { ...defStore,  ...(data.storeConfig   || {}) };
  const publicCfg    = { ...defPublic, ...(data.publicConfig    || {}) };
  const pubfacCfg    = { ...defPublic, ...(data.pubfacConfig    || {}) };
  const publicBalCfg = { ...defPublic, ...(data.publicBalConfig || {}) };

  const setAptCfg      = v => onChange({ ...data, aptConfig:       v });
  const setBalconyCfg  = v => onChange({ ...data, balconyConfig:   v });
  const setOffiCfg     = v => onChange({ ...data, offiConfig:      v });
  const setStoreCfg    = v => onChange({ ...data, storeConfig:     v });
  const setPublicCfg   = v => onChange({ ...data, publicConfig:    v });
  const setPubfacCfg   = v => onChange({ ...data, pubfacConfig:    v });
  const setPublicBalCfg= v => onChange({ ...data, publicBalConfig: v });

  const [openSections, setOpenSections] = useState({ apt:true, public:true, balcony:true, publicBal:true, offi:true, store:true, pubfac:true });
  const [showCrossCheck, setShowCrossCheck] = useState(false);
  const toggleSection = (key) => setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));

  // ── 일반 분양 카테고리 수입 계산 ──
  const calcCatIncome = (cfg, rows, mode, midMs, balMs, sStart) => {
    const { units, unitPrice } = getUnitsAndPrice(rows, mode);
    if (units === 0) return {
      dep:0, mid:0, bal:0, total:0,
      monthly:    Array(totalMonths).fill(0),
      depMonthly: Array(totalMonths).fill(0),
      midMonthly: Array(totalMonths).fill(0),
      balMonthly: Array(totalMonths).fill(0),
    };
    const rates = calcRates(cfg, totalMonths, sStart, 0, 0, mode==='store');
    const inc   = calcIncome(rates, units, unitPrice, cfg, midMs, balMs, totalMonths);
    const depMonthly = inc.dep;
    const midMonthly = inc.mid;
    const balMonthly = inc.bal;
    const dep   = depMonthly.reduce((s,v)=>s+v,0);
    const mid   = midMonthly.reduce((s,v)=>s+v,0);
    const bal   = balMonthly.reduce((s,v)=>s+v,0);
    const total = dep + mid + bal;
    const monthly = depMonthly.map((v,i) => v + midMonthly[i] + balMonthly[i]);
    return { dep, mid, bal, total, monthly, depMonthly, midMonthly, balMonthly };
  };

  const aptSalesStart  = constructMonth + (parseInt(aptCfg.salesStartOffset)  || 0);
  const offiSalesStart = constructMonth + (parseInt(offiCfg.salesStartOffset) || 0);

  const aptMid   = calcMidMonths(aptSalesStart,  constructPeriod, prepPeriod, aptCfg.midCount,   aptCfg.midBeforeEnd);
  const offiMid  = calcMidMonths(offiSalesStart, constructPeriod, prepPeriod, offiCfg.midCount,  offiCfg.midBeforeEnd);
  const storeMid = calcMidMonths(constructMonth, constructPeriod, prepPeriod, storeCfg.midCount, storeCfg.midBeforeEnd);
  const aptBal   = calcBalMonths(prepPeriod, constructPeriod, aptCfg.balanceCount);
  const balconyMid = calcMidMonths(constructMonth + (parseInt(balconyCfg.salesStartOffset)||0), constructPeriod, prepPeriod, balconyCfg.midCount, balconyCfg.midBeforeEnd);
  const balconyBal = calcBalMonths(prepPeriod, constructPeriod, balconyCfg.balanceCount);
  const offiBal  = calcBalMonths(prepPeriod, constructPeriod, offiCfg.balanceCount);
  const storeBal = calcBalMonths(prepPeriod, constructPeriod, storeCfg.balanceCount);

  const aptInc   = calcCatIncome(aptCfg,   aptRows,   'apt',   aptMid,   aptBal,   aptSalesStart);
  const offiInc  = calcCatIncome(offiCfg,  offiRows,  'offi',  offiMid,  offiBal,  offiSalesStart);
  const storeInc = calcCatIncome(storeCfg, storeRows, 'store', storeMid, storeBal, constructMonth);

  // ── 공공주택/공공시설 수입 계산 ──
  const publicInc = calcPublicIncome(Math.round(publicTotalAmt), publicCfg, constructMonth, constructPeriod, junMonth, totalMonths);
  const pubfacInc = calcPublicIncome(Math.round(pubfacTotalAmt), pubfacCfg, constructMonth, constructPeriod, junMonth, totalMonths);

  // ── 발코니(일반) — aptRows / 발코니(공공) — publicRows ──
  const balInc = (normalBalUnits > 0 && balconyBurden === '분양자 부담')
    ? (() => {
        const rates = calcRates(balconyCfg, totalMonths, constructMonth+(parseInt(balconyCfg.salesStartOffset)||0), 0, 0, false);
        const inc   = calcBalconyIncome(rates, normalBalUnits, normalBalUnits>0?normalBalTotal/normalBalUnits:0, balconyCfg.depositRate, balconyBal, totalMonths);
        const depMonthly = inc.dep;
        const balMonthly = inc.bal;
        const dep   = depMonthly.reduce((s,v)=>s+v,0);
        const bal2  = balMonthly.reduce((s,v)=>s+v,0);
        const monthly = depMonthly.map((v,i) => v + (inc.mid[i]||0) + balMonthly[i]);
        return { dep, mid:0, bal:bal2, total:dep+bal2, monthly, depMonthly, midMonthly: Array(totalMonths).fill(0), balMonthly };
      })()
    : null;
  // 공공 발코니 — 자치단체 별도청구, 공공주택과 동일 납부구조
  const publicBalInc = calcPublicIncome(Math.round(publicBalTotal), publicBalCfg, constructMonth, constructPeriod, junMonth, totalMonths);


  // ── 공동주택 부가세 (85㎡ 초과분) ──
  const aptOverSalesTotal = aptRows.reduce((s, r) => {
    const excl = parseFloat(parseNumber(r.excl_m2))||0;
    if (excl <= 85) return s;
    const wall = parseFloat(parseNumber(r.wall_m2))||0;
    const core = parseFloat(parseNumber(r.core_m2))||0;
    const units = parseFloat(parseNumber(r.units))||0;
    const pyP = parseFloat(parseNumber(r.py_price))||0;
    return s + pyP * (excl+wall+core) * 0.3025 * units;
  }, 0);
  const aptVatRatio = aptInc.total > 0 ? aptOverSalesTotal / aptInc.total : 0;

  // ── VAT 월별 계산 ──
  const aptVatTotal   = Math.round(aptInc.total * aptVatRatio * 0.1);
  const offiVatTotal  = Math.round(offiInc.total * 0.1);
  const storeVatTotal = Math.round(storeInc.total * 0.1);
  const pubfacVatTotal = Math.round(pubfacInc.total * 0.1);

  const aptVat    = roundAndFix(aptInc.monthly.map(v => v * aptVatRatio * 0.1),  aptVatTotal);
  const offiVat   = roundAndFix(offiInc.monthly.map(v => v * 0.1),               offiVatTotal);
  const storeVat  = roundAndFix(storeInc.monthly.map(v => v * 0.1),              storeVatTotal);
  const pubfacVat = roundAndFix(pubfacInc.monthly.map(v => v * 0.1),             pubfacVatTotal);

  const allMonthly = ymList.map((_,i) =>
    (aptInc.monthly[i]||0) + (publicInc.monthly[i]||0) + (balInc?.monthly[i]||0) +
    (offiInc.monthly[i]||0) + (storeInc.monthly[i]||0) + (pubfacInc.monthly[i]||0)
  );
  const allVat = aptVat.map((v,i) => v + offiVat[i] + storeVat[i] + pubfacVat[i]);
  const allFinal = allMonthly.map((v,i) => v + allVat[i]);

  const sumAptVat    = aptVat.reduce((s,v)=>s+v,0);
  const sumOffiVat   = offiVat.reduce((s,v)=>s+v,0);
  const sumStoreVat  = storeVat.reduce((s,v)=>s+v,0);
  const sumPubfacVat = pubfacVat.reduce((s,v)=>s+v,0);

  // ── useEffect: vatByMonth 등 자동 저장 ──
  useEffect(() => {
    if (!onChange) return;
    const vatByMonth = {};
    ymList.forEach((ym, i) => {
      if (allVat[i] > 0) vatByMonth[ym] = allVat[i];
    });
    const newData = {
      ...data,
      ...(data?.allocPublic   ? { allocPublic:   data.allocPublic   } : {}),
      ...(data?.allocOver     ? { allocOver:     data.allocOver     } : {}),
      ...(data?.allocUnder    ? { allocUnder:    data.allocUnder    } : {}),
      ...(data?.allocBaseRate ? { allocBaseRate: data.allocBaseRate } : {}),
      ...(data?.allocScenario ? { allocScenario: data.allocScenario } : {}),
      ...(data?.publicConfig    ? { publicConfig:    data.publicConfig    } : {}),
      ...(data?.pubfacConfig    ? { pubfacConfig:    data.pubfacConfig    } : {}),
      ...(data?.publicBalConfig ? { publicBalConfig: data.publicBalConfig } : {}),
      vatByMonth,
      salesSumApt:      aptInc.total,
      salesSumPublic:   publicInc.total,
      salesSumBal:      balInc?.total || 0,
      salesSumPublicBal: publicBalInc.total,
      salesSumOffi:     offiInc.total,
      salesSumStore:    storeInc.total,
      salesSumPubfac:   pubfacInc.total,
      salesSumAptVat:   Math.round(aptOverSalesTotal * 0.1),
      salesSumOffiVat:  Math.round(offiInc.total * 0.1),
      salesSumStoreVat: Math.round(storeInc.total * 0.1),
      salesSumPubfacVat: Math.round(pubfacInc.total * 0.1),
      timelineApt:      aptInc.monthly.reduce((s,v)=>s+v,0),
      timelinePublic:   publicInc.monthly.reduce((s,v)=>s+v,0),
      timelinePublicBal: publicBalInc.monthly.reduce((s,v)=>s+v,0),
      timelineBal:      (balInc?.monthly||[]).reduce((s,v)=>s+v,0),
      timelineOffi:     offiInc.monthly.reduce((s,v)=>s+v,0),
      timelineStore:    storeInc.monthly.reduce((s,v)=>s+v,0),
      timelinePubfac:   pubfacInc.monthly.reduce((s,v)=>s+v,0),
      timelineAptVat:   Math.round(aptOverSalesTotal * 0.1),
      timelineOffiVat:  Math.round(offiInc.total * 0.1),
      timelineStoreVat: Math.round(storeInc.total * 0.1),
      timelinePubfacVat: Math.round(pubfacInc.total * 0.1),
      ymList,
      junMonth:          Math.round(junMonth),
      constructMonth:    Math.round(constructMonth),
      aptMonthly:        aptInc.monthly,
      publicMonthly:     publicInc.monthly,
      publicBalMonthly:  publicBalInc.monthly,
      balconyMonthly:    balInc?.monthly  || [],
      offiMonthly2:      offiInc.monthly,
      storeMonthly:      storeInc.monthly,
      pubfacMonthly:     pubfacInc.monthly,
      aptDepMonthly:     aptInc.depMonthly,
      aptMidMonthly:     aptInc.midMonthly,
      aptBalMonthly:     aptInc.balMonthly,
      publicDepMonthly:  publicInc.dep,
      publicMidMonthly:  publicInc.mid,
      publicBalMonthly:  publicInc.bal,
      publicBalDepMonthly: publicBalInc.dep,
      publicBalMidMonthly: publicBalInc.mid,
      publicBalBalMonthly: publicBalInc.bal,
      pubfacDepMonthly:  pubfacInc.dep,
      pubfacMidMonthly:  pubfacInc.mid,
      pubfacBalMonthly:  pubfacInc.bal,
      balDepMonthly:     balInc?.depMonthly  || [],
      balBalMonthly:     balInc?.balMonthly  || [],
      offiDepMonthly:    offiInc.depMonthly,
      offiMidMonthly:    offiInc.midMonthly,
      offiBalMonthly:    offiInc.balMonthly,
      storeDepMonthly:   storeInc.depMonthly,
      storeMidMonthly:   storeInc.midMonthly,
      storeBalMonthly:   storeInc.balMonthly,
      aptVatMonthly:     aptVat,
      offiVatMonthly:    offiVat,
      storeVatMonthly:   storeVat,
      pubfacVatMonthly:  pubfacVat,
      aptRateMonthly:    calcRates(aptCfg,   totalMonths, aptSalesStart,  constructPeriod, prepPeriod, false),
      offiRateMonthly:   calcRates(offiCfg,  totalMonths, offiSalesStart, constructPeriod, prepPeriod, false),
      storeRateMonthly:  calcRates(storeCfg, totalMonths, constructMonth, constructPeriod, prepPeriod, true),
      aptVatRatioSaved:  aptVatRatio,
      aptCfgSaved:       { depositRate: aptCfg.depositRate, midCount: aptCfg.midCount, midRate: aptCfg.midRate ?? 60, balanceCount: aptCfg.balanceCount },
      balConyCfgSaved:   { depositRate: balconyCfg.depositRate, balanceCount: balconyCfg.balanceCount },
      offiCfgSaved:      { depositRate: offiCfg.depositRate, midCount: offiCfg.midCount, midRate: offiCfg.midRate ?? 60, balanceCount: offiCfg.balanceCount },
      storeCfgSaved:     { depositRate: storeCfg.depositRate, midCount: storeCfg.midCount, midRate: storeCfg.midRate ?? 0, balanceCount: storeCfg.balanceCount },
      // 공공주택/공공시설은 금융비 제외 표시용
      publicCfgSaved:    { depositRate: publicCfg.depositRate, mid1Rate: publicCfg.mid1Rate, mid2Rate: publicCfg.mid2Rate, bal1Rate: publicCfg.bal1Rate },
      pubfacCfgSaved:    { depositRate: pubfacCfg.depositRate, mid1Rate: pubfacCfg.mid1Rate, mid2Rate: pubfacCfg.mid2Rate, bal1Rate: pubfacCfg.bal1Rate },
      aptDepMonthlyVat:  roundAndFix(aptInc.depMonthly.map(v => v * (1 + aptVatRatio * 0.1)), Math.round(aptInc.dep * (1 + aptVatRatio * 0.1))),
      aptMidMonthlyVat:  roundAndFix(aptInc.midMonthly.map(v => v * (1 + aptVatRatio * 0.1)), Math.round(aptInc.mid * (1 + aptVatRatio * 0.1))),
      aptBalMonthlyVat:  roundAndFix(aptInc.balMonthly.map(v => v * (1 + aptVatRatio * 0.1)), Math.round(aptInc.bal * (1 + aptVatRatio * 0.1))),
      balDepMonthlyVat:  balInc?.depMonthly || [],
      balBalMonthlyVat:  balInc?.balMonthly || [],
      offiDepMonthlyVat: roundAndFix(offiInc.depMonthly.map(v => v * 1.1), Math.round(offiInc.dep * 1.1)),
      offiMidMonthlyVat: roundAndFix(offiInc.midMonthly.map(v => v * 1.1), Math.round(offiInc.mid * 1.1)),
      offiBalMonthlyVat: roundAndFix(offiInc.balMonthly.map(v => v * 1.1), Math.round(offiInc.bal * 1.1)),
      storeDepMonthlyVat:  roundAndFix(storeInc.depMonthly.map(v => v * 1.1), Math.round(storeInc.dep * 1.1)),
      storeMidMonthlyVat:  roundAndFix(storeInc.midMonthly.map(v => v * 1.1), Math.round(storeInc.mid * 1.1)),
      storeBalMonthlyVat:  roundAndFix(storeInc.balMonthly.map(v => v * 1.1), Math.round(storeInc.bal * 1.1)),
      storeMonthlyVat:     roundAndFix(storeInc.monthly.map(v => v * 1.1),    Math.round(storeInc.total * 1.1)),
      pubfacDepMonthlyVat: roundAndFix(pubfacInc.dep.map(v => v * 1.1), Math.round(pubfacInc.depTotal * 1.1)),
      pubfacMidMonthlyVat: roundAndFix(pubfacInc.mid.map(v => v * 1.1), Math.round(pubfacInc.midTotal * 1.1)),
      pubfacBalMonthlyVat: roundAndFix(pubfacInc.bal.map(v => v * 1.1), Math.round(pubfacInc.balTotal * 1.1)),
      pubfacMonthlyVat:    roundAndFix(pubfacInc.monthly.map(v => v * 1.1), Math.round(pubfacInc.total * 1.1)),
    };
    const keys = ['vatByMonth','salesSumApt','salesSumPublic','salesSumOffi','salesSumStore','salesSumPubfac',
      'timelineApt','timelinePublic','timelineOffi','timelineStore','timelinePubfac',
      'aptDepMonthly','aptMidMonthly','aptBalMonthly',
      'publicDepMonthly','publicMidMonthly','publicBalMonthly',
      'pubfacDepMonthly','pubfacMidMonthly','pubfacBalMonthly',
      'offiDepMonthly','offiMidMonthly','offiBalMonthly',
      'storeDepMonthly','storeMidMonthly','storeBalMonthly',
      'aptVatMonthly','offiVatMonthly','storeVatMonthly','pubfacVatMonthly'];
    const isFirstSave = !data?.storeDepMonthly && !data?.aptVatMonthly;
    const changed = isFirstSave || keys.some(k => JSON.stringify(data?.[k]) !== JSON.stringify(newData[k]));
    console.log('isFirstSave:', isFirstSave, 'changed:', changed, 'allocPublic:', data?.allocPublic);
    if (changed) onChange(newData);
  }, [JSON.stringify(allVat), JSON.stringify(ymList), // eslint-disable-line
      aptInc.total, publicInc.total, offiInc.total, storeInc.total, pubfacInc.total,
      JSON.stringify(aptInc.depMonthly), JSON.stringify(aptInc.midMonthly), JSON.stringify(aptInc.balMonthly),
      JSON.stringify(publicInc.dep), JSON.stringify(publicInc.mid), JSON.stringify(publicInc.bal),
      JSON.stringify(offiInc.depMonthly), JSON.stringify(offiInc.midMonthly), JSON.stringify(offiInc.balMonthly),
      JSON.stringify(storeInc.monthly), JSON.stringify(storeInc.depMonthly),
      JSON.stringify(pubfacInc.dep), JSON.stringify(pubfacInc.mid), JSON.stringify(pubfacInc.bal)]);

  // ── 수입 요약 catRows (순서: 공동주택→공공주택→발코니(일반)→발코니(공공)→오피스텔→근린상가→공공시설) ──
  const catRows = [
    { label:'공동주택',  color:'#3d6a99', dep:aptInc.dep,       mid:aptInc.mid,      bal:aptInc.bal,      total:aptInc.total,
      vat: Math.round(aptOverSalesTotal * 0.1),
      vatNote: aptOverSalesTotal > 0 ? `85㎡초과 ${formatNumber(Math.round(aptOverSalesTotal))}천` : '없음',
      monthly: aptInc.monthly },
    { label:'공공주택',  color:'#1a7a4a', dep:publicInc.depTotal, mid:publicInc.midTotal, bal:publicInc.balTotal, total:publicInc.total, vat:0, vatNote:'면세', monthly: publicInc.monthly },
    ...(balInc ? [{ label:'발코니(일반)', color:'#7d6b9e', dep:balInc.dep, mid:0, bal:balInc.bal, total:balInc.total, vat:0, vatNote:'면세', monthly: balInc.monthly }] : []),
    ...(publicBalInc.total > 0 ? [{ label:'발코니(공공)', color:'#6a5a8a', dep:publicBalInc.depTotal, mid:publicBalInc.midTotal, bal:publicBalInc.balTotal, total:publicBalInc.total, vat:0, vatNote:'면세', monthly: publicBalInc.monthly }] : []),
    { label:'오피스텔',  color:'#347a6a', dep:offiInc.dep,       mid:offiInc.mid,     bal:offiInc.bal,     total:offiInc.total,
      vat: Math.round(offiInc.total*0.1), vatNote:'10%', monthly: offiInc.monthly },
    { label:'근린상가',  color:'#965228', dep:storeInc.dep,      mid:0,               bal:storeInc.bal,    total:storeInc.total,
      vat: Math.round(storeInc.total*0.1), vatNote:'10%', monthly: storeInc.monthly },
    { label:'공공시설',  color:'#9a6309', dep:pubfacInc.depTotal, mid:pubfacInc.midTotal, bal:pubfacInc.balTotal, total:pubfacInc.total,
      vat: Math.round(pubfacInc.total*0.1), vatNote:'10%', monthly: pubfacInc.monthly },
  ].filter(r => r.total > 0);

  const sumDep   = catRows.reduce((s,r)=>s+r.dep,0);
  const sumMid   = catRows.reduce((s,r)=>s+r.mid,0);
  const sumBal   = catRows.reduce((s,r)=>s+r.bal,0);
  const sumTotal = catRows.reduce((s,r)=>s+r.total,0);
  const sumVat   = catRows.reduce((s,r)=>s+r.vat,0);
  const sumFinal = sumTotal + sumVat;

  // ── 크로스체크 ──
  const fmtCC = (v) => Math.round(v).toLocaleString('ko-KR');
  const chk = (a, b, c) => Math.abs(a-b)<2 && Math.abs(b-c)<2 && Math.abs(a-c)<2 ? '✅' : '❌';

  const incomeAptTotal    = aptTotalAmt;
  const incomePublicTotal = publicTotalAmt;
  const incomeOffiTotal   = offiTotalAmt;
  const incomeStoreTotal  = storeTotalAmt;
  const incomePubfacTotal = pubfacTotalAmt;
  const incomeBalTotal      = normalBalTotal;   // 일반 발코니
  const incomePublicBalTotal = publicBalTotal;  // 공공 발코니

  return (
    <div>
      {/* 크로스체크 팝업 */}
      {showCrossCheck && (
        <div style={{ position:'fixed', top:0, left:0, width:'100vw', height:'100vh',
          backgroundColor:'rgba(0,0,0,0.5)', zIndex:3000, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <div style={{ backgroundColor:'white', borderRadius:'10px', width:'96%', maxWidth:'900px',
            maxHeight:'90vh', overflowY:'auto', padding:'24px' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px' }}>
              <h3 style={{ margin:0, color:'#8e44ad' }}>🔍 분양율 크로스체크</h3>
              <button onClick={()=>setShowCrossCheck(false)}
                style={{ padding:'6px 14px', border:'1px solid #ddd', borderRadius:'6px', cursor:'pointer' }}>✕ 닫기</button>
            </div>
            <div style={{ fontSize:'11px', color:'#888', marginBottom:'16px' }}>
              ※ 수입탭(원천) ↔ 분양율 수입요약 ↔ 월별 타임라인 합계 — 세 값이 모두 일치해야 ✅ (허용오차 ±2천원)
            </div>
            <table style={{ borderCollapse:'collapse', width:'100%', fontSize:'12px' }}>
              <thead>
                <tr style={{ backgroundColor:'#2c3e50', color:'white' }}>
                  {['카테고리','수입탭 원천','분양율 수입요약','월별타임라인 합계','일치'].map(h=>(
                    <th key={h} style={{ padding:'8px 12px', textAlign: h==='카테고리'?'left':'right', fontWeight:'bold' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { label:'공동주택 공급',  a:incomeAptTotal,    b:aptInc.total,        c:aptInc.monthly.reduce((s,v)=>s+v,0) },
                  { label:'공동주택 VAT',   a:Math.round(aptOverSalesTotal*0.1), b:Math.round(aptOverSalesTotal*0.1), c:Math.round(aptOverSalesTotal*0.1) },
                  ...(incomePublicTotal>0 ? [{ label:'공공주택',    a:incomePublicTotal, b:publicInc.total,     c:publicInc.monthly.reduce((s,v)=>s+v,0) }] : []),
                  ...(incomeBalTotal>0      ? [{ label:'발코니(일반)',  a:incomeBalTotal,       b:balInc?.total||0,       c:(balInc?.monthly||[]).reduce((s,v)=>s+v,0) }] : []),
                  ...(incomePublicBalTotal>0 ? [{ label:'발코니(공공)',  a:incomePublicBalTotal, b:publicBalInc.total,     c:publicBalInc.monthly.reduce((s,v)=>s+v,0) }] : []),
                  { label:'오피스텔 공급',  a:incomeOffiTotal,   b:offiInc.total,       c:offiInc.monthly.reduce((s,v)=>s+v,0) },
                  { label:'오피스텔 VAT',   a:Math.round(incomeOffiTotal*0.1), b:Math.round(offiInc.total*0.1), c:Math.round(offiInc.total*0.1) },
                  { label:'근린상가 공급',  a:incomeStoreTotal,  b:storeInc.total,      c:storeInc.monthly.reduce((s,v)=>s+v,0) },
                  { label:'근린상가 VAT',   a:Math.round(incomeStoreTotal*0.1), b:Math.round(storeInc.total*0.1), c:Math.round(storeInc.total*0.1) },
                  ...(incomePubfacTotal>0 ? [{ label:'공공시설 공급', a:incomePubfacTotal, b:pubfacInc.total,   c:pubfacInc.monthly.reduce((s,v)=>s+v,0) }] : []),
                  ...(incomePubfacTotal>0 ? [{ label:'공공시설 VAT',  a:Math.round(incomePubfacTotal*0.1), b:Math.round(pubfacInc.total*0.1), c:Math.round(pubfacInc.total*0.1) }] : []),
                ].map((row, i) => {
                  const ok = chk(row.a, row.b, row.c);
                  return (
                    <tr key={row.label} style={{ backgroundColor: ok==='✅'?(i%2===0?'white':'#f8f9fa'):'#fdecea' }}>
                      <td style={{ padding:'7px 12px', fontWeight:'bold', color:'#2c3e50' }}>{row.label}</td>
                      <td style={{ padding:'7px 12px', textAlign:'right', color:'#2980b9' }}>{fmtCC(row.a)}</td>
                      <td style={{ padding:'7px 12px', textAlign:'right', color:'#27ae60' }}>{fmtCC(row.b)}</td>
                      <td style={{ padding:'7px 12px', textAlign:'right', color:'#8e44ad' }}>{fmtCC(row.c)}</td>
                      <td style={{ padding:'7px 12px', textAlign:'center', fontSize:'16px' }}>{ok}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'16px' }}>
        <div style={{ display:'flex', alignItems:'baseline', gap:'12px' }}>
          <h3 style={{ margin:0 }}>분양율</h3>
          <span style={{ fontSize:'10px', color:'#aaa', fontStyle:'italic' }}>
            ※ 소수점 처리: 총액 먼저 확정 → 월별 배분 → 마지막 월 오차 보정
          </span>
        </div>
        <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
          <span style={{ fontSize:'12px', color:'#888' }}>
            {totalMonths}개월 ({ymList[0]} ~ {ymList[ymList.length-1]})
          </span>
          <button onClick={() => setShowCrossCheck(true)}
            style={{ padding:'6px 14px', backgroundColor:'#8e44ad', color:'white', border:'none', borderRadius:'4px', cursor:'pointer', fontSize:'12px' }}>
            🔍 크로스체크
          </button>
          <button onClick={onSave}
            style={{ padding:'6px 16px', backgroundColor:'#27ae60', color:'white', border:'none', borderRadius:'4px', cursor:'pointer' }}>
            {saving ? '저장 중...' : 'Firestore 저장'}
          </button>
        </div>
      </div>

      {/* 사업 기간 요약 */}
      <div style={{ backgroundColor:'#2c3e50', color:'white', borderRadius:'8px', padding:'12px 20px', marginBottom:'20px', display:'flex', gap:'20px', flexWrap:'wrap', fontSize:'13px' }}>
        <div><span style={{ opacity:0.7 }}>사업준비 </span><strong>{prepPeriod}개월</strong></div>
        <div><span style={{ opacity:0.7 }}>착공 </span><strong style={{ color:'#e67e22' }}>{ymList[constructMonth-1]||'-'}</strong><span style={{ opacity:0.7 }}> ({constructMonth}개월차)</span></div>
        <div><span style={{ opacity:0.7 }}>공사기간 </span><strong>{constructPeriod}개월</strong></div>
        <div><span style={{ opacity:0.7 }}>준공 </span><strong style={{ color:'#a29bfe' }}>{ymList[junMonth-1]||'-'}</strong><span style={{ opacity:0.7 }}> ({junMonth}개월차)</span></div>
        <div><span style={{ opacity:0.7 }}>사업정산 </span><strong>{settlePeriod}개월</strong></div>
        <div><span style={{ opacity:0.7 }}>종료 </span><strong>{ymList[totalMonths-1]||'-'}</strong></div>
      </div>

      {/* ── 수입 요약 ── */}
      <div style={{ marginBottom:'20px' }}>
        <div style={{ fontWeight:'bold', fontSize:'14px', color:'#2c3e50', marginBottom:'10px' }}>수입 요약</div>
        <table style={{ borderCollapse:'collapse', width:'100%', fontSize:'13px' }}>
          <thead>
            <tr style={{ backgroundColor:'#34495e', color:'white' }}>
              {['카테고리','계약금','중도금','잔금','공급금액','부가세','전체매출합계'].map(h=>(
                <th key={h} style={{ padding:'8px 12px', textAlign: h==='카테고리'?'left':'right', fontWeight:'bold' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {catRows.map((r,i) => (
              <tr key={r.label} style={{ backgroundColor: i%2===0?'white':'#f8f9fa' }}>
                <td style={{ padding:'7px 12px', fontWeight:'bold', color:r.color }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
                    <span style={{ width:'8px', height:'8px', borderRadius:'50%', backgroundColor:r.color, display:'inline-block', flexShrink:0 }}></span>
                    {r.label}
                  </div>
                </td>
                <td style={{ padding:'7px 12px', textAlign:'right' }}>{formatNumber(Math.round(r.dep))}</td>
                <td style={{ padding:'7px 12px', textAlign:'right' }}>{r.mid>0?formatNumber(Math.round(r.mid)):'—'}</td>
                <td style={{ padding:'7px 12px', textAlign:'right' }}>{formatNumber(Math.round(r.bal))}</td>
                <td style={{ padding:'7px 12px', textAlign:'right', fontWeight:'bold', color:'#2c3e50' }}>{formatNumber(Math.round(r.dep+r.mid+r.bal))}</td>
                <td style={{ padding:'7px 12px', textAlign:'right', color: r.vat>0?'#b7770d':'#aaa' }}>
                  {r.vat>0 ? (
                    <div>
                      <div style={{ fontWeight:'bold' }}>{formatNumber(r.vat)}</div>
                      <div style={{ fontSize:'10px' }}>{r.vatNote}</div>
                    </div>
                  ) : <span style={{ fontSize:'11px' }}>—</span>}
                </td>
                <td style={{ padding:'7px 12px', textAlign:'right', fontWeight:'bold', color:r.color }}>{formatNumber(Math.round(r.total+r.vat))}</td>
              </tr>
            ))}
            <tr style={{ backgroundColor:'#2c3e50', color:'white' }}>
              <td style={{ padding:'8px 12px', fontWeight:'bold' }}>합계</td>
              <td style={{ padding:'8px 12px', textAlign:'right', fontWeight:'bold' }}>{formatNumber(Math.round(sumDep))}</td>
              <td style={{ padding:'8px 12px', textAlign:'right', fontWeight:'bold' }}>{formatNumber(Math.round(sumMid))}</td>
              <td style={{ padding:'8px 12px', textAlign:'right', fontWeight:'bold' }}>{formatNumber(Math.round(sumBal))}</td>
              <td style={{ padding:'8px 12px', textAlign:'right', fontWeight:'bold', color:'#f1c40f' }}>{formatNumber(Math.round(sumDep+sumMid+sumBal))}</td>
              <td style={{ padding:'8px 12px', textAlign:'right', fontWeight:'bold', color:'#f39c12' }}>{formatNumber(Math.round(sumVat))}</td>
              <td style={{ padding:'8px 12px', textAlign:'right', fontWeight:'bold', color:'#f1c40f', fontSize:'14px' }}>{formatNumber(Math.round(sumFinal))}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ── 월별 수입 타임라인 ── */}
      <div style={{ marginBottom:'28px' }}>
        <div style={{ fontWeight:'bold', fontSize:'14px', color:'#2c3e50', marginBottom:'10px' }}>월별 수입 타임라인</div>
        <div style={{ overflowX:'auto', borderRadius:'6px', border:'1px solid #e0e0e0' }}>
          <table style={{ borderCollapse:'collapse', fontSize:'11px', minWidth:'100%' }}>
            <thead>
              <tr style={{ backgroundColor:'#34495e', color:'white' }}>
                <th style={{ padding:'5px 8px', textAlign:'left', minWidth:'80px', position:'sticky', left:0, backgroundColor:'#34495e', zIndex:2 }}>카테고리</th>
                {ymList.map((ym,i) => {
                  const isC = (i+1) === constructMonth;
                  const isJ = (i+1) === junMonth;
                  const rel = (i+1) - constructMonth;
                  return (
                    <th key={i} style={{ padding:'4px 4px', fontSize:'10px', textAlign:'center', minWidth:'56px',
                      backgroundColor: isC||isJ ? '#e74c3c' : '#34495e', fontWeight: isC||isJ?'bold':'normal' }}>
                      <div>{ym}</div>
                      <div style={{ fontSize:'9px', opacity:0.8 }}>
                        {isC?'착공':isJ?'준공':rel>0?`+${rel}M`:`${rel}M`}
                      </div>
                    </th>
                  );
                })}
                <th style={{ padding:'5px 6px', fontSize:'10px', textAlign:'right', minWidth:'70px', backgroundColor:'#2c3e50', fontWeight:'bold' }}>합계</th>
              </tr>
            </thead>
            <tbody>
              {catRows.map((r,i) => (
                <tr key={r.label} style={{ backgroundColor:i%2===0?'white':'#f8f9fa' }}>
                  <td style={{ padding:'4px 8px', fontWeight:'bold', color:r.color, fontSize:'11px', whiteSpace:'nowrap', position:'sticky', left:0, backgroundColor:i%2===0?'white':'#f8f9fa', zIndex:1 }}>{r.label}</td>
                  {r.monthly.map((v,j) => (
                    <td key={j} style={{ padding:'3px 4px', textAlign:'right', fontSize:'10px',
                      backgroundColor:v>0?(i%2===0?'#f0f7ff':'#e8f4fd'):(i%2===0?'white':'#f8f9fa'),
                      color:v>0?r.color:'#ddd', fontWeight:v>0?'bold':'normal' }}>
                      {v>0?formatNumber(Math.round(v)):'-'}
                    </td>
                  ))}
                  <td style={{ padding:'3px 6px', textAlign:'right', fontSize:'10px', fontWeight:'bold', color:r.color, backgroundColor:i%2===0?'#f0f7ff':'#e8f4fd' }}>
                    {formatNumber(Math.round(r.total))}
                  </td>
                </tr>
              ))}
              <tr style={{ backgroundColor:'#f0f0f0' }}>
                <td style={{ padding:'4px 8px', fontWeight:'bold', fontSize:'11px', position:'sticky', left:0, backgroundColor:'#f0f0f0', zIndex:1 }}>합계</td>
                {allMonthly.map((v,i) => (
                  <td key={i} style={{ padding:'3px 4px', textAlign:'right', fontSize:'10px',
                    backgroundColor:v>0?'#d5eaf7':'white', color:v>0?'#1a5276':'#ddd', fontWeight:v>0?'bold':'normal' }}>
                    {v>0?formatNumber(Math.round(v)):'-'}
                  </td>
                ))}
                <td style={{ padding:'3px 6px', textAlign:'right', fontSize:'10px', fontWeight:'bold', color:'#1a5276', backgroundColor:'#d5eaf7' }}>
                  {formatNumber(Math.round(sumTotal))}
                </td>
              </tr>
              {sumVat > 0 && (
                <tr style={{ backgroundColor:'#fef9e7' }}>
                  <td style={{ padding:'4px 8px', fontWeight:'bold', fontSize:'11px', color:'#b7770d', position:'sticky', left:0, backgroundColor:'#fef9e7', zIndex:1 }}>부가세</td>
                  {allVat.map((v,i) => (
                    <td key={i} style={{ padding:'3px 4px', textAlign:'right', fontSize:'10px',
                      backgroundColor:v>0?'#fef9e7':'white', color:v>0?'#b7770d':'#ddd', fontWeight:v>0?'bold':'normal' }}>
                      {v>0?formatNumber(v):'-'}
                    </td>
                  ))}
                  <td style={{ padding:'3px 6px', textAlign:'right', fontSize:'10px', fontWeight:'bold', color:'#b7770d', backgroundColor:'#fef9e7' }}>
                    {formatNumber(sumVat)}
                  </td>
                </tr>
              )}
              {sumVat > 0 && (
                <tr style={{ backgroundColor:'#fdebd0' }}>
                  <td style={{ padding:'4px 8px', fontWeight:'bold', fontSize:'11px', color:'#b7770d', position:'sticky', left:0, backgroundColor:'#fdebd0', zIndex:1 }}>최종매출합계</td>
                  {allFinal.map((v,i) => (
                    <td key={i} style={{ padding:'3px 4px', textAlign:'right', fontSize:'10px',
                      backgroundColor:v>0?'#fdebd0':'white', color:v>0?'#b7770d':'#ddd', fontWeight:'bold' }}>
                      {v>0?formatNumber(Math.round(v)):'-'}
                    </td>
                  ))}
                  <td style={{ padding:'3px 6px', textAlign:'right', fontSize:'10px', fontWeight:'bold', color:'#b7770d', backgroundColor:'#fdebd0' }}>
                    {formatNumber(Math.round(sumFinal))}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── 공동주택 ── */}
      <div onClick={() => toggleSection('apt')} style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
        cursor:'pointer', padding:'6px 10px', backgroundColor:'#eaf1fb', borderRadius:'6px', marginBottom:'6px', borderLeft:'4px solid #3d6a99' }}>
        <span style={{ fontWeight:'bold', color:'#3d6a99', fontSize:'13px' }}>공동주택</span>
        <div style={{ display:'flex', gap:'12px', alignItems:'center', fontSize:'12px' }}>
          <span style={{ color:'#555' }}>합계: <strong style={{ color:'#3d6a99' }}>{formatNumber(Math.round(aptInc.total))} 천원</strong></span>
          <span style={{ color:'#888' }}>{openSections.apt ? '▲ 접기' : '▼ 펼치기'}</span>
        </div>
      </div>
      {openSections.apt && <SalesCondition title="공동주택" color="#3d6a99" config={aptCfg} setConfig={setAptCfg} />}
      {openSections.apt && (
        <SalesSection title="공동주택" color="#3d6a99" patterns={APT_PATTERNS}
          config={aptCfg} setConfig={setAptCfg} isStore={false}
          totalMonths={totalMonths} ymList={ymList}
          constructMonth={constructMonth} junMonth={junMonth}
          midMonths={aptMid} balMonths={aptBal}
          totalUnits={apt.units} unitPrice={apt.unitPrice}
          monthly={aptInc.monthly} />
      )}

      {/* ── 공공주택 — 항상 표시 ── */}
      <>
        <div onClick={() => toggleSection('public')} style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
          cursor:'pointer', padding:'6px 10px', backgroundColor:'#e8f8f0', borderRadius:'6px', marginBottom:'6px', borderLeft:'4px solid #1a7a4a' }}>
          <span style={{ fontWeight:'bold', color:'#1a7a4a', fontSize:'13px' }}>공공주택</span>
          <div style={{ display:'flex', gap:'12px', alignItems:'center', fontSize:'12px' }}>
            {publicInc.total > 0
              ? <span style={{ color:'#555' }}>합계: <strong style={{ color:'#1a7a4a' }}>{formatNumber(Math.round(publicInc.total))} 천원</strong></span>
              : <span style={{ color:'#aaa', fontSize:'11px' }}>수입탭에 공공주택 데이터 없음</span>}
            <span style={{ fontSize:'11px', color:'#aaa' }}>면세</span>
            <span style={{ color:'#888' }}>{openSections.public ? '▲ 접기' : '▼ 펼치기'}</span>
          </div>
        </div>
        {openSections.public && (
          <PublicSalesCondition title="공공주택" color="#1a7a4a" config={publicCfg} setConfig={setPublicCfg} />
        )}
        {openSections.public && (
          <PublicSalesSection title="공공주택" color="#1a7a4a"
            totalAmount={Math.round(publicTotalAmt)} cfg={publicCfg}
            totalMonths={totalMonths} ymList={ymList}
            constructMonth={constructMonth} junMonth={junMonth}
            constructPeriod={constructPeriod} vatRate={0} />
        )}
      </>

      {/* ── 발코니확장(일반) — 공동주택 분양자, 수입 있을 때만 표시 ── */}
      {normalBalUnits > 0 && balconyBurden === '분양자 부담' && (
        <>
          <div onClick={() => toggleSection('balcony')} style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
            cursor:'pointer', padding:'6px 10px', backgroundColor:'#f3eeff', borderRadius:'6px', marginBottom:'6px', borderLeft:'4px solid #7d6b9e' }}>
            <span style={{ fontWeight:'bold', color:'#7d6b9e', fontSize:'13px' }}>발코니확장 (일반)</span>
            <div style={{ display:'flex', gap:'12px', alignItems:'center', fontSize:'12px' }}>
              <span style={{ color:'#555' }}>합계: <strong style={{ color:'#7d6b9e' }}>{formatNumber(Math.round(balInc?.total||0))} 천원</strong></span>
              <span style={{ color:'#888' }}>{openSections.balcony ? '▲ 접기' : '▼ 펼치기'}</span>
            </div>
          </div>
          {openSections.balcony && <SalesCondition title="발코니확장(일반)" color="#7d6b9e" config={balconyCfg} setConfig={setBalconyCfg} />}
          {openSections.balcony && (
            <SalesSection title="발코니확장(일반)" color="#7d6b9e" patterns={APT_PATTERNS}
              config={balconyCfg} setConfig={setBalconyCfg} isStore={false} isBalcony={true}
              totalMonths={totalMonths} ymList={ymList}
              constructMonth={constructMonth} junMonth={junMonth}
              midMonths={balconyMid} balMonths={balconyBal}
              totalUnits={normalBalUnits} unitPrice={normalBalUnits>0 ? normalBalTotal/normalBalUnits : 0}
              monthly={balInc?.monthly} />
          )}
        </>
      )}

      {/* ── 발코니확장(공공) — 자치단체 별도청구, 항상 표시 ── */}
      <>
        <div onClick={() => toggleSection('publicBal')} style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
          cursor:'pointer', padding:'6px 10px', backgroundColor:'#ede8f8', borderRadius:'6px', marginBottom:'6px', borderLeft:'4px solid #6a5a8a' }}>
          <span style={{ fontWeight:'bold', color:'#6a5a8a', fontSize:'13px' }}>발코니확장 (공공)</span>
          <div style={{ display:'flex', gap:'12px', alignItems:'center', fontSize:'12px' }}>
            {publicBalInc.total > 0
              ? <span style={{ color:'#555' }}>합계: <strong style={{ color:'#6a5a8a' }}>{formatNumber(Math.round(publicBalInc.total))} 천원</strong></span>
              : <span style={{ color:'#aaa', fontSize:'11px' }}>수입탭에 공공주택 발코니 데이터 없음</span>}
            <span style={{ fontSize:'11px', color:'#aaa' }}>면세 · 자치단체</span>
            <span style={{ color:'#888' }}>{openSections.publicBal ? '▲ 접기' : '▼ 펼치기'}</span>
          </div>
        </div>
        {openSections.publicBal && (
          <PublicSalesCondition title="발코니확장(공공)" color="#6a5a8a" config={publicBalCfg} setConfig={setPublicBalCfg} />
        )}
        {openSections.publicBal && (
          <PublicSalesSection title="발코니확장(공공)" color="#6a5a8a"
            totalAmount={Math.round(publicBalTotal)} cfg={publicBalCfg}
            totalMonths={totalMonths} ymList={ymList}
            constructMonth={constructMonth} junMonth={junMonth}
            constructPeriod={constructPeriod} vatRate={0} />
        )}
      </>

      {/* ── 오피스텔 ── */}
      <div onClick={() => toggleSection('offi')} style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
        cursor:'pointer', padding:'6px 10px', backgroundColor:'#eaf5f2', borderRadius:'6px', marginBottom:'6px', borderLeft:'4px solid #347a6a' }}>
        <span style={{ fontWeight:'bold', color:'#347a6a', fontSize:'13px' }}>오피스텔</span>
        <div style={{ display:'flex', gap:'12px', alignItems:'center', fontSize:'12px' }}>
          <span style={{ color:'#555' }}>합계: <strong style={{ color:'#347a6a' }}>{formatNumber(Math.round(offiInc.total))} 천원</strong> (부가세 별도)</span>
          <span style={{ color:'#888' }}>{openSections.offi ? '▲ 접기' : '▼ 펼치기'}</span>
        </div>
      </div>
      {openSections.offi && <SalesCondition title="오피스텔" color="#347a6a" config={offiCfg} setConfig={setOffiCfg} />}
      {openSections.offi && (
        <SalesSection title="오피스텔" color="#347a6a" patterns={OFFI_PATTERNS}
          config={offiCfg} setConfig={setOffiCfg} isStore={false}
          totalMonths={totalMonths} ymList={ymList}
          constructMonth={constructMonth} junMonth={junMonth}
          midMonths={offiMid} balMonths={offiBal}
          totalUnits={offi.units} unitPrice={offi.unitPrice} vatRate={10}
          monthly={offiInc.monthly} />
      )}

      {/* ── 근린상가 ── */}
      <div onClick={() => toggleSection('store')} style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
        cursor:'pointer', padding:'6px 10px', backgroundColor:'#fdf0e8', borderRadius:'6px', marginBottom:'6px', borderLeft:'4px solid #965228' }}>
        <span style={{ fontWeight:'bold', color:'#965228', fontSize:'13px' }}>근린상가</span>
        <div style={{ display:'flex', gap:'12px', alignItems:'center', fontSize:'12px' }}>
          <span style={{ color:'#555' }}>합계: <strong style={{ color:'#965228' }}>{formatNumber(Math.round(storeInc.total))} 천원</strong> (부가세 별도)</span>
          <span style={{ color:'#888' }}>{openSections.store ? '▲ 접기' : '▼ 펼치기'}</span>
        </div>
      </div>
      {openSections.store && <SalesCondition title="근린상가" color="#965228" config={storeCfg} setConfig={setStoreCfg} />}
      {openSections.store && (
        <SalesSection title="근린상가" color="#965228" patterns={STORE_PATTERNS}
          config={storeCfg} setConfig={setStoreCfg} isStore={true}
          totalMonths={totalMonths} ymList={ymList}
          constructMonth={constructMonth} junMonth={junMonth}
          midMonths={storeMid} balMonths={storeBal}
          totalUnits={store.units} unitPrice={store.unitPrice} vatRate={10}
          monthly={storeInc.monthly} />
      )}

      {/* ── 공공시설 — 항상 표시 ── */}
      <>
        <div onClick={() => toggleSection('pubfac')} style={{ display:'flex', justifyContent:'space-between', alignItems:'center',
          cursor:'pointer', padding:'6px 10px', backgroundColor:'#fef9e7', borderRadius:'6px', marginBottom:'6px', borderLeft:'4px solid #9a6309' }}>
          <span style={{ fontWeight:'bold', color:'#9a6309', fontSize:'13px' }}>공공시설</span>
          <div style={{ display:'flex', gap:'12px', alignItems:'center', fontSize:'12px' }}>
            {pubfacInc.total > 0
              ? <span style={{ color:'#555' }}>합계: <strong style={{ color:'#9a6309' }}>{formatNumber(Math.round(pubfacInc.total))} 천원</strong> (부가세 별도)</span>
              : <span style={{ color:'#aaa', fontSize:'11px' }}>수입탭에 공공시설 데이터 없음</span>}
            <span style={{ color:'#888' }}>{openSections.pubfac ? '▲ 접기' : '▼ 펼치기'}</span>
          </div>
        </div>
        {openSections.pubfac && (
          <PublicSalesCondition title="공공시설" color="#9a6309" config={pubfacCfg} setConfig={setPubfacCfg} />
        )}
        {openSections.pubfac && (
          <PublicSalesSection title="공공시설" color="#9a6309"
            totalAmount={Math.round(pubfacTotalAmt)} cfg={pubfacCfg}
            totalMonths={totalMonths} ymList={ymList}
            constructMonth={constructMonth} junMonth={junMonth}
            constructPeriod={constructPeriod} vatRate={10} />
        )}
      </>
    </div>
  );
}

export default Sales;
