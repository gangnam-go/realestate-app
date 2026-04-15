import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';

const fmt  = (v) => v?.toLocaleString('ko-KR') || '0';
const fmtN = (v) => Math.round(v).toLocaleString('ko-KR');
const p    = (v) => parseFloat(String(v||'').replace(/,/g,'')) || 0;

function VATCalculation({ data, onChange, archData, incomeData }) {
  const [moefCosts, setMoefCosts]   = useState([]);
  const [selectedYear,  setSelectedYear]  = useState('2026');
  const [selectedUsage, setSelectedUsage] = useState('주거용(아파트 등)');
  const [annunMethod, setAnnunMethod] = useState(data?.annunMethod || 'price');  // ← 추가

  // 행안부 신축가격기준액 로드
  useEffect(() => {
    const load = async () => {
      try {
        const snap = await getDoc(doc(db, 'settings', 'moefStdCost'));
        if (snap.exists()) {
          const items = snap.data().items || [];
          setMoefCosts(items);
          if (items.length > 0) {
            const latest = items.reduce((a, b) => parseInt(a.year) >= parseInt(b.year) ? a : b);
            setSelectedYear(latest.year);
            setSelectedUsage(items.find(m => m.year === latest.year)?.usage || items[0].usage);
          }
        } else {
          setMoefCosts([
            { year: '2026', usage: '주거용(아파트 등)', cost: '860000' },
            { year: '2026', usage: '상업용(상가 등)',   cost: '860000' },
            { year: '2026', usage: '공업용(공장 등)',   cost: '840000' },
            { year: '2026', usage: '농수산용',          cost: '640000' },
            { year: '2026', usage: '문화복지/교육',     cost: '860000' },
            { year: '2026', usage: '공공용',            cost: '850000' },
          ]);
        }
      } catch(e) { console.error(e); }
    };
    load();
  }, []);

  // ── 행안부 신축가격기준액 선택값 ──
  const years  = [...new Set(moefCosts.map(m => m.year))].sort((a,b) => b-a);
  const usages = moefCosts.filter(m => m.year === selectedYear).map(m => m.usage);
  const moefSelected = moefCosts.find(m => m.year === selectedYear && m.usage === selectedUsage);
  const moefCostVal  = p(moefSelected?.cost) || 860000;

  // ── 건축개요 연동 ──
  const plots       = archData?.plots || [];
  const landM2      = plots.reduce((s, pl) => s + (p(pl.areaM2)), 0);
  const pubLandAmt  = plots.reduce((s, pl) => s + (p(pl.totalPrice)), 0); // 개별공시지가금액 합계(원)
  const aboveM2     = p(archData?.floorAboveM2);
  const underM2     = p(archData?.floorUnderM2);
  const totalFloorM2 = aboveM2 + underM2;

  // ── 수입탭 연동 ──
  const aptRows    = incomeData?.aptRows    || [];
  const publicRows = incomeData?.publicRows || [];  // ← 추가
  const offiRows   = incomeData?.offiRows   || [];
  const storeRows  = incomeData?.storeRows  || [];
  // const balcony   = incomeData?.balcony   || {};
  // const balBurden = incomeData?.balconyBurden || '분양자 부담';

  // ── 공급면적 기준 계산 ──
  const calcSupM2 = (rows) => rows.reduce((s, r) => {
    const excl = p(r.excl_m2), wall = p(r.wall_m2), core = p(r.core_m2);
    const units = p(r.units);
    return s + (excl + wall + core) * units;
  }, 0);

  const calcSupM2Taxable = (rows) => rows.reduce((s, r) => {
    const excl = p(r.excl_m2), wall = p(r.wall_m2), core = p(r.core_m2);
    const units = p(r.units);
    return s + (excl > 85 ? (excl + wall + core) * units : 0);
  }, 0);

  const calcSupM2Exempt = (rows) => rows.reduce((s, r) => {
    const excl = p(r.excl_m2), wall = p(r.wall_m2), core = p(r.core_m2);
    const units = p(r.units);
    return s + (excl <= 85 ? (excl + wall + core) * units : 0);
  }, 0);

  // aptRows, publicRows, offiRows, storeRows (pubfacRows 제외)
  const areaAptAll   = calcSupM2(aptRows);
  const areaPublicAll= calcSupM2(publicRows);
  const areaOffi     = calcSupM2(offiRows);
  const areaStore    = calcSupM2(storeRows);

  const areaDenominator = areaAptAll + areaPublicAll + areaOffi + areaStore;

  const areaTaxable = calcSupM2Taxable(aptRows) + calcSupM2Taxable(publicRows) + areaOffi + areaStore;
  const areaExempt  = calcSupM2Exempt(aptRows)  + calcSupM2Exempt(publicRows);

  const taxRatioArea   = areaDenominator > 0 ? areaTaxable / areaDenominator : 0;
  const exemptRatioArea= areaDenominator > 0 ? areaExempt  / areaDenominator : 0;
  // 총분양가(VAT제외) = apt+offi+store (발코니 제외, 천원 단위)
  const calcIncome = (rows, mode) => rows.reduce((s, r) => {
    const excl=p(r.excl_m2), wall=p(r.wall_m2), core=p(r.core_m2);
    const mgmt=p(r.mgmt_m2), comm=p(r.comm_m2), park=p(r.park_m2);
    const tel=p(r.tel_m2), elec=p(r.elec_m2);
    const units=p(r.units), pyPrice=p(r.py_price);
    const sup_py  = (excl+wall+core)*0.3025;
    const cont_py = (excl+wall+core+mgmt+comm+park+tel+elec)*0.3025;
    return s + (mode==='apt' ? pyPrice*sup_py : pyPrice*cont_py) * units;
  }, 0);
  const totalSaleIncome = calcIncome(aptRows,'apt') + calcIncome(offiRows,'offi') + calcIncome(storeRows,'store');
  // 천원 → 원
  const totalSaleAmt = totalSaleIncome * 1000;

  // 과세면적: offi+store 전용면적×세대수 (㎡)
  const taxableM2 = [...offiRows, ...storeRows].reduce((s, r) => s + p(r.excl_m2) * p(r.units), 0);

  // 면세면적: apt 85㎡ 이하 전용면적×세대수
  const exemptM2  = aptRows.reduce((s, r) => {
    const excl = p(r.excl_m2);
    return s + (excl <= 85 ? excl * p(r.units) : 0);
  }, 0);

  const totalCalcM2 = taxableM2 + exemptM2;
  const taxRatio    = totalCalcM2 > 0 ? taxableM2  / totalCalcM2 : 0;
  const exemptRatio = totalCalcM2 > 0 ? exemptM2   / totalCalcM2 : 0;

  // ── taxRatio/finalVAT 변경 시 자동 저장 ──
  useEffect(() => {
    if (!onChange) return;
    const buildStdAmt_ = totalFloorM2 * moefCostVal;
    const landStdAmt_  = pubLandAmt;
    const totalStdAmt_ = buildStdAmt_ + landStdAmt_;
    const buildStdRatio_ = totalStdAmt_ > 0 ? buildStdAmt_ / totalStdAmt_ : 0;
    const buildTaxable_  = totalSaleAmt * buildStdRatio_ * taxRatio;
    const finalVAT_      = buildTaxable_ * 0.1;
    // 이전 값과 다를 때만 저장 (무한루프 방지)
    if (
      Math.abs((data?.taxRatio || 0) - taxRatio) > 0.00001 ||
      Math.abs((data?.finalVAT || 0) - finalVAT_) > 1
    ) {
      onChange({ ...(data||{}), taxRatio, finalVAT: Math.round(finalVAT_) });
    }
  }, [taxRatio, totalSaleAmt, totalFloorM2, moefCostVal, pubLandAmt]); // eslint-disable-line

  // ── 기준시가 계산 ──
  const buildStdAmt = totalFloorM2 * moefCostVal;  // 건물기준시가(원)
  const landStdAmt  = pubLandAmt;                   // 토지기준시가(원)
  const totalStdAmt = buildStdAmt + landStdAmt;

  const landStdRatio  = totalStdAmt > 0 ? landStdAmt  / totalStdAmt : 0;
  const buildStdRatio = totalStdAmt > 0 ? buildStdAmt / totalStdAmt : 0;

  // ── 안분 계산 결과 ──
  const landExempt   = totalSaleAmt * landStdRatio;
  const buildExempt  = totalSaleAmt * buildStdRatio * exemptRatio;
  const buildTaxable = totalSaleAmt * buildStdRatio * taxRatio;
  const finalVAT     = buildTaxable * 0.1;

  const checkSum = landExempt + buildExempt + buildTaxable;

  // 스타일
  const sectionBox = { border: '1px solid #e0e0e0', borderRadius: '8px', padding: '16px 20px', marginBottom: '16px' };
  const secTitle = (t, color='#2c3e50') => (
    <div style={{ fontWeight: 'bold', fontSize: '14px', color, marginBottom: '12px', paddingBottom: '6px', borderBottom: `2px solid ${color}20` }}>
      {t}
    </div>
  );
  const row = (label, value, color='#2c3e50', bold=false, sub=null) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: '1px solid #f5f5f5' }}>
      <span style={{ fontSize: '12px', color: '#666' }}>{label}</span>
      <div style={{ textAlign: 'right' }}>
        <span style={{ fontSize: bold?'14px':'13px', fontWeight: bold?'bold':'normal', color }}>{value}</span>
        {sub && <div style={{ fontSize: '10px', color: '#aaa' }}>{sub}</div>}
      </div>
    </div>
  );
  const formula = (text) => (
    <div style={{ backgroundColor: '#f8f9fa', border: '1px solid #e9ecef', borderRadius: '4px', padding: '7px 12px', fontFamily: 'monospace', fontSize: '11px', color: '#495057', margin: '5px 0' }}>
      {text}
    </div>
  );
  const autoTag = <span style={{ fontSize: '10px', backgroundColor: '#e8f4fc', color: '#1565c0', padding: '1px 6px', borderRadius: '8px', marginLeft: '6px' }}>자동연동</span>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h3 style={{ margin: 0 }}>부가세 안분</h3>
        <div style={{ fontSize: '12px', color: '#888' }}>부가가치세법 시행령 제64조</div>
      </div>

      {/* 행안부 신축가격기준액 선택 */}
      <div style={{ ...sectionBox, backgroundColor: '#f3e5f5', borderColor: '#ce93d8' }}>
        {secTitle('🏛 행안부 신축가격기준액 (연도/용도 선택)', '#6a1b9a')}
        <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div>
            <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '4px' }}>연도</label>
            <select value={selectedYear} onChange={e => { setSelectedYear(e.target.value); setSelectedUsage(moefCosts.find(m=>m.year===e.target.value)?.usage || ''); }}
              style={{ padding: '6px 10px', border: '1px solid #8e44ad', borderRadius: '4px', fontSize: '13px', color: '#6a1b9a', fontWeight: 'bold' }}>
              {years.map(y => <option key={y} value={y}>{y}년</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#555', display: 'block', marginBottom: '4px' }}>용도</label>
            <select value={selectedUsage} onChange={e => setSelectedUsage(e.target.value)}
              style={{ padding: '6px 10px', border: '1px solid #8e44ad', borderRadius: '4px', fontSize: '13px', color: '#6a1b9a' }}>
              {usages.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          <div style={{ fontSize: '15px', fontWeight: 'bold', color: '#6a1b9a', paddingBottom: '6px' }}>
            {fmt(moefCostVal)} 원/㎡
          </div>
        </div>
        <div style={{ fontSize: '11px', color: '#888', marginTop: '8px' }}>
          💡 기준정보(⚙)에서 연도별/용도별 금액을 관리하세요
        </div>
      </div>

      {/* 안분 계산 입력 */}
      <div style={sectionBox}>
        {secTitle('■ 안분 계산 입력')}

        {row('총 분양가 합계 (VAT제외, 원)', `${fmtN(totalSaleAmt)} 원`, '#1565c0', true,
          `apt+offi+store (발코니 제외) = ${fmtN(totalSaleIncome)} 천원`)}
        {row(<>토지면적 (㎡) {autoTag}</>, `${fmtN(landM2)} ㎡`, '#555', false, '건축개요 토지조서 합계')}
        {row(<>개별공시지가금액 합계 (원) {autoTag}</>, `${fmtN(pubLandAmt)} 원`, '#555', false, '건축개요 토지조서 공시지가 합계')}
        {row(<>건물 전체 연면적 (㎡) {autoTag}</>, `${fmtN(totalFloorM2)} ㎡`, '#555', false, `지상${fmtN(aboveM2)} + 지하${fmtN(underM2)}`)}

        <div style={{ height: '8px' }} />
        {row(<>과세면적 (㎡) {autoTag}</>, `${fmtN(taxableM2)} ㎡`, '#e74c3c', false, 'offi+store 전용면적×세대수')}
        {row(<>면세면적 (㎡) {autoTag}</>, `${fmtN(exemptM2)} ㎡`, '#27ae60', false, 'apt 85㎡ 이하 전용면적×세대수')}
        {row('과세비율', `${(taxRatio*100).toFixed(2)} %`, '#e74c3c')}
        {row('면세비율', `${(exemptRatio*100).toFixed(2)} %`, '#27ae60')}
      </div>

      {/* 기준시가 계산 */}
      <div style={sectionBox}>
        {secTitle('■ 기준시가 계산')}
        {formula(`건물기준시가 = ${fmtN(totalFloorM2)}㎡ × ${fmt(moefCostVal)}원/㎡ = ${fmtN(buildStdAmt)}원`)}
        {formula(`토지기준시가 = 개별공시지가금액 합계 = ${fmtN(landStdAmt)}원`)}
        {formula(`총기준시가 = ${fmtN(buildStdAmt)} + ${fmtN(landStdAmt)} = ${fmtN(totalStdAmt)}원`)}
        <div style={{ height: '4px' }} />
        {row('토지비율', `${(landStdRatio*100).toFixed(4)} %`)}
        {row('건물비율', `${(buildStdRatio*100).toFixed(4)} %`)}
      </div>

      {/* 안분 계산 결과 */}
      <div style={{ ...sectionBox, borderColor: '#ffcc02', backgroundColor: '#fffde7' }}>
        {secTitle('■ 안분 계산 결과', '#e65100')}

        {formula(`토지 (면세) = ${fmtN(totalSaleAmt)} × ${(landStdRatio*100).toFixed(4)}% = ${fmtN(landExempt)}원`)}
        {formula(`건물 (면세) = ${fmtN(totalSaleAmt)} × ${(buildStdRatio*100).toFixed(4)}% × ${(exemptRatio*100).toFixed(2)}% = ${fmtN(buildExempt)}원`)}
        {formula(`건물 (과세) = ${fmtN(totalSaleAmt)} × ${(buildStdRatio*100).toFixed(4)}% × ${(taxRatio*100).toFixed(2)}% = ${fmtN(buildTaxable)}원`)}

        <div style={{ marginTop: '12px', backgroundColor: 'white', borderRadius: '6px', padding: '12px 16px', border: '1px solid #eee' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px' }}>
            {[
              { label: '토지 (면세)', value: landExempt,   color: '#1565c0' },
              { label: '건물 (면세)', value: buildExempt,  color: '#27ae60' },
              { label: '건물 (과세)', value: buildTaxable, color: '#e74c3c' },
              { label: '합계',        value: checkSum,     color: '#2c3e50' },
            ].map(({ label, value, color }) => (
              <div key={label} style={{ backgroundColor: '#f8f9fa', borderRadius: '6px', padding: '8px 12px' }}>
                <div style={{ fontSize: '11px', color: '#888', marginBottom: '3px' }}>{label}</div>
                <div style={{ fontSize: '13px', fontWeight: 'bold', color }}>{fmtN(value)} 원</div>
              </div>
            ))}
          </div>
          <div style={{ borderTop: '2px solid #e65100', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#e65100' }}>★ 최종 부가세</div>
            <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#e65100' }}>{fmtN(finalVAT)} 원</div>
          </div>
          <div style={{ fontSize: '11px', color: '#888', marginTop: '6px' }}>
            = 건물(과세) {fmtN(buildTaxable)}원 × 10%
          </div>
        </div>

        {/* 안분비율 */}
        <div style={{ marginTop: '12px', backgroundColor: '#fff8e1', borderRadius: '6px', padding: '10px 14px', border: '1px solid #ffe082', fontSize: '12px' }}>
          <div style={{ fontWeight: 'bold', marginBottom: '6px', color: '#e65100' }}>[안분비율]</div>
          <div>토지기준시가: {fmtN(landStdAmt)} 원</div>
          <div>건물기준시가: {fmtN(buildStdAmt)} 원</div>
          <div>과세면적비율: {(taxRatio*100).toFixed(2)} %</div>
        </div>

        {/* 총분양가 대비차 */}
        <div style={{ marginTop: '8px', fontSize: '12px', color: checkSum === totalSaleAmt ? '#27ae60' : '#e74c3c', textAlign: 'right' }}>
          총분양가 대비차: {fmtN(totalSaleAmt - checkSum)} 원
          {Math.abs(totalSaleAmt - checkSum) < 10 && ' ✓ (반올림 오차)'}
        </div>
      </div>
    </div>
  );
}

export default VATCalculation;
