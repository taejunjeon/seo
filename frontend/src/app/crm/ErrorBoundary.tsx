"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

/**
 * 탭 레벨 React ErrorBoundary.
 *
 * 한 탭이 런타임 에러를 터뜨려도 다른 탭·글로벌 레이아웃은 살아있게 함.
 * Phase B에서 도입. Phase C의 관측성 로그와 연동해 `onError` 콜백에서
 * 서버로 에러를 보낼 수도 있음 (현재는 console.error만).
 */

type Props = {
  children: ReactNode;
  fallback?: (error: Error, reset: () => void) => ReactNode;
  label?: string;
};

type State = {
  error: Error | null;
};

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error(`[ErrorBoundary${this.props.label ? ` ${this.props.label}` : ""}]`, error, info);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback(this.state.error, this.reset);
      return (
        <div
          role="alert"
          style={{
            padding: "18px 22px",
            borderRadius: 12,
            background: "#fef2f2",
            border: "1px solid #fecaca",
            color: "#991b1b",
          }}
        >
          <div style={{ fontSize: "0.95rem", fontWeight: 700 }}>
            화면 일부에서 오류가 발생했습니다{this.props.label ? ` (${this.props.label})` : ""}.
          </div>
          <div style={{ marginTop: 6, fontSize: "0.82rem", color: "#7f1d1d" }}>
            {this.state.error.message}
          </div>
          <button
            type="button"
            onClick={this.reset}
            style={{
              marginTop: 12,
              padding: "6px 14px",
              borderRadius: 6,
              border: "1px solid #dc2626",
              background: "#fff",
              color: "#dc2626",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            다시 시도
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
