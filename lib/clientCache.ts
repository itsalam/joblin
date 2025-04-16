const emailCache = new Map<string, CategorizedEmail>();

export const getEmailIem = (id: string) => emailCache.get(id);
export const setEmailItem = (id: string, data: CategorizedEmail) =>
  emailCache.set(id, data);
