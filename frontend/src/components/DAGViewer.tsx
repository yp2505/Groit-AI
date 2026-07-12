import { useMemo, useState } from 'react';
import { ReactFlow, Background, Controls, MarkerType } from '@xyflow/react';
import NodeCard from './NodeCard';
import type { WorkflowNode, WorkflowEdge } from '@/lib/types';
import { Box, Skeleton, Typography, Drawer, Divider, IconButton } from '@mui/material';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import CloseIcon from '@mui/icons-material/Close';

interface DAGViewerProps {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  loading?: boolean;
}

const nodeTypes = { custom: NodeCard };

// Map node status to edge color to show execution progress
function getEdgeColor(sourceStatus: string): string {
  switch (sourceStatus) {
    case 'done':
    case 'success':
      return 'hsl(142, 71%, 45%)';
    case 'running':
      return 'hsl(217, 91%, 60%)';
    case 'failed':
      return 'hsl(0, 84%, 60%)';
    case 'waiting_approval':
      return 'hsl(38, 92%, 50%)';
    default:
      return 'hsl(217, 33%, 25%)';
  }
}

const DAGViewer = ({ nodes, edges, loading }: DAGViewerProps) => {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const nodeStatusMap = useMemo(() => {
    const map: Record<string, string> = {};
    nodes.forEach((n) => (map[n.id] = n.status));
    return map;
  }, [nodes]);

  const flowNodes = useMemo(
    () =>
      nodes.map((n, i) => ({
        id: n.id,
        type: 'custom' as const,
        position: { x: i * 300, y: 80 + (i % 2 === 1 ? 30 : 0) },
        data: {
          title: n.title,
          status: n.status,
          description: n.description,
          tool: n.tool,
          duration: n.duration,
        },
      })),
    [nodes]
  );

  const flowEdges = useMemo(
    () =>
      edges.map((e) => {
        const color = getEdgeColor(nodeStatusMap[e.source] || 'pending');
        return {
          id: `${e.source}-${e.target}`,
          source: e.source,
          target: e.target,
          markerEnd: { type: MarkerType.ArrowClosed, color, width: 16, height: 16 },
          animated: nodeStatusMap[e.source] === 'running' || nodeStatusMap[e.source] === 'done' || nodeStatusMap[e.source] === 'success',
          style: { stroke: color, strokeWidth: 2 },
        };
      }),
    [edges, nodeStatusMap]
  );

  if (loading) {
    return (
      <Box className="flex-1 flex flex-col items-center justify-center gap-6 p-8">
        <Box className="flex items-center gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Box key={i} className="flex items-center gap-3">
              <Skeleton
                variant="rounded"
                width={200}
                height={90}
                sx={{ bgcolor: 'hsl(217, 33%, 12%)', borderRadius: 3 }}
              />
              {i < 4 && (
                <Box sx={{ width: 40, height: 2, bgcolor: 'hsl(217, 33%, 18%)', borderRadius: 1 }} />
              )}
            </Box>
          ))}
        </Box>
        <Typography sx={{ color: 'hsl(215, 20%, 40%)', fontSize: 13 }}>
          Loading execution graph…
        </Typography>
      </Box>
    );
  }

  if (nodes.length === 0) {
    return (
      <Box className="flex-1 flex flex-col items-center justify-center gap-3 p-8">
        <AccountTreeIcon sx={{ fontSize: 48, color: 'hsl(217, 33%, 25%)' }} />
        <Typography sx={{ color: 'hsl(215, 20%, 40%)', fontSize: 14 }}>
          No execution graph available
        </Typography>
      </Box>
    );
  }

  return (
    <Box className="flex-1" sx={{ minHeight: 400, width: '100%', height: '100%', position: 'relative' }}>
      <ReactFlow
        nodes={flowNodes}
        edges={flowEdges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        proOptions={{ hideAttribution: true }}
        nodesDraggable={false}
        nodesConnectable={false}
        panOnDrag
        zoomOnScroll
        minZoom={0.3}
        maxZoom={1.5}
        onNodeClick={(_, node) => setSelectedNodeId(node.id)}
      >
        <Background gap={30} size={1} color="hsl(217, 33%, 12%)" />
        <Controls
          style={{
            background: 'hsl(222, 47%, 9%)',
            borderColor: 'hsl(217, 33%, 20%)',
            borderRadius: 12,
            boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
          }}
        />
      </ReactFlow>

      <Drawer
        anchor="right"
        open={!!selectedNodeId}
        onClose={() => setSelectedNodeId(null)}
        slotProps={{
          paper: {
            sx: {
              width: { xs: '100%', sm: 400 },
              bgcolor: 'hsl(222, 47%, 6%)',
              color: 'hsl(213, 31%, 91%)',
              borderLeft: '1px solid hsl(217, 33%, 12%)',
            },
          },
        }}
      >
        <Box className="p-4" sx={{ 
          height: '100%', 
          display: 'flex', 
          flexDirection: 'column', 
          overflow: 'hidden' 
        }}>
          {(() => {
            const sn = nodes.find(n => n.id === selectedNodeId);
            if (!sn) return null;
            return (
              <>
                <Box className="flex items-center justify-between mb-4">
                  <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '1.1rem' }}>
                    {sn.title || sn.id}
                  </Typography>
                  <IconButton onClick={() => setSelectedNodeId(null)} sx={{ color: 'hsl(215, 20%, 65%)' }}>
                    <CloseIcon />
                  </IconButton>
                </Box>
                
                <Box sx={{ mb: 3 }}>
                  <Typography sx={{ color: 'hsl(215, 20%, 65%)', fontSize: 13, mb: 0.5 }}>Status</Typography>
                  <Box className="inline-block px-2 py-1 rounded" sx={{ bgcolor: 'hsl(217, 33%, 15%)', fontSize: 12, fontWeight: 500 }}>
                    {sn.status}
                  </Box>
                </Box>

                <Box sx={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <Box>
                    <Typography sx={{ color: 'hsl(215, 20%, 65%)', fontSize: 13, mb: 1 }}>Inputs Parameters</Typography>
                    <Box component="pre" sx={{ 
                      p: 2, 
                      bgcolor: 'hsl(217, 33%, 12%)', 
                      borderRadius: 1, 
                      fontSize: 12,
                      overflowX: 'auto',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-all'
                    }}>
                      {JSON.stringify(sn.inputs || {}, null, 2)}
                    </Box>
                  </Box>
                  
                  <Box>
                    <Typography sx={{ color: 'hsl(215, 20%, 65%)', fontSize: 13, mb: 1 }}>Output / Error</Typography>
                    <Box component="pre" sx={{ 
                      p: 2, 
                      bgcolor: sn.status === 'failed' ? 'hsl(0, 84%, 60% / 0.1)' : 'hsl(217, 33%, 12%)',
                      color: sn.status === 'failed' ? 'hsl(0, 84%, 70%)' : 'inherit',
                      borderRadius: 1, 
                      fontSize: 12,
                      overflowX: 'auto',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-all',
                      border: sn.status === 'failed' ? '1px solid hsl(0, 84%, 60% / 0.3)' : 'none'
                    }}>
                      {JSON.stringify(sn.outputs || {}, null, 2)}
                    </Box>
                  </Box>
                </Box>
              </>
            );
          })()}
        </Box>
      </Drawer>
    </Box>
  );
};

export default DAGViewer;
