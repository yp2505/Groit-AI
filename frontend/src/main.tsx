import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ClerkProvider } from "@clerk/clerk-react";
import App from "./App.tsx";
import "./index.css";

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

function MissingClerkKey() {
  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "#0d1117", color: "#e6edf3", fontFamily: "system-ui, sans-serif", padding: 24,
    }}>
      <div style={{ maxWidth: 520, textAlign: "center" }}>
        <div style={{
          width: 56, height: 56, borderRadius: 14, margin: "0 auto 20px",
          background: "#0d3320", border: "1px solid #2ea043",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "#4ade80", fontSize: 24, fontWeight: 700,
        }}>G</div>
        <h1 style={{ margin: "0 0 8px", fontSize: 28 }}>Groit AI</h1>
        <p style={{ color: "#7d8590", lineHeight: 1.6 }}>
          Clerk authentication is not configured yet. Create a free app at{" "}
          <a href="https://dashboard.clerk.com" style={{ color: "#58a6ff" }}>dashboard.clerk.com</a>,
          copy your publishable key, and add it to <code>frontend/.env</code>:
        </p>
        <pre style={{
          textAlign: "left", marginTop: 20, padding: 16, borderRadius: 10,
          background: "#161b22", border: "1px solid #30363d", color: "#7ee787",
          overflowX: "auto",
        }}>
          VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
        </pre>
      </div>
    </div>
  );
}

const root = createRoot(document.getElementById("root")!);

if (!PUBLISHABLE_KEY) {
  root.render(
    <StrictMode>
      <MissingClerkKey />
    </StrictMode>,
  );
} else {
  root.render(
    <StrictMode>
      <ClerkProvider
        publishableKey={PUBLISHABLE_KEY}
        afterSignOutUrl="/"
        signInUrl="/login"
        signUpUrl="/sign-up"
      >
        <App />
      </ClerkProvider>
    </StrictMode>,
  );
}
