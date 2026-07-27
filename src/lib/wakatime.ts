export const MAX_WAKATIME_ROWS = 7

export const visibleWakatimeRows = (heightInRem: number): number => {
  if (heightInRem < 7) return 3
  if (heightInRem < 8.5) return 4
  if (heightInRem < 10) return 5
  // Lowered from 20rem so the 7th language fits the tile at its usual height.
  if (heightInRem < 13) return 6
  return MAX_WAKATIME_ROWS
}
