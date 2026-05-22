/**
 * @description HomePage - 首页，展示欢迎信息
 */
export default function HomePage() {
  return (
    <div className="min-h-screen bg-white">
      <header className="p-6">
        <h1 className="text-2xl font-bold text-[#2D3748]">健身教练</h1>
      </header>
      <main className="p-6">
        <div className="bg-[#F7FAFC] rounded-3xl p-8">
          <h2 className="text-xl font-semibold text-[#2D3748] mb-4">欢迎使用健身教练</h2>
          <p className="text-[#718096]">您的个人健身助手</p>
        </div>
      </main>
    </div>
  );
}