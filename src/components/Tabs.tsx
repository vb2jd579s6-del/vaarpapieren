export interface TabItem<T extends string> {
  id: T;
  label: string;
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
          className="tab"
          aria-selected={item.id === active}
          onClick={() => onChange(item.id)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
