import { UseFormRegisterReturn } from "react-hook-form";
import FieldError from "./FieldError";

export default function InputText({
  id,
  label,
  placeholder,
  className = "",
  autoComplete = "off",
  registration,
  error,
}: {
  id: string;
  label: string;
  placeholder?: string;
  className?: string;
  autoComplete?: React.HTMLInputAutoCompleteAttribute;
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
        type="text"
        className={`input-base ${className}`}
        placeholder={placeholder}
        autoComplete={autoComplete}
        {...registration}
      />
      <FieldError message={error} />
    </div>
  );
}
