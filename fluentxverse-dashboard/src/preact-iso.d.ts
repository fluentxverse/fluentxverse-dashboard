// Type augmentation to fix preact-iso Router children type
// Router accepts VNode | VNode[] but the types are too strict
import 'preact-iso';

declare module 'preact-iso' {
  import { VNode, ComponentChildren } from 'preact';

  export interface RouterProps {
    children?: ComponentChildren;
    onRouteChange?: (url: string) => void;
    onLoadEnd?: () => void;
    onLoadStart?: () => void;
  }

  export function Router(props: RouterProps): VNode;
}
