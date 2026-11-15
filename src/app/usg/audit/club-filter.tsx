// The USG audit view's club filter: a plain GET form, because the server loads one club's rows
// (`?club=<orgId>`). Choosing a club resets the table's other filters.
import { Button } from '@/components/ui/button';
import { fieldClass } from '@/components/inspector/field';

export function ClubFilter({ clubs, selected }: { clubs: Array<{ id: string; name: string }>; selected: string | null }) {
  return (
    <form action="/usg/audit" method="get" className="flex items-end gap-2">
      <label className="w-56 space-y-1">
        <span className="block font-semibold">Club</span>
        <select key={selected ?? ''} name="club" defaultValue={selected ?? ''} className={fieldClass}>
          <option value="">All clubs</option>
          {clubs.map((club) => <option key={club.id} value={club.id}>{club.name}</option>)}
        </select>
      </label>
      <Button type="submit" variant="secondary">Show events</Button>
    </form>
  );
}
