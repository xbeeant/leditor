import { Pipette } from 'lucide-react';
import { useRef, useState } from 'react';
import { ToolbarButton } from './ToolbarButton';
import { ToolbarPopup } from './ToolbarPopup';

interface ColorButtonProps {
  label: string;
  color: string;
  colors: string[];
  onChange: (color: string) => void;
}

export function ColorButton({
  label,
  color,
  colors,
  onChange,
}: ColorButtonProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const indicator = color === 'transparent' ? '#ffffff' : color;

  return (
    <div ref={ref} className="relative">
      <ToolbarButton title={label} onClick={() => setOpen((v) => !v)}>
        <span className="relative inline-flex flex-col items-center">
          <Pipette size={18} />
          <span
            className="absolute -bottom-0.5 h-1 w-4 rounded-sm ring-1 ring-gray-200"
            style={{ backgroundColor: indicator }}
          />
        </span>
      </ToolbarButton>
      {open && (
        <ToolbarPopup
          anchorRef={ref}
          open={open}
          onClose={() => setOpen(false)}
          className="grid w-40 grid-cols-5 gap-1 rounded-lg border border-gray-200 bg-white p-2 shadow-lg"
        >
          {colors.map((c) => (
            <button
              key={c}
              type="button"
              className="h-6 w-6 rounded border border-gray-200 transition-transform hover:scale-110"
              style={{ backgroundColor: c }}
              title={c}
              onClick={() => {
                onChange(c);
                setOpen(false);
              }}
            />
          ))}
          <label className="col-span-5 mt-1 flex items-center gap-1 text-xs text-gray-500">
            <input
              type="color"
              className="h-6 w-8 cursor-pointer rounded border border-gray-200"
              onChange={(e) => onChange(e.target.value)}
            />
            Custom
          </label>
        </ToolbarPopup>
      )}
    </div>
  );
}
