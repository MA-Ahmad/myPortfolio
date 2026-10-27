import { fitProjection, iso, type Flat, type Point3, type Projection } from './iso-kit';
import { CENTER, LIFT, PLATE, R, add, basisOf, scale, type Vec } from './globe';

/**
 * The camera: the kit's isometric view, fitted so the ball and every plate pulled all the way out of it
 * fill the square frame.
 */

export const WIDTH = 720;
export const HEIGHT = 720;

/** The ball seen whole, with room for plates lifted to their full height. */
export const P: Projection = (() => {
  const unit: Projection = { origin: [0, 0], scale: 1 };
  const { right, up } = basisOf(unit);
  const reach = R + PLATE + LIFT + 6;
  const points: Point3[] = [];
  for (const axis of [right, up]) for (const sign of [1, -1]) points.push(add(CENTER as Vec, scale(axis, sign * reach)) as Point3);
  return fitProjection(points, WIDTH, HEIGHT, { pad: 18 });
})();

/** Screen units per world unit. */
export const K = Math.sqrt(1.6) * P.scale;
export const CENTER_FLAT: Flat = iso(CENTER, P);
