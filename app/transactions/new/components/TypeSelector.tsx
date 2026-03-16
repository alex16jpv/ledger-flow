export default function TrxTypeSelector() {
  return (
    <div
      className="flex gap-2 mb-6"
      role="tablist"
      aria-label="Transaction type"
    >
      <button
        id="tab-expense"
        className="tab-btn active-expense"
        role="tab"
        aria-selected="true"
        aria-controls="panel-expense"
        // onclick="switchTab('expense')"
      >
        <span>↓</span> Expense
      </button>
      <button
        id="tab-income"
        className="tab-btn"
        role="tab"
        aria-selected="false"
        aria-controls="panel-income"
        // onclick="switchTab('income')"
      >
        <span>↑</span> Income
      </button>
      <button
        id="tab-transfer"
        className="tab-btn"
        role="tab"
        aria-selected="false"
        aria-controls="panel-transfer"
        // onclick="switchTab('transfer')"
      >
        <span>⇄</span> Transfer
      </button>
    </div>
  );
}
