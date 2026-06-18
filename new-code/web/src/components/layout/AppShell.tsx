import React from 'react';
import type { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { SalesSidebar } from './SalesSidebar';
import { TopBar } from './TopBar';
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
        <main className="flex-1 overflow-auto p-5">{children}</main>
      </div>
    </div>
  );
}
