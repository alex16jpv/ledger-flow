export default function InputTextArea({
  id,
  label,
  placeholder,
  className = "",
  rows = undefined,
}: {
  id: string;
  label: string;
  placeholder?: string;
  className?: string;
  rows?: number;
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
      ></textarea>
    </div>
  );
}
