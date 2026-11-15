'use client';

import { useId, useState } from 'react';
import { FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { projectFiles, type ProjectFile, type ProjectFileChange } from './project-files-storage';

interface ProjectFilesProps {
  readonly userId: string;
  readonly agentId: string;
  readonly agentName: string;
}

function download(file: File) {
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = file.name;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function ProjectFiles({ userId, agentId, agentName }: ProjectFilesProps) {
  const inputId = useId();
  const [files, setFiles] = useState<readonly ProjectFile[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [removing, setRemoving] = useState<string | null>(null);

  async function update(change: ProjectFileChange) {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      setFiles(await projectFiles(userId, agentId, change));
      setRemoving(null);
    } catch {
      setError(change.kind === 'list'
        ? 'Could not load files. Check browser storage and try again.'
        : 'Could not update files. Check available browser storage and try again.');
    } finally {
      setBusy(false);
    }
  }

  return <Dialog onOpenChange={(open) => {
    if (open) void update({ kind: 'list' });
    else setRemoving(null);
  }}>
    <DialogTrigger asChild>
      <Button variant="ghost" className="px-2"><FileText aria-hidden="true" />Project files</Button>
    </DialogTrigger>
    <DialogContent>
      <DialogHeader>
        <DialogTitle className="[overflow-wrap:anywhere]">{agentName} project files</DialogTitle>
        <DialogDescription>Files you add are saved for this account and agent in this browser. The agent uses its configured knowledge sources when you run it.</DialogDescription>
      </DialogHeader>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {busy && <p role="status" className="text-sm text-muted-foreground">Updating project files…</p>}
      {files === null && error && <div><Button variant="secondary" onClick={() => void update({ kind: 'list' })}>Retry</Button></div>}
      {files !== null && <>
        <div className="space-y-1">
          <label htmlFor={inputId} className="text-sm font-semibold">Add files</label>
          <Input id={inputId} type="file" multiple disabled={busy} className="h-auto py-2" onChange={(event) => {
            const selected = Array.from(event.currentTarget.files ?? []);
            event.currentTarget.value = '';
            if (selected.length) void update({ kind: 'add', files: selected });
          }} />
        </div>
        {files.length === 0 ? <p className="text-sm text-muted-foreground">No project files yet.</p> :
          <ul className="divide-y divide-border rounded-md border border-border">
            {files.map(({ id, file }) => <li key={id} className="space-y-2 p-3">
              <p className="text-sm font-semibold [overflow-wrap:anywhere]">{file.name}</p>
              {removing === id ? <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm">Remove this file?</span>
                <Button size="sm" variant="secondary" onClick={() => setRemoving(null)}>Cancel</Button>
                <Button size="sm" variant="outline" disabled={busy} onClick={() => void update({ kind: 'remove', id })}>Remove file</Button>
              </div> : <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" aria-label={`Download ${file.name}`} onClick={() => download(file)}>Download</Button>
                <Button size="sm" variant="ghost" disabled={busy} aria-label={`Remove ${file.name}`} onClick={() => setRemoving(id)}>Remove</Button>
              </div>}
            </li>)}
          </ul>}
      </>}
    </DialogContent>
  </Dialog>;
}
