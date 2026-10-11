import { NextResponse } from "next/server";

import {orderFormConfigSchema} from "@/schemas/orderFormConfig";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const locale = searchParams.get("locale") ?? "fa";
    if (locale !== "en" && locale !== "fa") {
      return NextResponse.json({code: "INVALID_INPUT", error: "Unsupported locale"}, {status: 400});
    }

    const form = await prisma.orderForm.findFirst({
      where: {
        form_key: "order",
        status: "published",
      },
      include: {
        translations: {
          where: {
            locale,
          },
        },

        steps: {
          orderBy: {
            step_order: "asc",
          },

          include: {
            translations: {
              where: {
                locale,
              },
            },

            fields: {
              orderBy: {
                field_order: "asc",
              },

              include: {
                translations: {
                  where: {
                    locale,
                  },
                },

                options: {
                  orderBy: {
                    option_order: "asc",
                  },

                  include: {
                    translations: {
                      where: {
                        locale,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!form) {
      return NextResponse.json(
        {
          code: "FORM_NOT_FOUND", error: "Order form not found",
        },
        {
          status: 404,
        }
      );
    }

    const formTranslation = form.translations[0];

    const missingTranslation = !formTranslation?.title?.trim() || form.steps.some(step =>
      !step.translations[0]?.title?.trim() || step.fields.some(field =>
        !field.translations[0]?.label?.trim() || field.options.some(option => !option.translations[0]?.label?.trim())
      )
    );
    if (missingTranslation) {
      return NextResponse.json({code: "FORM_TRANSLATION_MISSING", error: "Form translation unavailable"}, {status: 503});
    }

    const result = {
      form: {
        id: form.id.toString(),
        key: form.form_key,

        title: formTranslation?.title ?? "",
        description: formTranslation?.description ?? "",

        settings: {
          showProgress: form.show_progress,
          allowBack: form.allow_back,

          submitButtonText:
            getLocalizedValue(
              form.submit_button_text,
              locale
            ),
        },

        steps: form.steps.map((step) => {
          const translation = step.translations[0];

          return {
            id: step.id.toString(),
            key: step.step_key,
            order: step.step_order,

            title: translation?.title ?? "",
            description:
              translation?.description ?? "",

            fields: step.fields.map((field) => {
              const fieldTranslation =
                field.translations[0];

              return {
                id: field.field_key,
                type: field.field_type,

                label:
                  fieldTranslation?.label ?? "",

                description:
                  fieldTranslation?.description ?? "",

                placeholder:
                  fieldTranslation?.placeholder ??
                  getLocalizedValue(
                    field.placeholder,
                    locale
                  ),

                required: field.required,

                validation: field.validation,
                visibility: field.visibility,

                defaultValue:
                  field.default_value ?? null,

                options: field.options.map((option) => {
                  const optionTranslation =
                    option.translations[0];

                  return {
                    value: option.option_value,

                    label:
                      optionTranslation?.label ??
                      "",

                    description:
                      optionTranslation?.description ??
                      "",

                    metadata: option.metadata,
                  };
                }),
              };
            }),
          };
        }),
      },
    };

    const parsed = orderFormConfigSchema.safeParse(result);
    if (!parsed.success) return NextResponse.json({code: "FORM_LOAD_FAILED", error: "Invalid form configuration"}, {status: 503});
    return NextResponse.json(parsed.data);
  } catch {
    return NextResponse.json(
      {
        code: "FORM_LOAD_FAILED", error: "Failed to load order form",
      },
      {
        status: 500,
      }
    );
  }
}

function getLocalizedValue(
  value: unknown,
  locale: "fa" | "en"
): string {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return "";
  }

  const data = value;

  const localizedValue: unknown = Reflect.get(data, locale);

  return typeof localizedValue === "string"
    ? localizedValue
    : "";
}
