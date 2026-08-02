const finite = (value) => value != null && Number.isFinite(Number(value))
const round2 = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100

export function deriveCreatorBaseHealth(rows = []) {
  return rows.map((row) => {
    const affiliated = finite(row.affiliatedCreators) ? Number(row.affiliatedCreators) : 0
    const monetized30 = finite(row.gmvCreatorsLast30Days) ? Number(row.gmvCreatorsLast30Days) : 0
    const gmv30 = finite(row.gmvTotal30Days) ? Number(row.gmvTotal30Days) : null
    const gmv80Count = finite(row.gmv80CreatorCount30Days) ? Number(row.gmv80CreatorCount30Days) : 0
    const publishedActiveShare = finite(row.gmv80CreatorShareActivePercent30Days)
      ? Number(row.gmv80CreatorShareActivePercent30Days)
      : null

    return {
      ...row,
      gmvPerMonetizedCreator30Days: monetized30 > 0 && gmv30 != null ? round2(gmv30 / monetized30) : null,
      monetizedCoverage30DaysPercent: affiliated > 0 ? round2(monetized30 / affiliated * 100) : null,
      gmv80CreatorShareActivePercent30Days: publishedActiveShare,
      gmv80CreatorShareMonetizedPercent30Days: monetized30 > 0 ? round2(gmv80Count / monetized30 * 100) : null,
    }
  })
}
