import React, { useEffect, useMemo, useState } from 'react';
import { Search, Loader2 } from 'lucide-react';
import {
  fetchUsers,
  setUserEnabled,
  setUserRoles,
  type AdminUser,
  type AdminLookups,
} from '../../data/admin';
import {
  Card,
  FigmaTableHead,
  LoadingRow,
  EmptyRow,
  ErrorRow,
  StatusToggle,
  RoleChip,
  Avatar,
  AddButton,
  EditIconButton,
} from './primitives';
import { Modal, Field, PrimaryButton, GhostButton } from './Modal';

const PAGE_SIZE = 20;

export function UsersTab({ lookups, actorId }: { lookups: AdminLookups; actorId: string }) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [busyUserId, setBusyUserId] = useState<number | null>(null);

  const [editUser, setEditUser] = useState<AdminUser | null>(null);
  const [editRoleIds, setEditRoleIds] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Web-assignable roles only (is_web). Non-web roles (SALES_HEAD, SALES_PERSON)
  // are kept out of the picker but still shown if a user already has them.
  const webRoles = useMemo(() => lookups.roles.filter((r) => r.is_web), [lookups.roles]);

  const load = async () => {
    setLoading(true);
    const res = await fetchUsers(lookups.roles);
    setUsers(res.users);
    setError(res.error);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) =>
      [u.full_name, u.email, u.designation, ...u.roleNames].join(' ').toLowerCase().includes(q)
    );
  }, [users, search]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  const handleToggle = async (u: AdminUser) => {
    setBusyUserId(u.user_id);
    const err = await setUserEnabled(u.user_id, !u.enabled, actorId);
    if (!err) {
      setUsers((prev) =>
        prev.map((x) => (x.user_id === u.user_id ? { ...x, enabled: !u.enabled } : x))
      );
    }
    setBusyUserId(null);
  };

  const openEdit = (u: AdminUser) => {
    setEditUser(u);
    setEditRoleIds(new Set(u.roleIds));
    setSaveError(null);
  };

  const toggleRole = (roleId: number) => {
    setEditRoleIds((prev) => {
      const next = new Set(prev);
      if (next.has(roleId)) next.delete(roleId);
      else next.add(roleId);
      return next;
    });
  };

  const handleSaveRole = async () => {
    if (!editUser) return;
    const nextIds = [...editRoleIds];
    setSaving(true);
    setSaveError(null);
    const err = await setUserRoles(editUser.user_id, nextIds, actorId);
    if (err) {
      setSaveError(err);
      setSaving(false);
      return;
    }
    const roleNameMap = new Map(lookups.roles.map((r) => [r.role_id, r.name]));
    const nextNames = nextIds.map((id) => roleNameMap.get(id) ?? '').filter(Boolean);
    setUsers((prev) =>
      prev.map((x) =>
        x.user_id === editUser.user_id ? { ...x, roleIds: nextIds, roleNames: nextNames } : x
      )
    );
    setSaving(false);
    setEditUser(null);
  };

  const columns = [
    { key: 'sr',          label: 'Sr. No.',    width: 64 },
    { key: 'name',        label: 'Name' },
    { key: 'email',       label: 'Email' },
    { key: 'designation', label: 'Designation' },
    { key: 'roles',       label: 'Roles' },
    { key: 'status',      label: 'Status',      width: 120 },
    { key: 'actions',     label: 'Edit',        align: 'right' as const, width: 60 },
  ];

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 4 }}>
        {/* Search */}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <Search
            size={13}
            style={{ position: 'absolute', left: 10, color: '#9CA3AF', pointerEvents: 'none' }}
          />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            placeholder="Search users..."
            style={{
              fontSize: 13,
              paddingLeft: 30,
              paddingRight: 10,
              paddingTop: 6,
              paddingBottom: 6,
              border: '1px solid #D1D5DB',
              borderRadius: 6,
              background: '#fff',
              color: '#374151',
              outline: 'none',
              height: 34,
              width: 240,
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = '#1A7EE8'; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = '#D1D5DB'; }}
          />
        </div>

        <AddButton label="Add User" onClick={() => {}} />
      </div>

      {/* Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="w-full">
            <FigmaTableHead columns={columns} />
            <tbody>
              {loading ? (
                <LoadingRow colSpan={columns.length} label="Loading users..." />
              ) : error ? (
                <ErrorRow colSpan={columns.length} label={error} />
              ) : pageRows.length === 0 ? (
                <EmptyRow colSpan={columns.length} label="No users match your search." />
              ) : (
                pageRows.map((u, idx) => (
                  <tr
                    key={u.user_id}
                    style={{
                      borderBottom: '1px solid #F3F4F6',
                      height: 44,
                      transition: 'background 0.12s',
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = '#F9FAFB'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.background = ''; }}
                  >
                    {/* Sr. No. */}
                    <td
                      style={{
                        padding: '0 12px',
                        fontSize: 13,
                        color: '#6B7280',
                        verticalAlign: 'middle',
                        textAlign: 'center',
                      }}
                    >
                      {safePage * PAGE_SIZE + idx + 1}
                    </td>

                    {/* Name */}
                    <td style={{ padding: '0 16px', verticalAlign: 'middle' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                        <Avatar name={u.full_name} />
                        <span style={{ fontSize: 13, fontWeight: 500, color: '#111827' }}>
                          {u.full_name || <span style={{ color: '#D1D5DB' }}>—</span>}
                        </span>
                      </div>
                    </td>

                    {/* Email */}
                    <td style={{ padding: '0 16px', fontSize: 13, color: '#374151', verticalAlign: 'middle' }}>
                      {u.email || <span style={{ color: '#D1D5DB' }}>—</span>}
                    </td>

                    {/* Designation */}
                    <td style={{ padding: '0 16px', fontSize: 13, color: '#374151', verticalAlign: 'middle' }}>
                      {u.designation || <span style={{ color: '#D1D5DB' }}>—</span>}
                    </td>

                    {/* Roles */}
                    <td style={{ padding: '0 16px', verticalAlign: 'middle' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {u.roleNames.length > 0 ? (
                          u.roleNames.map((r) => <RoleChip key={r} label={r} />)
                        ) : (
                          <span style={{ color: '#D1D5DB', fontSize: 13 }}>—</span>
                        )}
                      </div>
                    </td>

                    {/* Status toggle */}
                    <td style={{ padding: '0 16px', verticalAlign: 'middle' }}>
                      <StatusToggle
                        enabled={u.enabled}
                        busy={busyUserId === u.user_id}
                        onToggle={() => handleToggle(u)}
                      />
                    </td>

                    {/* Edit */}
                    <td style={{ padding: '0 16px', verticalAlign: 'middle', textAlign: 'right' }}>
                      <EditIconButton onClick={() => openEdit(u)} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Pagination */}
      {!loading && !error && filtered.length > PAGE_SIZE && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: 8,
          }}
        >
          <p style={{ fontSize: 12, color: '#9CA3AF' }}>
            Page {safePage + 1} of {pageCount}
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <GhostButton
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={safePage === 0}
            >
              Previous
            </GhostButton>
            <GhostButton
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              disabled={safePage >= pageCount - 1}
            >
              Next
            </GhostButton>
          </div>
        </div>
      )}

      {/* Edit roles modal */}
      <Modal
        open={!!editUser}
        title={editUser ? `Edit roles — ${editUser.full_name}` : 'Edit roles'}
        onClose={() => setEditUser(null)}
        footer={
          <>
            <GhostButton onClick={() => setEditUser(null)} disabled={saving}>
              Cancel
            </GhostButton>
            <PrimaryButton onClick={handleSaveRole} disabled={saving}>
              {saving && <Loader2 size={13} className="animate-spin" />}
              Save
            </PrimaryButton>
          </>
        }
      >
        {editUser && (() => {
          // Show every web-assignable role, plus any non-web role the user already
          // holds (so it's visible and can be intentionally removed, never silently lost).
          const ids = new Set(webRoles.map((r) => r.role_id));
          const extras = editUser.roleIds
            .filter((id) => !ids.has(id))
            .map((id) => lookups.roles.find((r) => r.role_id === id))
            .filter((r): r is NonNullable<typeof r> => !!r);
          const roleOptions = [...webRoles, ...extras];
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* User info */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 12px',
                  background: '#F9FAFB',
                  borderRadius: 6,
                  border: '1px solid #F3F4F6',
                }}
              >
                <Avatar name={editUser.full_name} size={32} />
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: '#111827', margin: 0 }}>
                    {editUser.full_name}
                  </p>
                  <p style={{ fontSize: 12, color: '#6B7280', margin: 0 }}>{editUser.email}</p>
                </div>
              </div>

              {/* Role checkboxes */}
              <Field label="Roles">
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                    padding: '10px 12px',
                    border: '1px solid #E5E7EB',
                    borderRadius: 6,
                    background: '#fff',
                  }}
                >
                  {roleOptions.map((r) => {
                    const checked = editRoleIds.has(r.role_id);
                    const nonWeb = !r.is_web;
                    return (
                      <label
                        key={r.role_id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          fontSize: 13,
                          cursor: 'pointer',
                          userSelect: 'none',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleRole(r.role_id)}
                          style={{ accentColor: '#1A7EE8', width: 14, height: 14, flexShrink: 0 }}
                        />
                        <span style={{ color: '#374151' }}>{r.name}</span>
                        {nonWeb && (
                          <span style={{ fontSize: 10, color: '#9CA3AF' }}>(non-web)</span>
                        )}
                      </label>
                    );
                  })}
                </div>
              </Field>

              <p style={{ fontSize: 11, color: '#9CA3AF', margin: 0 }}>
                Tick every role this user should have. Unticked roles are removed; the user's
                other roles are preserved.
              </p>

              {saveError && (
                <p style={{ fontSize: 12, color: '#EF4444', margin: 0 }}>{saveError}</p>
              )}
            </div>
          );
        })()}
      </Modal>
    </div>
  );
}
