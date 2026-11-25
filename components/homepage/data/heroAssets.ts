const heroDirectory = '/world-tree-assets/hero'
const waterDirectory = '/assets/world-tree/water'

export const HERO_ASSETS = {
  daySource: `${heroDirectory}/yggit_hero_day_animated_background_no_card.webp`,
  nightSource: `${heroDirectory}/hero_repaired_master_1672x941.webp`,
  dayBase: `${heroDirectory}/hero_day_preview_1672x941.webp`,
  nightBase: `${heroDirectory}/hero_night_preview_1672x941.webp`,
  landingDayBase: `${heroDirectory}/landing-day-scene.webp`,
  landingNightBase: `${heroDirectory}/landing-night-scene.webp`,
  cardShell: `${heroDirectory}/hero_card_glass_shell.webp`,
  dayOverhang: `${heroDirectory}/hero_card_day_overhang.webp`,
  nightOverhang: `${heroDirectory}/hero_card_night_overhang.webp`,
  waterMask: `${waterDirectory}/water-mask.webp`,
  waterFlow: `${waterDirectory}/water-flow-map.webp`,
  waterNormal: `${waterDirectory}/water-normal.webp`,
  dayWaterBanks: `${waterDirectory}/water-foreground.webp`,
  nightWaterBanks: `${waterDirectory}/water-night-foreground.webp`,
  waterConfig: `${waterDirectory}/water-config.json`,
} as const
