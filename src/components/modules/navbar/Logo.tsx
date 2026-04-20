import Image from "next/image";
import Link from "next/link";
import LogoSvg from "@/../public/images/dreamservice-logo.svg";

export default function Logo() {
  return (
    <Link href="/" className="flex items-center">
      <Image
        src={LogoSvg}
        alt="BugLine Logo"
        width={120}
        height={32}
        priority
        className="object-contain mr-5"
      />
    </Link>
  );
}