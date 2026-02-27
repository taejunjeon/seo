export const toDateString = (date: Date) => date.toISOString().slice(0, 10);

export const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return toDateString(d);
};

