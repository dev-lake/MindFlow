import { useEffect } from 'react';
import { ReactFlowProvider } from 'reactflow';
import { FlowCanvas } from './components/FlowCanvas';
import { Sidebar } from './components/Sidebar';
import { SessionSidebar } from './components/SessionSidebar';
import { useChatStore } from './stores/chatStore';
import { useSettingsStore } from './stores/settingsStore';

function App() {
  const { currentSession, initSession } = useChatStore();
  const { isSettingsOpen, loadModelConfigs } = useSettingsStore();

  useEffect(() => {
    initSession();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadModelConfigs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="w-full h-full flex bg-gray-50">
      {/* 左侧会话管理栏 */}
      <SessionSidebar />

      {/* 主内容区 */}
      <div className="flex-1 flex flex-col">
        {/* 主内容：画布或设置页面 */}
        <main className="flex-1 overflow-hidden">
          {isSettingsOpen ? (
            <Sidebar />
          ) : (
            <ReactFlowProvider>
              <FlowCanvas />
            </ReactFlowProvider>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
