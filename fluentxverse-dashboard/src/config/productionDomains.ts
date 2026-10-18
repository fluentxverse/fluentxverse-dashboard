export function productionEndpoints(hostname: string) {
  for (const domain of ['fluentxverse.com', 'fluentxverse.xyz']) {
    if (['', 'www.', 'student.', 'tutor.', 'dashboard.'].some(prefix => hostname === prefix + domain)) {
      return { apiUrl: `https://api.${domain}`, socketUrl: `https://ws.${domain}` };
    }
  }
  return undefined;
}
