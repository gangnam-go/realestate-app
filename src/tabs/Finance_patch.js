// ============================================================
// Finance.js 수정 위치: CashFlowCalc 함수 내
// ============================================================
//
// 찾을 코드 (operByMonth 초기화 블록 끝부분):
//
//   allocRows.forEach(r => {
//     const i = ymToIdx[r.ym];
//     if (i !== undefined) {
//       operByMonth[i]      += r.totalOper;
//       saveByMonth[i]      += r.totalSave;
//       operDepByMonth[i]   += r.resDepOper;
//       operMidByMonth[i]   += r.resMidOper;
//       operBalByMonth[i]   += r.resBalOper;
//       operStoreByMonth[i] += r.storeOper;
//     }
//   });
//
// 이 블록 바로 다음에 아래 코드를 추가:
//
//   // ── 기부체납 운영비 (공공주택 + 공공발코니 + 공공시설) ──
//   // salesData.allocPublic에서 배분비율 읽기 (없으면 기본 100% 운영비)
//   const allocPublic = salesData?.allocPublic || { dep: 100, mid: 100, bal: 100 };
//   const pubOperPctDep = (100 - (allocPublic.dep ?? 100)) / 100; // 운영비율
//   const pubOperPctMid = (100 - (allocPublic.mid ?? 100)) / 100;
//   const pubOperPctBal = (100 - (allocPublic.bal ?? 100)) / 100;
//
//   ymList.forEach((ym, idx) => {
//     const i = ymToIdx[ym];
//     if (i === undefined) return;
//     // 공공주택 (면세)
//     const pubDep = (salesData?.publicDepMonthly?.[idx] || 0);
//     const pubMid = (salesData?.publicMidMonthly?.[idx] || 0);
//     const pubBal = (salesData?.publicBalMonthly?.[idx] || 0);
//     // 공공발코니 (면세)
//     const pubBalDep = (salesData?.publicBalDepMonthly?.[idx] || 0);
//     const pubBalMid = (salesData?.publicBalMidMonthly?.[idx] || 0);
//     const pubBalBal = (salesData?.publicBalBalMonthly?.[idx] || 0);
//     // 공공시설 (VAT 10% 포함)
//     const pubfacDep = (salesData?.pubfacDepMonthlyVat?.[idx] || (salesData?.pubfacDepMonthly?.[idx] || 0) * 1.1);
//     const pubfacMid = (salesData?.pubfacMidMonthlyVat?.[idx] || (salesData?.pubfacMidMonthly?.[idx] || 0) * 1.1);
//     const pubfacBal = (salesData?.pubfacBalMonthlyVat?.[idx] || (salesData?.pubfacBalMonthly?.[idx] || 0) * 1.1);
//
//     const totalPubDep = pubDep + pubBalDep + pubfacDep;
//     const totalPubMid = pubMid + pubBalMid + pubfacMid;
//     const totalPubBal = pubBal + pubBalBal + pubfacBal;
//
//     const pubOperDep = Math.round(totalPubDep * pubOperPctDep);
//     const pubOperMid = Math.round(totalPubMid * pubOperPctMid);
//     const pubOperBal = Math.round(totalPubBal * pubOperPctBal);
//     const pubSaveDep = Math.round(totalPubDep * (allocPublic.dep ?? 100) / 100);
//     const pubSaveMid = Math.round(totalPubMid * (allocPublic.mid ?? 100) / 100);
//     const pubSaveBal = Math.round(totalPubBal * (allocPublic.bal ?? 100) / 100);
//
//     operByMonth[i] += pubOperDep + pubOperMid + pubOperBal;
//     saveByMonth[i] += pubSaveDep + pubSaveMid + pubSaveBal;
//   });
//
// ============================================================
// 그리고 분양수입 소계 검증용 salesTotal_ 계산도 수정:
// ============================================================
//
// 찾을 코드:
//   const salesTotal_  = (salesData?.ymList||[]).reduce((s,_,i)=>{
//     ...
//     const store = hasVat?...
//     return s+dep+mid+bal+store;
//   },0);
//
// return 줄을:
//     return s+dep+mid+bal+store;
// 에서:
//     // 기부체납 포함
//     const pubTotal = (salesData?.publicDepMonthly?.[i]||0)+(salesData?.publicMidMonthly?.[i]||0)+(salesData?.publicBalMonthly?.[i]||0)
//       +(salesData?.publicBalDepMonthly?.[i]||0)+(salesData?.publicBalMidMonthly?.[i]||0)+(salesData?.publicBalBalMonthly?.[i]||0)
//       +(salesData?.pubfacDepMonthlyVat?.[i]||(salesData?.pubfacDepMonthly?.[i]||0)*1.1)
//       +(salesData?.pubfacMidMonthlyVat?.[i]||(salesData?.pubfacMidMonthly?.[i]||0)*1.1)
//       +(salesData?.pubfacBalMonthlyVat?.[i]||(salesData?.pubfacBalMonthly?.[i]||0)*1.1);
//     return s+dep+mid+bal+store+pubTotal;
// 로 변경
// ============================================================
