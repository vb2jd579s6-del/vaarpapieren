export interface TabItem<T extends string> {
  id: T;
  label: string;
  /** Draws attention with a short bounce now and then (e.g. a half-filled form waits there). */
  attention?: boolean;
}

interface TabsProps<T extends string> {
  items: TabItem<T>[];
  active: T | null;
  onChange: (id: T) => void;
}

export function Tabs<T extends string>({ items, active, onChange }: TabsProps<T>) {
  return (
    <div className="tabs" role="tablist">
      {items.map((item) => (
        <button
          key={item.id}
          role="tab"
          className={`tab${item.attention && item.id !== active ? " tab-attention" : ""}`}
          aria-selected={item.id === active}
          onClick={() => onChange(item.id)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
