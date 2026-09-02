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

float matrix_glyph_alpha(float glyph_index, vec2 local) {
    vec2 atlas_cell = vec2(
        mod(glyph_index, ${GLYPH_ATLAS_COLUMNS}.0),
        floor(glyph_index / ${GLYPH_ATLAS_COLUMNS}.0));
    vec2 atlas_uv = (atlas_cell + clamp(local, 0.015, 0.985)) /
        vec2(${GLYPH_ATLAS_COLUMNS}.0, ${GLYPH_ATLAS_ROWS}.0);
    vec4 tex = texture2D(cogl_sampler_0, atlas_uv);
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
float glyph_alpha = matrix_glyph_alpha(glyph_index, glyph_local) * glyph_cell_mask;

float gap = mix(0.05, 0.22, matrix_hash(cell.x * 9.31 + 7.0));
float period = 1.78 + gap;
float speed = mix(0.12, 0.31, column_seed) * mix(0.82, 1.18, depth);
float phase = matrix_hash(cell.x * 15.13 + 23.0) * period;
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
float second_probability = clamp((stream_density - 0.75) * 0.70, 0.0, 0.70);
vec3 second_drop = matrix_drop(head_two, row, second_length, cell_height) *
    step(1.0 - second_probability, matrix_hash(cell.x * 27.1 + 13.0));

vec3 rain = max(first_drop, second_drop);

float depth_brightness = mix(0.58, 1.0, depth);
rain.x = floor(clamp(rain.x, 0.0, 1.0) * 7.0 + 0.5) / 7.0;
rain.x *= depth_brightness;
float redraw_epoch = floor(animation_time * 1.35);
float redraw_glint = step(0.965, matrix_hash(cell_seed * 2.17 + redraw_epoch * 79.3));
rain.z = max(rain.z, redraw_glint * rain.x * (1.0 - rain.y) * 0.72);

float illumination = clamp(rain.x * 0.88 + rain.y * 0.78 + rain.z * 0.30, 0.0, 1.0);

// Colors: Active rain & glowing cursor
vec3 active_rain_color = matrix_rain_color;
vec3 active_cursor_color = matrix_cursor_color;

vec3 dark_trail = active_rain_color * 0.15;
vec3 color = mix(dark_trail, active_rain_color, pow(rain.x, 0.72));
color = mix(color, mix(active_rain_color, vec3(1.0), 0.45), rain.z * 0.72);
color = mix(color, active_cursor_color, rain.y);

float halo = 0.0;
float neighbor_sum = 0.0;
if (matrix_glow > 0.5 || matrix_soft_blur > 0.5) {
    float halo_offset = 2.25 / 64.0;
    float neighbor_right = matrix_glyph_alpha(glyph_index, glyph_local + vec2(halo_offset, 0.0));
    float neighbor_left = matrix_glyph_alpha(glyph_index, glyph_local - vec2(halo_offset, 0.0));
    float neighbor_down = matrix_glyph_alpha(glyph_index, glyph_local + vec2(0.0, halo_offset));
    float neighbor_up = matrix_glyph_alpha(glyph_index, glyph_local - vec2(0.0, halo_offset));
    neighbor_sum = neighbor_right + neighbor_left + neighbor_down + neighbor_up;
    halo = max(max(neighbor_right, neighbor_left), max(neighbor_down, neighbor_up)) * glyph_cell_mask;
}

if (matrix_soft_blur > 0.5) {
    float softened_alpha = glyph_alpha * 0.40 + neighbor_sum * 0.15;
    glyph_alpha = mix(glyph_alpha, softened_alpha, 0.72) * glyph_cell_mask;
}

float rain_strength = max(rain.x, max(rain.y, rain.z));
float core_alpha = glyph_alpha * illumination;
float halo_alpha = halo * rain_strength * matrix_glow * 0.34;
float glyph_vis = clamp(max(core_alpha, halo_alpha), 0.0, 1.0);

// Output: Pure opaque solid black background with glowing code rain
cogl_color_out = vec4(color * glyph_vis, 1.0);
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
