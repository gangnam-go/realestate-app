import React, { useState, useEffect } from 'react';
import { formatNumber, parseNumber, m2ToPy } from '../utils';

const textField = (label, key, data, onChange) => (
  <div style={{ marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '12px' }}>
    <label style={{ width: '170px', fontWeight: 'bold', fontSize: '13px', flexShrink: 0 }}>{label}</label>
    <input value={data[key] || ''}
      onChange={e => onChange({ ...data, [key]: e.target.value })}
      style={{ flex: 1, padding: '6px 10px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '13px' }} />
  </div>
);

const numField = (label, key, data, onChange) => (
  <div style={{ marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '12px' }}>
    <label style={{ width: '170px', fontWeight: 'bold', fontSize: '13px', flexShrink: 0 }}>{label}</label>
    <input value={data[key] || ''}
      onChange={e => onChange({ ...data, [key]: formatNumber(parseNumber(e.target.value)) })}
      style={{ flex: 1, padding: '6px 10px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '13px', textAlign: 'right' }} />
  </div>
);

const areaField = (labelM2, keyM2, labelPy, keyPy, data, onChange) => (
  <>
    <div style={{ marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '12px' }}>
      <label style={{ width: '170px', fontWeight: 'bold', fontSize: '13px', flexShrink: 0 }}>{labelM2}</label>
      <input value={data[keyM2] || ''}
        onChange={e => {
          const m2 = formatNumber(parseNumber(e.target.value));
          onChange({ ...data, [keyM2]: m2, [keyPy]: m2ToPy(parseNumber(m2)) });
        }}
        style={{ flex: 1, padding: '6px 10px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '13px', textAlign: 'right' }} />
    </div>
    <div style={{ marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '12px' }}>
      <label style={{ width: '170px', fontWeight: 'bold', fontSize: '13px', flexShrink: 0, color: '#888' }}>{labelPy} (자동)</label>
      <input value={data[keyPy] || ''} readOnly
        style={{ flex: 1, padding: '6px 10px', border: '1px solid #eee', borderRadius: '4px', fontSize: '13px', textAlign: 'right', backgroundColor: '#f8f9fa', color: '#555' }} />
    </div>
  </>
);

const resultField = (label, value) => (
  <div style={{ marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '12px' }}>
    <label style={{ width: '170px', fontWeight: 'bold', fontSize: '13px', flexShrink: 0, color: '#2980b9' }}>{label} (자동)</label>
    <input value={value} readOnly
      style={{ flex: 1, padding: '6px 10px', border: '1px solid #bee3f8', borderRadius: '4px', fontSize: '13px', textAlign: 'right', backgroundColor: '#ebf5fb', color: '#1a5276', fontWeight: 'bold' }} />
  </div>
);

const sectionTitle = (title, extra) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#2980b9', color: 'white', padding: '6px 12px', borderRadius: '4px', marginBottom: '12px', marginTop: '20px' }}>
    <span style={{ fontWeight: 'bold', fontSize: '13px' }}>{title}</span>
    {extra}
  </div>
);

const PERIOD_OPTIONS = {
  foundation: [
    { label: '말뚝없음',   value: 0.9 },
    { label: '기성말뚝',   value: 1.0 },
    { label: '제자리말뚝', value: 1.1 },
    { label: '특수공법',   value: 1.3 },
  ],
  soil: [
    { label: '양호', value: 0.9 },
    { label: '보통', value: 1.0 },
    { label: '불량', value: 1.1 },
  ],
  frame: [
    { label: '철골조', value: 0.9 },
    { label: '철콘조', value: 1.1 },
  ],
  usage: [
    { label: '공장·창고',          value: 0.8 },
    { label: '근생·공동주택·학교', value: 1.0 },
    { label: '병원·호텔',          value: 1.2 },
    { label: '특수건물',           value: 1.5 },
  ],
  influence: [
    { label: '양호', value: 0.9 },
    { label: '보통', value: 1.0 },
    { label: '불량', value: 1.1 },
  ],
};

function PeriodCalcModal({ floors, onApply, onClose, sel, setSel, extraVal, setExtraVal }) {
  const above = parseFloat(parseNumber(floors?.floorAbove)) || 0;
  const under = parseFloat(parseNumber(floors?.floorUnder)) || 0;
  const roof  = parseFloat(parseNumber(floors?.floorRoof))  || 0;

  const a = sel.foundation;
  const b = sel.soil;
  const c = sel.frame;
  const d = sel.usage;
  const e = parseFloat(extraVal) || 0;
  const f = sel.influence;

  const archM2  = parseFloat(parseNumber(floors?.buildAreaM2))  || 0;
  const grandM2 = parseFloat(floors?.totalFloorM2_auto)         || 0;
  const aboveM2 = parseFloat(parseNumber(floors?.floorAboveM2)) || 0;

  const t_foundation = parseFloat(((0.8 + 0.03 * Math.sqrt(archM2) * a + 1.3 * under) * b).toFixed(2));
  const t_frame      = parseFloat(((0.6 + 0.02 * Math.sqrt(grandM2) + 0.35 * (under + above + 0.3 * roof)) * c).toFixed(2));
  const t_finish     = parseFloat(((2.0 + 0.015 * Math.sqrt(aboveM2)) * d).toFixed(2));
  const standard     = parseFloat(((0.25 + 1.05 * (t_foundation + t_frame + t_finish) + e) * f).toFixed(1));
  const tight        = parseFloat((standard * 0.85).toFixed(1));
  const rounded      = Math.ceil(standard);

  const selStyle = (active) => ({
    padding: '5px 12px', border: '1px solid #ddd', borderRadius: '4px', cursor: 'pointer', fontSize: '12px',
    backgroundColor: active ? '#2980b9' : 'white', color: active ? 'white' : '#333',
  });

  const Section = ({ title, key2, opts }) => (
    <div style={{ marginBottom: '14px' }}>
      <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '6px', color: '#555' }}>{title}</div>
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        {opts.map(o => (
          <button key={o.label} style={selStyle(sel[key2] === o.value)}
            onClick={() => setSel({ ...sel, [key2]: o.value })}>{o.label}</button>
        ))}
      </div>
    </div>
  );

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ backgroundColor: 'white', borderRadius: '8px', padding: '24px', width: '90%', maxWidth: '620px', maxHeight: '85vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ margin: 0 }}>공사기간 계산기</h3>
          <button onClick={onClose} style={{ padding: '4px 12px', border: '1px solid #ddd', borderRadius: '4px', cursor: 'pointer' }}>✕ 닫기</button>
        </div>

        <Section title="a. 기초공법" key2="foundation" opts={PERIOD_OPTIONS.foundation} />
        <Section title="b. 토질"     key2="soil"       opts={PERIOD_OPTIONS.soil}       />
        <Section title="c. 골조"     key2="frame"      opts={PERIOD_OPTIONS.frame}      />
        <Section title="d. 건물용도" key2="usage"      opts={PERIOD_OPTIONS.usage}      />

        <div style={{ marginBottom: '14px' }}>
          <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '6px', color: '#555' }}>e. 본외공사 (개월 직접입력, 없으면 0)</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input type="number" value={extraVal}
              onChange={e => setExtraVal(e.target.value)}
              style={{ padding: '5px 10px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '13px', width: '100px', textAlign: 'right' }} />
            <span style={{ fontSize: '12px', color: '#888' }}>개월</span>
          </div>
        </div>

        <Section title="f. 공사영향" key2="influence" opts={PERIOD_OPTIONS.influence} />

        <div style={{ backgroundColor: '#f8f9fa', borderRadius: '6px', padding: '16px', marginTop: '8px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '13px' }}>
            <div>기초공사: <strong>{t_foundation}개월</strong></div>
            <div>골조공사: <strong>{t_frame}개월</strong></div>
            <div>마감공사: <strong>{t_finish}개월</strong></div>
            <div>복합계수: <strong>{(a * b * c * d * f).toFixed(3)}</strong></div>
          </div>
          <div style={{ marginTop: '12px', padding: '12px', backgroundColor: '#ebf5fb', borderRadius: '6px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <div style={{ fontSize: '14px' }}>표준공사기간: <strong style={{ color: '#1a5276' }}>{standard}개월</strong></div>
            <div style={{ fontSize: '14px' }}>압축공사기간: <strong style={{ color: '#1a5276' }}>{tight}개월</strong></div>
            <div style={{ fontSize: '15px' }}>올림(정수): <strong style={{ color: '#c0392b', fontSize: '18px' }}>{rounded}개월</strong></div>
          </div>
        </div>

        <button onClick={() => { onApply(rounded); onClose(); }}
          style={{ width: '100%', marginTop: '16px', padding: '10px', backgroundColor: '#27ae60', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' }}>
          이 값 적용하기 ({rounded}개월)
        </button>
      </div>
    </div>
  );
}

const emptyPlot = () => ({ dong: '', type: '', mainNo: '', subNo: '', areaM2: '', areaPy: '', pricePerM2: '', totalPrice: '' });

// ── 토지이용계획확인원 PDF 텍스트 파싱 ──
const parseLandPdf = async (file) => {
  const pdfjsLib = window['pdfjs-dist/build/pdf'];
  if (!pdfjsLib) return null;
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let text = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map(item => item.str).join(' ');
  }

  // 소재지 파싱
  const addrMatch = text.match(/소재지[\s\S]{1,50}?(\S+(?:동|읍|면|리)[\s\S]{1,30}?\d+(?:-\d+)?번지)/);
  if (!addrMatch) return null;
  const addr = addrMatch[1].trim();

  // 행정동 추출
  const dongMatch = addr.match(/(\S+(?:동|읍|면|리))/);
  const dong = dongMatch ? dongMatch[1] : '';

  // 구분: 산 여부
  const isSan = /\s산\s/.test(addr) || /산\d+/.test(addr);
  const type  = isSan ? '산' : '일반';

  // 지번 파싱
  const jibnumMatch = addr.match(/산?\s*(\d+)(?:-(\d+))?번지/);
  const mainNo = jibnumMatch ? jibnumMatch[1] : '';
  const subNo  = jibnumMatch && jibnumMatch[2] ? jibnumMatch[2] : '';

  // 면적 파싱
  const areaMatch = text.match(/면적\s*([\d,]+)\s*㎡/);
  const areaM2Raw = areaMatch ? areaMatch[1].replace(/,/g, '') : '';

  // 공시지가 파싱
  const priceMatch = text.match(/개별공시지가[^\d]*([\d,]+)원/);
  const priceRaw   = priceMatch ? priceMatch[1].replace(/,/g, '') : '';

  return { dong, type, mainNo, subNo, areaM2Raw, priceRaw };
};

function LandModal({ plots, setPlots, onClose }) {
  const [parsing, setParsing] = React.useState(false);
  const [parseMsg, setParseMsg] = React.useState('');

  const addRow    = () => setPlots([...plots, emptyPlot()]);
  const removeRow = (i) => setPlots(plots.filter((_, idx) => idx !== i));

  // PDF 다중 업로드 처리
  const handlePdfUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    setParsing(true);
    setParseMsg(`${files.length}개 파일 분석 중...`);

    // PDF.js 동적 로드
    if (!window['pdfjs-dist/build/pdf']) {
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
        script.onload = () => {
          window['pdfjs-dist/build/pdf'].GlobalWorkerOptions.workerSrc =
            'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
          resolve();
        };
        script.onerror = reject;
        document.head.appendChild(script);
      });
    }

    const newPlots = [];
    let successCount = 0;
    for (const file of files) {
      try {
        const parsed = await parseLandPdf(file);
        if (parsed) {
          const { dong, type, mainNo, subNo, areaM2Raw, priceRaw } = parsed;
          const areaM2Num = parseFloat(areaM2Raw) || 0;
          const priceNum  = parseFloat(priceRaw)  || 0;
          newPlots.push({
            dong,
            type,
            mainNo,
            subNo,
            areaM2:     formatNumber(areaM2Raw),
            areaPy:     m2ToPy(areaM2Raw),
            pricePerM2: formatNumber(priceRaw),
            totalPrice: (areaM2Num > 0 && priceNum > 0)
              ? formatNumber(Math.round(areaM2Num * priceNum))
              : '',
          });
          successCount++;
        } else {
          newPlots.push({ ...emptyPlot(), dong: `[파싱실패] ${file.name}` });
        }
      } catch {
        newPlots.push({ ...emptyPlot(), dong: `[오류] ${file.name}` });
      }
    }

    // 기존 비어있지 않은 행 유지 + 새 행 추가
    const existingNonEmpty = plots.filter(p => p.dong || p.mainNo || p.areaM2);
    setPlots([...existingNonEmpty, ...newPlots]);
    setParseMsg(`✅ ${successCount}/${files.length}개 필지 추가됨`);
    setParsing(false);
    e.target.value = '';
  };

  const update = (i, key, val) => {
    const next = plots.map((p, idx) => idx === i ? { ...p, [key]: val } : p);
    if (key === 'areaM2') {
      const raw = parseNumber(val);
      next[i].areaM2 = formatNumber(raw);
      next[i].areaPy = m2ToPy(raw);
      const price = parseFloat(parseNumber(next[i].pricePerM2)) || 0;
      const m2v   = parseFloat(raw) || 0;
      if (price > 0 && m2v > 0) next[i].totalPrice = formatNumber(Math.round(m2v * price));
    }
    if (key === 'pricePerM2') {
      next[i].pricePerM2 = formatNumber(parseNumber(val));
      const m2v  = parseFloat(parseNumber(next[i].areaM2)) || 0;
      const price = parseFloat(parseNumber(val)) || 0;
      if (m2v > 0 && price > 0) next[i].totalPrice = formatNumber(Math.round(m2v * price));
    }
    setPlots(next);
  };

  const totalM2  = plots.reduce((s, p) => s + (parseFloat(parseNumber(p.areaM2))    || 0), 0);
  const totalPy  = (totalM2 * 0.3025).toFixed(2);
  const totalAmt = plots.reduce((s, p) => s + (parseFloat(parseNumber(p.totalPrice)) || 0), 0);

  const th  = { padding: '6px 8px', backgroundColor: '#34495e', color: 'white', fontSize: '12px', whiteSpace: 'nowrap', textAlign: 'center' };
  const td  = { padding: '4px', borderBottom: '1px solid #eee' };
  const inp = { width: '100%', padding: '4px 6px', border: '1px solid #ddd', borderRadius: '3px', fontSize: '12px', boxSizing: 'border-box', textAlign: 'right' };
  const inpL = { ...inp, textAlign: 'left' };
  const ro   = { ...inp, backgroundColor: '#f8f9fa', color: '#555' };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ backgroundColor: 'white', borderRadius: '8px', padding: '24px', width: '95%', maxWidth: '960px', maxHeight: '85vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ margin: 0 }}>토지조서</h3>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {/* PDF 업로드 버튼 */}
            <label style={{ padding: '6px 14px', backgroundColor: '#8e44ad', color: 'white', borderRadius: '4px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
              📄 PDF 불러오기
              <input type="file" accept=".pdf" multiple onChange={handlePdfUpload} style={{ display: 'none' }} disabled={parsing} />
            </label>
            {parseMsg && (
              <span style={{ fontSize: '12px', color: parseMsg.startsWith('✅') ? '#27ae60' : '#e67e22' }}>
                {parsing ? '⏳ ' : ''}{parseMsg}
              </span>
            )}
            <button onClick={addRow}  style={{ padding: '6px 14px', backgroundColor: '#2980b9', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' }}>+ 필지 추가</button>
            <button onClick={onClose} style={{ padding: '6px 14px', backgroundColor: '#27ae60', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '13px' }}>저장 후 닫기</button>
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr>
                {['행정동','구분','본번','부번','면적(㎡)','면적(평) 자동','공시지가(㎡당)','개별공시지가금액(원)','삭제'].map(h => (
                  <th key={h} style={th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {plots.map((p, i) => (
                <tr key={i}>
                  <td style={td}><input style={inpL} value={p.dong}       onChange={e => update(i, 'dong',       e.target.value)} /></td>
                  <td style={td}><input style={inpL} value={p.type}       onChange={e => update(i, 'type',       e.target.value)} /></td>
                  <td style={td}><input style={inpL} value={p.mainNo}     onChange={e => update(i, 'mainNo',     e.target.value)} /></td>
                  <td style={td}><input style={inpL} value={p.subNo}      onChange={e => update(i, 'subNo',      e.target.value)} /></td>
                  <td style={td}><input style={inp}  value={p.areaM2}     onChange={e => update(i, 'areaM2',     e.target.value)} /></td>
                  <td style={td}><input style={ro}   value={p.areaPy}     readOnly /></td>
                  <td style={td}><input style={inp}  value={p.pricePerM2} onChange={e => update(i, 'pricePerM2', e.target.value)} /></td>
                  <td style={td}><input style={ro}   value={p.totalPrice} readOnly /></td>
                  <td style={td} align="center">
                    <button onClick={() => removeRow(i)} style={{ padding: '2px 8px', backgroundColor: '#e74c3c', color: 'white', border: 'none', borderRadius: '3px', cursor: 'pointer' }}>✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ backgroundColor: '#ecf0f1', fontWeight: 'bold' }}>
                <td colSpan={4} style={{ padding: '6px 8px', textAlign: 'center', fontSize: '12px' }}>합계</td>
                <td style={{ padding: '6px 8px', textAlign: 'right', fontSize: '12px' }}>{formatNumber(totalM2.toFixed(2))}</td>
                <td style={{ padding: '6px 8px', textAlign: 'right', fontSize: '12px' }}>{formatNumber(totalPy)}</td>
                <td></td>
                <td style={{ padding: '6px 8px', textAlign: 'right', fontSize: '12px' }}>{formatNumber(totalAmt)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

function ArchOverview({ data, onChange, onSave, saving }) {
  const [plots,       setPlots]       = useState(data.plots || [emptyPlot()]);
  const [showLand,    setShowLand]    = useState(false);
  const [showPeriod,  setShowPeriod]  = useState(false);
  const [periodSel,   setPeriodSel]   = useState({ foundation: 1.0, soil: 1.0, frame: 1.1, usage: 1.0, influence: 1.0 });
  const [periodExtra, setPeriodExtra] = useState('0');

  useEffect(() => { onChange({ ...data, plots }); }, [plots]);
  useEffect(() => { if (data.plots) setPlots(data.plots); }, [data.plots]);

  // ── 자동계산 ──
  const totalM2  = plots.reduce((s, p) => s + (parseFloat(parseNumber(p.areaM2)) || 0), 0);
  const totalPy  = totalM2 > 0 ? formatNumber((totalM2 * 0.3025).toFixed(2)) : '';
  const totalAmt = plots.reduce((s, p) => s + (parseFloat(parseNumber(p.totalPrice)) || 0), 0);

  const buildM2      = parseFloat(parseNumber(data.buildAreaM2))  || 0;
  const bcRatio      = totalM2 > 0 && buildM2 > 0 ? ((buildM2 / totalM2) * 100).toFixed(2) + '%' : '';
  const aboveM2      = parseFloat(parseNumber(data.floorAboveM2)) || 0;
  const underM2      = parseFloat(parseNumber(data.floorUnderM2)) || 0;
  const totalFloorM2 = aboveM2 + underM2;
  const totalFloorPy = totalFloorM2 > 0 ? formatNumber((totalFloorM2 * 0.3025).toFixed(2)) : '';
  const farM2        = parseFloat(parseNumber(data.farAreaM2))    || 0;
  const farRatio     = totalM2 > 0 && farM2 > 0 ? ((farM2 / totalM2) * 100).toFixed(2) + '%' : '';
  const prep         = parseFloat(parseNumber(data.prepPeriod))      || 0;
  const construct    = parseFloat(parseNumber(data.constructPeriod)) || 0;
  const settle       = parseFloat(parseNumber(data.settlePeriod))    || 0;
  const totalPeriod  = prep + construct + settle > 0 ? (prep + construct + settle) + '개월' : '';

  return (
    <div>
      {showLand && <LandModal plots={plots} setPlots={setPlots} onClose={() => setShowLand(false)} />}
      {showPeriod && (
        <PeriodCalcModal
          floors={{ ...data, totalFloorM2_auto: totalFloorM2 }}
          sel={periodSel} setSel={setPeriodSel}
          extraVal={periodExtra} setExtraVal={setPeriodExtra}
          onApply={(rounded) => onChange({ ...data, constructPeriod: String(rounded) })}
          onClose={() => setShowPeriod(false)}
        />
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 style={{ margin: 0 }}>건축개요</h3>
        <button onClick={onSave}
          style={{ padding: '6px 16px', backgroundColor: '#27ae60', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
          {saving ? '저장 중...' : 'Firestore 저장'}
        </button>
      </div>

      {sectionTitle('기본정보')}
      {textField('프로젝트명', 'projectName', data, onChange)}
      {textField('주소',       'address',     data, onChange)}
      {textField('지역지구',   'zone',        data, onChange)}

      {/* 허가구분 */}
      <div style={{ marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <label style={{ width: '170px', fontWeight: 'bold', fontSize: '13px', flexShrink: 0 }}>허가구분</label>
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
          {[
            { key: 'building_permit', label: '건축법 (건축허가)', color: '#e74c3c', desc: '주상복합·오피스텔 등' },
            { key: 'housing_plan',    label: '주택법 (사업계획승인)', color: '#27ae60', desc: '30세대 이상 아파트' },
          ].map(opt => (
            <label key={opt.key} style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
              <input type="radio" name="permitType" value={opt.key}
                checked={(data.permitType || 'building_permit') === opt.key}
                onChange={() => onChange({ ...data, permitType: opt.key })} />
              <span style={{ fontSize: '13px', fontWeight: (data.permitType||'building_permit')===opt.key ? 'bold' : 'normal',
                color: (data.permitType||'building_permit')===opt.key ? opt.color : '#555' }}>
                {opt.label}
              </span>
              <span style={{ fontSize: '11px', color: '#888' }}>({opt.desc})</span>
            </label>
          ))}
        </div>
      </div>
      {/* 허가구분 영향 안내 */}
      <div style={{ marginBottom: '14px', marginLeft: '182px', fontSize: '11px', lineHeight: '1.8',
        padding: '8px 12px', borderRadius: '4px',
        backgroundColor: (data.permitType||'building_permit') === 'housing_plan' ? '#e8f5e9' : '#fff3e0',
        color: (data.permitType||'building_permit') === 'housing_plan' ? '#2e7d32' : '#e65100',
        border: `1px solid ${(data.permitType||'building_permit') === 'housing_plan' ? '#a5d6a7' : '#ffcc80'}` }}>
        {(data.permitType||'building_permit') === 'housing_plan' ? (
          <>
            <div>✅ <strong>주택법 적용</strong> — 사업비에 미치는 영향:</div>
            <div>• 재산세: 분리과세 (0.2% 단일세율, 저율 혜택)</div>
            <div>• 종합부동산세: 과세 없음 (분리과세 대상)</div>
            <div>• 광역교통시설부담금: 전체 건축연면적 기준</div>
          </>
        ) : (
          <>
            <div>⚠ <strong>건축법 적용</strong> — 사업비에 미치는 영향:</div>
            <div>• 재산세: 별도합산 (누진세율 0.2~0.4%, 주택법 대비 높음)</div>
            <div>• 종합부동산세: 공시지가 80억 초과 시 별도합산 세율 과세</div>
            <div>• 광역교통시설부담금: 주택(공동주택) 건축연면적만 기준 (오피스텔·상가 제외)</div>
          </>
        )}
      </div>

      {sectionTitle('토지조서',
        <button onClick={() => setShowLand(true)} style={{ padding: '4px 12px', backgroundColor: 'white', color: '#2980b9', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', fontSize: '12px' }}>
          입력창 열기 ({plots.length}필지 / {formatNumber(totalM2.toFixed(2))}㎡ / {formatNumber(totalAmt)}원)
        </button>
      )}

      {sectionTitle('건축규모')}
      {numField('지하층수', 'floorUnder', data, onChange)}
      {numField('지상층수', 'floorAbove', data, onChange)}
      {numField('옥탑층수', 'floorRoof',  data, onChange)}
      {numField('동수',     'buildings',  data, onChange)}

      {sectionTitle('면적')}
      {resultField('대지면적(㎡)', formatNumber(totalM2.toFixed(2)))}
      {resultField('대지면적(평)', totalPy)}
      {areaField('건축면적(㎡)', 'buildAreaM2', '건축면적(평)', 'buildAreaPy', data, onChange)}
      {resultField('건폐율(%)', bcRatio)}
      {areaField('지상연면적(㎡)', 'floorAboveM2', '지상연면적(평)', 'floorAbovePy', data, onChange)}
      {areaField('지하연면적(㎡)', 'floorUnderM2', '지하연면적(평)', 'floorUnderPy', data, onChange)}
      {resultField('전체연면적(㎡)', formatNumber(totalFloorM2.toFixed(2)))}
      {resultField('전체연면적(평)', totalFloorPy)}
      {areaField('용적률산정면적(㎡)', 'farAreaM2', '용적률산정면적(평)', 'farAreaPy', data, onChange)}
      {resultField('용적률(%)', farRatio)}

      {sectionTitle('사업기간')}
      {numField('사업준비기간(개월)', 'prepPeriod',      data, onChange)}
      <div style={{ marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <label style={{ width: '170px', fontWeight: 'bold', fontSize: '13px', flexShrink: 0 }}>공사기간(개월)</label>
        <input value={data.constructPeriod || ''} readOnly
          style={{ flex: 1, padding: '6px 10px', border: '1px solid #bee3f8', borderRadius: '4px', fontSize: '13px', textAlign: 'right', backgroundColor: '#ebf5fb', color: '#1a5276', fontWeight: 'bold' }} />
        <button onClick={() => setShowPeriod(true)}
          style={{ padding: '6px 14px', backgroundColor: '#2980b9', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', whiteSpace: 'nowrap' }}>
          계산기 열기
        </button>
      </div>
      {numField('사업정산기간(개월)', 'settlePeriod', data, onChange)}
      {resultField('전체사업기간', totalPeriod)}

      {sectionTitle('착공년월')}
      <div style={{ marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <label style={{ width: '170px', fontWeight: 'bold', fontSize: '13px', flexShrink: 0 }}>착공 예정년월</label>
        <input
          value={data.constructYear || ''}
          onChange={e => onChange({ ...data, constructYear: e.target.value })}
          placeholder="2027"
          style={{ width: '80px', padding: '6px 10px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '13px', textAlign: 'right' }}
        />
        <span style={{ fontSize: '13px' }}>년</span>
        <select
          value={data.constructMonth || '1'}
          onChange={e => onChange({ ...data, constructMonth: e.target.value })}
          style={{ width: '70px', padding: '6px 8px', border: '1px solid #ddd', borderRadius: '4px', fontSize: '13px' }}>
          {Array.from({length: 12}, (_, i) => i + 1).map(m => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
        <span style={{ fontSize: '13px' }}>월</span>
      </div>
    </div>
  );
}

export default ArchOverview;