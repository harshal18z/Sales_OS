import { Component, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

interface State {
  error: Error | null;
}

/**
 * Catches render/runtime errors inside authenticated app subtree so a broken
 * page doesn't blank the whole shell. Preserves the sidebar / topnav.
 */
export class AppErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    // Deliberately not console.error — surfaced via UI + Lovable error reporter root boundary.
    void error;
  }

  reset = () => this.setState({ error: null });

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="flex min-h-full items-center justify-center p-8">
        <div className="max-w-md text-center">
          <div className="mx-auto h-10 w-10 rounded-lg border border-border bg-surface grid place-items-center">
            <AlertTriangle className="h-4 w-4 text-foreground-muted" />
          </div>
          <h2 className="mt-4 text-[15px] font-semibold text-foreground">Something went wrong</h2>
          <p className="mt-1.5 text-[12.5px] text-foreground-muted">
            {this.state.error?.message || "An unexpected error occurred. Please check your configuration."}
          </p>
          <div className="mt-5 flex items-center justify-center gap-2">
            <button
              onClick={this.reset}
              className="h-8 inline-flex items-center rounded-md bg-foreground px-3 text-[12.5px] font-medium text-background hover:opacity-90 transition"
            >
              Try again
            </button>
            <a
              href="/dashboard"
              className="h-8 inline-flex items-center rounded-md border border-border bg-surface px-3 text-[12.5px] text-foreground-muted hover:text-foreground transition"
            >
              Dashboard
            </a>
          </div>
        </div>
      </div>
    );
  }
}
