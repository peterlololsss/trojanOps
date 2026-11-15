'use client';

import { useId, useState, type FormEvent } from 'react';
import { Folder, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { RailAgent } from './groups';
import { projectFields, readProjects, saveProjects, type Project } from './project-storage';

interface ProjectsProps {
  readonly userId: string;
  readonly agents?: readonly RailAgent[];
  readonly selectedId?: string | null;
  readonly onOpenAgent?: (agent: RailAgent) => void;
}

export function Projects({ userId, agents = [], selectedId = null, onOpenAgent }: ProjectsProps) {
  const fieldId = useId();
  const [open, setOpen] = useState(false);
  const [projects, setProjects] = useState<readonly Project[]>([]);
  const [editor, setEditor] = useState<Project | 'new' | null>(null);
  const [error, setError] = useState('');
  const [readable, setReadable] = useState(false);
  const [status, setStatus] = useState('');
  const current = editor === 'new' ? null : editor;
  const initialAgentId = editor === 'new' ? selectedId : current?.agentId;
  const unavailable = initialAgentId && !agents.some((agent) => agent.installationId === initialAgentId);

  function changeOpen(next: boolean) {
    setOpen(next);
    if (!next) return;
    setEditor(null);
    setError('');
    setStatus('');
    try {
      setProjects(readProjects(localStorage, userId));
      setReadable(true);
    } catch {
      setProjects([]);
      setReadable(false);
      setError('Could not load projects. Check your browser storage settings and reopen Projects.');
    }
  }

  function saveProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const result = projectFields.safeParse({
      name: form.get('name'),
      notes: form.get('notes'),
      agentId: form.get('agent') || null,
    });
    if (!result.success) {
      setError('Enter a project name and keep notes within 4,000 characters.');
      return;
    }
    try {
      const project = { ...result.data, id: current?.id ?? crypto.randomUUID() };
      setProjects(saveProjects(localStorage, userId, project));
      setEditor(null);
      setError('');
      setStatus(`${project.name} saved.`);
    } catch {
      setError('Could not save the project. Check your browser storage settings and try again.');
    }
  }

  return <Dialog open={open} onOpenChange={changeOpen}>
    <DialogTrigger asChild>
      <Button variant="ghost" className="gap-2 px-2"><Folder aria-hidden="true" />Projects</Button>
    </DialogTrigger>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>{editor === 'new' ? 'New project' : editor ? 'Edit project' : 'Projects'}</DialogTitle>
        <DialogDescription>Projects are saved for this account in this browser. Notes stay here when you open an agent.</DialogDescription>
      </DialogHeader>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {editor ? <form onSubmit={saveProject} className="space-y-4">
        <div className="space-y-1">
          <label htmlFor={`${fieldId}-name`} className="text-sm font-semibold">Project name</label>
          <Input id={`${fieldId}-name`} name="name" defaultValue={current?.name} required maxLength={80} />
        </div>
        <div className="space-y-1">
          <label htmlFor={`${fieldId}-agent`} className="text-sm font-semibold">Agent</label>
          <select id={`${fieldId}-agent`} name="agent" defaultValue={initialAgentId ?? ''} className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm">
            <option value="">No agent</option>
            {unavailable && <option value={initialAgentId}>Agent unavailable</option>}
            {agents.map((agent) => <option key={agent.installationId} value={agent.installationId}>{agent.name} · {agent.orgName}</option>)}
          </select>
        </div>
        <div className="space-y-1">
          <label htmlFor={`${fieldId}-notes`} className="text-sm font-semibold">Notes</label>
          <Textarea id={`${fieldId}-notes`} name="notes" defaultValue={current?.notes} maxLength={4000} />
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => { setEditor(null); setError(''); }}>Cancel</Button>
          <Button type="submit">Save project</Button>
        </DialogFooter>
      </form> : readable && <>
        <p role="status" className="sr-only">{status}</p>
        {projects.length === 0 ? <p className="text-sm text-muted-foreground">No projects yet. Create one to keep notes and an agent together.</p> :
          <ul className="divide-y divide-border rounded-md border border-border">
            {projects.map((project) => {
              const agent = agents.find((item) => item.installationId === project.agentId);
              return <li key={project.id} className="flex flex-wrap items-center justify-between gap-2 p-3">
                <Button variant="ghost" className="h-auto min-h-9 min-w-0 max-w-full flex-1 justify-start whitespace-normal px-2 py-1 text-left [overflow-wrap:anywhere]"
                  onClick={() => { setEditor(project); setStatus(''); }}>{project.name}</Button>
                {agent && onOpenAgent && <Button variant="secondary" size="sm" aria-label={`Open ${agent.name} for ${project.name}`} onClick={() => {
                  changeOpen(false);
                  onOpenAgent(agent);
                }}>Open agent</Button>}
                {project.agentId && !agent && <span className="text-xs text-muted-foreground">Agent unavailable</span>}
              </li>;
            })}
          </ul>}
        <DialogFooter>
          <Button onClick={() => { setEditor('new'); setStatus(''); }}><Plus aria-hidden="true" />New project</Button>
        </DialogFooter>
      </>}
    </DialogContent>
  </Dialog>;
}
