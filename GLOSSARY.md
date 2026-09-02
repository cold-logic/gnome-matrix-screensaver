# Project Glossary & Visual Architecture Reference

This document provides definitions and design context for core terminology, typography principles, and graphical architecture concepts used across **`matrix-screensaver@cold-logic`**.

---

## Typography & Glyph Systems

### Ideogram
An **ideogram** (or *ideograph*) is a graphic symbol that directly conveys an **idea or concept**, rather than representing a specific phoneme (speech sound) in a spoken language.
* **Distinction from Phonograms & Pictograms:**
  - **Phonogram:** An alphabetic letter representing a speech sound (e.g., Latin letters `c`, `a`, `t`).
  - **Pictogram:** A literal visual depiction of a physical object (e.g., 🚗).
  - **Ideogram:** An abstract concept or symbol understood universally regardless of language (e.g., `+`, `&`, `!`, `?`, or icons like 🔍 and ⚙️).
* **Significance to Matrix Digital Rain:**
  - Traditional Matrix rain uses Japanese **Katakana** and ideographic glyphs designed to occupy a uniform square bounding box (1:1 aspect ratio / *em-square*). Because each character fills the cell uniformly both horizontally and vertically, falling vertical streams appear naturally dense and balanced.
  - In contrast, Western Latin alphabets and syntax characters (e.g., HTML tags `/`, `;`, `{`, `}`, `i`, `l`) are inherently narrow, requiring custom line-height tightening and atlas scaling (such as our **Row Spacing / Tightness** setting) to achieve cinematic stream density.

### Glyph Atlas
A single composite texture map combining a grid of individual character symbols into a continuous bitmap surface. In this project, the atlas is generated either as an authentic RGBA texture mask (`matrixcode_mask_rgb.png`) or procedural vector surfaces via Cairo and Pango, which the fragment shader slices into discrete coordinates using normalized UV offsets.

### Monospace / Fixed-Width
A typography system where each character occupies the exact same horizontal bounding box. Essential for calculating columnar rain coordinates without character clipping.

---

## Graphics & Rendering Pipeline

### Cogl & Clutter
The lower-level GPU abstraction and scene graph libraries powering GNOME Shell and Mutter on Wayland:
* **Clutter:** The scenegraph actor framework managing UI elements, monitor bounds, and event capture.
* **Cogl:** The 3D graphics pipeline API used to allocate pixel buffers, create pipelines, bind fragment shaders, and manage hardware texture samplers (e.g., `cogl_sampler_0`).

### Fragment Shader (GLSL)
A GPU program executed per-pixel that calculates the color, luminescence decay, and alpha transparency of each falling character in the matrix grid.

### Zero-Overhead Idle
An architectural mandate requiring that screensaver animation loops and frame timers completely yield (0% CPU and 0% GPU usage) when the user is actively using the desktop. Animation timers are only triggered when the Mutter idle monitor signals inactivity.

### Phosphor Bloom & Falloff
An optical emulation of cathode-ray tube (CRT) monitors, where a leading green or teal character radiates high luminescence followed by an exponential phosphorescent decay trail.
