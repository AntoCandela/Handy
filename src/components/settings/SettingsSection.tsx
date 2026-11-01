import React, { useId } from "react";
import type { LucideIcon } from "lucide-react";

interface SettingsSectionProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  children: React.ReactNode;
}

/** Settings-page grouping; controls retain their own state and persistence. */
export const SettingsSection: React.FC<SettingsSectionProps> = ({
  title,
  description,
  icon: Icon,
  children,
}) => {
  const heading = useId();
  return (
    <section
      aria-labelledby={heading}
      className="rounded-xl border border-line bg-background"
    >
      <header className="flex items-start gap-3 rounded-t-xl border-b border-line bg-wash/40 px-4 py-3">
        {Icon && (
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-logo-primary/10 text-logo-primary">
            <Icon size={17} aria-hidden="true" />
          </span>
        )}
        <div className="min-w-0">
          <h2 id={heading} className="text-sm font-semibold text-text">
            {title}
          </h2>
          {description && (
            <p className="mt-1 text-xs leading-relaxed text-ink-2">
              {description}
            </p>
          )}
        </div>
      </header>
      <div className="divide-y divide-line">{children}</div>
    </section>
  );
};
