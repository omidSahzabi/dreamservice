import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

type AuthButtonProps = {
  variant?: "default" | "mobile";
};

export default function AuthButton({ variant = "default" }: AuthButtonProps) {
  const baseClasses =
    "rounded-xl border-cyan-400/50 text-white hover:bg-cyan-400/10 hover:text-white flex items-center gap-2";

  const mobileClasses = variant === "mobile" ? "justify-between" : "";

  return (
    <Button variant="outline" className={`${baseClasses} ${mobileClasses}`}>
      <Avatar className="w-6 h-6 bg-slate-800">
        <AvatarFallback className="text-xs">U</AvatarFallback>
      </Avatar>
      <span>پروفایل یا ورود</span>
    </Button>
  );
}