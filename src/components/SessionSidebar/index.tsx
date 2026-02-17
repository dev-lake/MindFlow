import { useState } from 'react';
import { Plus, MessageSquare, Trash2, Edit2, Check, X, ChevronLeft, ChevronRight, Settings } from 'lucide-react';
import { useChatStore } from '../../stores/chatStore';
import { useSettingsStore } from '../../stores/settingsStore';

export function SessionSidebar() {
  const { sessions, currentSessionId, createSession, switchSession, deleteSession, updateSessionTitle } = useChatStore();
  const { openSettings, closeSettings } = useSettingsStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [hoveredSessionId, setHoveredSessionId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const sessionList = Object.values(sessions).sort((a, b) => b.updatedAt - a.updatedAt);

  const handleStartEdit = (sessionId: string, currentTitle: string) => {
    setEditingId(sessionId);
    setEditTitle(currentTitle);
  };

  const handleSaveEdit = (sessionId: string) => {
    if (editTitle.trim()) {
      updateSessionTitle(sessionId, editTitle.trim());
    }
    setEditingId(null);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditTitle('');
  };

  const handleDelete = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('确定要删除这个会话吗？')) {
      deleteSession(sessionId);
    }
  };

  const handleCreateSession = async () => {
    if (isCreating) return;

    setIsCreating(true);
    try {
      await createSession();
      closeSettings();
    } finally {
      setIsCreating(false);
    }
  };

  const handleSwitchSession = (sessionId: string) => {
    switchSession(sessionId);
    // 关闭设置页面
    closeSettings();
  };

  return (
    <div className={`bg-white border-r border-gray-200 text-gray-800 flex flex-col h-full transition-all duration-300 ${isCollapsed ? 'w-12' : 'w-64'}`}>
      {isCollapsed ? (
        /* 收起状态 */
        <div className="flex flex-col items-center h-full">
          <div className="p-3 border-b border-gray-200">
            <img src="/logo.svg" alt="MindFlow" className="w-8 h-8" />
          </div>
          <div className="flex-1 flex flex-col items-center gap-3 py-4">
            <button
              onClick={handleCreateSession}
              disabled={isCreating}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="新建会话"
            >
              <Plus size={20} />
            </button>
            {sessionList.map((session) => {
              const isActive = session.id === currentSessionId;
              const isHovered = hoveredSessionId === session.id;
              return (
                <div key={session.id} className="relative">
                  <button
                    onClick={() => handleSwitchSession(session.id)}
                    onMouseEnter={() => setHoveredSessionId(session.id)}
                    onMouseLeave={() => setHoveredSessionId(null)}
                    className={`p-2 rounded-lg transition-colors ${isActive ? 'bg-blue-50 text-blue-600' : 'hover:bg-gray-100'
                      }`}
                  >
                    <MessageSquare size={18} />
                  </button>
                  {isHovered && (
                    <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-3 py-2 bg-gray-900 text-white text-sm rounded-lg shadow-lg whitespace-nowrap z-50 pointer-events-none">
                      {session.title}
                      <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-gray-900"></div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <button
            onClick={() => setIsCollapsed(false)}
            className="p-3 border-t border-gray-200 hover:bg-gray-100 transition-colors w-full"
            title="展开侧边栏"
          >
            <ChevronRight size={20} className="mx-auto" />
          </button>
          <button
            onClick={openSettings}
            className="p-3 border-t border-gray-200 hover:bg-gray-100 transition-colors w-full"
            title="设置"
          >
            <Settings size={20} className="mx-auto" />
          </button>
        </div>
      ) : (
        /* 展开状态 */
        <>
          {/* 标题区域 */}
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <img src="/logo.svg" alt="MindFlow" className="w-8 h-8" />
              <div className="flex-1">
                <h1 className="text-lg font-bold">MindFlow</h1>
                <p className="text-xs text-gray-500">Follow Your Mind</p>
              </div>
            </div>
          </div>

          {/* 新建会话按钮 */}
          <div className="p-3 border-b border-gray-200">
            <button
              onClick={handleCreateSession}
              disabled={isCreating}
              className="w-full flex items-center gap-2 px-4 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus size={18} />
              {isCreating ? '创建中...' : '新建会话'}
            </button>
          </div>

          {/* 会话列表 */}
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {sessionList.length === 0 ? (
              <div className="p-4 text-center text-gray-400 text-sm">
                暂无会话
              </div>
            ) : (
              <div className="p-2 space-y-1">
                {sessionList.map((session) => {
                  const isActive = session.id === currentSessionId;
                  const isEditing = editingId === session.id;

                  return (
                    <div
                      key={session.id}
                      onClick={() => !isEditing && handleSwitchSession(session.id)}
                      className={`
                        group relative px-3 py-2.5 rounded-lg cursor-pointer transition-colors
                        ${isActive ? 'bg-blue-50' : 'hover:bg-gray-50'}
                      `}
                    >
                      <div className="flex items-start gap-2">
                        <MessageSquare size={16} className={`mt-0.5 flex-shrink-0 ${isActive ? 'text-blue-600' : 'text-gray-400'}`} />

                        <div className="flex-1 min-w-0">
                          {isEditing ? (
                            <div className="flex items-center gap-1">
                              <input
                                type="text"
                                value={editTitle}
                                onChange={(e) => setEditTitle(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSaveEdit(session.id);
                                  if (e.key === 'Escape') handleCancelEdit();
                                }}
                                className="flex-1 px-2 py-1 text-sm bg-white border border-gray-300 rounded focus:outline-none focus:border-blue-500"
                                autoFocus
                                onClick={(e) => e.stopPropagation()}
                              />
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSaveEdit(session.id);
                                }}
                                className="p-1 hover:bg-gray-200 rounded text-green-600"
                              >
                                <Check size={14} />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCancelEdit();
                                }}
                                className="p-1 hover:bg-gray-200 rounded"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          ) : (
                            <>
                              <div className={`text-sm font-medium truncate ${isActive ? 'text-blue-600' : ''}`}>
                                {session.title}
                              </div>
                              <div className="text-xs text-gray-400 mt-0.5">
                                {new Date(session.updatedAt).toLocaleDateString('zh-CN', {
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </div>
                            </>
                          )}
                        </div>

                        {!isEditing && (
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStartEdit(session.id, session.title);
                              }}
                              className="p-1 hover:bg-gray-200 rounded"
                              title="重命名"
                            >
                              <Edit2 size={14} />
                            </button>
                            <button
                              onClick={(e) => handleDelete(session.id, e)}
                              className="p-1 hover:bg-gray-200 rounded text-red-500"
                              title="删除"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 底部信息和按钮 */}
          <div className="border-t border-gray-200">
            <div className="px-3 py-2 text-xs text-gray-400">
              共 {sessionList.length} 个会话
            </div>
            <div className="flex border-t border-gray-200">
              <button
                onClick={openSettings}
                className="flex-1 p-3 hover:bg-gray-100 transition-colors flex items-center justify-center gap-2 text-sm text-gray-600"
                title="设置"
              >
                <Settings size={18} />
                <span>设置</span>
              </button>
              <div className="w-px bg-gray-200"></div>
              <button
                onClick={() => setIsCollapsed(true)}
                className="flex-1 p-3 hover:bg-gray-100 transition-colors flex items-center justify-center gap-2 text-sm text-gray-600"
                title="收起侧边栏"
              >
                <ChevronLeft size={18} />
                <span>收起</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
