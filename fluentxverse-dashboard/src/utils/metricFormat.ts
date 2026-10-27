export function formatBytes(value: number, rate = false): string {
  const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB'];
  const index = value > 0 ? Math.max(0, Math.min(4, Math.floor(Math.log(value) / Math.log(1024)))) : 0;
  return `${(value / 1024 ** index).toLocaleString(undefined, { maximumFractionDigits: index ? 2 : 0 })} ${units[index]}${rate ? '/s' : ''}`;
}
