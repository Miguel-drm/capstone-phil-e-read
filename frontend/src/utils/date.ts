export const formatDateHuman = (date: Date): string => {
  if (!(date instanceof Date)) return 'N/A';
  if (Number.isNaN(date.getTime())) return 'N/A';

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfToday.getDate() - 1);

  const timeFmt = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });
  const dateTimeFmt = new Intl.DateTimeFormat(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit'
  });

  if (date >= startOfToday) {
    return `Today, ${timeFmt.format(date)}`;
  }
  if (date >= startOfYesterday) {
    return `Yesterday, ${timeFmt.format(date)}`;
  }
  return dateTimeFmt.format(date);
};

export const parseMaybeDate = (value: any): Date | null => {
  if (!value && value !== 0) return null;
  try {
    if (typeof value?.toDate === 'function') {
      const d = value.toDate();
      return Number.isNaN(d?.getTime()) ? null : d;
    }
    if (typeof value === 'object' && typeof value.seconds === 'number') {
      const ms = value.seconds * 1000 + (typeof value.nanoseconds === 'number' ? Math.floor(value.nanoseconds / 1e6) : 0);
      const d = new Date(ms);
      return Number.isNaN(d.getTime()) ? null : d;
    }
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
    if (typeof value === 'number') {
      const d = new Date(value);
      return Number.isNaN(d.getTime()) ? null : d;
    }
    if (typeof value === 'string') {
      const d = new Date(value);
      return Number.isNaN(d.getTime()) ? null : d;
    }
  } catch {}
  return null;
};


