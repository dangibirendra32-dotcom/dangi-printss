# Thermal Printing and Receipt Assets

## Logos
For Petrol Pumps, I will use high-contrast SVG paths for:
- Indian Oil
- HP (Hindustan Petroleum)
- Bharat Petroleum

## Receipt Logic
- 2-inch paper = 58mm = ~384 pixels.
- Standard character width: 32 chars per line for font A.
- Escape Sequences for ESC/POS:
  - Initial: 1B 40
  - Align Center: 1B 61 01
  - Bold On: 1B 45 01
  - Cut: 1D 56 00
