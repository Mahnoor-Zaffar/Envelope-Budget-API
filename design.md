## Overview

Frontend UI specifications strictly adhering to Apple's Human Interface Guidelines (HIG), focusing on clarity, deference, and depth.

## Typography

- **Primary Font**: San Francisco (SF Pro Text for body, SF Pro Display for headers).
- **Hierarchy**: Large, bold, high-contrast titles with clean, legible secondary text.

## Color Palette

- **Background**: System White (`#FFFFFF`) for light mode, System Black (`#000000`) for dark mode.
- **Surfaces/Cards**: Secondary grouped background (`#F2F2F7` light, `#1C1C1E` dark).
- **Accents**:
  - System Blue (`#007AFF`) for interactive elements.
  - System Green (`#34C759`) for positive balances/deposits.
  - System Red (`#FF3B30`) for overspending alerts/withdrawals.

## UI Elements

- **Envelopes**: Displayed as minimalist cards with rounded corners (`border-radius: 16px`).
- **Materials**: Use of translucent blur effects (frosted glass) for sticky headers or modals.
- **Iconography**: SF Symbols (e.g., `envelope.fill`, `arrow.left.arrow.right` for transfers).
- **Layout**: Generous whitespace, distinct margins (standard 16pt or 20pt padding), removing unnecessary dividers in favor of spatial separation.
- **Interactions**: Smooth spring animations for button presses, swipe-to-delete gestures on envelope lists.
