/**
 * @description 应用主布局壳层。TopBar + (后续会加) LeftBar + Outlet 内容区。
 */
import { Outlet } from 'react-router-dom';
import TopBar from './TopBar';

export default function AppLayout() {
  return (
    <div className="min-h-screen bg-[#F7FAFC]">
      <TopBar />
      <main className="px-6 pb-6">
        <Outlet />
      </main>
    </div>
  );
}
