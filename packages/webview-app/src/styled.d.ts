// packages/webview-app/src/styled.d.ts
// extend styled-components DefaultTheme w/ custom theme properties

import 'styled-components';

declare module 'styled-components' {
  export interface DefaultTheme {
    colorBodyForeground: string;
    colorBodyBackground: string;
    colorPreCode: string;
    colorPreBackground: string;
    colorTableHeaderBorder: string;
    colorHeaderBorder: string;
  }
}
