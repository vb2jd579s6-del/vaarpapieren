export interface Segment<T extends string> {
  id: T;
  label: string;
}

interface SegmentedControlProps<T extends string> {
  label: string;
  segments: Segment<T>[];
  value: T;
  onChange: (id: T) => void;
}

export function SegmentedControl<T extends string>({ label, segments, value, onChange }: SegmentedControlProps<T>) {
  return (
    <div className="segmented" role="radiogroup" aria-label={label}>
      {segments.map((s) => (
        <button key={s.id} role="radio" aria-checked={s.id === value} onClick={() => onChange(s.id)}>
          {s.label}
        </button>
      ))}
    </div>
  );
}
