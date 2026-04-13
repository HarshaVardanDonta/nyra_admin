import { Component, type ErrorInfo, type ReactNode } from 'react'

export class ErrorBoundary extends Component<
  { children: ReactNode; fallback?: (args: { error: Error; info: ErrorInfo | null }) => ReactNode },
  { error: Error | null; info: ErrorInfo | null }
> {
  state: { error: Error | null; info: ErrorInfo | null } = { error: null, info: null }

  static getDerivedStateFromError(error: Error) {
    return { error, info: null }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.setState({ error, info })
  }

  render() {
    const { error, info } = this.state
    if (!error) return this.props.children
    if (this.props.fallback) return this.props.fallback({ error, info })
    return (
      <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">
        <p className="font-semibold">Editor failed to render</p>
        <p className="mt-1 font-mono text-xs opacity-90">{error.message}</p>
        {info?.componentStack ? (
          <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words rounded bg-black/30 p-2 text-[11px] text-red-100">
            {info.componentStack}
          </pre>
        ) : null}
      </div>
    )
  }
}

