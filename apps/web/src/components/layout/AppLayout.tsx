/**
 * @description 应用主布局壳层。step 1 先放 Outlet 让路由系统跑通，
 * step 2 + 3 把 TopBar + LeftBar 拼进来。
 */
import { Outlet } from 'react-router-dom';

export default function AppLayout() {
  return (
    <div className="min-h-screen bg-[#F7FAFC]">
      {/* TODO(step 2): TopBar 浮岛 */}
      {/* TODO(step 3): LeftBar 浮岛 */}
      <main className="p-6">
        <Outlet />
      </main>
    </div>
  );
}
