import { memo, useState } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Box, Typography, Chip } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import HourglassTopIcon from '@mui/icons-material/HourglassTop';
import PlayCircleIcon from '@mui/icons-material/PlayCircle';
import PanToolIcon from '@mui/icons-material/PanTool';
import BugReportIcon from '@mui/icons-material/BugReport';
import GitHubIcon from '@mui/icons-material/GitHub';
import ChatIcon from '@mui/icons-material/Chat';
import TableChartIcon from '@mui/icons-material/TableChart';
import ForumIcon from '@mui/icons-material/Forum';
import CloudIcon from '@mui/icons-material/Cloud';
import ViewKanbanIcon from '@mui/icons-material/ViewKanban';
import StorageIcon from '@mui/icons-material/Storage';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import VisibilityIcon from '@mui/icons-material/Visibility';
import HubIcon from '@mui/icons-material/Hub';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { NodeStatus, MCPTool } from '@/lib/types';

const statusConfig: Record<NodeStatus, { color: string; bg: string; border: string; icon: React.ReactNode; label: string }> = {
  pending: {
    color: 'hsl(220, 13%, 46%)',
    bg: 'hsl(220, 13%, 46% / 0.1)',
    border: 'hsl(220, 13%, 25%)',
    icon: <HourglassTopIcon sx={{ fontSize: 14 }} />,
    label: 'Pending',
  },
  running: {
    color: 'hsl(217, 91%, 60%)',
    bg: 'hsl(217, 91%, 60% / 0.1)',
    border: 'hsl(217, 91%, 40%)',
    icon: <PlayCircleIcon sx={{ fontSize: 14 }} />,
    label: 'Running',
  },
  done: {
    color: 'hsl(142, 71%, 45%)',
    bg: 'hsl(142, 71%, 45% / 0.1)',
    border: 'hsl(142, 71%, 30%)',
    icon: <CheckCircleIcon sx={{ fontSize: 14 }} />,
    label: 'Done',
  },
  failed: {
    color: 'hsl(0, 84%, 60%)',
    bg: 'hsl(0, 84%, 60% / 0.1)',
    border: 'hsl(0, 84%, 35%)',
    icon: <ErrorIcon sx={{ fontSize: 14 }} />,
    label: 'Failed',
  },
  waiting_approval: {
    color: 'hsl(38, 92%, 50%)',
    bg: 'hsl(38, 92%, 50% / 0.1)',
    border: 'hsl(38, 92%, 35%)',
    icon: <PanToolIcon sx={{ fontSize: 14 }} />,
    label: 'Needs Approval',
  },
  success: {
    color: 'hsl(142, 71%, 45%)',
    bg: 'hsl(142, 71%, 45% / 0.1)',
    border: 'hsl(142, 71%, 30%)',
    icon: <CheckCircleIcon sx={{ fontSize: 14 }} />,
    label: 'Success',
  },
  skipped: {
    color: 'hsl(215, 20%, 45%)',
    bg: 'hsl(215, 20%, 45% / 0.1)',
    border: 'hsl(215, 20%, 25%)',
    icon: <PanToolIcon sx={{ fontSize: 14 }} />,
    label: 'Skipped',
  },
};

const toolIcons: Record<MCPTool, React.ReactNode> = {
  jira: <BugReportIcon sx={{ fontSize: 16, color: 'hsl(217, 91%, 60%)' }} />,
  github: <GitHubIcon sx={{ fontSize: 16, color: 'hsl(0, 0%, 85%)' }} />,
  slack: <ChatIcon sx={{ fontSize: 16, color: 'hsl(340, 82%, 55%)' }} />,
  sheets: <TableChartIcon sx={{ fontSize: 16, color: 'hsl(142, 71%, 50%)' }} />,
  discord: <ForumIcon sx={{ fontSize: 16, color: 'hsl(235, 86%, 65%)' }} />,
  aws: <CloudIcon sx={{ fontSize: 16, color: 'hsl(30, 100%, 50%)' }} />,
  trello: <ViewKanbanIcon sx={{ fontSize: 16, color: 'hsl(200, 82%, 55%)' }} />,
  airtable: <StorageIcon sx={{ fontSize: 16, color: 'hsl(265, 67%, 55%)' }} />,
  generic: <SmartToyIcon sx={{ fontSize: 16, color: 'hsl(215, 20%, 55%)' }} />,
  system: <HubIcon sx={{ fontSize: 16, color: 'hsl(280, 80%, 65%)' }} />,
};

interface NodeCardProps {
  data: { 
    id: string;
    title: string; 
    status: NodeStatus; 
    description?: string; 
    tool?: MCPTool; 
    duration?: string;
    inputs?: Record<string, any>;
    outputs?: Record<string, any>;
  };
}

const NodeCard = memo(({ data }: NodeCardProps) => {
  const config = statusConfig[data.status];
  const isRunning = data.status === 'running';
  const isApproval = data.status === 'waiting_approval';

  return (
    <>
      <Handle type="target" position={Position.Left} style={{ background: 'hsl(217, 33%, 30%)', border: 'none', width: 8, height: 8 }} />
      <Box
        className={`rounded-xl border transition-all duration-300 ${isRunning ? 'node-running' : ''} ${isApproval ? 'node-approval' : ''}`}
        sx={{
          bgcolor: 'hsl(222, 47%, 9%)',
          borderColor: config.border,
          borderWidth: isApproval ? 2 : 1,
          minWidth: 210,
          maxWidth: 240,
          p: 2,
          '&:hover': {
            borderColor: config.color,
            bgcolor: 'hsl(222, 47%, 11%)',
            transform: 'translateY(-1px)',
            boxShadow: `0 4px 20px ${config.color}22`,
          },
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        {/* Server Label */}
        {data.tool && (
          <Box sx={{ mb: 1.5, display: 'flex', alignItems: 'center' }}>
            <Typography sx={{ 
              fontSize: 9, 
              fontWeight: 700, 
              textTransform: 'uppercase', 
              letterSpacing: 0.5, 
              color: config.color, 
              bgcolor: config.bg, 
              px: 1, 
              py: 0.25, 
              borderRadius: 1 
            }}>
               Executing on {data.tool.toUpperCase()} Server
            </Typography>
          </Box>
        )}

        {/* Header: tool icon + title */}
        <Box className="flex items-center gap-2 mb-1.5">
          {data.tool && (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 28,
                height: 28,
                borderRadius: '8px',
                bgcolor: 'hsl(217, 33%, 15%)',
                flexShrink: 0,
              }}
            >
              {toolIcons[data.tool]}
            </Box>
          )}
          <Typography sx={{ color: 'hsl(213, 31%, 91%)', fontWeight: 600, fontSize: 13, lineHeight: 1.3 }}>
            {data.title}
          </Typography>
        </Box>

        {/* Description */}
        {data.description && (
          <Typography sx={{ color: 'hsl(215, 20%, 45%)', fontSize: 11, lineHeight: 1.4, mb: 1.5, pl: data.tool ? '36px' : 0 }}>
            {data.description}
          </Typography>
        )}

        {/* Status + Duration row */}
        <Box className="flex items-center justify-between gap-2">
          <Chip
            icon={<Box sx={{ color: config.color, display: 'flex' }}>{config.icon}</Box>}
            label={config.label}
            size="small"
            sx={{
              bgcolor: config.bg,
              color: config.color,
              fontWeight: 600,
              fontSize: 10,
              height: 22,
              '& .MuiChip-icon': { ml: 0.5 },
            }}
          />
          {data.duration && (
            <Typography sx={{ color: 'hsl(215, 20%, 45%)', fontSize: 10, fontFamily: '"JetBrains Mono", monospace' }}>
              {data.duration}
            </Typography>
          )}
        </Box>

        {/* Inspect Outputs Button */}
        {data.outputs && Object.keys(data.outputs).length > 0 && (
          <Box sx={{ mt: 2, pt: 1.5, borderTop: '1px border-neutral-800', display: 'flex', justifyContent: 'flex-end' }}>
            <Dialog>
              <DialogTrigger asChild>
                <Chip
                  icon={<VisibilityIcon sx={{ fontSize: '12px !important' }} />}
                  label="Inspect Result"
                  size="small"
                  clickable
                  sx={{
                    height: 20,
                    fontSize: 9,
                    fontWeight: 600,
                    bgcolor: 'hsl(217, 33%, 15%)',
                    color: 'hsl(213, 31%, 70%)',
                    border: '1px solid hsl(217, 33%, 25%)',
                    '&:hover': {
                      bgcolor: 'hsl(217, 33%, 20%)',
                      color: 'hsl(213, 31%, 91%)',
                    }
                  }}
                />
              </DialogTrigger>
              <DialogContent className="sm:max-w-[600px] bg-neutral-950 border-neutral-800 text-neutral-100">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 text-lg">
                    {toolIcons[data.tool || 'generic']}
                    {data.title} — Output Logs
                  </DialogTitle>
                </DialogHeader>
                
                <ScrollArea className="mt-4 max-h-[60vh] rounded-md border border-neutral-800 bg-black/50 p-4">
                  <div className="space-y-6">
                    {data.inputs && Object.keys(data.inputs).length > 0 && (
                      <section>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-500 mb-2">Parameters Sent</h4>
                        <pre className="text-xs font-mono text-blue-400 overflow-x-auto">
                          {JSON.stringify(data.inputs, null, 2)}
                        </pre>
                      </section>
                    )}
                    
                    <section>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-green-500 mb-2">Response Received</h4>
                      <pre className="text-xs font-mono text-neutral-300 overflow-x-auto whitespace-pre-wrap">
                        {JSON.stringify(data.outputs, null, 2)}
                      </pre>
                    </section>
                  </div>
                </ScrollArea>
              </DialogContent>
            </Dialog>
          </Box>
        )}
      </Box>
      <Handle type="source" position={Position.Right} style={{ background: 'hsl(217, 33%, 30%)', border: 'none', width: 8, height: 8 }} />
    </>
  );
});

NodeCard.displayName = 'NodeCard';

export default NodeCard;
