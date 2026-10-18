import { useEffect, useState } from 'preact/hooks';
import { adminTasksApi, type AdminTask, type AdminTaskKind, type AdminTaskStatus, type TaskAssignee } from '../api/adminTasks.api';
import { useAuthContext } from '../context/AuthContext';
import './AdminTasksPage.css';

const statuses: { value: AdminTaskStatus; label: string }[] = [
  { value: 'pending', label: 'To do' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'rejected', label: 'Rejected' },
];

export default function AdminTasksPage() {
  const { user } = useAuthContext();
  const [tasks, setTasks] = useState<AdminTask[]>([]);
  const [assignees, setAssignees] = useState<TaskAssignee[]>([]);
  const [assigneesLoading, setAssigneesLoading] = useState(true);
  const [assigneeId, setAssigneeId] = useState(user?.userId || '');
  const [filter, setFilter] = useState<AdminTaskStatus | 'all'>('all');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [kind, setKind] = useState<AdminTaskKind>('task');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [listError, setListError] = useState('');
  const [assigneesError, setAssigneesError] = useState('');

  const loadTasks = async () => {
    setLoading(true);
    setListError('');
    try {
      setTasks(await adminTasksApi.list());
    } catch (err: any) {
      setListError(err.message || 'Could not load items');
    } finally {
      setLoading(false);
    }
  };

  const loadAssignees = async () => {
    setAssigneesLoading(true);
    setAssigneesError('');
    try {
      setAssignees(await adminTasksApi.assignees());
    } catch (err: any) {
      setAssigneesError(err.message || 'Could not load admins');
    } finally {
      setAssigneesLoading(false);
    }
  };

  useEffect(() => {
    document.title = 'Tasks | FluentXVerse Admin';
    void loadTasks();
    void loadAssignees();
  }, []);

  useEffect(() => {
    if (user?.userId) setAssigneeId(user.userId);
  }, [user?.userId]);

  const assigneeLabel = (admin: TaskAssignee) => {
    const name = [admin.firstName, admin.lastName].filter(Boolean).join(' ');
    return `${name || admin.username}${admin.id === user?.userId ? ' (You)' : ''}`;
  };

  const createTask = async (event: Event) => {
    event.preventDefault();
    if (!title.trim() || !assigneeId) return;
    setSaving(true);
    setError('');
    try {
      const task = await adminTasksApi.create({ title: title.trim(), description: description.trim(), kind, assigneeId });
      setTasks(previous => [task, ...previous]);
      setTitle('');
      setDescription('');
      setFilter('all');
    } catch (err: any) {
      setError(err.message || 'Could not add item');
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (task: AdminTask, status: AdminTaskStatus) => {
    if (status === task.status) return;
    setUpdatingId(task.id);
    setError('');
    try {
      const updated = await adminTasksApi.updateStatus(task.id, status);
      setTasks(previous => previous.map(item => item.id === task.id ? updated : item));
    } catch (err: any) {
      setError(err.message || 'Could not update status');
    } finally {
      setUpdatingId(null);
    }
  };

  const changeAssignee = async (task: AdminTask, nextAssigneeId: string) => {
    if (nextAssigneeId === task.assignee_id) return;
    setUpdatingId(task.id);
    setError('');
    try {
      const updated = await adminTasksApi.assign(task.id, nextAssigneeId);
      setTasks(previous => previous.map(item => item.id === task.id ? updated : item));
    } catch (err: any) {
      setError(err.message || 'Could not assign item');
    } finally {
      setUpdatingId(null);
    }
  };

  const visible = filter === 'all' ? tasks : tasks.filter(task => task.status === filter);

  return <div className="admin-tasks-page">
    <header className="admin-tasks-header">
      <div>
        <h1>Tasks & Suggestions</h1>
        <p>Shared work queue for the admin team.</p>
      </div>
      <span className="admin-tasks-count">{tasks.filter(task => task.status === 'pending' || task.status === 'in_progress').length} active</span>
    </header>

    <form className="admin-tasks-form" onSubmit={createTask}>
      <div className="admin-tasks-form-heading"><i className="ri-add-circle-line" aria-hidden="true"/><h2>Add an item</h2></div>
      <div className="admin-tasks-fields">
        <label>Title<input value={title} onInput={event => setTitle(event.currentTarget.value)} maxLength={200} required placeholder="What needs attention?" /></label>
        <label>Type<select value={kind} onChange={event => setKind(event.currentTarget.value as AdminTaskKind)}><option value="task">Task</option><option value="suggestion">Suggestion</option></select></label>
        <label>Assign to<select value={assigneeId} onChange={event => setAssigneeId(event.currentTarget.value)} disabled={assigneesLoading || assignees.length === 0} required>
          {assigneesLoading && <option value="">Loading admins...</option>}
          {!assigneesLoading && assignees.length === 0 && <option value="">No admins available</option>}
          {assignees.map(admin => <option key={admin.id} value={admin.id}>{assigneeLabel(admin)}</option>)}
        </select></label>
      </div>
      <label>Details <span>(optional)</span><textarea value={description} onInput={event => setDescription(event.currentTarget.value)} maxLength={5000} rows={3} placeholder="Add context or acceptance criteria" /></label>
      <div className="admin-tasks-form-actions"><button type="submit" disabled={saving || !title.trim() || assigneesLoading || !assignees.some(admin => admin.id === assigneeId)}><i className="ri-add-line" aria-hidden="true"/> {saving ? 'Adding...' : 'Add item'}</button></div>
      {assigneesError && <div className="admin-tasks-error" role="alert">Could not load assignees: {assigneesError} <button type="button" onClick={loadAssignees}>Retry</button></div>}
    </form>

    <section className="admin-tasks-list" aria-label="Tasks and suggestions">
      <div className="admin-tasks-list-head"><h2>Work queue</h2><div className="admin-tasks-filters" role="group" aria-label="Filter by status">
        <button type="button" className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>All <span>{tasks.length}</span></button>
        {statuses.map(status => <button type="button" key={status.value} className={filter === status.value ? 'active' : ''} onClick={() => setFilter(status.value)}>{status.label} <span>{tasks.filter(task => task.status === status.value).length}</span></button>)}
      </div></div>
      {error && <div className="admin-tasks-error" role="alert">{error}</div>}
      {loading ? <div className="admin-tasks-empty">Loading items...</div> : listError ? <div className="admin-tasks-error" role="alert">Could not load items: {listError} <button type="button" onClick={loadTasks}>Retry</button></div> : visible.length === 0 ? <div className="admin-tasks-empty">No items in this view.</div> :
        <div className="admin-tasks-rows">{visible.map(task => <article className="admin-task-row" key={task.id}>
          <div className="admin-task-main"><div className="admin-task-title"><span className={`admin-task-kind ${task.kind}`}>{task.kind}</span><h3>{task.title}</h3></div>{task.description && <p>{task.description}</p>}<small>Added {new Date(task.created_at).toLocaleString()}</small></div>
          <div className="admin-task-controls">
            <label className="admin-task-status-label">Assign to<select aria-label={`Assignee for ${task.title}`} value={task.assignee_id || ''} disabled={updatingId === task.id || assigneesLoading || assignees.length === 0} onChange={event => changeAssignee(task, event.currentTarget.value)}>
              {task.assignee_id && !assignees.some(admin => admin.id === task.assignee_id) && <option value={task.assignee_id}>Former admin</option>}
              {assignees.map(admin => <option key={admin.id} value={admin.id}>{assigneeLabel(admin)}</option>)}
            </select></label>
            <label className="admin-task-status-label">Status<select aria-label={`Status for ${task.title}`} className={`admin-task-status ${task.status}`} value={task.status} disabled={updatingId === task.id} onChange={event => changeStatus(task, event.currentTarget.value as AdminTaskStatus)}>{statuses.map(status => <option key={status.value} value={status.value}>{status.label}</option>)}</select></label>
          </div>
        </article>)}</div>}
    </section>
  </div>;
}
