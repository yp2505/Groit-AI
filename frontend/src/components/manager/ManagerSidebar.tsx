import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Avatar,
  Chip,
  List,
  ListItemButton,
  ListItemIcon,
  Divider,
  Button,
} from '@mui/material';
import {
  LayoutDashboard as DashboardIcon,
  LogOut as LogoutIcon,
  MessageSquare as ChatIcon,
  Plus as PlusIcon,
} from 'lucide-react';
import { useAppUser } from '@/hooks/useAppUser';



interface Props {
  onNewWorkflow?: () => void;
}

export default function ManagerSidebar({ onNewWorkflow }: Props) {
  const { user, logout } = useAppUser();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <Box
      sx={{
        width: 260,
        minWidth: 260,
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: '#ffffff',
        borderRight: '1px solid',
        borderColor: '#e5e7eb',
        overflow: 'hidden',
      }}
    >
      {/* ── App Title ──────────────────────────── */}
      <Box sx={{ px: 2.5, pt: 3, pb: 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(34,197,94,0.25)',
            }}
          >
            <Typography
              sx={{ color: '#fff', fontWeight: 800, fontSize: '0.9rem', lineHeight: 1 }}
            >
              G
            </Typography>
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 700, fontSize: '0.95rem', color: '#111827', lineHeight: 1.2 }}>
              Groit AI
            </Typography>
            <Typography sx={{ fontSize: '0.65rem', color: '#9ca3af', fontWeight: 600, letterSpacing: '0.04em' }}>
              Intelligent Orchestration
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* ── Profile Card ───────────────────────── */}
      <Box sx={{ px: 2, py: 1.5 }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            px: 1.5,
            py: 1.5,
            borderRadius: '14px',
            bgcolor: '#f9fafb',
            border: '1px solid #f3f4f6',
          }}
        >
          <Avatar
            sx={{
              width: 36,
              height: 36,
              bgcolor: '#8b5cf6',
              fontSize: '0.85rem',
              fontWeight: 700,
            }}
          >
            {user?.name?.charAt(0) || 'M'}
          </Avatar>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography
              sx={{
                fontSize: '0.82rem',
                fontWeight: 600,
                color: '#111827',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {user?.name || 'Manager'}
            </Typography>
            <Chip
              label="Manager"
              size="small"
              sx={{
                height: 18,
                fontSize: '0.6rem',
                fontWeight: 700,
                letterSpacing: '0.05em',
                mt: 0.3,
                bgcolor: '#ede9fe',
                color: '#7c3aed',
                border: '1px solid #ddd6fe',
                '& .MuiChip-label': { px: 1 },
              }}
            />
          </Box>
        </Box>
      </Box>

      {/* ── New Workflow Button ─────────────────── */}
      <Box sx={{ px: 1.5, pt: 1.5, pb: 0.5 }}>
        <Button
          fullWidth
          variant="outlined"
          onClick={onNewWorkflow}
          startIcon={<PlusIcon size={16} />}
          sx={{
            borderRadius: '12px',
            textTransform: 'none',
            fontWeight: 600,
            fontSize: '0.82rem',
            py: 1,
            color: '#22c55e',
            borderColor: '#dcfce7',
            bgcolor: '#f0fdf4',
            '&:hover': {
              bgcolor: '#dcfce7',
              borderColor: '#bbf7d0',
            },
          }}
        >
          New Workflow
        </Button>
      </Box>

      <Divider sx={{ mx: 2, borderColor: '#f3f4f6' }} />

      {/* ── Navigation ─────────────────────────── */}
      <Box sx={{ px: 1.5, pt: 1.5 }}>
        <Typography
          sx={{
            fontSize: '0.6rem',
            fontWeight: 700,
            color: '#9ca3af',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            px: 1.5,
            mb: 0.5,
          }}
        >
          Navigation
        </Typography>
        <List disablePadding>
          <ListItemButton
            selected
            sx={{
              borderRadius: '12px',
              mb: 0.3,
              py: 1,
              '&.Mui-selected': {
                bgcolor: '#f0fdf4',
                border: '1px solid #dcfce7',
                '&:hover': { bgcolor: '#ecfdf5' },
              },
            }}
          >
            <ListItemIcon sx={{ minWidth: 36 }}>
              <DashboardIcon size={18} color="#22c55e" />
            </ListItemIcon>
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ fontSize: '0.82rem', fontWeight: 600, color: '#166534' }}>
                Dashboard
              </Typography>
            </Box>
          </ListItemButton>
        </List>
      </Box>

      <Divider sx={{ mx: 2, my: 1, borderColor: '#f3f4f6' }} />

      {/* ── Chat History ───────────────────────── */}
      <Box sx={{ px: 1.5 }}>
        <Typography
          sx={{
            fontSize: '0.6rem',
            fontWeight: 700,
            color: '#9ca3af',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            px: 1.5,
            mb: 0.5,
          }}
        >
          Chat History
        </Typography>
        <List disablePadding>
          <ListItemButton
            sx={{
              borderRadius: '12px',
              py: 0.8,
              opacity: 0.6,
            }}
          >
            <ListItemIcon sx={{ minWidth: 36 }}>
              <ChatIcon size={16} color="#d1d5db" />
            </ListItemIcon>
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ fontSize: '0.78rem', fontWeight: 500, color: '#9ca3af', fontStyle: 'italic' }}>
                Empty session
              </Typography>
            </Box>
          </ListItemButton>
        </List>
      </Box>



      {/* ── Sign Out ───────────────────────────── */}
      <Box sx={{ p: 2, borderTop: '1px solid #f3f4f6' }}>
        <Button
          fullWidth
          variant="outlined"
          onClick={handleLogout}
          startIcon={<LogoutIcon size={16} />}
          sx={{
            borderRadius: '12px',
            textTransform: 'none',
            fontWeight: 600,
            fontSize: '0.82rem',
            py: 1,
            color: '#ef4444',
            borderColor: '#fecaca',
            '&:hover': {
              bgcolor: '#fef2f2',
              borderColor: '#fca5a5',
            },
          }}
        >
          Sign Out
        </Button>
      </Box>
    </Box>
  );
}
