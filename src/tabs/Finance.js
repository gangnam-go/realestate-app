import React, { useState, useRef } from 'react';
import { formatNumber } from '../utils';

// ─────────────────────────────────────────────
// 유틸
// ─────────────────────────────────────────────
const pn = (v) => parseFloat(String(v || '').replace(/,/g, '')) || 0;
const fmt = (v) => v > 0 ? formatNumber(Math.round(v)) : '—';

// VAT 포함 금액 계산
const withVat = (amt, taxable) => taxable ? Math.round(amt * 1.1) : amt;

// 재원조달 비율 → VAT포함 금액 기준으로 배분
const getFunding = (funding, amtWithVat) => {
  const f = funding || { equity: '0', pf: '100', sale: '0' };
  return {
    pf:     Math.round(amtWithVat * (parseFloat(f.pf)     || 0) / 100),
    sale:   Math.round(amtWithVat * (parseFloat(f.sale)   || 0) / 100),
    equity: Math.round(amtWithVat * (parseFloat(f.equity) || 0) / 100),
  };
};

// ─────────────────────────────────────────────
// 세부항목 추출 — xxxResult(계산값) + xxxData(funding/taxable) 조합
// VAT 포함 기준 (실제 지출 금액)
// ─────────────────────────────────────────────
const buildCategories = ({
  landResult, landData,
  directResult, directData, paymentSchedule,
  indirectResult, indirectData,
  consultResult, consultData,
  salesCostResult, salesCostData,
  overheadResult, overheadData,
  taxResult, taxData,
}) => {

  // ── 1. 토지관련비용 ──
  const landItems = [];
  const lr = landResult || {};
  const addLand = (name, supply, fKey, taxableKey) => {
    if (supply <= 0) return;
    const taxable = !!landData?.[taxableKey];
    const amt = withVat(supply, taxable);
    landItems.push({ name, supply, vat: amt - supply, amt, ...getFunding(landData?.[fKey], amt), retain: 0 });
  };
  addLand('토지매입비',       lr.landAmt  || 0, 'land_funding',  'land_taxable');
  addLand('취득세',           lr.acqAmt   || 0, 'acq_funding',   'acq_taxable');
  addLand('국민주택채권할인', lr.bondAmt  || 0, 'bond_funding',  'bond_taxable');
  addLand('법무사/등기비',    lr.legalAmt || 0, 'legal_funding', 'legal_taxable');
  addLand('중개수수료',       lr.agentAmt || 0, 'agent_funding', 'agent_taxable');
  (landData?.etcItems || []).filter(it => pn(it.amt) > 0).forEach(it => {
    const supply = pn(it.amt);
    const amt = withVat(supply, !!it.taxable);
    landItems.push({ name: it.name || '기타', supply, vat: amt - supply, amt, ...getFunding(it.funding, amt), retain: 0 });
  });

  // ── 2. 직접공사비 ──
  const directItems = [];
  const dr = directResult || {};
  const constAmt_s = dr.constAmt || dr.total || 0;
  const retainPct  = parseFloat(paymentSchedule?.direct_retain_pct ?? '0') || 0;
  const retainAmt  = Math.round(constAmt_s * retainPct / 100);
  if (constAmt_s > 0) {
    const taxable = !!directData?.const_taxable;
    const amt = withVat(constAmt_s, taxable);
    directItems.push({ name: '건축공사비', supply: constAmt_s, vat: amt - constAmt_s, amt, ...getFunding(directData?.const_funding, amt), retain: retainAmt });
  }
  (directData?.etcItems || []).filter(it => pn(it.amt) > 0).forEach(it => {
    const supply = pn(it.amt);
    const amt = withVat(supply, !!it.taxable);
    directItems.push({ name: it.name || '기타', supply, vat: amt - supply, amt, ...getFunding(it.funding, amt), retain: 0 });
  });

  // ── 3. 간접공사비 ──
  const indirectItems = [];
  const ir = indirectResult || {};
  const addInd = (name, supply, fKey, taxableKey) => {
    if (supply <= 0) return;
    const taxable = !!indirectData?.[taxableKey];
    const amt = withVat(supply, taxable);
    indirectItems.push({ name, supply, vat: amt - supply, amt, ...getFunding(indirectData?.[fKey], amt), retain: 0 });
  };
  addInd('인허가비',        ir.permitAmt || 0, 'permit_funding', 'permit_taxable');
  addInd('철거비',          ir.demolAmt  || 0, 'demol_funding',  'demol_taxable');
  addInd('각종부담금',      ir.utilAmt   || 0, 'util_funding',   'util_taxable');
  addInd('미술작품설치비',  ir.artAmt    || 0, 'art_funding',    'art_taxable');
  (indirectData?.etcItems || []).filter(it => pn(it.amt) > 0).forEach(it => {
    const supply = pn(it.amt);
    const amt = withVat(supply, !!it.taxable);
    indirectItems.push({ name: it.name || '기타', supply, vat: amt - supply, amt, ...getFunding(it.funding, amt), retain: 0 });
  });

  // ── 4. 용역비 ──
  const consultItems = [];
  const cr = consultResult || {};
  const addCon = (name, supply, fKey, taxableKey) => {
    if (supply <= 0) return;
    const taxable = !!consultData?.[taxableKey];
    const amt = withVat(supply, taxable);
    consultItems.push({ name, supply, vat: amt - supply, amt, ...getFunding(consultData?.[fKey], amt), retain: 0 });
  };
  addCon('설계비',          cr.designAmt   || 0, 'design_funding',   'design_taxable');
  addCon('감리비',          cr.superAmt    || 0, 'super_funding',    'super_taxable');
  addCon('CM비',            cr.cmAmt       || 0, 'cm_funding',       'cm_taxable');
  addCon('각종 영향평가비', cr.assessAmt   || 0, 'assess_funding',   'assess_taxable');
  addCon('인테리어설계비',  cr.interiorAmt || 0, 'interior_funding', 'interior_taxable');
  (consultData?.etcItems || []).filter(it => pn(it.amt) > 0).forEach(it => {
    const supply = pn(it.amt);
    const amt = withVat(supply, !!it.taxable);
    consultItems.push({ name: it.name || '기타', supply, vat: amt - supply, amt, ...getFunding(it.funding, amt), retain: 0 });
  });

  // ── 5. 판매비 ──
  const salesItems = [];
  const sr = salesCostResult || {};
  const addSal = (name, supply, fKey, taxableKey) => {
    if (supply <= 0) return;
    const taxable = !!salesCostData?.[taxableKey];
    const amt = withVat(supply, taxable);
    salesItems.push({ name, supply, vat: amt - supply, amt, ...getFunding(salesCostData?.[fKey], amt), retain: 0 });
  };
  addSal('모델하우스 임차비',    sr.mhRentAmt      || 0, 'mhRent_funding',    'mhRent_taxable');
  addSal('모델하우스 설치비',    sr.mhInstAmt      || 0, 'mhInst_funding',    'mhInst_taxable');
  addSal('모델하우스 운영비',    sr.mhOperAmt      || 0, 'mhOper_funding',    'mhOper_taxable');
  addSal('광고비',              sr.adAmt          || 0, 'ad_funding',        'ad_taxable');
  addSal('분양대행수수료(주거)', sr.agentAptAmt2   || 0, 'agentApt_funding',  'agentApt_taxable');
  addSal('분양대행수수료(오피)', sr.agentOffiAmt2  || 0, 'agentOffi_funding', 'agentOffi_taxable');
  addSal('분양대행수수료(상가)', sr.agentStoreAmt2 || 0, 'agentStore_funding','agentStore_taxable');
  addSal('HUG 분양보증수수료',   sr.hugAmt2        || 0, 'hug_funding',       'hug_taxable');
  (salesCostData?.etcItems || []).filter(it => pn(it.amt) > 0).forEach(it => {
    const supply = pn(it.amt);
    const amt = withVat(supply, !!it.taxable);
    salesItems.push({ name: it.name || '기타', supply, vat: amt - supply, amt, ...getFunding(it.funding, amt), retain: 0 });
  });

  // ── 6. 부대비 ──
  const overheadItems = [];
  const or2 = overheadResult || {};
  const addOvr = (name, supply, fKey, taxableKey) => {
    if (supply <= 0) return;
    const taxable = !!overheadData?.[taxableKey];
    const amt = withVat(supply, taxable);
    overheadItems.push({ name, supply, vat: amt - supply, amt, ...getFunding(overheadData?.[fKey], amt), retain: 0 });
  };
  addOvr('관리신탁수수료', or2.trustAmt   || 0, 'trust_funding',   'trust_taxable');
  addOvr('시행사운영비',   or2.operAmt    || 0, 'oper_funding',    'oper_taxable');
  addOvr('입주관리비',     or2.moveAmt    || 0, 'move_funding',    'move_taxable');
  // 예비비: 항상 Equity 100% 고정
  if ((or2.reserveAmt || 0) > 0) {
    const supply = or2.reserveAmt;
    const taxable = !!overheadData?.reserve_taxable;
    const amt = withVat(supply, taxable);
    overheadItems.push({ name:'예비비', supply, vat: amt - supply, amt,
      ...getFunding({ equity:'100', pf:'0', sale:'0' }, amt), retain: 0 });
  }
  (overheadData?.etcItems || []).filter(it => pn(it.amt) > 0).forEach(it => {
    const supply = pn(it.amt);
    const amt = withVat(supply, !!it.taxable);
    overheadItems.push({ name: it.name || '기타', supply, vat: amt - supply, amt, ...getFunding(it.funding, amt), retain: 0 });
  });

  // ── 7. 제세금 ──
  const taxItems = [];
  const tr = taxResult || {};
  const addTax = (name, supply, fKey, taxableKey) => {
    if (supply <= 0) return;
    const taxable = taxableKey ? !!taxData?.[taxableKey] : false;
    const amt = withVat(supply, taxable);
    taxItems.push({ name, supply, vat: amt - supply, amt, ...getFunding(taxData?.[fKey], amt), retain: 0 });
  };
  addTax('보존등기비',                tr.regAmt       || 0, 'reg_funding',       'reg_taxable');
  addTax('광역교통시설부담금',        tr.transAmt     || 0, 'trans_funding',     'trans_taxable');
  addTax('학교용지부담금',            tr.schoolAmt    || 0, 'school_funding',    'school_taxable');
  addTax('도시가스시설분담금',        tr.gasAmt       || 0, 'gas_funding',       'gas_taxable');
  addTax('상수도원인자부담금',        tr.waterAmt     || 0, 'water_funding',     'water_taxable');
  addTax('하수도원인자부담금',        tr.sewerAmt     || 0, 'sewer_funding',     'sewer_taxable');
  addTax('건축허가 국민주택채권할인', tr.bondBuildAmt || 0, 'bondBuild_funding', 'bondBuild_taxable');
  addTax('재산세',                    tr.propTaxAmt   || 0, 'propTax_funding',   null); // 면세
  addTax('종합부동산세',              tr.compTaxAmt   || 0, 'compTax_funding',   null); // 면세
  (taxData?.etcItems || []).filter(it => pn(it.amt) > 0).forEach(it => {
    const supply = pn(it.amt);
    const amt = withVat(supply, !!it.taxable);
    taxItems.push({ name: it.name || '기타', supply, vat: amt - supply, amt, ...getFunding(it.funding, amt), retain: 0 });
  });

  return [
    { cat: '(1) 토지관련비용', items: landItems },
    { cat: '(2) 직접공사비',   items: directItems },
    { cat: '(3) 간접공사비',   items: indirectItems },
    { cat: '(4) 용역비',       items: consultItems },
    { cat: '(5) 판매비',       items: salesItems },
    { cat: '(6) 부대비',       items: overheadItems },
    { cat: '(7) 제세금',       items: taxItems },
  ];
};

const sumItems = (items) => items.reduce(
  (s, it) => ({ amt: s.amt+it.amt, pf: s.pf+it.pf, sale: s.sale+it.sale, equity: s.equity+it.equity, retain: s.retain+it.retain }),
  { amt: 0, pf: 0, sale: 0, equity: 0, retain: 0 }
);

// ─────────────────────────────────────────────
// 사업비 재원조달 팝업
// ─────────────────────────────────────────────
function FundingModal({ onClose, projectName, ...props }) {
  const printRef = useRef();
  const categories = buildCategories(props);
  const financeData   = props.financeData   || {};
  const cashFlowResult = props.cashFlowResult || null;
  const pnv_ = (v) => parseFloat(String(v||'').replace(/,/g,''))||0;
  // 금융비 계산
  const ltv_ = financeData?.ltvCalc || {};
  const getT_ = (name) => (ltv_.tranches||[]).find(t=>t.name?.includes(name))||{};
  const d_ = financeData?.financeCost || {};
  const seniorAmt_ = pnv_(getT_('선순위').savedAmt||0);
  const mezAmt_    = pnv_(getT_('중순위').savedAmt||0);
  const juniorAmt_ = pnv_(getT_('후순위').savedAmt||0);
  const totalPF_   = seniorAmt_ + mezAmt_ + juniorAmt_;
  // 항목별 금융비 계산
  const mgmtAmt_      = Math.round(totalPF_ * pnv_(d_.mgmtPct) / 100);
  const seniorFeeAmt_ = Math.round(seniorAmt_ * pnv_(d_.seniorFee) / 100);
  const mezFeeAmt_    = Math.round(mezAmt_    * pnv_(d_.mezFee)    / 100);
  const juniorFeeAmt_ = Math.round(juniorAmt_ * pnv_(d_.juniorFee) / 100);
  const feeAmt_       = mgmtAmt_ + seniorFeeAmt_ + mezFeeAmt_ + juniorFeeAmt_;
  const seniorIntAmt_ = cashFlowResult
    ? cashFlowResult.result.reduce((s,r)=>s+(r.intS||0),0)
    : Math.round(seniorAmt_ * parseFloat(getT_('선순위').rate||0) / 100);
  const mezIntAmt_    = cashFlowResult
    ? cashFlowResult.result.reduce((s,r)=>s+(r.intM||0),0)
    : Math.round(mezAmt_ * parseFloat(getT_('중순위').rate||0) / 100);
  const juniorIntAmt_ = cashFlowResult
    ? cashFlowResult.result.reduce((s,r)=>s+(r.intJ||0),0)
    : 0;
  const midIntAmt_    = cashFlowResult
    ? cashFlowResult.result.reduce((s,r)=>s+(r.midInt||0),0)
    : (() => {
        const ymList_=props.salesData?.ymList||[];
        const am_=props.salesData?.aptMidMonthly||[], om_=props.salesData?.offiMidMonthly||[];
        const ab_=props.salesData?.aptBalMonthly||[], ob_=props.salesData?.offiBalMonthly||[];
        const tm_=[...am_,...om_].reduce((s,v)=>s+(v||0),0);
        const tb_=[...ab_,...ob_].reduce((s,v)=>s+(v||0),0);
        let acc=0,rep=0,tot=0;
        const mr=pnv_(d_.midRate)/100/12;
        ymList_.forEach((_,i)=>{ acc+=(am_[i]||0)+(om_[i]||0); const b=(ab_[i]||0)+(ob_[i]||0); if(tb_>0&&b>0)rep+=Math.round(tm_*b/tb_); tot+=Math.round(Math.max(0,acc-rep)*mr); });
        return tot;
      })();
  const intAmt_       = seniorIntAmt_ + mezIntAmt_ + juniorIntAmt_ + midIntAmt_;
  const finTotalAmt_  = feeAmt_ + intAmt_;
  const cfLabel_      = cashFlowResult ? '실계산값' : '';
  const catSums = categories.map(cat => ({ ...cat, sum: sumItems(cat.items) }));
  const grand = catSums.reduce(
    (s, c) => ({ amt: s.amt+c.sum.amt, pf: s.pf+c.sum.pf, sale: s.sale+c.sum.sale, equity: s.equity+c.sum.equity, retain: s.retain+c.sum.retain }),
    { amt: 0, pf: 0, sale: 0, equity: 0, retain: 0 }
  );

  const handlePrint = () => {
    // 인쇄용 CSS를 head에 주입
    const styleId = 'funding-print-style';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.innerHTML = `
        @media print {
          body > * { display: none !important; }
          #funding-print-area { display: block !important; }
          @page { margin: 12mm; size: A4; }
        }
        #funding-print-area { display: none; }
      `;
      document.head.appendChild(style);
    }

    // 인쇄용 DOM 생성
    const existing = document.getElementById('funding-print-area');
    if (existing) existing.remove();

    const fmtN2 = (v) => v > 0 ? formatNumber(Math.round(v)) : '—';
    const thStyle = 'background:#222;color:white;padding:6px 8px;text-align:right;font-size:11px;border-bottom:2px solid #444;';
    const thStyleL = thStyle + 'text-align:left;';

    const div = document.createElement('div');
    div.id = 'funding-print-area';
    div.innerHTML = `
      <h2 style="font-size:17px;font-weight:bold;text-align:center;margin-bottom:3px;font-family:'Malgun Gothic',sans-serif;">사업비 재원조달 상세</h2>
      <div style="text-align:center;font-size:11px;color:#555;margin-bottom:22px;font-family:'Malgun Gothic',sans-serif;">
        ${projectName} | ${new Date().toLocaleDateString('ko-KR')} | 단위: 천원 (VAT 포함)
      </div>
      <table style="width:100%;border-collapse:collapse;font-family:'Malgun Gothic',sans-serif;font-size:11px;">
        <thead>
          <tr>
            <th style="${thStyleL}">항목</th>
            <th style="${thStyle}">합계(VAT포함)</th>
            <th style="${thStyle}color:#aed6f1;">필수사업비</th>
            <th style="${thStyle}color:#a9dfbf;">분양불</th>
            <th style="${thStyle}color:#d7bde2;">Equity</th>
            <th style="${thStyle}color:#f5cba7;">준공불</th>
          </tr>
        </thead>
        <tbody>
          ${catSums.map(cat => `
            <tr style="background:#e8e8e8;">
              <td style="padding:6px 8px;font-weight:bold;border-top:1.5px solid #999;border-bottom:1px solid #ddd;text-align:left;">${cat.cat}</td>
              <td style="padding:6px 8px;font-weight:bold;border-top:1.5px solid #999;border-bottom:1px solid #ddd;text-align:right;">${formatNumber(Math.round(cat.sum.amt))}</td>
              <td style="padding:6px 8px;font-weight:bold;border-top:1.5px solid #999;border-bottom:1px solid #ddd;text-align:right;">${fmtN2(cat.sum.pf)}</td>
              <td style="padding:6px 8px;font-weight:bold;border-top:1.5px solid #999;border-bottom:1px solid #ddd;text-align:right;">${fmtN2(cat.sum.sale)}</td>
              <td style="padding:6px 8px;font-weight:bold;border-top:1.5px solid #999;border-bottom:1px solid #ddd;text-align:right;">${fmtN2(cat.sum.equity)}</td>
              <td style="padding:6px 8px;font-weight:bold;border-top:1.5px solid #999;border-bottom:1px solid #ddd;text-align:right;">${fmtN2(cat.sum.retain)}</td>
            </tr>
            ${cat.items.map((it, i) => `
              <tr style="background:${i%2===0?'white':'#fafafa'};">
                <td style="padding:5px 8px;padding-left:20px;border-bottom:1px solid #e8e8e8;text-align:left;color:#333;">
                  ${it.name}${it.vat > 0 ? ` <span style="font-size:9px;color:#888;">(공급 ${formatNumber(it.supply)} + VAT ${formatNumber(it.vat)})</span>` : ''}
                </td>
                <td style="padding:5px 8px;border-bottom:1px solid #e8e8e8;text-align:right;">${formatNumber(it.amt)}</td>
                <td style="padding:5px 8px;border-bottom:1px solid #e8e8e8;text-align:right;color:#1a5276;">${fmtN2(it.pf)}</td>
                <td style="padding:5px 8px;border-bottom:1px solid #e8e8e8;text-align:right;color:#1a6a3a;">${fmtN2(it.sale)}</td>
                <td style="padding:5px 8px;border-bottom:1px solid #e8e8e8;text-align:right;color:#6a1b9a;">${fmtN2(it.equity)}</td>
                <td style="padding:5px 8px;border-bottom:1px solid #e8e8e8;text-align:right;color:#7d3c00;">${fmtN2(it.retain)}</td>
              </tr>`).join('')}
          `).join('')}
        </tbody>
        <tfoot>
          <tr style="page-break-before:always;">
            <td style="padding:9px 8px;background:#222;color:white;font-weight:bold;font-size:12px;text-align:left;">총 합계</td>
            <td style="padding:9px 8px;background:#222;color:white;font-weight:bold;font-size:12px;text-align:right;">${formatNumber(Math.round(grand.amt))}</td>
            <td style="padding:9px 8px;background:#222;color:#aed6f1;font-weight:bold;font-size:12px;text-align:right;">${fmtN2(grand.pf)}</td>
            <td style="padding:9px 8px;background:#222;color:#a9dfbf;font-weight:bold;font-size:12px;text-align:right;">${fmtN2(grand.sale)}</td>
            <td style="padding:9px 8px;background:#222;color:#d7bde2;font-weight:bold;font-size:12px;text-align:right;">${fmtN2(grand.equity)}</td>
            <td style="padding:9px 8px;background:#222;color:#f5cba7;font-weight:bold;font-size:12px;text-align:right;">${fmtN2(grand.retain)}</td>
          </tr>
        </tfoot>
      </table>
      <div style="margin-top:12px;font-size:11px;color:#444;font-family:'Malgun Gothic',sans-serif;display:flex;gap:20px;flex-wrap:wrap;">
        ${[
          { label:'필수사업비', val: grand.pf,     color:'#1a5276' },
          { label:'분양불',    val: grand.sale,   color:'#1a6a3a' },
          { label:'Equity',    val: grand.equity, color:'#6a1b9a' },
          { label:'준공불',    val: grand.retain, color:'#7d3c00' },
        ].filter(x => x.val > 0).map(x =>
          `<span style="color:${x.color};font-weight:bold;">■ ${x.label}</span> ${formatNumber(Math.round(x.val))}천원${grand.amt > 0 ? ` (${(x.val/grand.amt*100).toFixed(1)}%)` : ''}`
        ).join('&nbsp;&nbsp;&nbsp;')}
      </div>
    `;
    document.body.appendChild(div);
    setTimeout(() => {
      window.print();
      setTimeout(() => { div.remove(); }, 1000);
    }, 200);
  };

  const thS = (align, color = 'white') => ({
    padding: '7px 10px', backgroundColor: '#1a1a2e', color,
    fontWeight: 'bold', fontSize: '11px', textAlign: align,
    borderBottom: '2px solid #444', whiteSpace: 'nowrap',
  });
  const tdCat = (align = 'right') => ({
    padding: '6px 10px', backgroundColor: '#f0f2f5',
    fontWeight: 'bold', fontSize: '12px', textAlign: align,
    borderTop: '1.5px solid #bbb', borderBottom: '1px solid #ddd',
  });
  const tdItem = (align = 'right', color = '#333') => ({
    padding: '5px 10px', fontSize: '11px', textAlign: align, color,
    borderBottom: '1px solid #f0f0f0',
  });
  const tdGrand = (align = 'right', color = 'white') => ({
    padding: '9px 10px', backgroundColor: '#1a1a2e',
    fontWeight: 'bold', fontSize: '13px', textAlign: align, color,
  });

  return (
    <div style={{ position:'fixed', top:0, left:0, width:'100vw', height:'100vh',
      backgroundColor:'rgba(0,0,0,0.6)', zIndex:5000,
      display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ backgroundColor:'white', borderRadius:'10px',
        width:'96%', maxWidth:'860px', maxHeight:'92vh', overflowY:'auto',
        padding:'24px', boxShadow:'0 12px 48px rgba(0,0,0,0.4)' }}>

        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'16px' }}>
          <div>
            <h3 style={{ margin:0, fontSize:'16px', color:'#1a1a2e' }}>■ 사업비 재원조달</h3>
            <div style={{ fontSize:'11px', color:'#888', marginTop:'3px' }}>단위: 천원 (VAT 포함 기준)</div>
          </div>
          <div style={{ display:'flex', gap:'8px' }}>
            <button onClick={handlePrint}
              style={{ padding:'7px 16px', backgroundColor:'#2c3e50', color:'white',
                border:'none', borderRadius:'6px', cursor:'pointer', fontSize:'12px', fontWeight:'bold' }}>
              🖨 인쇄
            </button>
            <button onClick={onClose}
              style={{ padding:'7px 14px', border:'1px solid #ddd', borderRadius:'6px',
                cursor:'pointer', fontSize:'12px', backgroundColor:'white' }}>
              ✕ 닫기
            </button>
          </div>
        </div>

        <div ref={printRef}>
          <h2 style={{ textAlign:'center', fontSize:'18px', fontWeight:'bold', marginBottom:'4px' }}>
            사업비 재원조달 상세
          </h2>
          <div style={{ textAlign:'center', fontSize:'12px', color:'#666', marginBottom:'20px' }}>
            {projectName} | {new Date().toLocaleDateString('ko-KR')} | 단위: 천원 (VAT 포함)
          </div>

          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr>
                <th style={thS('left')}>항목</th>
                <th style={thS('right')}>합계(VAT포함)</th>
                <th style={thS('right', '#aed6f1')}>필수사업비</th>
                <th style={thS('right', '#a9dfbf')}>분양불</th>
                <th style={thS('right', '#d7bde2')}>Equity</th>
                <th style={thS('right', '#f5cba7')}>준공불</th>
              </tr>
            </thead>
            <tbody>
              {catSums.map((cat) => (
                <React.Fragment key={cat.cat}>
                  <tr>
                    <td style={tdCat('left')}>{cat.cat}</td>
                    <td style={tdCat()}>{formatNumber(Math.round(cat.sum.amt))}</td>
                    <td style={tdCat()}>{fmt(cat.sum.pf)}</td>
                    <td style={tdCat()}>{fmt(cat.sum.sale)}</td>
                    <td style={tdCat()}>{fmt(cat.sum.equity)}</td>
                    <td style={tdCat()}>{fmt(cat.sum.retain)}</td>
                  </tr>
                  {cat.items.map((it, i) => (
                    <tr key={i} style={{ backgroundColor: i%2===0 ? 'white' : '#fafafa' }}>
                      <td style={{ ...tdItem('left'), paddingLeft:'24px' }}>
                        {it.name}
                        {it.vat > 0 && (
                          <span style={{ fontSize:'9px', color:'#e67e22', marginLeft:'6px' }}>
                            공급 {formatNumber(it.supply)} + VAT {formatNumber(it.vat)}
                          </span>
                        )}
                      </td>
                      <td style={tdItem('right', '#2c3e50')}>{formatNumber(it.amt)}</td>
                      <td style={tdItem('right', '#1a5276')}>{fmt(it.pf)}</td>
                      <td style={tdItem('right', '#1a6a3a')}>{fmt(it.sale)}</td>
                      <td style={tdItem('right', '#6a1b9a')}>{fmt(it.equity)}</td>
                      <td style={tdItem('right', '#7d3c00')}>{fmt(it.retain)}</td>
                    </tr>
                  ))}
                </React.Fragment>
              ))}
            </tbody>
            {/* 금융비 행 - 항목별 */}
            {finTotalAmt_ > 0 && (
              <tbody>
                <tr>
                  <td style={{ ...tdCat('left'), color:'#e67e22' }}>금융비{cfLabel_?' ':''}<span style={{fontSize:'10px',fontWeight:'normal',color:'#27ae60'}}>{cfLabel_}</span></td>
                  <td style={tdCat()}>{formatNumber(finTotalAmt_)}</td>
                  <td style={{ ...tdCat(), color:'#1a5276' }}>{fmt(feeAmt_)}</td>
                  <td style={{ ...tdCat(), color:'#1a6a3a' }}>{fmt(intAmt_)}</td>
                  <td style={tdCat()}>—</td>
                  <td style={tdCat()}>—</td>
                </tr>
                {[
                  { num:'①', label:'주관사수수료',     amt:mgmtAmt_,      pf:mgmtAmt_,      sale:0,          note:'PF총액×'+d_.mgmtPct+'%' },
                  { num:'②', label:'선순위 이자',       amt:seniorIntAmt_, pf:0,             sale:seniorIntAmt_, note:seniorAmt_>0?`선순위×${getT_('선순위').rate}%`:'—' },
                  { num:'③', label:'중순위 이자',       amt:mezIntAmt_,    pf:0,             sale:mezIntAmt_,    note:mezAmt_>0?`중순위×${getT_('중순위').rate}%`:'—' },
                  { num:'④', label:'후순위 이자',       amt:juniorIntAmt_, pf:0,             sale:juniorIntAmt_, note:juniorAmt_>0?`후순위×${getT_('후순위').rate}%`:'미설정' },
                  { num:'⑤', label:'선순위 취급수수료', amt:seniorFeeAmt_, pf:seniorFeeAmt_, sale:0,          note:`선순위×${d_.seniorFee||0}%` },
                  { num:'⑥', label:'중순위 취급수수료', amt:mezFeeAmt_,    pf:mezFeeAmt_,    sale:0,          note:`중순위×${d_.mezFee||0}%` },
                  { num:'⑦', label:'후순위 취급수수료', amt:juniorFeeAmt_, pf:juniorFeeAmt_, sale:0,          note:`후순위×${d_.juniorFee||0}%` },
                  { num:'⑧', label:'중도금 무이자',     amt:midIntAmt_,    pf:0,             sale:midIntAmt_,    note:`중도금잔액×${d_.midRate||0}%` },
                ].filter(r=>r.amt>0).map((r,ri)=>(
                  <tr key={ri} style={{ backgroundColor: ri%2===0?'white':'#fafafa' }}>
                    <td style={{ paddingLeft:'24px', padding:'5px 8px', fontSize:'11px', color:'#555' }}>
                      {r.num} {r.label}
                      <span style={{fontSize:'9px',color:'#aaa',marginLeft:'6px'}}>{r.note}</span>
                    </td>
                    <td style={{ padding:'5px 8px', textAlign:'right', fontSize:'11px', fontWeight:'bold' }}>{formatNumber(r.amt)}</td>
                    <td style={{ padding:'5px 8px', textAlign:'right', fontSize:'11px', color:'#1a5276' }}>{r.pf>0?formatNumber(r.pf):'—'}</td>
                    <td style={{ padding:'5px 8px', textAlign:'right', fontSize:'11px', color:'#1a6a3a' }}>{r.sale>0?formatNumber(r.sale):'—'}</td>
                    <td style={{ padding:'5px 8px', textAlign:'right', fontSize:'11px' }}>—</td>
                    <td style={{ padding:'5px 8px', textAlign:'right', fontSize:'11px' }}>—</td>
                  </tr>
                ))}
              </tbody>
            )}
            <tfoot>
              <tr>
                <td style={tdGrand('left')}>총 합계</td>
                <td style={tdGrand()}>{formatNumber(Math.round(grand.amt) + finTotalAmt_)}</td>
                <td style={tdGrand('right', '#aed6f1')}>{fmt(grand.pf + feeAmt_)}</td>
                <td style={tdGrand('right', '#a9dfbf')}>{fmt(grand.sale + intAmt_)}</td>
                <td style={tdGrand('right', '#d7bde2')}>{fmt(grand.equity)}</td>
                <td style={tdGrand('right', '#f5cba7')}>{fmt(grand.retain)}</td>
              </tr>
            </tfoot>
          </table>

          <div style={{ marginTop:'12px', display:'flex', gap:'24px', flexWrap:'wrap', fontSize:'11px', color:'#555' }}>
            {[
              { label:'필수사업비', val:grand.pf,     color:'#1a5276' },
              { label:'분양불',    val:grand.sale,   color:'#1a6a3a' },
              { label:'Equity',    val:grand.equity, color:'#6a1b9a' },
              { label:'준공불',    val:grand.retain, color:'#7d3c00' },
            ].filter(x => x.val > 0).map(({ label, val, color }) => (
              <span key={label}>
                <span style={{ color, fontWeight:'bold' }}>■ {label}</span>
                {' '}{formatNumber(Math.round(val))}천원
                {grand.amt > 0 && ` (${(val/grand.amt*100).toFixed(1)}%)`}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// LTV 담보인정액 + 트랜치 계산기
// ─────────────────────────────────────────────
const DEFAULT_LTV = {
  bank:       { apt: 65, offi: 55, store: 45 },
  securities: { apt: 75, offi: 65, store: 55 },
};

const TRANCHE_COLORS = {
  선순위: { bg:'#1a3a5c', light:'#e8f0f8', border:'#2980b9', text:'#1a3a5c' },
  중순위: { bg:'#1a5c2a', light:'#e8f5ec', border:'#27ae60', text:'#1a5c2a' },
  후순위: { bg:'#7d3c00', light:'#fdf2e3', border:'#e67e22', text:'#7d3c00' },
};

function LTVModal({ onClose, salesData, incomeData, projectName, data, onChange }) {
  const printRef = useRef();

  // ── 분양매출 원천데이터 (천원) ──
  const aptSale   = Math.round((salesData?.salesSumApt   || 0) + (salesData?.salesSumBal || 0));
  const offiSale  = Math.round(salesData?.salesSumOffi  || 0);

  // 근린상가 층별 매출 (incomeData.storeRows에서 직접 계산)
  const storeRows = incomeData?.storeRows || [];
  const calcStoreRow = (row) => {
    const pn = (v) => parseFloat(String(v||'').replace(/,/g,''))||0;
    const excl=pn(row.excl_m2), wall=pn(row.wall_m2), core=pn(row.core_m2);
    const mgmt=pn(row.mgmt_m2), comm=pn(row.comm_m2), park=pn(row.park_m2);
    const tel=pn(row.tel_m2), elec=pn(row.elec_m2);
    const units=pn(row.units), pyPrice=pn(row.py_price);
    const cont_py = (excl+wall+core+mgmt+comm+park+tel+elec)*0.3025;
    return Math.round(pyPrice * cont_py * units);
  };
  const storeFloors = storeRows.map(r => ({
    type: r.type || '근린상가',
    sale: calcStoreRow(r),
  })).filter(r => r.sale > 0);
  const storeSaleTotal = storeFloors.reduce((s,r) => s+r.sale, 0);

  // 저장된 값 또는 기본값으로 초기화
  const saved = data?.ltvCalc || {};
  const [issuer,   setIssuer]   = useState(saved.issuer   || 'securities');
  const [ltv,      setLtv]      = useState(saved.ltv      || { apt: DEFAULT_LTV.securities.apt, offi: DEFAULT_LTV.securities.offi });
  const [storeLtv, setStoreLtv] = useState(saved.storeLtv ||
    Object.fromEntries(storeRows.map((_,i) => [i, DEFAULT_LTV.securities.store]))
  );
  const [tranches, setTranches] = useState(saved.tranches || [
    { name:'선순위', rate:'7.0',  rows:[{ use:'공동주택', pct:'100' }, { use:'오피스텔', pct:'100' }] },
    { name:'중순위', rate:'10.0', rows:[{ use:'근린상가', pct:'60' }] },
    { name:'후순위', rate:'18.0', rows:[{ use:'공동주택', pct:'0'   }] },
  ]);
  const [saving, setSaving] = useState(false);
  const [saved2,  setSaved2]  = useState(false); // 저장 완료 피드백

  const handleIssuer = (val) => {
    setIssuer(val);
    setLtv({ apt: DEFAULT_LTV[val].apt, offi: DEFAULT_LTV[val].offi });
    setStoreLtv(Object.fromEntries(storeRows.map((_,i) => [i, DEFAULT_LTV[val].store])));
  };

  const handleSave = async () => {
    if (!onChange) return;
    setSaving(true);
    // savedAmt가 이미 올림값으로 설정된 경우 유지, 아니면 계산값 저장
    const tranchesWithAmt = tranches.map((t, i) => ({
      ...t,
      savedAmt: t.savedAmt ? String(t.savedAmt) : String(trancheCalcs[i]?.amt || 0),
    }));
    onChange({ ...(data||{}), ltvCalc: { issuer, ltv, storeLtv, tranches: tranchesWithAmt } });
    setSaving(false);
    setSaved2(true);
    setTimeout(() => setSaved2(false), 2000);
  };

  // 담보인정액
  const collApt    = Math.round(aptSale  * ltv.apt  / 100);
  const collOffi   = Math.round(offiSale * ltv.offi / 100);
  const collFloors = storeFloors.map((r,i) => Math.round(r.sale * (storeLtv[i]||0) / 100));
  const collStore  = collFloors.reduce((s,v) => s+v, 0);
  const collTotal  = collApt + collOffi + collStore;

  // 트랜치 용도 옵션 + 담보인정액 맵
  const USE_OPTIONS_EXT = ['공동주택', '오피스텔', ...storeFloors.map(r => r.type)];
  const collMapExt = {
    '공동주택': collApt,
    '오피스텔': collOffi,
    ...Object.fromEntries(storeFloors.map((r,i) => [r.type, collFloors[i]])),
  };

  const updateTranche = (ti, key, val) =>
    setTranches(prev => prev.map((t,i) => i===ti ? { ...t, [key]: val } : t));
  const updateRow = (ti, ri, key, val) =>
    setTranches(prev => prev.map((t,i) => i===ti ? {
      ...t, rows: t.rows.map((r,j) => j===ri ? { ...r, [key]: val } : r)
    } : t));
  const addRow = (ti) =>
    setTranches(prev => prev.map((t,i) => i===ti ? {
      ...t, rows: [...t.rows, { use: USE_OPTIONS_EXT[0], pct:'' }]
    } : t));
  const removeRow = (ti, ri) =>
    setTranches(prev => prev.map((t,i) => i===ti ? {
      ...t, rows: t.rows.filter((_,j) => j!==ri)
    } : t));

  const calcTranche = (t) => {
    const amt = t.rows.reduce((s,r) => {
      const c = collMapExt[r.use] || 0;
      return s + Math.round(c * (parseFloat(r.pct)||0) / 100);
    }, 0);
    const rate = parseFloat(t.rate) || 0;
    return { amt, rate, interest: Math.round(amt * rate / 100) };
  };

  const trancheCalcs = tranches.map(calcTranche);
  const totalAmt      = trancheCalcs.reduce((s,c) => s+c.amt, 0);
  const totalInterest = trancheCalcs.reduce((s,c) => s+c.interest, 0);
  const avgRate       = totalAmt > 0 ? (totalInterest / totalAmt * 100) : 0;
  const diff          = collTotal - totalAmt;

  // 올림 함수 — 억 단위에서 5의 배수로 올림 (끝이 0억 또는 5억)
  // 예: 138.8억 → 140억 (14,000,000천원)
  //     794.1억 → 795억 (79,500,000천원)
  const ceilTo5Uk = (v) => {
    if (v <= 0) return 0;
    const uk = v / 100000;          // 천원 → 억원
    const ceiled = Math.ceil(uk / 5) * 5; // 5억 단위 올림
    return ceiled * 100000;         // 억원 → 천원
  };
  const trancheRounded = trancheCalcs.map((c) => ({
    ...c,
    amtRounded: ceilTo5Uk(c.amt),
  }));
  const totalRounded = trancheRounded.reduce((s,c) => s+c.amtRounded, 0);

  const fmtB = (v) => `${(v/100000).toFixed(1)}억`;
  const fmtN = (v) => formatNumber(Math.round(v));

  const handlePrint = () => {
    const fmtN = (v) => formatNumber(Math.round(v));
    const fmtB = (v) => `${(v/100000).toFixed(1)}억`;

    // 담보인정액 행 (0인 항목 제외)
    const ltvRows = [
      { label:'공동주택 (발코니확장 포함)', sale: aptSale,  coll: collApt,  ltv: ltv.apt,
        note: salesData?.salesSumBal > 0 ? `발코니 ${fmtN(salesData.salesSumBal)} 포함` : '' },
      { label:'오피스텔',                  sale: offiSale, coll: collOffi, ltv: ltv.offi },
    ].filter(r => r.sale > 0);

    // 근린상가 층별 (0인 항목 제외)
    const storeRowsPrint = storeFloors
      .map((r,i) => ({ label: r.type, sale: r.sale, coll: collFloors[i], ltv: storeLtv[i]||0 }))
      .filter(r => r.sale > 0);

    // 트랜치 (비중 0인 행 제외, 금액 0인 트랜치 제외)
    const tranchesPrint = tranches.map((t, ti) => {
      const calc = trancheCalcs[ti];
      const rows = t.rows.filter(r => parseFloat(r.pct) > 0);
      return { ...t, rows, calc };
    }).filter(t => t.calc.amt > 0);

    const totalAmtP      = tranchesPrint.reduce((s,t) => s+t.calc.amt, 0);
    const totalInterestP = tranchesPrint.reduce((s,t) => s+t.calc.interest, 0);
    const avgRateP       = totalAmtP > 0 ? (totalInterestP/totalAmtP*100) : 0;
    const diffP          = collTotal - totalAmtP;

    const trBg = { '선순위':'#1a3a5c', '중순위':'#1a5c2a', '후순위':'#7d3c00' };
    const tdBase = 'padding:5px 8px;border-bottom:1px solid #e0e0e0;text-align:right;font-size:11px;';

    const styleId = 'ltv-print-style';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.innerHTML = `
        @media print {
          body > * { display: none !important; }
          #ltv-print-area { display: block !important; }
          @page { margin: 12mm; size: A4; }
        }
        #ltv-print-area { display: none; }
      `;
      document.head.appendChild(style);
    }

    const existing = document.getElementById('ltv-print-area');
    if (existing) existing.remove();

    const div = document.createElement('div');
    div.id = 'ltv-print-area';
    div.style.fontFamily = "'Malgun Gothic', sans-serif";
    div.style.fontSize = '11px';
    div.style.color = '#111';

    div.innerHTML = `
      <h2 style="font-size:17px;font-weight:bold;text-align:center;margin-bottom:3px;">부동산 PF 담보인정액 · 트랜치 계산기</h2>
      <div style="text-align:center;font-size:11px;color:#555;margin-bottom:22px;">${projectName} | ${new Date().toLocaleDateString('ko-KR')} | 단위: 천원</div>

      <div style="font-weight:bold;font-size:12px;border-bottom:2px solid #222;padding-bottom:4px;margin:0 0 10px;">■ 주관사 선택</div>
      <div style="display:inline-block;border:1px solid #aaa;padding:5px 14px;border-radius:4px;font-size:11px;margin-bottom:14px;background:#f5f5f5;">
        ● ${issuer === 'bank' ? '은행' : '증권사'}
        &nbsp;|&nbsp; 적용 LTV: 공동주택 ${ltv.apt}% / 오피스텔 ${ltv.offi}%${storeFloors.length > 0 ? ' / ' + storeFloors.map((r,i) => `${r.type} ${storeLtv[i]||0}%`).join(' / ') : ''}
      </div>

      <div style="font-weight:bold;font-size:12px;border-bottom:2px solid #222;padding-bottom:4px;margin:14px 0 10px;">■ 용도별 분양매출 · LTV 입력</div>
      <table style="width:100%;border-collapse:collapse;margin-bottom:4px;">
        <thead><tr>
          <th style="background:#222;color:white;padding:6px 8px;text-align:left;font-size:11px;border-bottom:2px solid #444;">용도</th>
          <th style="background:#222;color:white;padding:6px 8px;text-align:right;font-size:11px;border-bottom:2px solid #444;">분양매출 (천원)</th>
          <th style="background:#222;color:white;padding:6px 8px;text-align:center;font-size:11px;border-bottom:2px solid #444;width:80px;">LTV (%)</th>
          <th style="background:#222;color:white;padding:6px 8px;text-align:right;font-size:11px;border-bottom:2px solid #444;">담보인정액 (천원)</th>
        </tr></thead>
        <tbody>
          ${ltvRows.map((r,i) => `
            <tr style="background:${i%2!==0?'#fafafa':'white'};">
              <td style="${tdBase}text-align:left;font-weight:bold;">
                ${r.label}${r.note?`<br><span style="font-size:9px;color:#888;font-weight:normal;">${r.note}</span>`:''}
              </td>
              <td style="${tdBase}">${fmtN(r.sale)}</td>
              <td style="${tdBase}text-align:center;font-weight:bold;">${r.ltv}%</td>
              <td style="${tdBase}font-weight:bold;">${fmtN(r.coll)}</td>
            </tr>`).join('')}
          ${storeRowsPrint.length > 0 ? `
            <tr style="background:#e8e8e8;"><td colspan="4" style="padding:5px 8px;font-weight:bold;border-top:1.5px solid #999;font-size:11px;">근린상가 (층별)</td></tr>
            ${storeRowsPrint.map((r,i) => `
              <tr style="background:${i%2!==0?'#fafafa':'white'};">
                <td style="${tdBase}text-align:left;padding-left:18px;">${r.label}</td>
                <td style="${tdBase}">${fmtN(r.sale)}</td>
                <td style="${tdBase}text-align:center;font-weight:bold;">${r.ltv}%</td>
                <td style="${tdBase}font-weight:bold;">${fmtN(r.coll)}</td>
              </tr>`).join('')}
            ${storeRowsPrint.length > 1 ? `
              <tr style="background:#f0f0f0;">
                <td style="${tdBase}text-align:left;padding-left:18px;font-weight:bold;">근린상가 소계</td>
                <td style="${tdBase}font-weight:bold;">${fmtN(storeSaleTotal)}</td>
                <td style="${tdBase}"></td>
                <td style="${tdBase}font-weight:bold;">${fmtN(collStore)}</td>
              </tr>` : ''}
          ` : ''}
        </tbody>
        <tfoot>
          <tr>
            <td colspan="2" style="padding:9px 8px;background:#222;color:white;font-weight:bold;font-size:12px;">담보인정액 합계</td>
            <td style="padding:9px 8px;background:#222;color:rgba(255,255,255,0.7);text-align:center;font-size:11px;">≈ ${fmtB(collTotal)}</td>
            <td style="padding:9px 8px;background:#222;color:#aed6f1;font-weight:bold;font-size:13px;text-align:right;">${fmtN(collTotal)}</td>
          </tr>
        </tfoot>
      </table>

      <div style="font-weight:bold;font-size:12px;border-bottom:2px solid #222;padding-bottom:4px;margin:18px 0 10px;">■ 트랜치 구성</div>
      <table style="width:100%;border-collapse:collapse;margin-bottom:4px;">
        <thead><tr>
          <th style="background:#222;color:white;padding:6px 8px;text-align:left;font-size:11px;border-bottom:2px solid #444;">트랜치</th>
          <th style="background:#222;color:white;padding:6px 8px;text-align:right;font-size:11px;border-bottom:2px solid #444;">금액 (천원)</th>
          <th style="background:#222;color:white;padding:6px 8px;text-align:right;font-size:11px;border-bottom:2px solid #444;">비중 (%)</th>
          <th style="background:#222;color:white;padding:6px 8px;text-align:right;font-size:11px;border-bottom:2px solid #444;">금리 (%)</th>
          <th style="background:#222;color:white;padding:6px 8px;text-align:right;font-size:11px;border-bottom:2px solid #444;">연간이자 (천원)</th>
          <th style="background:#222;color:white;padding:6px 8px;text-align:left;font-size:11px;border-bottom:2px solid #444;">구성항목</th>
        </tr></thead>
        <tbody>
          ${tranchesPrint.map(t => {
            const bg = trBg[t.name] || '#333';
            const desc = t.rows.map(r => `${r.use} ${r.pct}%`).join(' / ');
            const pct = totalAmtP > 0 ? (t.calc.amt/totalAmtP*100).toFixed(1) : '0.0';
            return `
              <tr style="background:${bg};color:white;">
                <td style="padding:7px 8px;font-weight:bold;text-align:left;">${t.name}</td>
                <td style="padding:7px 8px;font-weight:bold;text-align:right;">
                  ${fmtN(t.calc.amt)}<br><span style="font-size:9px;opacity:0.8;">≈ ${fmtB(t.calc.amt)}</span>
                </td>
                <td style="padding:7px 8px;text-align:right;">${pct}%</td>
                <td style="padding:7px 8px;text-align:right;">${t.rate}%</td>
                <td style="padding:7px 8px;font-weight:bold;text-align:right;">${fmtN(t.calc.interest)}</td>
                <td style="padding:7px 8px;text-align:left;">${desc}</td>
              </tr>`;
          }).join('')}
        </tbody>
        <tfoot>
          <tr>
            <td style="padding:9px 8px;background:#222;color:white;font-weight:bold;font-size:12px;">합 계</td>
            <td style="padding:9px 8px;background:#222;color:#aed6f1;font-weight:bold;font-size:12px;text-align:right;">${fmtN(totalAmtP)}</td>
            <td style="padding:9px 8px;background:#222;color:rgba(255,255,255,0.7);text-align:right;">100.0%</td>
            <td style="padding:9px 8px;background:#222;color:rgba(255,255,255,0.7);text-align:right;">${avgRateP.toFixed(1)}%</td>
            <td style="padding:9px 8px;background:#222;color:#f5cba7;font-weight:bold;font-size:12px;text-align:right;">${fmtN(totalInterestP)}</td>
            <td style="padding:9px 8px;background:#222;"></td>
          </tr>
        </tfoot>
      </table>

      ${Math.abs(diffP) > 0 ? `
        <div style="color:#c0392b;font-size:10px;margin-top:8px;padding:5px 8px;background:#fdecea;border:1px solid #f5b7b1;border-radius:3px;">
          ${diffP > 0
            ? `⚠ 담보인정액(${fmtN(collTotal)})이 트랜치 합계(${fmtN(totalAmtP)})보다 ${fmtN(diffP)}천원 미배분`
            : `⚠ 트랜치 합계(${fmtN(totalAmtP)})가 담보인정액(${fmtN(collTotal)})을 ${fmtN(-diffP)}천원 초과`}
        </div>` : ''}

      <div style="font-size:10px;color:#888;margin-top:14px;">※ LTV는 주관사 협의에 따라 변동될 수 있습니다. 담보인정액은 추정치입니다.</div>
    `;
    document.body.appendChild(div);
    setTimeout(() => {
      window.print();
      setTimeout(() => { div.remove(); }, 1000);
    }, 200);
  };

  const secTitle = (title, color='#1a1a2e') => (
    <div style={{ fontWeight:'bold', fontSize:'14px', color,
      borderBottom:`2px solid ${color}`, paddingBottom:'6px',
      marginBottom:'12px', marginTop:'20px' }}>
      {title}
    </div>
  );

  return (
    <div style={{ position:'fixed', top:0, left:0, width:'100vw', height:'100vh',
      backgroundColor:'rgba(0,0,0,0.6)', zIndex:5000,
      display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ backgroundColor:'white', borderRadius:'10px',
        width:'96%', maxWidth:'900px', maxHeight:'93vh', overflowY:'auto',
        padding:'24px', boxShadow:'0 12px 48px rgba(0,0,0,0.4)' }}>

        {/* 팝업 헤더 */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'16px' }}>
          <div>
            <h3 style={{ margin:0, fontSize:'16px', color:'#1a1a2e' }}>
              🏦 부동산 PF 담보인정액 · 트랜치 계산기
            </h3>
            <div style={{ fontSize:'11px', color:'#888', marginTop:'3px' }}>
              주관사 선택 → LTV 기본값 자동 세팅 | LTV · 비중 · 금리 직접 수정 가능
            </div>
          </div>
          <div style={{ display:'flex', gap:'8px' }}>
            <button onClick={handleSave}
              style={{ padding:'7px 16px',
                backgroundColor: saved2 ? '#27ae60' : '#2980b9',
                color:'white', border:'none', borderRadius:'6px',
                cursor:'pointer', fontSize:'12px', fontWeight:'bold' }}>
              {saving ? '저장 중...' : saved2 ? '✓ 저장됨' : '💾 저장'}
            </button>
            <button onClick={handlePrint}
              style={{ padding:'7px 16px', backgroundColor:'#2c3e50', color:'white',
                border:'none', borderRadius:'6px', cursor:'pointer', fontSize:'12px', fontWeight:'bold' }}>
              🖨 인쇄
            </button>
            <button onClick={onClose}
              style={{ padding:'7px 14px', border:'1px solid #ddd', borderRadius:'6px',
                cursor:'pointer', fontSize:'12px' }}>
              ✕ 닫기
            </button>
          </div>
        </div>

        <div ref={printRef}>
          <h2 style={{ textAlign:'center', fontSize:'17px', fontWeight:'bold', marginBottom:'4px' }}>
            부동산 PF 담보인정액 · 트랜치 계산기
          </h2>
          <div style={{ textAlign:'center', fontSize:'11px', color:'#666', marginBottom:'20px' }}>
            {projectName} | {new Date().toLocaleDateString('ko-KR')}
          </div>

          {/* ── 주관사 선택 ── */}
          {secTitle('■ 주관사 선택')}
          <div style={{ display:'flex', gap:'16px', marginBottom:'16px' }}>
            {[
              { val:'bank',       label:'은행',  desc:`공동주택 ${DEFAULT_LTV.bank.apt}% / 오피스텔 ${DEFAULT_LTV.bank.offi}% / 근린상가 ${DEFAULT_LTV.bank.store}%` },
              { val:'securities', label:'증권사', desc:`공동주택 ${DEFAULT_LTV.securities.apt}% / 오피스텔 ${DEFAULT_LTV.securities.offi}% / 근린상가 ${DEFAULT_LTV.securities.store}%` },
            ].map(opt => (
              <label key={opt.val} onClick={() => handleIssuer(opt.val)}
                style={{ flex:1, padding:'12px 16px',
                  border:`2px solid ${issuer===opt.val?'#1a3a5c':'#ddd'}`,
                  borderRadius:'8px', cursor:'pointer',
                  backgroundColor: issuer===opt.val ? '#e8f0f8' : 'white' }}>
                <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                  <div style={{ width:'16px', height:'16px', borderRadius:'50%',
                    border:`2px solid ${issuer===opt.val?'#1a3a5c':'#aaa'}`,
                    backgroundColor: issuer===opt.val?'#1a3a5c':'white',
                    display:'flex', alignItems:'center', justifyContent:'center' }}>
                    {issuer===opt.val && <div style={{ width:'6px', height:'6px', borderRadius:'50%', backgroundColor:'white' }} />}
                  </div>
                  <span style={{ fontWeight:'bold', fontSize:'13px', color: issuer===opt.val?'#1a3a5c':'#333' }}>
                    {opt.label}
                  </span>
                </div>
                <div style={{ fontSize:'11px', color:'#666', marginTop:'4px', paddingLeft:'24px' }}>
                  기준 LTV: {opt.desc}
                </div>
              </label>
            ))}
          </div>

          {/* ── 담보인정액 계산 ── */}
          {secTitle('■ 용도별 분양매출 · LTV 입력')}
          <table style={{ width:'100%', borderCollapse:'collapse', marginBottom:'8px' }}>
            <thead>
              <tr>
                <th style={{ padding:'7px 10px', backgroundColor:'#1a1a2e', color:'white', textAlign:'left', fontSize:'12px' }}>용도</th>
                <th style={{ padding:'7px 10px', backgroundColor:'#1a1a2e', color:'white', textAlign:'right', fontSize:'12px' }}>분양매출 (천원)</th>
                <th style={{ padding:'7px 10px', backgroundColor:'#1a1a2e', color:'white', textAlign:'center', fontSize:'12px', width:'110px' }}>LTV (%)</th>
                <th style={{ padding:'7px 10px', backgroundColor:'#1a1a2e', color:'#aed6f1', textAlign:'right', fontSize:'12px' }}>담보인정액 (천원)</th>
              </tr>
            </thead>
            <tbody>
              {/* 공동주택 */}
              <tr style={{ backgroundColor:'white' }}>
                <td style={{ padding:'8px 10px', fontWeight:'bold', color:'#2c3e50', fontSize:'12px' }}>
                  공동주택 (발코니확장 포함)
                  {salesData?.salesSumBal > 0 &&
                    <div style={{ fontSize:'10px', color:'#e67e22', fontWeight:'normal' }}>
                      발코니 {fmtN(salesData.salesSumBal)} 포함
                    </div>}
                </td>
                <td style={{ padding:'8px 10px', textAlign:'right', fontSize:'12px' }}>{fmtN(aptSale)}</td>
                <td style={{ padding:'6px 10px', textAlign:'center' }}>
                  <input type="number" value={ltv.apt}
                    onChange={e => setLtv(p => ({ ...p, apt: parseFloat(e.target.value)||0 }))}
                    style={{ width:'65px', padding:'4px 8px', border:'1px solid #2980b9',
                      borderRadius:'4px', fontSize:'12px', textAlign:'center', fontWeight:'bold', color:'#1a3a5c' }} />
                </td>
                <td style={{ padding:'8px 10px', textAlign:'right', fontWeight:'bold', color:'#1a3a5c', fontSize:'13px' }}>
                  {fmtN(collApt)}
                </td>
              </tr>
              {/* 오피스텔 */}
              <tr style={{ backgroundColor:'#fafafa' }}>
                <td style={{ padding:'8px 10px', fontWeight:'bold', color:'#2c3e50', fontSize:'12px' }}>오피스텔</td>
                <td style={{ padding:'8px 10px', textAlign:'right', fontSize:'12px' }}>{fmtN(offiSale)}</td>
                <td style={{ padding:'6px 10px', textAlign:'center' }}>
                  <input type="number" value={ltv.offi}
                    onChange={e => setLtv(p => ({ ...p, offi: parseFloat(e.target.value)||0 }))}
                    style={{ width:'65px', padding:'4px 8px', border:'1px solid #2980b9',
                      borderRadius:'4px', fontSize:'12px', textAlign:'center', fontWeight:'bold', color:'#1a3a5c' }} />
                </td>
                <td style={{ padding:'8px 10px', textAlign:'right', fontWeight:'bold', color:'#1a3a5c', fontSize:'13px' }}>
                  {fmtN(collOffi)}
                </td>
              </tr>
              {/* 근린상가 — 층별 */}
              {storeFloors.length > 0 && (
                <tr>
                  <td colSpan={4} style={{ padding:'4px 10px', backgroundColor:'#f0f2f5',
                    fontWeight:'bold', fontSize:'11px', color:'#546e7a',
                    borderTop:'1.5px solid #bbb' }}>
                    근린상가 (층별)
                  </td>
                </tr>
              )}
              {storeFloors.map((r,i) => (
                <tr key={i} style={{ backgroundColor: i%2===0 ? '#fafbfc' : 'white' }}>
                  <td style={{ padding:'7px 10px', paddingLeft:'22px', fontSize:'12px', color:'#2c3e50' }}>
                    {r.type}
                  </td>
                  <td style={{ padding:'7px 10px', textAlign:'right', fontSize:'12px' }}>{fmtN(r.sale)}</td>
                  <td style={{ padding:'5px 10px', textAlign:'center' }}>
                    <input type="number" value={storeLtv[i] ?? DEFAULT_LTV[issuer].store}
                      onChange={e => setStoreLtv(p => ({ ...p, [i]: parseFloat(e.target.value)||0 }))}
                      style={{ width:'65px', padding:'4px 8px', border:'1px solid #27ae60',
                        borderRadius:'4px', fontSize:'12px', textAlign:'center', fontWeight:'bold', color:'#1a5c2a' }} />
                  </td>
                  <td style={{ padding:'7px 10px', textAlign:'right', fontWeight:'bold', color:'#1a5c2a', fontSize:'12px' }}>
                    {fmtN(collFloors[i])}
                  </td>
                </tr>
              ))}
              {/* 근린상가 소계 */}
              {storeFloors.length > 1 && (
                <tr style={{ backgroundColor:'#e8f5ec' }}>
                  <td style={{ padding:'6px 10px', paddingLeft:'22px', fontWeight:'bold', color:'#1a5c2a', fontSize:'11px' }}>
                    근린상가 소계
                  </td>
                  <td style={{ padding:'6px 10px', textAlign:'right', fontWeight:'bold', fontSize:'11px', color:'#1a5c2a' }}>
                    {fmtN(storeSaleTotal)}
                  </td>
                  <td />
                  <td style={{ padding:'6px 10px', textAlign:'right', fontWeight:'bold', color:'#1a5c2a', fontSize:'12px' }}>
                    {fmtN(collStore)}
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr style={{ backgroundColor:'#1a1a2e' }}>
                <td colSpan={2} style={{ padding:'9px 10px', color:'white', fontWeight:'bold', fontSize:'13px' }}>
                  담보인정액 합계
                </td>
                <td style={{ padding:'9px 10px', textAlign:'center', color:'rgba(255,255,255,0.6)', fontSize:'11px' }}>
                  ≈ {fmtB(collTotal)}
                </td>
                <td style={{ padding:'9px 10px', textAlign:'right', color:'#aed6f1', fontWeight:'bold', fontSize:'15px' }}>
                  {fmtN(collTotal)}
                </td>
              </tr>
            </tfoot>
          </table>

          {/* ── 트랜치 구성 ── */}
          {secTitle('■ 트랜치 구성')}
          <div style={{ display:'flex', flexDirection:'column', gap:'16px', marginBottom:'16px' }}>
            {tranches.map((t, ti) => {
              const calc = trancheCalcs[ti];
              const colors = TRANCHE_COLORS[t.name] || TRANCHE_COLORS['선순위'];
              return (
                <div key={ti} style={{ border:`2px solid ${colors.border}`, borderRadius:'8px', overflow:'hidden' }}>
                  <div style={{ backgroundColor:colors.bg, padding:'10px 16px',
                    display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <span style={{ color:'white', fontWeight:'bold', fontSize:'14px' }}>{t.name}</span>
                    <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
                      <span style={{ color:'rgba(255,255,255,0.8)', fontSize:'12px' }}>금리(%)</span>
                      <input type="number" value={t.rate}
                        onChange={e => updateTranche(ti, 'rate', e.target.value)}
                        style={{ width:'60px', padding:'4px 8px', border:'none', borderRadius:'4px',
                          fontSize:'13px', textAlign:'center', fontWeight:'bold', color:colors.text }} />
                      <span style={{ color:'white', fontSize:'12px', minWidth:'180px', textAlign:'right' }}>
                        {fmtN(calc.amt)}천원 | 연이자 {fmtN(calc.interest)}천원
                      </span>
                    </div>
                  </div>
                  <div style={{ padding:'12px 16px', backgroundColor:colors.light }}>
                    {t.rows.map((r, ri) => {
                      const c = collMapExt[r.use] || 0;
                      const pct = parseFloat(r.pct) || 0;
                      const rowAmt = Math.round(c * pct / 100);
                      return (
                        <div key={ri} style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'8px' }}>
                          <select value={r.use} onChange={e => updateRow(ti, ri, 'use', e.target.value)}
                            style={{ padding:'5px 8px', border:`1px solid ${colors.border}`,
                              borderRadius:'4px', fontSize:'12px', color:colors.text,
                              fontWeight:'bold', backgroundColor:'white', width:'140px' }}>
                            {USE_OPTIONS_EXT.map(u => <option key={u} value={u}>{u}</option>)}
                          </select>
                          <span style={{ fontSize:'11px', color:'#666' }}>비중</span>
                          <input type="number" value={r.pct}
                            onChange={e => updateRow(ti, ri, 'pct', e.target.value)}
                            style={{ width:'65px', padding:'5px 8px', border:`1px solid ${colors.border}`,
                              borderRadius:'4px', fontSize:'12px', textAlign:'center',
                              fontWeight:'bold', color:colors.text }} />
                          <span style={{ fontSize:'11px', color:'#666' }}>%</span>
                          <span style={{ fontSize:'11px', color:'#888' }}>
                            담보 {fmtN(c)} × {pct}%
                          </span>
                          <span style={{ fontWeight:'bold', color:colors.text, fontSize:'12px', minWidth:'110px' }}>
                            = {fmtN(rowAmt)} 천원
                          </span>
                          <button onClick={() => removeRow(ti, ri)}
                            style={{ padding:'2px 8px', backgroundColor:'#e74c3c', color:'white',
                              border:'none', borderRadius:'3px', cursor:'pointer', fontSize:'11px' }}>✕</button>
                        </div>
                      );
                    })}
                    <button onClick={() => addRow(ti)}
                      style={{ padding:'5px 14px', backgroundColor:'white',
                        border:`1px dashed ${colors.border}`, borderRadius:'4px',
                        cursor:'pointer', fontSize:'11px', color:colors.text, marginTop:'4px' }}>
                      + 행 추가
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── 트랜치 전체 합계 ── */}
          {secTitle('■ 트랜치 전체 합계')}
          <table style={{ width:'100%', borderCollapse:'collapse', marginBottom:'12px' }}>
            <thead>
              <tr>
                <th style={{ padding:'7px 10px', backgroundColor:'#1a1a2e', color:'white', textAlign:'left', fontSize:'12px' }}>트랜치</th>
                <th style={{ padding:'7px 10px', backgroundColor:'#1a1a2e', color:'white', textAlign:'right', fontSize:'12px' }}>계산금액 (천원)</th>
                <th style={{ padding:'7px 10px', backgroundColor:'#1a1a2e', color:'#f5cba7', textAlign:'right', fontSize:'12px' }}>올림금액 (천원)</th>
                <th style={{ padding:'7px 10px', backgroundColor:'#1a1a2e', color:'white', textAlign:'right', fontSize:'12px' }}>비중 (%)</th>
                <th style={{ padding:'7px 10px', backgroundColor:'#1a1a2e', color:'white', textAlign:'right', fontSize:'12px' }}>금리 (%)</th>
                <th style={{ padding:'7px 10px', backgroundColor:'#1a1a2e', color:'#f5cba7', textAlign:'right', fontSize:'12px' }}>연간이자 (천원)</th>
                <th style={{ padding:'7px 10px', backgroundColor:'#1a1a2e', color:'white', textAlign:'left', fontSize:'12px' }}>구성항목</th>
              </tr>
            </thead>
            <tbody>
              {tranches.map((t, ti) => {
                const calc     = trancheCalcs[ti];
                const rounded  = trancheRounded[ti];
                const colors   = TRANCHE_COLORS[t.name] || TRANCHE_COLORS['선순위'];
                const pctOfTotal = totalAmt > 0 ? (calc.amt/totalAmt*100) : 0;
                const desc = t.rows.filter(r => parseFloat(r.pct)>0)
                  .map(r => `${r.use} ${r.pct}%`).join(' / ');

                return (
                  <tr key={ti} style={{ backgroundColor:colors.light }}>
                    <td style={{ padding:'8px 10px', fontWeight:'bold', color:colors.text, fontSize:'12px' }}>{t.name}</td>
                    <td style={{ padding:'8px 10px', textAlign:'right', fontWeight:'bold', color:colors.text, fontSize:'12px' }}>
                      {fmtN(calc.amt)}
                      <div style={{ fontSize:'10px', color:'#888', fontWeight:'normal' }}>≈ {fmtB(calc.amt)}</div>
                    </td>
                    <td style={{ padding:'8px 10px', textAlign:'right', fontSize:'12px', color:'#e67e22', fontWeight:'bold' }}>
                      {fmtN(rounded.amtRounded)}
                      <div style={{ fontSize:'10px', color:'#888', fontWeight:'normal' }}>
                        (5억 단위 올림)
                      </div>
                    </td>
                    <td style={{ padding:'8px 10px', textAlign:'right', fontSize:'12px', color:'#555' }}>
                      {totalAmt > 0 ? pctOfTotal.toFixed(1) : '—'}%
                    </td>
                    <td style={{ padding:'8px 10px', textAlign:'right', fontSize:'12px', color:'#555' }}>{t.rate}%</td>
                    <td style={{ padding:'8px 10px', textAlign:'right', fontWeight:'bold', color:'#e67e22', fontSize:'12px' }}>
                      {fmtN(calc.interest)}
                    </td>
                    <td style={{ padding:'8px 10px', fontSize:'11px', color:'#555' }}>{desc}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ backgroundColor:'#1a1a2e' }}>
                <td style={{ padding:'9px 10px', color:'white', fontWeight:'bold' }}>합 계</td>
                <td style={{ padding:'9px 10px', textAlign:'right', color:'#aed6f1', fontWeight:'bold', fontSize:'13px' }}>
                  {fmtN(totalAmt)}
                </td>
                <td style={{ padding:'9px 10px', textAlign:'right', color:'#f5cba7', fontWeight:'bold', fontSize:'13px' }}>
                  {fmtN(totalRounded)}
                  <div style={{ fontSize:'10px', color:'rgba(255,255,255,0.5)', fontWeight:'normal' }}>올림 합계</div>
                </td>
                <td style={{ padding:'9px 10px', textAlign:'right', color:'rgba(255,255,255,0.7)', fontSize:'12px' }}>
                  {totalAmt>0?'100.0':'—'}%
                </td>
                <td style={{ padding:'9px 10px', textAlign:'right', color:'rgba(255,255,255,0.7)', fontSize:'12px' }}>
                  {avgRate.toFixed(1)}%
                </td>
                <td style={{ padding:'9px 10px', textAlign:'right', color:'#f5cba7', fontWeight:'bold', fontSize:'13px' }}>
                  {fmtN(totalInterest)}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>

          {/* 올림 적용 버튼 */}
          {totalAmt > 0 && (
            <div style={{ marginTop:'12px', padding:'12px 16px', backgroundColor:'#fef9e7',
              border:'1px solid #f5cba7', borderRadius:'8px', display:'flex', alignItems:'center',
              gap:'16px', flexWrap:'wrap' }}>
              <div style={{ fontSize:'12px', color:'#7d5a00' }}>
                <strong>올림 적용:</strong> 전체 트랜치 5억 단위 올림 (끝이 0억 또는 5억)
                <div style={{ fontSize:'11px', color:'#aaa', marginTop:'2px' }}>
                  계산값: {fmtN(totalAmt)} → 올림값: {fmtN(totalRounded)}
                  {totalRounded > totalAmt && ` (+${fmtN(totalRounded-totalAmt)} 여유)`}
                </div>
              </div>
              <button
                onClick={() => {
                  const updated = tranches.map((t,i) => ({
                    ...t,
                    savedAmt: String(trancheRounded[i].amtRounded),
                  }));
                  setTranches(updated);
                  // 트랜치 row pct도 담보인정액 기준으로 역산 적용은 수동
                }}
                style={{ padding:'7px 18px', backgroundColor:'#e67e22', color:'white',
                  border:'none', borderRadius:'6px', cursor:'pointer', fontWeight:'bold', fontSize:'12px' }}>
                ✦ 올림값 저장 적용
              </button>
            </div>
          )}

          {Math.abs(diff) > 0 && (
            <div style={{ padding:'10px 14px', borderRadius:'6px', fontSize:'12px',
              backgroundColor: diff>0?'#fff8e1':'#fdecea',
              border:`1px solid ${diff>0?'#ffe082':'#f5b7b1'}`,
              color: diff>0?'#795548':'#c0392b' }}>
              {diff>0
                ? `⚠ 담보인정액(${fmtN(collTotal)})이 트랜치 합계(${fmtN(totalAmt)})보다 ${fmtN(diff)}천원 미배분`
                : `⚠ 트랜치 합계(${fmtN(totalAmt)})가 담보인정액(${fmtN(collTotal)})을 ${fmtN(-diff)}천원 초과`}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
// ─────────────────────────────────────────────
// 금융탭 메인
// ─────────────────────────────────────────────
// ─────────────────────────────────────────────
// 현금유출입 계산기
// ─────────────────────────────────────────────
function CashFlowCalc({ salesData, monthlyPayments, financeData, onFinanceChange, onCashFlowResult, projectName }) {
  const mp     = monthlyPayments || {};
  const months = mp.months || [];
  const n      = months.length;
  const noData = n === 0;

  const pnv = (v) => parseFloat(String(v||'').replace(/,/g,''))||0;
  const fmt = (v) => v > 0 ? formatNumber(Math.round(v)) : '—';

  // ── 착공/준공 인덱스 ──
  const conIdx = (salesData?.constructMonth||1)-1;
  const junIdx = (salesData?.junMonth||1)-1;
  const isCon  = (i) => (salesData?.constructMonth||0)>0 && i===conIdx;
  const isJun  = (i) => (salesData?.junMonth||0)>0 && i===junIdx;
  const isSpec = (i) => isCon(i)||isJun(i);
  const colBR  = (i) => { const m=parseInt((months[i]||'').split('.')[1])||0; return (m===6||m===12)?'2px solid #888':undefined; };

  // ── 트랜치 정보 ──
  const tranches  = financeData?.ltvCalc?.tranches || [];
  const getTranche = (name) => {
    const t = tranches.find(t=>t.name?.includes(name));
    return { amt: pnv(t?.savedAmt||0), rate: parseFloat(t?.rate||0) };
  };
  const junior = getTranche('후순위');
  const mez    = getTranche('중순위');
  const senior = getTranche('선순위');

  // ── 상환 조건 입력 ──
  const rc = financeData?.repayCondition || {};
  const [maxRepayInput, setMaxRepayInput] = useState(rc.maxRepay || '');
  const [minRepayInput, setMinRepayInput] = useState(rc.minRepay || '100000');
  const [minBalInput,   setMinBalInput]   = useState(rc.minBal   || '');
  const [roundUnit,     setRoundUnit]     = useState(rc.roundUnit || '100000');
  const [openSections,  setOpenSections]  = useState({
    sec1:true, sec2:false, sec3:false, sec4:false,
    equity:false, pf:false, sale:false, interest:false, repay:false,
    finCost:false, saveAcct:false, pfDraw:false, pfRepay:false,
    cat_land:false, cat_direct:false, cat_indirect:false,
    cat_consult:false, cat_sales:false, cat_overhead:false, cat_tax:false,
  });
  const toggleSection = (key) => setOpenSections(p=>({...p,[key]:!p[key]}));

  // 상환 조건 변경 시 Firestore 저장
  const saveRepayCondition = (key, val) => {
    if (!onFinanceChange) return;
    const rc_ = financeData?.repayCondition || {};
    onFinanceChange({ ...(financeData||{}), repayCondition: { ...rc_, [key]: val } });
  };

  const maxRepay  = pnv(maxRepayInput) || Infinity;
  const minRepay  = pnv(minRepayInput) || 0;   // 최소 상환 금액
  const minBal    = pnv(minBalInput)   || 0;
  const rUnit     = pnv(roundUnit)     || 100000;
  const ceilUnit  = (v) => Math.ceil(v / rUnit) * rUnit;
  const floorUnit = (v) => Math.floor(v / rUnit) * rUnit; // 억단위 내림

  // ── 분양금 배분 (Report.js calcRows와 동일 로직) ──
  const alloc    = salesData?.alloc || { over:{res:{dep:30,mid:30,bal:100},store:{all:40}}, under:{res:{dep:10,mid:10,bal:100},store:{all:40}} };
  const baseRate = parseFloat(salesData?.baseRate||'80')||80;
  const scenario = 'over'; // 기본 초과 시나리오
  const ymList   = salesData?.ymList || [];
  const hasVat   = !!(salesData?.aptDepMonthlyVat);

  const resDep  = ymList.map((_,i)=>(hasVat?(salesData?.aptDepMonthlyVat?.[i]||0):(salesData?.aptDepMonthly?.[i]||0))+(hasVat?(salesData?.balDepMonthlyVat?.[i]||0):(salesData?.balDepMonthly?.[i]||0))+(hasVat?(salesData?.offiDepMonthlyVat?.[i]||0):(salesData?.offiDepMonthly?.[i]||0)));
  const resMid  = ymList.map((_,i)=>(hasVat?(salesData?.aptMidMonthlyVat?.[i]||0):(salesData?.aptMidMonthly?.[i]||0))+(hasVat?(salesData?.offiMidMonthlyVat?.[i]||0):(salesData?.offiMidMonthly?.[i]||0)));
  const resBal  = ymList.map((_,i)=>(hasVat?(salesData?.aptBalMonthlyVat?.[i]||0):(salesData?.aptBalMonthly?.[i]||0))+(hasVat?(salesData?.balBalMonthlyVat?.[i]||0):(salesData?.balBalMonthly?.[i]||0))+(hasVat?(salesData?.offiBalMonthlyVat?.[i]||0):(salesData?.offiBalMonthly?.[i]||0)));
  const store   = (hasVat?salesData?.storeMonthlyVat:salesData?.storeMonthly)||Array(ymList.length).fill(0);

  // 월별 상환용/운영비 계산 (세부항목별)
  const a = alloc.over;
  const allocRows = ymList.map((ym,i) => {
    const resDepSave  = Math.round(resDep[i]*(a.res.dep??30)/100);
    const resMidSave  = Math.round(resMid[i]*(a.res.mid??30)/100);
    const resBalSave  = Math.round(resBal[i]*(a.res.bal??100)/100);
    const storeSave   = Math.round((store[i]||0)*(a.store.all??40)/100);
    return {
      ym,
      resDepOper:  resDep[i] - resDepSave,
      resMidOper:  resMid[i] - resMidSave,
      resBalOper:  resBal[i] - resBalSave,
      storeOper:   (store[i]||0) - storeSave,
      totalOper:   (resDep[i]-resDepSave)+(resMid[i]-resMidSave)+(resBal[i]-resBalSave)+((store[i]||0)-storeSave),
      totalSave:   resDepSave+resMidSave+resBalSave+storeSave,
    };
  });

  // ym → index 매핑 (months 기준)
  const ymToIdx = {};
  months.forEach((ym,i)=>{ ymToIdx[ym]=i; });

  // 운영비(분양불) 월별 세부 (months 기준)
  const operByMonth     = Array(n).fill(0);
  const saveByMonth     = Array(n).fill(0);
  const operDepByMonth  = Array(n).fill(0); // 주거용 계약금 운영비
  const operMidByMonth  = Array(n).fill(0); // 주거용 중도금 운영비
  const operBalByMonth  = Array(n).fill(0); // 주거용 잔금 운영비
  const operStoreByMonth= Array(n).fill(0); // 근린상가 운영비

  allocRows.forEach(r => {
    const i = ymToIdx[r.ym];
    if (i !== undefined) {
      operByMonth[i]      += r.totalOper;
      saveByMonth[i]      += r.totalSave;
      operDepByMonth[i]   += r.resDepOper;
      operMidByMonth[i]   += r.resMidOper;
      operBalByMonth[i]   += r.resBalOper;
      operStoreByMonth[i] += r.storeOper;
    }
  });
// ── 기부체납 운영비/상환용 (공공주택 + 공공발코니 + 공공시설) ──
  const allocPublic = salesData?.allocPublic || { dep: 100, mid: 100, bal: 100 };
  const pubOperPctDep = (100 - (allocPublic.dep ?? 100)) / 100;
  const pubOperPctMid = (100 - (allocPublic.mid ?? 100)) / 100;
  const pubOperPctBal = (100 - (allocPublic.bal ?? 100)) / 100;

  ymList.forEach((ym, idx) => {
    const i = ymToIdx[ym];
    if (i === undefined) return;
    const totalPubDep =
      (salesData?.publicDepMonthly?.[idx]||0) +
      (salesData?.publicBalDepMonthly?.[idx]||0) +
      (salesData?.pubfacDepMonthlyVat?.[idx]||(salesData?.pubfacDepMonthly?.[idx]||0)*1.1);
    const totalPubMid =
      (salesData?.publicMidMonthly?.[idx]||0) +
      (salesData?.publicBalMidMonthly?.[idx]||0) +
      (salesData?.pubfacMidMonthlyVat?.[idx]||(salesData?.pubfacMidMonthly?.[idx]||0)*1.1);
    const totalPubBal =
      (salesData?.publicBalMonthly?.[idx]||0) +
      (salesData?.publicBalBalMonthly?.[idx]||0) +
      (salesData?.pubfacBalMonthlyVat?.[idx]||(salesData?.pubfacBalMonthly?.[idx]||0)*1.1);

    operByMonth[i] += Math.round(totalPubDep*pubOperPctDep) + Math.round(totalPubMid*pubOperPctMid) + Math.round(totalPubBal*pubOperPctBal);
    saveByMonth[i] += Math.round(totalPubDep*(allocPublic.dep??100)/100) + Math.round(totalPubMid*(allocPublic.mid??100)/100) + Math.round(totalPubBal*(allocPublic.bal??100)/100);
  });
  // ── 부가세 납부/환급 (분기별, monthlyPayments.vatSettlements) ──
  // 양수 = 납부(현금유출), 음수 = 환급(현금유입)
  
  const vatSettlements = mp.vatSettlements || {};
  const vatByMonthArr = months.map(ym => -(vatSettlements[ym] || 0)); // 납부=양수, 환급=음수

  // ── 카테고리별 세부항목 월별 집계 ──
  const CAT_KEYS = [
    { key:'land',     label:'토지관련비용', itemsKey:'landItems'     },
    { key:'direct',   label:'직접공사비',   itemsKey:'directItems'   },
    { key:'indirect', label:'간접공사비',   itemsKey:'indirectItems' },
    { key:'consult',  label:'용역비',       itemsKey:'consultItems'  },
    { key:'sales',    label:'판매비',       itemsKey:'salesItems'    },
    { key:'tax',      label:'제세금',       itemsKey:'taxItems'      },
    { key:'overhead', label:'부대비',       itemsKey:'overheadItems' },
  ];

  // ── 카테고리별 세부항목 — monthlyPayments에서 그대로 가져옴 (재계산 없음) ──
  const catItems = CAT_KEYS.map(cat => ({
    ...cat,
    items: (mp[cat.itemsKey]||[]).map(item => {
      const monthly = months.map(ym => (item.totals?.[ym]||0)+(item.vatTotals?.[ym]||0));
      // eqMonthly/saleMonthly/pfMonthly는 ProjectCost.js assignFunding에서 이미 계산됨 → 그대로 사용
      return { ...item, monthly };
    }),
  }));

  // 월별 총지출 (VAT포함, 타임라인과 동일해야 함)
  const totalOut = months.map((_,i) =>
    catItems.reduce((s,cat)=>s+cat.items.reduce((ss,item)=>ss+item.monthly[i],0),0)
  );

  // ── 금융 수수료: PF 첫 실행 시점에 1회 발생 ──
  // result 계산 중 firstPF 플래그로 추적
  const fc_pre    = financeData?.financeCost || {};
  const totalFee  = Math.round((junior.amt+mez.amt+senior.amt)*pnv(fc_pre.mgmtPct)/100)
    + Math.round(senior.amt*pnv(fc_pre.seniorFee)/100)
    + Math.round(mez.amt   *pnv(fc_pre.mezFee)   /100)
    + Math.round(junior.amt*pnv(fc_pre.juniorFee) /100);
  let feePaid = false; // 수수료 지급 여부 (PF 첫 실행 시 1회)
  const feeByMonth_pre = Array(months.length).fill(0); // result 루프에서 채움

  // ── 핵심 계산: 과부족 기반 PF 실행 ──
  // 원칙: 운영비계좌 잔액 관점
  //   지출 = 사업비(금융비 포함) + 부가세(±) + 에쿼티반환(마지막월)
  //   유입 = 이월잔액 + 에쿼티 + 분양불(운영비분)
  //   과부족 = 유입 - 지출
  //   부족(<0) → PF 실행 ceil(|부족|, 억단위), 후→중→선
  //   잉여(≥0) → 운영비계좌에 이월
  //   ※ PF 이자/원금은 상환용계좌에서 별도 처리

  // 트랜치 잔액
  let balJunior = 0, balMez = 0, balSenior = 0;
  // 운영비계좌 잔액 (= 이월잔액)
  let carryOver = 0;
  // 상환용계좌 잔액
  let saveAcctBal = 0;

  // 마지막 월 에쿼티 반환액 (총 에쿼티 투입액)
  const eqTotalRepay = catItems.reduce((s,cat) =>
    s + cat.items.reduce((ss,item) =>
      ss + (item.eqMonthly||[]).reduce((sss,v)=>sss+(v||0),0), 0), 0);

  const result = months.map((_,i) => {
    const isLastMonth = (i === months.length - 1);
    const eqRepayThisMonth = isLastMonth ? eqTotalRepay : 0;

    // ── 1. 이자 계산 (전월 잔액 기준, 상환용계좌에서 차감) ──
    const intJ = Math.round(balJunior * junior.rate/100/12);
    const intM = Math.round(balMez    * mez.rate/100/12);
    const intS = Math.round(balSenior * senior.rate/100/12);
    const midInt_r = (() => {
      const mr=pnv(fc_pre.midRate)/100/12;
      const yl_=salesData?.ymList||[];
      const am_=salesData?.aptMidMonthly||[], om_=salesData?.offiMidMonthly||[], sm_=salesData?.storeMidMonthly||[];
      const ab_=salesData?.aptBalMonthly||[], ob_=salesData?.offiBalMonthly||[], sb_=salesData?.storeBalMonthly||[];
      const tm_=([...am_,...om_,...sm_]).reduce((s,v)=>s+(v||0),0);
      const tb_=([...ab_,...ob_,...sb_]).reduce((s,v)=>s+(v||0),0);
      let acc=0,rep=0;
      yl_.slice(0,yl_.indexOf(months[i])+1).forEach((ym,idx)=>{
        acc+=(am_[idx]||0)+(om_[idx]||0)+(sm_[idx]||0);
        const bt=(ab_[idx]||0)+(ob_[idx]||0)+(sb_[idx]||0);
        if(tb_>0&&bt>0)rep+=Math.round(tm_*bt/tb_);
      });
      return Math.round(Math.max(0,acc-rep)*mr);
    })();
    const totalInt = intJ + intM + intS;

    // ── 2. 이번달 유입/지출 ──
    const vatSettle = vatByMonthArr[i] || 0;   // +: 납부, -: 환급
    const eqIn      = eqByMonthArr[i]  || 0;   // 에쿼티 (eqMonthly 그대로)
    const operIn    = operByMonth[i]   || 0;   // 분양불 운영비분

    // ── 3. PF 실행 여부 판단을 위한 사전 과부족 계산 ──
    // (수수료 제외한 상태에서 먼저 계산 → PF 실행 예정이면 수수료 포함해서 재계산)
    const preShortage = carryOver + eqIn + operIn
                      - totalOut[i] - vatSettle - eqRepayThisMonth;
    const willDrawPF = preShortage < 0;
    const feeThisMonth = (!feePaid && willDrawPF) ? totalFee : 0;

    // ── 4. 최종 과부족 계산 ──
    const totalCost = totalOut[i] + vatSettle + eqRepayThisMonth + feeThisMonth;
    const totalIn   = carryOver + eqIn + operIn;
    const netAmount = totalIn - totalCost;   // 양수=잉여, 음수=부족

    // ── 5. PF 실행 ──
    let drawJunior = 0, drawMez = 0, drawSenior = 0, drawRounded = 0;
    let newCarry = 0;

    if (netAmount < 0) {
      // 부족 → PF 실행 (억단위 올림)
      const shortage = -netAmount;
      const drawTarget = ceilUnit(shortage);

      // 후→중→선 순서로 한도내 배분
      let r = drawTarget;
      drawJunior = Math.min(Math.max(0, junior.amt - balJunior), r); r -= drawJunior;
      drawMez    = Math.min(Math.max(0, mez.amt    - balMez),    r); r -= drawMez;
      drawSenior = Math.min(Math.max(0, senior.amt - balSenior), r);

      drawRounded = drawJunior + drawMez + drawSenior;
      // 이월잔액 = 실제 실행액 - 부족분 (올림차액)
      // 한도초과로 부족분을 못 채우면 음수가 될 수 있으나, 최소 0으로 보정
      newCarry = Math.max(0, drawRounded - shortage);
    } else {
      // 잉여 → 운영비계좌에 이월
      newCarry = netAmount;
    }

    // 잔액 업데이트
    balJunior += drawJunior;
    balMez    += drawMez;
    balSenior += drawSenior;

    // 수수료 플래그
    if (!feePaid && drawRounded > 0) {
      feePaid = true;
      feeByMonth_pre[i] = feeThisMonth;
    }

    // ── 6. UI 표시용 충당 내역 분해 ──
    // 표시 순서: 이월잔액 → 분양불 → 에쿼티 → PF
    let rem = totalCost;
    const carryUsed = Math.min(Math.max(0,carryOver), rem); rem -= carryUsed;
    const operUsed_ = Math.min(Math.max(0,operIn),    rem); rem -= operUsed_;
    const eqUsed_   = Math.min(Math.max(0,eqIn),      rem); rem -= eqUsed_;

    // 이월잔액 업데이트 (다음 달로)
    carryOver = newCarry;

    // ── 7. 상환용계좌: 원금 + 이자 차감 ──
    // 은행이 상환용계좌에서 이자 + 원금을 자동 인출
    const saveIn  = saveByMonth[i];
    saveAcctBal  += saveIn; // 당월 유입 누적

    // 7-1. PF 이자 먼저 차감 (중도금무이자는 운영비계좌에서 지급)
    const intTotal = intJ_est + intM_est + intS_est; // PF이자만
    saveAcctBal = Math.max(0, saveAcctBal - intTotal);

    // 7-2. 원금 상환 (이자 차감 후 잔액 기준)
    // 가능 상환액: 최소유지잔액 초과분, 최대상환액 cap, 억단위 내림
    const rawRepay     = Math.max(0, Math.min(saveAcctBal - minBal, maxRepay));
    const flooredRepay = floorUnit(rawRepay);
    const repayAvail   = flooredRepay >= minRepay ? flooredRepay : 0;
    let repayS=0, repayM=0, repayJ=0;
    let repayRem = repayAvail;

    // 선순위: 매월 가능한 만큼 분할 상환
    repayS = Math.min(balSenior, repayRem);
    repayRem -= repayS; balSenior -= repayS;

    // 중순위: 잔액 전액 상환 가능할 때만 한 번에 상환 (부족하면 0)
    if (repayRem >= balMez && balMez > 0) {
      repayM = balMez;
      repayRem -= repayM; balMez -= repayM;
    }

    // 후순위: 잔액 전액 상환 가능할 때만 한 번에 상환 (부족하면 0)
    if (repayRem >= balJunior && balJunior > 0) {
      repayJ = balJunior;
      balJunior -= repayJ;
    }

    const totalRepay = repayS + repayM + repayJ;
    saveAcctBal -= totalRepay; // 원금 상환 후 잔액 차감

    return {
      out, carryUsed, operUsed: operUsed_, eqUsed: eqUsed_, vatSettle,
      totalInt, intJ, intM, intS, midInt: midInt_r,
      drawJunior, drawMez, drawSenior, drawRounded,
      repayS, repayM, repayJ, totalRepay,
      balJunior, balMez, balSenior,
      carryOver, saveAcctBal, saveIn,
      fee: feeByMonth_pre[i], feeThisMonth,
    };
  });

  // ── result를 상위로 전달 (사업비탭 금융비 연동용) ──
  React.useEffect(() => {
    if (onCashFlowResult && result.length > 0) {
      onCashFlowResult({
        result,
        months,
        intByMonth:    result.map(r => r.intS + r.intM + r.intJ),
        midIntByMonth: result.map(r => r.midInt || 0),
        feeByMonth:    result.map(r => r.fee || 0),
        senior, mez, junior,
        pfStartYM: months[result.findIndex(r=>r.drawRounded>0)] || null,
      });
    }
  }, [result.length, result.map(r=>r.drawRounded).join(',')]);

  // ── 검증 (기존) ──
  const checkEquity = result.reduce((s,r)=>s+r.eqUsed,0);
  const checkOper   = result.reduce((s,r)=>s+r.operUsed,0);
  const checkPF     = result.reduce((s,r)=>s+r.drawRounded,0);
  const checkRepay  = result.reduce((s,r)=>s+r.totalRepay,0);
  const checkTotal  = totalOut.reduce((s,v)=>s+v,0);

  // ── 스타일 ──
  const thS = (extra={}) => ({
    padding:'4px 6px', background:'#1a1a2e', color:'white', textAlign:'right',
    borderBottom:'2px solid #444', fontSize:'10px', whiteSpace:'nowrap', ...extra,
  });
  // 단순 컬러 팔레트: 흰색/그레이/블랙
  const W  = 'white';
  const G1 = '#f8f8f8'; // 옅은 그레이 (일반 행)
  const G2 = '#eeeeee'; // 중간 그레이 (소계)
  const G3 = '#dddddd'; // 진한 그레이 (합계/강조)
  const BK = '#222222'; // 블랙
  const tdS = (bg=W, color=BK, bold=false) => ({
    padding:'3px 6px', backgroundColor:bg, color, fontWeight:bold?'bold':'normal',
    borderBottom:'1px solid #ddd', textAlign:'right', fontSize:'10px',
  });
  const stickyL = { position:'sticky', left:0, zIndex:10 };

  const sectionHeader = (label, key, color, bg) => (
    <tr style={{ cursor:'pointer' }} onClick={()=>toggleSection(key)}>
      <td colSpan={n+3} style={{
        padding:'5px 10px', background:bg, color, fontWeight:'bold',
        fontSize:'11px', userSelect:'none',
      }}>
        {openSections[key] ? '▼' : '▶'} {label}
      </td>
    </tr>
  );

  const totalPF = junior.amt + mez.amt + senior.amt;
  const maxBal       = Math.max(...result.map(r=>r.balJunior+r.balMez+r.balSenior), 0);
  const maxBalSenior = Math.max(...result.map(r=>r.balSenior), 0);
  const maxBalMez    = Math.max(...result.map(r=>r.balMez),    0);
  const maxBalJunior = Math.max(...result.map(r=>r.balJunior), 0);

  if (noData) return (
    <div style={{ padding:'40px', textAlign:'center', color:'#aaa', border:'2px dashed #ddd', borderRadius:'12px' }}>
      💡 사업비 탭을 먼저 방문하면 데이터가 자동으로 연동됩니다.
    </div>
  );

  // ── 금융비용 월별 (result에서 가져옴) ──
  const fc = financeData?.financeCost || {};
  const finFeeByMonth     = result.map(r=>r.fee||0);
  const finMidByMonth     = result.map(r=>r.midInt||0);
  const finIntByMonth     = result.map(r=>r.intS+r.intM+r.intJ);
  const finTotalByMonth   = months.map((_,i)=>finFeeByMonth[i]+finMidByMonth[i]+finIntByMonth[i]);
  
  // 에쿼티 상환은 surplusByMonth에서 별도 차감 (totalOutWithFin과 분리)

  // ── 새 검증식: (분양수입 - 사업비지출 - 부가세납부) = (운영비계좌 + 상환용계좌) ──
  const salesTotal_  = (salesData?.ymList||[]).reduce((s,_,i)=>{
    const hasVat = !!(salesData?.aptDepMonthlyVat);
    const dep = hasVat?(salesData?.aptDepMonthlyVat?.[i]||0)+(salesData?.balDepMonthlyVat?.[i]||0)+(salesData?.offiDepMonthlyVat?.[i]||0)
                      :(salesData?.aptDepMonthly?.[i]||0)+(salesData?.balDepMonthly?.[i]||0)+(salesData?.offiDepMonthly?.[i]||0);
    const mid = hasVat?(salesData?.aptMidMonthlyVat?.[i]||0)+(salesData?.offiMidMonthlyVat?.[i]||0)
                      :(salesData?.aptMidMonthly?.[i]||0)+(salesData?.offiMidMonthly?.[i]||0);
    const bal = hasVat?(salesData?.aptBalMonthlyVat?.[i]||0)+(salesData?.balBalMonthlyVat?.[i]||0)+(salesData?.offiBalMonthlyVat?.[i]||0)
                      :(salesData?.aptBalMonthly?.[i]||0)+(salesData?.balBalMonthly?.[i]||0)+(salesData?.offiBalMonthly?.[i]||0);
    const store = hasVat?(salesData?.storeMonthlyVat?.[i]||0):(salesData?.storeMonthly?.[i]||0);
    const pubTotal =
      (salesData?.publicDepMonthly?.[i]||0)
      +(salesData?.publicMidMonthly?.[i]||0)
      +(salesData?.publicBalMonthly?.[i]||0)
      +(salesData?.publicBalDepMonthly?.[i]||0)
      +(salesData?.publicBalMidMonthly?.[i]||0)
      +(salesData?.publicBalBalMonthly?.[i]||0)
      +(salesData?.pubfacDepMonthlyVat?.[i]||(salesData?.pubfacDepMonthly?.[i]||0)*1.1)
      +(salesData?.pubfacMidMonthlyVat?.[i]||(salesData?.pubfacMidMonthly?.[i]||0)*1.1)
      +(salesData?.pubfacBalMonthlyVat?.[i]||(salesData?.pubfacBalMonthly?.[i]||0)*1.1);
    return s+dep+mid+bal+store+pubTotal;
  },0);
  const costTotal_   = totalOut.reduce((s,v)=>s+v,0) + finTotalByMonth.reduce((s,v)=>s+v,0);
  const vatNetPay_ = -Object.values((mp?.vatSettlements)||{}).reduce((s,v)=>s+v,0);
  const lhsCheck_    = salesTotal_ - costTotal_ - vatNetPay_;
  const lastResult_  = result[result.length-1] || {};
  const rhsCheck_    = 0; // carryByMonth 선언 후 아래에서 재계산

  // ── 과부족 및 PF 계산 (에쿼티+분양불 - 전체지출) ──
  // eqMonthly는 ProjectCost.js assignFunding에서 이미 계산됨 — 재계산 없이 그대로 사용
  const eqByMonthArr = months.map((_,i) =>
    catItems.reduce((s,cat) =>
      s + cat.items.reduce((ss,item) => ss + (item.eqMonthly?.[i] || 0), 0)
    , 0)
  );

  // 현금유출에는 수수료+중도금무이자 포함 (PF이자/원금은 상환용계좌에서 차감)
  const finFeeOnlyByMonth = months.map((_,i)=>finFeeByMonth[i]);
  const totalOutWithFin = totalOut.map((v,i)=>v+finFeeOnlyByMonth[i]+finMidByMonth[i]+vatByMonthArr[i]);

  // 에쿼티 총 투입액 (마지막 사업기간 월에 상환)
  const eqTotal = eqByMonthArr.reduce((s,v)=>s+v, 0);
  const eqRepayByMonth = months.map((_,i) => i === months.length-1 ? eqTotal : 0);

  const surplusByMonth  = months.map((_,i)=>
    (eqByMonthArr[i]||0) + (operByMonth[i]||0) - totalOutWithFin[i]
    - (eqRepayByMonth[i]||0) // 에쿼티 상환 (마지막달)
    // 부가세는 totalOutWithFin에 이미 포함
  );

  // 이월잔액 누적
  let carry = 0;
  const carryByMonth = months.map((_,i) => {
    const prev = carry;
    carry = prev + surplusByMonth[i] + (result[i].drawRounded||0);
    return prev;
  });

  // ── 검증 우변: carryByMonth 이후 계산 (에쿼티 상환 반영) ──
  const lastCarry_  = carryByMonth[carryByMonth.length-1] + surplusByMonth[surplusByMonth.length-1];
  const lastSave_   = lastResult_?.saveAcctBal || 0;
  const rhsCheckFin_ = lastCarry_ + lastSave_;

  // 대섹션 헤더
  const bigHeader = (num, label, desc, _bg, _color, key) => (
    <tr style={{ cursor: key?'pointer':undefined }} onClick={key?()=>toggleSection(key):undefined}>
      <td style={{ padding:'8px 12px', background:'#2c2c2c', color:'white', fontWeight:'bold', fontSize:'12px',
        position:'sticky', left:0, zIndex:2, backgroundColor:'#2c2c2c' }}>
        {key && (openSections[key]?'▼ ':'▶ ')}{num}. {label}
      </td>
      <td colSpan={n+2} style={{ padding:'8px 12px', background:'#2c2c2c', color:'rgba(255,255,255,0.5)', fontSize:'10px' }}>{desc}</td>
    </tr>
  );

  // 소섹션 헤더
  const subHeader = (label, key, _color, _bg) => (
    <tr style={{ cursor:'pointer' }} onClick={()=>toggleSection(key)}>
      <td colSpan={n+3} style={{ padding:'5px 10px', background:G2, color:BK, fontWeight:'bold',
        fontSize:'11px', userSelect:'none', position:'sticky', left:0, zIndex:10, backgroundColor:G2,
        borderLeft:'3px solid #888' }}>
        {openSections[key]?'▼':'▶'} {label}
      </td>
    </tr>
  );

  const row = (label, vals, total, bg=W, color=BK, bold=false, pl='10px') => (
    <tr>
      <td style={{ ...tdS(bg,color,bold), textAlign:'left', paddingLeft:pl, ...stickyL, backgroundColor:bg }}>{label}</td>
      {vals.map((v,i)=>(<td key={i} style={{ ...tdS(isSpec(i)?G1:bg, v>0?color:'#bbb'), borderRight:colBR(i), borderLeft:isSpec(i)?'2px solid #999':undefined }}>{fmt(v)}</td>))}
      <td style={{ ...tdS(bg,color,true), borderLeft:'2px solid #999' }}>{fmt(total??vals.reduce((s,v)=>s+v,0))}</td>
    </tr>
  );

  const negRow = (label, vals, total, bg=W, color=BK, bold=false, pl='10px') => (
    <tr>
      <td style={{ ...tdS(bg,color,bold), textAlign:'left', paddingLeft:pl, ...stickyL, backgroundColor:bg }}>{label}</td>
      {vals.map((v,i)=>(<td key={i} style={{ ...tdS(isSpec(i)?G1:bg, v>0?color:'#bbb'), borderRight:colBR(i), borderLeft:isSpec(i)?'2px solid #999':undefined }}>{v>0?`(${fmt(v)})`:''}</td>))}
      <td style={{ ...tdS(bg,color,true), borderLeft:'2px solid #999' }}>{`(${fmt(total??vals.reduce((s,v)=>s+v,0))})`}</td>
    </tr>
  );

  const cumRow = (label, vals, bg=G1, color='#555', pl='10px') => {
    let cum=0;
    const cumVals = vals.map(v=>{cum+=v; return cum;});
    return (
      <tr>
        <td style={{ ...tdS(bg,color), textAlign:'left', paddingLeft:pl, ...stickyL, backgroundColor:bg, fontStyle:'italic' }}>{label}</td>
        {cumVals.map((v,i)=>(<td key={i} style={{ ...tdS(isSpec(i)?G2:bg, v>0?color:'#bbb'), borderRight:colBR(i), borderLeft:isSpec(i)?'2px solid #999':undefined, fontStyle:'italic' }}>{fmt(v)}</td>))}
        <td style={{ ...tdS(bg,color,true), borderLeft:'2px solid #999', fontStyle:'italic' }}>{fmt(cum)}</td>
      </tr>
    );
  };

  const divider = (h=2, bg='#ddd') => <tr><td colSpan={n+3} style={{ height:`${h}px`, background:bg, padding:0 }} /></tr>;

  return (
    <div>
      {/* 헤더 */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'16px', flexWrap:'wrap', gap:'12px' }}>
        <div>
          <h3 style={{ margin:0, fontSize:'16px', color:'#1a1a2e' }}>■ 현금유출입 계산기</h3>
          <div style={{ fontSize:'11px', color:'#888', marginTop:'3px' }}>VAT 포함 | 단위: 천원</div>
        </div>
        <div style={{ padding:'10px 16px', borderRadius:'8px', fontSize:'12px',
          backgroundColor: maxBal > totalPF ? '#fdf2f2' : '#f0fdf4',
          border:`1px solid ${maxBal > totalPF ? '#e74c3c' : '#27ae60'}` }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'8px' }}>
            <span style={{ color:'#888', fontSize:'10px' }}>트랜치 한도 vs 실제 최대잔액</span>
            <span style={{ fontWeight:'bold', fontSize:'12px', color: maxBal>totalPF?'#e74c3c':'#27ae60' }}>
              {totalPF===0?'⚠ PF 미설정':maxBal>totalPF?'❌ 한도초과':'✅ 충분'}
            </span>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:'4px' }}>
            {[
              { label:'선순위', amt:senior.amt, max:maxBalSenior, color:'#1a5276' },
              { label:'중순위', amt:mez.amt,    max:maxBalMez,    color:'#6c3483' },
              { label:'후순위', amt:junior.amt, max:maxBalJunior, color:'#922b21' },
            ].filter(t=>t.amt>0).map(t=>(
              <div key={t.label} style={{ display:'flex', alignItems:'center', gap:'8px', fontSize:'11px' }}>
                <span style={{ color:t.color, fontWeight:'bold', minWidth:'40px' }}>{t.label}</span>
                <span style={{ color:'#555', minWidth:'80px' }}>{fmt(t.amt)} 한도</span>
                <span style={{ color:'#aaa', fontSize:'10px' }}>→</span>
                <span style={{ color: t.max>t.amt?'#e74c3c':'#27ae60', fontWeight:'bold', minWidth:'80px' }}>{fmt(t.max)} 실사용</span>
                <span style={{ color: t.max>t.amt?'#e74c3c':'#27ae60', fontSize:'10px' }}>
                  {t.max>t.amt?'❌':'✅'} ({(t.max/t.amt*100).toFixed(1)}%)
                </span>
              </div>
            ))}
            <div style={{ borderTop:'1px solid #ddd', marginTop:'4px', paddingTop:'4px',
              display:'flex', alignItems:'center', gap:'8px', fontSize:'11px', fontWeight:'bold' }}>
              <span style={{ color:'#333', minWidth:'40px' }}>합계</span>
              <span style={{ color:'#555', minWidth:'80px' }}>{fmt(totalPF)} 한도</span>
              <span style={{ color:'#aaa', fontSize:'10px' }}>→</span>
              <span style={{ color: maxBal>totalPF?'#e74c3c':'#27ae60', minWidth:'80px' }}>{fmt(maxBal)} 실사용</span>
              <span style={{ color: maxBal>totalPF?'#e74c3c':'#27ae60', fontSize:'10px' }}>
                ({totalPF>0?(maxBal/totalPF*100).toFixed(1):0}%)
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 상환 조건 */}
      <div style={{ display:'flex', gap:'16px', flexWrap:'wrap', marginBottom:'16px',
        padding:'12px 16px', backgroundColor:'#f8f9fa', borderRadius:'8px', border:'1px solid #e0e0e0' }}>
        <div style={{ fontSize:'12px', fontWeight:'bold', color:'#555', alignSelf:'center' }}>상환 조건</div>
        {[
          { label:'월 최대 상환액 (천원)', val:maxRepayInput,  set:setMaxRepayInput,  saveKey:'maxRepay', ph:'무제한' },
          { label:'최소 상환 금액 (천원)', val:minRepayInput,  set:setMinRepayInput,  saveKey:'minRepay', ph:'1,000,000 (10억)' },
          { label:'최소 유지 잔액 (천원)', val:minBalInput,    set:setMinBalInput,    saveKey:'minBal',   ph:'1,000,000 (10억)' },
          { label:'PF 실행 단위 (천원)',   val:roundUnit,      set:setRoundUnit,      saveKey:'roundUnit',ph:'100,000 (1억)' },
        ].map(({label,val,set,saveKey,ph}) => (
          <div key={label} style={{ display:'flex', flexDirection:'column', gap:'3px' }}>
            <span style={{ fontSize:'10px', color:'#888' }}>{label}</span>
            <input
              type="text"
              value={val ? Number(String(val).replace(/,/g,'')).toLocaleString('ko-KR') : ''}
              onChange={e => {
                const v = e.target.value.replace(/,/g,'');
                set(v);
                saveRepayCondition(saveKey, v);
              }}
              placeholder={ph}
              style={{ width:'140px', padding:'4px 8px', border:'1px solid #ccc', borderRadius:'4px', fontSize:'12px' }} />
          </div>
        ))}
      </div>

      {/* 테이블 */}
      <div style={{ overflowX:'auto', border:'1px solid #ddd', borderRadius:'8px' }}>
        <table style={{ borderCollapse:'collapse', fontSize:'10px', whiteSpace:'nowrap' }}>
          <thead>
            <tr>
              <th style={{ ...thS({ textAlign:'left', minWidth:'180px', position:'sticky', left:0, zIndex:20, background:'#1a1a2e' }) }}>항목</th>
              {months.map((ym,i) => (
                <th key={ym} style={{ ...thS({
                  minWidth:'60px',
                  color: isCon(i)?'#f39c12':isJun(i)?'#a29bfe':'white',
                  borderLeft: isSpec(i)?'2px solid #777':undefined,
                  borderRight: isSpec(i)?'2px solid #777':colBR(i),
                }) }}>
                  {isCon(i)?`◆ `:isJun(i)?`★ `:''}{ym.slice(2)}
                </th>
              ))}
              <th style={{ ...thS({ minWidth:'75px', color:'#f5cba7', borderLeft:'2px solid #666' }) }}>합계</th>
            </tr>
          </thead>
          <tbody>

            {/* ══════════════════════════════ */}
            {/* 1. 현금유입                    */}
            {/* ══════════════════════════════ */}
            {bigHeader(1, '현금유입', '에쿼티 + 분양수입(운영비계좌) + PF 실행', '#1a1a2e', 'white', 'sec1')}
            {openSections.sec1 && (<>
              {/* (1) Equity */}
              {subHeader('(1) Equity 투입', 'equity', '#1a3a5c', '#e8f0f8')}
              {openSections.equity && catItems.map(cat =>
                cat.items.map((item,ii) => {
                  const vals  = item.eqMonthly || item.monthly.map(v=>Math.round(v*(pnv(item.funding?.equity||0)/100)));
                  const total = vals.reduce((s,v)=>s+v,0);
                  if(!total) return null;
                  return (
                    <tr key={`eq-${cat.key}-${ii}`}>
                      <td style={{ ...tdS(W,BK), textAlign:'left', paddingLeft:'20px', ...stickyL, backgroundColor:W }}>└ {cat.label} — {item.label}</td>
                      {vals.map((v,i)=>(<td key={i} style={{ ...tdS(isSpec(i)?G1:W,BK), borderRight:colBR(i), borderLeft:isSpec(i)?'2px solid #999':undefined }}>{fmt(v)}</td>))}
                      <td style={{ ...tdS(G1,BK,true), borderLeft:'2px solid #999' }}>{fmt(total)}</td>
                    </tr>
                  );
                })
              )}
              {row('Equity 소계', eqByMonthArr, null, G2, BK, true)}
              {divider()}

              {/* (2) 분양수입 */}
              {subHeader('(2) 분양수입 (운영비계좌)', 'sale', '#1a5c2a', '#e8f5ec')}
              {openSections.sale && (() => {
                const saleDetailRows = [
                  { label:'└ 계약금 (공동주택+발코니+오피스텔)', vals: months.map(ym=>{ const idx=ymList.indexOf(ym); return idx>=0?operDepByMonth[ymToIdx[ym]??-1]||0:0; }) },
                  { label:'└ 중도금 (공동주택+오피스텔)',         vals: months.map(ym=>operMidByMonth[ymToIdx[ym]??-1]||0) },
                  { label:'└ 잔금 (공동주택+발코니+오피스텔)',   vals: months.map(ym=>operBalByMonth[ymToIdx[ym]??-1]||0) },
                  { label:'└ 근린상가',                          vals: months.map(ym=>operStoreByMonth[ymToIdx[ym]??-1]||0) },
                ].filter(r=>r.vals.some(v=>v>0));
                return saleDetailRows.map((r,ri)=>(
                  <tr key={ri}>
                    <td style={{ ...tdS(W,BK), textAlign:'left', paddingLeft:'20px', ...stickyL, backgroundColor:W }}>{r.label}</td>
                    {r.vals.map((v,i)=>(<td key={i} style={{ ...tdS(isSpec(i)?G1:W,BK), borderRight:colBR(i), borderLeft:isSpec(i)?'2px solid #999':undefined }}>{fmt(v)}</td>))}
                    <td style={{ ...tdS(G1,BK,true), borderLeft:'2px solid #999' }}>{fmt(r.vals.reduce((s,v)=>s+v,0))}</td>
                  </tr>
                ));
              })()}
              {row('분양수입 소계 (운영비계좌)', operByMonth, null, G2, BK, true)}
              {divider()}

              {/* (3) PF 실행 */}
              {subHeader('(3) PF 실행 (후순위→중순위→선순위)', 'pf', '#6c3483', '#f5eef8')}
              {openSections.pf && [
                { label:'└ 선순위', key:'drawSenior', color:'#1a5276', bg:'#e8f0f8' },
                { label:'└ 중순위', key:'drawMez',    color:'#6c3483', bg:'#f5eef8' },
                { label:'└ 후순위', key:'drawJunior', color:'#922b21', bg:'#fdf0ed' },
              ].map(({label,key,color,bg}) => {
                const vals=result.map(r=>r[key]||0);
                if(!vals.some(v=>v>0)) return null;
                return (
                  <tr key={key}>
                    <td style={{ ...tdS(bg,color), textAlign:'left', paddingLeft:'20px', ...stickyL, backgroundColor:W }}>{label}</td>
                    {vals.map((v,i)=>(<td key={i} style={{ ...tdS(isSpec(i)?'#f0f0f0':bg,color), borderRight:colBR(i), borderLeft:isSpec(i)?'2px solid #bbb':undefined }}>{fmt(v)}</td>))}
                    <td style={{ ...tdS(bg,color,true), borderLeft:'2px solid #bbb' }}>{fmt(vals.reduce((s,v)=>s+v,0))}</td>
                  </tr>
                );
              })}
              {row('PF 실행 소계', result.map(r=>r.drawRounded), null, G2, BK, true)}
              {divider()}

              {/* 현금유입 합계 */}
              {row('▲ 현금유입 합계', months.map((_,i)=>eqByMonthArr[i]+operByMonth[i]+(result[i].drawRounded||0)), null, '#2c2c2c', 'white', true)}
              {divider(4, '#555')}
            </>)}

            {/* ══════════════════════════════ */}
            {/* 2. 현금유출                    */}
            {/* ══════════════════════════════ */}
            {bigHeader(2, '현금유출', '사업비 (1)~(7) + (8) 금융비용', '#7b241c', 'white', 'sec2')}
            {openSections.sec2 && (<>
              {[
                { key:'land',     label:'(1) 토지관련비용', itemsKey:'landItems',     color:'#5d4037', bg:'#efebe9' },
                { key:'direct',   label:'(2) 직접공사비',   itemsKey:'directItems',   color:'#1a3a5c', bg:'#e8f0f8' },
                { key:'indirect', label:'(3) 간접공사비',   itemsKey:'indirectItems', color:'#4a235a', bg:'#f3e5f5' },
                { key:'consult',  label:'(4) 용역비',       itemsKey:'consultItems',  color:'#1a5c2a', bg:'#e8f5ec' },
                { key:'sales',    label:'(5) 판매비',       itemsKey:'salesItems',    color:'#7d5a00', bg:'#fff8e1' },
                { key:'overhead', label:'(6) 부대비',       itemsKey:'overheadItems', color:'#922b21', bg:'#fdf0ed' },
                { key:'tax',      label:'(7) 제세금',       itemsKey:'taxItems',      color:'#546e7a', bg:'#eceff1' },
              ].map(cat => {
                const items = (mp[cat.itemsKey]||[]);
                const catVals = months.map((_,i)=>items.reduce((s,item)=>s+(item.totals?.[months[i]]||0)+(item.vatTotals?.[months[i]]||0),0));
                const catTotal = catVals.reduce((s,v)=>s+v,0);
                if(!catTotal) return null;
                return (
                  <React.Fragment key={cat.key}>
                    <tr style={{ cursor:'pointer' }} onClick={()=>toggleSection(`cat_${cat.key}`)}>
                      <td colSpan={n+3} style={{ padding:'5px 10px', background:G2, color:BK,
                        fontWeight:'bold', fontSize:'11px', userSelect:'none',
                        position:'sticky', left:0, zIndex:10, backgroundColor:G2, borderLeft:'3px solid #888' }}>
                        {openSections[`cat_${cat.key}`]?'▼':'▶'} {cat.label}
                        <span style={{ fontSize:'10px', fontWeight:'normal', marginLeft:'8px', color:'#666' }}>합계 {fmt(catTotal)}</span>
                      </td>
                    </tr>
                    {openSections[`cat_${cat.key}`] && items.map((item,ii) => {
                      const vals=months.map(ym=>(item.totals?.[ym]||0)+(item.vatTotals?.[ym]||0));
                      const tot=vals.reduce((s,v)=>s+v,0);
                      if(!tot) return null;
                      return (
                        <tr key={ii}>
                          <td style={{ ...tdS(W,BK), textAlign:'left', paddingLeft:'20px', ...stickyL, backgroundColor:W }}>└ {item.label}</td>
                          {vals.map((v,i)=>(<td key={i} style={{ ...tdS(isSpec(i)?G1:W,BK), borderRight:colBR(i), borderLeft:isSpec(i)?'2px solid #999':undefined }}>{fmt(v)}</td>))}
                          <td style={{ ...tdS(G1,BK,true), borderLeft:'2px solid #999' }}>{fmt(tot)}</td>
                        </tr>
                      );
                    })}
                    {row('소계', catVals, null, G2, BK, true)}
                  </React.Fragment>
                );
              })}
              {divider()}

              {/* (8) 금융비용 */}
              <tr style={{ cursor:'pointer' }} onClick={()=>toggleSection('finCost')}>
                <td colSpan={n+3} style={{ padding:'5px 10px', background:G2, color:BK,
                  fontWeight:'bold', fontSize:'11px', userSelect:'none',
                  position:'sticky', left:0, zIndex:10, backgroundColor:G2, borderLeft:'3px solid #888' }}>
                  {openSections.finCost?'▼':'▶'} (8) 금융비용
                  <span style={{ fontSize:'10px', fontWeight:'normal', marginLeft:'8px', color:'#666' }}>수수료+중도금무이자 {fmt(months.reduce((s,_,i)=>s+finFeeOnlyByMonth[i]+finMidByMonth[i],0))}</span>
                </td>
              </tr>
              {openSections.finCost && (() => {
                // 수수료 항목별 (financeData 기준, 표시 전용 - 계산 영향 없음)
                const fc_ = financeData?.financeCost || {};
                const pnv_ = v => parseFloat(String(v||'').replace(/,/g,''))||0;
                const totalPF_  = senior.amt + mez.amt + junior.amt;
                const mgmtAmt__ = Math.round(totalPF_ * pnv_(fc_.mgmtPct) / 100);
                const sfAmt__   = Math.round(senior.amt * pnv_(fc_.seniorFee) / 100);
                const mfAmt__   = Math.round(mez.amt    * pnv_(fc_.mezFee)    / 100);
                const jfAmt__   = Math.round(junior.amt * pnv_(fc_.juniorFee) / 100);
                // 수수료 발생 월 인덱스
                const feeIdx = result.findIndex(r=>r.fee>0);
                const feeRows = [
                  { label:'└ ① 주관사수수료',     amt: mgmtAmt__ },
                  { label:'└ ⑤ 선순위 취급수수료', amt: sfAmt__   },
                  { label:'└ ⑥ 중순위 취급수수료', amt: mfAmt__   },
                  { label:'└ ⑦ 후순위 취급수수료', amt: jfAmt__   },
                ].filter(r=>r.amt>0).map(r=>({
                  ...r,
                  vals: months.map((_,i)=>i===feeIdx?r.amt:0),
                }));
                const midRow = finMidByMonth.some(v=>v>0) ? [{ label:'└ ⑧ 중도금 무이자', vals: finMidByMonth, color:'#1a5c2a' }] : [];
                return [...feeRows.map(r=>({ ...r, color:'#7d5a00' })), ...midRow].map((r,ri)=>(
                  <tr key={ri}>
                    <td style={{ ...tdS(W,BK), textAlign:'left', paddingLeft:'20px', ...stickyL, backgroundColor:W }}>{r.label}</td>
                    {r.vals.map((v,i)=>(<td key={i} style={{ ...tdS(isSpec(i)?G1:W,r.color), borderRight:colBR(i), borderLeft:isSpec(i)?'2px solid #999':undefined }}>{v>0?fmt(v):''}</td>))}
                    <td style={{ ...tdS(G1,r.color,true), borderLeft:'2px solid #999' }}>{fmt(r.vals.reduce((s,v)=>s+v,0))}</td>
                  </tr>
                ));
              })()}
              {openSections.finCost && (
                <tr>
                  <td colSpan={n+3} style={{ padding:'3px 20px', fontSize:'10px', color:'#888', backgroundColor:W, fontStyle:'italic' }}>
                    ※ PF 이자(선순위/중순위/후순위)는 상환용계좌에서 차감
                  </td>
                </tr>
              )}
              {/* (8) 금융비용 소계 */}
              {row('소계', months.map((_,i)=>finFeeOnlyByMonth[i]+finMidByMonth[i]), null, G2, BK, true)}
              {divider()}
      
              {/* (9) Equity 및 대여금 상환 */}
              {eqTotal > 0 && (<>
                <tr style={{ cursor:'pointer' }} onClick={()=>toggleSection('eqRepay')}>
                  <td colSpan={n+3} style={{ padding:'5px 10px', background:'#e8f0f8', color:'#1a3a5c',
                    fontWeight:'bold', fontSize:'11px', userSelect:'none',
                    position:'sticky', left:0, zIndex:10, backgroundColor:'#e8f0f8', borderLeft:'3px solid #2980b9' }}>
                    {openSections.eqRepay?'▼':'▶'} (9) Equity 및 대여금 상환
                    <span style={{ fontSize:'10px', fontWeight:'normal', marginLeft:'8px', color:'#555' }}>
                      합계 ({fmt(eqTotal)})
                    </span>
                  </td>
                </tr>
                {openSections.eqRepay && (<>
                  <tr>
                    <td style={{ ...tdS(W,BK), textAlign:'left', paddingLeft:'20px', ...stickyL, backgroundColor:W }}>└ Equity 상환 (마지막 월)</td>
                    {eqRepayByMonth.map((v,i)=>(
                      <td key={i} style={{ ...tdS(isSpec(i)?G1:W,BK), borderRight:colBR(i), borderLeft:isSpec(i)?'2px solid #999':undefined }}>
                        {v>0 ? fmt(v) : '—'}
                      </td>
                    ))}
                    <td style={{ ...tdS(G1,BK,true), borderLeft:'2px solid #999' }}>{fmt(eqTotal)}</td>
                  </tr>
                  <tr>
                    <td style={{ ...tdS(W,'#888'), textAlign:'left', paddingLeft:'20px', ...stickyL, backgroundColor:W }}>└ 대여금 상환</td>
                    {months.map((_,i)=>(<td key={i} style={{ ...tdS(isSpec(i)?G1:W,'#aaa'), borderRight:colBR(i), borderLeft:isSpec(i)?'2px solid #999':undefined }}>—</td>))}
                    <td style={{ ...tdS(G1,'#aaa',true), borderLeft:'2px solid #999' }}>—</td>
                  </tr>
                </>)}
                {/* (9) 소계 */}
                {row('소계', eqRepayByMonth, null, G2, BK, true)}
                {divider()}
              </>)}
                     
              {/* 부가세 납부/환급 */}
              {vatByMonthArr.some(v=>v!==0) && (() => {
                const total = vatByMonthArr.reduce((s,v)=>s+v,0);
                return (
                  <tr>
                    <td style={{ ...tdS(W,'#7d5a00'), textAlign:'left', paddingLeft:'10px', ...stickyL, backgroundColor:W }}>
                      부가세납부(+)/환급(-)
                    </td>
                    {vatByMonthArr.map((v,i) => (
                      <td key={i} style={{ ...tdS(isSpec(i)?G1:W, v>0?'#c0392b':'#27ae60'), borderRight:colBR(i), borderLeft:isSpec(i)?'2px solid #999':undefined }}>
                        {v>0?fmt(v):v<0?('('+fmt(-v)+')'):'' }
                      </td>
                    ))}
                    <td style={{ ...tdS(W,'#7d5a00',true), borderLeft:'2px solid #999' }}>
                      {total>0?fmt(total):total<0?('('+fmt(-total)+')'):'' }
                    </td>
                  </tr>
                );
              })()}

              {/* 현금유출 합계 */}
              {row('▼ 현금유출 합계', totalOutWithFin.map((v,i)=>v+(eqRepayByMonth[i]||0)), null, '#2c2c2c', 'white', true)}
              {divider(4, '#555')}
            </>)}

            {/* ══════════════════════════════ */}
            {/* 3. 현금 과부족 및 PF 실행      */}
            {/* ══════════════════════════════ */}
            {bigHeader(3, '현금 과부족 및 PF 실행', '전월잔액 + 유입 - 유출 → 부족 시 PF 실행', '#2c3e50', 'white', 'sec3')}
            {openSections.sec3 && (<>
              {/* 전월잔액 */}
              {row('전월 이월잔액', carryByMonth, null, '#ecf0f1', '#555', false)}
              {/* 에쿼티 유입 */}
              {row('(+) Equity 유입', eqByMonthArr, null, '#e8f0f8', '#1a3a5c', false)}
              {/* 분양불 유입 */}
              {row('(+) 분양수입 (운영비)', operByMonth, null, '#e8f5ec', '#1a5c2a', false)}
              {/* 사업비 지출 */}
              {negRow('(-) 사업비 지출', totalOutWithFin, null, '#fdf8f8', '#555', false)}

              {divider()}
              {/* 과부족 */}
              {(() => {
                const vals = months.map((_,i)=>carryByMonth[i]+eqByMonthArr[i]+operByMonth[i]-totalOutWithFin[i]-(eqRepayByMonth[i]||0));
                return (
                  <tr>
                    <td style={{ ...tdS(G2,BK,true), textAlign:'left', paddingLeft:'10px', ...stickyL, backgroundColor:G2 }}>과부족 (PF 실행 전)</td>
                    {vals.map((v,i)=>(
                      <td key={i} style={{ ...tdS(isSpec(i)?G2:G1, BK, true),
                        borderRight:colBR(i), borderLeft:isSpec(i)?'2px solid #999':undefined }}>
                        {v!==0?`${v>0?'':'-'}${fmt(Math.abs(v))}`:' '}
                        {v!==0&&<span style={{fontSize:'8px',marginLeft:'1px'}}>{v>0?'▲':'▼'}</span>}
                      </td>
                    ))}
                    <td style={{ ...tdS(G2, BK, true), borderLeft:'2px solid #999' }}>
                      {fmt(Math.abs(vals.reduce((s,v)=>s+v,0)))}
                    </td>
                  </tr>
                );
              })()}
              {/* PF 실행 */}
              {row('(+) PF 실행 (억단위 올림)', result.map(r=>r.drawRounded), null, G2, BK, true)}
              {divider(4, '#555')}
            </>)}

            {/* ══════════════════════════════ */}
            {/* 4. PF 실행 및 상환             */}
            {/* ══════════════════════════════ */}
            {bigHeader(4, 'PF 실행 및 상환', '상환용계좌 / PF실행 / PF상환 / PF잔액 / 이자', '#4a235a', 'white', 'sec4')}
            {openSections.sec4 && (<>
              {/* (1) 상환용계좌 */}
              {subHeader('(1) 상환용계좌', 'saveAcct', BK, G2)}
              {row('상환용계좌 월별 유입', saveByMonth, null, W, BK)}
              {negRow('(-) PF 이자 차감', result.map(r=>(r.intS||0)+(r.intM||0)+(r.intJ||0)), null, W, '#7d5a00')}
              {row('상환용계좌 잔액 (이자후)', result.map(r=>r.saveAcctBal), result[result.length-1]?.saveAcctBal||0, G2, BK, true)}
              {divider()}

              {/* (2) PF 실행 */}
              {subHeader('(2) PF 실행', 'pfDraw', '#6c3483', '#f5eef8')}
              {[
                { label:'└ 선순위', vals:result.map(r=>r.drawSenior||0), color:'#1a5276', bg:'#e8f0f8' },
                { label:'└ 중순위', vals:result.map(r=>r.drawMez||0),    color:'#6c3483', bg:'#f5eef8' },
                { label:'└ 후순위', vals:result.map(r=>r.drawJunior||0), color:'#922b21', bg:'#fdf0ed' },
              ].filter(r=>r.vals.some(v=>v>0)).map((r,ri)=>(
                <tr key={ri}>
                  <td style={{ ...tdS(W,BK), textAlign:'left', paddingLeft:'20px', ...stickyL, backgroundColor:W }}>{r.label}</td>
                  {r.vals.map((v,i)=>(<td key={i} style={{ ...tdS(isSpec(i)?G1:W,BK), borderRight:colBR(i), borderLeft:isSpec(i)?'2px solid #999':undefined }}>{fmt(v)}</td>))}
                  <td style={{ ...tdS(G1,BK,true), borderLeft:'2px solid #999' }}>{fmt(r.vals.reduce((s,v)=>s+v,0))}</td>
                </tr>
              ))}
              {row('PF 실행 합계', result.map(r=>r.drawRounded), null, G2, BK, true)}
              {cumRow('PF 실행 누적', result.map(r=>r.drawRounded), '#ead5f7', '#6c3483')}
              {divider()}

              {/* (3) PF 상환 */}
              {subHeader('(3) PF 상환', 'pfRepay', '#c0392b', '#fdf0ed')}
              {[
                { label:'└ 선순위 상환', vals:result.map(r=>r.repayS||0), color:'#1a5276', bg:'#e8f0f8' },
                { label:'└ 중순위 상환', vals:result.map(r=>r.repayM||0), color:'#6c3483', bg:'#f5eef8' },
                { label:'└ 후순위 상환', vals:result.map(r=>r.repayJ||0), color:'#922b21', bg:'#fdf0ed' },
              ].filter(r=>r.vals.some(v=>v>0)).map((r,ri)=>(
                <tr key={ri}>
                  <td style={{ ...tdS(W,BK), textAlign:'left', paddingLeft:'20px', ...stickyL, backgroundColor:W }}>{r.label}</td>
                  {r.vals.map((v,i)=>(<td key={i} style={{ ...tdS(isSpec(i)?G1:W,BK), borderRight:colBR(i), borderLeft:isSpec(i)?'2px solid #999':undefined }}>{v>0?`(${fmt(v)})`:''}</td>))}
                  <td style={{ ...tdS(G1,BK,true), borderLeft:'2px solid #999' }}>{`(${fmt(r.vals.reduce((s,v)=>s+v,0))})`}</td>
                </tr>
              ))}
              {negRow('PF 상환 합계', result.map(r=>r.totalRepay), null, '#fdf0ed', '#c0392b', true)}
              {cumRow('PF 상환 누적', result.map(r=>r.totalRepay), '#fdf0ed', '#c0392b')}
              {divider()}

              {/* (4) PF 잔액 */}
              <tr><td colSpan={n+3} style={{ padding:'4px 10px', background:G2, color:BK, fontWeight:'bold', fontSize:'11px',
                position:'sticky', left:0, zIndex:10, backgroundColor:G2, borderLeft:'3px solid #888' }}>(4) PF 잔액</td></tr>
              {[
                { label:'└ 선순위 잔액', vals:result.map(r=>r.balSenior||0) },
                { label:'└ 중순위 잔액', vals:result.map(r=>r.balMez||0) },
                { label:'└ 후순위 잔액', vals:result.map(r=>r.balJunior||0) },
              ].filter(r=>r.vals.some(v=>v>0)).map((r,ri)=>(
                <tr key={ri}>
                  <td style={{ ...tdS(W,BK), textAlign:'left', paddingLeft:'20px', ...stickyL, backgroundColor:W }}>{r.label}</td>
                  {r.vals.map((v,i)=>(<td key={i} style={{ ...tdS(isSpec(i)?G1:W,BK), borderRight:colBR(i), borderLeft:isSpec(i)?'2px solid #999':undefined }}>{fmt(v)}</td>))}
                  <td style={{ ...tdS(G1,BK,true), borderLeft:'2px solid #999' }}>{fmt(r.vals[r.vals.length-1]||0)}</td>
                </tr>
              ))}
              {row('PF 잔액 합계', result.map(r=>r.balJunior+r.balMez+r.balSenior),
                result[result.length-1]?(result[result.length-1].balJunior+result[result.length-1].balMez+result[result.length-1].balSenior):0,
                G3, BK, true)}
              {divider()}

              {/* (5) 이자 */}
              {subHeader('(5) 이자', 'interest', '#7d5a00', '#fdf8f0')}
              {[
                { label:'└ 선순위 이자', vals:result.map(r=>r.intS), color:'#1a5276', bg:'#e8f0f8', rate:senior.rate },
                { label:'└ 중순위 이자', vals:result.map(r=>r.intM), color:'#6c3483', bg:'#f5eef8', rate:mez.rate    },
                { label:'└ 후순위 이자', vals:result.map(r=>r.intJ), color:'#922b21', bg:'#fdf0ed', rate:junior.rate },
              ].filter(r=>r.vals.some(v=>v>0)).map((r,ri)=>(
                <tr key={ri}>
                  <td style={{ ...tdS(W,BK), textAlign:'left', paddingLeft:'20px', ...stickyL, backgroundColor:W }}>{r.label} ({r.rate}%)</td>
                  {r.vals.map((v,i)=>(<td key={i} style={{ ...tdS(isSpec(i)?G1:W,BK), borderRight:colBR(i), borderLeft:isSpec(i)?'2px solid #999':undefined }}>{fmt(v)}</td>))}
                  <td style={{ ...tdS(G1,BK,true), borderLeft:'2px solid #999' }}>{fmt(r.vals.reduce((s,v)=>s+v,0))}</td>
                </tr>
              ))}
              {row('이자 합계', result.map(r=>r.totalInt), null, G2, BK, true)}
              {cumRow('이자 누적', result.map(r=>r.totalInt), '#fdf0d5', '#7d5a00')}
              {divider(4, '#555')}
            </>)}

          </tbody>
        </table>
      </div>

      {/* 검증 */}
      {(() => {
        const diff = Math.abs(lhsCheck_ - rhsCheckFin_);
        
        const ok   = diff < 100;
        return (
          <div style={{ marginTop:'8px', padding:'8px 12px', borderRadius:'6px', fontSize:'11px',
            backgroundColor: ok?'#f0fdf4':'#fdf2f2', border:`1px solid ${ok?'#27ae60':'#e74c3c'}` }}>
            <span style={{ fontWeight:'bold', color: ok?'#27ae60':'#e74c3c' }}>
              {ok?'✅ 검증 통과':'❌ 검증 불일치'}
            </span>
            <span style={{ color:'#555', marginLeft:'12px' }}>
              (분양수입 {formatNumber(Math.round(salesTotal_))} - 사업비지출 {formatNumber(Math.round(costTotal_))} - 부가세납부(+)/환급(-) {formatNumber(Math.round(vatNetPay_))}) = {formatNumber(Math.round(lhsCheck_))}
              {' vs '}
              (운영비계좌 {formatNumber(Math.round(lastCarry_))} + 상환용계좌 {formatNumber(Math.round(lastSave_))}) = {formatNumber(Math.round(rhsCheckFin_))}
              {diff > 0 && ` | 차이: ${formatNumber(Math.round(diff))}`}
            </span>
          </div>
        );
      })()}
      <div style={{ marginTop:'6px', fontSize:'10px', color:'#888' }}>
        ◆ 착공월 | ★ 준공월 | 충당순서: 이월잔액 → 분양불(운영비) → 에쿼티(한도내) → PF(억단위올림) | 이자: (전달잔액+이번달실행) × 금리/12
      </div>
    </div>
  );
}



// ─────────────────────────────────────────────
// 금융비 세부항목
// ─────────────────────────────────────────────
function FinanceCostSection({ financeData, onChange, salesData, cashFlowResult }) {
  const [showMidDetail, setShowMidDetail] = useState(false);
  const d    = financeData?.financeCost || {};
  const ltv  = financeData?.ltvCalc     || {};
  const tranches = ltv.tranches || [];

  // 트랜치 계산 (LTVModal과 동일 로직)
  const pnv = (v) => parseFloat(String(v||'').replace(/,/g,''))||0;
  const trancheAmts = tranches.map(t => {
    // amt는 저장된 값 없으면 0 (LTVModal에서 저장 필요)
    return { name: t.name||'', rate: parseFloat(t.rate)||0, amt: pnv(t.savedAmt||0) };
  });
  const totalPF = trancheAmts.reduce((s,t) => s+t.amt, 0);

  // 트랜치별 이름 찾기
  const getSenior  = () => trancheAmts.find(t => t.name.includes('선순위')) || {};
  const getMezzanine = () => trancheAmts.find(t => t.name.includes('중순위')) || {};
  const getJunior  = () => trancheAmts.find(t => t.name.includes('후순위')) || {};

  const upd = (key, val) => onChange({ ...financeData, financeCost: { ...d, [key]: val } });

  // 중도금 누적 잔액 계산 (분양율탭)
  const ymList    = salesData?.ymList || [];
  const aptMid    = salesData?.aptMidMonthly   || [];
  const offiMid   = salesData?.offiMidMonthly  || [];
  const storeMid  = salesData?.storeMidMonthly || [];
  // 잔금 납부 월별 (잔금 입주회차에 따라 중도금 차감 기준)
  const aptBal    = salesData?.aptBalMonthly   || [];
  const offiBal   = salesData?.offiBalMonthly  || [];
  const storeBal  = salesData?.storeBalMonthly || [];

  // 중도금 총액
  const totalMid = [...aptMid, ...offiMid, ...storeMid].reduce((s,v)=>s+(v||0),0);

  // 월별 중도금 잔액 계산:
  // - 중도금 납부 시 누적 증가
  // - 잔금 납부 시 비례 차감 (잔금 납부액 / 잔금 총액 × 중도금 총액)
  const totalBal = [...aptBal, ...offiBal, ...storeBal].reduce((s,v)=>s+(v||0),0);
  const midBalances = (() => {
    let midAccum = 0;   // 누적 중도금
    let midRepaid = 0;  // 누적 상환 중도금
    return ymList.map((_,i) => {
      // 이번 달 중도금 납부
      midAccum += (aptMid[i]||0) + (offiMid[i]||0) + (storeMid[i]||0);
      // 이번 달 잔금 납부 → 비례 중도금 상환
      const balThisMonth = (aptBal[i]||0) + (offiBal[i]||0) + (storeBal[i]||0);
      if (totalBal > 0 && balThisMonth > 0) {
        midRepaid += Math.round(totalMid * balThisMonth / totalBal);
      }
      return Math.max(0, midAccum - midRepaid);
    });
  })();

  // 금융비 항목 계산
  const seniorAmt  = getSenior().amt  || 0;
  const mezAmt     = getMezzanine().amt || 0;
  const juniorAmt  = getJunior().amt  || 0;
  const seniorRate = getSenior().rate  || 0;
  const mezRate    = getMezzanine().rate || 0;
  const juniorRate = getJunior().rate  || 0;

  // 수수료율 입력값
  const mgmtPct      = pnv(d.mgmtPct     || '0');    // 주관사수수료율
  const seniorFee    = pnv(d.seniorFee   || '0');    // 선순위 취급수수료율
  const mezFee       = pnv(d.mezFee      || '0');    // 중순위 취급수수료율
  const juniorFee    = pnv(d.juniorFee   || '0');    // 후순위 취급수수료율
  const unindrawnPct = pnv(d.unindrawnPct|| '0');    // 미인출수수료율
  const midRate      = pnv(d.midRate     || '0');    // 중도금 이자율
  const loanAmt      = pnv(d.loanAmt     || '0');    // 대여금
  const loanRate     = pnv(d.loanRate    || '0');    // 대여금 이자율

  // 금액 계산
  const mgmtAmt      = Math.round(totalPF   * mgmtPct   / 100);
  const seniorFeeAmt = Math.round(seniorAmt * seniorFee / 100);
  const mezFeeAmt    = Math.round(mezAmt    * mezFee    / 100);
  const juniorFeeAmt = Math.round(juniorAmt * juniorFee / 100);
  const seniorIntAmt = Math.round(seniorAmt * seniorRate / 100); // 연간
  const mezIntAmt    = Math.round(mezAmt    * mezRate   / 100);
  const juniorIntAmt = Math.round(juniorAmt * juniorRate / 100);
  // 중도금 이자 = 월별 누적잔액 × 이율/12 합산
  const midIntAmt    = midBalances.reduce((s,bal) => s + Math.round(bal * midRate / 100 / 12), 0);
  const loanIntAmt   = Math.round(loanAmt * loanRate / 100);

  const grandTotal = mgmtAmt + seniorFeeAmt + mezFeeAmt + juniorFeeAmt
    + seniorIntAmt + mezIntAmt + juniorIntAmt + midIntAmt + loanIntAmt;

  // 스타일
  const sectionStyle = { border:'1px solid #e0e0e0', borderRadius:'8px', padding:'16px', marginBottom:'16px', backgroundColor:'white' };
  const labelS = { fontSize:'12px', color:'#555', fontWeight:'bold', marginBottom:'4px' };
  const rowS   = { display:'flex', alignItems:'center', gap:'8px', marginBottom:'8px', flexWrap:'wrap' };
  const inputS = { padding:'5px 8px', border:'1px solid #ddd', borderRadius:'4px', fontSize:'12px', width:'90px', textAlign:'right' };
  const autoS  = { padding:'5px 8px', backgroundColor:'#f5f5f5', border:'1px solid #eee', borderRadius:'4px', fontSize:'12px', color:'#1a3a5c', fontWeight:'bold', minWidth:'100px', textAlign:'right' };
  const pctS   = { ...inputS, width:'70px', borderColor:'#2980b9' };
  const fmtAmt = (v) => v > 0 ? formatNumber(Math.round(v)) : '—';

  const ItemRow = ({ label, baseLabel, baseAmt, pctKey, pctVal, calcAmt, note }) => (
    <div style={{ borderBottom:'1px solid #f0f0f0', paddingBottom:'10px', marginBottom:'10px' }}>
      <div style={labelS}>{label}</div>
      <div style={rowS}>
        {baseLabel && <><span style={{ fontSize:'11px', color:'#888' }}>{baseLabel}</span>
          <div style={autoS}>{fmtAmt(baseAmt)}</div>
          <span style={{ fontSize:'11px', color:'#888' }}>×</span></>}
        {pctKey && <>
          <input type="number" value={pctVal} min="0" step="0.1"
            onChange={e => upd(pctKey, e.target.value)}
            style={pctS} />
          <span style={{ fontSize:'11px', color:'#888' }}>%</span>
          <span style={{ fontSize:'11px', color:'#aaa' }}>=</span>
          <div style={autoS}>{fmtAmt(calcAmt)}</div>
          <span style={{ fontSize:'11px', color:'#888' }}>천원</span>
        </>}
        {note && <span style={{ fontSize:'10px', color:'#aaa' }}>{note}</span>}
      </div>
    </div>
  );

  return (
    <div>
      <h4 style={{ margin:'0 0 16px', fontSize:'15px', color:'#1a1a2e' }}>💰 금융비 세부항목</h4>

      {totalPF === 0 && (
        <div style={{ padding:'12px 16px', backgroundColor:'#fff8e1', borderRadius:'8px',
          border:'1px solid #ffe082', fontSize:'12px', color:'#795548', marginBottom:'16px' }}>
          💡 LTV / 트랜치 계산기에서 먼저 PF 금액을 설정해주세요.
        </div>
      )}

      {/* PF 요약 */}
      <div style={{ display:'flex', gap:'12px', flexWrap:'wrap', marginBottom:'16px' }}>
        {[
          { label:'PF 총액',   val: totalPF,   color:'#1a3a5c' },
          { label:'선순위',     val: seniorAmt,  color:'#1a5276' },
          { label:'중순위',     val: mezAmt,     color:'#6c3483' },
          { label:'후순위',     val: juniorAmt,  color:'#922b21' },
        ].map(({ label, val, color }) => (
          <div key={label} style={{ padding:'8px 14px', backgroundColor:'#f8f9fa',
            border:`1px solid ${color}20`, borderRadius:'6px' }}>
            <div style={{ fontSize:'10px', color:'#888' }}>{label}</div>
            <div style={{ fontSize:'13px', fontWeight:'bold', color }}>{fmtAmt(val)} 천원</div>
          </div>
        ))}
      </div>

      {/* ① 주관사수수료 */}
      <div style={sectionStyle}>
        <ItemRow label="① 주관사수수료"
          baseLabel="PF총액" baseAmt={totalPF}
          pctKey="mgmtPct" pctVal={d.mgmtPct||'0'} calcAmt={mgmtAmt}
          note="실행 시점 1회" />
      </div>

      {/* ② 선순위 */}
      <div style={sectionStyle}>
        <div style={{ fontWeight:'bold', fontSize:'13px', color:'#1a5276', marginBottom:'12px' }}>
          ② 선순위 (이자율 {seniorRate}% — 트랜치 자동 연동)
        </div>
        <ItemRow label="이자 (연간)"
          baseLabel="선순위 금액" baseAmt={seniorAmt}
          pctKey={null} pctVal={seniorRate}
          calcAmt={seniorIntAmt}
          note={`${seniorRate}% × 잔액 / 12 × 월별`} />
        <div style={{ fontSize:'10px', color:'#aaa', marginBottom:'10px', marginLeft:'4px' }}>
          ※ 월별 이자는 현금유출입 계산기에서 자동 계산
        </div>
        <ItemRow label="취급수수료"
          baseLabel="선순위 금액" baseAmt={seniorAmt}
          pctKey="seniorFee" pctVal={d.seniorFee||'0'} calcAmt={seniorFeeAmt}
          note="실행 시점 1회" />
        <div style={{ borderBottom:'1px solid #f0f0f0', paddingBottom:'10px', marginBottom:'10px' }}>
          <div style={labelS}>미인출수수료</div>
          <div style={rowS}>
            <span style={{ fontSize:'11px', color:'#888' }}>선순위 한도</span>
            <div style={autoS}>{fmtAmt(seniorAmt)}</div>
            <span style={{ fontSize:'11px', color:'#888' }}>×</span>
            <input type="number" value={d.unindrawnPct||'0'} min="0" step="0.1"
              onChange={e => upd('unindrawnPct', e.target.value)}
              style={pctS} />
            <span style={{ fontSize:'11px', color:'#888' }}>%</span>
            <span style={{ fontSize:'11px', color:'#aaa' }}>=</span>
            <div style={autoS}>{fmtAmt(Math.round(seniorAmt * unindrawnPct / 100))}</div>
            <span style={{ fontSize:'10px', color:'#aaa' }}>전액 상환 시 1회</span>
          </div>
        </div>
      </div>

      {/* ③ 중순위 */}
      {mezAmt > 0 && (
        <div style={sectionStyle}>
          <div style={{ fontWeight:'bold', fontSize:'13px', color:'#6c3483', marginBottom:'12px' }}>
            ③ 중순위 (이자율 {mezRate}% — 트랜치 자동 연동)
          </div>
          <ItemRow label="이자 (연간)"
            baseLabel="중순위 금액" baseAmt={mezAmt}
            pctKey={null} calcAmt={mezIntAmt}
            note="월별 이자는 현금유출입 계산기에서 자동 계산" />
          <ItemRow label="취급수수료"
            baseLabel="중순위 금액" baseAmt={mezAmt}
            pctKey="mezFee" pctVal={d.mezFee||'0'} calcAmt={mezFeeAmt}
            note="실행 시점 1회" />
        </div>
      )}

      {/* ④ 후순위 */}
      {juniorAmt > 0 && (
        <div style={sectionStyle}>
          <div style={{ fontWeight:'bold', fontSize:'13px', color:'#922b21', marginBottom:'12px' }}>
            ④ 후순위 (이자율 {juniorRate}% — 트랜치 자동 연동)
          </div>
          <ItemRow label="이자 (연간)"
            baseLabel="후순위 금액" baseAmt={juniorAmt}
            pctKey={null} calcAmt={juniorIntAmt}
            note="월별 이자는 현금유출입 계산기에서 자동 계산" />
          <ItemRow label="취급수수료"
            baseLabel="후순위 금액" baseAmt={juniorAmt}
            pctKey="juniorFee" pctVal={d.juniorFee||'0'} calcAmt={juniorFeeAmt}
            note="실행 시점 1회" />
        </div>
      )}

      {/* ⑤ 중도금 이자 */}
      <div style={sectionStyle}>
        <div style={{ fontWeight:'bold', fontSize:'13px', color:'#1a5c2a', marginBottom:'12px' }}>
          ⑤ 중도금 이자 (시행사 부담 — 무이자 조건)
        </div>
        <div style={rowS}>
          <span style={{ fontSize:'11px', color:'#888' }}>이자율</span>
          <input type="number" value={d.midRate||'0'} min="0" step="0.1"
            onChange={e => upd('midRate', e.target.value)}
            style={pctS} />
          <span style={{ fontSize:'11px', color:'#888' }}>% (연)</span>
          <span style={{ fontSize:'11px', color:'#aaa' }}>=</span>
          <div style={autoS}>{fmtAmt(midIntAmt)}</div>
          <span style={{ fontSize:'11px', color:'#888' }}>천원 (총액)</span>
          {midRate > 0 && ymList.length > 0 && (
            <button onClick={() => setShowMidDetail(true)}
              style={{ padding:'4px 12px', backgroundColor:'#1a5c2a', color:'white',
                border:'none', borderRadius:'4px', cursor:'pointer', fontSize:'11px' }}>
              📋 월별 상세
            </button>
          )}
        </div>
        <div style={{ fontSize:'10px', color:'#888', marginTop:'4px' }}>
          중도금 합계 — 공동주택: {fmtAmt(aptMid.reduce((s,v)=>s+(v||0),0))} /
          오피스텔: {fmtAmt(offiMid.reduce((s,v)=>s+(v||0),0))} /
          근린상가: {fmtAmt(storeMid.reduce((s,v)=>s+(v||0),0))} 천원
        </div>
      </div>

      {/* 중도금 이자 팝업 */}
      {showMidDetail && (() => {
        // 월별 중도금 상환액 계산 (잔금 납부 비례)
        const totalMid_ = aptMid.reduce((s,v)=>s+(v||0),0) + offiMid.reduce((s,v)=>s+(v||0),0) + storeMid.reduce((s,v)=>s+(v||0),0);
        const aptBal_   = salesData?.aptBalMonthly   || [];
        const offiBal_  = salesData?.offiBalMonthly  || [];
        const storeBal_ = salesData?.storeBalMonthly || [];
        const totalBal_ = aptBal_.reduce((s,v)=>s+(v||0),0) + offiBal_.reduce((s,v)=>s+(v||0),0) + storeBal_.reduce((s,v)=>s+(v||0),0);

        // 월별 데이터 계산
        const rows_ = ymList.map((ym, i) => {
          const inApt   = aptMid[i]  || 0;
          const inOffi  = offiMid[i] || 0;
          const inStore = storeMid[i]|| 0;
          const inTotal = inApt + inOffi + inStore;
          const balThis = (aptBal_[i]||0) + (offiBal_[i]||0) + (storeBal_[i]||0);
          const repay   = totalBal_ > 0 && balThis > 0 ? Math.round(totalMid_ * balThis / totalBal_) : 0;
          const bal     = midBalances[i];
          const interest = Math.round(bal * midRate / 100 / 12);
          return { ym, inApt, inOffi, inStore, inTotal, repay, bal, interest };
        }).filter(r => r.inTotal > 0 || r.repay > 0 || r.bal > 0);

        const totalIncome  = totalMid_;
        const totalRepay   = rows_.reduce((s,r)=>s+r.repay,0);
        const totalInterest = midIntAmt;

        // 월 목록 (컬럼)
        const visibleYms = rows_.map(r => r.ym);
        const thS_ = { padding:'4px 6px', fontSize:'10px', fontWeight:'bold', textAlign:'right',
          whiteSpace:'nowrap', color:'white', backgroundColor:'#1a5c2a' };
        const tdS_ = (bg='white', color='#333', bold=false) => ({
          padding:'3px 6px', backgroundColor:bg, color, fontWeight:bold?'bold':'normal',
          borderBottom:'1px solid #eee', textAlign:'right', fontSize:'11px', whiteSpace:'nowrap',
        });
        const fmt_ = (v) => v > 0 ? formatNumber(Math.round(v)) : '—';

        // 행 정의
        const tableRows = [
          {
            label:'중도금 유입', color:'#1a3a5c', bg:'#f0f4f8', bold:true,
            vals: visibleYms.map(ym => { const r=rows_.find(x=>x.ym===ym); return r?.inTotal||0; }),
            total: totalIncome,
          },
          ...(aptMid.some(v=>v>0) ? [{
            label:'└ 공동주택', color:'#1a3a5c', bg:'white', bold:false,
            vals: visibleYms.map(ym => { const r=rows_.find(x=>x.ym===ym); return r?.inApt||0; }),
            total: aptMid.reduce((s,v)=>s+(v||0),0),
          }] : []),
          ...(offiMid.some(v=>v>0) ? [{
            label:'└ 오피스텔', color:'#347a6a', bg:'white', bold:false,
            vals: visibleYms.map(ym => { const r=rows_.find(x=>x.ym===ym); return r?.inOffi||0; }),
            total: offiMid.reduce((s,v)=>s+(v||0),0),
          }] : []),
          ...(storeMid.some(v=>v>0) ? [{
            label:'└ 근린상가', color:'#7d5a00', bg:'white', bold:false,
            vals: visibleYms.map(ym => { const r=rows_.find(x=>x.ym===ym); return r?.inStore||0; }),
            total: storeMid.reduce((s,v)=>s+(v||0),0),
          }] : []),
          {
            label:'중도금 상환', color:'#c0392b', bg:'#fff5f5', bold:true,
            vals: visibleYms.map(ym => { const r=rows_.find(x=>x.ym===ym); return r?.repay||0; }),
            total: totalRepay,
          },
          {
            label:'누적 잔액', color:'#1a1a2e', bg:'#f0f4f8', bold:true,
            vals: visibleYms.map(ym => { const r=rows_.find(x=>x.ym===ym); return r?.bal||0; }),
            total: null,
          },
          {
            label:'월 이자', color:'#c0750a', bg:'#fff8f0', bold:true,
            vals: visibleYms.map(ym => { const r=rows_.find(x=>x.ym===ym); return r?.interest||0; }),
            total: totalInterest,
          },
        ];

        return (
          <div style={{ position:'fixed', top:0, left:0, width:'100vw', height:'100vh',
            backgroundColor:'rgba(0,0,0,0.5)', zIndex:3000, display:'flex',
            alignItems:'center', justifyContent:'center' }}>
            <div style={{ backgroundColor:'white', borderRadius:'10px',
              width:'90vw', maxWidth:'1100px', maxHeight:'85vh',
              display:'flex', flexDirection:'column', padding:'20px' }}>
              {/* 헤더 */}
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'12px' }}>
                <h3 style={{ margin:0, color:'#1a5c2a' }}>📋 중도금 월별 상세</h3>
                <div style={{ display:'flex', gap:'16px', alignItems:'center' }}>
                  <span style={{ fontSize:'12px', color:'#888' }}>이자율 {midRate}% (연) | 단위: 천원</span>
                  <button onClick={() => setShowMidDetail(false)}
                    style={{ padding:'5px 14px', border:'1px solid #ddd', borderRadius:'6px', cursor:'pointer', fontSize:'12px' }}>
                    ✕ 닫기
                  </button>
                </div>
              </div>
              {/* 타임라인 테이블 */}
              <div style={{ overflowX:'auto', flex:1 }}>
                <table style={{ borderCollapse:'collapse', fontSize:'11px', whiteSpace:'nowrap' }}>
                  <thead>
                    <tr>
                      <th style={{ ...thS_, textAlign:'left', minWidth:'100px', position:'sticky', left:0, zIndex:2 }}>항목</th>
                      <th style={{ ...thS_, minWidth:'80px' }}>합계</th>
                      {visibleYms.map(ym => (
                        <th key={ym} style={{ ...thS_, minWidth:'70px' }}>{ym.slice(2)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tableRows.map((row, ri) => (
                      <tr key={ri}>
                        <td style={{ ...tdS_(row.bg, row.color, row.bold), textAlign:'left',
                          paddingLeft: row.label.startsWith('└') ? '16px' : '8px',
                          position:'sticky', left:0, zIndex:1 }}>
                          {row.label}
                        </td>
                        <td style={tdS_(row.bg, row.color, true)}>
                          {row.total !== null ? fmt_(row.total) : '—'}
                        </td>
                        {row.vals.map((v, vi) => (
                          <td key={vi} style={tdS_(v>0?row.bg:'white', v>0?row.color:'#ddd', row.bold)}>
                            {fmt_(v)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ⑥ 대여금 이자 */}
      <div style={sectionStyle}>
        <div style={{ fontWeight:'bold', fontSize:'13px', color:'#7d5a00', marginBottom:'12px' }}>
          ⑥ 대여금 이자
        </div>
        <div style={rowS}>
          <span style={{ fontSize:'11px', color:'#888' }}>대여금</span>
          <input type="number" value={d.loanAmt||''} min="0"
            onChange={e => upd('loanAmt', e.target.value)}
            style={{ ...inputS, width:'120px' }} placeholder="금액(천원)" />
          <span style={{ fontSize:'11px', color:'#888' }}>천원 ×</span>
          <input type="number" value={d.loanRate||'0'} min="0" step="0.1"
            onChange={e => upd('loanRate', e.target.value)}
            style={pctS} />
          <span style={{ fontSize:'11px', color:'#888' }}>% =</span>
          <div style={autoS}>{fmtAmt(loanIntAmt)}</div>
          <span style={{ fontSize:'11px', color:'#888' }}>천원/년</span>
        </div>
      </div>

      {/* ⑦ 기타 */}
      <div style={sectionStyle}>
        <div style={{ fontWeight:'bold', fontSize:'13px', color:'#555', marginBottom:'12px' }}>
          ⑦ 기타 금융비용
        </div>
        <div style={rowS}>
          <input type="text" value={d.etcName||''} placeholder="항목명"
            onChange={e => upd('etcName', e.target.value)}
            style={{ ...inputS, width:'140px', textAlign:'left' }} />
          <input type="number" value={d.etcAmt||''} min="0"
            onChange={e => upd('etcAmt', e.target.value)}
            style={{ ...inputS, width:'120px' }} placeholder="금액(천원)" />
          <span style={{ fontSize:'11px', color:'#888' }}>천원</span>
        </div>
      </div>

      {/* 합계 */}
      {(() => {
        const cfr = cashFlowResult;
        const sIntAmt  = cfr ? cfr.result.reduce((s,r)=>s+(r.intS||0),0) : seniorIntAmt;
        const mIntAmt  = cfr ? cfr.result.reduce((s,r)=>s+(r.intM||0),0) : mezIntAmt;
        const jIntAmt  = cfr ? cfr.result.reduce((s,r)=>s+(r.intJ||0),0) : juniorIntAmt;
        const midAmt   = cfr ? cfr.result.reduce((s,r)=>s+(r.midInt||0),0) : midIntAmt;
        const unindrawnAmt_ = Math.round(seniorAmt * unindrawnPct / 100);
        const calcGrand = mgmtAmt+seniorFeeAmt+mezFeeAmt+juniorFeeAmt+sIntAmt+mIntAmt+jIntAmt+midAmt+unindrawnAmt_+loanIntAmt;
        const isCalc = !!cfr;
        return (
          <div style={{ backgroundColor:'#1a1a2e', color:'white', borderRadius:'8px', padding:'16px 20px' }}>
            <div style={{ fontSize:'12px', color: isCalc?'#27ae60':'rgba(255,255,255,0.7)', marginBottom:'8px' }}>
              금융비 합계 {isCalc?'(실계산값)':'(연간 기준 추정)'}
            </div>
            <div style={{ display:'flex', gap:'20px', flexWrap:'wrap', fontSize:'12px' }}>
              {[
                { label:'주관사수수료',   val: mgmtAmt      },
                { label:'선순위 이자',    val: sIntAmt       },
                { label:'선순위 취급',    val: seniorFeeAmt  },
                ...(mezAmt>0    ? [{ label:'중순위 이자', val: mIntAmt    }, { label:'중순위 취급', val: mezFeeAmt    }] : []),
                ...(juniorAmt>0 ? [{ label:'후순위 이자', val: jIntAmt   }, { label:'후순위 취급', val: juniorFeeAmt }] : []),
                { label:'중도금 이자',    val: midAmt        },
                ...(loanAmt>0   ? [{ label:'대여금 이자', val: loanIntAmt }] : []),
              ].map(({ label, val }) => val > 0 ? (
                <div key={label}>
                  <div style={{ color:'rgba(255,255,255,0.6)', fontSize:'10px' }}>{label}</div>
                  <div style={{ fontWeight:'bold' }}>{fmtAmt(val)}</div>
                </div>
              ) : null)}
            </div>
            <div style={{ borderTop:'1px solid rgba(255,255,255,0.2)', marginTop:'12px', paddingTop:'12px',
              display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span style={{ fontSize:'13px', color:'rgba(255,255,255,0.7)' }}>총 금융비용</span>
              <span style={{ fontSize:'18px', fontWeight:'bold', color:'#f5cba7' }}>
                {formatNumber(calcGrand)} 천원
              </span>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

function Finance(props) {
  const [active, setActive] = useState(null); // null | 'financeCost' | 'cashflow'
  const [showFunding, setShowFunding] = useState(false);
  const [showLTV,     setShowLTV]     = useState(false);

  // 사업비탭 연필 버튼 → 금융비 세부항목 자동 열기
  React.useEffect(() => {
    const handler = () => setActive('financeCost');
    window.addEventListener('open-finance-cost-section', handler);
    return () => window.removeEventListener('open-finance-cost-section', handler);
  }, []);

  const hasData  = !!(props.landResult || props.directResult);
  const hasSales = !!(props.salesData?.salesSumApt || props.salesData?.salesSumOffi || props.salesData?.salesSumStore);

  const toggle = (key) => setActive(prev => prev === key ? null : key);

  const btnStyle = (isActive, color, activeColor, disabled = false) => ({
    padding:'10px 20px',
    backgroundColor: disabled ? '#bdc3c7' : isActive ? activeColor : color,
    color:'white', border:'none', borderRadius:'8px',
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontSize:'13px', fontWeight:'bold',
    boxShadow: disabled ? 'none' : '0 2px 6px rgba(0,0,0,0.15)',
    opacity: disabled ? 0.6 : 1,
  });

  return (
    <div>
      {showFunding && <FundingModal {...props} cashFlowResult={props.cashFlowResult} onClose={() => setShowFunding(false)} />}
      {showLTV && <LTVModal
        salesData={props.salesData}
        incomeData={props.incomeData}
        projectName={props.projectName}
        data={props.financeData}
        onChange={props.onFinanceChange}
        onClose={() => setShowLTV(false)}
      />}

      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'24px' }}>
        <h3 style={{ margin:0 }}>금융</h3>
      </div>

      <div style={{ display:'flex', gap:'12px', flexWrap:'wrap', marginBottom:'32px' }}>
        <button style={btnStyle(false, hasData ? '#1a1a2e' : '#95a5a6', '#1a1a2e', !hasData)}
          onClick={() => hasData && setShowFunding(true)}
          title={!hasData ? '사업비 탭을 먼저 방문해주세요' : ''}>
          📊 사업비 재원조달
        </button>
        <button style={btnStyle(false, hasSales ? '#1a3a5c' : '#95a5a6', '#1a3a5c', !hasSales)}
          onClick={() => hasSales && setShowLTV(true)}
          title={!hasSales ? '분양율 탭을 먼저 방문해주세요' : ''}>
          🏦 LTV / PF 담보인정액 · 트랜치
        </button>
        <button style={btnStyle(active==='financeCost', '#2c3e50', '#1a3a5c')}
          onClick={() => toggle('financeCost')}>
          💰 금융비 세부항목
        </button>
        <button style={btnStyle(active==='cashflow', '#922b21', '#7b241c')}
          onClick={() => toggle('cashflow')}>
          💹 현금유출입 계산기
        </button>
      </div>

      {!hasData && (
        <div style={{ padding:'12px 16px', backgroundColor:'#fff8e1', borderRadius:'8px',
          border:'1px solid #ffe082', fontSize:'12px', color:'#795548', marginBottom:'16px' }}>
          💡 사업비 탭을 먼저 방문하면 재원조달 데이터가 자동으로 연동됩니다.
        </div>
      )}

      {active === 'financeCost' && (
        <FinanceCostSection
          financeData={props.financeData}
          onChange={props.onFinanceChange}
          salesData={props.salesData}
          cashFlowResult={props.cashFlowResult}
        />
      )}

      {/* CashFlowCalc 항상 백그라운드 렌더링 — cashFlowResult 항상 계산 */}
      <div style={{ display: active === 'cashflow' ? 'block' : 'none' }}>
        <CashFlowCalc
          salesData={props.salesData}
          monthlyPayments={props.monthlyPayments}
          financeData={props.financeData}
          onFinanceChange={props.onFinanceChange}
          onCashFlowResult={props.onCashFlowResult}
          projectName={props.projectName}
        />
      </div>

      {active === null && (
        <div style={{ color:'#aaa', textAlign:'center', padding:'60px',
          border:'2px dashed #ddd', borderRadius:'12px', fontSize:'14px' }}>
          위 버튼을 선택하면 금융 분석을 시작할 수 있습니다.
        </div>
      )}
    </div>
  );
}

export { FundingModal, FinanceCostSection };
export default Finance;
