import Image from "next/image";
import {BrandMark} from "./BrandMark";

export function BrandIdentity() {
  return <span aria-hidden="true" dir="ltr" className="inline-flex shrink-0 items-center gap-2.5 whitespace-nowrap">
    <BrandMark className="size-9 shrink-0 text-primary" />
    <Image
      src="/images/dreamservice-wordmark.svg" alt="" width={184} height={32}
      className="h-auto w-[132px] shrink-0 sm:w-[148px] dark:brightness-0 dark:invert"
    />
  </span>;
}
