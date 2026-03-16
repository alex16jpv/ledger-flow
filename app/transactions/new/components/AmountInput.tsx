export default function AmountInput() {
  return (
    <div>
      <label htmlFor="amount" className="field-label">
        Amount
      </label>
      <div className="amount-wrapper">
        <span className="amount-currency">$</span>
        <input
          id="amount"
          type="number"
          min="0"
          step="0.01"
          className="input-amount"
          placeholder="0.00"
          autoComplete="off"
        />
      </div>
    </div>
  );
}
