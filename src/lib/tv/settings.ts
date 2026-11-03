export function tvSettings(s: { tvCommercialsEnabled: boolean; tvBreakEvery: number; tvBreakSeconds: number; tvBugPath: string | null; tvBugPosition: string; tvBugSize: string; tvBugOpacity: number; tvLayout: string }) {
  return {
    enabled: s.tvCommercialsEnabled, breakEvery: s.tvBreakEvery, breakSeconds: s.tvBreakSeconds,
    bugPath: s.tvBugPath, bugPosition: s.tvBugPosition, bugSize: s.tvBugSize, bugOpacity: s.tvBugOpacity, layout: s.tvLayout,
  };
}
