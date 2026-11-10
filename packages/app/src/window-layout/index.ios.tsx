import { useCallback, useMemo, useState, type ReactNode } from "react";
import {
  StatusBar,
  StyleSheet,
  View,
  type NativeSyntheticEvent,
  type ViewProps,
} from "react-native";
import { requireNativeModule, requireNativeViewManager } from "expo-modules-core";
import { SafeAreaInsetsContext, useSafeAreaInsets } from "react-native-safe-area-context";
import { TopBandContext, WindowLayoutContext, useWindowLayout } from "./context";
import { resolveSafeAreaInsets, resolveTopBand, type WindowLayout } from "./model";
import {
  getVerticalBar,
  installVerticalBarController,
  reportVerticalBarLayout,
  subscribeVerticalBar,
  type VerticalBarBehavior,
} from "./vertical-bar";

export { useWindowLayout } from "./context";
export { WindowLayoutActions, WindowLayoutActionsHost } from "./actions";
export { WindowLayoutSurface, WindowLayoutDivisionGap } from "./surface";
export { useStatusBarTapsReachHeader, useTopBand } from "./context";
export {
  resolveDesktopDivisionLayout,
  resolveWorkspaceActionPlacement,
  resolveWorkspaceBarActions,
} from "./model";
export type { DesktopDivisionLayout, TopBand, WindowLayout, WindowLayoutRect } from "./model";
export {
  getVerticalBar,
  setVerticalBarBehavior,
  subscribeVerticalBar,
  useVerticalBarDisabled,
  type VerticalBarBehavior,
  type VerticalBarState,
} from "./vertical-bar";

const GeometryProbe = requireNativeViewManager<
  ViewProps & {
    onGeometryChange: (event: NativeSyntheticEvent<WindowLayout>) => void;
  }
>("PaseoWindowLayout");

const windowLayoutModule = requireNativeModule<{
  // Absent from native builds that predate the vertical bar control.
  setVerticalBarBehavior?: (behavior: VerticalBarBehavior) => void;
}>("PaseoWindowLayout");
installVerticalBarController((behavior) => windowLayoutModule.setVerticalBarBehavior?.(behavior));

/**
 * With a folded iPhone's vertical bar off, iOS moves the status bar to a pill at the top right.
 * The app hides it instead, so the content keeps the whole screen, and shows it again when the bar
 * returns. Only this window turns the bar off, so other devices never reach this.
 */
let statusBarHidden = false;
subscribeVerticalBar(() => {
  const hidden = getVerticalBar().behavior === "disabled";
  if (hidden === statusBarHidden) return;
  statusBarHidden = hidden;
  StatusBar.setHidden(hidden, "fade");
});

export function WindowLayoutProvider({ children }: { children: ReactNode }) {
  const [geometry, setGeometry] = useState<WindowLayout | null>(null);
  const onGeometryChange = useCallback((event: NativeSyntheticEvent<WindowLayout>) => {
    reportVerticalBarLayout(event.nativeEvent);
    setGeometry(event.nativeEvent);
  }, []);
  return (
    <WindowLayoutContext.Provider value={geometry}>
      <View style={styles.root}>
        <GeometryProbe
          pointerEvents="none"
          style={StyleSheet.absoluteFill}
          onGeometryChange={onGeometryChange}
        />
        <WindowSafeAreaInsets>{children}</WindowSafeAreaInsets>
      </View>
    </WindowLayoutContext.Provider>
  );
}

/**
 * The one top and bottom inset every descendant reads through `useSafeAreaInsets()`, and
 * the top band that `WindowChromeProvider` reads through `useTopBand()`.
 */
function WindowSafeAreaInsets({ children }: { children: ReactNode }) {
  const systemInsets = useSafeAreaInsets();
  const layout = useWindowLayout();
  const insets = useMemo(() => resolveSafeAreaInsets(systemInsets, layout), [systemInsets, layout]);
  const topBand = useMemo(
    () => resolveTopBand(systemInsets.top, layout),
    [systemInsets.top, layout],
  );
  return (
    <TopBandContext.Provider value={topBand}>
      <SafeAreaInsetsContext.Provider value={insets}>{children}</SafeAreaInsetsContext.Provider>
    </TopBandContext.Provider>
  );
}

const styles = StyleSheet.create({ root: { flex: 1 } });
