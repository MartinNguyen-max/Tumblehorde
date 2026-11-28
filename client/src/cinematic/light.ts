/**
 * Light and air for each kind of scene: golden mornings, firelit nights, cold prison grey.
 * Each preset sets the sky, fog, ambient and sun; the stage restores the battle look afterwards.
 */

export interface LightPreset {
  sky: string;
  fog: string;
  fogStart: number;
  fogEnd: number;
  hemiSky: string;
  hemiGround: string;
  hemiIntensity: number;
  sun: string;
  sunIntensity: number;
  /** Direction the sunlight travels. */
  sunDirection: readonly [number, number, number];
}

export type LightName = 'goldenMorning' | 'day' | 'city' | 'dusk' | 'night' | 'fireNight' | 'rain' | 'prison' | 'snow' | 'white' | 'interior' | 'deadLight' | 'grey';

export const LIGHTS: Record<LightName, LightPreset> = {
  goldenMorning: {
    sky: '#F6CF8E', fog: '#F3D2A0', fogStart: 25, fogEnd: 110,
    hemiSky: '#FFE2B0', hemiGround: '#7A6A3C', hemiIntensity: 0.75,
    sun: '#FFC777', sunIntensity: 1.15, sunDirection: [-0.8, -0.35, 0.45],
  },
  day: {
    sky: '#8EC9EE', fog: '#9ED3F0', fogStart: 60, fogEnd: 200,
    hemiSky: '#BFE4FF', hemiGround: '#5E8C3C', hemiIntensity: 0.85,
    sun: '#FFF4E0', sunIntensity: 0.95, sunDirection: [-0.5, -0.8, -0.35],
  },
  city: {
    sky: '#8EC9EE', fog: '#B8D4E8', fogStart: 40, fogEnd: 140,
    hemiSky: '#CFE4F4', hemiGround: '#8A7A66', hemiIntensity: 0.62,
    sun: '#FFF0D8', sunIntensity: 0.82, sunDirection: [-0.55, -0.75, -0.35],
  },
  dusk: {
    sky: '#C86A4A', fog: '#A85A4A', fogStart: 20, fogEnd: 100,
    hemiSky: '#E89A70', hemiGround: '#3A2A2A', hemiIntensity: 0.55,
    sun: '#FF8A50', sunIntensity: 0.9, sunDirection: [0.9, -0.25, 0.2],
  },
  night: {
    sky: '#16224A', fog: '#18264A', fogStart: 18, fogEnd: 90,
    hemiSky: '#5A6AA8', hemiGround: '#20283A', hemiIntensity: 0.62,
    sun: '#A8BCF0', sunIntensity: 0.5, sunDirection: [0.4, -0.8, 0.3],
  },
  fireNight: {
    sky: '#2A1018', fog: '#3A1A1A', fogStart: 10, fogEnd: 60,
    hemiSky: '#A04A30', hemiGround: '#1A0E0E', hemiIntensity: 0.45,
    sun: '#FF7A3A', sunIntensity: 0.55, sunDirection: [-0.3, -0.5, -0.8],
  },
  /** The wizard's sorcery: a sick green over everything. */
  deadLight: {
    sky: '#22382C', fog: '#2E4A3A', fogStart: 20, fogEnd: 100,
    hemiSky: '#B0E0C0', hemiGround: '#2A3A30', hemiIntensity: 0.75,
    sun: '#C8F0D4', sunIntensity: 0.6, sunDirection: [0.3, -0.7, 0.5],
  },
  /** An overcast morning: no sun, no shadows to speak of, nobody cheering. */
  grey: {
    sky: '#9AA4AE', fog: '#A4ACB4', fogStart: 30, fogEnd: 130,
    hemiSky: '#C8D0D8', hemiGround: '#6A6A62', hemiIntensity: 0.78,
    sun: '#E0E4E8', sunIntensity: 0.45, sunDirection: [-0.4, -0.85, -0.3],
  },
  rain: {
    sky: '#5A6470', fog: '#5E6872', fogStart: 8, fogEnd: 55,
    hemiSky: '#8A96A4', hemiGround: '#2E3430', hemiIntensity: 0.6,
    sun: '#A8B4C0', sunIntensity: 0.35, sunDirection: [-0.3, -0.9, 0.2],
  },
  prison: {
    sky: '#1A1A1E', fog: '#1A1A1E', fogStart: 6, fogEnd: 30,
    hemiSky: '#9AA0AC', hemiGround: '#4A4438', hemiIntensity: 0.8,
    sun: '#FFF0C8', sunIntensity: 0.8, sunDirection: [0.6, -0.55, 0.3],
  },
  snow: {
    sky: '#C8D6E4', fog: '#D4E0EA', fogStart: 15, fogEnd: 90,
    hemiSky: '#E8F0FF', hemiGround: '#A0AAB8', hemiIntensity: 0.85,
    sun: '#E8F0FF', sunIntensity: 0.6, sunDirection: [-0.4, -0.7, 0.4],
  },
  white: {
    sky: '#FFFFFF', fog: '#FFFFFF', fogStart: 4, fogEnd: 40,
    hemiSky: '#FFFFFF', hemiGround: '#F4EEDC', hemiIntensity: 1.1,
    sun: '#FFF6E0', sunIntensity: 0.6, sunDirection: [0, -1, 0.3],
  },
  interior: {
    sky: '#1E140E', fog: '#24180F', fogStart: 8, fogEnd: 40,
    hemiSky: '#C88A50', hemiGround: '#2A1A10', hemiIntensity: 0.5,
    sun: '#FFB070', sunIntensity: 0.55, sunDirection: [0.5, -0.6, 0.5],
  },
};
