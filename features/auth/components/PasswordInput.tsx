"use client";

import { Eye, EyeOff, Lock } from "lucide-react";
import { useTranslations } from "next-intl";
import { type ComponentProps, forwardRef, useState } from "react";

import { Input } from "@/components/ui/Field";
import { iconProps } from "@/lib/icons/sizes";

type PasswordInputProps = Omit<ComponentProps<typeof Input>, "type" | "leading">;

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  function PasswordInput(props, ref) {
    const t = useTranslations("auth");
    const [visible, setVisible] = useState(false);
    return (
      <div className="relative">
        <Input
          ref={ref}
          type={visible ? "text" : "password"}
          leading={<Lock {...iconProps("sm")} />}
          className="pr-10"
          {...props}
        />
        <button
          type="button"
          aria-label={visible ? t("hidePassword") : t("showPassword")}
          aria-pressed={visible}
          onClick={() => {
            setVisible((current) => !current);
          }}
          className="absolute top-1/2 right-2 grid size-8 -translate-y-1/2 place-items-center rounded-sm text-text-3 hover:text-text"
        >
          {visible ? <EyeOff {...iconProps("sm")} /> : <Eye {...iconProps("sm")} />}
        </button>
      </div>
    );
  },
);
