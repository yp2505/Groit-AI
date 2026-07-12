import { useRef, useEffect } from 'react';
import { Box, Typography, Skeleton } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import type { WorkflowNode } from '@/lib/types';

interface AuditLogProps {
  nodes: WorkflowNode[];
  loading?: boolean;
}

function formatTimestamp(iso?: string): string {
  if (!iso) return '';
  try {
    const date = new Date(iso);
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return iso;
  }
}

const AuditLog = ({ nodes, loading }: AuditLogProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const completed = nodes.filter((n) => n.status === 'done' || n.status === 'success' || n.status === 'skipped' || n.status === 'failed');

  // Auto-scroll to bottom when new entries appear
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [completed.length]);

  return (
    <Box className="flex flex-col h-full min-h-0">
      {/* Header */}
      <Box className="flex items-center justify-between mb-3 px-1">
        <Typography
          sx={{
            fontWeight: 700,
            fontSize: 13,
            color: 'hsl(215, 20%, 55%)',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}
        >
          Audit Log
        </Typography>
        {completed.length > 0 && (
          <Typography
            sx={{
              fontSize: 11,
              color: 'hsl(215, 20%, 40%)',
              fontFamily: '"JetBrains Mono", monospace',
              bgcolor: 'hsl(217, 33%, 12%)',
              px: 1,
              py: 0.25,
              borderRadius: '6px',
            }}
          >
            {completed.length}/{nodes.length}
          </Typography>
        )}
      </Box>

      {/* Progress bar */}
      {nodes.length > 0 && (
        <Box className="mb-3 px-1">
          <Box sx={{ height: 3, bgcolor: 'hsl(217, 33%, 15%)', borderRadius: 2, overflow: 'hidden' }}>
            <Box
              sx={{
                height: '100%',
                width: `${(completed.length / nodes.length) * 100}%`,
                bgcolor: completed.some((n) => n.status === 'failed')
                  ? 'hsl(0, 84%, 60%)'
                  : 'hsl(142, 71%, 45%)',
                borderRadius: 2,
                transition: 'width 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
              }}
            />
          </Box>
        </Box>
      )}

      {/* Log entries */}
      <Box
        ref={scrollRef}
        className="flex-1 overflow-y-auto min-h-0 space-y-2 pr-1"
        sx={{
          '&::-webkit-scrollbar': { width: 4 },
          '&::-webkit-scrollbar-track': { bgcolor: 'transparent' },
          '&::-webkit-scrollbar-thumb': { bgcolor: 'hsl(217, 33%, 25%)', borderRadius: 2 },
        }}
      >
        {loading ? (
          [1, 2, 3].map((i) => (
            <Skeleton
              key={i}
              variant="rounded"
              height={64}
              sx={{ bgcolor: 'hsl(217, 33%, 12%)', borderRadius: 2 }}
            />
          ))
        ) : completed.length === 0 ? (
          <Box className="flex flex-col items-center justify-center py-8 gap-2">
            <AccessTimeIcon sx={{ color: 'hsl(217, 33%, 25%)', fontSize: 32 }} />
            <Typography sx={{ color: 'hsl(215, 20%, 35%)', fontSize: 12, textAlign: 'center' }}>
              Waiting for steps to complete…
            </Typography>
          </Box>
        ) : (
          completed.map((n, i) => (
            <Box
              key={n.id}
              className="flex items-start gap-3 rounded-xl border p-3 transition-all duration-300 animate-fade-in"
              sx={{
                borderColor: 'hsl(217, 33%, 15%)',
                bgcolor: 'hsl(222, 47%, 8%)',
                animationDelay: `${i * 0.1}s`,
                '&:hover': {
                  borderColor: (n.status === 'done' || n.status === 'success') ? 'hsl(142, 71%, 30%)' : 'hsl(0, 84%, 35%)',
                  bgcolor: 'hsl(222, 47%, 10%)',
                },
              }}
            >
              {/* Status Icon */}
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 28,
                  height: 28,
                  borderRadius: '8px',
                  bgcolor: (n.status === 'done' || n.status === 'success') 
                    ? 'hsl(142, 71%, 45% / 0.12)' 
                    : (n.status === 'skipped') 
                      ? 'hsl(215, 20%, 35% / 0.12)'
                      : 'hsl(0, 84%, 60% / 0.12)',
                  flexShrink: 0,
                  mt: 0.25,
                }}
              >
                {(n.status === 'done' || n.status === 'success') ? (
                  <CheckCircleIcon sx={{ color: 'hsl(142, 71%, 45%)', fontSize: 16 }} />
                ) : (n.status === 'skipped') ? (
                  <AccessTimeIcon sx={{ color: 'hsl(215, 20%, 50%)', fontSize: 16 }} />
                ) : (
                  <ErrorIcon sx={{ color: 'hsl(0, 84%, 60%)', fontSize: 16 }} />
                )}
              </Box>

              {/* Content */}
              <Box className="flex-1 min-w-0">
                <Typography
                  sx={{
                    fontWeight: 600,
                    fontSize: 12,
                    color: 'hsl(213, 31%, 91%)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {n.title}
                </Typography>
                <Box className="flex items-center gap-2 mt-0.5">
                  {n.timestamp && (
                    <Typography sx={{ fontSize: 10, color: 'hsl(215, 20%, 40%)', fontFamily: '"JetBrains Mono", monospace' }}>
                      {formatTimestamp(n.timestamp)}
                    </Typography>
                  )}
                  {n.duration && (
                    <>
                      <Box sx={{ width: 2, height: 2, borderRadius: '50%', bgcolor: 'hsl(215, 20%, 30%)' }} />
                      <Typography sx={{ fontSize: 10, color: 'hsl(215, 20%, 40%)', fontFamily: '"JetBrains Mono", monospace' }}>
                        {n.duration}
                      </Typography>
                    </>
                  )}
                </Box>
                {n.result && (
                  <Typography
                    sx={{
                      fontSize: 10,
                      color: 'hsl(215, 20%, 50%)',
                      mt: 0.5,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {n.result}
                  </Typography>
                )}
                {n.error && (
                  <Box 
                    sx={{ 
                      mt: 1, 
                      p: 1, 
                      borderRadius: '6px', 
                      bgcolor: 'hsl(0, 84%, 60% / 0.08)',
                      border: '1px solid hsl(0, 84%, 60% / 0.2)'
                    }}
                  >
                    <Typography
                      sx={{
                        fontSize: 10,
                        color: 'hsl(0, 84%, 70%)',
                        fontFamily: '"JetBrains Mono", monospace',
                        lineHeight: 1.4,
                        wordBreak: 'break-all',
                        whiteSpace: 'pre-wrap'
                      }}
                    >
                      Error: {n.error}
                    </Typography>
                  </Box>
                )}
              </Box>
            </Box>
          ))
        )}
      </Box>
    </Box>
  );
};

export default AuditLog;
