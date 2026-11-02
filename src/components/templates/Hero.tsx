import {getTranslations} from "next-intl/server";
import {cn} from "@/lib/utils";
import {BrandMark} from "@/components/brand/BrandMark";
import {IndustryCounters} from "@/components/modules/cinematic/IndustryCounters";
import {CinematicStory} from "@/components/modules/cinematic/CinematicStory";
import {ProjectCTA} from "@/components/modules/cinematic/ProjectCTA";
import styles from "@/components/modules/cinematic/Cinematic.module.css";

export default async function Hero() {
  const t = await getTranslations("Cinematic");
  return (
    <div className={styles.root}>
      <div className={styles.noise} aria-hidden="true" />
      <section className={cn(styles.hero, styles.wrap)} aria-labelledby="cinematic-heading">
        <div className={styles["hero-ambient"]} aria-hidden="true" />
        <div className={styles.eyebrow}>{t("eyebrow")}</div>
        <h1 className={styles["hero-title"]} id="cinematic-heading"><span>{t("hero1")}</span><span className={styles.accent}>{t("hero2")}</span></h1>
        <p className={styles["hero-desc"]}>{t("heroDesc")}</p>
        <div className={styles["hero-cta-row"]}>
          <a href="#cinematic-story" className={styles["primary-btn"]}><span>{t("experience")}</span><span className={styles["btn-arrow"]} aria-hidden="true">↗</span></a>
          <a href="#cinematic-end" className={styles["outline-btn"]}>{t("skip")}</a>
        </div>
        <IndustryCounters />
        <div className={styles["scroll-cue"]}><span className={styles["scroll-mouse"]} aria-hidden="true"><i /></span><span>{t("scroll")}</span></div>
      </section>
      <div className={styles["transition-line"]}>{t("transition")}</div>
      <CinematicStory />
      <section className={styles.outro} id="cinematic-end" aria-labelledby="cinematic-outro" tabIndex={-1}>
        <BrandMark className={styles["outro-brand"]} />
        <div className={styles.eyebrow}>{t("outroEyebrow")}</div>
        <h2 id="cinematic-outro"><span>{t("outroA")}</span><br /><span className={styles.accent}>{t("outroB")}</span></h2>
        <p>{t("outroP")}</p>
        <ProjectCTA />
      </section>
    </div>
  );
}
