export default function InputTime({
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
      <input id={id} type="time" className={`input-base ${className}`} />
    </div>
  );
}
