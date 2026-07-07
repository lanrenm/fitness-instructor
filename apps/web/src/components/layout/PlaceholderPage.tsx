/**
 * @description 占位页组件 — 在子路由还没接具体业务时用于占位渲染
 */
interface IPlaceholderPageProps {
  title: string;
  description?: string;
}

export default function PlaceholderPage({ title, description }: IPlaceholderPageProps) {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-2 p-8">
      <h1 className="text-2xl font-bold text-[#2D3748]">{title}</h1>
      {description && <p className="text-[#718096] text-center max-w-md">{description}</p>}
      <span className="mt-4 px-3 py-1 rounded-full bg-orange-50 text-[#FF6B35] text-xs font-medium">
        TODO · 等待具体业务接入
      </span>
    </div>
  );
}
