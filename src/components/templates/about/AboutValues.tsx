import { useTranslations } from "next-intl";
import { HeartHandshake, Target, Lightbulb } from "lucide-react";

export default function AboutValues() {
  const t = useTranslations("About.Values");
  
  const values = [
    { icon: HeartHandshake, key: "one", color: "text-success", bg: "bg-success/10" },
    { icon: Target, key: "two", color: "text-primary", bg: "bg-primary/10" },
    { icon: Lightbulb, key: "three", color: "text-warning", bg: "bg-warning/10" },
  ];

  return (
    <section className="mx-auto max-w-7xl px-5 py-28">
      <h2 className="text-3xl font-black text-foreground">{t("title")}</h2>
      <div className="grid gap-5 md:grid-cols-3 mt-12">
        {values.map((v) => {
          const Icon = v.icon;
          return (
            <div key={v.key} className="rounded-2xl border border-border p-7 bg-card">
              <div className={`mb-6 size-12 flex items-center justify-center rounded-2xl ${v.bg}`}>
                <Icon className={`size-6 ${v.color}`} />
              </div>
              <h3 className="text-xl font-bold text-foreground">{t(`items.${v.key}.title`)}</h3>
              <p className="mt-3 text-sm text-muted-foreground">{t(`items.${v.key}.description`)}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
