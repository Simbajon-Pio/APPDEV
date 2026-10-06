export const CATEGORIES = [
  ['curfew_violation', 'Curfew Violation'], ['noise_disturbance', 'Videoke / Noise Disturbance'],
  ['property_dispute', 'Property Dispute'], ['physical_altercation', 'Physical Altercation'],
  ['financial_dispute', 'Debt / Financial Dispute'], ['others', 'Others']
];
export const CATEGORY_VALUES = new Set(CATEGORIES.map(([value]) => value));
export const STATUS_VALUES = new Set(['draft', 'pending_lupon', 'settled_at_desk', 'referred_to_pnp', 'unresolved']);
export const RESIDENCY_VALUES = new Set(['resident', 'non_resident', 'unknown']);
export const REVIEW_VALUES = new Set(['pending_review', 'approved', 'rejected']);
export const INITIAL_STATUS_VALUES = new Set(['draft', 'pending_lupon', 'settled_at_desk', 'referred_to_pnp']);
