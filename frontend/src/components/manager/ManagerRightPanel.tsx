import { useState } from 'react';
import { Box, Typography, IconButton, Tooltip } from '@mui/material';
import {
  Menu as MenuIcon,
  X as CloseIcon,
  Circle as DotIcon,
} from 'lucide-react';
import { useTools } from '@/context/ToolsContext';

const CONNECTED_MCPS = [
  { id: 'github', name: 'GitHub Integration' },
  { id: 'jira', name: 'Jira Integration' },
  { id: 'slack', name: 'Slack Integration' },
  { id: 'sheets', name: 'Google Sheets' },
];

export default function ManagerRightPanel() {
  const [open, setOpen] = useState(true);
  const { tools } = useTools();

  return (
    <Box
      sx={{
        width: open ? 280 : 60,
        flexShrink: 0,
        bgcolor: '#ffffff',
        borderLeft: '1px solid #e5e7eb',
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        height: '100vh',
        overflow: 'hidden',
        zIndex: 5,
      }}
    >
      <Box sx={{
        p: '20px 0 12px',
        px: open ? 2 : 0,
        borderBottom: '1px solid #f3f4f6',
        display: 'flex',
        alignItems: 'center',
        justifyContent: open ? 'space-between' : 'center',
      }}>
        {open ? (
          <>
            <Typography sx={{ fontSize: '0.65rem', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Connected Services
            </Typography>
            <IconButton size="small" onClick={() => setOpen(false)} sx={{ color: '#9ca3af', p: 0.5 }}>
              <CloseIcon size={16} />
            </IconButton>
          </>
        ) : (
          <Tooltip title="Expand Panel" placement="left">
            <IconButton size="small" onClick={() => setOpen(true)} sx={{ color: '#22c55e', p: 0.5 }}>
              <MenuIcon size={18} />
            </IconButton>
          </Tooltip>
        )}
      </Box>

      <Box sx={{ p: open ? 2 : '16px 0', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
        {CONNECTED_MCPS.map((mcp) => {
          const isConnected = tools[mcp.id as any]?.status === 'connected';
          return (
            <Box
              key={mcp.id}
              title={open ? '' : mcp.name}
              sx={{
                width: open ? '100%' : 40,
                display: 'flex',
                alignItems: 'center',
                justifyContent: open ? 'flex-start' : 'center',
                gap: 1.5,
                p: open ? '8px 12px' : 0,
                height: 40,
                borderRadius: '12px',
                bgcolor: 'transparent',
                '&:hover': { bgcolor: '#f9fafb' },
                cursor: 'pointer',
              }}
            >
              <DotIcon
                size={14}
                fill={isConnected ? '#22c55e' : '#d1d5db'}
                color={isConnected ? '#22c55e' : '#d1d5db'}
                style={{
                  filter: isConnected ? 'drop-shadow(0 0 4px rgba(34,197,94,0.5))' : 'none',
                  flexShrink: 0
                }}
              />
              {open && (
                <Typography sx={{ fontSize: '0.8rem', fontWeight: 500, color: isConnected ? '#374151' : '#9ca3af', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {mcp.name}
                </Typography>
              )}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
