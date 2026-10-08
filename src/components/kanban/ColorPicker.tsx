import { useState } from "react";

const PRESET_COLORS = ["#A855F7", "#3B82F6", "#22C55E", "#EF4444", "#F97316", "#F2C94C", "#EC4899", "#14B8A6"];
const RGB_CHANNELS = [{ name: "Vermelho", symbol: "R" }, { name: "Verde", symbol: "G" }, { name: "Azul", symbol: "B" }];

export function ColorPicker({ value, onChange, disabled = false }: { value: string; onChange: (color: string) => void; disabled?: boolean }) {
  const [emptyChannel, setEmptyChannel] = useState<{ index: number; color: string } | null>(null);
  const validColor = /^#[0-9a-f]{6}$/i.test(value);
  const rgb = RGB_CHANNELS.map((_, index) => validColor ? parseInt(value.slice(1 + index * 2, 3 + index * 2), 16) : 0);

  function changeChannel(index: number, channel: number) {
    if (!Number.isFinite(channel)) {
      setEmptyChannel({ index, color: value });
      return;
    }
    setEmptyChannel(null);
    const channels = rgb.map((current, channelIndex) => channelIndex === index ? Math.min(255, Math.max(0, Math.round(channel))) : current);
    onChange(`#${channels.map((current) => current.toString(16).padStart(2, "0")).join("").toUpperCase()}`);
  }

  return <div className="space-y-3" role="group" aria-label="Cor">
    <div className="flex flex-wrap items-center gap-2">
      {PRESET_COLORS.map((color) => <button type="button" aria-label={`Cor ${color}`} aria-pressed={value.toUpperCase() === color} disabled={disabled} key={color}
        className="w-7 h-7 rounded-full border-2 disabled:opacity-40" style={{ background: color, borderColor: value.toUpperCase() === color ? "white" : "transparent" }} onClick={() => onChange(color)} />)}
      <input aria-label="Cor personalizada" disabled={disabled} className="w-24 h-8 px-2 rounded bg-[var(--c-surface)] border border-[var(--c-border)] text-xs disabled:opacity-40" value={value} maxLength={7} onChange={(event) => onChange(event.target.value)} />
    </div>
    <div className="flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1 text-xs text-[var(--c-muted)]">
        Cor RGB
        <input type="color" aria-label="Selecionar cor RGB" value={validColor ? value : "#000000"} disabled={disabled}
          className="h-9 w-12 cursor-pointer rounded border border-[var(--c-border)] bg-[var(--c-surface)] p-1 disabled:cursor-default disabled:opacity-40"
          onChange={(event) => { setEmptyChannel(null); onChange(event.target.value.toUpperCase()); }} />
      </label>
      <div className="flex gap-2" role="group" aria-label="RGB: valores de 0 a 255">
        {RGB_CHANNELS.map(({ name, symbol }, index) => <label key={symbol} className="flex flex-col gap-1 text-xs text-[var(--c-muted)]">
          {symbol}
          <input type="number" aria-label={`${name} (${symbol})`} min={0} max={255} step={1} inputMode="numeric" disabled={disabled || !validColor}
            value={emptyChannel?.index === index && emptyChannel.color === value ? "" : rgb[index]}
            className="h-9 w-16 rounded border border-[var(--c-border)] bg-[var(--c-surface)] px-2 text-sm text-[var(--c-text)] disabled:opacity-40"
            onChange={(event) => changeChannel(index, event.target.valueAsNumber)} onBlur={() => setEmptyChannel(null)} />
        </label>)}
      </div>
      <span className="pb-2 text-xs text-[var(--c-muted)]">0–255</span>
    </div>
    {!validColor && <p className="text-xs text-red-400">Use uma cor hexadecimal com seis dígitos, como #A855F7.</p>}
  </div>;
}
