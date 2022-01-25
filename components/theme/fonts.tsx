import { Global } from '@emotion/react'

export const FontsGlobal = () => (
  <Global
    styles={`
      @font-face {
        font-family: 'Virgil';
        font-style: normal;
        font-weight: 400;
        font-display: swap;
        src: url('/assets/fonts/FG_Virgil.woff2') format('woff2'),
            url('/assets/fonts/FG_Virgil.woff') format('woff');
      }
      @font-face {
        font-family: 'Cascadia';
        font-style: normal;
        font-weight: 400;
        font-display: swap;
        src: url('/assets/fonts/Cascadia.woff2') format('woff2'),
            url('/assets/fonts/Cascadia.woff') format('woff');
      }
    `}
  />
)
