// 숫자 문자열에 천단위 콤마
export const formatNumber = (val) => {
  const clean = String(val).replace(/,/g, '');
  if (clean === '' || isNaN(clean)) return val;
  const parts = clean.split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return parts.join('.');
};

// 콤마 제거 후 순수 숫자
export const parseNumber = (val) => {
  return String(val).replace(/,/g, '');
};

// ㎡ → 평 변환
export const m2ToPy = (m2Val) => {
  const n = parseFloat(String(m2Val).replace(/,/g, ''));
  if (isNaN(n) || n === 0) return '';
  return formatNumber((n * 0.3025).toFixed(2));
};

// 월별 균등배분 (마지막 달에 잔여분 보정)
export const distributeEvenly = (total, months) => {
  if (months <= 0) return [];
  const unit = Math.round(total / months);
  const arr  = Array(months).fill(unit);
  // 마지막 달 보정
  const sumExceptLast = unit * (months - 1);
  arr[months - 1] = Math.round(total - sumExceptLast);
  return arr;
};