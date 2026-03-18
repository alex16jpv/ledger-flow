import { UseFormRegisterReturn } from "react-hook-form";
import FieldError from "./FieldError";

export default function InputTextArea({
  id,
  label,
  placeholder,
  className = "",
  rows = undefined,
  registration,
  error,
}: {
  id: string;
  label: string;
  placeholder?: string;
  className?: string;
  rows?: number;
  registration?: UseFormRegisterReturn;
  error?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      <textarea
        id={id}
        className={`input-base ${className}`}
        rows={rows}
        placeholder={placeholder}
        {...registration}
      ></textarea>
      <FieldError message={error} />
    </div>
  );
}
