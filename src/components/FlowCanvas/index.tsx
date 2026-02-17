import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  useReactFlow,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { ChevronDown, RefreshCw } from 'lucide-react';
import { useChatStore } from '../../stores/chatStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { ChatNodeComponent } from '../ChatNode';

const nodeTypes = {
  chatNode: ChatNodeComponent,
};

export function FlowCanvas() {
  const { currentSession, selectedNodeId, selectNode, updateSessionDefaultModel, rearrangeNodes } = useChatStore();
  const { modelConfigs, defaultModelConfig } = useSettingsStore();
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [showModelSelector, setShowModelSelector] = useState(false);
  const [isRearranging, setIsRearranging] = useState(false);
  const reactFlowInstance = useReactFlow();
  const prevNodeCountRef = useRef(0);

  // 获取当前会话的模型配置
  const sessionModel = useMemo(() => {
    if (!currentSession?.defaultModelId) return defaultModelConfig;
    return modelConfigs.find(m => m.id === currentSession.defaultModelId) || defaultModelConfig;
  }, [currentSession?.defaultModelId, modelConfigs, defaultModelConfig]);

  // 将ChatNode转换为ReactFlow Node
  useEffect(() => {
    if (!currentSession) return;

    const flowNodes: Node[] = Object.values(currentSession.nodes).map((node) => ({
      id: node.id,
      type: 'chatNode',
      position: node.position,
      data: {
        node,
        isSelected: node.id === selectedNodeId,
        onSelect: () => selectNode(node.id),
      },
      dragHandle: '.drag-handle',
    }));

    const flowEdges: Edge[] = Object.values(currentSession.nodes)
      .filter((node) => node.parentId)
      .map((node) => {
        const isInputNode = node.type === 'input';
        return {
          id: `${node.parentId}-${node.id}`,
          source: node.parentId!,
          target: node.id,
          type: 'smoothstep',
          animated: node.id === selectedNodeId,
          // 如果目标节点是input类型，使用虚线
          style: isInputNode ? { strokeDasharray: '5,5', stroke: '#94a3b8' } : undefined,
        };
      });

    setNodes(flowNodes);
    setEdges(flowEdges);

    // 检测是否有新节点添加（AI生成完成）
    const currentNodeCount = Object.keys(currentSession.nodes).length;
    if (currentNodeCount > prevNodeCountRef.current && prevNodeCountRef.current > 0) {
      // 有新节点添加，聚焦到选中的节点（新的输入节点）
      setTimeout(() => {
        if (selectedNodeId) {
          const selectedNode = flowNodes.find(n => n.id === selectedNodeId);
          if (selectedNode) {
            // 使用 setCenter 聚焦到选中节点，保持合适的缩放级别
            reactFlowInstance.setCenter(
              selectedNode.position.x + 300, // 节点宽度的一半
              selectedNode.position.y,
              { zoom: 0.8, duration: 800 }
            );
          }
        }
      }, 100);
    }
    prevNodeCountRef.current = currentNodeCount;
  }, [currentSession, selectedNodeId, setNodes, setEdges, selectNode, reactFlowInstance]);

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      selectNode(node.id);
    },
    [selectNode]
  );

  const handleRearrange = async () => {
    setIsRearranging(true);
    await rearrangeNodes();
    setIsRearranging(false);
  };

  return (
    <div className="w-full h-full relative">
      {/* 会话模型选择器 - 左上角 */}
      {currentSession && (
        <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
          <div className="relative">
            <button
              onClick={() => setShowModelSelector(!showModelSelector)}
              className="flex items-center gap-1.5 px-2.5 py-1 hover:bg-white/50 rounded transition-colors text-xs text-gray-700 font-medium"
              title={sessionModel ? sessionModel.name : '未选择模型'}
            >
              <span className="max-w-[150px] truncate">
                {sessionModel ? sessionModel.name : '未选择模型'}
              </span>
              <ChevronDown size={12} className="flex-shrink-0" />
            </button>

            {/* 下拉菜单 */}
            {showModelSelector && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowModelSelector(false)}
                />
                <div className="absolute top-full left-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg z-20 min-w-[250px] max-h-[300px] overflow-y-auto">
                  {modelConfigs.length === 0 ? (
                    <div className="p-3 text-xs text-gray-500 text-center">
                      暂无可用模型
                    </div>
                  ) : (
                    modelConfigs.map((config) => (
                      <button
                        key={config.id}
                        onClick={() => {
                          updateSessionDefaultModel(currentSession.id, config.id);
                          setShowModelSelector(false);
                        }}
                        className={`w-full text-left px-3 py-2 hover:bg-gray-100 transition-colors ${
                          sessionModel?.id === config.id ? 'bg-blue-50' : ''
                        }`}
                      >
                        <div className="font-medium text-xs">{config.name}</div>
                        <div className="text-xs text-gray-500">
                          {config.provider === 'custom' ? `自定义 (${config.apiProtocol})` : config.provider} · {config.model}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </>
            )}
          </div>

          {/* 重新排列按钮 */}
          <button
            onClick={handleRearrange}
            disabled={isRearranging}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-white hover:bg-gray-50 rounded transition-colors text-xs text-gray-700 font-medium shadow-sm border border-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
            title="重新排列节点"
          >
            <RefreshCw size={12} className={isRearranging ? 'animate-spin' : ''} />
            <span>{isRearranging ? '排列中...' : '重新排列'}</span>
          </button>
        </div>
      )}

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        nodeTypes={nodeTypes}
        // fitView
        defaultViewport={{ x: 0, y: 0, zoom: 1.0 }}
        panOnScroll={true}
        zoomOnScroll={false}
        panOnScrollMode={"vertical" as any}
        minZoom={0.1}
        maxZoom={2}
        nodesDraggable={true}
        nodeDragThreshold={1}
        selectNodesOnDrag={false}
      >
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>
    </div>
  );
}
