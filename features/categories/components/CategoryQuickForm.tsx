"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { Controller, useForm, useWatch } from "react-hook-form";

import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { IconGrid } from "@/components/ui/IconGrid";
import { SwatchGrid } from "@/components/ui/Swatch";
import { Tile } from "@/components/ui/Tile";
import { fieldErrors, presentError } from "@/lib/api/errors";
import { validationMessage } from "@/lib/i18n/validation";
import { CategoryIcon } from "@/lib/icons/CategoryIcon";
import type { Category } from "@/types/api";

import type { CategoryType } from "../api";
import { useCreateCategory } from "../hooks";
import { categoryFormSchema, type CategoryFormValues } from "../schemas";

interface CategoryQuickFormProps {
  type: CategoryType;
  initialName?: string;
  onCreated: (category: Category) => void;
  onCancel?: () => void;
}

export function CategoryQuickForm({
  type,
  initialName = "",
  onCreated,
  onCancel,
}: CategoryQuickFormProps) {
  const t = useTranslations();
  const createCategory = useCreateCategory();
  const form = useForm<CategoryFormValues>({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: { name: initialName, icon: "tag", color: "BLUE", type },
  });
  const { errors } = form.formState;
  const serverFields = fieldErrors(createCategory.error);
  const formError =
    createCategory.error && Object.keys(serverFields).length === 0
      ? presentError(createCategory.error)
      : null;
  const color = useWatch({ control: form.control, name: "color" });
  const icon = useWatch({ control: form.control, name: "icon" });

  const submit = form.handleSubmit(async (values) => {
    try {
      onCreated(await createCategory.mutateAsync(values));
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
      {formError && <Alert tone="danger">{t(formError.messageKey)}</Alert>}
      <div className="flex flex-col gap-3">
        <Field
          label={t("categories.form.name")}
          error={validationMessage(t, errors.name?.message ?? serverFields.name)}
        >
          <Input
            placeholder={t("categories.form.namePlaceholder")}
            autoComplete="off"
            autoFocus
            leading={
              <Tile size="sm" color={color}>
                <CategoryIcon icon={icon} size="sm" />
              </Tile>
            }
            {...form.register("name")}
          />
        </Field>
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
        <Button type="submit" size="lg" block loading={createCategory.isPending}>
          {t("categories.form.create")}
        </Button>
        {onCancel && (
          <Button type="button" variant="ghost" size="lg" block onClick={onCancel}>
            {t("common.backToList")}
          </Button>
        )}
      </div>
    </form>
  );
}
