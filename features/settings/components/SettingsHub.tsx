"use client";

import {
  ChevronRight,
  Clock,
  Coins,
  Download,
  FileText,
  Globe,
  Info,
  Lock,
  LogOut,
  MonitorSmartphone,
  Palette as PaletteIcon,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Tags,
  Upload,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { type ReactNode, useState } from "react";

import { Avatar } from "@/components/shell/Avatar";
import { PageHeader } from "@/components/shell/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { List, Row, RowBody, RowButton, RowLink, RowMeta, RowTitle } from "@/components/ui/Row";
import { Tile } from "@/components/ui/Tile";
import { useToast } from "@/components/ui/Toast";
import { LOGIN_PATH } from "@/lib/auth/routes";
import { env } from "@/lib/env";
import { useFormatSettings } from "@/lib/i18n/FormatSettingsProvider";
import { Link } from "@/lib/i18n/navigation";
import { useRouter } from "@/lib/i18n/navigation";
import { useDates } from "@/lib/i18n/useDates";
import { iconProps } from "@/lib/icons/sizes";
import { useOutbox } from "@/lib/local/outbox/useOutbox";
import { useOffline } from "@/lib/network/useOffline";
import { useInstallPrompt } from "@/lib/pwa/install";
import { useSession } from "@/lib/session/SessionProvider";
import { useTheme } from "@/lib/theme";
import type { ColorToken } from "@/lib/theme/feature-color";

import {
  useCategorySummary,
  useDeleteAccount,
  useHasAccounts,
  useSessionCount,
  useUpdateCurrency,
  useUpdateTimeZone,
} from "../hooks";
import { LanguageSheet } from "./LanguageSheet";
import { CurrencySheet, DeleteAccountSheet, SignOutSheet, TimeZoneSheet } from "./SettingsSheets";

interface SettingsRowProps {
  icon: ReactNode;
  color?: ColorToken;
  title: ReactNode;
  meta?: ReactNode;
  right?: ReactNode;
  href?:
    | "/settings/appearance"
    | "/categories"
    | "/settings/profile"
    | "/settings/sessions"
    | "/settings/sync"
    | "/privacy";
  onClick?: () => void;
}

function SettingsRow({ icon, color, title, meta, right, href, onClick }: SettingsRowProps) {
  const body = (
    <>
      <Tile size="sm" color={color}>
        {icon}
      </Tile>
      <RowBody>
        <RowTitle>
          <span>{title}</span>
        </RowTitle>
        {meta && <RowMeta items={[meta]} />}
      </RowBody>
      <span className="flex items-center gap-2 text-sm text-text-2">
        {right}
        {(href ?? onClick) && <ChevronRight {...iconProps("sm")} className="text-text-3" />}
      </span>
    </>
  );
  if (href) {
    return (
      <RowLink href={href} className="min-h-14">
        {body}
      </RowLink>
    );
  }
  if (onClick) {
    return (
      <RowButton onClick={onClick} className="min-h-14">
        {body}
      </RowButton>
    );
  }
  return <Row className="min-h-14">{body}</Row>;
}

function Section({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-medium tracking-caps text-text-3 uppercase">{title}</span>
      <Card flush>
        <List>{children}</List>
      </Card>
    </div>
  );
}

export function SettingsHub() {
  const t = useTranslations();
  const locale = useLocale();
  const session = useSession();
  const theme = useTheme();
  const dates = useDates();
  const { currency, timeZone } = useFormatSettings();
  const categories = useCategorySummary(session.status === "authenticated");
  const sessions = useSessionCount(session.status === "authenticated");
  const hasAccounts = useHasAccounts(session.status === "authenticated");
  const updateCurrency = useUpdateCurrency();
  const updateTimeZone = useUpdateTimeZone();
  const deleteAccount = useDeleteAccount();
  const install = useInstallPrompt();
  const outbox = useOutbox();
  // The session lives on the server: with no network a sign-out could only clear this device and
  // leave the cookies — and the account — signed in. It waits and says so (R-3b §C).
  const offline = useOffline();
  const router = useRouter();
  const toast = useToast();
  const [sheet, setSheet] = useState<
    "language" | "currency" | "timeZone" | "delete" | "signOut" | null
  >(null);
  const user = session.user;
  const currencyLocked = hasAccounts.data !== false;

  return (
    <>
      <PageHeader title={t("settings.title")} />
      <Card className="flex items-center gap-3.5">
        <Avatar name={user?.name ?? ""} className="size-[52px] text-lg" />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-md font-semibold">{user?.name}</span>
          <span className="text-sm text-text-2">{user?.email}</span>
          {user?.lastLoginAt && (
            <span className="text-xs text-text-3">
              {t("settings.lastSignIn", { when: dates.formatDay(new Date(user.lastLoginAt)) })}
            </span>
          )}
        </span>
      </Card>

      <Section title={t("settings.preferences")}>
        <SettingsRow
          icon={<Globe {...iconProps("sm")} />}
          color="TEAL"
          title={t("settings.language.title")}
          meta={t("settings.language.subtitle")}
          right={t(`settings.language.${locale}`)}
          onClick={() => {
            setSheet("language");
          }}
        />
        <SettingsRow
          icon={<Coins {...iconProps("sm")} />}
          color="GREEN"
          title={t("settings.currency.title")}
          meta={currencyLocked ? t("settings.currency.locked") : t("settings.currency.unlocked")}
          right={<Badge>{currency}</Badge>}
          onClick={() => {
            setSheet("currency");
          }}
        />
        <SettingsRow
          icon={<Clock {...iconProps("sm")} />}
          color="BLUE"
          title={t("settings.timeZone.title")}
          meta={t("settings.timeZone.subtitle")}
          right={timeZone.split("/").pop()?.replace(/_/g, " ")}
          onClick={() => {
            setSheet("timeZone");
          }}
        />
        <SettingsRow
          icon={<PaletteIcon {...iconProps("sm")} />}
          color="PURPLE"
          title={t("settings.appearance.title")}
          meta={t("settings.appearance.subtitle")}
          right={`${t(`settings.appearance.palettes.${theme.palette}.name`)} · ${t(`settings.appearance.${theme.mode}`)}`}
          href="/settings/appearance"
        />
        <SettingsRow
          icon={<Tags {...iconProps("sm")} />}
          color="ORANGE"
          title={t("settings.categories.title")}
          meta={categories.data ? t("settings.categories.subtitle", categories.data) : undefined}
          href="/categories"
        />
      </Section>

      <Section title={t("settings.security")}>
        <SettingsRow
          icon={<Lock {...iconProps("sm")} />}
          color="GRAY"
          title={t("settings.credentials.title")}
          meta={t("settings.credentials.subtitle")}
          href="/settings/profile"
        />
        <SettingsRow
          icon={<Smartphone {...iconProps("sm")} />}
          color="GRAY"
          title={t("settings.sessions.title")}
          meta={t("settings.sessions.subtitle")}
          right={sessions !== undefined && <Badge>{sessions}</Badge>}
          href="/settings/sessions"
        />
      </Section>

      <Section title={t("settings.yourData.title")}>
        <Row className="min-h-14">
          <Tile size="sm" color="TEAL">
            <ShieldCheck {...iconProps("sm")} />
          </Tile>
          <RowBody>
            <p className="text-sm text-text-2">{t("settings.yourData.rights")}</p>
            <p className="text-sm text-text-2">
              <a
                href={`mailto:${env.NEXT_PUBLIC_CONTACT_EMAIL}`}
                className="font-medium text-brand-text"
              >
                {t("settings.yourData.contact", { email: env.NEXT_PUBLIC_CONTACT_EMAIL })}
              </a>
            </p>
            {user && (
              <RowMeta
                items={[
                  t("settings.yourData.policyVersion", {
                    version: "1",
                    date: dates.formatDay(new Date(user.createdAt)),
                  }),
                ]}
              />
            )}
          </RowBody>
        </Row>
        <SettingsRow
          icon={<FileText {...iconProps("sm")} />}
          color="GRAY"
          title={t("settings.yourData.policy")}
          href="/privacy"
        />
      </Section>

      <Section title={t("settings.data")}>
        <SettingsRow
          icon={<RefreshCw {...iconProps("sm")} />}
          color="TEAL"
          title={t("settings.sync.title")}
          meta={t("settings.sync.subtitle")}
          right={outbox.pending > 0 ? <Badge>{outbox.pending}</Badge> : undefined}
          href="/settings/sync"
        />
        <SettingsRow
          icon={<Download {...iconProps("sm")} />}
          title={t("settings.export")}
          meta={t("common.comingSoon")}
          right={<Badge tone="outline">{t("common.soon")}</Badge>}
        />
        <SettingsRow
          icon={<Upload {...iconProps("sm")} />}
          title={t("settings.import")}
          meta={t("common.comingSoon")}
          right={<Badge tone="outline">{t("common.soon")}</Badge>}
        />
      </Section>

      <Section title={t("settings.about")}>
        {install.state !== "unavailable" && (
          <SettingsRow
            icon={<MonitorSmartphone {...iconProps("sm")} />}
            color="INDIGO"
            title={t("settings.install.title")}
            meta={
              install.state === "installed"
                ? t("settings.install.installed")
                : t("settings.install.durability")
            }
            onClick={
              install.state === "available"
                ? () => {
                    void install.install();
                  }
                : undefined
            }
          />
        )}
        <SettingsRow
          icon={<Info {...iconProps("sm")} />}
          color="GRAY"
          title={t("settings.about")}
          meta={t("settings.version", { version: env.NEXT_PUBLIC_APP_VERSION })}
        />
      </Section>

      <div className="flex flex-col gap-2">
        <Button
          variant="secondary"
          block
          disabled={offline}
          onClick={() => {
            if (outbox.pending > 0) {
              setSheet("signOut");
              return;
            }
            void session.logout();
          }}
        >
          <LogOut {...iconProps("sm")} />
          {t("settings.signOut")}
        </Button>
        {offline && (
          <p className="text-center text-sm text-text-3" role="status">
            {t("settings.signOutOffline")}
          </p>
        )}
        <Button
          variant="ghost"
          block
          className="text-danger"
          onClick={() => {
            setSheet("delete");
          }}
        >
          {t("settings.deleteAccount")}
        </Button>
      </div>
      <p className="text-center text-xs text-text-3">
        {t("settings.version", { version: env.NEXT_PUBLIC_APP_VERSION })}
        {" · "}
        <span className="font-mono">{timeZone}</span>
      </p>
      <Link href="/home" className="sr-only">
        {t("nav.home")}
      </Link>
      <CurrencySheet
        key={`currency-${sheet === "currency" ? "open" : "closed"}`}
        open={sheet === "currency"}
        currency={currency}
        locked={currencyLocked}
        offline={offline}
        pending={updateCurrency.isPending}
        error={updateCurrency.error}
        onSave={(next) => {
          updateCurrency
            .mutateAsync(next)
            .then(() => {
              setSheet(null);
              toast.show({ message: t("settings.currency.saved") });
            })
            .catch(() => undefined);
        }}
        onClose={() => {
          setSheet(null);
        }}
      />
      <TimeZoneSheet
        key={`timezone-${sheet === "timeZone" ? "open" : "closed"}`}
        open={sheet === "timeZone"}
        timeZone={timeZone}
        offline={offline}
        pending={updateTimeZone.isPending}
        error={updateTimeZone.error}
        onSave={(next) => {
          updateTimeZone
            .mutateAsync(next)
            .then(() => {
              setSheet(null);
              toast.show({ message: t("settings.timeZone.saved") });
            })
            .catch(() => undefined);
        }}
        onClose={() => {
          setSheet(null);
        }}
      />
      <DeleteAccountSheet
        open={sheet === "delete"}
        offline={offline}
        pending={deleteAccount.isPending}
        error={deleteAccount.error}
        onConfirm={() => {
          deleteAccount
            .mutateAsync()
            .then(async () => {
              await session.logout();
              router.replace({ pathname: LOGIN_PATH, query: { deleted: "1" } });
            })
            .catch(() => undefined);
        }}
        onClose={() => {
          setSheet(null);
        }}
      />
      <SignOutSheet
        open={sheet === "signOut"}
        pending={outbox.pending}
        onKeep={() => {
          setSheet(null);
          void session.logout({ discardPendingWork: false });
        }}
        onDiscard={() => {
          setSheet(null);
          void session.logout({ discardPendingWork: true });
        }}
        onClose={() => {
          setSheet(null);
        }}
      />
      <LanguageSheet
        open={sheet === "language"}
        onClose={() => {
          setSheet(null);
        }}
      />
    </>
  );
}
