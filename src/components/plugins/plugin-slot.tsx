import { createClient } from '@/lib/supabase/server';
import { CodeEmbed } from './code-embed';
import type { PluginSlot as SlotType } from '@/types/database';

interface PluginSlotProps {
  slot: SlotType | string;
  className?: string;
  containerClassName?: string;
}

/**
 * Server Component that queries active plugins for the designated slot
 * using the standard anonymous public Supabase client.
 *
 * RLS enforces that only active plugins (`active = true`) are retrieved.
 * Results are rendered sequentially according to their configured position.
 */
export async function PluginSlot({ slot, className, containerClassName }: PluginSlotProps) {
  try {
    const supabase = await createClient();
    const { data: plugins, error } = await supabase
      .from('plugins')
      .select('id, name, code, position')
      .eq('slot', slot)
      .eq('active', true)
      .order('position', { ascending: true })
      .order('id', { ascending: true });

    if (error) {
      console.error(`[PluginSlot] Error fetching active plugins for slot "${slot}":`, error.message);
      return null;
    }

    if (!plugins || plugins.length === 0) {
      return null;
    }

    return (
      <aside
        aria-label={`Widget Slot ${slot}`}
        data-plugin-slot={slot}
        className={containerClassName ?? 'w-full py-4'}
      >
        <div className={className ?? 'container-page'}>
          {plugins.map((plugin) => (
            <div
              key={plugin.id}
              data-plugin-id={plugin.id}
              data-plugin-name={plugin.name}
              className="w-full my-3 first:mt-0 last:mb-0"
            >
              <CodeEmbed code={plugin.code} />
            </div>
          ))}
        </div>
      </aside>
    );
  } catch (err) {
    console.error(`[PluginSlot] Unexpected error in slot "${slot}":`, err);
    return null;
  }
}
