import React, { useState, useEffect } from 'react';
import './App.css';
import { db } from './firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import ProjectList from './ProjectList';
import ArchOverview from './tabs/ArchOverview';
import Income from './tabs/Income';
import Sales from './tabs/Sales';
import ProjectCost, { SettingsModal } from './tabs/ProjectCost';
import VATCalculation from './tabs/VATCalculation';
import Finance from './tabs/Finance';
import Report from './tabs/Report';

function App() {
  const [project,     setProject]     = useState(null);
  const [activeTab,   setActiveTab]   = useState('건축개요');
  const [projectData, setProjectData] = useState({});
  const [loading,     setLoading]     = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [costResults,      setCostResults]      = useState({});
  const [cashFlowResult,   setCashFlowResult]   = useState(null);
  const [settingsData,     setSettingsData]     = useState({});

  const tabs = ['건축개요', '수입', '분양율', '사업비', '금융', '보고서', '부가세안분'];

  // ── 기준정보 로드 ──
  const loadSettings = async () => {
    try {
      const moefSnap = await getDoc(doc(db, 'settings', 'moefStdCost'));
      const moefCosts = moefSnap.exists() ? (moefSnap.data().items || []) : [
        { year: '2026', usage: '주거용(아파트 등)',  cost: '860000' },
        { year: '2026', usage: '상업용(상가 등)',    cost: '860000' },
        { year: '2026', usage: '공업용(공장 등)',    cost: '840000' },
        { year: '2026', usage: '문화복지/교육',      cost: '860000' },
        { year: '2026', usage: '공공용',             cost: '850000' },
        { year: '2026', usage: '공공건설임대주택 표준건축비(21층이상,60㎡초과)', cost: '1138400' },
      ];
      setSettingsData(prev => ({ ...prev, moefCosts }));
    } catch(e) { console.error('settings load error:', e); }
  };

  useEffect(() => {
    loadSettings();
    const handler = () => loadSettings();
    window.addEventListener('settings-saved', handler);
    return () => window.removeEventListener('settings-saved', handler);
  }, []);

  // ── 프로젝트 전체 데이터 로드 ──
  const loadAll = async (proj) => {
    setLoading(true);
    const sheets = ['건축개요', '수입', '분양율', '사업비', '금융', '부가세안분'];
    const result = {};
    for (const sheet of sheets) {
      const snap = await getDoc(doc(db, 'projects', proj.id, 'sheets', sheet));
      if (snap.exists()) result[sheet] = snap.data();
      else result[sheet] = {};
    }
    setProjectData(result);
    setLoading(false);
  };

  useEffect(() => {
    if (project) loadAll(project);
  }, [project]);

  // ── 금융탭 금융비 세부항목으로 이동 이벤트 ──
  useEffect(() => {
    const handler = () => {
      setActiveTab('금융');
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('open-finance-cost-section'));
      }, 100);
    };
    window.addEventListener('navigate-to-finance-cost', handler);
    return () => window.removeEventListener('navigate-to-finance-cost', handler);
  }, []);

  // ── 탭 데이터 업데이트 ──
  const updateSheet = (sheetName, data) => {
    setProjectData(prev => ({ ...prev, [sheetName]: data }));
  };

  // ── 버전 식별자 계산 ──
  const getVersionLabel = () => {
    const arch      = projectData['건축개요'] || {};
    const projName  = (arch.projectName || '').trim();
    const address   = (arch.address     || '').trim();
    const submitTo  = (arch.submitTo    || '').trim();
    const version   = submitTo || '원본';
    const parts     = [projName, address, version].filter(Boolean);
    return parts.length > 0 ? parts.join('_') : '(프로젝트명/주소 미입력)';
  };

  // ── 저장 전 버전 확인 다이얼로그 ──
  const confirmSave = () => {
    const label    = getVersionLabel();
    const submitTo = (projectData['건축개요']?.submitTo || '').trim();
    const isOrigin = !submitTo;
    const warning  = isOrigin
      ? `⚠ 원본에 저장합니다.\n\n"${label}"\n\n계속하시겠습니까?`
      : `💾 저장 확인\n\n"${label}"\n\n이 버전에 저장합니다. 계속하시겠습니까?`;
    return window.confirm(warning);
  };

  // ── Firestore 저장 (탭별) ──
  const saveSheet = async (sheetName) => {
    if (!confirmSave()) return;
    setSaving(true);
    await setDoc(doc(db, 'projects', project.id, 'sheets', sheetName), projectData[sheetName] || {});
    setSaving(false);
  };

  // ── 전체 저장 ──
  const saveAll = async () => {
    if (!confirmSave()) return;
    setSaving(true);
    const sheets = Object.keys(projectData);
    for (const sheet of sheets) {
      await setDoc(doc(db, 'projects', project.id, 'sheets', sheet), projectData[sheet] || {});
    }
    setSaving(false);
  };

  // ── 분양율 데이터 즉시 Firestore 저장 (보고서탭 alloc 변경 시) ──
  const handleSalesChange = async (data) => {
    const merged = { ...projectData['분양율'], ...data };
    updateSheet('분양율', merged);
    if (project) {
      await setDoc(doc(db, 'projects', project.id, 'sheets', '분양율'), merged);
    }
  };

  if (!project) {
    return <ProjectList onSelect={setProject} />;
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: '16px' }}>
        <div style={{ fontSize: '16px', color: '#555' }}>프로젝트 데이터 불러오는 중...</div>
        <div style={{ fontSize: '13px', color: '#aaa' }}>{project.name}</div>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: 'Arial, sans-serif', padding: '20px' }}>
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} constructPeriod={projectData['건축개요']?.constructPeriod} />}
      {/* 상단 헤더 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h2 style={{ color: '#2c3e50', margin: 0 }}>{project.name}</h2>
            {(() => {
              const submitTo = (projectData['건축개요']?.submitTo || '').trim();
              const isOrigin = !submitTo;
              return (
                <span style={{
                  fontSize: '13px', fontWeight: 'bold',
                  color: isOrigin ? '#27ae60' : '#c0392b',
                  backgroundColor: isOrigin ? '#eafaf1' : '#fdedec',
                  padding: '3px 10px', borderRadius: '12px',
                  border: `1px solid ${isOrigin ? '#a9dfbf' : '#f5b7b1'}`,
                }}>
                  {isOrigin ? '📁 원본' : `📤 ${submitTo}`}
                </span>
              );
            })()}
          </div>
          <span style={{ fontSize: '12px', color: '#aaa', marginTop: '2px', display: 'block' }}>
            {getVersionLabel()}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {saving && <span style={{ fontSize: '12px', color: '#27ae60' }}>저장 중...</span>}
          <button onClick={() => setShowSettings(true)}
            style={{ padding: '7px 14px', backgroundColor: '#8e44ad', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }}>
            ⚙ 기준정보
          </button>
          <button onClick={saveAll}
            style={{ padding: '7px 16px', backgroundColor: '#27ae60', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }}>
            전체 저장
          </button>
          <button onClick={() => setProject(null)}
            style={{ padding: '7px 16px', backgroundColor: '#95a5a6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}>
            ← 목록으로
          </button>
        </div>
      </div>

      {/* 탭 버튼 */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {tabs.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            style={{
              padding: '8px 16px',
              backgroundColor: activeTab === tab ? '#2980b9' : '#ecf0f1',
              color: activeTab === tab ? 'white' : '#2c3e50',
              border: 'none', borderRadius: '6px', cursor: 'pointer',
              fontWeight: activeTab === tab ? 'bold' : 'normal',
            }}>
            {tab}
          </button>
        ))}
      </div>

      {/* 탭 내용 */}
      <div style={{ border: '1px solid #ddd', borderRadius: '8px', padding: '20px' }}>
        {activeTab === '건축개요' && (
          <ArchOverview
            projectId={project.id}
            data={projectData['건축개요'] || {}}
            onChange={data => updateSheet('건축개요', data)}
            onSave={() => saveSheet('건축개요')}
            saving={saving}
          />
        )}
        {activeTab === '수입' && (
          <Income
            projectId={project.id}
            data={projectData['수입'] || {}}
            onChange={data => updateSheet('수입', data)}
            onSave={() => saveSheet('수입')}
            saving={saving}
            settingsData={settingsData}
          />
        )}
        {/* 분양율 — 항상 렌더링 */}
        <div style={{ display: activeTab === '분양율' ? 'block' : 'none' }}>
          <Sales
            projectId={project.id}
            data={projectData['분양율'] || {}}
            incomeData={projectData['수입'] || {}}
            archData={projectData['건축개요'] || {}}
            onChange={async (data) => {
              const cur = projectData['분양율'] || {};
              const merged = {
                ...data,
                allocPublic:   data?.allocPublic   ?? cur.allocPublic   ?? { dep: 0, mid: 0, bal: 0 },
                allocOver:     data?.allocOver     ?? cur.allocOver     ?? { res: { dep: 30, mid: 30, bal: 100 }, store: { all: 40 } },
                allocUnder:    data?.allocUnder    ?? cur.allocUnder    ?? { res: { dep: 10, mid: 10, bal: 100 }, store: { all: 40 } },
                allocBaseRate: data?.allocBaseRate ?? cur.allocBaseRate ?? 60,
                allocScenario: data?.allocScenario ?? cur.allocScenario ?? 'over',
                publicConfig:  data?.publicConfig  ?? cur.publicConfig  ?? {},
                pubfacConfig:  data?.pubfacConfig  ?? cur.pubfacConfig  ?? {},
              };
              updateSheet('분양율', merged);
              if (project) {
                await setDoc(doc(db, 'projects', project.id, 'sheets', '분양율'), merged);
              }
            }}
            onSave={() => saveSheet('분양율')}
            saving={activeTab === '분양율' ? saving : false}
            onSalesChange={handleSalesChange}  
          />
        </div>
        {/* 사업비 — 항상 렌더링 */}
        <div style={{ display: activeTab === '사업비' ? 'block' : 'none' }}>
          <ProjectCost
            projectId={project.id}
            data={projectData['사업비'] || {}}
            onChange={data => updateSheet('사업비', data)}
            onSave={() => saveSheet('사업비')}
            saving={activeTab === '사업비' ? saving : false}
            archData={projectData['건축개요'] || {}}
            incomeData={projectData['수입'] || {}}
            salesData={projectData['분양율'] || {}}
            vatData={projectData['부가세안분'] || {}}
            financeData={projectData['금융'] || {}}
            onFinanceChange={async (data) => {
              updateSheet('금융', data);
              setSaving(true);
              await setDoc(doc(db, 'projects', project.id, 'sheets', '금융'), data || {});
              setSaving(false);
            }}
            onResultChange={setCostResults}
            cashFlowResult={cashFlowResult}
          />
        </div>
        {/* Finance 백그라운드 렌더링 */}
        <div style={{ display: activeTab === '금융' ? 'block' : 'none' }}>
          <Finance
            projectName={project.name}
            salesData={projectData['분양율'] || {}}
            incomeData={projectData['수입'] || {}}
            financeData={projectData['금융'] || {}}
            vatData={projectData['부가세안분'] || {}}
            onFinanceChange={async (data) => {
              updateSheet('금융', data);
              setSaving(true);
              await setDoc(doc(db, 'projects', project.id, 'sheets', '금융'), data || {});
              setSaving(false);
            }}
            onCashFlowResult={setCashFlowResult}
            cashFlowResult={cashFlowResult}
            {...costResults}
          />
        </div>
        {activeTab === '보고서' && (
          <Report
            projectName={project.name}
            salesData={projectData['분양율'] || {}}
            incomeData={projectData['수입'] || {}}
            monthlyPayments={costResults?.monthlyPayments}
            financeData={projectData['금융'] || {}}
            cashFlowResult={cashFlowResult}
            onSalesChange={handleSalesChange}
          />
        )}
        {activeTab === '부가세안분' && (
          <VATCalculation
            data={projectData['부가세안분'] || {}}
            onChange={data => updateSheet('부가세안분', data)}
            archData={projectData['건축개요'] || {}}
            incomeData={projectData['수입'] || {}}
          />
        )}
      </div>
    </div>
  );
}

export default App;
