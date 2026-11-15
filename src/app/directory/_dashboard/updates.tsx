// Owner: D (WP-11). Recent updates: who posted (a person, or the club itself), the department, the
// absolute time in Pacific time, and the text.
import { Avatar } from '@/components/ui/avatar';
import type { DirectoryUpdate } from '@/lib/directory/types';
import { count, initials, postedTime } from '@/lib/directory/view';
import { InitialsTile } from './header';
import { Empty, Panel, ViewAll } from './parts';

export function UpdatesList({ updates, clubName }: { updates: readonly DirectoryUpdate[]; clubName: string }) {
  return (
    <ol>
      {updates.map((u) => (
        <li key={u.id} className="flex gap-3 border-b border-border py-3 last:border-b-0">
          {u.author ? <Avatar size="sm" initials={initials(u.author)} /> : <InitialsTile name={clubName} size="sm" />}
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-baseline gap-x-2">
              <span className="font-semibold">{u.author ?? clubName}</span>
              {u.department && <span className="text-muted-foreground">{u.department}</span>}
              <time dateTime={u.postedAt} className="font-mono text-xs text-muted-foreground">{postedTime(u.postedAt)}</time>
            </p>
            <p className="mt-1 max-w-prose [overflow-wrap:anywhere]">{u.text}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

/** The About tab's "Recent updates" panel: the latest few, and "View all" when there are more. */
export function UpdatesPanel({ updates, clubName, showAll, allHref, limit = 3 }: {
  updates: readonly DirectoryUpdate[];
  clubName: string;
  showAll: boolean;
  allHref: string;
  limit?: number;
}) {
  const sorted = [...updates].sort((a, b) => b.postedAt.localeCompare(a.postedAt));
  const shown = showAll ? sorted : sorted.slice(0, limit);
  const hidden = sorted.length - shown.length;
  return (
    <Panel id="recent-updates" title="Recent updates"
      action={hidden > 0 ? <ViewAll href={allHref}>{`View all ${count(sorted.length, 'update')}`}</ViewAll> : undefined}>
      {shown.length > 0 ? <UpdatesList updates={shown} clubName={clubName} /> : <Empty>No updates yet.</Empty>}
    </Panel>
  );
}
