export function selectedDocumentId<T extends { id: string }>(variants: T[], selected?: string, chosen?: string) {
  return [selected, chosen].find(id => variants.some(doc => doc.id === id)) ?? variants[0]?.id;
}
