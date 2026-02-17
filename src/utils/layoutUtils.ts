import { ChatNode } from '../types';

interface LayoutNode {
  id: string;
  node: ChatNode;
  children: LayoutNode[];
  depth: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

// 估算节点高度
export function estimateNodeHeight(node: ChatNode): number {
  if (node.type === 'conversation') {
    const estimateContentHeight = (text: string): number => {
      if (!text) return 0;
      const lines = text.split('\n');
      let totalHeight = 0;

      for (const line of lines) {
        if (line.trim() === '') {
          totalHeight += 24;
        } else if (line.startsWith('#')) {
          totalHeight += 36;
        } else if (line.startsWith('```')) {
          continue;
        } else {
          const lineLength = line.length;
          const wrappedLines = Math.ceil(lineLength / 60);
          totalHeight += wrappedLines * 24;
        }
      }

      const codeBlocks = (text.match(/```[\s\S]*?```/g) || []);
      codeBlocks.forEach(block => {
        const blockLines = block.split('\n').length;
        totalHeight += blockLines * 20 + 32;
      });

      return totalHeight;
    };

    const userHeight = estimateContentHeight(node.userMessage || '');
    const assistantHeight = estimateContentHeight(node.assistantMessage || '');
    const thinkingHeight = node.thinkingContent ? 60 : 0; // 折叠的思考过程高度
    return 120 + userHeight + assistantHeight + thinkingHeight + 100;
  } else if (node.type === 'input') {
    return 300;
  } else {
    return 200;
  }
}

// 构建树结构
function buildTree(nodes: Record<string, ChatNode>, rootId: string): LayoutNode {
  const node = nodes[rootId];
  const children = node.children
    .filter(childId => nodes[childId])
    .map(childId => buildTree(nodes, childId));

  return {
    id: node.id,
    node,
    children,
    depth: 0,
    x: 0,
    y: 0,
    width: 600,
    height: estimateNodeHeight(node),
  };
}

// 计算子树宽度
function calculateSubtreeWidth(layoutNode: LayoutNode, horizontalSpacing: number): number {
  if (layoutNode.children.length === 0) {
    return layoutNode.width;
  }

  const childrenWidth = layoutNode.children.reduce((sum, child) => {
    return sum + calculateSubtreeWidth(child, horizontalSpacing);
  }, 0);

  const spacingWidth = (layoutNode.children.length - 1) * horizontalSpacing;
  return Math.max(layoutNode.width, childrenWidth + spacingWidth);
}

// 递归布局节点（使用改进的树形布局算法）
function layoutTree(
  layoutNode: LayoutNode,
  x: number,
  y: number,
  depth: number,
  horizontalSpacing: number,
  verticalSpacing: number
): void {
  layoutNode.depth = depth;
  layoutNode.x = x;
  layoutNode.y = y;

  if (layoutNode.children.length === 0) return;

  // 计算所有子节点的总宽度
  const childWidths = layoutNode.children.map(child =>
    calculateSubtreeWidth(child, horizontalSpacing)
  );
  const totalWidth = childWidths.reduce((sum, w) => sum + w, 0) +
    (layoutNode.children.length - 1) * horizontalSpacing;

  // 从父节点中心开始分布子节点
  let currentX = x - totalWidth / 2;

  layoutNode.children.forEach((child, index) => {
    const childWidth = childWidths[index];
    const childCenterX = currentX + childWidth / 2;
    const childY = y + layoutNode.height + verticalSpacing;

    layoutTree(child, childCenterX, childY, depth + 1, horizontalSpacing, verticalSpacing);

    currentX += childWidth + horizontalSpacing;
  });
}

// 收集所有节点的位置
function collectPositions(layoutNode: LayoutNode, positions: Record<string, { x: number; y: number }>): void {
  positions[layoutNode.id] = { x: layoutNode.x, y: layoutNode.y };
  layoutNode.children.forEach(child => collectPositions(child, positions));
}

// 自动布局算法
export function autoLayout(
  nodes: Record<string, ChatNode>,
  rootId: string,
  options: {
    horizontalSpacing?: number;
    verticalSpacing?: number;
  } = {}
): Record<string, { x: number; y: number }> {
  const horizontalSpacing = options.horizontalSpacing ?? 100;
  const verticalSpacing = options.verticalSpacing ?? 80;

  // 构建树结构
  const tree = buildTree(nodes, rootId);

  // 布局树
  layoutTree(tree, 300, 50, 0, horizontalSpacing, verticalSpacing);

  // 收集位置
  const positions: Record<string, { x: number; y: number }> = {};
  collectPositions(tree, positions);

  return positions;
}
