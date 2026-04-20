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
  const [collateralCost, setCollateralCost] = useState(0);

  // ─── (a) PF 금액 ───
  const pfAmount = useMemo(() => {
    const tranches = financeData?.ltvCalc?.tranches || [];
    return tranches.reduce((s, t) => s + (parseFloat(t.savedAmt||0)||0), 0);
  }, [financeData]);

  // ─── (b) 분양금액 (VAT 포함 — 전체매출합계) ───
  const saleWithStore = useMemo(() => {
    const s = salesData || {};
    // 공급가 + VAT 전체 (전체매출합계)
    return (s.salesSumApt||0)       + (s.salesSumAptVat||0)
         + (s.salesSumOffi||0)      + (s.salesSumOffiVat||0)
         + (s.salesSumStore||0)     + (s.salesSumStoreVat||0)
         + (s.salesSumBal||0)
         + (s.salesSumPublic||0)
         + (s.salesSumPublicBal||0)
         + (s.salesSumPubfac||0)    + (s.salesSumPubfacVat||0);
  }, [salesData]);

  const saleNoStore = useMemo(() => {
    const s = salesData || {};
    // 상가 제외 (공동주택 + 오피스텔 + 발코니 + 공공 관련)
    return (s.salesSumApt||0)       + (s.salesSumAptVat||0)
         + (s.salesSumOffi||0)      + (s.salesSumOffiVat||0)
         + (s.salesSumBal||0)
         + (s.salesSumPublic||0)
         + (s.salesSumPublicBal||0)
         + (s.salesSumPubfac||0)    + (s.salesSumPubfacVat||0);
  }, [salesData]);

  // ─── 재원조달별 집계 ───
  const fundsSum = useMemo(() => calcFundTotals(monthlyPayments, cashFlowResult), [monthlyPayments, cashFlowResult]);

  const cost1 = fundsSum.pf;
  const cost2 = fundsSum.sale;
  const cost3 = pfAmount;
  const cost4 = collateralCost;
  const cost5 = calcLandLastMonth(monthlyPayments);
  const cost6 = fundsSum.equity;
  const cost7 = fundsSum.loan;

  // ─── 부가세 납부/환급 (실제 수치) ───
  const vatSettle = useMemo(() => {
    return (cashFlowResult?.result || []).reduce((s, r) => s + (r?.vatSettle || 0), 0);
  }, [cashFlowResult]);

  // ─── 시나리오 계산 ───
  const calcScenario = (saleMax) => {
    const calcRate = (cumCost) => {
      const needSale = cumCost - pfAmount - collateralLoan;
      if (needSale <= 0) return 0;
      if (saleMax === 0) return 0;
      return (needSale / saleMax) * 100;
    };

    // 계단식 누적
    const cum1 = cost1;                        // ①
    const cum2 = cum1 + cost2;                 // ①+②
    const cum3 = cum2 + cost3;                 // ①+②+③
    const cum4 = cum3 + cost4;                 // +④
    const cum5 = cum4 + cost5;                 // +⑤
    const cum6 = cum5 + cost6;                 // +⑥

    return {
      step1: calcRate(cum1),
      step2: calcRate(cum2),
      step3: calcRate(cum3),
      step4: calcRate(cum4),
      step5: calcRate(cum5),
      step6: calcRate(cum6),
      totalCost: cum6,
    };
  };

  const scenarioA = useMemo(() => calcScenario(saleWithStore), [saleWithStore, pfAmount, collateralLoan, collateralCost, cost1, cost2, cost3, cost5, cost6]); // eslint-disable-line
  const scenarioB = useMemo(() => calcScenario(saleNoStore),   [saleNoStore,   pfAmount, collateralLoan, collateralCost, cost1, cost2, cost3, cost5, cost6]); // eslint-disable-line

  // ─── 표 렌더링 ───
  const renderTable = (scenario, saleMax, title) => {
    // 컬럼 자동 생성 (값 있는 것만)
    const cols = [];
    cols.push({ key:'amt', label:'금액', rate:null, subLabel:'' });
    cols.push({ key:'E', label:'E', rate:scenario.step1, subLabel:'필수사업비 커버' });
    cols.push({ key:'F', label:'F', rate:scenario.step2, subLabel:'+ 분양연동 사업비' });
    cols.push({ key:'G', label:'G', rate:scenario.step3, subLabel:'+ PF 대출상환', highlight:true });
    if (cost4 > 0) {
      cols.push({ key:'H', label:'H', rate:scenario.step4, subLabel:'+ 담보대출비용' });
    }
    if (cost5 > 0) {
      cols.push({ key:'I', label:'I', rate:scenario.step5, subLabel:'+ 토지 잔금' });
    }
    cols.push({ key:'J', label:'J', rate:scenario.step6, subLabel:'+ Equity 회수' });
    cols.push({ key:'L', label:'L', rate:100.0, subLabel:'현재 계획' });

    // 각 컬럼의 분양수입과 총가용금액
    const colSaleIn = cols.map(c => {
      if (c.key === 'amt') return saleMax;
      return saleMax * (c.rate/100);
    });
    const colD = colSaleIn.map(s => pfAmount + s + collateralLoan);

    // step 인덱스 매핑
    const colStepMap = { amt:99, E:1, F:2, G:3, H:4, I:5, J:6, L:99 };

    // 특정 지출순위가 해당 컬럼에 지급되는가?
    const shouldPay = (stepIdx, colKey) => {
      if (colKey === 'amt') return true;
      return colStepMap[colKey] >= stepIdx;
    };

    const rowVal = (stepIdx, amount) => {
      return cols.map(c => shouldPay(stepIdx, c.key) ? amount : 0);
    };

    // 각 행 데이터
    const rows = [];
    rows.push({ type:'section', label:'■ 자금 유입' });
    rows.push({ type:'data', label:'(a) PF 금액', values: cols.map(() => pfAmount) });
    rows.push({ type:'data', label:'(b) 분양금액', values: colSaleIn });
    if (collateralLoan > 0) {
      rows.push({ type:'data', label:'(c) 미분양 담보대출', values: cols.map(() => collateralLoan) });
    }
    rows.push({ type:'subtotal', label:'(d) 총 가용 금액', values: colD });
    rows.push({ type:'section', label:'■ 지출 순위 (자금 지급 순서)' });
    rows.push({ type:'data', label:'① 필수사업비', values: rowVal(1, cost1), note:'🏗️ 시공사 EXIT' });
    rows.push({ type:'data', label:'② 분양 연동 지출 사업비', values: rowVal(2, cost2) });
    rows.push({ type:'data', label:'③ PF 대출상환', values: rowVal(3, cost3), note:'🏦 금융기관 EXIT', highlight:true });
    if (cost4 > 0) {
      rows.push({ type:'data', label:'④ 담보대출비용', values: rowVal(4, cost4) });
    }
    if (cost5 > 0) {
      rows.push({ type:'data', label:'⑤ 토지 잔금 지급', values: rowVal(5, cost5), note:'토지 잔금 회수' });
    }
    rows.push({ type:'data', label:'⑥ 시행사 Equity 지급', values: rowVal(6, cost6), note:'Equity 회수' });

    // ⑦ 시행이익 (L 컬럼에서만) = (d) - 모든 지출
    const profitAtL = colD[colD.length-1] - cost1 - cost2 - cost3 - cost4 - cost5 - cost6;
    rows.push({
      type:'data',
      label:'⑦ 시행이익 지급',
      values: cols.map(c => c.key === 'L' ? profitAtL : null),
      note: profitAtL >= 0 ? '시행이익 회수' : '시행손실',
      profit:true,
    });

    // ─── 스타일 ───
    const td = { padding:'5px 8px', fontSize:'11px', color:'#111', borderBottom:'1px solid #e8e8e8', background:'white', textAlign:'right', whiteSpace:'nowrap' };
    const tdL = { ...td, textAlign:'left' };
    const th = { background:'#f0f0f0', color:'#111', padding:'5px 8px', fontSize:'11px', fontWeight:'bold', borderTop:'2px solid #555', borderBottom:'2px solid #555', textAlign:'center', whiteSpace:'nowrap' };
    const thL = { ...th, textAlign:'left' };
    const subTh = { ...th, background:'#f8f8f8', fontSize:'10px', fontWeight:'normal', borderTop:'none', paddingTop:'3px', paddingBottom:'5px' };
    const sectionRow = { ...tdL, background:'#eaeaea', fontWeight:'bold', fontSize:'11px', color:'#333', padding:'5px 8px' };
    const subtotalRow = { ...td, background:'#e8e8e8', fontWeight:'bold' };
    const subtotalRowL = { ...subtotalRow, textAlign:'left' };
    const highlightCol = { 
      background:'#fff3cd',
      WebkitPrintColorAdjust:'exact',
      printColorAdjust:'exact',
    };
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
                <th key={c.key} style={c.highlight ? { ...th, ...highlightCol } : th}>
                  {c.label}
                </th>
              ))}
              <th style={thL} rowSpan={2}>비고</th>
            </tr>
            <tr>
              {cols.map(c => (
                <th key={c.key+'-sub'} style={c.highlight ? { ...subTh, ...highlightCol } : subTh}>
                  {c.key === 'amt' ? '' : fmtPct(c.rate)}
                </th>
              ))}
            </tr>
            <tr>
              <th style={{ ...thL, background:'#fafafa', fontSize:'9px', fontWeight:'normal', color:'#666', borderTop:'none', borderBottom:'1px solid #ccc' }}></th>
              {cols.map(c => (
                <th key={c.key+'-desc'} style={{ ...subTh, background: c.highlight?'#fff8e1':'#fafafa', fontSize:'9px', fontWeight:'normal', color:'#666', borderTop:'none', borderBottom:'1px solid #ccc', WebkitPrintColorAdjust:'exact', printColorAdjust:'exact' }}>
                  {c.subLabel}
                </th>
              ))}
              <th style={{ ...thL, background:'#fafafa', borderTop:'none', borderBottom:'1px solid #ccc' }}></th>
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
                      <td key={i} style={cols[i].highlight ? { ...subtotalRow, ...highlightCol } : subtotalRow}>
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
                    const color = isProfit ? (v < 0 ? '#c0392b' : '#1e8449') : (row.highlight ? '#b7791f' : '#111');
                    const fontWeight = row.highlight || isProfit ? 'bold' : 'normal';
                    const cellStyle = { ...td, color, fontWeight };
                    if (cols[i].highlight) Object.assign(cellStyle, highlightCol);
                    return (
                      <td key={i} style={cellStyle}>
                        {isNull ? '' : fmtUk(v)}
                      </td>
                    );
                  })}
                  <td style={{ ...tdL, color: row.highlight?'#b7791f':'#666', fontSize:'10px', fontWeight: row.highlight?'bold':'normal' }}>{row.note||''}</td>
                </tr>
              );
            })}
            {/* 분양률 행 */}
            <tr>
              <td style={rateRowL}>지출순위별 상환 가능 분양률</td>
              {cols.map((c, i) => (
                <td key={i} style={c.highlight ? { ...rateRow, ...highlightCol } : rateRow}>
                  {c.key === 'amt' ? '—' : fmtPct(c.rate)}
                </td>
              ))}
              <td style={rateRow}></td>
            </tr>
          </tbody>
        </table>
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
              은행 관점: 지급 우선순위별로 필요한 분양률 분석 | 단위: 천원 → 억원 환산 | 금액 VAT 포함 기준
            </div>
          </div>

          {/* 🔔 부가세 정보 박스 */}
          {vatSettle !== 0 && (
            <div style={{ 
              marginBottom:'14px', padding:'10px 14px', 
              background: vatSettle > 0 ? '#fdedec' : '#eafaf1',
              border: `1px solid ${vatSettle > 0 ? '#f1948a' : '#a9dfbf'}`,
              borderRadius:'6px', fontSize:'12px', color: vatSettle > 0 ? '#922b21' : '#186a3b',
            }}>
              <strong>💰 {vatSettle > 0 ? '부가세 납부' : '부가세 환급'}:</strong>
              &nbsp;&nbsp;{fmtUk(Math.abs(vatSettle))}
              <span style={{ marginLeft:'10px', fontSize:'10px', color:'#555' }}>
                ({vatSettle > 0 ? '시행이익에서 추가 차감될 금액' : '시행이익에 추가될 금액'})
              </span>
            </div>
          )}

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
              💡 사업비 탭과 금융탭을 먼저 방문하면 데이터가 자동으로 연동됩니다.
            </div>
          )}

          {/* 핵심 지표 요약 */}
          <div style={{ marginBottom:'16px', padding:'12px 14px', background:'#fff3cd', border:'1px solid #f0d27e', borderRadius:'6px', fontSize:'12px', color:'#856404' }}>
            <strong>🏦 은행 EXIT 분양률 (G):</strong>
            &nbsp;&nbsp;상가 포함: <strong style={{ fontSize:'14px' }}>{fmtPct(scenarioA.step3)}</strong>
            &nbsp;&nbsp;|&nbsp;&nbsp;상가 제외: <strong style={{ fontSize:'14px' }}>{fmtPct(scenarioB.step3)}</strong>
            <div style={{ fontSize:'10px', color:'#665', marginTop:'3px' }}>
              분양률이 위 수치에 도달해야 PF 대출 상환 가능
            </div>
          </div>

          {renderTable(scenarioA, saleWithStore, '시나리오 A: 상가 포함 분양률 기준')}
          {renderTable(scenarioB, saleNoStore,   '시나리오 B: 상가 제외 분양률 기준')}

          <div style={{ marginTop:'16px', padding:'10px', background:'#f5f5f5', border:'1px solid #ccc', borderRadius:'6px', fontSize:'11px', color:'#555' }}>
            <div><strong>※ 컬럼 설명</strong></div>
            <div style={{ marginTop:'4px' }}>• <strong>E:</strong> 필수사업비 커버되는 분양률</div>
            <div>• <strong>F:</strong> + 분양연동 사업비 (시공사 EXIT)</div>
            <div>• <strong>G:</strong> ⭐ + PF 대출상환 (금융기관 EXIT)</div>
            {cost4 > 0 && <div>• <strong>H:</strong> + 담보대출비용</div>}
            {cost5 > 0 && <div>• <strong>I:</strong> + 토지 잔금</div>}
            <div>• <strong>J:</strong> + Equity 회수 (시행사 원금)</div>
            <div>• <strong>L:</strong> 100% 분양 기준 (현재 계획) — 이 컬럼에서 시행이익/손실 확인</div>
          </div>
        </div>
      )}
    </div>
  );
}
