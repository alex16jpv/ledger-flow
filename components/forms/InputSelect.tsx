import { UseFormRegisterReturn } from "react-hook-form";
import FieldError from "./FieldError";

export default function InputSelect({
  id,
  label,
  className = "",
  options,
  firstOption,
  registration,
  error,
}: {
  id: string;
  label: string;
  className?: string;
  options?: { value: string; label: string }[];
  firstOption?: string;
  registration?: UseFormRegisterReturn;
  error?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      <div className="select-wrap">
        <select id={id} className={`input-base ${className}`} {...registration}>
          {firstOption && (
            <option value="" disabled>
              {firstOption}
            </option>
          )}
          {options?.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
      <FieldError message={error} />
    </div>
  );
}
