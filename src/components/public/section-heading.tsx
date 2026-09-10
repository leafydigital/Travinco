export function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="mb-8 max-w-2xl">
      {eyebrow && (
        <p className="mb-2 text-sm font-medium uppercase tracking-wide text-brand-600">{eyebrow}</p>
      )}
      <h2 className="font-display text-2xl font-semibold text-ink-900 sm:text-3xl">{title}</h2>
      {description && <p className="mt-2 text-ink-500">{description}</p>}
    </div>
  );
}
