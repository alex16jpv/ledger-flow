export default function InputSelect({
  id,
  label,
  className,
  options,
  firstOption,
}: {
  id: string;
  label: string;
  className?: string;
  options?: { value: string; label: string }[];
  firstOption?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      <div className="select-wrap">
        <select id={id} className={`input-base ${className}`} defaultValue={""}>
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
    </div>
  );
}
