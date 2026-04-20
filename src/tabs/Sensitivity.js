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
  // 🔍 진단용 로그 (확인 후 삭제)
  console.log('=== Sensitivity 데이터 구조 ===');
  console.log('projectName:', projectName);
  console.log('archData keys:',     archData     ? Object.keys(archData)     : 'null');
  console.log('incomeData keys:',   incomeData   ? Object.keys(incomeData)   : 'null');
  console.log('salesData keys:',    salesData    ? Object.keys(salesData)    : 'null');
  console.log('costData keys:',     costData     ? Object.keys(costData)     : 'null');
  console.log('financeData keys:',  financeData  ? Object.keys(financeData)  : 'null');
  console.log('monthlyPayments:',   monthlyPayments);
  console.log('cashFlowResult:',    cashFlowResult);
  console.log('--- financeData 상세 ---');
  console.log('financeData.ltvCalc:',       financeData?.ltvCalc);
  console.log('financeData.eqMonthly:',     financeData?.eqMonthly);
  console.log('--- incomeData 상세 ---');
  console.log('incomeData.salesAmt:',       incomeData?.salesAmt);
  console.log('incomeData.salesSumRes:',    incomeData?.salesSumRes);
  console.log('incomeData.salesSumBal:',    incomeData?.salesSumBal);
  console.log('incomeData.salesSumOffi:',   incomeData?.salesSumOffi);
  console.log('incomeData.salesSumStore:',  incomeData?.salesSumStore);
  // 🔍 2차 진단 — 구체적인 값들
  console.log('=== 2차 진단 ===');

  console.log('--- 분양금액 (salesData의 salesSum들) ---');
  console.log('salesSumApt:',     salesData?.salesSumApt);
  console.log('salesSumBal:',     salesData?.salesSumBal);
  console.log('salesSumOffi:',    salesData?.salesSumOffi);
  console.log('salesSumStore:',   salesData?.salesSumStore);
  console.log('salesSumPublic:',  salesData?.salesSumPublic);
  console.log('salesSumPubfac:',  salesData?.salesSumPubfac);
  console.log('salesSumPublicBal:', salesData?.salesSumPublicBal);

  // 트랜치는 JSON으로 풀어서
  console.log('--- PF 금액 (tranches) ---');
  console.log(JSON.stringify(financeData?.ltvCalc?.tranches, null, 2));

  // repayCondition 풀어서
  console.log('--- repayCondition ---');
  console.log(JSON.stringify(financeData?.repayCondition, null, 2));

  // cashFlowResult 키들과 첫번째 값들
  console.log('--- cashFlowResult 키들 ---');
  if (cashFlowResult) {
    Object.keys(cashFlowResult).forEach(k => {
      const v = cashFlowResult[k];
      if (Array.isArray(v)) {
        console.log(`${k}: Array(${v.length})`, v[0]); // 첫번째 요소만
      } else {
        console.log(`${k}:`, v);
      }
    });
  }

  // cashFlowResult.result의 마지막 행 (사업종료월)
  console.log('--- cashFlowResult.result 마지막 ---');
  if (cashFlowResult?.result?.length > 0) {
    console.log('last row keys:', Object.keys(cashFlowResult.result[cashFlowResult.result.length-1]));
    console.log('last row:', JSON.stringify(cashFlowResult.result[cashFlowResult.result.length-1], null, 2));
  }

  // costData.land 풀어서
  console.log('--- costData.land ---');
  console.log(JSON.stringify(costData?.land, null, 2));

  // costData.paymentSchedule 키들
  console.log('--- costData.paymentSchedule 키들 ---');
  console.log('keys:', costData?.paymentSchedule ? Object.keys(costData.paymentSchedule) : 'null');

  // monthlyPayments 키들
  console.log('--- monthlyPayments 키들 ---');
  if (monthlyPayments) {
    Object.keys(monthlyPayments).forEach(k => {
      const v = monthlyPayments[k];
      if (Array.isArray(v)) {
        console.log(`${k}: Array(${v.length})`, v.length > 0 ? `[0]=${v[0]}, [${v.length-1}]=${v[v.length-1]}` : '');
      } else if (typeof v === 'object' && v !== null) {
        console.log(`${k}: Object keys=`, Object.keys(v));
      } else {
        console.log(`${k}:`, v);
      }
    });
  }
  
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
