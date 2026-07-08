/**
 * @description 应用主布局壳层。TopBar（顶部浮岛）+ LeftBar（左侧浮岛）+ Outlet 内容区。
 */
import { Outlet } from 'react-router-dom';
import TopBar from './TopBar';
import LeftBar from './LeftBar';

export default function AppLayout() {
  return (
    <div className="min-h-screen bg-[#F7FAFC]">
      <TopBar />
      <div className="flex gap-6 px-6 pb-6 pt-4">
        <LeftBar />
        <main className="flex-1 min-w-0">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
