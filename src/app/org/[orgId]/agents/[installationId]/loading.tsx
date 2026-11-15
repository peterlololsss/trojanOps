// Owner: C (WP-9). Skeleton of the run page: header, transcript column with the input, inspector column.
export default function AgentRunLoading() {
  const bar = 'animate-pulse bg-muted motion-reduce:animate-none';
  return (
    <section aria-busy="true" aria-label="Loading agent">
      <p className="sr-only">Loading agent</p>
      <div aria-hidden="true">
        <div className="mb-[24px] space-y-[8px]">
          <div className={`h-[36px] w-[280px] max-w-full ${bar}`} />
          <div className={`h-[20px] w-[420px] max-w-full ${bar}`} />
        </div>
        <div className="flex flex-col items-start gap-[24px] lg:flex-row">
          <div className="w-full min-w-0 max-w-[720px] flex-1">
            <div className="border-y border-border py-[16px]">
              <div className={`h-[16px] w-1/3 ${bar}`} />
              <div className={`mt-[8px] h-[16px] w-2/3 ${bar}`} />
            </div>
            <div className={`mt-[16px] h-[20px] w-[72px] ${bar}`} />
            <div className="mt-[4px] h-[88px] rounded-md border border-border" />
            <div className={`mt-[8px] h-[36px] w-[160px] rounded-md ${bar}`} />
          </div>
          <div className="w-[384px] max-w-full shrink-0 border-l border-border">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="border-b border-border px-[16px] py-[16px] last:border-b-0">
                <div className={`h-[16px] w-[96px] ${bar}`} />
                <div className={`mt-[8px] h-[16px] w-[240px] max-w-full ${bar}`} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
