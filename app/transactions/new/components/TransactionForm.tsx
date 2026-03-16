import InputDate from "@/components/forms/InputDate";
import InputSelect from "@/components/forms/InputSelect";
import InputText from "@/components/forms/InputText";
import InputTextArea from "@/components/forms/InputTextArea";
import InputTime from "@/components/forms/InputTime";

const mockAccountOptions = [
  { value: "nacion", label: "🏦 Banco Nación — $32,400" },
  { value: "visa", label: "💳 Visa Santander" },
  { value: "galicia", label: "🏦 Galicia Saving — $18,750" },
  { value: "mp", label: "📱 Mercado Pago — $4,100" },
];

export default function TransactionForm() {
  return (
    <div className="tab-panel" role="tabpanel" aria-labelledby="tab-expense">
      {/* <!-- Description + date --> */}
      <section className="bg-white border border-stone-100 rounded-xl p-6 flex flex-col gap-4">
        <InputText
          id="expense-desc"
          label="Description"
          placeholder="E.g.: Lunch, Netflix, gas…"
          autoComplete="off"
        />

        <div className="grid grid-cols-2 gap-4">
          <InputDate id="expense-date" label="Date" />
          <InputTime id="expense-time" label="Time" />
        </div>
      </section>

      {/* <!-- Account + category --> */}
      <section className="bg-white border border-stone-100 rounded-xl p-6 flex flex-col gap-4">
        <InputSelect
          id="expense-account"
          label="Account"
          options={mockAccountOptions}
          firstOption="Select account…"
        />

        {/* Account Swap */}
        <div className="flex items-center gap-4">
          <div className="flex-1 h-px bg-stone-100"></div>
          <div
            className="transfer-arrow"
            aria-label="Transfer direction"
            title="Click to switch accounts"
          >
            ⇄
          </div>
          <div className="flex-1 h-px bg-stone-100"></div>
        </div>

        <InputSelect
          id="transfer-account"
          label="To Account"
          options={mockAccountOptions}
          firstOption="Select to account…"
        />

        {/* <!-- Category chips for expense --> */}
        {/* <div>
          <span className="field-label">Category</span>
          <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
            <button
              type="button"
              className="cat-chip"
              // onClick="selectCategory(this)"
            >
              <span className="cat-emoji">🍔</span>
              <span className="cat-name">Food</span>
            </button>
            <button
              type="button"
              className="cat-chip selected"
              // onClick="selectCategory(this)"
              aria-pressed="true"
            >
              <span className="cat-emoji">🚌</span>
              <span className="cat-name">Transport</span>
            </button>
            <button
              type="button"
              className="cat-chip"
              // onClick="selectCategory(this)"
            >
              <span className="cat-emoji">🏠</span>
              <span className="cat-name">Home</span>
            </button>
            <button
              type="button"
              className="cat-chip"
              // onClick="selectCategory(this)"
            >
              <span className="cat-emoji">💊</span>
              <span className="cat-name">Health</span>
            </button>
            <button
              type="button"
              className="cat-chip"
              // onClick="selectCategory(this)"
            >
              <span className="cat-emoji">🎬</span>
              <span className="cat-name">Entertainment</span>
            </button>
            <button
              type="button"
              className="cat-chip"
              // onClick="selectCategory(this)"
            >
              <span className="cat-emoji">✈️</span>
              <span className="cat-name">Travel</span>
            </button>
            <button
              type="button"
              className="cat-chip"
              // onClick="selectCategory(this)"
            >
              <span className="cat-emoji">＋</span>
              <span className="cat-name">More</span>
            </button>
          </div>
        </div> */}

        {/* Payer for income */}
        <InputText
          id="income-payer"
          label="Payer / Source"
          placeholder="E.g.: Salary, freelance client, gift…"
          autoComplete="off"
        />
      </section>

      {/* <!-- Tags + note --> */}
      <section className="bg-white border border-stone-100 rounded-xl p-6 flex flex-col gap-4">
        <InputText
          id="expense-tags"
          label="Tags (comma separated)"
          placeholder="E.g.: recurring, work, deductible…"
        />

        <InputTextArea
          id="expense-note"
          label="Note"
          placeholder="Add an optional comment…"
          rows={2}
        />
      </section>
    </div>
  );
}
