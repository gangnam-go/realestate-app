import React from 'react';

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
  const [view, setView] = React.useState('saleRate');

  return (
    <div>
      {/* 상단 버튼 */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <button
          onClick={() => setView('saleRate')}
          style={{
            padding: '8px 16px',
            backgroundColor: view === 'saleRate' ? '#2c3e50' : '#ecf0f1',
            color: view === 'saleRate' ? 'white' : '#2c3e50',
            border: 'none', borderRadius: '6px', cursor: 'pointer',
            fontWeight: view === 'saleRate' ? 'bold' : 'normal',
            fontSize: '13px',
          }}
        >
          📊 분양률 민감도
        </button>
        <button
          onClick={() => setView('sensitivity')}
          disabled
          style={{
            padding: '8px 16px',
            backgroundColor: '#ecf0f1',
            color: '#aaa',
            border: 'none', borderRadius: '6px', cursor: 'not-allowed',
            fontSize: '13px',
          }}
        >
          📈 민감도 분석 (준비 중)
        </button>
      </div>

      {/* 컨텐츠 */}
      {view === 'saleRate' && (
        <div style={{ padding: '40px', textAlign: 'center', color: '#888' }}>
          <div style={{ fontSize: '14px' }}>분양률 민감도 분석 구현 예정</div>
          <div style={{ fontSize: '12px', marginTop: '8px' }}>
            프로젝트: {projectName}
          </div>
        </div>
      )}
    </div>
  );
}
