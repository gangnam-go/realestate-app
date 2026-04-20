import React, { useState, useMemo } from 'react';

// ─── 유틸 함수 ───
const fmtN = (v) => {
  if (v === null || v === undefined || isNaN(v)) return '—';
  const rounded = Math.round(v);
  if (rounded === 0) return '—';
  return rounded.toLocaleString('ko-KR');
};
const fmtB = (v) => {
  if (!v || isNaN(v)) return '—';
  return `${(v/100000).toFixed(1)}억`;
};
const fmtPct = (v) => {
  if (v === null || v === undefined || isNaN(v)) return '—';
  return `${v.toFixed(1)}%`;
};

// ─── 재원조달별 지출 계산 (Report.js FundingCashFlow 로직 복제) ───
function calcFundTotals(monthlyPayments, cashFlowResult) {
  const mp = monthlyPayments || {};
  const months = mp.months || [];
  const n = months.length;

  const FUNDS = ['equity', 'pf', 'sale', 'loan'];
  const categories = [
    { key:'land',     itemsKey:'landItems'     },
    { key:'direct',   itemsKey:'directItems'   },
    { key:'indirect', itemsKey:'indirectItems' },
    { key:'consult',  itemsKey:'consultItems'  },
    { key:'sales',    itemsKey:'salesItems'    },
    { key:'tax',      itemsKey:'taxItems'      },
    { key:'overhead', itemsKey:'overheadItems' },
  ];

  const calcByFund = (item, fundKey) => {
    const keyMap = { equity:'eqMonthly', sale:'saleMonthly', pf:'pfMonthly', loan:'loanMonthly' };
    const arr = item[keyMap[fundKey]];
    if (!arr) return null;
    const total = arr.reduce((s,v) => s + (v||0), 0);
    if (total === 0) return null;
    return { arr, total };
  };

  const fundTotals = {};
  FUNDS.forEach(fd => { fundTotals[fd] = Array(n).fill(0); });

  categories.forEach(cat => {
    (mp[cat.itemsKey]||[]).forEach(item => {
      FUNDS.forEach(fd => {
        const r = calcByFund(item, fd);
        if (!r) return;
        r.arr.forEach((v,i) => { fundTotals[fd][i] += v||0; });
      });
    });
  });

  // 금융비 추가 (Report.js와 동일 로직)
  if (cashFlowResult && n > 0) {
    months.forEach((ym, idx) => {
      const i = (cashFlowResult.months||[]).indexOf(ym);
      if (i < 0) return;
      const r = cashFlowResult.result[i] || {};
      fundTotals['pf'][idx]   += (r.fee||0);                          // 주관사수수료 → 필수사업비
      fundTotals['sale'][idx] += (r.intS||0) + (r.intM||0) + (r.intJ||0) + (r.midInt||0); // PF이자 + 중도금무이자 → 분양불
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

// ─── 토지 잔금 (마지막 달 지급액) ───
function calcLandLastMonth(monthlyPayments) {
  const mp = monthlyPayments || {};
  const items = mp.landItems || [];
  const months = mp.months || [];
  const n = months.length;
  if (n === 0) return 0;
  const lastIdx = n - 1;

  // 각 landItem에서 마지막 달 금액 합산
  let total = 0;
  items.forEach(item => {
    const arr = item.monthly || item.amtMonthly || [];
    if (arr[lastIdx]) total += arr[lastIdx];
  });
  // landItem이 없으면 mp.land 집계 사용
  if (items.length === 0 && mp.land) {
    const arr = Object.values(mp.land);
    if (arr[lastIdx]) total += arr[lastIdx];
  }
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
  const [collateralLoan, setCollateralLoan] = useState(0);  // 미분양 담보대출 (c)
  const [collateralRate, setCollateralRate] = useState(5.0); // 담보대출 금리 (%)
  const [collateralMonths, setCollateralMonths] = useState(12); // 담보대출 기간 (월)

  // ─── 1. PF 금액 (a) ───
  const pfAmount = useMemo(() => {
    const tranches = financeData?.ltvCalc?.tranches || [];
    return tranches.reduce((s, t) => s + (parseFloat(t.savedAmt||0)||0), 0);
  }, [financeData]);

  // ─── 2. 분양금액 (b) ───
  const saleWithStore = useMemo(() => {
    const s = salesData || {};
    return (s.salesSumApt||0) + (s.salesSumOffi||0) + (s.salesSumStore||0) + (s.salesSumBal||0);
  }, [salesData]);

  const saleNoStore = useMemo(() => {
    const s = salesData || {};
    return (s.salesSumApt||0) + (s.salesSumOffi||0) + (s.salesSumBal||0);
  }, [salesData]);

  // ─── 3. 재원조달별 사업비 집계 ───
  const fundsSum = useMemo(() => calcFundTotals(monthlyPayments, cashFlowResult), [monthlyPayments, cashFlowResult]);
  
  const cost1_essential = fundsSum.pf;    // ① 필수사업비
  const cost2_saleLink  = fundsSum.sale;  // ② 분양 연동 지출
  const cost3_pfRepay   = pfAmount;       // ③ PF 대출상환
  const cost4_collateralInterest = (collateralLoan * (collateralRate/100) * (collateralMonths/12)); // ④
  const cost5_landLast  = calcLandLastMonth(monthlyPayments); // ⑤
  const cost6_equity    = fundsSum.equity; // ⑥

  // ─── 4. 시나리오 계산 함수 ───
  const calcScenario = (saleMax) => {
    // 각 지출 순위까지 도달하려면 분양수입이 얼마나 필요한가?
    // (총 가용 필요액 - PF - 미분양담보) = 분양수입으로 커버해야 할 금액
    // 분양률 = 분양수입 필요액 / 100% 분양 시 금액 × 100
    
    const calcRate = (cumCost) => {
      // 분양수입 필요액 = cumCost - pfAmount - collateralLoan
      const needSale = cumCost - pfAmount - collateralLoan;
      if (needSale <= 0) return 0;
      if (saleMax === 0) return 0;
      return (needSale / saleMax) * 100;
    };

    const E = 0.68; // 초기 계약금 단계 (엑셀 관행)
    const F = calcRate(cost1_essential + cost2_saleLink);
    const G = calcRate(cost1_essential + cost2_saleLink + cost3_pfRepay);
    const H = calcRate(cost1_essential + cost2_saleLink + cost3_pfRepay + cost4_collateralInterest);
    const I = calcRate(cost1_essential + cost2_saleLink + cost3_pfRepay + cost4_collateralInterest + cost5_landLast + cost6_equity);

    // L = 현재 사업계획상 분양률 (100% 기준)
    const L = 100.0;

    // 각 시나리오별 가용금액 (해당 분양률 × saleMax + PF + 미분양담보)
    const availAt = (rate) => saleMax * (rate/100) + pfAmount + collateralLoan;

    // 시행이익 = 현재 분양률(L)에서의 가용금액 - 모든 지출
    const totalCost = cost1_essential + cost2_saleLink + cost3_pfRepay + cost4_collateralInterest + cost5_landLast + cost6_equity;
    const profit = availAt(L) - totalCost;

    return { E, F, G, H, I, L, availAt, profit, totalCost };
  };

  const scenarioA = useMemo(() => calcScenario(saleWithStore), [saleWithStore, pfAmount, collateralLoan, cost1_essential, cost2_saleLink, cost4_collateralInterest, cost5_landLast, cost6_equity]); // eslint-disable-line
  const scenarioB = useMemo(() => calcScenario(saleNoStore),   [saleNoStore,   pfAmount, collateralLoan, cost1_essential, cost2_saleLink, cost4_collateralInterest, cost5_landLast, cost6_equity]); // eslint-disable-line

  // ─── 렌더링 함수: 민감도 표 ───
  const renderTable = (scenario, saleMax, title) => {
    const cols = [
      { key:'D', label:'금액',     rate: 100 },
      { key:'F', label:'F',        rate: scenario.F },
      { key:'G', label:'G',        rate: scenario.G },
      { key:'H', label:'H',        rate: scenario.H },
      { key:'I', label:'I',        rate: scenario.I },
      { key:'L', label:'L',        rate: scenario.L },
    ];

    const headerSubLabels = {
      D: '기준',
      F: '분양불공사비 지급',
      G: 'PF 대출상환',
      H: '잔여공사비 지급',
      I: 'Equity 지급',
      L: '현재계획',
    };

    // 각 컬럼의 분양수입 = saleMax × rate/100
    const saleByCol = cols.map(c => saleMax * (c.rate/100));

    // 각 행별 계산 (컬럼별로)
    // (a) PF: 분양률이 커도 PF는 고정 (선분)
    // (b) 분양: 컬럼별 분양률 대비 금액
    // (d) 총가용 = PF + 분양 + 담보
    // 지출항목: 누적 가용액에서 순차 차감 (해당 컬럼까지 가능한 지출만)

    const aVals = cols.map(() => pfAmount);
    const bVals = saleByCol;
    const cVals = cols.map(() => collateralLoan);
    const dVals = cols.map((_, i) => aVals[i] + bVals[i] + cVals[i]);

    // 컬럼별 지출항목 계산 (해당 지출순위까지만 가능)
    const calcRowAt = (cumReq, dVal) => (dVal >= cumReq ? true : false);

    const r1 = cols.map((_, i) => cost1_essential);  // ① 항상 지급 (필수)
    const r2 = cols.map((_, i) => {
      return calcRowAt(cost1_essential + cost2_saleLink, dVals[i]) ? cost2_saleLink : 0;
    });
    const r3 = cols.map((_, i) => {
      const req = cost1_essential + cost2_saleLink + cost3_pfRepay;
      return calcRowAt(req, dVals[i]) ? cost3_pfRepay : 0;
    });
    const r4 = cols.map((_, i) => {
      const req = cost1_essential + cost2_saleLink + cost3_pfRepay + cost4_collateralInterest;
      return calcRowAt(req, dVals[i]) ? cost4_collateralInterest : 0;
    });
    const r5 = cols.map((_, i) => {
      const req = cost1_essential + cost2_saleLink + cost3_pfRepay + cost4_collateralInterest + cost5_landLast;
      return calcRowAt(req, dVals[i]) ? cost5_landLast : 0;
    });
    const r6 = cols.map((_, i) => {
      const req = cost1_essential + cost2_saleLink + cost3_pfRepay + cost4_collateralInterest + cost5_landLast + cost6_equity;
      return calcRowAt(req, dVals[i]) ? cost6_equity : 0;
    });
    // ⑦ 시행이익 = D - 모든지출 (잔여액), 오직 L 컬럼에서만 의미있음
    const r7 = cols.map((_, i) => {
      return dVals[i] - r1[i] - r2[i] - r3[i] - r4[i] - r5[i] - r6[i];
    });

    // 분양률 표시 행
    const rateLabels = cols.map(c => c.key === 'D' ? '—' : fmtPct(c.rate));

    // ─── 스타일 ───
    const bg = '-webkit-print-color-adjust:exact;print-color-adjust:exact;';
    const fontSize = '10px';
    const cellPad = '4px 6px';
    const th = { background:'#f0f0f0', color:'#111', padding:cellPad, fontSize, fontWeight:'bold', borderTop:'2px solid #555', borderBottom:'2px solid #555', textAlign:'right', whiteSpace:'nowrap' };
    const thL = { ...th, textAlign:'left' };
    const thC = { ...th, textAlign:'center' };
    const td = { padding:cellPad, fontSize, color:'#111', borderBottom:'1px solid #e8e8e8', background:'white', textAlign:'right', whiteSpace:'nowrap' };
    const tdL = { ...td, textAlign:'left' };
    const tdSub = { ...td, background:'#fafafa', fontWeight:'bold' };
    const tdSubL = { ...tdSub, textAlign:'left' };
    const tot = { ...td, background:'#d5d5d5', fontWeight:'bold', borderTop:'2px solid #333', borderBottom:'2px solid #333' };
    const totL = { ...tot, textAlign:'left' };

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
                <th key={c.key} style={thC}>{c.label}</th>
              ))}
            </tr>
            <tr>
              {cols.map(c => (
                <th key={c.key+'-sub'} style={{ ...thC, fontSize:'9px', fontWeight:'normal', borderTop:'none', background:'#f5f5f5' }}>
                  {headerSubLabels[c.key]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* (a) PF 금액 */}
            <tr>
              <td style={tdL}>(a) PF 금액</td>
              {aVals.map((v,i) => <td key={i} style={td}>{fmtN(v)}</td>)}
            </tr>
            {/* (b) 분양금액 */}
            <tr>
              <td style={tdL}>(b) 분양금액</td>
              {bVals.map((v,i) => <td key={i} style={td}>{fmtN(v)}</td>)}
            </tr>
            {/* (c) 미분양 담보대출 */}
            <tr>
              <td style={tdL}>(c) 미분양 담보대출</td>
              {cVals.map((v,i) => <td key={i} style={td}>{v>0?fmtN(v):'—'}</td>)}
            </tr>
            {/* (d) 총가용금액 */}
            <tr>
              <td style={tdSubL}>(d) 총 가용 금액 = (a)+(b)+(c)</td>
              {dVals.map((v,i) => <td key={i} style={tdSub}>{fmtN(v)}</td>)}
            </tr>
            {/* 구분선 */}
            <tr><td colSpan={cols.length+1} style={{ height:'4px', background:'#ddd' }}></td></tr>
            {/* 지출순위 */}
            <tr><td colSpan={cols.length+1} style={{ ...tdSubL, fontSize:'10px', color:'#555' }}>지출순위</td></tr>
            {/* ① 필수사업비 */}
            <tr>
              <td style={tdL}>&nbsp;&nbsp;① 필수사업비</td>
              {r1.map((v,i) => <td key={i} style={td}>{fmtN(v)}</td>)}
            </tr>
            {/* ② 분양 연동 지출 사업비 */}
            <tr>
              <td style={tdL}>&nbsp;&nbsp;② 분양 연동 지출 사업비</td>
              {r2.map((v,i) => <td key={i} style={td}>{fmtN(v)}</td>)}
            </tr>
            {/* ③ PF 대출상환 */}
            <tr>
              <td style={tdL}>&nbsp;&nbsp;③ PF 대출상환</td>
              {r3.map((v,i) => <td key={i} style={td}>{fmtN(v)}</td>)}
            </tr>
            {/* ④ 담보대출비용 */}
            <tr>
              <td style={tdL}>&nbsp;&nbsp;④ 담보대출비용</td>
              {r4.map((v,i) => <td key={i} style={td}>{fmtN(v)}</td>)}
            </tr>
            {/* ⑤ 토지 잔금 지급 */}
            <tr>
              <td style={tdL}>&nbsp;&nbsp;⑤ 토지 잔금 지급</td>
              {r5.map((v,i) => <td key={i} style={td}>{fmtN(v)}</td>)}
            </tr>
            {/* ⑥ Equity 지급 */}
            <tr>
              <td style={tdL}>&nbsp;&nbsp;⑥ 시행사 Equity 지급</td>
              {r6.map((v,i) => <td key={i} style={td}>{fmtN(v)}</td>)}
            </tr>
            {/* ⑦ 시행이익 */}
            <tr>
              <td style={tdL}>&nbsp;&nbsp;⑦ 시행이익 지급</td>
              {r7.map((v,i) => (
                <td key={i} style={{ ...td, color: v<0?'#c0392b':'#111', fontWeight: v!==0?'bold':'normal' }}>
                  {fmtN(v)}
                </td>
              ))}
            </tr>
            {/* 분양률 */}
            <tr>
              <td style={totL}>상환 가능 분양률</td>
              {rateLabels.map((v,i) => <td key={i} style={tot}>{v}</td>)}
            </tr>
          </tbody>
        </table>
      </div>
    );
  };

  // ─── 상단 버튼 ───
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
          onClick={() => setView('sensitivity')}
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
          {/* 헤더 */}
          <div style={{ marginBottom:'16px' }}>
            <h3 style={{ margin:0, fontSize:'16px', color:'#111' }}>■ 분양률 민감도 분석</h3>
            <div style={{ fontSize:'11px', color:'#888', marginTop:'3px' }}>
              분양률별 상환 가능성 분석 | 단위: 천원
            </div>
          </div>

          {/* 미분양 담보대출 입력 */}
          <div style={{ marginBottom:'16px', padding:'10px', background:'#f9f9f9', border:'1px solid #ddd', borderRadius:'6px' }}>
            <div style={{ fontSize:'11px', fontWeight:'bold', marginBottom:'6px', color:'#555' }}>🔧 미분양 담보대출 입력 (선택)</div>
            <div style={{ display:'flex', gap:'16px', alignItems:'center', fontSize:'11px' }}>
              <label>대출금액: 
                <input type="number" value={collateralLoan} onChange={e => setCollateralLoan(parseFloat(e.target.value)||0)}
                  style={{ marginLeft:'6px', width:'110px', padding:'3px 6px', border:'1px solid #bbb', borderRadius:'3px' }} />
                <span style={{ marginLeft:'4px', color:'#888' }}>천원</span>
              </label>
              <label>금리: 
                <input type="number" value={collateralRate} step="0.1" onChange={e => setCollateralRate(parseFloat(e.target.value)||0)}
                  style={{ marginLeft:'6px', width:'55px', padding:'3px 6px', border:'1px solid #bbb', borderRadius:'3px' }} />
                <span style={{ marginLeft:'4px', color:'#888' }}>%</span>
              </label>
              <label>기간: 
                <input type="number" value={collateralMonths} onChange={e => setCollateralMonths(parseInt(e.target.value)||0)}
                  style={{ marginLeft:'6px', width:'45px', padding:'3px 6px', border:'1px solid #bbb', borderRadius:'3px' }} />
                <span style={{ marginLeft:'4px', color:'#888' }}>개월</span>
              </label>
              <div style={{ marginLeft:'auto', color:'#555' }}>
                담보대출비용: <strong>{fmtN(cost4_collateralInterest)}</strong> 천원
              </div>
            </div>
          </div>

          {/* 데이터 없음 안내 */}
          {(!monthlyPayments || (monthlyPayments.months||[]).length === 0) && (
            <div style={{ padding:'30px', textAlign:'center', color:'#aaa', border:'2px dashed #ddd', borderRadius:'8px', marginBottom:'16px' }}>
              💡 사업비 탭을 먼저 방문하면 데이터가 자동으로 연동됩니다.
            </div>
          )}

          {/* 시나리오 A: 상가 포함 */}
          {renderTable(scenarioA, saleWithStore, '시나리오 A: 상가 포함 분양률 기준')}
          {/* 시나리오 B: 상가 제외 */}
          {renderTable(scenarioB, saleNoStore,   '시나리오 B: 상가 제외 분양률 기준')}

          {/* 하단 요약 */}
          <div style={{ marginTop:'16px', padding:'10px', background:'#f5f5f5', border:'1px solid #ccc', borderRadius:'6px', fontSize:'11px', color:'#555' }}>
            <div><strong>※ 분양률 해석</strong></div>
            <div style={{ marginTop:'4px' }}>• <strong>F:</strong> 분양불공사비 지급 가능 분양률 (분양 연동 지출 시작)</div>
            <div>• <strong>G:</strong> PF 대출상환 완료 분양률 (⭐ 금융기관/시공사 EXIT)</div>
            <div>• <strong>H:</strong> 잔여공사비 지급 완료 분양률</div>
            <div>• <strong>I:</strong> Equity 회수 가능 분양률 (시행사 원금 회수)</div>
            <div>• <strong>L:</strong> 현재 사업계획상 100% 분양 기준</div>
          </div>
        </div>
      )}
    </div>
  );
}
