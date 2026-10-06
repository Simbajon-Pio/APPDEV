export function validatePage(page, pageSize, maxPageSize = 100) {
  const parsedPage = Number(page);
  const parsedSize = Number(pageSize);
  if (!Number.isSafeInteger(parsedPage) || parsedPage < 1) return { page: 1, page_size: maxPageSize, pageError: 'Invalid page.' };
  if (!Number.isSafeInteger(parsedSize) || parsedSize < 1 || parsedSize > maxPageSize) return { page: parsedPage, page_size: maxPageSize, pageError: 'Invalid page size.' };
  return { page: parsedPage, page_size: parsedSize, pageError: '' };
}
export function labelFor(map, value) {
  return map[value] || value || '—';
}
export function statusLabel(value) {
  return ({ draft: 'Draft', pending_lupon: 'Pending Lupon', settled_at_desk: 'Settled at Desk', referred_to_pnp: 'Referred to PNP', unresolved: 'Unresolved', pending_review: 'Pending review', approved: 'Approved', rejected: 'Rejected' })[value] || value || 'Unknown status';
}
export function categoryLabel(value) {
  return ({ curfew_violation: 'Curfew Violation', noise_disturbance: 'Videoke / Noise Disturbance', property_dispute: 'Property Dispute', physical_altercation: 'Physical Altercation', financial_dispute: 'Debt / Financial Dispute', others: 'Others' })[value] || value || '—';
}
