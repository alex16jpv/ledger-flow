export default function InputText({
  id,
  label,
  placeholder,
  className = "",
  autoComplete = "off",
}: {
  id: string;
  label: string;
  placeholder?: string;
  className?: string;
  autoComplete?: React.HTMLInputAutoCompleteAttribute;
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
      />
    </div>
  );
}
