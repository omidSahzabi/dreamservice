import {BrandWordmark} from "./BrandWordmark";

export function BrandIdentity() {
  return <span aria-hidden="true" dir="ltr" className="ds-brand inline-flex h-8 w-[172px] shrink-0 items-center sm:h-9 sm:w-[200px]">
    <BrandWordmark compact className="h-full w-full sm:hidden" />
    <BrandWordmark className="hidden h-full w-full sm:block" />
  </span>;
}
