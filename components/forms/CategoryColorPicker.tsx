import FieldError from "./FieldError";
import {
  CATEGORY_COLOR_OPTIONS,
  CATEGORY_COLOR_STYLES,
  type CategoryColor,
} from "@/utils/constants";

export default function CategoryColorPicker({
  selectedColor,
  onColorChange,
  error,
}: {
  selectedColor?: string;
  onColorChange: (color: CategoryColor) => void;
  error?: string;
}) {
  return (
    <div>
      <label className="field-label">Color</label>
      <div className="flex items-center gap-2 flex-wrap">
        {CATEGORY_COLOR_OPTIONS.map((option) => {
          const isSelected = selectedColor === option.value;
          const style = CATEGORY_COLOR_STYLES[option.value];
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onColorChange(option.value)}
              className={`
                w-8 h-8 rounded-full ${style.dot} transition-transform
                hover:scale-110 cursor-pointer
                ${isSelected ? "ring-2 ring-stone-800 ring-offset-2" : ""}
              `}
              aria-label={option.label}
              aria-pressed={isSelected}
            />
          );
        })}
      </div>
      <FieldError message={error} />
    </div>
  );
}
