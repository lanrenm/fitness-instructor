export const CATEGORY_MAP = {
  1: '胸部',
  2: '背部',
  3: '腿部',
  4: '肩部',
  5: '手臂',
  6: '核心',
} as const;

export const DIFFICULTY_MAP = {
  1: { label: '初级', badgeClass: 'bg-[#E3F4EC] text-[#35B87A]' },
  2: { label: '中级', badgeClass: 'bg-[#E5F0FF] text-[#3B91F5]' },
  3: { label: '高级', badgeClass: 'bg-[#FFE7EC] text-[#FF5A67]' },
} as const;

export const CATEGORY_OPTIONS = Object.entries(CATEGORY_MAP).map(
  ([value, label]) => ({ value: Number(value), label }),
);

export const DIFFICULTY_OPTIONS = Object.entries(DIFFICULTY_MAP).map(
  ([value, { label }]) => ({ value: Number(value), label }),
);
