export default function InputDate({
  id,
  label,
  className,
}: {
  id: string;
  label: string;
  className?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      <input id={id} type="date" className={`input-base ${className}`} />
    </div>
  );
}
