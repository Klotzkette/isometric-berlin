import {
  Component,
  type ErrorInfo,
  type ReactElement,
  type ReactNode,
} from "react";

type ThreeViewerLoadErrorFallbackProps = {
  active: boolean;
  detail: string;
  mapLabel: string;
  message: string;
  reloadLabel: string;
  onReload: () => void;
  onUseMap: () => void;
};

export function ThreeViewerLoadErrorFallback({
  active,
  detail,
  mapLabel,
  message,
  reloadLabel,
  onReload,
  onUseMap,
}: ThreeViewerLoadErrorFallbackProps): ReactElement {
  if (!active) {
    return (
      <div
        className="three-viewer three-viewer-error"
        aria-hidden="true"
      />
    );
  }

  return (
    <div
      className="three-viewer three-viewer-error is-active"
    >
      <div className="three-viewer-error-panel" role="alert">
        <strong>{message}</strong>
        <p>{detail}</p>
        <div className="three-viewer-error-actions">
          <button type="button" onClick={onReload} autoFocus>
            {reloadLabel}
          </button>
          <button type="button" onClick={onUseMap}>
            {mapLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

type ThreeViewerErrorBoundaryProps = ThreeViewerLoadErrorFallbackProps & {
  children: ReactNode;
};

type ThreeViewerErrorBoundaryState = {
  failed: boolean;
};

export class ThreeViewerErrorBoundary extends Component<
  ThreeViewerErrorBoundaryProps,
  ThreeViewerErrorBoundaryState
> {
  state: ThreeViewerErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): ThreeViewerErrorBoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    console.error("Isometric Berlin 3D module failed to render", error, info);
  }

  render(): ReactNode {
    if (!this.state.failed) {
      return this.props.children;
    }
    return <ThreeViewerLoadErrorFallback {...this.props} />;
  }
}
