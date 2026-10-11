import type { Metadata } from "next";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import {notFound} from "next/navigation";
import {routing} from "../../../i18n/routing";

import QueryProvider from "@/providers/QueryProvider";
import Navbar from "@/components/modules/navbar/Navbar";
import Footer from "@/components/modules/footer/footer";
import { AuthModal } from "@/components/modules/auth/AuthModal";

import { Toaster } from "sonner";

import "@/styles/globals.css";

export function generateStaticParams() {
  return [{ locale: "fa" }, { locale: "en" }];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  const t = await getTranslations({
    locale,
    namespace: "Metadata",
  });

  return {
    title: t("title"),
    description: t("description"),
  };
}

export default async function RootLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const common = await getTranslations({locale, namespace: "Common"});
  const messages = await getMessages({
    locale,
  });

  return (
    <html
      lang={locale}
      dir={locale === "fa" ? "rtl" : "ltr"}
      className="dark"
    >
      <body id="top">
        <NextIntlClientProvider
          locale={locale}
          messages={messages}
        >
          <QueryProvider>
            <Navbar />

            {children}

            <AuthModal />

            <Toaster
              dir={locale === "fa" ? "rtl" : "ltr"}
              containerAriaLabel={common("notifications")}
              toastOptions={{closeButtonAriaLabel: common("close")}}
              position="top-center"
              richColors
            />

            <Footer year={new Date().getUTCFullYear()} />
          </QueryProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
