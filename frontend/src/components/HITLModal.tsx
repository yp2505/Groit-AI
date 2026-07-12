import { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  CircularProgress,
  Chip,
} from '@mui/material';
import PanToolIcon from '@mui/icons-material/PanTool';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import type { WorkflowNode } from '@/lib/types';

interface HITLModalProps {
  node: WorkflowNode | null;
  onApprove: (nodeId: string) => Promise<void>;
  onReject: (nodeId: string) => void;
}

const HITLModal = ({ node, onApprove, onReject }: HITLModalProps) => {
  const [loading, setLoading] = useState(false);

  if (!node) return null;

  const handleApprove = async () => {
    setLoading(true);
    try {
      await onApprove(node.id);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open
      slotProps={{
        backdrop: {
          sx: {
            backdropFilter: 'blur(8px)',
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
          },
        },
        paper: {
          sx: {
            bgcolor: 'hsl(222, 47%, 9%)',
            border: '1px solid hsl(38, 92%, 50% / 0.4)',
            borderRadius: 3,
            minWidth: 440,
            maxWidth: 520,
            color: 'hsl(213, 31%, 91%)',
            boxShadow: '0 0 60px hsl(38, 92%, 50% / 0.1), 0 20px 60px rgba(0,0,0,0.5)',
            animation: 'modalEnter 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          },
        },
      }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1.5, pb: 1 }}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 40,
            height: 40,
            borderRadius: '12px',
            bgcolor: 'hsl(38, 92%, 50% / 0.15)',
          }}
        >
          <PanToolIcon sx={{ color: 'hsl(38, 92%, 50%)', fontSize: 22 }} />
        </Box>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 700, fontSize: 18 }}>
            Approval Required
          </Typography>
          <Typography sx={{ fontSize: 12, color: 'hsl(215, 20%, 45%)' }}>
            Human-in-the-loop gate
          </Typography>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ pt: '8px !important' }}>
        {/* Warning Banner */}
        <Box
          className="flex items-center gap-2 rounded-lg p-3 mb-3"
          sx={{ bgcolor: 'hsl(38, 92%, 50% / 0.08)', border: '1px solid hsl(38, 92%, 50% / 0.2)' }}
        >
          <WarningAmberIcon sx={{ color: 'hsl(38, 92%, 50%)', fontSize: 18 }} />
          <Typography sx={{ fontSize: 12, color: 'hsl(38, 92%, 70%)' }}>
            This step requires explicit approval before execution can continue.
          </Typography>
        </Box>

        {/* Node Details */}
        <Box className="rounded-xl border border-border p-4" sx={{ bgcolor: 'hsl(222, 47%, 7%)' }}>
          <Box className="space-y-3">
            <Box>
              <Typography sx={{ fontSize: 11, color: 'hsl(215, 20%, 45%)', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 0.5 }}>
                Step Name
              </Typography>
              <Typography sx={{ fontWeight: 600, fontSize: 15 }}>{node.title}</Typography>
            </Box>

            {node.description && (
              <Box>
                <Typography sx={{ fontSize: 11, color: 'hsl(215, 20%, 45%)', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 0.5 }}>
                  Description
                </Typography>
                <Typography sx={{ fontSize: 13, color: 'hsl(213, 31%, 80%)', lineHeight: 1.5 }}>
                  {node.description}
                </Typography>
              </Box>
            )}

            <Box>
              <Typography sx={{ fontSize: 11, color: 'hsl(215, 20%, 45%)', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 0.5 }}>
                Node ID
              </Typography>
              <Typography sx={{ fontFamily: '"JetBrains Mono", monospace', fontSize: 12, color: 'hsl(215, 20%, 55%)' }}>
                {node.id}
              </Typography>
            </Box>

            {/* Inputs */}
            {node.inputs && Object.keys(node.inputs).length > 0 && (
              <Box>
                <Typography sx={{ fontSize: 11, color: 'hsl(215, 20%, 45%)', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 1 }}>
                  Inputs
                </Typography>
                <Box className="flex flex-wrap gap-1.5">
                  {Object.entries(node.inputs).map(([key, value]) => (
                    <Chip
                      key={key}
                      label={`${key}: ${value}`}
                      size="small"
                      sx={{
                        bgcolor: 'hsl(217, 33%, 15%)',
                        color: 'hsl(215, 20%, 65%)',
                        fontSize: 11,
                        height: 24,
                        fontFamily: '"JetBrains Mono", monospace',
                        borderRadius: '6px',
                      }}
                    />
                  ))}
                </Box>
              </Box>
            )}
          </Box>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3, gap: 1.5 }}>
        <Button
          onClick={() => onReject(node.id)}
          variant="outlined"
          sx={{
            borderColor: 'hsl(0, 84%, 60% / 0.5)',
            color: 'hsl(0, 84%, 60%)',
            borderRadius: 2.5,
            textTransform: 'none',
            fontWeight: 600,
            px: 3,
            '&:hover': { bgcolor: 'hsl(0, 84%, 60% / 0.1)', borderColor: 'hsl(0, 84%, 60%)' },
          }}
        >
          Reject
        </Button>
        <Button
          onClick={handleApprove}
          disabled={loading}
          variant="contained"
          sx={{
            bgcolor: 'hsl(142, 71%, 45%)',
            color: 'hsl(222, 47%, 6%)',
            borderRadius: 2.5,
            textTransform: 'none',
            fontWeight: 600,
            px: 3,
            boxShadow: '0 4px 16px hsl(142, 71%, 45% / 0.3)',
            '&:hover': { bgcolor: 'hsl(142, 71%, 38%)', boxShadow: '0 6px 24px hsl(142, 71%, 45% / 0.4)' },
          }}
        >
          {loading ? <CircularProgress size={20} sx={{ color: 'inherit' }} /> : 'Approve & Continue'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default HITLModal;
