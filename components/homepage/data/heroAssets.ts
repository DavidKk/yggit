const heroDirectory = '/world-tree-assets/hero'
const waterDirectory = '/assets/world-tree/water'

export const HERO_ASSETS = {
  daySource: `${heroDirectory}/yggit_hero_day_animated_background_no_card.png`,
  nightSource: `${heroDirectory}/hero_repaired_master_1672x941.png`,
  dayBase: `${heroDirectory}/hero_day_preview_1672x941.png`,
  nightBase: `${heroDirectory}/hero_night_preview_1672x941.png`,
  landingDayBase: `${heroDirectory}/landing-day-scene.webp`,
  landingNightBase: `${heroDirectory}/landing-night-scene.webp`,
  cardShell: `${heroDirectory}/hero_card_glass_shell.png`,
  dayOverhang: `${heroDirectory}/hero_card_day_overhang.png`,
  nightOverhang: `${heroDirectory}/hero_card_night_overhang.png`,
  waterMask: `${waterDirectory}/water-mask.png`,
  waterFlow: `${waterDirectory}/water-flow-map.png`,
  waterNormal: `${waterDirectory}/water-normal.png`,
  dayWaterBanks: `${waterDirectory}/water-foreground.png`,
  nightWaterBanks: `${waterDirectory}/water-night-foreground.png`,
  waterConfig: `${waterDirectory}/water-config.json`,
} as const
