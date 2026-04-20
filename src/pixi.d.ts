import type { UnprefixedPixiElements } from "@pixi/react";

declare module "@pixi/react" {
  // Re-export the unprefixed pixi element types as the default PixiElements map
  // so we can use lowercase JSX tags like <pixiGraphics /> without prefixes.
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface PixiElements extends UnprefixedPixiElements {}
}
