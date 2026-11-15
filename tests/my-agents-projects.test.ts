import { describe, expect, it } from 'vitest';
import { projectFields, readProjects, saveProjects } from '../src/app/me/agents/project-storage';

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
  };
}

const project = { id: 'p1', name: 'Recruiting week', notes: 'Draft the agenda', agentId: 'a1' };

describe('My agents projects', () => {
  it('keeps projects scoped to the account, including when reopening the workspace', () => {
    const storage = memoryStorage();
    saveProjects(storage, 'casey', project);
    saveProjects(storage, 'lee', { ...project, notes: 'Lee’s notes', agentId: null });

    expect(readProjects(storage, 'casey')).toEqual([project]);
    expect(readProjects(storage, 'lee')).toEqual([{ ...project, notes: 'Lee’s notes', agentId: null }]);
    expect(readProjects(storage, 'taylor')).toEqual([]);
  });

  it('updates a project without dropping other saved projects', () => {
    const storage = memoryStorage();
    const second = { ...project, id: 'p2', name: 'Club showcase' };
    saveProjects(storage, 'casey', project);
    saveProjects(storage, 'casey', second);
    const edited = { ...project, notes: 'Agenda ready', agentId: null };
    saveProjects(storage, 'casey', edited);

    expect(readProjects(storage, 'casey')).toEqual([second, edited]);
  });

  it('trims project names and rejects blank names', () => {
    expect(projectFields.parse({ ...project, name: ' Recruiting week ' }).name).toBe(project.name);
    expect(projectFields.safeParse({ ...project, name: '  ' }).success).toBe(false);
  });
});
