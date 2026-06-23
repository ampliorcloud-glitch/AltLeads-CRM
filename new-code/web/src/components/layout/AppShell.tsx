import React from 'react';
import type { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { SalesSidebar } from './SalesSidebar';
import { TopBar } from './TopBar';
import { RouteErrorBoundary } from '../ui/ErrorBoundary';
import { useIsSalesShell } from '../../contexts/SalesShellContext';

interface AppShellProps {
  title: string;
  children: ReactNode;
}

export function AppShell({ title, children }: AppShellProps) {
  // When rendered inside the Sales Portal route tree (/sales/*), swap the
  // internal nav for the minimal sales sidebar. Reused pages (LeadsPage,
  // LeadDetailPage) need no changes — the context provider in App.tsx flips this.
  const isSalesShell = useIsSalesShell();

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--color-page-bg)' }}>
      {isSalesShell ? <SalesSidebar /> : <Sidebar />}
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar title={title} />
        {/* Per-route boundary: a render-time throw in the page CONTENT shows a
            calm fallback in the content area while the sidebar/topbar stay alive,
            so navigation survives one broken screen (mirrors PortalLayout). */}
        <main className="flex-1 overflow-auto p-5">
          <RouteErrorBoundary name="page">{children}</RouteErrorBoundary>
        </main>
      </div>
    </div>
  );
}
