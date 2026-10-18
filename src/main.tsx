import React, { Component, ReactNode } from "react";
import ReactDOM from "react-dom/client";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import App from "./App";
import Capture from "./Capture";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("React ErrorBoundary capturou erro:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            padding: "24px",
            color: "#f87171",
            fontFamily: "sans-serif",
            background: "#111827",
            height: "100vh",
            boxSizing: "border-box",
            overflow: "auto",
          }}
        >
          <h2>Ocorreu um erro no aplicativo</h2>
          <pre
            style={{
              marginTop: "12px",
              whiteSpace: "pre-wrap",
              background: "#1f2937",
              padding: "12px",
              borderRadius: "6px",
              color: "#fca5a5",
              fontSize: "12px",
            }}
          >
            {this.state.error?.message}
            {"\n\n"}
            {this.state.error?.stack}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}

// Window detection: check query parameter or window label
let isCapture = false;
try {
  const urlParams = new URLSearchParams(window.location.search);
  const currentWindow = getCurrentWebviewWindow();
  isCapture = urlParams.get("w") === "capture" || currentWindow.label === "capture";
} catch {
  const urlParams = new URLSearchParams(window.location.search);
  isCapture = urlParams.get("w") === "capture";
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      {isCapture ? <Capture /> : <App />}
    </ErrorBoundary>
  </React.StrictMode>,
);
