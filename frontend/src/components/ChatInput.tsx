import { useState } from 'react';
import { Box, TextField, Typography, CircularProgress, Chip } from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import BugReportIcon from '@mui/icons-material/BugReport';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import DescriptionIcon from '@mui/icons-material/Description';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';

// MCP-relevant workflow examples matching the problem statement
const EXAMPLE_WORKFLOWS = [
  {
    text: 'Send a Slack message saying Hello from my workflow system',
    icon: <NotificationsActiveIcon sx={{ fontSize: '14px !important', color: 'hsl(38, 92%, 50%) !important' }} />,
  },
  {
    text: 'Fetch latest commits from GitHub and send a summary to Slack',
    icon: <DescriptionIcon sx={{ fontSize: '14px !important', color: 'hsl(217, 91%, 60%) !important' }} />,
  },
  {
    text: 'Fetch GitHub commits and Jira issues in parallel, then send a combined summary to Slack',
    icon: <BugReportIcon sx={{ fontSize: '14px !important', color: 'hsl(0, 84%, 60%) !important' }} />,
  },
];

interface ChatInputProps {
  onSubmit: (text: string) => void;
  loading: boolean;
  error: string | null;
}

const ChatInput = ({ onSubmit, loading, error }: ChatInputProps) => {
  const [text, setText] = useState('');

  const handleSubmit = () => {
    if (!text.trim() || loading) return;
    onSubmit(text.trim());
  };

  return (
    <Box className="flex flex-col items-center justify-center min-h-[85vh] px-4 animate-fade-in">
      {/* Animated AI Icon */}
      <Box className="flex flex-col items-center gap-4 mb-10">
        <Box className="relative">
          <Box className="ai-icon-glow p-4 rounded-2xl bg-secondary relative z-10">
            <AutoAwesomeIcon sx={{ fontSize: 44, color: 'hsl(217, 91%, 60%)' }} className="ai-icon-spin" />
          </Box>
        </Box>
        <Typography
          variant="h3"
          className="font-extrabold bg-clip-text text-transparent bg-gradient-to-br from-foreground to-primary"
          sx={{
            letterSpacing: '-0.04em',
            textAlign: 'center',
            fontSize: { xs: '1.75rem', sm: '2.5rem', md: '3rem' },
          }}
        >
          Describe your workflow
        </Typography>
        <Typography className="text-muted-foreground text-center max-w-[520px] px-2 text-sm sm:text-base leading-relaxed">
          Enter a natural language description and our MCP Gateway will decompose it into an executable DAG across your connected services.
        </Typography>
      </Box>

      {/* Input Box with Glow */}
      <Box className="w-full max-w-2xl">
        <Box className={`input-glow-wrapper rounded-2xl p-[1px] transition-all duration-500 ${text.trim() ? 'input-glow-active' : ''}`}>
          <Box className="flex items-end gap-2 rounded-2xl bg-card p-3">
            <TextField
              fullWidth
              multiline
              maxRows={4}
              placeholder="e.g. When a critical bug is filed in Jira, create a GitHub branch, notify Slack…"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              disabled={loading}
              variant="standard"
              className="text-foreground"
              slotProps={{
                input: {
                  disableUnderline: true,
                  className: "text-foreground font-sans px-2 py-1 text-[15px]",
                },
              }}
            />
            <Box
              onClick={handleSubmit}
              className={`submit-btn flex items-center justify-center rounded-xl cursor-pointer transition-all duration-300 ${
                !text.trim() || loading ? 'submit-btn-disabled' : ''
              }`}
              sx={{
                minWidth: 52,
                height: 52,
                flexShrink: 0,
                pointerEvents: !text.trim() || loading ? 'none' : 'auto',
              }}
            >
              {loading ? (
                <CircularProgress size={22} className="text-primary-foreground" />
              ) : (
                <RocketLaunchIcon sx={{ fontSize: 22 }} className="text-primary-foreground" />
              )}
            </Box>
          </Box>
        </Box>

        {/* Loading State */}
        {loading && (
          <Box className="flex items-center justify-center gap-3 mt-5 animate-fade-in">
            <Box className="loading-dots flex gap-1">
              <span className="dot" />
              <span className="dot" />
              <span className="dot" />
            </Box>
            <Typography sx={{ color: 'hsl(217, 91%, 60%)', fontSize: 14, fontWeight: 500 }}>
              Decomposing workflow into DAG…
            </Typography>
          </Box>
        )}

        {error && (
          <Box className="flex items-center gap-2 justify-center mt-3 px-4 py-2 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-[13px]">
            {error}
          </Box>
        )}

        {/* Example Workflow Chips */}
        {!loading && (
          <Box className="flex flex-wrap justify-center gap-2 mt-6 animate-fade-in" sx={{ animationDelay: '0.2s' }}>
            {EXAMPLE_WORKFLOWS.map((example) => (
              <Chip
                key={example.text}
                label={example.text}
                onClick={() => setText(example.text)}
                icon={example.icon}
                className="bg-secondary text-muted-foreground border border-border hover:bg-secondary/80 hover:text-foreground transition-all duration-200"
                sx={{
                  borderRadius: '12px',
                  fontSize: 11,
                  height: 'auto',
                  py: 0.75,
                  cursor: 'pointer',
                  maxWidth: { xs: '100%', sm: '48%' },
                  '& .MuiChip-label': {
                    whiteSpace: 'normal',
                    lineHeight: 1.4,
                  },
                }}
              />
            ))}
          </Box>
        )}
      </Box>

      {/* Bottom tag */}
      <Typography className="text-muted-foreground/60 text-[11px] mt-6 flex text-center font-medium">
        Powered by Model Context Protocol (MCP) · Supports Jira, GitHub, Slack, Sheets, Discord, AWS & more
      </Typography>
    </Box>
  );
};

export default ChatInput;
