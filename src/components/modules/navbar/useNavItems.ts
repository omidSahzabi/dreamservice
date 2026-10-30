import { useTranslations } from "next-intl";
import { NavItem } from "./types";

export function useNavItems(): NavItem[] {
  const t = useTranslations("Navbar");

  return [
    { label: t("home"), href: "/" },
    {
      label: t("services"),
      children: [
        {
          label: t("webDesign"),
          href: "/order/order-form",
          description: t("webDesignDesc"),
        },
        {
          label: t("webApp"),
          href: "/order/order-form",
          description: t("webAppDesc"),
        },
        {
          label: t("gameDev"),
          href: "/order/order-form",
          description: t("gameDevDesc"),
        },
        {
          label: t("seo"),
          href: "/order/order-form",
          description: t("seoDesc"),
        },
      ],
    },
    { label: t("about"), href: "/about" },
    { label: t("support"), href: "/support" },
  ];
}
