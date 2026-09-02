/**
 * GLSL Fragment Shader definitions and color parser for Teal Matrix Screensaver.
 */

export const GLYPH_ATLAS_COLUMNS = 8;
export const GLYPH_ATLAS_ROWS = 8;
export const GLYPH_ATLAS_SIZE = 512;

export const SHADER_DECLARATIONS = `
uniform sampler2D cogl_sampler_0;
uniform float matrix_time;
uniform float matrix_columns;
uniform float matrix_rows;
uniform float matrix_glow;
uniform float matrix_glyph_scale;
uniform float matrix_speed;
uniform float matrix_stream_density;
uniform float matrix_soft_blur;
uniform float matrix_glyph_count;
uniform vec3 matrix_rain_color;
uniform vec3 matrix_cursor_color;

float matrix_hash(float value) {
    return fract(sin(value * 12.9898) * 43758.5453);
}

vec4 matrix_glyph_sample(float glyph_index, vec2 local) {
    vec2 atlas_cell = vec2(
        mod(glyph_index, ${GLYPH_ATLAS_COLUMNS}.0),
        floor(glyph_index / ${GLYPH_ATLAS_COLUMNS}.0));
    vec2 atlas_uv = (atlas_cell + clamp(local, 0.015, 0.985)) /
        vec2(${GLYPH_ATLAS_COLUMNS}.0, ${GLYPH_ATLAS_ROWS}.0);
    return texture2D(cogl_sampler_0, atlas_uv);
}

float matrix_glyph_alpha(float glyph_index, vec2 local) {
    vec4 tex = matrix_glyph_sample(glyph_index, local);
    return max(max(tex.r, tex.g), max(tex.b, tex.a));
}

vec3 matrix_drop(float head, float row, float drop_length, float cell_height) {
    float distance_from_head = head - row;

    if (distance_from_head < 0.0 || distance_from_head > drop_length)
        return vec3(0.0);

    float tail = pow(max(0.0, 1.0 - distance_from_head / drop_length), 1.35);
    float cursor = 1.0 - smoothstep(0.0, cell_height * 0.92, distance_from_head);
    return vec3(tail, cursor, 0.0);
}
`;

export const SHADER_CODE = `
vec2 screen_uv = cogl_tex_coord_in[0].xy;
vec2 grid_position = screen_uv * vec2(matrix_columns, matrix_rows);
vec2 cell = floor(grid_position);
vec2 within_cell = fract(grid_position);
float animation_time = matrix_time * matrix_speed;
float stream_density = clamp(matrix_stream_density, 0.25, 2.0);

float resolved_glyph_scale = clamp(matrix_glyph_scale, 0.50, 1.0);
vec2 glyph_local = (within_cell - 0.5) / resolved_glyph_scale + 0.5;
float glyph_cell_mask =
    step(0.0, glyph_local.x) * step(glyph_local.x, 1.0) *
    step(0.0, glyph_local.y) * step(glyph_local.y, 1.0);
float cell_seed = cell.x * 131.0 + cell.y * 17.0;
float column_seed = matrix_hash(cell.x * 7.17 + 3.0);
float depth = matrix_hash(cell.x * 3.91 + 11.0);

float mutation_seed = matrix_hash(cell_seed + 41.0);
float mutation_rate = mix(0.20, 1.65, mutation_seed * mutation_seed);
float glyph_epoch = floor(animation_time * mutation_rate +
    cell.y * 0.173 + mutation_seed * 7.0);

float active_glyph_count = max(2.0, matrix_glyph_count);
float glyph_index = floor(matrix_hash(
    cell_seed + glyph_epoch * 97.31) * active_glyph_count);
vec4 glyph_sample = matrix_glyph_sample(glyph_index, glyph_local);
float glyph_alpha = max(max(glyph_sample.r, glyph_sample.g), max(glyph_sample.b, glyph_sample.a)) * glyph_cell_mask;

float speed = mix(0.55, 1.45, depth);
float period = mix(1.15, 2.65, column_seed);
float phase = matrix_hash(cell.x * 19.33 + 7.0) * period;
float primary_travel = animation_time * speed + phase;
float primary_cycle = floor(primary_travel / period);
float primary_length = mix(0.28, 0.78, matrix_hash(
    cell.x * 5.73 + primary_cycle * 61.7 + 19.0));
float head_one = mod(primary_travel, period) - primary_length;

float row = (cell.y + 0.5) / matrix_rows;
float cell_height = 1.0 / matrix_rows;

float primary_probability = min(stream_density * 0.72, 1.0);
vec3 first_drop = matrix_drop(head_one, row, primary_length, cell_height) *
    step(1.0 - primary_probability, matrix_hash(cell.x * 33.7 + 29.0));

float second_travel = animation_time * speed * 0.91 + phase + period * 0.53;
float second_cycle = floor(second_travel / period);
float second_length = mix(0.24, 0.70, matrix_hash(
    cell.x * 21.7 + second_cycle * 73.9 + 5.0));
float head_two = mod(second_travel, period) - second_length;

float secondary_probability = min(stream_density * 0.42, 1.0);
vec3 second_drop = matrix_drop(head_two, row, second_length, cell_height) *
    step(1.0 - secondary_probability, matrix_hash(cell.x * 47.19 + 53.0));

vec3 rain = max(first_drop, second_drop);
rain.z = mix(first_drop.x, second_drop.x, 0.5) *
    step(0.01, first_drop.x) * step(0.01, second_drop.x);

float illumination = clamp(rain.x * 0.88 + rain.y * 0.78 + rain.z * 0.30, 0.0, 1.0);

// Multi-Color Syntax Detection: check if atlas sample has chromatic color
float is_chromatic = step(0.04, length(glyph_sample.rgb - vec3(glyph_alpha)));
vec3 syntax_base_color = mix(matrix_rain_color, glyph_sample.rgb, is_chromatic);

// Colors: Active rain & glowing cursor
vec3 active_rain_color = syntax_base_color;
vec3 active_cursor_color = matrix_cursor_color;

// Base trail color ramp (dark teal -> bright teal)
vec3 dark_trail = active_rain_color * 0.15;
vec3 trail_color = mix(dark_trail, active_rain_color, pow(rain.x, 0.72));

// Only allow white highlight (cursor & stream intersection glint) to illuminate the solid inner core of the glyph
// Anti-aliased outer edge pixels remain cleanly saturated with trail color, eliminating ugly jagged white fringing
float core_gate = smoothstep(0.35, 0.90, glyph_alpha);
vec3 glint_color = mix(trail_color, mix(active_rain_color, vec3(1.0), 0.45), rain.z * 0.72 * core_gate);
vec3 core_color = mix(glint_color, active_cursor_color, rain.y * core_gate);

float halo = 0.0;
float neighbor_sum = 0.0;
vec3 neighbor_color_sum = vec3(0.0);

// Smooth edge feathering at cell boundary to avoid hard box shearing
float feather_margin = 0.045;
float cell_edge_feather =
    smoothstep(0.0, feather_margin, glyph_local.x) *
    smoothstep(1.0, 1.0 - feather_margin, glyph_local.x) *
    smoothstep(0.0, feather_margin, glyph_local.y) *
    smoothstep(1.0, 1.0 - feather_margin, glyph_local.y);

if (matrix_glow > 0.5 || matrix_soft_blur > 0.5) {
    // Exact atlas texel offset: 1.5 pixels in a 64x64 glyph cell (1.5 / 64.0)
    float halo_offset = 1.50 / 64.0;

    vec4 sample_right = matrix_glyph_sample(glyph_index, glyph_local + vec2(halo_offset, 0.0));
    vec4 sample_left  = matrix_glyph_sample(glyph_index, glyph_local - vec2(halo_offset, 0.0));
    vec4 sample_down  = matrix_glyph_sample(glyph_index, glyph_local + vec2(0.0, halo_offset));
    vec4 sample_up    = matrix_glyph_sample(glyph_index, glyph_local - vec2(0.0, halo_offset));

    float a_r = max(max(sample_right.r, sample_right.g), max(sample_right.b, sample_right.a));
    float a_l = max(max(sample_left.r, sample_left.g), max(sample_left.b, sample_left.a));
    float a_d = max(max(sample_down.r, sample_down.g), max(sample_down.b, sample_down.a));
    float a_u = max(max(sample_up.r, sample_up.g), max(sample_up.b, sample_up.a));

    neighbor_sum = a_r + a_l + a_d + a_u;
    halo = max(max(a_r, a_l), max(a_d, a_u)) * cell_edge_feather;

    neighbor_color_sum = sample_right.rgb + sample_left.rgb + sample_down.rgb + sample_up.rgb;
}

if (matrix_soft_blur > 0.5) {
    // 4-tap convolution blur with energy conservation (0.40 center + 4 * 0.15 neighbors = 1.0)
    float softened_alpha = glyph_alpha * 0.40 + neighbor_sum * 0.15;
    glyph_alpha = mix(glyph_alpha, softened_alpha, 0.72) * cell_edge_feather;

    // Optical chromatic softening for multi-color themes
    if (is_chromatic > 0.5) {
        vec3 softened_color = core_color * 0.40 + neighbor_color_sum * 0.15;
        core_color = mix(core_color, softened_color, 0.50);
    }
}

float rain_strength = max(rain.x, max(rain.y, rain.z));
float core_alpha = glyph_alpha * illumination;

// Gate the halo bloom to actual glyph stroke proximity.
// Without this, neighbor-alpha samples from the atlas fire across the entire
// cell background (glyph_alpha = 0 regions), painting a colored rectangle
// around every character tile. stroke_proximity is the max of:
//   - glyph_alpha: coverage at this exact pixel
//   - halo:        max coverage of the 4 immediate neighbors
// Only pixels with at least one nearby stroke contribute to the outer glow.
float stroke_proximity = max(glyph_alpha, halo);
float halo_contour_gate = smoothstep(0.02, 0.25, stroke_proximity);
float halo_alpha = halo * rain_strength * matrix_glow * 0.34 * halo_contour_gate;

// Composite: solid inner core + soft outer glow, over black background
vec3 final_color = core_color * core_alpha + active_rain_color * halo_alpha;

// Output: Pure opaque solid black background with glowing code rain
cogl_color_out = vec4(final_color, 1.0);
`;

export function parseColorToRgb(str, fallback = [0.051, 0.878, 0.922]) {
    try {
        if (!str)
            return fallback;
        str = str.trim();
        if (str.startsWith('#')) {
            let hex = str.slice(1);
            if (hex.length === 3)
                hex = hex.split('').map(c => c + c).join('');
            const r = parseInt(hex.slice(0, 2), 16) / 255;
            const g = parseInt(hex.slice(2, 4), 16) / 255;
            const b = parseInt(hex.slice(4, 6), 16) / 255;
            if (!isNaN(r) && !isNaN(g) && !isNaN(b))
                return [r, g, b];
        } else if (str.startsWith('rgb')) {
            const matches = str.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/);
            if (matches) {
                return [
                    parseFloat(matches[1]) / 255,
                    parseFloat(matches[2]) / 255,
                    parseFloat(matches[3]) / 255,
                ];
            }
        }
    } catch {
        // Fallback
    }
    return fallback;
}
