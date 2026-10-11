import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";

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

  const messages = await getMessages({
    locale,
  });

  return (
    <html
      lang={locale}
      dir={locale === "fa" ? "rtl" : "ltr"}
      className="dark"
    >
      <body>
        <NextIntlClientProvider
          locale={locale}
          messages={messages}
        >
          <QueryProvider>
            <Navbar />

            {children}

            <AuthModal />

            <Toaster
              position="top-center"
              richColors
            />

            <Footer />
          </QueryProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
