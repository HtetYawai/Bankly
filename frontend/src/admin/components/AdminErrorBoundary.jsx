import { Component } from "react";
import AdminErrorState from "./AdminErrorState";

export default class AdminErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error("[AdminErrorBoundary]", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-100 p-6 flex items-center justify-center">
          <div className="w-full max-w-xl">
            <AdminErrorState onRetry={() => this.setState({ hasError: false })} />
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
