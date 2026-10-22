"use client";

import {useSyncExternalStore} from "react";
import {Home, RotateCcw} from "lucide-react";
import english from "../../messages/en.json";
import persian from "../../messages/fa.json";
import ThemeProvider from "@/components/providers/ThemeProvider";
import {BrandIdentity} from "@/components/brand/BrandIdentity";
import {Button} from "@/components/ui/button";
import {RecoveryScreen} from "@/components/modules/recovery/RecoveryScreen";
import {useErrorReport, type ErrorBoundaryProps} from "@/components/modules/recovery/use-error-report";
import "@/styles/globals.css";

const subscribe = () => () => {};
const readLocale = () => window.location.pathname.split("/")[1] === "fa" ? "fa" : "en";

export default function GlobalError({error, reset, unstable_retry}: ErrorBoundaryProps) {
  // The failed locale layout and its i18n provider may be unavailable here.
  const locale = useSyncExternalStore(subscribe, readLocale, () => "en");
  const copy = (locale === "fa" ? persian : english).Recovery;
  useErrorReport(error, "global");
  return <html lang={locale} dir={locale === "fa" ? "rtl" : "ltr"} suppressHydrationWarning>
    <body>
      <ThemeProvider>
        <header className="mx-auto w-full max-w-6xl px-6 pt-8 sm:px-8">
          <a href={`/${locale}`} aria-label={copy.home} className="inline-flex rounded-md"><BrandIdentity /></a>
        </header>
        <RecoveryScreen status="500" copy={copy.error} actions={<>
          <Button onClick={unstable_retry ?? reset}><RotateCcw aria-hidden="true" />{copy.retry}</Button>
          <Button asChild variant="outline"><a href={`/${locale}`}><Home aria-hidden="true" />{copy.home}</a></Button>
        </>} />
      </ThemeProvider>
    </body>
  </html>;
}
