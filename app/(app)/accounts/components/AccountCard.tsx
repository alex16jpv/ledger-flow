import Link from "next/link";
import { Account } from "@/types/Account.types";
import { ACCOUNT_TYPE_LABELS, ACCOUNT_TYPE_COLORS } from "@/utils/constants";
import { formatAmount } from "@/utils/utils";

const SPARKLINE_PATTERNS: number[][] = [
  [35, 55, 40, 80, 65, 90, 70],
  [50, 60, 70, 80, 90, 95, 88],
  [20, 35, 50, 70, 80, 65, 55],
  [60, 50, 70, 55, 45, 60, 50],
  [40, 65, 55, 75, 85, 70, 90],
  [30, 45, 60, 50, 70, 55, 65],
];

function Sparkline({
  lightClass,
  darkClass,
  pattern,
}: {
  lightClass: string;
  darkClass: string;
  pattern: number[];
}) {
  return (
    <div className="sparkline h-10 mt-auto" aria-hidden="true">
      {pattern.map((height, i) => (
        <div
          key={i}
          className={`spark-bar ${height > 70 ? darkClass : lightClass}`}
          style={{ height: `${height}%` }}
        />
      ))}
    </div>
  );
}

export default function AccountCard({
  account,
  index,
}: {
  account: Account;
  index: number;
}) {
  const colors = ACCOUNT_TYPE_COLORS[account.type];
  const isNegative = account.balance < 0;
  const formattedBalance = formatAmount({
    amount: Math.abs(account.balance),
  });
  const displayBalance = isNegative ? `−${formattedBalance}` : formattedBalance;
  const pattern = SPARKLINE_PATTERNS[index % SPARKLINE_PATTERNS.length];

  return (
    <Link href={`/accounts/${account.id}`} className="block">
      <article
        className={`${colors.bgColor} border ${colors.borderColor} rounded-xl p-5 flex flex-col hover:shadow-sm transition-shadow h-full`}
      >
        <div className="flex items-start justify-between mb-3">
          <div>
            <p
              className={`font-mono text-[10px] tracking-widest ${colors.accentColor} uppercase mb-1`}
            >
              {ACCOUNT_TYPE_LABELS[account.type]}
            </p>
            <p className={`text-sm font-medium ${colors.textColor}`}>
              {account.name}
            </p>
          </div>
        </div>
        <p
          className={`font-display text-2xl font-medium ${colors.textColor} mb-3`}
        >
          {displayBalance}
        </p>
        <Sparkline
          lightClass={colors.sparkLight}
          darkClass={colors.sparkDark}
          pattern={pattern}
        />
      </article>
    </Link>
  );
}
