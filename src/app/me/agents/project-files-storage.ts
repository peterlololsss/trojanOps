export interface ProjectFile {
  readonly id: string;
  readonly file: File;
}

export type ProjectFileChange =
  | { readonly kind: 'list' }
  | { readonly kind: 'add'; readonly files: readonly File[] }
  | { readonly kind: 'remove'; readonly id: string };

export async function projectFiles(userId: string, agentId: string, change: ProjectFileChange): Promise<readonly ProjectFile[]> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('trojanops-project-files', 1);
    request.onupgradeneeded = () => {
      const store = request.result.createObjectStore('files', { keyPath: ['userId', 'agentId', 'id'] });
      store.createIndex('scope', ['userId', 'agentId']);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  try {
    return await new Promise<readonly ProjectFile[]>((resolve, reject) => {
      const transaction = db.transaction('files', change.kind === 'list' ? 'readonly' : 'readwrite');
      const store = transaction.objectStore('files');
      if (change.kind === 'add') {
        for (const file of change.files) store.add({ userId, agentId, id: crypto.randomUUID(), file });
      }
      if (change.kind === 'remove') store.delete([userId, agentId, change.id]);

      const request: IDBRequest<ProjectFile[]> = store.index('scope').getAll([userId, agentId]);
      transaction.oncomplete = () => resolve(request.result);
      transaction.onabort = () => reject(transaction.error);
    });
  } finally {
    db.close();
  }
}
