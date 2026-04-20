import React, { useState, useMemo } from 'react';

// ─── 유틸 ───
const fmtUk = (v) => {
  if (v === null || v === undefined || isNaN(v)) return '—';
  const uk = v / 100000; // 천원 → 억원
  if (Math.abs(uk) < 0.05) return '—';
  return uk.toLocaleString('ko-KR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '억';
};
const fmtPct = (v) => {
  if (v === null || v === undefined || isNaN(v)) return '—';
  return `${v.toFixed(1)}%`;
};

// ─── 재원조달별 지출 집계 (Report.js FundingCashFlow 로직 복제) ───
function calcFundTotals(monthlyPayments, cashFlowResult) {
  const mp = monthlyPayments || {};
  const months = mp.months || [];
  const n = months.length;
  const FUNDS = ['equity', 'pf', 'sale', 'loan'];
  const categories = [
    { itemsKey:'landItems' }, { itemsKey:'directItems' }, { itemsKey:'indirectItems' },
    { itemsKey:'consultItems' }, { itemsKey:'salesItems' }, { itemsKey:'taxItems' }, { itemsKey:'overheadItems' },
  ];
  const fundTotals = {};
  FUNDS.forEach(fd => { fundTotals[fd] = Array(n).fill(0); });
  const keyMap = { equity:'eqMonthly', sale:'saleMonthly', pf:'pfMonthly', loan:'loanMonthly' };
  
  categories.forEach(cat => {
    (mp[cat.itemsKey]||[]).forEach(item => {
      FUNDS.forEach(fd => {
        const arr = item[keyMap[fd]];
        if (!arr) return;
        arr.forEach((v,i) => { fundTotals[fd][i] += v||0; });
      });
    });
  });
  
  // 금융비 (Report.js 로직)
  if (cashFlowResult && n > 0) {
    months.forEach((ym, idx) => {
      const i = (cashFlowResult.months||[]).indexOf(ym);
      if (i < 0) return;
      const r = cashFlowResult.result[i] || {};
      fundTotals['pf'][idx]   += (r.fee||0);
      fundTotals['sale'][idx] += (r.intS||0) + (r.intM||0) + (r.intJ||0) + (r.midInt||0);
    });
  }
  
  const sumOf = (arr) => arr.reduce((s,v) => s+v, 0);
  return {
    equity: sumOf(fundTotals.equity),
    pf:     sumOf(fundTotals.pf),
    sale:   sumOf(fundTotals.sale),
    loan:   sumOf(fundTotals.loan),
  };
}

// ─── 토지 마지막 달 지급액 ───
function calcLandLastMonth(monthlyPayments) {
  const mp = monthlyPayments || {};
  const items = mp.landItems || [];
  const months = mp.months || [];
  const n = months.length;
  if (n === 0 || items.length === 0) return 0;
  const lastIdx = n - 1;
  let total = 0;
  items.forEach(item => {
    // pfMonthly + saleMonthly + eqMonthly + loanMonthly 모두 합산
    ['pfMonthly','saleMonthly','eqMonthly','loanMonthly'].forEach(k => {
      const arr = item[k];
      if (arr && arr[lastIdx]) total += arr[lastIdx];
    });
  });
  return total;
}

// ─── 메인 컴포넌트 ───
export default function Sensitivity({
  projectName,
  archData,
  incomeData,
  salesData,
  costData,
  financeData,
  monthlyPayments,
  cashFlowResult,
}) {
  const [view, setView] = useState('saleRate');
  const [collateralLoan, setCollateralLoan] = useState(0);
  const [collateralCost, setCollateralCost] = useState(0); // 담보대출비용 (수동 입력)

  // ─── (a) PF 금액 ───
  const pfAmount = useMemo(() => {
    const tranches = financeData?.ltvCalc?.tranches || [];
    return tranches.reduce((s, t) => s + (parseFloat(t.savedAmt||0)||0), 0);
  }, [financeData]);

  // ─── (b) 분양금액: 상가포함 / 상가제외 ───
  const saleWithStore = useMemo(() => {
    const s = salesData || {};
    return (s.salesSumApt||0) + (s.salesSumOffi||0) + (s.salesSumStore||0) + (s.salesSumBal||0);
  }, [salesData]);

  const saleNoStore = useMemo(() => {
    const s = salesData || {};
    return (s.salesSumApt||0) + (s.salesSumOffi||0) + (s.salesSumBal||0);
  }, [salesData]);

  // ─── 재원조달별 집계 ───
  const fundsSum = useMemo(() => calcFundTotals(monthlyPayments, cashFlowResult), [monthlyPayments, cashFlowResult]);

  const cost1 = fundsSum.pf;                          // ① 필수사업비
  const cost2 = fundsSum.sale;                        // ② 분양 연동 지출
  const cost3 = pfAmount;                             // ③ PF 상환
  const cost4 = collateralCost;                       // ④ 담보대출비용 (수동)
  const cost5 = calcLandLastMonth(monthlyPayments);   // ⑤ 토지 잔금
  const cost6 = fundsSum.equity;                      // ⑥ Equity
  const cost7 = fundsSum.loan;                        // 대여금 (있을 때)

  // ─── 시나리오 계산 ───
  const calcScenario = (saleMax) => {
    // 해당 단계까지 달성에 필요한 분양률
    // 누적 지출 - (PF + 담보대출) = 분양으로 커버해야 할 금액
    // 분양률 = (필요 분양수입) / 분양최대금액 × 100
    const calcRate = (cumCost) => {
      const needSale = cumCost - pfAmount - collateralLoan;
      if (needSale <= 0) return 0;
      if (saleMax === 0) return 0;
      return (needSale / saleMax) * 100;
    };

    // 순차 누적
    const cum1 = cost1;
    const cum2 = cum1 + cost2;
    const cum3 = cum2 + cost3;
    const cum4 = cum3 + cost4;
    const cum5 = cum4 + cost5;
    const cum6 = cum5 + cost6;

    // 각 단계의 분양률
    return {
      step1: calcRate(cum1),    // ①까지
      step2: calcRate(cum2),    // ②까지
      step3: calcRate(cum3),    // ③까지 (PF 상환)
      step4: calcRate(cum4),    // ④까지
      step5: calcRate(cum5),    // ⑤까지
      step6: calcRate(cum6),    // ⑥까지
      totalCost: cum6,
    };
  };

  const scenarioA = useMemo(() => calcScenario(saleWithStore), [saleWithStore, pfAmount, collateralLoan, collateralCost, cost1, cost2, cost3, cost5, cost6]); // eslint-disable-line
  const scenarioB = useMemo(() => calcScenario(saleNoStore),   [saleNoStore,   pfAmount, collateralLoan, collateralCost, cost1, cost2, cost3, cost5, cost6]); // eslint-disable-line

  // ─── 표 렌더링 ───
  const renderTable = (scenario, saleMax, title) => {
    // 컬럼 결정: 값 있는 것만
    const cols = [];
    cols.push({ key:'amt', label:'금액', rate:null });

    // F: ②까지 (항상)
    cols.push({ key:'F', label:'F', rate:scenario.step2, subLabel:'분양불공사비 지급' });

    // G: ③까지 (항상) ⭐
    cols.push({ key:'G', label:'G', rate:scenario.step3, subLabel:'PF 상환 완료', highlight:true });

    // H: ④까지 (담보대출비용 있을 때만)
    if (cost4 > 0) {
      cols.push({ key:'H', label:'H', rate:scenario.step4, subLabel:'담보대출비용' });
    }

    // I: ⑤까지 (토지잔금 있을 때만)
    if (cost5 > 0) {
      cols.push({ key:'I', label:'I', rate:scenario.step5, subLabel:'토지 잔금' });
    }

    // J: ⑥까지 (항상)
    cols.push({ key:'J', label:'J', rate:scenario.step6, subLabel:'Equity 회수' });

    // L: 현재 100%
    cols.push({ key:'L', label:'L', rate:100.0, subLabel:'현재 계획' });

    // 각 컬럼의 분양률 → 분양수입 → 총가용
    const getColData = (col) => {
      const rate = col.rate === null ? null : col.rate;
      const saleIn = rate === null ? null : saleMax * (rate/100);
      return { rate, saleIn };
    };

    const colData = cols.map(getColData);
    const dVals = colData.map((d, i) => {
      if (cols[i].key === 'amt') return pfAmount + saleMax + collateralLoan; // 기준 금액
      return pfAmount + d.saleIn + collateralLoan;
    });

    // 각 행의 값: 지출순위별 "해당 컬럼까지 지급되었는가?"
    // 금액 컬럼은 항상 전체 금액
    const rowVal = (stepIdx, amount) => {
      return cols.map((c, i) => {
        if (c.key === 'amt') return amount;
        // 해당 컬럼의 단계 인덱스
        const colStepMap = { F:2, G:3, H:4, I:5, J:6, L:7 };
        const colStep = colStepMap[c.key] || 99;
        // colStep >= stepIdx 이면 지급됨
        return colStep >= stepIdx ? amount : 0;
      });
    };

    // 각 행 데이터
    const rows = [];
    rows.push({ type:'section', label:'자금 유입' });
    rows.push({ type:'data', label:'(a) PF 금액', values: cols.map(() => pfAmount) });
    rows.push({ type:'data', label:'(b) 분양금액', values: cols.map((c, i) => c.key === 'amt' ? saleMax : colData[i].saleIn) });
    if (collateralLoan > 0) {
      rows.push({ type:'data', label:'(c) 미분양 담보대출', values: cols.map(() => collateralLoan) });
    }
    rows.push({ type:'subtotal', label:'(d) 총 가용 금액', values: dVals });
    rows.push({ type:'section', label:'지출 순위 (자금 지급 순서)' });
    rows.push({ type:'data', label:'① 필수사업비', values: rowVal(1, cost1) });
    rows.push({ type:'data', label:'② 분양 연동 지출 사업비', values: rowVal(2, cost2) });
    rows.push({ type:'data', label:'③ PF 대출상환', values: rowVal(3, cost3), note:'금융기관/시공사 EXIT', highlight:true });
    if (cost4 > 0) {
      rows.push({ type:'data', label:'④ 담보대출비용', values: rowVal(4, cost4) });
    }
    if (cost5 > 0) {
      rows.push({ type:'data', label:'⑤ 토지 잔금 지급', values: rowVal(5, cost5), note:'토지 잔금 회수' });
    }
    rows.push({ type:'data', label:'⑥ 시행사 Equity 지급', values: rowVal(6, cost6), note:'Equity 회수' });

    // ⑦ 시행이익: L 컬럼에서만 (d - 누적지출)
    const profitAtL = dVals[dVals.length-1] - cost1 - cost2 - cost3 - cost4 - cost5 - cost6;
    rows.push({
      type:'data',
      label:'⑦ 시행이익 지급',
      values: cols.map(c => c.key === 'L' ? profitAtL : null),
      note:'시행이익 회수',
      profit:true,
    });

    // ─── 스타일 ───
    const bg = '-webkit-print-color-adjust:exact;print-color-adjust:exact;';
    const td = { padding:'5px 8px', fontSize:'11px', color:'#111', borderBottom:'1px solid #e8e8e8', background:'white', textAlign:'right', whiteSpace:'nowrap' };
    const tdL = { ...td, textAlign:'left' };
    const tdC = { ...td, textAlign:'center' };
    const th = { background:'#f0f0f0', color:'#111', padding:'5px 8px', fontSize:'11px', fontWeight:'bold', borderTop:'2px solid #555', borderBottom:'2px solid #555', textAlign:'center', whiteSpace:'nowrap' };
    const thL = { ...th, textAlign:'left' };
    const subTh = { ...th, background:'#f8f8f8', fontSize:'10px', fontWeight:'normal', borderTop:'none', paddingTop:'3px', paddingBottom:'5px' };
    const sectionRow = { ...tdL, background:'#eaeaea', fontWeight:'bold', fontSize:'10px', color:'#555', padding:'4px 8px' };
    const subtotalRow = { ...td, background:'#e8e8e8', fontWeight:'bold' };
    const subtotalRowL = { ...subtotalRow, textAlign:'left' };
    const highlightCol = { background:'#fff3cd', ...bg }; // G 컬럼 강조용 (노란 배경)
    const rateRow = { ...td, background:'#d5d5d5', fontWeight:'bold', borderTop:'2px solid #333', borderBottom:'2px solid #333' };
    const rateRowL = { ...rateRow, textAlign:'left' };

    return (
      <div style={{ marginBottom:'30px' }}>
        <h4 style={{ fontSize:'13px', fontWeight:'bold', color:'#111', borderBottom:'2px solid #333', paddingBottom:'4px', marginBottom:'8px' }}>
          ■ {title}
        </h4>
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead>
            <tr>
              <th style={thL} rowSpan={2}>구분</th>
              {cols.map(c => (
                <th key={c.key} style={{ ...th, ...(c.highlight ? highlightCol : {}) }}>
                  {c.label === '금액' ? '금액' : `${c.label}`}
                </th>
              ))}
              <th style={thL} rowSpan={2}>비고</th>
            </tr>
            <tr>
              {cols.map(c => (
                <th key={c.key+'-sub'} style={{ ...subTh, ...(c.highlight ? highlightCol : {}) }}>
                  {c.key === 'amt' ? '' : fmtPct(c.rate)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => {
              if (row.type === 'section') {
                return (
                  <tr key={ri}>
                    <td colSpan={cols.length+2} style={sectionRow}>{row.label}</td>
                  </tr>
                );
              }
              if (row.type === 'subtotal') {
                return (
                  <tr key={ri}>
                    <td style={subtotalRowL}>{row.label} = (a)+(b){collateralLoan>0?'+(c)':''}</td>
                    {row.values.map((v, i) => (
                      <td key={i} style={{ ...subtotalRow, ...(cols[i].highlight ? highlightCol : {}) }}>
                        {fmtUk(v)}
                      </td>
                    ))}
                    <td style={subtotalRow}></td>
                  </tr>
                );
              }
              // data row
              return (
                <tr key={ri}>
                  <td style={{ ...tdL, paddingLeft:'16px', fontWeight: row.highlight?'bold':'normal', color: row.highlight?'#b7791f':'#111' }}>
                    {row.label}
                  </td>
                  {row.values.map((v, i) => {
                    const isNull = v === null;
                    const isProfit = row.profit && !isNull;
                    const color = isProfit ? (v < 0 ? '#c0392b' : '#111') : (row.highlight ? '#b7791f' : '#111');
                    const fontWeight = row.highlight || isProfit ? 'bold' : 'normal';
                    return (
                      <td key={i} style={{ ...td, color, fontWeight, ...(cols[i].highlight ? highlightCol : {}) }}>
                        {isNull ? '' : fmtUk(v)}
                      </td>
                    );
                  })}
                  <td style={{ ...tdL, color:'#888', fontSize:'10px' }}>{row.note||''}</td>
                </tr>
              );
            })}
            {/* 분양률 행 */}
            <tr>
              <td style={rateRowL}>지출순위별 상환 가능 분양률</td>
              {cols.map((c, i) => (
                <td key={i} style={{ ...rateRow, ...(c.highlight ? highlightCol : {}) }}>
                  {c.key === 'amt' ? '—' : fmtPct(c.rate)}
                </td>
              ))}
              <td style={rateRow}></td>
            </tr>
          </tbody>
        </table>

        {/* 하단 해석 (컬럼 레이블 설명) */}
        <div style={{ marginTop:'8px', padding:'8px 12px', background:'#f9f9f9', borderRadius:'4px', fontSize:'10px', color:'#555' }}>
          {cols.filter(c => c.key !== 'amt').map((c, i) => (
            <span key={i} style={{ marginRight:'16px' }}>
              <strong style={{ color: c.highlight?'#b7791f':'#111' }}>{c.label}:</strong> {c.subLabel}
            </span>
          ))}
        </div>
      </div>
    );
  };

  // ─── 메인 렌더링 ───
  return (
    <div>
      <div style={{ display:'flex', gap:'8px', marginBottom:'16px' }}>
        <button
          onClick={() => setView('saleRate')}
          style={{
            padding:'8px 16px',
            backgroundColor: view === 'saleRate' ? '#2c3e50' : '#ecf0f1',
            color: view === 'saleRate' ? 'white' : '#2c3e50',
            border:'none', borderRadius:'6px', cursor:'pointer',
            fontWeight: view === 'saleRate' ? 'bold' : 'normal',
            fontSize:'13px',
          }}
        >
          📊 분양률 민감도
        </button>
        <button
          disabled
          style={{
            padding:'8px 16px', backgroundColor:'#ecf0f1', color:'#aaa',
            border:'none', borderRadius:'6px', cursor:'not-allowed', fontSize:'13px',
          }}
        >
          📈 민감도 분석 (준비 중)
        </button>
      </div>

      {view === 'saleRate' && (
        <div>
          <div style={{ marginBottom:'16px' }}>
            <h3 style={{ margin:0, fontSize:'16px', color:'#111' }}>■ 분양률 민감도 분석</h3>
            <div style={{ fontSize:'11px', color:'#888', marginTop:'3px' }}>
              은행 관점: 지급 우선순위별로 필요한 분양률 분석 | 단위: 천원 → 억원 환산
            </div>
          </div>

          {/* 미분양 담보대출 입력 */}
          <div style={{ marginBottom:'16px', padding:'10px', background:'#f9f9f9', border:'1px solid #ddd', borderRadius:'6px' }}>
            <div style={{ fontSize:'11px', fontWeight:'bold', marginBottom:'6px', color:'#555' }}>🔧 미분양 담보대출 입력 (선택)</div>
            <div style={{ display:'flex', gap:'20px', alignItems:'center', fontSize:'11px' }}>
              <label>대출금액 (c): 
                <input type="number" value={collateralLoan} onChange={e => setCollateralLoan(parseFloat(e.target.value)||0)}
                  style={{ marginLeft:'6px', width:'120px', padding:'4px 8px', border:'1px solid #bbb', borderRadius:'3px' }} />
                <span style={{ marginLeft:'4px', color:'#888' }}>천원</span>
              </label>
              <label>담보대출비용 (④): 
                <input type="number" value={collateralCost} onChange={e => setCollateralCost(parseFloat(e.target.value)||0)}
                  style={{ marginLeft:'6px', width:'120px', padding:'4px 8px', border:'1px solid #bbb', borderRadius:'3px' }} />
                <span style={{ marginLeft:'4px', color:'#888' }}>천원</span>
              </label>
            </div>
          </div>

          {(!monthlyPayments || (monthlyPayments.months||[]).length === 0) && (
            <div style={{ padding:'30px', textAlign:'center', color:'#aaa', border:'2px dashed #ddd', borderRadius:'8px', marginBottom:'16px' }}>
              💡 사업비 탭을 먼저 방문하면 데이터가 자동으로 연동됩니다.
            </div>
          )}

          {/* 요약 정보 */}
          <div style={{ marginBottom:'16px', padding:'10px', background:'#fff3cd', border:'1px solid #f0d27e', borderRadius:'6px', fontSize:'12px', color:'#856404' }}>
            <strong>🏦 은행 EXIT 분양률 (G):</strong>
            &nbsp;&nbsp;상가 포함: <strong>{fmtPct(scenarioA.step3)}</strong>
            &nbsp;&nbsp;|&nbsp;&nbsp;상가 제외: <strong>{fmtPct(scenarioB.step3)}</strong>
          </div>

          {renderTable(scenarioA, saleWithStore, '시나리오 A: 상가 포함 분양률 기준')}
          {renderTable(scenarioB, saleNoStore,   '시나리오 B: 상가 제외 분양률 기준')}

          <div style={{ marginTop:'16px', padding:'10px', background:'#f5f5f5', border:'1px solid #ccc', borderRadius:'6px', fontSize:'11px', color:'#555' }}>
            <div><strong>※ 분양률 해석 (은행 관점)</strong></div>
            <div style={{ marginTop:'4px' }}>• <strong>F:</strong> 분양불공사비 지급 시작 분양률</div>
            <div>• <strong>G:</strong> ⭐ PF 상환 완료 분양률 (금융기관 EXIT)</div>
            <div>• <strong>J:</strong> Equity까지 회수 가능 분양률 (시행사 원금 회수)</div>
            <div>• <strong>L:</strong> 현재 100% 분양 계획 기준 (최종 상태)</div>
          </div>
        </div>
      )}
    </div>
  );
}
