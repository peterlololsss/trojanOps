import { z } from 'zod';

export const projectFields = z.object({
  name: z.string().trim().min(1).max(80),
  notes: z.string().trim().max(4000),
  agentId: z.string().min(1).nullable(),
});

const storedProjects = z.array(projectFields.extend({ id: z.string().min(1) }));
export type Project = Readonly<z.infer<typeof storedProjects>[number]>;

function projectKey(userId: string): string {
  return `trojanops:projects:v1:${userId}`;
}

export function readProjects(storage: Pick<Storage, 'getItem'>, userId: string): readonly Project[] {
  return storedProjects.parse(JSON.parse(storage.getItem(projectKey(userId)) ?? '[]'));
}

export function saveProjects(storage: Pick<Storage, 'getItem' | 'setItem'>, userId: string, project: Project): readonly Project[] {
  const projects = readProjects(storage, userId);
  const updated = projects.some((item) => item.id === project.id)
    ? projects.map((item) => item.id === project.id ? project : item)
    : [project, ...projects];
  storage.setItem(projectKey(userId), JSON.stringify(updated));
  return updated;
}
