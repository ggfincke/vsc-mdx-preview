import 'styled-components';

/**
 * Extend styled-components DefaultTheme with our custom theme properties.
 */
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
