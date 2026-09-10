'use client';

import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';

export function HeroSearch({ destinations }: { destinations: { slug: string; name: string }[] }) {
  const router = useRouter();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const destination = formData.get('destination');
    const params = new URLSearchParams();
    if (destination) params.set('destination', String(destination));
    router.push(`/packages?${params.toString()}`);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-2 rounded-xl2 bg-white p-2 shadow-lg sm:flex-row sm:items-center"
    >
      <div className="flex flex-1 items-center gap-2 px-3 py-2">
        <Search className="h-4 w-4 shrink-0 text-ink-400" />
        <select name="destination" className="w-full border-none bg-transparent text-sm text-ink-700 focus:ring-0">
          <option value="">Where do you want to go?</option>
          {destinations.map((d) => (
            <option key={d.slug} value={d.slug}>
              {d.name}
            </option>
          ))}
        </select>
      </div>
      <button type="submit" className="btn-primary shrink-0 sm:w-auto">
        Search packages
      </button>
    </form>
  );
}
