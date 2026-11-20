/**
 * How a bill, its measurement sheet and its summary can be laid out when printed. The layout only changes how the
 * same entries are shown: the amounts of the bill never depend on it (a "Round off" row covers a rupee or two).
 *
 *   entry  every entry on its own line (older bills only)
 *   room   floor → room → one line per work item
 *   floor  floor → one line per work item for all its rooms
 */
export const BILL_LAYOUTS = Object.freeze({ entry: 'Every entry', room: 'By room', floor: 'By floor' });

/** The layout a bill opens in: new bills by room, older bills as they always printed. */
export const defaultLayout = (bill) => (bill?.billStyle === 'room' ? 'room' : 'entry');

/** The layouts offered for a bill. */
export const layoutOptions = (bill) => (bill?.billStyle === 'room' ? ['room', 'floor'] : ['entry', 'room', 'floor']);

/** The layout to use for one document: the chosen one when the bill offers it, else the default. */
export function resolveLayout(bill, layouts, documentType) {
  const wanted = layouts?.[documentType];
  return layoutOptions(bill).includes(wanted) ? wanted : defaultLayout(bill);
}
