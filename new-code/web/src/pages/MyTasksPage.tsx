/**
 * My Tasks — the personal task / follow-up list (ALT-160, build slice 2).
 *
 * Tabs: Overdue / Today / Upcoming / Completed (counts in the tab labels). Each
 * row shows type icon, subject, the linked record, due time + relative label and
 * a priority chip, with per-row Mark done / Skip / Snooze quick actions. A
 * "+ New task" button opens the shared CreateTaskModal.
 *
 * Reuses the house inline-style + design tokens, SkeletonTable while loading,
 * and the global Toast / Confirm. Rows are keyboard-operable.
 *
 * Buckets are computed in IST in the data layer (see data/tasks.ts +
 * components/tasks/taskScheduling.ts).
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Phone,
  CalendarDays,
  CheckSquare,
  Check,
  SkipForward,
  Clock,
  Plus,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { AppShell } from '../components/layout/AppShell';
import { SkeletonTable } from '../components/ui/Skeleton';
import { useToast } from '../components/ui/Toast';
import { useConfirm } from '../components/ui/ConfirmDialog';
import { useAuth } from '../contexts/AuthContext';
import { useProjectScope } from '../contexts/ProjectContext';
import { CreateTaskModal } from '../components/tasks/CreateTaskModal';
import {
  listMyTasks,
  markDone,
  skipTask,
  snoozeTask,
  type Task,
  type TaskType,
  type TaskPriority,
  type GroupedTasks,
  type TaskBucket,
} from '../data/tasks';
import {
  formatISTDateTime,
  relativeDueLabel,
  snoozeToISO,
  SNOOZE_OPTIONS,
} from '../components/tasks/taskScheduling';

const TABS: TaskBucket[] = ['Overdue', 'Today', 'Upcoming', 'Completed'];

const TYPE_META: Record<TaskType, { Icon: typeof Phone; label: string }> = {
  CALL: { Icon: Phone, label: 'Call' },
  MEETING: { Icon: CalendarDays, label: 'Meeting' },
  TODO: { Icon: CheckSquare, label: 'To-do' },
};

const PRIORITY_STYLE: Record<TaskPriority, { bg: string; fg: string; label: string }> = {
  HIGH: { bg: '#FEF2F2', fg: '#B91C1C', label: 'High' },
  NORMAL: { bg: '#EFF6FF', fg: '#1D4ED8', label: 'Normal' },
  LOW: { bg: '#F3F4F6', fg: '#6B7280', label: 'Low' },
};

function emptyGroups(): GroupedTasks {
  return { Overdue: [], Today: [], Upcoming: [], Completed: [] };
}

/* ------------------------------------------------------------------ */
/*  Small presentational bits                                           */
/* ------------------------------------------------------------------ */

function PriorityChip({ priority }: { priority: TaskPriority }) {
  const s = PRIORITY_STYLE[priority];
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 600,
        padding: '2px 8px',
        borderRadius: 999,
        background: s.bg,
        color: s.fg,
        whiteSpace: 'nowrap',
      }}
    >
      {s.label}
    </span>
  );
}

const iconBtn: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
  height: 28,
  padding: '0 10px',
  fontSize: 12,
  fontWeight: 500,
  borderRadius: 6,
  border: '1px solid #D1D5DB',
  background: '#fff',
  color: '#374151',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};

/* ------------------------------------------------------------------ */
/*  Snooze quick-menu                                                   */
/* ------------------------------------------------------------------ */

function SnoozeMenu({
  onPick,
  onClose,
}: {
  onPick: (iso: string) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      role="menu"
      style={{
        position: 'absolute',
        top: '100%',
        right: 0,
        marginTop: 4,
        background: '#fff',
        border: '1px solid #E5E7EB',
        borderRadius: 8,
        boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
        padding: 4,
        zIndex: 30,
        minWidth: 150,
      }}
    >
      {SNOOZE_OPTIONS.map((o) => (
        <button
          key={o.key}
          type="button"
          role="menuitem"
          onClick={() => onPick(snoozeToISO(o.key))}
          style={{
            display: 'block',
            width: '100%',
            textAlign: 'left',
            padding: '7px 10px',
            fontSize: 13,
            color: '#374151',
            background: 'transparent',
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
          }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = '#F3F4F6')}
          onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Task row                                                            */
/* ------------------------------------------------------------------ */

function TaskRow({
  task,
  busy,
  onDone,
  onSkip,
  onSnooze,
  onOpen,
}: {
  task: Task;
  busy: boolean;
  onDone: () => void;
  onSkip: () => void;
  onSnooze: (iso: string) => void;
  onOpen: () => void;
}) {
  const [snoozeOpen, setSnoozeOpen] = useState(false);
  const { Icon } = TYPE_META[task.task_type];
  const isCompleted = task.status === 'DONE' || task.status === 'SKIPPED';
  const isOverdue = task.status === 'OPEN' && new Date(task.due_at).getTime() < Date.now();
  const canOpen = task.lead_id != null || task.company_id != null || task.contact_id != null;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 16px',
        borderBottom: '1px solid var(--color-gray-100)',
        background: '#fff',
      }}
    >
      {/* Type icon */}
      <span
        aria-hidden="true"
        style={{
          flexShrink: 0,
          width: 30,
          height: 30,
          borderRadius: 8,
          background: 'var(--color-gray-100)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#6B7280',
        }}
      >
        <Icon size={15} />
      </span>

      {/* Subject + association — clickable to open the linked record */}
      <div
        role={canOpen ? 'button' : undefined}
        tabIndex={canOpen ? 0 : undefined}
        onClick={canOpen ? onOpen : undefined}
        onKeyDown={
          canOpen
            ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onOpen();
                }
              }
            : undefined
        }
        style={{
          flex: 1,
          minWidth: 0,
          cursor: canOpen ? 'pointer' : 'default',
        }}
      >
        <div
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: '#111827',
            textDecoration: task.status === 'DONE' ? 'line-through' : 'none',
            opacity: isCompleted ? 0.7 : 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {task.subject}
        </div>
        {(task.assoc_label || task.assoc_phone) && (
          <div
            style={{
              fontSize: 12,
              color: '#6B7280',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {task.assoc_label}
            {task.assoc_label && task.assoc_phone ? ' · ' : ''}
            {task.assoc_phone}
          </div>
        )}
      </div>

      {/* Priority */}
      <PriorityChip priority={task.priority} />

      {/* Due time + relative label */}
      <div style={{ flexShrink: 0, textAlign: 'right', minWidth: 120 }}>
        <div style={{ fontSize: 12, color: '#374151' }}>{formatISTDateTime(task.due_at)}</div>
        <div style={{ fontSize: 11, color: isOverdue ? '#B91C1C' : '#9CA3AF' }}>
          {relativeDueLabel(task.due_at)}
        </div>
      </div>

      {/* Quick actions (open tasks only) */}
      {!isCompleted && (
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6, position: 'relative' }}>
          <button type="button" style={iconBtn} disabled={busy} onClick={onDone} title="Mark done">
            <Check size={13} /> Done
          </button>
          <button type="button" style={iconBtn} disabled={busy} onClick={onSkip} title="Skip">
            <SkipForward size={13} /> Skip
          </button>
          <button
            type="button"
            style={iconBtn}
            disabled={busy}
            onClick={() => setSnoozeOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={snoozeOpen}
            title="Snooze"
          >
            <Clock size={13} /> Snooze
          </button>
          {snoozeOpen && (
            <SnoozeMenu
              onClose={() => setSnoozeOpen(false)}
              onPick={(iso) => {
                setSnoozeOpen(false);
                onSnooze(iso);
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                                */
/* ------------------------------------------------------------------ */

export function MyTasksPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const userId = profile?.user_id ?? null;

  // Global project scope (owner ask #8). When a project is selected we AND it
  // onto the displayed rows so My Tasks pre-filters by project.
  //
  // TODO(project-linkage): tasks have lead_id/company_id/contact_id/meeting_id
  // but NO direct project field — neither the `public.task` table nor the
  // data-layer projection (data/tasks.ts → TASK_COLUMNS / Task) carries a
  // project_id, and there is no reliable client-side join to derive one. Rather
  // than guess (a wrong filter would silently HIDE tasks), we intentionally do
  // not filter tasks by project yet. Follow-up: add a project linkage to tasks
  // (e.g. denormalised project_id on `task`, or join via the linked record) and
  // then compose it here exactly like the other list pages.
  const { selectedProjectId } = useProjectScope();

  const [groups, setGroups] = useState<GroupedTasks>(emptyGroups());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TaskBucket>('Overdue');
  const [createOpen, setCreateOpen] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { groups: g, error: e } = await listMyTasks(userId);
    setGroups(g);
    setError(e);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  const counts = useMemo(
    () => ({
      Overdue: groups.Overdue.length,
      Today: groups.Today.length,
      Upcoming: groups.Upcoming.length,
      Completed: groups.Completed.length,
    }),
    [groups],
  );

  // Displayed rows for the active bucket. This is the single composition point
  // for the global project scope: the project predicate is AND-ed on here, so it
  // stacks with the active-tab selection (and any future search/filter) instead
  // of replacing it, and is a pure no-op when "All projects" (selectedProjectId
  // === null) is selected — behaviour is then identical to before.
  const rows = useMemo(() => {
    const bucketRows = groups[activeTab];
    if (selectedProjectId == null) return bucketRows; // "All projects" → unchanged

    // NOTE: tasks carry no reliable project field (see TODO above), so we cannot
    // correctly narrow them by project without risking hiding valid rows. Until a
    // project linkage exists on `task`, leave the list unfiltered even when a
    // project is selected. Replace this pass-through with a real predicate once a
    // task→project field is available, e.g.:
    //   return bucketRows.filter((t) => t.project_id === selectedProjectId);
    return bucketRows;
  }, [groups, activeTab, selectedProjectId]);

  function openRecord(task: Task) {
    if (task.lead_id != null) navigate(`/leads/${task.lead_id}`);
    else if (task.company_id != null) navigate(`/companies/${task.company_id}`);
    else if (task.contact_id != null) navigate(`/contacts/${task.contact_id}`);
  }

  async function handleDone(task: Task) {
    setBusyId(task.task_id);
    const { error: e } = await markDone(task.task_id);
    setBusyId(null);
    if (e) {
      toast.error(e);
      return;
    }
    toast.success('Marked done');
    load();
  }

  async function handleSkip(task: Task) {
    const ok = await confirm({
      title: 'Skip this task?',
      message: 'It will move to Completed and stop reminding you.',
      confirmLabel: 'Skip task',
    });
    if (!ok) return;
    setBusyId(task.task_id);
    const { error: e } = await skipTask(task.task_id);
    setBusyId(null);
    if (e) {
      toast.error(e);
      return;
    }
    toast.success('Task skipped');
    load();
  }

  async function handleSnooze(task: Task, iso: string) {
    setBusyId(task.task_id);
    const { error: e } = await snoozeTask(task.task_id, iso);
    setBusyId(null);
    if (e) {
      toast.error(e);
      return;
    }
    toast.success('Snoozed');
    load();
  }

  return (
    <AppShell title="My Tasks">
      <div style={{ maxWidth: 980, margin: '0 auto' }}>
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 16,
          }}
        >
          <h1 style={{ fontSize: 20, fontWeight: 600, color: '#111827', margin: 0 }}>My Tasks</h1>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: '#1A7EE8',
              color: '#fff',
              fontSize: 13,
              fontWeight: 500,
              borderRadius: 6,
              padding: '8px 14px',
              border: 'none',
              cursor: 'pointer',
              height: 36,
            }}
          >
            <Plus size={15} /> New task
          </button>
        </div>

        {/* Tabs */}
        <div
          role="tablist"
          aria-label="Task buckets"
          style={{
            display: 'flex',
            gap: 4,
            borderBottom: '1px solid var(--color-gray-200, #E5E7EB)',
            marginBottom: 12,
          }}
        >
          {TABS.map((tab) => {
            const active = tab === activeTab;
            const danger = tab === 'Overdue' && counts.Overdue > 0;
            return (
              <button
                key={tab}
                role="tab"
                aria-selected={active}
                type="button"
                onClick={() => setActiveTab(tab)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 14px',
                  fontSize: 13,
                  fontWeight: active ? 600 : 500,
                  color: active ? '#1A7EE8' : danger ? '#B91C1C' : '#6B7280',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: active ? '2px solid #1A7EE8' : '2px solid transparent',
                  cursor: 'pointer',
                  marginBottom: -1,
                }}
              >
                {tab}
                <span
                  style={{
                    minWidth: 18,
                    height: 18,
                    borderRadius: 9,
                    padding: '0 5px',
                    fontSize: 11,
                    fontWeight: 700,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: danger ? '#FEE2E2' : 'var(--color-gray-100, #F3F4F6)',
                    color: danger ? '#B91C1C' : '#6B7280',
                  }}
                >
                  {counts[tab]}
                </span>
              </button>
            );
          })}
        </div>

        {/* Body */}
        {loading ? (
          <SkeletonTable rows={6} cols={4} />
        ) : error ? (
          <div
            role="alert"
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 10,
              padding: '48px 16px',
              border: '1px solid #FECACA',
              borderRadius: 'var(--radius-card, 10px)',
              background: '#FEF2F2',
              color: '#B91C1C',
            }}
          >
            <AlertCircle size={22} />
            <div style={{ fontSize: 14, fontWeight: 500 }}>Could not load your tasks</div>
            <div style={{ fontSize: 12, color: '#9B1C1C', textAlign: 'center', maxWidth: 420 }}>
              {error}
            </div>
            <button
              type="button"
              onClick={load}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                marginTop: 4,
                height: 32,
                padding: '0 14px',
                borderRadius: 6,
                border: '1px solid #FCA5A5',
                background: '#fff',
                color: '#B91C1C',
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              <RefreshCw size={14} /> Retry
            </button>
          </div>
        ) : rows.length === 0 ? (
          <div
            style={{
              padding: '56px 16px',
              textAlign: 'center',
              border: '1px solid var(--color-gray-200, #E5E7EB)',
              borderRadius: 'var(--radius-card, 10px)',
              background: '#fff',
              color: '#6B7280',
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 500, color: '#374151' }}>
              {activeTab === 'Overdue'
                ? 'No tasks due — nice and clear!'
                : activeTab === 'Completed'
                  ? 'Nothing completed yet.'
                  : `No ${activeTab.toLowerCase()} tasks.`}
            </div>
            {activeTab !== 'Completed' && (
              <div style={{ fontSize: 12, marginTop: 4 }}>
                Use “New task” to add a follow-up reminder.
              </div>
            )}
          </div>
        ) : (
          <div
            style={{
              border: '1px solid var(--color-gray-200, #E5E7EB)',
              borderRadius: 'var(--radius-card, 10px)',
              overflow: 'hidden',
              background: '#fff',
            }}
          >
            {rows.map((task) => (
              <TaskRow
                key={task.task_id}
                task={task}
                busy={busyId === task.task_id}
                onDone={() => handleDone(task)}
                onSkip={() => handleSkip(task)}
                onSnooze={(iso) => handleSnooze(task, iso)}
                onOpen={() => openRecord(task)}
              />
            ))}
          </div>
        )}
      </div>

      <CreateTaskModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => {
          setCreateOpen(false);
          load();
        }}
      />
    </AppShell>
  );
}

export default MyTasksPage;
