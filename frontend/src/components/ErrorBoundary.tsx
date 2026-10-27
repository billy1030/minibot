import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw, RotateCcw } from "lucide-react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Unhandled React Exception captured by ErrorBoundary:", error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            height: "100vh",
            width: "100vw",
            background: "var(--bg-primary, #0f172a)",
            color: "#f8fafc",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
            boxSizing: "border-box",
            fontFamily: "system-ui, -apple-system, sans-serif",
          }}
        >
          <div
            style={{
              maxWidth: 580,
              width: "100%",
              background: "rgba(30, 41, 59, 0.95)",
              border: "1px solid rgba(239, 68, 68, 0.4)",
              borderRadius: 12,
              padding: "24px 28px",
              boxShadow: "0 20px 40px rgba(0,0,0,0.5)",
              display: "flex",
              flexDirection: "column",
              gap: 16,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  background: "rgba(239, 68, 68, 0.15)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#ef4444",
                  flexShrink: 0,
                }}
              >
                <AlertTriangle size={22} />
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#f8fafc" }}>
                  MiniBot 介面已自動保護 (UI Protected)
                </h2>
                <p style={{ margin: "4px 0 0 0", fontSize: 13, color: "var(--text-muted, #94a3b8)" }}>
                  系統已自動攔截渲染異常，防止頁面白屏。您的對話記錄與設定已妥善保留。
                </p>
              </div>
            </div>

            {this.state.error && (
              <div
                style={{
                  background: "rgba(15, 23, 42, 0.8)",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  borderRadius: 8,
                  padding: 12,
                  fontSize: 12,
                  fontFamily: "monospace",
                  color: "#fca5a5",
                  maxHeight: 140,
                  overflowY: "auto",
                  wordBreak: "break-word",
                  whiteSpace: "pre-wrap",
                }}
              >
                {this.state.error.toString()}
              </div>
            )}

            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4 }}>
              <button
                type="button"
                onClick={this.handleReset}
                style={{
                  flex: 1,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  background: "#2563eb",
                  border: "none",
                  color: "#fff",
                  borderRadius: 8,
                  padding: "10px 16px",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "background 0.15s ease",
                }}
              >
                <RotateCcw size={15} /> 一鍵恢復介面 (Recover UI)
              </button>

              <button
                type="button"
                onClick={this.handleReload}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  background: "rgba(255, 255, 255, 0.08)",
                  border: "1px solid rgba(255, 255, 255, 0.15)",
                  color: "#cbd5e1",
                  borderRadius: 8,
                  padding: "10px 16px",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                <RefreshCw size={14} /> 重新整理 (F5)
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
