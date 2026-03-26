import { Account } from "@/types/Account.types";
import { ACCOUNT_TYPE_LABELS, ACCOUNT_TYPE_COLORS } from "@/utils/constants";
import { formatAmount } from "@/utils/utils";

const SPARKLINE_PATTERN = [30, 50, 40, 80, 60, 90, 70, 85];

export default function AccountHero({ account }: { account: Account }) {
  const colors = ACCOUNT_TYPE_COLORS[account.type];
  const isNegative = account.balance < 0;
  const formattedBalance = formatAmount({ amount: Math.abs(account.balance) });
  const displayBalance = isNegative ? `−${formattedBalance}` : formattedBalance;

  return (
    <div
      className={`lg:col-span-2 ${colors.bgColor} border ${colors.borderColor} rounded-xl p-6 flex flex-col justify-between min-h-40`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p
            className={`font-mono text-xs tracking-widest ${colors.accentColor} uppercase mb-1`}
          >
            {ACCOUNT_TYPE_LABELS[account.type]}
          </p>
          <p className={`text-lg font-medium ${colors.textColor}`}>
            {account.name}
          </p>
        </div>
      </div>

      <div>
        <p className={`font-mono text-xs ${colors.accentColor} mb-1`}>
          Available balance
        </p>
        <p
          className={`font-display text-4xl font-medium ${colors.textColor} leading-none`}
        >
          {displayBalance}
        </p>
      </div>

      <div className="sparkline h-10 mt-2" aria-hidden="true">
        {SPARKLINE_PATTERN.map((height, i) => (
          <div
            key={i}
            className={`spark-bar ${height > 70 ? colors.sparkDark : colors.sparkLight}`}
            style={{ height: `${height}%` }}
          />
        ))}
      </div>
    </div>
  );
}
