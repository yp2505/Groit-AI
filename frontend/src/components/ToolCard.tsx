import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTools } from '@/context/ToolsContext';
import { useAppUser } from '@/hooks/useAppUser';
import { Eye, EyeOff, CheckCircle2, AlertTriangle } from "lucide-react";


function ToolCard({ tool, icon, label, description, fields, isOAuth = false, authUrl = '' }) {
  const { tools, setToolConnected, setToolDisconnected } = useTools();
  const { user } = useAppUser();
  const isDeveloper = user?.role === 'developer';

  const state = tools[tool];
  const status = state.status;

  const [values, setValues] = useState(
    Object.fromEntries(fields.map(f => [f.key, f.value || '']))
  );
  const [showPwd, setShowPwd] = useState(
    Object.fromEntries(fields.filter(f => f.type === 'password').map(f => [f.key, false]))
  );

  const isConnecting = status === 'connecting';
  const isConnected = status === 'connected';
  // Fields are optional — if all empty, the backend uses .env credentials
  const allFilled = true; // Always allow connect; backend falls back to .env

  const handleConnect = () => {
    if (isOAuth) {
      // For Google Sheets, we still need the Spreadsheet ID
      if (tool === 'sheets') {
        const spreadsheetId = values['sheet_id']; // Using 'sheet_id' as per teammate's naming
        if (spreadsheetId) {
          localStorage.setItem('google_sheets_id', spreadsheetId);
        }
      }
      // Redirect to the backend OAuth URL
      window.location.href = authUrl;
      return;
    }

    if (isConnecting) return;
    setToolConnected(tool);
  };

  const handleReset = () => {
    setToolDisconnected(tool);
    setValues(Object.fromEntries(fields.map(f => [f.key, ''])));
  };

  const statusColors = {
    idle: { color: "#7d8590", dot: "#484f58" },
    connecting: { color: "#58a6ff", dot: "#58a6ff" },
    connected: { color: "#4ade80", dot: "#2ea043" },
    error: { color: "#f85149", dot: "#f85149" },
  };
  const sc = statusColors[status] || statusColors.idle;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        borderRadius: 14, padding: 20,
        border: `1px solid ${isConnected ? "#2ea043" : status === "error" ? "#f8514950" : "#21262d"}`,
        background: isConnected ? "#0d33200a" : "#161b22",
        transition: "all 0.3s"
      }}
    >
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: isConnected ? 0 : 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: "#0d1117", border: "1px solid #30363d",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 18
          }}>{icon}</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#e6edf3" }}>{label}</div>
            <div style={{ fontSize: 11, color: "#7d8590" }}>{description}</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: sc.color }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: sc.dot, display: "inline-block" }} />
          {status === "idle" ? "Not connected" : status === "connecting" ? "Connecting…" : status === "connected" ? "Connected" : "Failed"}
        </div>
      </div>

      {/* Fields */}
      {!isConnected ? (
        <div>
          {fields.map(field => {
            const isPass = field.type === 'password';
            const visible = showPwd[field.key];
            return (
              <div key={field.key} style={{ marginBottom: 12 }}>
                <label style={{ display: "block", fontSize: 10, fontWeight: 600, color: "#7d8590", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 5 }}>
                  {field.label}
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    type={isPass ? (visible ? "text" : "password") : field.type}
                    placeholder={field.placeholder}
                    value={values[field.key]}
                    disabled={isConnecting}
                    onChange={e => setValues(v => ({ ...v, [field.key]: e.target.value }))}
                    onKeyDown={e => { if (e.key === 'Enter' && allFilled) handleConnect(); }}
                    style={{
                      width: "100%", padding: "10px 14px", paddingRight: isPass ? 40 : 14,
                      borderRadius: 10, background: "#0d1117", border: "1px solid #30363d",
                      color: "#e6edf3", fontSize: 13, outline: "none",
                      fontFamily: "inherit", transition: "border-color 0.2s",
                      boxSizing: "border-box"
                    }}
                    onFocus={e => e.target.style.borderColor = "#2ea043"}
                    onBlur={e => e.target.style.borderColor = "#30363d"}
                  />
                  {isPass && (
                    <button
                      type="button"
                      onClick={() => setShowPwd(s => ({ ...s, [field.key]: !s[field.key] }))}
                      style={{
                        position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                        background: "none", border: "none", color: "#7d8590", cursor: "pointer", fontSize: 12
                      }}
                    >{visible ? "<EyeOff size={16} />" : "<Eye size={16} />"}</button>
                  )}
                </div>
              </div>
            );
          })}

          <button
            onClick={handleConnect}
            disabled={!allFilled || isConnecting}
            style={{
              width: "100%", padding: "10px 14px", borderRadius: 10,
              border: "1px solid #2ea043", background: allFilled && !isConnecting ? "#2ea043" : "transparent",
              color: allFilled && !isConnecting ? "#fff" : "#7d8590",
              fontSize: 13, fontWeight: 600, cursor: allFilled && !isConnecting ? "pointer" : "default",
              opacity: !allFilled || isConnecting ? 0.5 : 1,
              transition: "all 0.2s"
            }}
          >
            {isConnecting ? "⏳ Signing in…" : `Sign in to ${label}`}
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 12 }}>
          <span style={{ color: "#4ade80", fontSize: 13, fontWeight: 500, display: "flex", alignItems: "center", gap: 6 }}>
            <CheckCircle2 size={16} className="text-green-500 inline mr-2" /> {isDeveloper ? state.detail : 'Account connected successfully'}
          </span>
          <button
            onClick={handleReset}
            style={{ background: "none", border: "none", color: "#7d8590", cursor: "pointer", fontSize: 11, transition: "color 0.2s" }}
            onMouseEnter={e => e.currentTarget.style.color = "#f85149"}
            onMouseLeave={e => e.currentTarget.style.color = "#7d8590"}
          >↻ Disconnect</button>
        </div>
      )}

      {/* Error */}
      <AnimatePresence>
        {status === 'error' && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            style={{
              marginTop: 12, padding: "10px 12px", borderRadius: 10,
              background: "rgba(248,81,73,0.08)", border: "1px solid rgba(248,81,73,0.2)",
              color: "#f85149", fontSize: 12
            }}
          >
            <AlertTriangle size={16} className="text-yellow-500 inline mr-2" /> {isDeveloper ? state.detail : 'Could not sign in. Please check your credentials.'}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default ToolCard;
