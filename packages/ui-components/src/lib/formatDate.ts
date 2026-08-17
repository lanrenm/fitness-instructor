function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

function timeOf(d: Date): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * @description 把日期格式化为 dashboard 风格的相对时间
 *  - 今天 → "今天 HH:mm"
 *  - 昨天 → "昨天 HH:mm"
 *  - 同年更早 → "M月D日"（无时间）
 *  - 跨年 → "YYYY-MM-DD"
 */
export function formatRelativeDate(input: string | Date): string {
  const d = typeof input === 'string' ? new Date(input) : input;
  if (isNaN(d.getTime())) return '';
  const now = new Date();
  if (isSameDay(d, now)) return `今天 ${timeOf(d)}`;
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (isSameDay(d, yesterday)) return `昨天 ${timeOf(d)}`;
  if (d.getFullYear() !== now.getFullYear()) {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}