import { UseFormRegisterReturn } from "react-hook-form";
import FieldError from "./FieldError";

export default function InputDate({
  id,
  label,
  className = "",
  registration,
  error,
}: {
  id: string;
  label: string;
  className?: string;
  registration?: UseFormRegisterReturn;
  error?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      <input
        id={id}
        type="date"
        className={`input-base ${className}`}
        {...registration}
      />
      <FieldError message={error} />
    </div>
  );
}
