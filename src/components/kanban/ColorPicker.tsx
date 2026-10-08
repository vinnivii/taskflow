const PRESET_COLORS = ["#A855F7", "#3B82F6", "#22C55E", "#EF4444", "#F97316", "#F2C94C", "#EC4899", "#14B8A6"];

export function ColorPicker({ value, onChange, disabled = false }: { value: string; onChange: (color: string) => void; disabled?: boolean }) {
  return <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Cor">
    {PRESET_COLORS.map((color) => <button type="button" aria-label={`Cor ${color}`} aria-pressed={value.toUpperCase() === color} disabled={disabled} key={color}
      className="w-7 h-7 rounded-full border-2 disabled:opacity-40" style={{ background: color, borderColor: value.toUpperCase() === color ? "white" : "transparent" }} onClick={() => onChange(color)} />)}
    <input aria-label="Cor personalizada" disabled={disabled} className="w-24 h-8 px-2 rounded bg-[var(--c-surface)] border border-[var(--c-border)] text-xs" value={value} maxLength={7} onChange={(event) => onChange(event.target.value)} />
    {!/^#[0-9a-f]{6}$/i.test(value) && <p className="text-xs text-red-400 w-full">Use uma cor hexadecimal com seis dígitos, como #A855F7.</p>}
  </div>;
}
