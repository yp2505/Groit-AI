import { Box, InputBase, IconButton, Paper } from '@mui/material';
import { Send as SendIcon } from 'lucide-react';

interface Props {
  input: string;
  setInput: (v: string) => void;
  onSend: (text?: string) => void;
  isLoading: boolean;
}

export default function ManagerInputBar({ input, setInput, onSend, isLoading }: Props) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  return (
    <Box
      sx={{
        px: { xs: 2, md: 4 },
        py: 2,
        bgcolor: '#f5f5f5',
        borderTop: '1px solid #f3f4f6',
        zIndex: 20,
      }}
    >
      <Paper
        elevation={0}
        sx={{
          display: 'flex',
          alignItems: 'center',
          borderRadius: '16px',
          border: '1px solid #e5e7eb',
          bgcolor: '#ffffff',
          px: 2,
          py: 0.5,
          maxWidth: 800,
          mx: 'auto',
          boxShadow: '0 1px 8px rgba(0,0,0,0.06)',
          transition: 'box-shadow 0.2s ease, border-color 0.2s ease',
          '&:focus-within': {
            borderColor: '#22c55e',
            boxShadow: '0 2px 16px rgba(34,197,94,0.12)',
          },
        }}
      >
        <InputBase
          fullWidth
          multiline
          maxRows={4}
          placeholder="Describe a workflow… (e.g. Create Jira ticket → GitHub branch → Slack alert)"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isLoading}
          sx={{
            fontSize: '0.9rem',
            fontWeight: 500,
            color: '#111827',
            py: 1,
            '& input::placeholder, & textarea::placeholder': {
              color: '#9ca3af',
              opacity: 1,
              fontWeight: 400,
            },
          }}
        />
        <IconButton
          onClick={() => onSend()}
          disabled={!input.trim() || isLoading}
          sx={{
            width: 40,
            height: 40,
            borderRadius: '12px',
            bgcolor: input.trim() && !isLoading ? '#22c55e' : '#e5e7eb',
            color: '#ffffff',
            ml: 1,
            transition: 'all 0.2s ease',
            '&:hover': {
              bgcolor: input.trim() && !isLoading ? '#16a34a' : '#d1d5db',
            },
            '&.Mui-disabled': {
              color: '#ffffff',
              bgcolor: '#e5e7eb',
            },
          }}
        >
          <SendIcon size={18} />
        </IconButton>
      </Paper>
      <Box sx={{ textAlign: 'center', fontSize: '0.68rem', color: '#9ca3af', mt: 1 }}>
        Enter to send · Shift+Enter for new line
      </Box>
    </Box>
  );
}
