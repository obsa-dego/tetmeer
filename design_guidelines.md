# TETMEER - Design Guidelines

## Design Approach
**Reference-Based: Modern Gaming UI** - Drawing inspiration from block puzzle games, Monument Valley, and premium mobile games (Sky: Children of Light, Alto's Adventure). Focus on minimalist elegance with premium feel through subtle depth, refined animations, and spatial awareness that complements the 3D gameplay.

## Typography System

**Primary Font:** Outfit or Space Grotesk (geometric, modern, game-appropriate)
**Secondary Font:** Inter (UI elements, stats, leaderboards)

**Hierarchy:**
- Game Title/Logo: 48px-64px, Bold (700)
- Section Headers: 32px-40px, Semibold (600)
- Score Display: 28px-36px, Bold (700) - monospace variant
- Primary UI Text: 16px-18px, Medium (500)
- Secondary/Meta: 14px, Regular (400)
- Small Labels: 12px, Medium (500)

## Layout System

**Spacing Primitives:** Tailwind units of 2, 4, 8, 12, 16 for consistent rhythm
- Micro spacing: p-2, gap-2
- Component spacing: p-4, m-4, gap-4
- Section spacing: p-8, gap-8
- Major sections: p-12, p-16

**Grid Structure:**
- Game container: Full viewport with fixed aspect ratio overlay
- UI panels: Floating cards with backdrop blur (backdrop-blur-md)
- Responsive: Single column mobile, asymmetric desktop layout

## Core Screens & Layouts

### 1. Main Menu Screen
- Centered hero section with game title
- Large primary CTA: "Play Game" (prominent, glowing effect)
- Secondary actions: "Leaderboard", "Account", "How to Play" (grid layout, 2 columns)
- Bottom: Ad placement zone (fixed height, subtle divider)

### 2. Game View
**Layout Structure:**
- Center: Three.js canvas (full viewport, z-index base)
- Top overlay (absolute): Score counter (left), time/level (center), settings icon (right)
- Left panel (floating): Next piece preview, hold piece display
- Right panel (floating): Current score breakdown, combo counter, level progress
- Bottom: Advertisement bar (h-20, semi-transparent backdrop, always visible)

**Overlay Specifications:**
- All UI panels use glass morphism: backdrop-blur-xl, bg-opacity-10, border with subtle glow
- Panels have rounded-2xl corners, drop shadows
- Maintain 4-8 unit margins from viewport edges
- Panels auto-hide during active rotation (fade out on camera movement)

### 3. Leaderboard Screen
- Full-screen layout with header
- Filter tabs: "Daily", "Weekly", "All-Time" (horizontal tabs)
- Ranked list with alternating subtle backgrounds
- Each entry: Rank badge, username, score, achievement icons
- Pagination at bottom
- "Back to Menu" button (top-left)

### 4. Account Dashboard
- Two-column desktop / stacked mobile
- Left: Profile card (avatar, username, stats summary, achievement badges)
- Right: Stats breakdown (games played, high score, win rate, play time)
- Below: Purchase history, subscription status if premium
- Bottom: Ad zone

### 5. Payment/Premium Modal
- Centered modal overlay (max-w-2xl)
- Premium benefits showcase (icon + text grid, 2 columns)
- Pricing cards (3 tiers if applicable: monthly, yearly, lifetime)
- Secure payment badges
- Close button (top-right)

## Component Library

### Navigation
- Floating hamburger menu (top-left, when in-game)
- Modal side drawer for full menu
- Tab navigation for sections (underline indicator)

### Buttons
**Primary CTA:** Large, rounded-full, gradient background with glow, bold text
**Secondary:** Outlined, rounded-lg, hover fill transition
**Icon Buttons:** Square (w-12 h-12), rounded-lg, single icon centered
**On-image buttons:** backdrop-blur-md background, semi-transparent

### Cards & Panels
- Glass morphism treatment throughout
- Rounded-2xl corners
- Subtle borders (border opacity 20%)
- Drop shadows for depth (shadow-2xl)
- Padding: p-8 for content

### Data Displays
**Score Counter:** Monospace font, large size, animated number changes
**Progress Bars:** Rounded-full, gradient fill, height 2-3 units
**Statistics Grid:** 2-3 columns, icon + label + value format
**Leaderboard Rows:** Hover state with background shift, rank badges with gradient

### Forms (Account/Payment)
- Input fields: rounded-lg, backdrop-blur, border focus glow
- Labels: Small, uppercase, letter-spacing wide
- Validation: Inline messages below fields
- Submit buttons: Full-width on mobile, auto-width desktop

### Modals & Overlays
- Centered with overlay backdrop (bg-black/60)
- Max-width constraints (max-w-md to max-w-4xl based on content)
- Close icon (top-right corner)
- Slide-in animation from bottom on mobile

### Advertisement Container
- Fixed bottom position, h-20
- Subtle top border separator
- Semi-transparent backdrop
- Maintains visibility but non-intrusive
- Clear label: "Advertisement" in small text

## Animation Specifications

### Block Destruction (Critical Feature)
- Cascading disintegration from impact point
- Each block: 150ms delay between adjacent blocks
- Effect: Scale down + fade out + slight float upward
- Particle effect: Minimal geometric shards (4-6 per block)
- No screen shake or excessive effects

### UI Transitions
- Menu transitions: 300ms ease-out
- Panel appearance: Fade + slide (200ms)
- Score updates: Number morph animation
- Button interactions: Scale 0.95 on press (100ms)

### Camera Rotation Feedback
- UI panels fade to 30% opacity during rotation
- Restore on rotation stop (400ms ease-in)

## Responsive Breakpoints

**Mobile (<768px):**
- Single-column layouts
- Floating panels stack vertically with reduced size
- Touch-optimized button sizes (min 44px)
- Simplified leaderboard (hide secondary stats)

**Tablet (768px-1024px):**
- Two-column where applicable
- Side panels appear as bottom drawers
- Maintain aspect ratio for game canvas

**Desktop (>1024px):**
- Full asymmetric layout with side panels
- Utilize horizontal space for stats
- Larger touch targets remain accessible

## Images

**Hero Image:** None - This is a game interface, no traditional hero needed. The Three.js game canvas IS the hero.

**Profile Avatars:** Circular, w-16 h-16 (profile), w-24 h-24 (account page)

**Achievement Icons:** Custom illustrated badges, 32x32 or 48x48, colorful with glow effects

**Background Patterns:** Subtle geometric grid or dot pattern (low opacity) behind panels for depth