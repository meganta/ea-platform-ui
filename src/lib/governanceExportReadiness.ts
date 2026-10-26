/**
 * When a governance review can be exported - the backend's rule
 * (governance-export-readiness.ts), the same for Word and PowerPoint: the
 * review has finished and its report is saved. A review held for manual
 * review exports too, with its decision marked provisional.
 */
export type GovernanceExportReadiness = { available: boolean; held: boolean }

export function governanceExportReadiness(status: string | null | undefined, hasReport: boolean): GovernanceExportReadiness {
  const available = hasReport && (status === 'COMPLETED' || status === 'READY_FOR_REVIEW')
  return { available, held: available && status === 'READY_FOR_REVIEW' }
}
