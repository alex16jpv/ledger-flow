"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";

import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Field";
import { IconGrid } from "@/components/ui/IconGrid";
import { Segment } from "@/components/ui/Segment";
import { SwatchGrid } from "@/components/ui/Swatch";
import { Tile } from "@/components/ui/Tile";
import { ApiError, fieldErrors, presentError } from "@/lib/api/errors";
import { changedOnly, nothingChanged } from "@/lib/form/changes";
import { Link } from "@/lib/i18n/navigation";
import { validationMessage } from "@/lib/i18n/validation";
import { CategoryIcon } from "@/lib/icons/CategoryIcon";
import type { Category } from "@/types/api";

import type { CategoryType } from "../api";
import { useCreateCategory, useUpdateCategory } from "../hooks";
import { CATEGORY_TYPES, categoryFormSchema, type CategoryFormValues } from "../schemas";

interface CategoryFormProps {
  category?: Category;
  type?: CategoryType;
  typeEditable?: boolean;
  lockedCount?: number;
  initialName?: string;
  preview?: boolean;
  submitLabel?: string;
  onSaved: (category: Category) => void;
  onCancel?: () => void;
  secondaryAction?: ReactNode;
}

const SEGMENT_TONE = { EXPENSE: "default", INCOME: "income", TRANSFER: "transfer" } as const;

export function CategoryForm({
  category,
  type = "EXPENSE",
  typeEditable = true,
  lockedCount = 0,
  initialName = "",
  preview = false,
  submitLabel,
  onSaved,
  onCancel,
  secondaryAction,
}: CategoryFormProps) {
  const t = useTranslations();
  const create = useCreateCategory();
  const update = useUpdateCategory(category?.id ?? "");
  const mutation = category ? update : create;
  const form = useForm<CategoryFormValues>({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: category
      ? {
          name: category.name,
          icon: category.icon ?? "tag",
          color: category.color ?? "BLUE",
          type: category.type ?? "EXPENSE",
        }
      : { name: initialName, icon: "tag", color: "BLUE", type },
  });
  // Read during render: `formState` is a Proxy that only tracks what the component subscribed to.
  const { errors, dirtyFields } = form.formState;
  const serverFields = fieldErrors(mutation.error);
  const failure = mutation.error;
  const code = failure instanceof ApiError ? failure.code : null;
  const duplicate = code === "DUPLICATE";
  const typeLocked = code === "CATEGORY_TYPE_LOCKED";
  const formError =
    failure && !duplicate && !typeLocked && Object.keys(serverFields).length === 0
      ? presentError(failure)
      : null;
  const [name, color, icon, currentType] = useWatch({
    control: form.control,
    name: ["name", "color", "icon", "type"],
  });
  const locked = Boolean(category) && lockedCount > 0;
  const previewMeta = `${t(`categoryTypes.${currentType}`)} · ${t("categories.form.preview")}`;

  const submit = form.handleSubmit(async (values) => {
    try {
      if (category) {
        const changes = changedOnly(
          {
            name: values.name,
            icon: values.icon,
            color: values.color,
            ...(locked ? {} : { type: values.type }),
          },
          dirtyFields,
        );
        onSaved(nothingChanged(changes) ? category : await update.mutateAsync(changes));
        return;
      }
      onSaved(await create.mutateAsync(values));
    } catch {
      return;
    }
  });

  return (
    <form
      onSubmit={(event) => {
        void submit(event);
      }}
      noValidate
      className="flex flex-col gap-5"
    >
      <div className="flex flex-col gap-3">
        {preview && (
          <Card className="flex items-center gap-3">
            <Tile size="lg" color={color}>
              <CategoryIcon icon={icon} size="lg" />
            </Tile>
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-md font-semibold">
                {name.trim() || t("categories.form.previewName")}
              </span>
              <span className="text-sm text-text-3">{previewMeta}</span>
            </span>
          </Card>
        )}
        <Field
          label={t("categories.form.name")}
          error={
            duplicate
              ? t("categories.form.duplicate", { name: form.getValues("name").trim() })
              : validationMessage(t, errors.name?.message ?? serverFields.name)
          }
        >
          <Input
            placeholder={t("categories.form.namePlaceholder")}
            autoComplete="off"
            autoFocus={!category}
            leading={
              preview ? undefined : (
                <Tile size="sm" color={color}>
                  <CategoryIcon icon={icon} size="sm" />
                </Tile>
              )
            }
            {...form.register("name")}
          />
        </Field>
        {typeEditable && (
          <Controller
            control={form.control}
            name="type"
            render={({ field }) => (
              <Field
                label={t("categories.form.type")}
                error={validationMessage(t, errors.type?.message)}
              >
                <Segment<CategoryType>
                  label={t("categories.form.type")}
                  value={field.value}
                  onChange={field.onChange}
                  disabled={locked}
                  options={CATEGORY_TYPES.map((option) => ({
                    value: option,
                    label: t(`categoryTypes.${option}`),
                    tone: SEGMENT_TONE[option],
                  }))}
                />
                {(locked || typeLocked) && (
                  <Alert tone="neutral">
                    {t.rich("categories.form.typeLocked", {
                      count: lockedCount,
                      b: (chunks) => <b className="font-semibold">{chunks}</b>,
                      link: (chunks) => (
                        <Link
                          href={{ pathname: "/categories/new", query: { type: currentType } }}
                          className="font-medium text-brand-text underline underline-offset-2"
                        >
                          {chunks}
                        </Link>
                      ),
                    })}
                  </Alert>
                )}
              </Field>
            )}
          />
        )}
        <Controller
          control={form.control}
          name="icon"
          render={({ field }) => (
            <Field
              label={t("categories.form.icon")}
              error={validationMessage(t, errors.icon?.message)}
            >
              <IconGrid
                value={field.value}
                onChange={field.onChange}
                label={t("categories.form.icon")}
                searchLabel={t("categories.form.iconSearch")}
                color={color}
              />
            </Field>
          )}
        />
        <Controller
          control={form.control}
          name="color"
          render={({ field }) => (
            <Field
              label={t("categories.form.color")}
              error={validationMessage(t, errors.color?.message)}
            >
              <SwatchGrid
                value={field.value}
                onChange={field.onChange}
                label={t("categories.form.color")}
              />
            </Field>
          )}
        />
      </div>
      <div className="flex flex-col gap-2">
        {formError && <Alert tone="danger">{t(formError.messageKey)}</Alert>}
        <Button type="submit" size="lg" block loading={mutation.isPending}>
          {submitLabel ?? (category ? t("common.saveChanges") : t("categories.form.create"))}
        </Button>
        {secondaryAction}
        {onCancel && (
          <Button type="button" variant="ghost" size="lg" block onClick={onCancel}>
            {t("common.backToList")}
          </Button>
        )}
      </div>
    </form>
  );
}
