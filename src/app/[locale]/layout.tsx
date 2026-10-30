import type { Metadata } from "next";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import {notFound} from "next/navigation";
import {routing} from "../../../i18n/routing";
import {publicSite} from "@/lib/site";
import {previewLoginConfig} from "@/lib/auth/preview-config";

import QueryProvider from "@/providers/QueryProvider";
import ThemeProvider from "@/components/providers/ThemeProvider";
import Navbar from "@/components/modules/navbar/Navbar";
import Footer from "@/components/modules/footer/footer";
import { AuthModalHost } from "@/components/modules/auth/AuthModalHost";

import { ThemedToaster } from "@/components/providers/ThemedToaster";

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
    metadataBase: new URL(publicSite.url),
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
      suppressHydrationWarning
    >
      <body id="top">
        <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-[100] focus:rounded-xl focus:bg-background focus:px-5 focus:py-3 focus:text-foreground">
          {common("skipToContent")}
        </a>
        <NextIntlClientProvider
          locale={locale}
          messages={messages}
        >
          <ThemeProvider>
            <QueryProvider>
              <Navbar />

              <div id="main-content" tabIndex={-1}>{children}</div>

              <AuthModalHost previewLoginEnabled={Boolean(previewLoginConfig())} />

              <ThemedToaster
                dir={locale === "fa" ? "rtl" : "ltr"}
                containerAriaLabel={common("notifications")}
                toastOptions={{closeButtonAriaLabel: common("close")}}
                position="top-center"
                richColors
              />

              <Footer year={new Date().getUTCFullYear()} />
            </QueryProvider>
          </ThemeProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
